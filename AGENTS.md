# HomeSpace News Service — Codex Instructions

## Scope

HomeSpace news-related service.

Inspect actual source code, build manifests and documentation before assuming the technology stack.

## Development

- Follow existing architecture and naming conventions.
- Preserve API contracts.
- Validate inputs.
- Handle errors consistently.
- Avoid unnecessary dependencies.
- Avoid unrelated refactoring.

## Architecture

NestJS service (MongoDB via Mongoose, S3 for media) with modules under `src/modules`: `authentication`, `news`, `media`, `health`.

- Follow the existing layering: controllers in `presentation/` (with DTOs), logic in the module service, Mongoose schemas in `persistence/`. Keep logic out of controllers.
- Preserve the response envelope and error handling (`ApiResponseDto`, `AppException`, global exception filter, `ErrorCode`).
- Register new providers in the owning module; do not create cross-module coupling that bypasses module exports.

## Security and Authorization

- Admin routes (`admin/news`, `admin/news/media`) use `GatewayAuthenticationGuard` and `AdminGuard`. Preserve both. Never expose authoring, update, delete or upload operations on public routes.
- Identity comes from Gateway headers verified with the internal shared secret. Do not trust client-supplied identity; never log or hardcode the secret.
- Validate all input with DTOs (`class-validator`). Reject unknown or oversized input; keep content block types and categories restricted to the schema enums.

## News and Media

- Publishing: articles are `DRAFT` or `PUBLISHED` with `publishedAt` and an `active` flag. Public reads (`public/news`) must return only published, active articles. Do not leak drafts or inactive articles through public endpoints or by slug.
- Preserve public API compatibility used by `hs-web-app` and `hs-admin-portal`: paths, query parameters, response fields and slug behavior. The `view` counter endpoint is public; keep it safe against abuse and non-published articles.
- Media uses S3 presigned upload and a completion step that checks the stored object (content type, existence). Keep the content-type allowlist, size limits and the completion verification. Do not return long-lived credentials or make objects broader than required.
- MongoDB data belongs to this service only. Preserve indexes (for example `active, status, publishedAt`) and avoid destructive migrations. Do not access other services' databases.

## Verification

- Check `package.json` first. Known scripts: `npm test` (Jest), `npm run lint` (oxlint), `npm run build`, `npm run test:e2e`.
- Prefer focused Jest runs, for example `npm test -- --runInBand src/modules/media`, plus `npx oxlint <changed paths>` and `npx tsc --noEmit --incremental false` when types change.
- Test authorization changes with denied cases (non-admin, missing secret).
- Do not use real S3 or a live MongoDB for ordinary unit tests.
- Identify available test tooling.
- Use targeted tests when possible.
- Compile or typecheck affected modules where useful.
- Do not run full builds for small isolated changes.
- Do not start external infrastructure without necessity.

## Completion

Report changed files, verification and remaining risks.
