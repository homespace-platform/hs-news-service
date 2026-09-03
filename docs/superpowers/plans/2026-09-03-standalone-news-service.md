# Standalone News Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Java news module with an independently deployable NestJS service backed by MongoDB and its own S3 media flow.

**Architecture:** `hs-news-service` owns article and asset collections and exposes backward-compatible public/admin contracts. Gateway routes all news paths to it and forwards identity; the admin portal changes only its news image upload endpoints; core deletes its news module.

**Tech Stack:** NestJS 12, Mongoose 9, MongoDB, AWS SDK v3/S3, Jest 30, Spring Cloud Gateway, Maven/Java 21 target, React/Vite.

**Spec:** `docs/superpowers/specs/2026-09-03-standalone-news-service-design.md`

## Global Constraints

- Do not add a runtime call from news to core-api.
- Preserve existing article request/response shapes and browser-facing URLs.
- Store news data only in `homespace_news` MongoDB and news media only under the news service's S3 ownership.
- Do not implement historical data migration or orphan cleanup.

---

### Task 1: News domain and MongoDB persistence

**Files:**
- Create: `src/modules/news/news.module.ts`
- Create: `src/modules/news/news.service.ts`
- Create: `src/modules/news/news.service.spec.ts`
- Create: `src/modules/news/persistence/news.schema.ts`
- Create: `src/modules/news/presentation/news-admin.controller.ts`
- Create: `src/modules/news/presentation/public-news.controller.ts`
- Create: `src/modules/news/presentation/dto/news.dto.ts`
- Modify: `src/app.module.ts`
- Modify: `src/common/constants/error-code.constant.ts`

**Interfaces:**
- Consumes: `UserContext` from the authentication module and ready media from Task 2.
- Produces: backward-compatible `/admin/news` and `/public/news` endpoints.

- [ ] Write failing service tests for create, duplicate slug, publication validation, public draft exclusion, update publication timestamp, and soft delete.
- [ ] Run `npm test -- news.service.spec.ts --runInBand` and confirm failures are caused by the missing news implementation.
- [ ] Add DTO validation, Mongo schema/indexes, service logic, page response DTO, and controllers.
- [ ] Run the focused test and the full news test suite.
- [ ] Commit the independently testable news domain.

### Task 2: News-owned S3 media

**Files:**
- Create: `src/modules/media/media.module.ts`
- Create: `src/modules/media/media.service.ts`
- Create: `src/modules/media/media.service.spec.ts`
- Create: `src/modules/media/persistence/news-asset.schema.ts`
- Create: `src/modules/media/presentation/media.controller.ts`
- Create: `src/modules/media/presentation/dto/media.dto.ts`
- Modify: `src/config/environment.validation.ts`
- Modify: `src/config/environment.validation.spec.ts`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: Gateway user id and AWS default credential chain.
- Produces: `createUpload`, `completeUpload`, and `resolveReadyOwnedAssets` used by article writes.

- [ ] Write failing tests for accepted image uploads, size/type rejection, S3 completion mismatch, and owner/readiness validation.
- [ ] Run `npm test -- media.service.spec.ts --runInBand` and confirm expected failures.
- [ ] Install only `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`; implement the minimal presigned PUT and `HeadObject` flow.
- [ ] Add AWS environment validation and upload controllers.
- [ ] Run focused tests, lint, and build.
- [ ] Commit the media flow.

### Task 3: Authentication contract

**Files:**
- Modify: `src/modules/authentication/domain/user-context.ts`
- Modify: `src/modules/authentication/presentation/guards/gateway-authentication.guard.ts`
- Create: `src/modules/authentication/presentation/guards/admin.guard.ts`
- Modify: `test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: `X-User-Name` plus existing `X-User-*` headers.
- Produces: trusted `UserContext` with `name` and admin authorization.

- [ ] Add failing tests for name forwarding and rejection of non-admin access.
- [ ] Run the e2e/focused tests and confirm expected failures.
- [ ] Extend the context and add the minimal admin guard.
- [ ] Run all news tests.
- [ ] Commit the authentication contract.

### Task 4: Gateway routing and identity forwarding

**Files:**
- Modify: `src/main/java/com/hs/gateway/HsGatewayServerApplication.java`
- Modify: `src/main/java/com/hs/gateway/filter/UserHeaderFilter.java`
- Modify: `src/main/resources/application.properties`
- Create: `src/test/java/com/hs/gateway/filter/UserHeaderFilterTest.java`
- Create: `src/test/java/com/hs/gateway/NewsRouteConfigurationTest.java`

**Interfaces:**
- Consumes: Eureka app `HS-NEWS-SERVICE` and JWT name claims.
- Produces: three news route families and `X-User-Name`.

- [ ] Add failing tests for path routing and identity-name fallback.
- [ ] Run focused Maven tests with `mvn '-Dmaven.compiler.proc=full' test`.
- [ ] Add news routes before the core catch-all, news circuit breaker/time limiter, fallback, and public ping rule.
- [ ] Extend header forwarding using JWT claims with email fallback.
- [ ] Run Maven compile and focused tests.
- [ ] Commit the Gateway integration.

### Task 5: Admin portal upload switch

**Files:**
- Modify: `src/services/storage.service.ts`
- Create: `src/services/storage.service.test.mjs`

**Interfaces:**
- Consumes: unchanged `uploadNewsImage(file)` API used by the editor.
- Produces: requests to `/api/v1/admin/news/media/uploads` and `/api/v1/admin/news/media/:id/complete`.

- [ ] Add a failing test around the news upload request URLs.
- [ ] Run the focused Node test and confirm failure.
- [ ] Change only the news upload path; leave avatar/storage behavior unchanged.
- [ ] Run the focused test and `npm run build`.
- [ ] Commit the portal change.

### Task 6: Remove Java news module

**Files:**
- Delete: `hs-news-service/**`
- Delete: `hs-api-service/src/main/java/com/hs/api/controller/admin/NewsAdminController.java`
- Delete: `hs-api-service/src/main/java/com/hs/api/controller/publish/PublicNewsController.java`
- Modify: `pom.xml`
- Modify: `hs-api-service/pom.xml`

**Interfaces:**
- Consumes: Gateway now owns all external routing to standalone news.
- Produces: a core Maven reactor with no news source or dependency.

- [ ] Remove the API dependency/controllers and reactor module entry.
- [ ] Remove the Java news module directory.
- [ ] Run `mvn '-Dmaven.compiler.proc=full' test` and confirm the remaining reactor succeeds.
- [ ] Commit the core cleanup.

### Task 7: Documentation and final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: local setup and endpoint documentation for the standalone service.

- [ ] Document MongoDB, S3, Eureka, trusted Gateway headers, upload flow, and endpoint families.
- [ ] Run `npm test -- --runInBand`, `npm run lint`, and `npm run build` in news.
- [ ] Run `npm run build` in admin portal.
- [ ] Run Gateway Maven compile/tests with required test environment values.
- [ ] Run core Maven tests with `-Dmaven.compiler.proc=full`.
- [ ] Review each repository diff against the design and report any baseline-only warnings separately.
