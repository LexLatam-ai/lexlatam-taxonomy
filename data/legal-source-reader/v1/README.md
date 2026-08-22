# Legal source reader V1 contracts

This directory defines the additive producer-side semantic core and response
contracts for `legal-source-reader/v1`. They are data contracts, not database
schemas or authorization implementations.

## Scope

The core bundle defines three records:

- `legal_document` holds canonical metadata for one legal instrument under an
  independently assigned, immutable `law_uuid`.
- `legal_document_source` connects that instrument to an official catalogue
  record, its Gaceta issue when applicable, one or more published artifacts,
  and one or more transcription versions.
- `legal_unit` identifies one protected retrievable unit and binds it to the
  exact source mapping, artifact, PDF hash, transcription, processor, and
  physical pages used to produce it.

The contract intentionally supports the currently observed one-source,
one-artifact, and one-transcription case without placing a maximum on source
mappings, artifacts, or transcription versions. Repeated or alternate
artifacts were not observed in the audited cohort; they are not prohibited.

The response schema defines four boundaries:

- `public-outline` returns only public-presentable, source-bound structural
  navigation.
  An empty outline is valid, and physical page units are not exposed as an
  automatic public table of contents.
- `reader-metadata` is authenticated and returns canonical metadata, official
  source provenance, exact PDF/transcription identity, the complete retrievable
  unit manifest, a bounded PDF display reference, and the transcription
  warning.
- `reader-unit` is authenticated and returns exactly one requested unit with
  its immutable lineage, risk state, official source, bounded PDF display
  reference, and protected transcription text.
- `legal-citation` is authenticated and resolves to a deterministic structural
  unit, a verified `page:N` unit, or the official source alone.

The producer core remains in `schema.json`. The response contracts are in
`responses.schema.json`; they reference the core legal-document definition and
are validated against the same synthetic core fixture. Publication, access,
login return, Spanish browser locations, repository ownership, and rollout
requirements are frozen in `policy.md`.

## Identity and provenance rules

`law_uuid` is LexLatam's stable legal-instrument identifier. It is never
derived from a catalogue identifier, URL, filename, PDF hash, OCR text, Gaceta
number, or date.

Gaceta issue identity is the source-native `source_issue_id` scoped by
`country_code` and `source_code`. Gaceta number and publication date are
metadata, not the issue identity. Official catalogue-record identity is the
source-native `source_record_id` under the same scope. Neither identifier
substitutes for `law_uuid`.

Each published artifact receives its own `artifact_id`. PDF artifacts also
carry immutable `pdf_sha256`, physical page count, and the mapping-specific
physical-page span occupied by the legal instrument. The span keeps a
multi-instrument issue from assigning every physical page to every law.

Each transcription receives an immutable `transcription_id` and points to the
artifact and PDF hash it transcribes. `ocr_processor` and
`ocr_processor_version` are separate provenance fields and do not form the
transcription identity.

Legal-unit identity is deterministic:

```text
lsr:v1:{law_uuid}:{transcription_id}:{unit_key}
```

The V1 unit types are `article`, `section`, `considering`, `operative`,
`chapter`, `annex`, `table`, `page`, and `other`. Every mapped PDF
transcription must provide a 1-based `page:N` unit for each physical page in
the legal instrument's artifact span. Structural units are permitted only
when deterministic source evidence supports their key and page range.

## Dates and canonical metadata

Instrument dates and publication dates remain separate objects with an
explicit basis. The reviewed canonical source mapping governs approved
identity and publication metadata. It does not override official legal text,
determine whether an instrument is in force, or establish any other legal
status.

## Risk state

Every legal unit carries `risk_assessment_status` and `risk_flags`.

- `unchecked` may have an empty flag list, but that does not mean assessed
  clean. It cannot carry an assessment version.
- `assessed` requires `risk_assessment_version`. An assessed unit with no flags
  is the only V1 representation of an assessed-clean unit.

