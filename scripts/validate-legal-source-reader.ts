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

interface RiskState {
  risk_assessment_status: "unchecked" | "assessed";
  risk_assessment_version?: string;
  risk_flags: string[];
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
    source_record_id: string;
    official_url: string;
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
  risk_assessment_status: "unchecked" | "assessed";
  risk_assessment_version?: string;
  risk_flags: string[];
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

interface OfficialSourceResponse {
  source_mapping_id: string;
  country_code: string;
  source_code: string;
  source_record_id: string;
  official_url: string;
}

interface ResponseUnitReference {
  unit_id: string;
  unit_key: string;
  unit_type: string;
  physical_pages: PageRange;
}

interface UnitManifestItem extends ResponseUnitReference {
  risk: RiskState;
}

interface PublicOutlineResponse {
  contract_id: "legal-source-reader/v1/public-outline";
  access: "public";
  law_uuid: string;
  country_route: string;
  outline: Array<ResponseUnitReference & { label: string }>;
}

interface ReaderMetadataResponse {
  contract_id: "legal-source-reader/v1/reader-metadata";
  access: "authenticated";
  law_uuid: string;
  country_route: string;
  canonical_metadata: LegalDocument;
  official_source: OfficialSourceResponse;
  lineage: {
    artifact_id: string;
    pdf_sha256: string;
    transcription_id: string;
    physical_page_count: number;
    document_physical_pages: PageRange;
  };
  retrievable_units: UnitManifestItem[];
  pdf_display: {
    allowed_physical_pages: PageRange;
  };
}

interface ReaderUnitResponse {
  contract_id: "legal-source-reader/v1/reader-unit";
  access: "authenticated";
  law_uuid: string;
  country_route: string;
  source_mapping_id: string;
  artifact_id: string;
  pdf_sha256: string;
  transcription_id: string;
  official_source: OfficialSourceResponse;
  unit: ResponseUnitReference & {
    risk: RiskState;
    transcription_text: string;
  };
  pdf_display: {
    allowed_physical_pages: PageRange;
  };
}

interface ResolvedCitationResponse extends ResponseUnitReference {
  contract_id: "legal-source-reader/v1/legal-citation";
  access: "authenticated";
  law_uuid: string;
  country_route: string;
  resolution_kind: "structural_unit" | "physical_page";
  source_mapping_id: string;
  pdf_sha256: string;
  transcription_id: string;
  official_source: OfficialSourceResponse;
  reader_location: string;
  risk: RiskState;
}

interface OfficialSourceCitationResponse {
  contract_id: "legal-source-reader/v1/legal-citation";
  access: "authenticated";
  law_uuid: string;
  country_route: string;
  resolution_kind: "official_source";
  source_mapping_id: string;
  official_source: OfficialSourceResponse;
}

type LegalSourceReaderResponse =
  | PublicOutlineResponse
  | ReaderMetadataResponse
  | ReaderUnitResponse
  | ResolvedCitationResponse
  | OfficialSourceCitationResponse;

interface ResponseBundle {
  core_fixture: string;
  responses: LegalSourceReaderResponse[];
}

const PUBLIC_UNIT_TYPE_BY_INTERNAL: Record<string, string> = {
  article: "articulo",
  section: "seccion",
  considering: "considerando",
  operative: "parte-resolutiva",
  chapter: "capitulo",
  annex: "anexo",
  table: "tabla",
  page: "pagina",
  other: "otro",
};

function toPublicUnitKey(unitKey: string): string | undefined {
  const separator = unitKey.indexOf(":");
  if (separator <= 0) {
    return undefined;
  }
  const publicType = PUBLIC_UNIT_TYPE_BY_INTERNAL[unitKey.slice(0, separator)];
  if (publicType === undefined) {
    return undefined;
  }
  return `${publicType}:${unitKey.slice(separator + 1)}`;
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
    const additional =
      "additionalProperty" in error.params
        ? ` ${String(error.params.additionalProperty)}`
        : "";
    return `schema: ${error.instancePath || "/"} ${error.message ?? ""}${missing}${additional}`;
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

function samePageRange(left: PageRange, right: PageRange): boolean {
  return left.start === right.start && left.end === right.end;
}

function sameRiskState(response: RiskState, unit: LegalUnit): boolean {
  return (
    response.risk_assessment_status === unit.risk_assessment_status &&
    response.risk_assessment_version === unit.risk_assessment_version &&
    JSON.stringify([...response.risk_flags].sort()) ===
      JSON.stringify([...unit.risk_flags].sort())
  );
}

function validateOfficialSource(
  source: OfficialSourceResponse,
  mapping: SourceMapping,
  context: string,
  errors: string[],
): void {
  if (
    source.source_mapping_id !== mapping.source_mapping_id ||
    source.country_code !== mapping.catalogue_record.country_code ||
    source.source_code !== mapping.catalogue_record.source_code ||
    source.source_record_id !== mapping.catalogue_record.source_record_id ||
    source.official_url !== mapping.catalogue_record.official_url
  ) {
    errors.push(`${context} official source does not match its source mapping`);
  }
}

function findMapping(
  bundle: CoreBundle,
  lawUuid: string,
  sourceMappingId: string,
  context: string,
  errors: string[],
): SourceMapping | undefined {
  const mapping = bundle.source_mappings.find(
    (candidate) => candidate.source_mapping_id === sourceMappingId,
  );
  if (mapping === undefined) {
    errors.push(`${context} references unknown source_mapping_id ${sourceMappingId}`);
    return undefined;
  }
  if (mapping.law_uuid !== lawUuid) {
    errors.push(
      `${context} source_mapping_id ${sourceMappingId} belongs to law_uuid ${mapping.law_uuid}, not ${lawUuid}`,
    );
  }
  return mapping;
}

function findUnit(
  bundle: CoreBundle,
  reference: ResponseUnitReference,
  lawUuid: string,
  context: string,
  errors: string[],
): LegalUnit | undefined {
  const unit = bundle.legal_units.find(
    (candidate) => candidate.unit_id === reference.unit_id,
  );
  if (unit === undefined) {
    errors.push(`${context} references unknown unit_id ${reference.unit_id}`);
    return undefined;
  }
  if (unit.law_uuid !== lawUuid) {
    errors.push(
      `${context} unit_id ${reference.unit_id} belongs to law_uuid ${unit.law_uuid}, not ${lawUuid}`,
    );
  }
  if (
    unit.unit_key !== reference.unit_key ||
    unit.unit_type !== reference.unit_type ||
    !samePageRange(unit.physical_pages, reference.physical_pages)
  ) {
    errors.push(`${context} unit fields do not match unit_id ${reference.unit_id}`);
  }
  return unit;
}

function validateUnitLineage(
  unit: LegalUnit,
  sourceMappingId: string,
  artifactId: string,
  pdfSha256: string,
  transcriptionId: string,
  context: string,
  errors: string[],
): void {
  if (
    unit.lineage.source_mapping_id !== sourceMappingId ||
    unit.lineage.artifact_id !== artifactId ||
    unit.lineage.pdf_sha256 !== pdfSha256 ||
    unit.lineage.transcription_id !== transcriptionId
  ) {
    errors.push(`${context} unit does not belong to the requested reader lineage`);
  }
}

function validatePdfLineage(
  mapping: SourceMapping,
  artifactId: string,
  pdfSha256: string,
  transcriptionId: string,
  physicalPageCount: number | undefined,
  documentPhysicalPages: PageRange | undefined,
  context: string,
  errors: string[],
): PublishedArtifact | undefined {
  const artifact = mapping.artifacts.find(
    (candidate) => candidate.artifact_id === artifactId,
  );
  if (artifact === undefined) {
    errors.push(`${context} references an artifact outside its source mapping`);
    return undefined;
  }
  const transcription = mapping.transcriptions.find(
    (candidate) => candidate.transcription_id === transcriptionId,
  );
  if (transcription === undefined) {
    errors.push(`${context} references a transcription outside its source mapping`);
    return artifact;
  }
  if (
    artifact.pdf_sha256 !== pdfSha256 ||
    transcription.artifact_id !== artifactId ||
    transcription.pdf_sha256 !== pdfSha256
  ) {
    errors.push(`${context} has inconsistent PDF/transcription lineage`);
  }
  if (
    physicalPageCount !== undefined &&
    artifact.physical_page_count !== physicalPageCount
  ) {
    errors.push(`${context} physical-page count does not match its artifact`);
  }
  if (
    documentPhysicalPages !== undefined &&
    (artifact.document_physical_pages === null ||
      !samePageRange(artifact.document_physical_pages, documentPhysicalPages))
  ) {
    errors.push(`${context} legal-instrument page span does not match its artifact`);
  }
  return artifact;
}

function scanPublicDisclosure(
  value: unknown,
  path: string,
  errors: string[],
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      scanPublicDisclosure(item, `${path}/${index}`, errors),
    );
    return;
  }
  if (value === null || typeof value !== "object") {
    return;
  }

