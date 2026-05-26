/**
 * Tests for the TypeScript taxonomy bindings.
 *
 * These mirror the Python test suite (python/tests/test_taxonomy.py)
 * case-for-case so the two packages can never silently diverge.
 */
import { describe, expect, it } from "vitest";

import {
  VERSION,
  cleanNative,
  label,
  normalize,
  subtypesOf,
} from "../src/index.js";
import data from "../src/data.json";

describe("VERSION", () => {
  it("matches the data file", () => {
    expect(VERSION).toBe(data.version);
  });
});

describe("normalize — exact mappings", () => {
  for (const [native, expected] of Object.entries(data.mappings)) {
    it(`round-trips "${native}"`, () => {
      const result = normalize(native);
      expect(result.type).toBe(expected.type);
      expect(result.subtype).toBe(expected.subtype);
    });
  }

  it("prefers an exact mapping over the prefix fallback", () => {
    expect(normalize("Resolución Ministerial")).toEqual({
      type: "resolution",
      subtype: "ministerial_resolution",
    });
  });
});

describe("normalize — fallbacks", () => {
  it("resolves an unknown Resolución to other_resolution", () => {
    expect(normalize("Resolución del Pleno")).toEqual({
      type: "resolution",
      subtype: "other_resolution",
    });
  });

  it("resolves an unknown Decreto to other_decree", () => {
    expect(normalize("Decreto Municipal No. 5")).toEqual({
      type: "decree",
      subtype: "other_decree",
    });
  });

  it("resolves an unknown Acuerdo to other_agreement", () => {
    expect(normalize("Acuerdo Interinstitucional")).toEqual({
      type: "agreement",
      subtype: "other_agreement",
    });
  });

  it("resolves a non-matching string to unknown", () => {
    expect(normalize("Memorando")).toEqual({ type: "unknown", subtype: null });
    expect(normalize("")).toEqual({ type: "unknown", subtype: null });
  });

  it.each(["RESOLUCION del Pleno", "resolución del pleno", "RESOLUCIÓN DEL PLENO"])(
    "is accent- and case-insensitive: %s",
    (raw) => {
      expect(normalize(raw)).toEqual({
        type: "resolution",
        subtype: "other_resolution",
      });
    },
  );
});

describe("cleanNative", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanNative("  Decreto   \n Ejecutivo  ")).toBe("Decreto Ejecutivo");
  });

  it("is applied before lookup", () => {
    expect(normalize("  Ley  ")).toEqual({ type: "law", subtype: null });
  });
});

describe("label", () => {
  it("defaults to Spanish", () => {
    expect(label("law")).toBe("Ley");
    expect(label("executive_decree")).toBe("Decreto Ejecutivo");
  });

  it("returns English when asked", () => {
    expect(label("law", "en")).toBe("Law");
    expect(label("executive_decree", "en")).toBe("Executive Decree");
  });
});

describe("subtypesOf", () => {
  it("returns every subtype of a type", () => {
    const decreeSubtypes = subtypesOf("decree");
    expect(decreeSubtypes).toContain("executive_decree");
    expect(decreeSubtypes).toContain("other_decree");
    for (const s of decreeSubtypes) {
      expect(data.subtypes[s as keyof typeof data.subtypes].parent).toBe("decree");
    }
  });

  it("returns an empty list for a type with no subtypes", () => {
    expect(subtypesOf("law")).toEqual([]);
  });
});

describe("code and constitution — type-only entries", () => {
  it("have labels but no subtypes", () => {
    expect(label("code")).toBe("Código");
    expect(label("constitution", "en")).toBe("Constitution");
    expect(subtypesOf("code")).toEqual([]);
    expect(subtypesOf("constitution")).toEqual([]);
  });
});

describe("data integrity", () => {
  it("every subtype parent is a real type", () => {
    const typeKeys = new Set(Object.keys(data.types));
    for (const sub of Object.values(data.subtypes)) {
      expect(typeKeys.has(sub.parent)).toBe(true);
    }
  });
});
