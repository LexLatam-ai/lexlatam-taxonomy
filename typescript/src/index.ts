/**
 * Public API for the LexLatam Gaceta Oficial taxonomy.
 *
 * Mirrors the Python package (`lexlatam_taxonomy`): `normalize`, `label`,
 * `subtypesOf`, and the `VERSION` constant. The taxonomy data is loaded from
 * the bundled `data.json` (a verbatim copy of `data/document-types.json`); the
 * type unions and label tables live in the generated `types.ts`.
 */
import data from "./data.json";
import {
  SUBTYPE_LABELS,
  SUBTYPE_PARENTS,
  TYPE_LABELS,
  type DocumentSubtype,
  type DocumentType,
  type Labels,
} from "./types.js";

export {
  SUBTYPE_LABELS,
  SUBTYPE_PARENTS,
  TYPE_LABELS,
  type DocumentSubtype,
  type DocumentType,
  type Labels,
};

interface TaxonomyData {
  version: string;
  mappings: Record<string, { type: string; subtype: string | null }>;
  fallbacks: { prefix: string; type: string; subtype: string | null }[];
}

const TAXONOMY = data as unknown as TaxonomyData;

/** Semantic version of the taxonomy data this package was generated from. */
export const VERSION: string = TAXONOMY.version;

/** Result of {@link normalize}: a canonical type and optional subtype. */
export interface NormalizeResult {
  type: DocumentType;
  subtype: DocumentSubtype | null;
}

const WHITESPACE = /\s+/g;
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/** Trim and collapse internal whitespace in a raw native Gaceta string. */
export function cleanNative(raw: string): string {
  return raw.replace(WHITESPACE, " ").trim();
}

/** Lower-case and strip accents for accent-insensitive comparison. */
function fold(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/**
 * Resolve a raw native Gaceta string to a canonical type and subtype.
 *
 * An exact mapping is tried first; failing that, the ordered, accent- and
 * case-insensitive prefix fallbacks are applied. A string matching nothing
 * resolves to `{ type: "unknown", subtype: null }`.
 */
export function normalize(raw: string): NormalizeResult {
  const cleaned = cleanNative(raw);

  const exact = TAXONOMY.mappings[cleaned];
  if (exact !== undefined) {
    return {
      type: exact.type as DocumentType,
      subtype: exact.subtype as DocumentSubtype | null,
    };
  }

  const folded = fold(cleaned);
  for (const fallback of TAXONOMY.fallbacks) {
    if (folded.startsWith(fold(fallback.prefix))) {
      return {
        type: fallback.type as DocumentType,
        subtype: fallback.subtype as DocumentSubtype | null,
      };
    }
  }

  return { type: "unknown", subtype: null };
}

/**
 * Return the human-readable label for a type or subtype.
 *
 * `lang` accepts `"es"` (default) or `"en"`.
 */
export function label(
  id: DocumentType | DocumentSubtype,
  lang: "es" | "en" = "es",
): string {
  const key = lang === "en" ? "label_en" : "label_es";
  if (id in TYPE_LABELS) {
    return TYPE_LABELS[id as DocumentType][key];
  }
  if (id in SUBTYPE_LABELS) {
    return SUBTYPE_LABELS[id as DocumentSubtype][key];
  }
  throw new Error(`Unknown taxonomy identifier: ${id}`);
}

/** Return every subtype whose parent is the given type, in data order. */
export function subtypesOf(type: DocumentType): DocumentSubtype[] {
  return (Object.keys(SUBTYPE_PARENTS) as DocumentSubtype[]).filter(
    (subtype) => SUBTYPE_PARENTS[subtype] === type,
  );
}
