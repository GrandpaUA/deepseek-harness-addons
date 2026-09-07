// Compare dictionary values vs ALL CJK string literals per client bundle,
// to estimate how much UI copy sits outside the locale registry.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DSH_HOME = process.env.DSH_HOME || "C:\\All\\Project\\Vibecode\\DeepSeek Harness";
const ROOT = join(DSH_HOME, "runtime", "node_modules", "@deepseek-ai");
const extracted = JSON.parse(readFileSync(join(here, "locales-extracted.json"), "utf8"));

const dictValues = new Set();
for (const locs of Object.values(extracted)) {
  for (const dict of Object.values(locs)) {
    for (const v of Object.values(dict)) dictValues.add(v);
  }
}
console.log("dictionary values:", dictValues.size);

const files = readdirSync(ROOT)
  .map((name) => ({ name, path: join(ROOT, name, "lib", "client.js") }))
  .filter((e) => { try { return statSync(e.path).isFile(); } catch { return false; } });

let totalInline = 0;
const rows = [];
for (const { name: pkg, path } of files) {
  const text = readFileSync(path, "utf8");
  // all string literals (double, single, backtick) containing CJK
  const literals = new Set();
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const s = m[1] ?? m[2] ?? m[3];
    if (/[\u4e00-\u9fff]/.test(s)) literals.add(s);
  }
  // unescape common sequences for comparison with dict values
  const un = (s) => s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  const inline = [...literals].filter((s) => !dictValues.has(s) && !dictValues.has(un(s)));
  totalInline += inline.length;
  if (inline.length) rows.push({ pkg, inline: inline.length, sample: inline.slice(0, 3) });
}
rows.sort((a, b) => b.inline - a.inline);
console.log("total inline CJK literals:", totalInline);
for (const r of rows) {
  console.log(`\n${r.pkg}: ${r.inline}`);
  for (const s of r.sample) console.log("   ", JSON.stringify(s.slice(0, 90)));
}
