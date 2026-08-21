# Legal-subject contract

LexLatam legal subjects answer which field of law a query, generalized content
topic, or legal source concerns. They do not describe the form of an official
instrument. Document types and legal subjects are separate domains even when
they share an identifier such as `unknown`.

The canonical identifiers and boundary notes live in
[`data/legal-subjects.json`](../data/legal-subjects.json). Identifiers are
locale-independent keys. `label_es` is required, normative, and returned by
default. English metadata is optional and may be read only through an explicit
`en` locale request; a missing translation is an error and never falls back.

`other` means classification succeeded but the subject is outside the approved
list. `unknown` means the subject was missing, insufficient, excluded, or not
classified successfully. Consumers must preserve that distinction in storage
and analytics.

The `content_category_crosswalk` records the migration from the content
pipeline's earlier broad categories. Most values map directly. `property` maps
to `property_real_estate`; generic `procedural` maps to `unknown` because it
does not identify whether the procedure is civil or criminal.

This package supplies the allowed values and labels only. Classifier rules,
prompts, confidence thresholds, database migrations, and product presentation
belong to consuming repositories. Consumers may upgrade independently and must
not maintain competing legal-subject enums.