  const forbidden = new Set([
    "transcription_text",
    "ocr",
    "ocr_text",
    "excerpt",
    "excerpts",
    "chunks",
    "embeddings",
    "storage_credentials",
    "protected_credentials",
  ]);
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) {
      errors.push(`public response contains forbidden field ${path}/${key}`);
    }
    scanPublicDisclosure(child, `${path}/${key}`, errors);
  }
}

function validateResponseBundle(
  input: unknown,
  responseValidator: ValidateFunction,
  coreBundle: CoreBundle,
): string[] {
  if (
    input === null ||
    typeof input !== "object" ||
    !Array.isArray((input as { responses?: unknown }).responses)
  ) {
    return ["response fixture must contain a responses array"];
  }

  const responseBundle = input as ResponseBundle;
  const errors: string[] = [];
  const documents = new Map(
    coreBundle.legal_documents.map((document) => [document.law_uuid, document]),
  );

  responseBundle.responses.forEach((response, index) => {
    const context = `response[${index}] ${response.contract_id ?? "unknown"}`;
    if (!responseValidator(response)) {
      errors.push(
        ...formatSchemaErrors(responseValidator.errors).map(
          (error) => `${context} ${error}`,
        ),
      );
      return;
    }

    const document = documents.get(response.law_uuid);
    if (document === undefined) {
      errors.push(`${context} references unknown law_uuid ${response.law_uuid}`);
      return;
    }

    if (response.contract_id === "legal-source-reader/v1/public-outline") {
      scanPublicDisclosure(response, context, errors);
      for (const outlineUnit of response.outline) {
        findUnit(coreBundle, outlineUnit, response.law_uuid, context, errors);
      }
      return;
    }

    if (response.contract_id === "legal-source-reader/v1/reader-metadata") {
      if (JSON.stringify(response.canonical_metadata) !== JSON.stringify(document)) {
        errors.push(`${context} canonical metadata does not match law_uuid`);
      }
      const mapping = findMapping(
        coreBundle,
        response.law_uuid,
        response.official_source.source_mapping_id,
        context,
        errors,
      );
      if (mapping === undefined) {
        return;
      }
      validateOfficialSource(response.official_source, mapping, context, errors);
      validatePdfLineage(
        mapping,
        response.lineage.artifact_id,
        response.lineage.pdf_sha256,
        response.lineage.transcription_id,
        response.lineage.physical_page_count,
        response.lineage.document_physical_pages,
        context,
        errors,
      );
      if (
        !samePageRange(
          response.pdf_display.allowed_physical_pages,
          response.lineage.document_physical_pages,
        )
      ) {
        errors.push(`${context} PDF display range exceeds the legal-instrument span`);
      }

      const expectedUnitIds = coreBundle.legal_units
        .filter(
          (unit) =>
            unit.law_uuid === response.law_uuid &&
            unit.lineage.source_mapping_id === mapping.source_mapping_id &&
            unit.lineage.artifact_id === response.lineage.artifact_id &&
            unit.lineage.transcription_id === response.lineage.transcription_id,
        )
        .map((unit) => unit.unit_id)
        .sort();
      const manifestUnitIds = response.retrievable_units
        .map((unit) => unit.unit_id)
        .sort();
      if (JSON.stringify(expectedUnitIds) !== JSON.stringify(manifestUnitIds)) {
        errors.push(`${context} retrievable-unit manifest is incomplete or extraneous`);
      }
      for (const manifestUnit of response.retrievable_units) {
        const unit = findUnit(
          coreBundle,
          manifestUnit,
          response.law_uuid,
          context,
          errors,
        );
        if (unit === undefined) {
          continue;
        }
        validateUnitLineage(
          unit,
          mapping.source_mapping_id,
          response.lineage.artifact_id,
          response.lineage.pdf_sha256,
          response.lineage.transcription_id,
          context,
          errors,
        );
        if (!sameRiskState(manifestUnit.risk, unit)) {
          errors.push(`${context} risk state does not match unit_id ${unit.unit_id}`);
        }
      }
      return;
    }

    if (response.contract_id === "legal-source-reader/v1/reader-unit") {
      const mapping = findMapping(
        coreBundle,
        response.law_uuid,
        response.source_mapping_id,
        context,
        errors,
      );
      if (mapping === undefined) {
        return;
      }
      validateOfficialSource(response.official_source, mapping, context, errors);
      const artifact = validatePdfLineage(
        mapping,
        response.artifact_id,
        response.pdf_sha256,
        response.transcription_id,
        undefined,
        undefined,
        context,
        errors,
      );
      if (
        artifact?.document_physical_pages !== null &&
        artifact?.document_physical_pages !== undefined &&
        !samePageRange(
          response.pdf_display.allowed_physical_pages,
          artifact.document_physical_pages,
        )
      ) {
        errors.push(`${context} PDF display range exceeds the legal-instrument span`);
      }
      const unit = findUnit(
        coreBundle,
        response.unit,
        response.law_uuid,
        context,
        errors,
      );
      if (unit === undefined) {
        return;
      }
      validateUnitLineage(
        unit,
        response.source_mapping_id,
        response.artifact_id,
        response.pdf_sha256,
        response.transcription_id,
        context,
        errors,
      );
      if (!sameRiskState(response.unit.risk, unit)) {
        errors.push(`${context} risk state does not match unit_id ${unit.unit_id}`);
      }
      if (response.unit.transcription_text !== unit.transcription_text) {
        errors.push(`${context} transcription text does not match unit_id ${unit.unit_id}`);
      }
      return;
    }

    const mapping = findMapping(
      coreBundle,
      response.law_uuid,
      response.source_mapping_id,
      context,
      errors,
    );
    if (mapping === undefined) {
      return;
    }
    validateOfficialSource(response.official_source, mapping, context, errors);
    if (response.resolution_kind === "official_source") {
      return;
    }

    const unit = findUnit(
      coreBundle,
      response,
      response.law_uuid,
      context,
      errors,
    );
    if (unit === undefined) {
      return;
    }
    validatePdfLineage(
      mapping,
      unit.lineage.artifact_id,
      response.pdf_sha256,
      response.transcription_id,
      undefined,
      undefined,
      context,
      errors,
    );
    validateUnitLineage(
      unit,
      response.source_mapping_id,
      unit.lineage.artifact_id,
      response.pdf_sha256,
      response.transcription_id,
      context,
      errors,
    );
    if (!sameRiskState(response.risk, unit)) {
      errors.push(`${context} risk state does not match unit_id ${unit.unit_id}`);
    }
    const expectedReaderPrefix = `/${response.country_route}/leyes/${response.law_uuid}/lector?`;
    if (!response.reader_location.startsWith(expectedReaderPrefix)) {
      errors.push(`${context} reader location does not match its law and country route`);
    }
    const readerLocation = new URL(
      response.reader_location,
      "https://reader.invalid",
    );
    if (
      readerLocation.searchParams.get("unidad") !==
        toPublicUnitKey(response.unit_key) ||
      Number(readerLocation.searchParams.get("pagina")) !==
        response.physical_pages.start
    ) {
      errors.push(`${context} reader location does not match its unit and page`);
    }
  });

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
  const responsesSchema = readJson(join(contractRoot, "responses.schema.json"));
  const validFixture = readJson(join(fixturesRoot, "valid-core-bundle.json"));
  const validResponses = readJson(
    join(fixturesRoot, "valid-response-bundle.json"),
  ) as ResponseBundle;
  const invalidCases = readJson(
    join(fixturesRoot, "invalid-cases.json"),
  ) as InvalidCasesFile;
  const invalidResponseCases = readJson(
    join(fixturesRoot, "invalid-response-cases.json"),
  ) as InvalidCasesFile;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schemaValidator = ajv.compile(schema);
  const responseValidator = ajv.compile(responsesSchema);
  const errors = validateBundle(validFixture, schemaValidator, taxonomy);
  errors.push(
    ...validateResponseBundle(
      validResponses,
      responseValidator,
      validFixture as CoreBundle,
    ),
  );

  if (invalidCases.base_fixture !== "valid-core-bundle.json") {
    errors.push("invalid-cases.json must use valid-core-bundle.json as its base");
  }
  if (validResponses.core_fixture !== "valid-core-bundle.json") {
    errors.push(
      "valid-response-bundle.json must use valid-core-bundle.json as its core",
    );
  }
  if (invalidResponseCases.base_fixture !== "valid-response-bundle.json") {
    errors.push(
      "invalid-response-cases.json must use valid-response-bundle.json as its base",
    );
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

  for (const response of validResponses.responses) {
    if (
      response.contract_id === "legal-source-reader/v1/reader-unit" &&
      !response.unit.transcription_text.startsWith("[SYNTHETIC]")
    ) {
      errors.push(
        `response fixture unit_id ${response.unit.unit_id} does not mark its transcription text synthetic`,
      );
    }
  }

  for (const testCase of invalidResponseCases.cases) {
    const invalidFixture = applyInvalidCase(validResponses, testCase);
    const caseErrors = validateResponseBundle(
      invalidFixture,
      responseValidator,
      validFixture as CoreBundle,
    );
    if (caseErrors.length === 0) {
      errors.push(`negative response fixture ${testCase.name} unexpectedly passed`);
      continue;
    }
    if (!caseErrors.some((error) => error.includes(testCase.expected_error))) {
      errors.push(
        `negative response fixture ${testCase.name} did not produce expected error "${testCase.expected_error}"; got: ${caseErrors.join(" | ")}`,
      );
    }
  }

  return errors.map((error) => `legal-source-reader/v1: ${error}`);
}
