# Domain docs

## Before exploring

- Read `CONTEXT.md` when it exists.
- Read relevant decisions in `docs/adr/` when that directory exists.
- If either location is absent, continue without treating it as a setup failure.

## Layout

This is a single-context repository. The root context document describes the shared legal taxonomy package consumed by Python and TypeScript applications. System-wide architectural decisions belong in `docs/adr/`.

## Vocabulary

Use the canonical identifiers and terms defined by the repository's versioned data contracts. Do not substitute presentation labels for stable identifiers.

If a proposed change contradicts a recorded ADR, call out the conflict explicitly before implementation.
