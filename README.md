# HomeSpace News Service

NestJS microservice độc lập dành cho miền tin tức của HomeSpace. Service sở hữu MongoDB `homespace_news`, hai collection `news_articles` và `news_assets`, cùng toàn bộ luồng upload ảnh lên S3. Service không gọi `hs-core-api` khi chạy.

Yêu cầu Node.js `>=22.14.0`.

## Chạy local

```powershell
Copy-Item .env.example .env.dev
npm install
npm run start:dev
```

Điền MongoDB, Eureka và AWS S3 trong `.env.dev`. AWS SDK tự đọc `AWS_ACCESS_KEY_ID` và `AWS_SECRET_ACCESS_KEY`; khi deploy có thể dùng IAM role thay cho hai biến này.

## API qua Gateway

- Public: `GET /api/v1/public/news`, `GET /api/v1/public/news/:slug`
- Admin: `GET|POST /api/v1/admin/news`, `GET|PUT|DELETE /api/v1/admin/news/:newsId`
- Media admin: `POST /api/v1/admin/news/media/uploads`, `POST /api/v1/admin/news/media/:storageId/complete`
- Diagnostics: `GET /api/v1/news/ping`, `GET /api/v1/news/auth/me`

Gateway bỏ `/api/v1` cho public/admin và bỏ `/api/v1/news` cho diagnostics trước khi forward tới service trên port `8083`.

## Reset database

Không có data migration từ module Java cũ. Khi chuyển môi trường, chủ động drop database cũ rồi để service tạo lại collection/index:

```javascript
use homespace_news
db.dropDatabase()
```

## Endpoint kiểm tra

- Trực tiếp: `GET http://localhost:8083/ping`
- Qua Gateway: `GET http://localhost:8080/api/v1/news/ping`
- Có xác thực qua Gateway: `GET http://localhost:8080/api/v1/news/auth/me`

Các endpoint admin không tự verify JWT. Gateway verify JWT và chuyển identity qua `X-User-Id`, `X-User-Email`, `X-User-Name`, `X-User-Name-B64`, `X-User-Role`, `X-User-Authorities`. News service ưu tiên `X-User-Name-B64` để giữ nguyên tên Unicode UTF-8; `X-User-Name` được giữ làm fallback tương thích. Role phải là `ADMIN`.

`EUREKA_INSTANCE_HOSTNAME=localhost` bật chế độ tự tìm IPv4 physical để đăng ký Eureka, tương đương `eureka.instance.prefer-ip-address=true` của các Java service. Có thể đặt IP/hostname cụ thể để override khi chạy trong Docker hoặc VM.
