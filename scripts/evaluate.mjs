#!/usr/bin/env node
// Evaluate the shipped quantized DistilBERT on the labeled set in eval/dataset.jsonl.
// Runs the SAME model + dtype the extension uses (offscreen.js), so the metrics reflect
// real in-product behavior. Prints a report and writes eval/results.json.
//
//   npm run eval
//
// This is a DEV tool only (@huggingface/transformers is a devDependency); nothing here
// ships in the extension.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline, env } from "@huggingface/transformers";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODELS_DIR = join(ROOT, "extension", "models");
const MODEL_ID = "dpbh-distilbert";

// Match the extension: strictly local, no remote fetch.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.localModelPath = MODELS_DIR;

const LABELS = JSON.parse(readFileSync(join(MODELS_DIR, MODEL_ID, "label_map.json"), "utf8"));
const CLASSES = Object.values(LABELS);

function loadDataset() {
  const path = join(ROOT, "eval", "dataset.jsonl");
  return readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// ----- metrics -----
function computeMetrics(rows) {
  const idx = Object.fromEntries(CLASSES.map((c, i) => [c, i]));
  const n = CLASSES.length;
  const confusion = Array.from({ length: n }, () => Array(n).fill(0));

  let correct = 0;
  for (const r of rows) {
    confusion[idx[r.label]][idx[r.predicted]]++;
    if (r.label === r.predicted) correct++;
  }

  const perClass = CLASSES.map((cls, i) => {
    const tp = confusion[i][i];
    const fp = confusion.reduce((s, row, r) => s + (r === i ? 0 : row[i]), 0);
    const fn = confusion[i].reduce((s, v, c) => s + (c === i ? 0 : v), 0);
    const support = confusion[i].reduce((s, v) => s + v, 0);
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { class: cls, precision, recall, f1, support };
  });

  const total = rows.length;
  const macroF1 = perClass.reduce((s, c) => s + c.f1, 0) / n;
  const macroPrecision = perClass.reduce((s, c) => s + c.precision, 0) / n;
  const macroRecall = perClass.reduce((s, c) => s + c.recall, 0) / n;
  const weightedF1 = perClass.reduce((s, c) => s + c.f1 * c.support, 0) / total;

  return {
    accuracy: correct / total,
    macroPrecision,
    macroRecall,
    macroF1,
    weightedF1,
    perClass,
    confusion,
    total,
  };
}

function pct(x) {
  return (x * 100).toFixed(1) + "%";
}

function printReport(m) {
  console.log(`\nDigiCom model evaluation — ${m.total} examples, ${CLASSES.length} classes\n`);
  console.log("Per-class:");
  console.log("  class               precision  recall    f1       support");
  for (const c of m.perClass) {
    console.log(
      "  " +
        c.class.padEnd(18) +
        "  " +
        pct(c.precision).padStart(8) +
        "  " +
        pct(c.recall).padStart(7) +
        "  " +
        pct(c.f1).padStart(7) +
        "  " +
        String(c.support).padStart(7)
    );
  }
  console.log("\nOverall:");
  console.log("  accuracy      " + pct(m.accuracy));
  console.log("  macro F1      " + pct(m.macroF1));
  console.log("  weighted F1   " + pct(m.weightedF1));
  console.log("  macro prec.   " + pct(m.macroPrecision));
  console.log("  macro recall  " + pct(m.macroRecall));
}

// ----- run -----
const dataset = loadDataset();
console.log(`Loading model ${MODEL_ID} (q8) …`);
const classifier = await pipeline("text-classification", MODEL_ID, { dtype: "q8" });

const rows = [];
for (const ex of dataset) {
  const out = await classifier(ex.text, { top_k: 1 });
  const top = Array.isArray(out) ? out[0] : out;
  rows.push({ ...ex, predicted: top.label, score: top.score });
}

const metrics = computeMetrics(rows);
printReport(metrics);

const results = {
  model: MODEL_ID,
  dtype: "q8",
  evaluatedAt: new Date().toISOString(),
  datasetSize: metrics.total,
  classes: CLASSES,
  metrics: {
    accuracy: metrics.accuracy,
    macroPrecision: metrics.macroPrecision,
    macroRecall: metrics.macroRecall,
    macroF1: metrics.macroF1,
    weightedF1: metrics.weightedF1,
    perClass: metrics.perClass,
  },
  confusion: metrics.confusion,
  predictions: rows,
};
writeFileSync(join(ROOT, "eval", "results.json"), JSON.stringify(results, null, 2) + "\n");
console.log("\n✓ Wrote eval/results.json");
