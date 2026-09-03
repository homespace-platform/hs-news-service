# Standalone News Service Design

## Goal

Move the complete HomeSpace news bounded context from the Java modular monolith into `hs-news-service`, an independently deployable NestJS service that owns its MongoDB data and S3 media lifecycle.

## Boundaries

- `hs-news-service` owns news articles, upload metadata, validation, publication rules, public/admin APIs, and news image objects in S3.
- It does not call `hs-core-api` and does not read PostgreSQL tables owned by core services.
- API Gateway remains the public entry point, verifies JWTs, authorizes `/admin/**`, forwards identity headers, and discovers the service through Eureka.
- Existing browser-facing URLs and response shapes remain compatible.
- Existing PostgreSQL news data is discarded when the team resets the database; no migration script is required.

## HTTP Contracts

Gateway routes these path families to `lb://hs-news-service` before the core catch-all route:

- `/api/v1/news/**` strips `/api/v1/news` for `/ping` and `/auth/me`.
- `/api/v1/public/news/**` strips `/api/v1` and preserves `/public/news/**`.
- `/api/v1/admin/news/**` strips `/api/v1` and preserves `/admin/news/**`.

The service keeps the current article endpoints:

- `GET /public/news`
- `GET /public/news/:slug`
- `POST /admin/news`
- `GET /admin/news`
- `GET /admin/news/:newsId`
- `PUT /admin/news/:newsId`
- `DELETE /admin/news/:newsId`

News-owned upload endpoints replace the generic storage endpoints for news images:

- `POST /admin/news/media/uploads`
- `POST /admin/news/media/:storageId/complete`

The upload create response keeps `storageId`, `uploadUrl`, `method`, `objectKey`, and `expiresAt`, so the admin portal can reuse its existing three-step presigned upload flow. Article requests continue to use `thumbnailStorageObjectId` and image block `storageObjectId`.

## Identity and Authorization

The Gateway forwards `X-User-Id`, `X-User-Email`, `X-User-Role`, `X-User-Authorities`, and optional `X-User-Name`. `X-User-Name` comes from JWT `name`, or `given_name` plus `family_name`, with email as fallback. News stores `authorId` and `authorName` as a snapshot at creation time.

Public controllers require no identity. Admin controllers require a user id and role `ADMIN`; direct access to port 8083 must remain private to the deployment network because the service trusts Gateway headers by design.

## MongoDB Model

`news_articles` uses string UUID `_id` values and stores:

- title, normalized lowercase slug, summary, category, status, featured, tags
- content blocks and resolved media snapshots
- author id/name, published timestamp, soft-delete flag, created/updated timestamps

`news_assets` uses string UUID `_id` values and stores:

- S3 bucket/key, original name, MIME type, byte size, checksum
- owner id, status (`PENDING`, `READY`, `REJECTED`), and timestamps

Articles embed resolved media snapshots, so reads are one MongoDB query and article writes do not require multi-document transactions. Upload records remain after article deletion, matching the current non-destructive storage behavior.

## S3 Flow

1. An admin requests an upload URL; the service accepts JPEG, PNG, or WebP up to 25 MiB and creates a `PENDING` asset.
2. The browser uploads directly to S3 with the returned presigned PUT URL.
3. The browser completes the upload; the service calls `HeadObject`, verifies content length/type, and marks the asset `READY` or `REJECTED`.
4. Article create/update verifies every referenced asset is `READY` and owned by the current admin, then embeds media snapshots and public URLs.

## Article Rules

- Slugs match `[a-z0-9]+(?:-[a-z0-9]+)*` and are unique.
- Publishing requires a thumbnail and at least one non-empty text or image block.
- Media ids cannot repeat in one article.
- Drafts are hidden from public list/detail APIs.
- First publication sets `publishedAt`; editing a published article preserves it; changing to draft clears it.
- Delete is a soft delete.
- Admin sorting is limited to `createdAt`, `publishedAt`, and `title`; public sorting is featured first, then latest publication.

## Errors

The NestJS exception filter returns the existing `{ code, message, result? }` envelope. Validation errors return HTTP 400. Domain errors cover duplicate slug, missing article, invalid content, invalid/forbidden media, unauthenticated access, and unauthorized admin access. S3 provider failures return a stable service error without leaking provider details.

## Repository Changes

- `hs-news-service`: add article/media modules, schemas, DTOs, S3 integration, tests, environment variables, and README API documentation.
- `hs-gateway-server`: add three news routes, circuit-breaker configuration, public ping rule, and `X-User-Name` forwarding.
- `hs-admin-portal`: point only `uploadNewsImage` to news-owned upload endpoints; other storage calls remain unchanged.
- `hs-core-api`: remove the Maven news module, its API dependency/controllers, and Java source/tests.

## Verification

- News unit tests cover publication rules, media ownership/readiness, slug conflicts, soft deletion, and public draft exclusion.
- News e2e tests cover health/auth plus public/admin route contracts without calling external services.
- Build, lint, and tests run for both Node projects.
- Maven compile/test runs with `-Dmaven.compiler.proc=full` because this machine uses JDK 23 while the projects target Java 21.

## Deliberate Simplification

No historical data migration, orphaned S3 cleanup job, CDN, or event bus is added. Add cleanup only when orphaned asset cost becomes measurable; add events only when another service has a concrete news-event consumer.
