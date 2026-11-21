---
name: news-api-review
description: Review HomeSpace news and media changes for publication visibility, admin authorization, API compatibility and safe presigned uploads. Use when a news or media API review is requested.
disable-model-invocation: true
---

# News and Media API Review

Trace the requested diff through the controllers, DTOs and services in `src/modules/news` and `src/modules/media`.

1. Verify that public lists, slug lookups and view counts operate on active, published content. Preserve pagination defaults, response shape and validation limits.
2. Check that authoring and upload routes still require verified Gateway identity and the admin role. Review denied cases and keep client-supplied identity out of the decision.
3. Trace presigned uploads and completion. Keep the content-type and size restrictions, verify object existence and metadata, preserve news-owned object keys, and keep credentials out of responses.
4. Select relevant existing checks. For routing or validation, use `npm run test:e2e -- --runInBand test/public-news.e2e-spec.ts` or `npm run test:e2e -- --runInBand test/media.e2e-spec.ts`. Use unit tests or mocks for persistence and storage. Keep review read-only.

Report concrete findings, affected endpoints, and contract or runtime behavior that still needs evidence.