The bounded V1 flags are `table`, `handwriting`, `multi_column`, `checkbox`,
`form`, `numeric_dense`, `low_coverage`, and `unknown_structure`.

## Public and protected response boundary

The public outline cannot contain transcription text, OCR fields, excerpts,
chunks, embeddings, protected credentials, PDF display references, or a page
number index. An empty array is the correct response when no useful
source-bound public structure exists.

The reader metadata and reader-unit contracts require authenticated access.
The metadata manifest contains unit identity, physical pages, and risk state,
but no transcription text. The per-unit contract has one singular `unit`
property and rejects bulk or whole-document response fields. Its unit must
belong to the requested law, source mapping, artifact, PDF, and transcription.

PDF display references are limited to the legal instrument's mapped physical
page span. They may identify an authenticated proxy or a short-lived URL. They
do not expose storage credentials or expand the contract to anonymous PDF
navigation.

## Citation resolution

Citation resolution follows one fail-safe order:

1. Return a deterministic structural unit when its source binding is proven.
2. Otherwise return a verified 1-based `page:N` unit.
3. Otherwise return only the official source.

The official-source-only form intentionally has no unit key, physical page,
PDF hash, transcription ID, reader location, or risk state. Consumers must not
invent an Article or retain stale reader fields when resolution falls back to
the official source.

Resolved citations retain the law identity, country route, source mapping,
source-bound unit, 1-based physical pages, PDF hash, transcription ID, official
source, same-application reader location, and unit risk state.

## Spanish browser-location boundary

Internal unit keys remain stable producer and API identifiers. They must not be
displayed in user-facing routes, query parameters, labels, or links. Citation
reader locations translate them into the Spanish public form defined in
`policy.md`.

The canonical reader location has this shape:

```text
/{country_route}/leyes/{law_uuid}/lector?unidad={public_unit_key}&pagina={physical_page}
```

For example, internal `article:1` becomes `articulo:1`, and internal `page:2`
becomes `pagina:2`. The validator rejects the former
`/reader?unit=...&page=...` form as non-canonical.

## Collector compatibility boundary

Current collector operational fields must be adapted deliberately:

- `country_code + source_code + source_record_id` identifies an official
  catalogue record, not a legal instrument.
- A filename is a legacy asset locator, not identity proof. Filename-only OCR
  metrics remain `ocr_metrics_identity_unproven` until stronger lineage exists.
- Existing PDF row identifiers, hashes, transcription-contract values, and
  processor versions can help select operational artifacts, but they do not
  replace independently assigned `artifact_id` or `transcription_id`.
- Dashboard layer states such as `complete`, `missing`, `incomplete`, and
  `blocked` describe derived processing coverage. They are not document
  identity, legal status, or this contract's risk-assessment state.
- Counts of current legal-source records are not a canonical deduplicated-law
  denominator. This contract authorizes no inferred legacy mapping or unified
  coverage denominator.

## Validation

Run:

```sh
pnpm run validate
```

The validator checks the JSON Schema, taxonomy references, source and lineage
cross-references, deterministic unit identity, 1-based page ranges, required
page fallbacks, response membership, public disclosure boundaries, citation
fallback shapes, and risk-state combinations. It also proves that the negative
fixtures fail for anonymous protected responses, public text disclosure,
wrong-law and wrong-source units, invalid page ranges, missing mappings,
unchecked risk with an assessment version, invented official-source fallback
fields, bulk reader responses, non-Spanish reader locations, missing lineage,
missing page fallback, and non-deterministic unit identity.

All committed transcription text is marked `[SYNTHETIC]`. The fixtures contain
no protected OCR.

## Explicit non-goals

These contracts authorize no migration, backfill, merge, inferred legacy
relationship, endpoint implementation, authentication change, origin
allowlist implementation, anonymous PDF preview implementation, legal-subject
classification, legal-relationship graph, or deployment. Those require their
own implementation or review gates. The approved policy defines constraints;
it does not perform those operations.
