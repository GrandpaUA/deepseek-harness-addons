// Cross-check: find every CJK string literal in the @deepseek-ai client packages
// and report the ones that are NOT zh dictionary values covered by locales-extracted.json.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DSH_HOME = process.env.DSH_HOME || "C:\\All\\Project\\Vibecode\\DeepSeek Harness";
const root = join(DSH_HOME, "runtime", "node_modules", "@deepseek-ai");
const extracted = JSON.parse(readFileSync(join(here, "locales-extracted.json"), "utf8"));

// Set of all zh values (and en values) in the extracted dictionaries.
const zhValues = new Set();
for (const ns of Object.keys(extracted)) {
  for (const v of Object.values(extracted[ns].zh ?? {})) zhValues.add(v);
}

const CJK = /[\u4e00-\u9fff]/;
// Collect string literals containing CJK (single, double quotes, backticks).
const litRe = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) yield* walk(p);
    else if (/\.c?js$/.test(name) && st.size < 30_000_000) yield p;
  }
}

const uncovered = new Map(); // literal -> Set(file)
for (const file of walk(root)) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  if (!CJK.test(text)) continue;
  for (const m of text.match(litRe) ?? []) {
    if (!CJK.test(m)) continue;
    const inner = m.slice(1, -1);
    if (zhValues.has(inner)) continue; // covered dictionary value
    // skip pure comments approximated by skipping if appears in a comment-only context — not detectable here; report all
    if (!uncovered.has(m)) uncovered.set(m, new Set());
    uncovered.get(m).add(file.slice(root.length + 1).split("\\lib\\")[0]);
  }
}

console.log(`uncovered CJK literals: ${uncovered.size}`);
for (const [lit, pkgs] of uncovered) {
  const short = lit.length > 110 ? lit.slice(0, 110) + "…" : lit;
  console.log(`- ${short}   [${[...pkgs].join(", ")}]`);
}
