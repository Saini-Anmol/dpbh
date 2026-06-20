#!/usr/bin/env node
// Keep the shipped model in sync with the exported artifact.
//
//   Source of truth : onnx_quantized/            (raw export from training)
//   Destination     : extension/models/dpbh-distilbert/   (what the extension loads)
//
// The destination nests the weights under onnx/ (Transformers.js convention); every other
// file (tokenizer, config, label map) sits at the top level.
//
// Usage:
//   node scripts/sync-model.mjs           copy source -> destination (overwrites)
//   node scripts/sync-model.mjs --check   verify they match; exit 1 on drift (CI / pre-commit)

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "onnx_quantized");
const DST = join(ROOT, "extension", "models", "dpbh-distilbert");

// Weights live under onnx/ in the extension; tokenizer/config files stay at the root.
const NESTED = new Set(["model_quantized.onnx"]);

function destFor(file) {
  return NESTED.has(file) ? join(DST, "onnx", file) : join(DST, file);
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sourceFiles() {
  if (!existsSync(SRC)) {
    console.error(`✗ Source model dir not found: ${SRC}`);
    process.exit(1);
  }
  return readdirSync(SRC, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith("."))
    .map((d) => d.name);
}

const check = process.argv.includes("--check");
const files = sourceFiles();
let drift = 0;

for (const file of files) {
  const src = join(SRC, file);
  const dst = destFor(file);

  if (check) {
    if (!existsSync(dst)) {
      console.error(`✗ MISSING  ${file} → ${dst.replace(ROOT + "/", "")}`);
      drift++;
      continue;
    }
    if (sha256(src) !== sha256(dst)) {
      console.error(`✗ DIFFERS  ${file}`);
      drift++;
    } else {
      console.log(`✓ ok       ${file}`);
    }
  } else {
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    console.log(`→ copied   ${file} → ${dst.replace(ROOT + "/", "")}`);
  }
}

if (check) {
  if (drift) {
    console.error(`\n✗ Model out of sync (${drift} file(s)). Run: npm run sync-model`);
    process.exit(1);
  }
  console.log(`\n✓ Model in sync (${files.length} files).`);
} else {
  console.log(`\n✓ Synced ${files.length} files to extension/models/dpbh-distilbert/`);
}
