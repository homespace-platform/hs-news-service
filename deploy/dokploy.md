# News Service — Compose riêng trên Dokploy

GitHub Actions lint/test/build rồi push image lên Docker Hub. Dokploy chạy Compose riêng với service name `hs-news-service`, cùng external network `hs-network` của infra. Không thêm News vào Compose infra, không tạo domain riêng hoặc mở cổng host `8083`; mọi truy cập public/admin đi qua Gateway.

## 1. File và env production

- `Dockerfile`: Node 24, build NestJS, runtime production dependencies, user `node`, port `8083`, healthcheck `/ping`.
- `.dockerignore`: chỉ đưa build inputs vào image, loại env và credential files.
- `compose.production.yml`: `${NEWS_IMAGE:?}`, `pull_policy: always`, restart `unless-stopped`, memory limit 512 MiB; tự nối `hs-network`, không cần alias hoặc Advanced → Networks.
- `.env.prod`: file riêng tư, Git ignore; giữ nguyên `.env` và `.env.example` dành cho dev.
- `.github/workflows/publish-image.yml`: chỉ lint/test/build/push, không gọi deploy API. Push tag SHA và `latest` trên `master`; pull request chỉ kiểm tra/build.

Đặt `NEWS_IMAGE=nvminh162/hs-news-service:latest` ở dòng đầu `.env.prod`. Compose yêu cầu biến image và đủ **13 biến runtime** bằng `${VARIABLE:?}`; thiếu hoặc rỗng sẽ báo lỗi, không có fallback.

| Biến | Giá trị / nguồn |
| --- | --- |
| `NODE_ENV`, `PORT`, `SERVICE_NAME` | `production`, `8083`, `hs-news-service` |
| `MONGODB_URI` | DNS `mongodb:27017`, database riêng `homespace_news`, `authSource=admin`; credential từ infra production |
| `EUREKA_CLIENT_SERVICE_URL` | `http://hs-discovery-server:8761/eureka/` |
| `EUREKA_INSTANCE_HOSTNAME` | `hs-news-service`, DNS từ tên service Compose |
| `KAFKA_BROKERS` | `kafka:19092` |
| `KAFKA_NEWS_TOPIC` | `homespace.news.events.v1`, khớp infra và Core consumer |
| `AWS_REGION`, `AWS_S3_BUCKET` | Giữ cấu hình S3 hiện có của News |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Credential hiện có của News; không đưa lên Git/chat hoặc GitHub Actions |
| `AWS_S3_UPLOAD_URL_DURATION_SECONDS` | Giữ thời hạn presigned upload hiện có, trong khoảng 1–3600 giây |

News phát sự kiện lên topic News; Core xử lý broadcast rồi phát notification. Không thay topic News bằng `homespace.notification.events.v1`. Không thêm biến env chưa được code sử dụng.

## 2. Publish image

1. Docker Hub: chuẩn bị repository **`nvminh162/hs-news-service`**. Nếu image private, cấu hình registry pull credential riêng trên Dokploy.
2. GitHub repo `homespace-platform/hs-news-service`: cấp Actions secrets `DOCKERHUB_USERNAME` và `DOCKERHUB_TOKEN` có quyền push.
3. Review rồi commit/push các file deploy; giữ `.env.prod` ngoài Git.
4. Chờ workflow **Build and publish News Service** thành công, xác nhận image tag `latest` đã được publish. Không cần MongoDB/AWS secrets trong Actions.

## 3. Deploy Compose Raw

1. Infra, Discovery và Gateway phải healthy; `hs-network` phải có `driver=overlay`, `attachable=true`. Giữ network, volumes và database hiện có; không chạy lệnh reset database khi deploy.
2. Nếu có Application News cũ, lưu cấu hình/webhook rồi Stop trước khi chạy Compose mới; không chạy hai bản song song.
3. **Projects → homespace → production → Create Service → Docker Compose**, tên `hs-news-service`, cùng server với infra.
4. General → **Raw**, dán toàn bộ [compose.production.yml](../compose.production.yml), chọn Compose Type **Docker Compose**, không chọn Stack → Save. Không dùng Application/Nixpacks.
5. **Environment**: dán nguyên `.env.prod`, gồm `NEWS_IMAGE` ở dòng đầu → Save. Single quote là cú pháp dotenv; file local không tự cập nhật Dokploy.
6. **Preview Compose**: service `hs-news-service`, đúng image, đủ env, default network external `hs-network`, không có host ports/volumes. Giữ tắt Isolated Deployment và xác nhận Preview vẫn giữ mạng chung.
7. Không thêm domain public. Gateway đã có route `lb://hs-news-service` cho public/admin/diagnostics.
8. **Deploy**, chờ container healthy và Logs có `Registered ... with Eureka`. Bắt đầu với một instance; kiểm tra thực tế trước khi thay đổi tài nguyên hoặc scale.

## 4. Docker Hub webhook

1. Sau khi deploy thủ công thành công, bật Autodeploy trên **Compose News**.
2. Deployments → copy webhook của chính Compose này, dạng `/api/deploy/compose/TOKEN`.
3. Docker Hub → repository `hs-news-service` → Webhooks: tên `dokploy-news`, URL vừa copy → Save.
4. Chạy lại workflow để kiểm tra delivery và Deployments. Compose luôn pull image nhờ `pull_policy: always`.

Raw Compose trên Dokploy v0.31.4 không lọc tag như Application Docker: push cả SHA và `latest` có thể gây hai delivery/deploy. Không dùng webhook infra hoặc Application cũ. Raw không tự lấy YAML từ Git; khi sửa Compose phải dán lại rồi Save. Giữ kín webhook token.

Rollback: tắt Autodeploy, đổi `NEWS_IMAGE` trong Environment thành `nvminh162/hs-news-service:<SHA-tốt>` rồi Save → Deploy. Không xóa database, topic hoặc dữ liệu S3.

## 5. Kiểm tra sau deploy

Trên EC2:

```bash
sudo docker ps --filter label=com.docker.compose.service=hs-news-service --format '{{.Names}} {{.Status}}'
curl --fail --silent --show-error --max-time 10 https://api.homespace.id.vn/api/v1/news/ping
```

Cần `pong` và **HS-NEWS-SERVICE — UP** trên Eureka. `/ping` chỉ chứng minh HTTP process, chưa chứng minh MongoDB, S3 hoặc Kafka hoạt động đầy đủ.

- Public `/api/v1/public/news` chỉ trả bài published/active; không lộ draft.
- `/api/v1/admin/news` khi chưa đăng nhập phải bị từ chối; tài khoản admin mới được authoring/upload.
- Thử upload/complete ảnh từ admin, publish và mở bài trên web. S3 dùng prefix `public/news/*`; đối chiếu IAM, bucket CORS cho frontend production và quyền đọc ảnh hiện có. Không mở quyền toàn bucket để sửa lỗi upload/hiển thị.
- Kiểm tra sự kiện News đi qua Core và Notification sau publish; không đổi topic hoặc xóa dữ liệu để thử.

Healthcheck thành công chưa xác nhận credential S3, bucket policy/CORS hoặc Kafka consumer hoạt động. Các kết nối này phải được kiểm tra trên môi trường triển khai.
