# lexlatam-taxonomy

The language-neutral **source of truth** for LexLatam legal-document types and
legal subjects. The native→normalized document mapping is derived from the Gaceta Oficial de
Panamá `tipo_documento` field. A few canonical types — currently `code` and
`constitution` — cover non-Gaceta consolidated texts; they are **type-only
entries** with labels but no native `mappings`/`fallbacks`, so `normalize()`
never resolves to them.

This repository is consumed by both npm and python packages.

> **License — proprietary, source-available.** This repository is public solely
> to simplify internal distribution to authorized consumers. No license to use,
> copy, modify, or redistribute is granted. See [`LICENSE`](LICENSE) for the
> full notice. Inquiries: `contact@invariantengineering.com`.

## Core principle

**The source of truth is data, not code.** Separate canonical JSON files define
document types and legal subjects. The typed Python and TypeScript bindings are
**generated** from them and committed to the repository. Document types answer
what an instrument is; legal subjects answer which field of law it concerns.

CI regenerates the bindings on every pull request and fails if the committed
output is stale, so `data/` and the bindings can never drift.

## Repository layout

```
lexlatam-taxonomy/
  data/
    document-types.json   # THE source of truth
    schema.json           # JSON Schema (draft 2020-12) it must satisfy
    legal-subjects.json   # canonical legal-subject contract
    legal-subjects.schema.json
  scripts/
    generate.ts           # reads data/, emits the python/ and typescript/ bindings
    validate.ts           # validates both canonical data domains
  python/                 # Python package — lexlatam-taxonomy
  typescript/             # npm package — @lexlatam-ai/taxonomy
  .github/workflows/      # ci.yml, publish.yml
```

Generated files (committed, never hand-edited):
`python/lexlatam_taxonomy/types.py`, `python/lexlatam_taxonomy/data.json`,
`python/lexlatam_taxonomy/legal-subjects.json`, `typescript/src/types.ts`,
`typescript/src/data.json`, and `typescript/src/legal-subjects.json`.

## The data model

`data/document-types.json`:

```jsonc
{
  "version": "1.0.0",
  "types":     { "<canonical>": { "label_es": "...", "label_en": "..." } },
  "subtypes":  { "<canonical>": { "parent": "<type>", "label_es": "...", "label_en": "..." } },
  "mappings":  { "<exact native Gaceta string>": { "type": "...", "subtype": "... | null" } },
  "fallbacks": [ { "prefix": "Resolución", "type": "resolution", "subtype": "other_resolution" } ]
}
```

**Resolution order** (implemented identically in both languages):

1. The raw string is cleaned — whitespace trimmed and collapsed (`clean_native` / `cleanNative`).
2. An **exact** match against `mappings` is tried first.
3. Failing that, the ordered `fallbacks` are applied by **prefix**. Prefix matching
   is **accent- and case-insensitive** (`"RESOLUCION"`, `"resolución"` both match `"Resolución"`).
4. A string matching nothing resolves to `(unknown, null)`.

