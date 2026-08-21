/**
 * Validates the canonical document-type, legal-subject, and legal-source-reader
 * contracts and runs cross-reference checks the schemas cannot express.
 *
 * Exits non-zero on any failure so CI can gate on it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { validateLegalSourceReaderV1 } from "./validate-legal-source-reader.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(
  readFileSync(join(ROOT, "data", "document-types.json"), "utf-8"),
);
const schema = JSON.parse(
  readFileSync(join(ROOT, "data", "schema.json"), "utf-8"),
);
const legalSubjects = JSON.parse(
  readFileSync(join(ROOT, "data", "legal-subjects.json"), "utf-8"),
);
const legalSubjectsSchema = JSON.parse(
  readFileSync(join(ROOT, "data", "legal-subjects.schema.json"), "utf-8"),
);
const npmPackage = JSON.parse(
  readFileSync(join(ROOT, "typescript", "package.json"), "utf-8"),
);
const pythonProject = readFileSync(
  join(ROOT, "python", "pyproject.toml"),
  "utf-8",
);

const errors: string[] = [];

// --- Structural validation against the JSON Schema -------------------------
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
if (!validate(data)) {
  for (const err of validate.errors ?? []) {
    errors.push(`schema: ${err.instancePath || "/"} ${err.message ?? ""}`);
  }
}

const validateLegalSubjects = ajv.compile(legalSubjectsSchema);
if (!validateLegalSubjects(legalSubjects)) {
  for (const err of validateLegalSubjects.errors ?? []) {
    errors.push(
      `legal-subject schema: ${err.instancePath || "/"} ${err.message ?? ""}`,
    );
  }
}

const pythonVersion = pythonProject.match(/^version = "([^"]+)"$/m)?.[1];
for (const [source, version] of [
  ["legal subjects", legalSubjects.version],
  ["npm package", npmPackage.version],
  ["Python package", pythonVersion],
] as const) {
  if (version !== data.version) {
    errors.push(
      `version mismatch: document types are ${data.version}, ${source} is ${version ?? "missing"}`,
    );
  }
}

const subjectKeys = new Set(Object.keys(legalSubjects.subjects ?? {}));
if (subjectKeys.size !== 21) {
  errors.push(
    `legal subjects: expected 21 identifiers, found ${subjectKeys.size}`,
  );
}
if (!subjectKeys.has("other") || !subjectKeys.has("unknown")) {
  errors.push(
    'legal subjects: distinct "other" and "unknown" identifiers are required',
  );
}
if (
  legalSubjects.subjects?.other?.label_es ===
  legalSubjects.subjects?.unknown?.label_es
) {
  errors.push('legal subjects: "other" and "unknown" must have distinct labels');
}
for (const [source, target] of Object.entries<string>(
  legalSubjects.content_category_crosswalk ?? {},
)) {
  if (!subjectKeys.has(target)) {
    errors.push(
      `content crosswalk "${source}": target "${target}" is not a known legal subject`,
    );
  }
}

// --- Cross-reference validation --------------------------------------------
const typeKeys = new Set(Object.keys(data.types ?? {}));
const subtypeKeys = new Set(Object.keys(data.subtypes ?? {}));

for (const [name, sub] of Object.entries<{ parent: string }>(
  data.subtypes ?? {},
)) {
  if (!typeKeys.has(sub.parent)) {
    errors.push(`subtype "${name}": parent "${sub.parent}" is not a known type`);
  }
}

function checkRef(
  context: string,
  type: string,
  subtype: string | null,
): void {
  if (!typeKeys.has(type)) {
    errors.push(`${context}: type "${type}" is not a known type`);
  }
  if (subtype !== null) {
    if (!subtypeKeys.has(subtype)) {
      errors.push(`${context}: subtype "${subtype}" is not a known subtype`);
    } else {
      const parent = data.subtypes[subtype].parent;
      if (parent !== type) {
        errors.push(
          `${context}: subtype "${subtype}" belongs to "${parent}", not "${type}"`,
        );
      }
    }
  }
}

for (const [native, m] of Object.entries<{ type: string; subtype: string | null }>(
  data.mappings ?? {},
)) {
  checkRef(`mapping "${native}"`, m.type, m.subtype);
}
for (const fb of data.fallbacks ?? []) {
  checkRef(`fallback "${fb.prefix}"`, fb.type, fb.subtype);
}

errors.push(...validateLegalSourceReaderV1(ROOT, data));

if (errors.length > 0) {
  console.error("✗ repository contracts are invalid:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  "✓ document types, legal subjects, and legal-source-reader/v1 core are valid.",
);
