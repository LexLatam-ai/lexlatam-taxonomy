import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv2020, {
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";

interface TaxonomyData {
  types: Record<string, unknown>;
  subtypes: Record<string, { parent: string }>;
}

interface DateValue {
  value: string;
  basis: string;
}

interface LegalDocument {
  law_uuid: string;
  country_code: string;
  canonical_source_mapping_id: string;
  document_type: string;
  document_subtype: string | null;
  publication_date: DateValue | null;
  gaceta_number: string | null;
}

interface PageRange {
  start: number;
  end: number;
}

interface PublishedArtifact {
  artifact_id: string;
  official_url: string;
  media_type: string;
  pdf_sha256: string | null;
  physical_page_count: number | null;
  document_physical_pages: PageRange | null;
}

interface Transcription {
  transcription_id: string;
  artifact_id: string;
  pdf_sha256: string;
  transcription_contract: string;
  ocr_processor: string;
  ocr_processor_version: string;
}

interface SourceMapping {
  source_mapping_id: string;
  law_uuid: string;
  gaceta_issue: {
    country_code: string;
    source_code: string;
    gaceta_number: string;
    publication_date: DateValue;
  } | null;
  catalogue_record: {
    country_code: string;
    source_code: string;
  };
  artifacts: PublishedArtifact[];
  transcriptions: Transcription[];
}

interface LegalUnit {
  law_uuid: string;
  unit_id: string;
  unit_key: string;
  unit_type: string;
  lineage: {
    source_mapping_id: string;
    artifact_id: string;
    pdf_sha256: string;
    transcription_id: string;
    ocr_processor: string;
    ocr_processor_version: string;
  };
  physical_pages: PageRange;
  transcription_text: string;
}

interface CoreBundle {
  legal_documents: LegalDocument[];
  source_mappings: SourceMapping[];
  legal_units: LegalUnit[];
}

interface InvalidCase {
  name: string;
  operation: "replace" | "remove";
  path: Array<string | number>;
  value?: unknown;
  expected_error: string;
}

interface InvalidCasesFile {
  base_fixture: string;
  cases: InvalidCase[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function formatSchemaErrors(schemaErrors: ErrorObject[] | null | undefined): string[] {
  return (schemaErrors ?? []).map((error) => {
    const missing =
      "missingProperty" in error.params
        ? ` ${String(error.params.missingProperty)}`
        : "";
    return `schema: ${error.instancePath || "/"} ${error.message ?? ""}${missing}`;
  });
}

function addUnique<T>(
  target: Map<string, T>,
  id: string,
  value: T,
  label: string,
  errors: string[],
): void {
  if (target.has(id)) {
    errors.push(`${label} ${id} is duplicated`);
    return;
  }
  target.set(id, value);
}

function validateBundle(
  input: unknown,
  schemaValidator: ValidateFunction,
  taxonomy: TaxonomyData,
): string[] {
  if (!schemaValidator(input)) {
    return formatSchemaErrors(schemaValidator.errors);
  }

  const bundle = input as CoreBundle;
  const errors: string[] = [];
  const documents = new Map<string, LegalDocument>();
  const mappings = new Map<string, SourceMapping>();
  const unitIds = new Map<string, LegalUnit>();
  const artifactIdentity = new Map<string, string>();
  const transcriptionIdentity = new Map<string, string>();

  for (const document of bundle.legal_documents) {
    addUnique(documents, document.law_uuid, document, "law_uuid", errors);

    if (!(document.document_type in taxonomy.types)) {
      errors.push(
        `law_uuid ${document.law_uuid} uses unknown document_type ${document.document_type}`,
      );
    }
    if (document.document_subtype !== null) {
      const subtype = taxonomy.subtypes[document.document_subtype];
      if (subtype === undefined) {
        errors.push(
          `law_uuid ${document.law_uuid} uses unknown document_subtype ${document.document_subtype}`,
        );
      } else if (subtype.parent !== document.document_type) {
        errors.push(
          `law_uuid ${document.law_uuid} uses document_subtype ${document.document_subtype} outside ${document.document_type}`,
        );
      }
    }
  }

  for (const mapping of bundle.source_mappings) {
    addUnique(
      mappings,
      mapping.source_mapping_id,
      mapping,
      "source_mapping_id",
      errors,
    );

    const document = documents.get(mapping.law_uuid);
    if (document === undefined) {
      errors.push(
        `source_mapping_id ${mapping.source_mapping_id} references unknown law_uuid ${mapping.law_uuid}`,
      );
    } else if (mapping.catalogue_record.country_code !== document.country_code) {
      errors.push(
        `source_mapping_id ${mapping.source_mapping_id} country does not match law_uuid ${mapping.law_uuid}`,
      );
    }

    if (mapping.gaceta_issue !== null) {
      if (
        mapping.gaceta_issue.country_code !==
          mapping.catalogue_record.country_code ||
        mapping.gaceta_issue.source_code !== mapping.catalogue_record.source_code
      ) {
        errors.push(
          `source_mapping_id ${mapping.source_mapping_id} has inconsistent Gaceta and catalogue source scope`,
        );
      }
    }

    const artifacts = new Map<string, PublishedArtifact>();
    for (const artifact of mapping.artifacts) {
      addUnique(
        artifacts,
        artifact.artifact_id,
        artifact,
        `artifact_id within source_mapping_id ${mapping.source_mapping_id}`,
        errors,
      );

      if (
        artifact.document_physical_pages !== null &&
        artifact.physical_page_count !== null
      ) {
        const range = artifact.document_physical_pages;
        if (range.end < range.start || range.end > artifact.physical_page_count) {
          errors.push(
            `artifact_id ${artifact.artifact_id} has an invalid document physical-page span`,
          );
        }
      }

      const identity = JSON.stringify({
        official_url: artifact.official_url,
        media_type: artifact.media_type,
        pdf_sha256: artifact.pdf_sha256,
        physical_page_count: artifact.physical_page_count,
      });
      const existingIdentity = artifactIdentity.get(artifact.artifact_id);
      if (existingIdentity !== undefined && existingIdentity !== identity) {
        errors.push(
          `artifact_id ${artifact.artifact_id} has conflicting immutable identity fields`,
        );
      } else {
        artifactIdentity.set(artifact.artifact_id, identity);
      }
    }

    const transcriptions = new Map<string, Transcription>();
    for (const transcription of mapping.transcriptions) {
      addUnique(
        transcriptions,
        transcription.transcription_id,
        transcription,
        `transcription_id within source_mapping_id ${mapping.source_mapping_id}`,
        errors,
      );

      const artifact = artifacts.get(transcription.artifact_id);
      if (artifact === undefined) {
        errors.push(
          `transcription_id ${transcription.transcription_id} references an artifact outside source_mapping_id ${mapping.source_mapping_id}`,
        );
      } else if (
        artifact.media_type !== "application/pdf" ||
        artifact.pdf_sha256 !== transcription.pdf_sha256
      ) {
        errors.push(
          `transcription_id ${transcription.transcription_id} does not match its PDF artifact lineage`,
        );
      }

      const identity = JSON.stringify(transcription);
      const existingIdentity = transcriptionIdentity.get(
        transcription.transcription_id,
      );
      if (existingIdentity !== undefined && existingIdentity !== identity) {
        errors.push(
          `transcription_id ${transcription.transcription_id} has conflicting immutable identity fields`,
        );
      } else {
        transcriptionIdentity.set(transcription.transcription_id, identity);
      }
    }
  }

  for (const document of bundle.legal_documents) {
    const mapping = mappings.get(document.canonical_source_mapping_id);
    if (mapping === undefined) {
      errors.push(
        `law_uuid ${document.law_uuid} references unknown canonical_source_mapping_id ${document.canonical_source_mapping_id}`,
      );
      continue;
    }
    if (mapping.law_uuid !== document.law_uuid) {
      errors.push(
        `canonical_source_mapping_id ${mapping.source_mapping_id} belongs to law_uuid ${mapping.law_uuid}, not ${document.law_uuid}`,
      );
    }
    if (mapping.gaceta_issue === null) {
      if (document.gaceta_number !== null || document.publication_date !== null) {
        errors.push(
          `law_uuid ${document.law_uuid} has Gaceta publication metadata without a Gaceta issue relationship`,
        );
      }
      continue;
    }
    if (
      document.gaceta_number !== mapping.gaceta_issue.gaceta_number ||
      document.publication_date?.value !==
        mapping.gaceta_issue.publication_date.value
    ) {
      errors.push(
        `law_uuid ${document.law_uuid} canonical publication fields do not match its reviewed source mapping`,
      );
    }
  }

  for (const unit of bundle.legal_units) {
    addUnique(unitIds, unit.unit_id, unit, "unit_id", errors);

    if (!documents.has(unit.law_uuid)) {
      errors.push(`unit_id ${unit.unit_id} references unknown law_uuid ${unit.law_uuid}`);
    }

    const mapping = mappings.get(unit.lineage.source_mapping_id);
    if (mapping === undefined) {
      errors.push(
        `unit_id ${unit.unit_id} references unknown source_mapping_id ${unit.lineage.source_mapping_id}`,
      );
      continue;
    }
    if (mapping.law_uuid !== unit.law_uuid) {
      errors.push(
        `source_mapping_id ${mapping.source_mapping_id} belongs to law_uuid ${mapping.law_uuid}, not unit law_uuid ${unit.law_uuid}`,
      );
    }

    const artifact = mapping.artifacts.find(
      (candidate) => candidate.artifact_id === unit.lineage.artifact_id,
    );
    if (artifact === undefined) {
      errors.push(
        `unit_id ${unit.unit_id} references an artifact outside its source mapping`,
      );
      continue;
    }
    const transcription = mapping.transcriptions.find(
      (candidate) =>
        candidate.transcription_id === unit.lineage.transcription_id,
    );
    if (transcription === undefined) {
      errors.push(
        `unit_id ${unit.unit_id} references a transcription outside its source mapping`,
      );
      continue;
    }

    if (
      transcription.artifact_id !== artifact.artifact_id ||
      transcription.pdf_sha256 !== unit.lineage.pdf_sha256 ||
      artifact.pdf_sha256 !== unit.lineage.pdf_sha256 ||
      transcription.ocr_processor !== unit.lineage.ocr_processor ||
      transcription.ocr_processor_version !==
        unit.lineage.ocr_processor_version
    ) {
      errors.push(`unit_id ${unit.unit_id} has inconsistent immutable lineage`);
    }

    const expectedUnitId = `lsr:v1:${unit.law_uuid}:${unit.lineage.transcription_id}:${unit.unit_key}`;
    if (unit.unit_id !== expectedUnitId) {
      errors.push(`unit_id must be ${expectedUnitId}`);
    }

    const keyType = unit.unit_key.split(":", 1)[0];
    if (keyType !== unit.unit_type) {
      errors.push(
        `unit_id ${unit.unit_id} unit_key prefix does not match unit_type`,
      );
    }

    if (unit.physical_pages.end < unit.physical_pages.start) {
      errors.push(`unit_id ${unit.unit_id} page range ends before it starts`);
    }
    const documentPages = artifact.document_physical_pages;
    if (
      documentPages === null ||
      unit.physical_pages.start < documentPages.start ||
      unit.physical_pages.end > documentPages.end
    ) {
      errors.push(
        `unit_id ${unit.unit_id} page range falls outside the legal instrument span`,
      );
    }

    if (unit.unit_type === "page") {
      const pageNumber = Number(unit.unit_key.slice("page:".length));
      if (
        !Number.isInteger(pageNumber) ||
        pageNumber < 1 ||
        unit.physical_pages.start !== pageNumber ||
        unit.physical_pages.end !== pageNumber
      ) {
        errors.push(
          `unit_id ${unit.unit_id} page:N key must match one 1-based physical page`,
        );
      }
    }
  }

  for (const mapping of bundle.source_mappings) {
    for (const transcription of mapping.transcriptions) {
      const artifact = mapping.artifacts.find(
        (candidate) => candidate.artifact_id === transcription.artifact_id,
      );
      const documentPages = artifact?.document_physical_pages;
      if (
        artifact?.media_type !== "application/pdf" ||
        documentPages === null ||
        documentPages === undefined
      ) {
        continue;
      }
      for (let page = documentPages.start; page <= documentPages.end; page += 1) {
        const hasFallback = bundle.legal_units.some(
          (unit) =>
            unit.law_uuid === mapping.law_uuid &&
            unit.unit_type === "page" &&
            unit.unit_key === `page:${page}` &&
            unit.lineage.source_mapping_id === mapping.source_mapping_id &&
            unit.lineage.artifact_id === artifact.artifact_id &&
            unit.lineage.transcription_id === transcription.transcription_id,
        );
        if (!hasFallback) {
          errors.push(
            `source_mapping_id ${mapping.source_mapping_id} is missing required page:${page} fallback for transcription_id ${transcription.transcription_id}`,
          );
        }
      }
    }
  }

  return errors;
}

function applyInvalidCase(base: unknown, testCase: InvalidCase): unknown {
  const copy = structuredClone(base) as Record<string, unknown>;
  let cursor: unknown = copy;

  for (const segment of testCase.path.slice(0, -1)) {
    if (typeof segment === "number" && Array.isArray(cursor)) {
      cursor = cursor[segment];
    } else if (
      typeof segment === "string" &&
      cursor !== null &&
      typeof cursor === "object" &&
      !Array.isArray(cursor)
    ) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      throw new Error(`invalid fixture path for ${testCase.name}`);
    }
  }

  const leaf = testCase.path.at(-1);
  if (leaf === undefined) {
    throw new Error(`empty fixture path for ${testCase.name}`);
  }
  if (typeof leaf === "number" && Array.isArray(cursor)) {
    if (testCase.operation === "remove") {
      cursor.splice(leaf, 1);
    } else {
      cursor[leaf] = testCase.value;
    }
  } else if (
    typeof leaf === "string" &&
    cursor !== null &&
    typeof cursor === "object" &&
    !Array.isArray(cursor)
  ) {
    if (testCase.operation === "remove") {
      delete (cursor as Record<string, unknown>)[leaf];
    } else {
      (cursor as Record<string, unknown>)[leaf] = testCase.value;
    }
  } else {
    throw new Error(`invalid fixture leaf for ${testCase.name}`);
  }

  return copy;
}

export function validateLegalSourceReaderV1(
  root: string,
  taxonomy: TaxonomyData,
): string[] {
  const contractRoot = join(root, "data", "legal-source-reader", "v1");
  const fixturesRoot = join(contractRoot, "fixtures");
  const schema = readJson(join(contractRoot, "schema.json"));
  const validFixture = readJson(join(fixturesRoot, "valid-core-bundle.json"));
  const invalidCases = readJson(
    join(fixturesRoot, "invalid-cases.json"),
  ) as InvalidCasesFile;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schemaValidator = ajv.compile(schema);
  const errors = validateBundle(validFixture, schemaValidator, taxonomy);

  if (invalidCases.base_fixture !== "valid-core-bundle.json") {
    errors.push("invalid-cases.json must use valid-core-bundle.json as its base");
  }

  const fixtureBundle = validFixture as CoreBundle;
  for (const unit of fixtureBundle.legal_units) {
    if (!unit.transcription_text.startsWith("[SYNTHETIC]")) {
      errors.push(
        `fixture unit_id ${unit.unit_id} does not mark its transcription text synthetic`,
      );
    }
  }

  for (const testCase of invalidCases.cases) {
    const invalidFixture = applyInvalidCase(validFixture, testCase);
    const caseErrors = validateBundle(
      invalidFixture,
      schemaValidator,
      taxonomy,
    );
    if (caseErrors.length === 0) {
      errors.push(`negative fixture ${testCase.name} unexpectedly passed`);
      continue;
    }
    if (!caseErrors.some((error) => error.includes(testCase.expected_error))) {
      errors.push(
        `negative fixture ${testCase.name} did not produce expected error "${testCase.expected_error}"; got: ${caseErrors.join(" | ")}`,
      );
    }
  }

  return errors.map((error) => `legal-source-reader/v1: ${error}`);
}
