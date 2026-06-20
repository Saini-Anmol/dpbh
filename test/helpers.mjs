// Test helper: load a classic extension script (an IIFE that attaches to globalThis)
// into the current context so its API becomes available on globalThis — the same way
// the browser loads settings.js / detection.js before content.js.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadExtensionScript(relPath) {
  const code = readFileSync(join(ROOT, "extension", relPath), "utf8");
  vm.runInThisContext(code, { filename: relPath });
}
