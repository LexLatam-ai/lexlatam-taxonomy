# Legal source reader V1 policy

Status: approved by the product owner on 2026-08-21 (America/Panama).

This policy freezes publication provenance, the public and protected content
boundary, optional anonymous preview behavior, login return origins, Spanish
browser locations, repository ownership, and rollout order for
`legal-source-reader/v1`.

It is a contract and review gate. It does not implement an endpoint,
authentication flow, migration, backfill, deployment, or infrastructure
change.

## Publication provenance

Derived public content has exactly one publication state:

- `reviewed` means the content passed the required review and may be displayed
  publicly and indexed.
- `legacy_published` means the content was intentionally public before review
  provenance was recorded. It remains public and indexable unless an
  individual review changes its state.
- `draft` is not public and must not be indexed.
- `rejected` is not public and must not be indexed.

Missing historical review metadata alone must not blanket-noindex existing
public pages. Eligible existing content is classified as `legacy_published`
until it receives an individual review.

Promotion to `reviewed` and transition to `rejected` require an explicit owner
or reviewer decision. No unattended process may promote derived content.
Publication state applies to derived content; it does not alter canonical
official metadata, official legal text, source provenance, or legal status.

## Public and protected content

The public boundary may contain:

- canonical official metadata, including title, type, number, issuer,
  instrument date, publication date, and Gaceta metadata;
- official source metadata and links;
- summaries, frequently asked questions, and explanatory content in
  `reviewed` or `legacy_published` state; and
- a useful source-bound structural outline, which may be empty.

The authenticated boundary contains:

- raw OCR and transcription text;
- reader-unit content, excerpts, and chunks;
- embeddings and bulk or whole-document exports;
- authenticated PDF display references and later-page navigation;
- storage credentials and private bucket identifiers; and
- synchronized OCR and PDF reader state.

CSS, client-side rendering conditions, and client-side hiding are not access
control. Protected fields must be omitted or denied by the server before a
response reaches an unauthenticated client.

## Optional first-page preview

The contract permits, but does not require, an anonymous visual preview of
physical page 1 of the official PDF artifact. If implemented, the preview must:

- be a rendered visual without selectable OCR or transcription text;
- expose no navigation to later pages;
- expose no reusable storage credential;
- be labeled as an official-source preview and remain bound to that source;
  and
- remain isolated from the authenticated synchronized reader.

Deferring this preview does not block V1. Infrastructure verification decides
whether it is feasible, and the stage browser review decides whether it is
acceptable for release.

## Exact origins

Login returns use exact, environment-specific origins:

| Environment | Authentication application | Permitted Leyes return origin |
| --- | --- | --- |
| Production | `https://app.lexlatam.ai` | `https://leyes.lexlatam.ai` |
| Stage | `https://app.stage.lexlatam.ai` | `https://leyes.stage.lexlatam.ai` |

Production cannot return to stage, and stage cannot return to production.
Wildcard subdomains, arbitrary external origins, credentials in URLs,
unexpected ports, and deprecated stage aliases are prohibited.

Local development origins may be enabled only through explicit local
configuration. They must never be inherited by stage or production.

## Spanish browser locations

All routes, query names, visible unit locators, labels, and links presented to
users are Spanish. Internal producer and API identifiers remain stable for
cross-repository compatibility but must not be displayed to users.

The canonical law and reader locations are:

```text
/{country_route}/leyes/{law_uuid}
/{country_route}/leyes/{law_uuid}/lector?unidad={public_unit_key}&pagina={physical_page}
```

The public unit-key prefixes map from internal unit types as follows:

| Internal unit type | Public URL prefix |
| --- | --- |
| `article` | `articulo` |
| `section` | `seccion` |
| `considering` | `considerando` |
| `operative` | `parte-resolutiva` |
| `chapter` | `capitulo` |
| `annex` | `anexo` |
| `table` | `tabla` |
| `page` | `pagina` |
| `other` | `otro` |

For example, internal `article:1` is presented as `articulo:1`, and internal
`page:2` is presented as `pagina:2`. The colon is percent-encoded in the
canonical browser location.

The previous `/reader?unit=...&page=...` form is not canonical. Temporary
compatibility parsing, if required by a consumer rollout, must validate the
old form, redirect to the Spanish canonical form, and have an explicit removal
plan. No English public alias may become a second canonical location.

## Safe login return

The canonical Leyes login-return parameters are Spanish:

- `origen_retorno` contains one exact permitted origin for the current
  environment.
- `ruta_retorno` contains a same-site relative law or reader location.

The receiver must decode each value once; validate the origin, route, UUID,
unit key, and page separately; and reconstruct the destination from the
validated parts. It must reject:

- scheme-relative or arbitrary absolute destinations;
- fragments, credentials, unexpected ports, or cross-environment origins;
- control characters, backslashes, path traversal, or encoded separators;
- malformed encodings, duplicate parameters, or unexpected query keys; and
- unit keys or physical pages outside the V1 grammar.

The safe fallback is `/chat/`. Existing same-application chat and
administrator redirect behavior remains outside this contract and must not be
regressed.

A legacy absolute `redirect` parameter is not part of the canonical V1
contract. Any temporary compatibility support must fully validate and
translate it into the structured Spanish return contract before redirecting.

## Repository ownership

- `lexlatam-taxonomy` owns schemas, policy invariants, fixtures, the Spanish
  public-locator mapping, and dependency order.
- `lexlatam-data-collector` owns internal source-bound units, immutable
  lineage, risk state, canaries, and backfill producers. It does not construct
  public URLs.
- `lexlatam-backend` owns authentication, server-side access control, public
  and protected APIs, PDF display references, safe login returns, translation
  to Spanish browser locations, and citation resolution.
- `lexlatam-nextjs-seo-stage` owns the Leyes public page and Spanish reader
  experience. Its production counterpart remains promotion-only.
- `lexlatam-infra` owns AWS database, storage, IAM, cache, DNS, cookie, and
  exact-origin verification.
- `justinian-infra` owns the private local processing host. It exposes no
  public application or reader endpoint.

## Rollout and human gates

1. Merge this corrected taxonomy contract and policy, then freeze the parent
   V1 contract.
2. Confirm consumer-side OCR containment is deployed before removing any
   anonymous backend OCR response.
3. Run collector canaries and infrastructure verification in parallel.
4. Review canary lineage, access boundaries, exact origins, and rollback
   readiness with the product owner.
5. Implement backend reader APIs and safe authentication returns.
6. Implement and browser-test the Spanish reader experience on stage.
7. Review anonymous, authenticated, invalid-return, mobile, and regression
   paths with the product owner.
8. Implement the citation bridge.
9. Verify that citations land on the correct `unidad` and `pagina`, including
   the official-source-only fallback.
10. Complete the cross-repository integration acceptance review.
11. Authorize gradual backfill separately. No full-corpus backfill is implied
    by this policy.

Each human gate records a go, conditional go, or no-go decision and every
unresolved blocker. A downstream repository must not silently weaken this
policy or invent a competing public-location contract.

## Approval boundary

The product owner approved the publication and access boundary, exact origins,
Spanish public locations, ownership, dependency order, and human acceptance
gates on 2026-08-21 (America/Panama).

This approval authorizes no schema migration, database backfill, inferred
legacy relationship, deployment, legal-relationship graph, or unified coverage
denominator. Each implementation and rollout remains subject to its own review
and repository workflow.
