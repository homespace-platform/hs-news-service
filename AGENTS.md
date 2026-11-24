# HomeSpace News Service — Codex Instructions

## Engineering standards

- Preserve business invariants, public contracts and backward compatibility. Keep authentication, authorization, input validation and error handling intact.
- Protect secrets and sensitive data in code, commits, tests, logs and reports. Treat third-party hooks as untrusted until reviewed and explicitly authorized.
- Change production configuration, deploy or run destructive data operations only when explicitly authorized for the target environment.
- Keep review tasks read-only unless the developer requests fixes.

## Execution policy

- **FAST** is the default for a small fix, one API, a simple UI or configuration change, or a limited refactor. Start as soon as the scope is clear. Use the fewest useful calls, with a soft ceiling of roughly 8–12 in normal conditions.
- **STANDARD** fits multi-file features, API contract changes, broader refactors and hard-to-reproduce bugs. Make a short plan, inspect affected dependencies and verify in one focused round after editing.
- **DEEP** is required for significant security, authentication, authorization, payment, deposit, transaction, contract lifecycle, migration, architecture or incident risk. Identify the relevant invariants and verify the affected boundaries, including failure and denied cases where applicable. Escalate by risk even for small changes.

### Work and tools

- Identify the goal and smallest correct scope. Read the directly affected files, then check callers or dependencies when the change can affect them. Plan mentally or in a few lines for complex work, then execute.
- Give each tool call a purpose that advances the request or reduces a real risk. Batch independent reads and search exact paths or symbols. Reuse results when inputs are unchanged. Skip full repo scans, subagents and independent review passes for routine tasks.
- For a small review, stop at the requested diff when it establishes the findings. Inspect callers, test setup or runtime behavior only if a material finding depends on evidence missing from that diff.
- **No repeated verification without new evidence.** Repeat a read, search or check only when relevant inputs changed, an error or conflicting evidence appeared, or a required risk check remains. If two investigation attempts yield no useful evidence, change approach or stop that investigation.
- Make routine technical decisions independently. Ask when essential information is missing or the action requires authorization. Reuse existing code and patterns, protect user changes, and keep edits and dependencies within scope.

### Git and validation

- Use `git status --short` once at the start if needed to protect existing edits and once at the end only if needed for reporting. Review the edit or use one path-scoped `git diff -- <paths>` when needed. Reuse that evidence while the files are unchanged. Use `git diff --stat` only when a scope summary is needed and `git diff --check` at most once after the final edit when useful. Reinspect affected paths only for new edits, conflicts or a concrete risk. Protect user changes. Commit, push, reset, clean, checkout or discard only when requested.
- **Start with the remaining risk.** For prose, comments, or cosmetic changes with no behavior impact, inspect the affected change and skip application builds and tests unless required. For routine behavior changes, validate once after editing with the smallest relevant test or static check. Add another check only when it covers a distinct risk. Run full builds or suites only when requested, required, or focused checks cannot cover a concrete risk.
- Reuse relevant passing results for unchanged inputs, including results supplied by the user or CI. Acknowledge their source in the report. After a failure, diagnose the cause and rerun only the affected check after correcting it. Let a running check finish before considering a retry. Report blocked checks and unverified risks. Preserve required security, business invariant and integration checks.

### Stop and report

Stop when the request and acceptance criteria are met, required checks are complete and concrete in-scope issues are resolved. Skip speculative optimization, unrelated refactors and automatic chains of review, audit or verification. Report **Completed**, **Validation** and **Notes** when needed. List only checks actually run and state material limits or remaining risks.

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
- Preserve public API compatibility used by the public and admin clients: paths, query parameters, response fields and slug behavior. The `view` counter endpoint is public; keep it safe against abuse and non-published articles.
- Media uses S3 presigned upload and a completion step that checks the stored object (content type, existence). Keep the content-type allowlist, size limits and the completion verification. Do not return long-lived credentials or make objects broader than required.
- MongoDB data belongs to this service only. Preserve indexes (for example `active, status, publishedAt`) and avoid destructive migrations. Do not access other services' databases.

## Verification

- Check `package.json` first. Known scripts: `npm test` (Jest), `npm run lint` (oxlint), `npm run build`, `npm run test:e2e`.
- Prefer focused Jest runs, for example `npm test -- --runInBand src/modules/media`, plus `npx oxlint <changed paths>` and `npx tsc --noEmit --incremental false` when types change.
- Test authorization changes with denied cases (non-admin, missing secret).
- Do not use real S3 or a live MongoDB for ordinary unit tests.
- Do not start external infrastructure without necessity.

## Skills

Use news-api-review for an explicit review in the scope described by the skill.

## Completion

Report changed files, verification and remaining risks.
