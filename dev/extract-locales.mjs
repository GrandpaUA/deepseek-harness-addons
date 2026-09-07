// Extract all locale dictionaries (namespace -> {zh, en}) from installed DSH
// client bundles. Reads each @deepseek-ai/*/lib/client.js, locates locale
// register calls, brace-extracts the object literals, evaluates them safely.
import { readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DSH_HOME = process.env.DSH_HOME || "C:\\All\\Project\\Vibecode\\DeepSeek Harness";
const ROOT = join(DSH_HOME, "runtime", "node_modules", "@deepseek-ai");

// Extract balanced {...} or [...] starting at index of the opening bracket.
function extractBalanced(text, start) {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0, i = start, state = null; // state: quote char or null; plus comment handling
  for (; i < text.length; i++) {
    const ch = text[i];
    if (state === "line-comment") { if (ch === "\n") state = null; continue; }
    if (state === "block-comment") { if (ch === "*" && text[i + 1] === "/") { state = null; i++; } continue; }
    if (state) { // inside string
      if (ch === "\\") { i++; continue; }
      if (ch === state) state = null;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") { state = "line-comment"; i++; continue; }
    if (ch === "/" && text[i + 1] === "*") { state = "block-comment"; i++; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { state = ch; continue; }
    if (ch === open || ch === "{") depth++;
    else if (ch === close || ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`unbalanced literal at ${start}`);
}

// Evaluate an object/array literal text.
function evalLiteral(src) {
  return new Function(`"use strict"; return (${src});`)();
}

// Evaluate a literal that may reference other const object literals defined
// earlier in the same file (resolves `X is not defined` by finding the
// nearest `const X = {...}` before beforeIdx, recursively).
function evalLiteralWithDefs(src, text, beforeIdx) {
  const scope = {};
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const keys = Object.keys(scope);
      const fn = new Function(...keys, `"use strict"; return (${src});`);
      return fn(...keys.map((k) => scope[k]));
    } catch (error) {
      const m = /^(\w+) is not defined$/.exec(error.message);
      if (!m) throw error;
      const id = m[1];
      const before = text.slice(0, beforeIdx);
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const defRe = new RegExp(`(?:const|let|var)\\s+${esc}\\s*=\\s*(\\{)`, "g");
      let last = null, dm;
      while ((dm = defRe.exec(before)) !== null) last = dm;
      if (last) {
        scope[id] = evalLiteralWithDefs(extractBalanced(text, last.index + last[0].length - 1), text, last.index);
        continue;
      }
      // fall back to a string const: const X = "..."
      const strRe = new RegExp(`(?:const|let|var)\\s+${esc}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g");
      let lastStr = null, sm;
      while ((sm = strRe.exec(before)) !== null) lastStr = sm;
      if (lastStr) {
        scope[id] = JSON.parse(`"${lastStr[1]}"`);
        continue;
      }
      throw error;
    }
  }
  throw new Error("too many unresolved references");
}

const result = {};   // ns -> { zh: {}, en: {} }
const warnings = [];
const report = [];

function addDict(pkg, ns, locale, dict) {
  result[ns] ??= {};
  if (result[ns][locale]) warnings.push(`${pkg}: duplicate (${ns}, ${locale}) — kept first`);
  else result[ns][locale] = dict;
}

const files = readdirSync(ROOT)
  .map((name) => ({ name, path: join(ROOT, name, "lib", "client.js") }))
  .filter((e) => { try { return statSync(e.path).isFile(); } catch { return false; } });

for (const { name: pkg, path } of files) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch { continue; }
  console.error(`[scan] ${pkg}`);
  try {
    scanFile(pkg, text);
  } catch (error) {
    warnings.push(`${pkg}: SCAN ERROR: ${error.message}`);
  }
}

function scanFile(pkg, text) {

  // 1) string constants: const X = "value"
  const consts = new Map();
  for (const m of text.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    consts.set(m[1], m[2]);
  }

  // 2) special case: const dictionaries = [["zh", {...}], ["en", {...}]]
  const dictArrayMatch = /(?:const|let|var)\s+dictionaries\s*=\s*(\[)/.exec(text);
  if (dictArrayMatch) {
    const src = extractBalanced(text, dictArrayMatch.index + dictArrayMatch[0].length - 1);
    const arr = evalLiteral(src);
    // find owning ns: nearest LOCALE_NS-ish const used by a register with dictionaries
    const regMatch = /register\(\s*([A-Za-z_$][\w$]*)\s*,\s*locale\s*,\s*dict\s*\)/.exec(text);
    const ns = regMatch ? (consts.get(regMatch[1]) ?? regMatch[1]) : null;
    if (ns) for (const [loc, dict] of arr) addDict(pkg, ns, loc, dict);
    else warnings.push(`${pkg}: dictionaries array found but ns unresolved`);
  }

  // 3) every locale.register(...) call site
  const callRe = /locale\.register\(/g;
  let cm;
  while ((cm = callRe.exec(text)) !== null) {
    const callStart = cm.index + cm[0].length;
    // first argument: string literal or identifier
    const argRest = text.slice(callStart, callStart + 400);
    let ns = null, consumed = 0;
    const strArg = /^\s*"([^"]+)"\s*,/.exec(argRest) ?? /^\s*'([^']+)'\s*,/.exec(argRest);
    const idArg = /^\s*([A-Za-z_$][\w$]*)\s*,/.exec(argRest);
    if (strArg) { ns = strArg[1]; consumed = strArg[0].length; }
    else if (idArg) { ns = consts.get(idArg[1]) ?? `UNRESOLVED:${idArg[1]}`; consumed = idArg[0].length; }
    else { warnings.push(`${pkg}: cannot parse register arg0 at ${cm.index}`); continue; }

    const afterNs = text.slice(callStart + consumed, callStart + consumed + 300);
    const singleLocale = /^\s*"(\w+)"\s*,\s*(\{)/.exec(afterNs);
    const typedForm = /^\s*(\{)/.exec(afterNs);

    if (singleLocale) {
      const dictStart = callStart + consumed + singleLocale.index + singleLocale[0].length - 1;
      const dict = evalLiteralWithDefs(extractBalanced(text, dictStart), text, cm.index);
      addDict(pkg, ns, singleLocale[1], dict);
      continue;
    }
    if (typedForm) {
      const objStart = callStart + consumed + typedForm.index + typedForm[0].length - 1;
      const objSrc = extractBalanced(text, objStart);
      // parse entries: shorthand (zh) or key: value
      const inner = objSrc.slice(1, -1);
      const entries = [];
      // split top-level commas (dicts here are identifier refs or inline objects; no nested complexity expected beyond objects)
      let depth = 0, buf = "", state = null;
      for (let k = 0; k < inner.length; k++) {
        const ch = inner[k];
        if (state) { if (ch === "\\") { buf += ch + inner[k + 1]; k++; continue; } if (ch === state) state = null; buf += ch; continue; }
        if (ch === '"' || ch === "'" || ch === "`") { state = ch; buf += ch; continue; }
        if (ch === "{" || ch === "[") depth++;
        if (ch === "}" || ch === "]") depth--;
        if (ch === "," && depth === 0) { entries.push(buf.trim()); buf = ""; continue; }
        buf += ch;
      }
      if (buf.trim()) entries.push(buf.trim());
      for (const entry of entries) {
        const shortId = /^([A-Za-z_$][\w$]*)$/.exec(entry);
        const kv = /^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/.exec(entry);
        if (shortId) {
          // identifier ref: search backward for nearest definition
          const id = shortId[1];
          const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const before = text.slice(0, cm.index);
          const defRe = new RegExp(`(?:const|let|var)\\s+${esc}\\s*=\\s*(\\{)`, "g");
          let last = null, dm;
          while ((dm = defRe.exec(before)) !== null) last = dm;
          if (!last) { warnings.push(`${pkg}: no definition for '${id}' (ns ${ns})`); continue; }
          const dict = evalLiteralWithDefs(extractBalanced(text, last.index + last[0].length - 1), text, last.index);
          addDict(pkg, ns, id, dict);
        } else if (kv) {
          const loc = kv[1], valSrc = kv[2].trim();
          if (valSrc.startsWith("{")) {
            const dict = evalLiteralWithDefs(valSrc, text, cm.index);
            addDict(pkg, ns, loc, dict);
          } else {
            const id = valSrc;
            const esc = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const before = text.slice(0, cm.index);
            const defRe = new RegExp(`(?:const|let|var)\\s+${esc}\\s*=\\s*(\\{)`, "g");
            let last = null, dm;
            while ((dm = defRe.exec(before)) !== null) last = dm;
            if (!last) { warnings.push(`${pkg}: no definition for '${id}' (ns ${ns})`); continue; }
            const dict = evalLiteralWithDefs(extractBalanced(text, last.index + last[0].length - 1), text, last.index);
            addDict(pkg, ns, loc, dict);
          }
        } else if (entry) {
          warnings.push(`${pkg}: unparsed typed entry in ns ${ns}: ${entry.slice(0, 60)}`);
        }
      }
      continue;
    }
    warnings.push(`${pkg}: unrecognized register shape at ${cm.index}`);
  }
}

for (const [ns, locs] of Object.entries(result)) {
  const zhKeys = Object.keys(locs.zh ?? {});
  const enKeys = Object.keys(locs.en ?? {});
  const missingEn = zhKeys.filter((k) => !(k in (locs.en ?? {})));
  const extraEn = enKeys.filter((k) => !(k in (locs.zh ?? {})));
  report.push({ ns, zh: zhKeys.length, en: enKeys.length, missingEn, extraEn });
  if (missingEn.length || extraEn.length) warnings.push(`${ns}: key mismatch zh/en`);
}

const totalKeys = report.reduce((s, r) => s + r.zh, 0);
writeFileSync("C:\\All\\Project\\Vibecode\\DeepSeek Harness\\notes\\locales-extracted.json", JSON.stringify(result, null, 1), "utf8");

console.log("namespaces:", report.length, "| total zh keys:", totalKeys);
for (const r of report.sort((a, b) => b.zh - a.zh)) {
  console.log(`${r.ns.padEnd(28)} zh=${String(r.zh).padStart(4)} en=${String(r.en).padStart(4)}${r.missingEn.length || r.extraEn.length ? "  <-- MISMATCH" : ""}`);
}
if (warnings.length) { console.log("\nWARNINGS:"); for (const w of warnings) console.log(" -", w); }
