import { describe, expect, it } from "vitest";

import {
  CONTENT_CATEGORY_TO_LEGAL_SUBJECT,
  LEGAL_SUBJECT_LABELS,
  VERSION,
  label,
  legalSubjectLabel,
  type LegalSubject,
} from "../src/index.js";
import legalSubjects from "../src/legal-subjects.json";

const EXPECTED_LABELS = {
  administrative: "Administrativo",
  banking_finance: "Bancario y financiero",
  civil: "Civil",
  civil_procedure: "Procesal civil",
  commercial: "Comercial",
  constitutional: "Constitucional",
  consumer: "Consumo",
  corporate: "Societario",
  criminal: "Penal",
  criminal_procedure: "Procesal penal",
  employment: "Laboral",
  environmental: "Ambiental",
  family: "Familia",
  immigration: "Migratorio",
  maritime: "Marítimo",
  property_real_estate: "Propiedad inmobiliaria",
  public_procurement: "Contrataciones públicas",
  social_security: "Seguridad social",
  tax: "Tributario",
  other: "Otros",
  unknown: "Sin clasificar",
} as const satisfies Record<LegalSubject, string>;

describe("legal-subject contract", () => {
  it("exports exactly the approved identifiers and Spanish labels", () => {
    expect(Object.keys(LEGAL_SUBJECT_LABELS).sort()).toEqual(
      Object.keys(EXPECTED_LABELS).sort(),
    );
    for (const [subject, expected] of Object.entries(EXPECTED_LABELS)) {
      expect(LEGAL_SUBJECT_LABELS[subject as LegalSubject]).toBe(expected);
      expect(legalSubjectLabel(subject as LegalSubject)).toBe(expected);
      expect(legalSubjectLabel(subject as LegalSubject, "es")).toBe(expected);
    }
  });

  it("requires explicit English metadata and never falls back", () => {
    for (const subject of Object.keys(EXPECTED_LABELS) as LegalSubject[]) {
      expect(() => legalSubjectLabel(subject, "en")).toThrow(
        'No "en" label is defined',
      );
    }
  });

  it("rejects invalid identifiers and locales at runtime", () => {
    expect(() => legalSubjectLabel("law" as LegalSubject)).toThrow(
      "Unknown legal-subject identifier",
    );
    expect(() => legalSubjectLabel("constructor" as LegalSubject)).toThrow(
      "Unknown legal-subject identifier",
    );
    expect(() => legalSubjectLabel("toString" as LegalSubject)).toThrow(
      "Unknown legal-subject identifier",
    );
    expect(() =>
      legalSubjectLabel("civil", "fr" as "es"),
    ).toThrow("Unsupported locale");
  });

  it("keeps other, unknown, and document unknown distinct", () => {
    expect(legalSubjectLabel("other")).toBe("Otros");
    expect(legalSubjectLabel("unknown")).toBe("Sin clasificar");
    expect(label("unknown")).toBe("Desconocido");
  });

  it("exports the exact typed content crosswalk", () => {
    const expected = {
      administrative: "administrative",
      civil: "civil",
      commercial: "commercial",
      constitutional: "constitutional",
      consumer: "consumer",
      criminal: "criminal",
      employment: "employment",
      family: "family",
      immigration: "immigration",
      other: "other",
      procedural: "unknown",
      property: "property_real_estate",
      social_security: "social_security",
      tax: "tax",
    };
    expect(legalSubjects.content_category_crosswalk).toEqual(expected);
    expect(CONTENT_CATEGORY_TO_LEGAL_SUBJECT).toEqual(expected);
    expect(CONTENT_CATEGORY_TO_LEGAL_SUBJECT.procedural).toBe("unknown");
    expect(CONTENT_CATEGORY_TO_LEGAL_SUBJECT.property).toBe(
      "property_real_estate",
    );
  });

  it("keeps both data domains on the same package version", () => {
    expect(VERSION).toBe(legalSubjects.version);
  });
});