`Nota Marginal de Advertencia` maps exactly to `notice`. `Fallo` maps exactly
to `judgment` (Fallo / Judgment), with no subtype. The existing resolution
family covers native Resolución instruments; none of its existing types or
subtypes identifies a judicial judgment. Panama's
[Órgano Judicial](https://www.organojudicial.gob.pa/cendoj/files/fallos-de-interes?page=3)
publishes Fallo entries as court decisions, so they have a separate canonical
type. These mappings introduce no new prefix fallbacks.

## Public API

Both packages expose the same small, stable surface.

### Python (`lexlatam_taxonomy`)

```python
from lexlatam_taxonomy import (
    DocumentType, DocumentSubtype, VERSION,
    normalize, label, subtypes_of, clean_native,
)

normalize("Decreto Ejecutivo")
# (DocumentType.DECREE, DocumentSubtype.EXECUTIVE_DECREE)

normalize("Resolución del Pleno")     # no exact mapping -> prefix fallback
# (DocumentType.RESOLUTION, DocumentSubtype.OTHER_RESOLUTION)

label(DocumentType.LAW)               # "Ley"
label(DocumentType.LAW, "en")         # "Law"
subtypes_of(DocumentType.DECREE)      # [DocumentSubtype.EXECUTIVE_DECREE, ...]
```

`normalize(raw) -> tuple[DocumentType, DocumentSubtype | None]`

Legal subjects use a separate additive API:

```python
from lexlatam_taxonomy import LegalSubject, legal_subject_label

legal_subject_label(LegalSubject.EMPLOYMENT)  # "Laboral"
```

### TypeScript (`@lexlatam-ai/taxonomy`)

```ts
import {
  normalize, label, subtypesOf, VERSION,
  type DocumentType, type DocumentSubtype,
} from "@lexlatam-ai/taxonomy";

normalize("Decreto Ejecutivo");
// { type: "decree", subtype: "executive_decree" }

normalize("Resolución del Pleno");
// { type: "resolution", subtype: "other_resolution" }

label("law");          // "Ley"
label("law", "en");    // "Law"
subtypesOf("decree");  // ["executive_decree", ...]
```

The npm package ships ESM + CJS with `.d.ts` declarations.

```ts
import { legalSubjectLabel, type LegalSubject } from "@lexlatam-ai/taxonomy";

const subject: LegalSubject = "employment";
legalSubjectLabel(subject); // "Laboral"
```

Spanish is normative and the default in both packages. See
[`docs/legal-subjects.md`](docs/legal-subjects.md) for domain boundaries,
`other`/`unknown` semantics, and the content-category crosswalk.

## Versioning policy

The taxonomy follows **semantic versioning**. One package version covers all
exported contracts. It appears in both canonical data files and in the Python
and npm packages; all four values **must match** on every release.

| Bump  | Meaning                                                                       | Consumer impact            |
| ----- | ----------------------------------------------------------------------------- | -------------------------- |
| PATCH | Label-text fixes, docs, non-behavioral changes.                               | None.                      |
| MINOR | **Additive only** — a new document value, mapping, fallback, subject, or public export. | Safe on a caret range. |
| MAJOR | Renaming/removing an identifier or changing an existing mapping's meaning. | **Breaking** — review required. |

## Distribution model

**Build-time only.** Consumers pin a version and redeploy to pick up taxonomy
changes. There is no runtime/API delivery in scope for this repository — if a
service needs new types to appear without a deploy, that belongs in a backend
`/api/public/taxonomy` endpoint, not here.

## How the two distributions are published

The two packages are **not** distributed the same way, because GitHub Packages
hosts npm but has **no Python/PyPI registry**. The repository is public, so the
Python package is distributed straight from the git tag with no auth.

| | TypeScript (`@lexlatam-ai/taxonomy`) | Python (`lexlatam-taxonomy`) |
| --- | --- | --- |
| Hosted on | GitHub Packages npm registry | The git repository itself |
| Published by | `publish.yml` runs `pnpm publish` | Nothing — the git **tag** _is_ the release |
| Consumer installs from | `npm.pkg.github.com` | `git+https://github.com/…@<tag>#subdirectory=python` |
| Convenience artifact | — | wheel + sdist attached to the GitHub Release |

## Releasing

1. Edit the applicable canonical data and bump the version in both data files.
2. Run `pnpm run generate` and commit the regenerated bindings.
3. Bump `version` in `python/pyproject.toml` and `typescript/package.json` so all
   four values match — `publish.yml`'s `verify-version` job fails otherwise.
4. Tag the commit `vX.Y.Z` and push the tag:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

   `publish.yml` then verifies the tag matches all four version locations, publishes the
   npm package to GitHub Packages, builds the Python wheel + sdist, and attaches
   them to the GitHub Release.

The npm package appears under the repo's **Packages** tab a minute or two after
the workflow succeeds. Until the first tag is pushed, that tab shows GitHub's
empty "Get started with GitHub Packages" screen — that is expected, not an error.

## Consuming this package

Use of these packages is restricted to Invariant Engineering LLC and its
authorized consumers — see [`LICENSE`](LICENSE).

### TypeScript — npm via GitHub Packages

GitHub Packages requires an auth token even for packages in public
repositories, but any GitHub token with the `read:packages` scope works — there
is no longer a shared PAT to manage.

Add an `.npmrc` to the consuming repo:

```ini
@lexlatam-ai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Then:

```bash
pnpm add @lexlatam-ai/taxonomy
```

Provide `NODE_AUTH_TOKEN`:

- **CI:** the consuming repo's own `GITHUB_TOKEN` (the package is in a public
  repository, so no cross-repo access grant is needed).
- **Local dev:** a classic PAT — or fine-grained token — with `read:packages`.

### Python — pip / Poetry via the git tag

GitHub Packages has no Python registry, so the Python package is distributed
via the **git tag**. The package lives in the `python/` subdirectory, and
because this repository is public **no credentials are needed** to install it.

pip:

```bash
pip install "lexlatam-taxonomy @ git+https://github.com/LexLatam-ai/lexlatam-taxonomy.git@v1.2.0#subdirectory=python"
```

Poetry (`pyproject.toml` of the consuming repo):

```toml
[tool.poetry.dependencies]
lexlatam-taxonomy = { git = "https://github.com/LexLatam-ai/lexlatam-taxonomy.git", tag = "v1.2.0", subdirectory = "python" }
```

A wheel + sdist are also attached to each GitHub Release if you prefer to
install from a downloaded artifact.

## Development

```bash
pnpm install               # root tooling (codegen + validation)
pnpm run validate          # validate both canonical data domains
pnpm run generate          # regenerate the committed bindings

cd typescript && pnpm install && pnpm test     # TypeScript package
cd python && poetry install && poetry run pytest   # Python package
```

The Python and TypeScript test suites mirror each other case-for-case so the two
implementations cannot silently diverge.

## Pending taxonomy decisions

Two items from the source Gaceta analysis are **deliberately excluded from v1.0.0**
pending confirmation. Do not add them speculatively — they require a real decision.

- **`Resolución AN`** — `"AN"` is *likely* the ASEP regulator prefix
  (Autoridad Nacional de los Servicios Públicos), but this is unconfirmed. No
  mapping for it exists yet; today it falls through to `other_resolution`.
- **`regulatory_resolution`** — it is unclear whether this is a genuine subtype or
  should fold into another (e.g. `superintendency_resolution` or
  `administrative_resolution`). It is **not** in the subtype list for v1.0.0.

Resolving either is a **MINOR** version bump (both are additive).
