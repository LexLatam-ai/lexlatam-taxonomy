/**
 * Validates data/document-types.json against data/schema.json (JSON Schema
 * draft 2020-12) and runs cross-reference checks the schema cannot express:
 * every parent/type/subtype identifier must actually exist, and a mapping's
 * subtype must belong to that mapping's type.
 *
 * Exits non-zero on any failure so CI can gate on it.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(
  readFileSync(join(ROOT, "data", "document-types.json"), "utf-8"),
);
const schema = JSON.parse(
  readFileSync(join(ROOT, "data", "schema.json"), "utf-8"),
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

if (errors.length > 0) {
  console.error("✗ data/document-types.json is invalid:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("✓ data/document-types.json is valid.");
