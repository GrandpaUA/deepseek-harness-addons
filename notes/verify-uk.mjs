// Verifies the Ukrainian locale package against the extracted zh/en dictionaries.
// Loads the real plugin client.js with a mocked ctx and collects every registered
// dictionary, then compares key sets and value sanity with locales-extracted.json.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const extractedPath = join(here, "locales-extracted.json");
const pluginPath = join(here, "..", "profiles", "web", "node_modules", "@local", "dsh-locale-uk", "client.js");

const extracted = JSON.parse(readFileSync(extractedPath, "utf8"));

// --- Load the plugin with a mock ctx and capture registrations ---
const registered = new Map(); // ns -> dict
const disposers = [];
const fakeCtx = {
  effect(fn) { fn(); },
  locale: {
    register(ns, locale, dict) {
      if (locale !== "uk") throw new Error(`unexpected locale ${locale}`);
      if (registered.has(ns)) throw new Error(`duplicate ns registration: ${ns}`);
      registered.set(ns, dict);
      return () => {};
    },
  },
};
const require = createRequire(pluginPath);
// Emulate the DSH client module loader wrapper: window.__ModuleLoader__.load({id, factory})
let loadedExports = null;
globalThis.window = {
  __ModuleLoader__: {
    load(spec) {
      loadedExports = spec.factory(() => ({}));
    },
  },
};
require(pluginPath);
const mod = loadedExports;
if (typeof mod.apply !== "function") throw new Error("plugin has no apply()");
mod.apply(fakeCtx);

// --- Compare ---
const problems = [];
const zhNamespaces = Object.keys(extracted);
let totalZh = 0;
let totalUk = 0;
let emptyUk = 0;
let sameAsEn = 0;

for (const ns of zhNamespaces) {
  const zh = extracted[ns].zh ?? {};
  const en = extracted[ns].en ?? {};
  const uk = registered.get(ns);
  totalZh += Object.keys(zh).length;
  if (!uk) {
    problems.push(`[missing ns] ${ns}: not registered by uk package`);
    continue;
  }
  totalUk += Object.keys(uk).length;
  for (const key of Object.keys(zh)) {
    if (!(key in uk)) {
      problems.push(`[missing key] ${ns}/${key}`);
      continue;
    }
    const v = uk[key];
    if (typeof v !== "string" || v.length === 0) {
      problems.push(`[empty/bad value] ${ns}/${key}`);
      emptyUk++;
    } else if (en[key] && v === en[key] && !/^[\x00-\x7F]*$/.test(v)) {
      // identical to English but contains cyrillic -> suspicious copy
      problems.push(`[copy-of-en?] ${ns}/${key}`);
    }
    if (typeof v === "string" && en[key] && v === en[key]) sameAsEn++;
  }
  for (const key of Object.keys(uk)) {
    if (!(key in zh)) problems.push(`[extra key] ${ns}/${key} (no zh counterpart)`);
  }
}
for (const ns of registered.keys()) {
  if (!zhNamespaces.includes(ns)) problems.push(`[unknown ns] ${ns}: not present in extracted bundle dicts`);
}

console.log(`namespaces in bundle: ${zhNamespaces.length}, registered by plugin: ${registered.size}`);
console.log(`zh keys total: ${totalZh}, uk keys total: ${totalUk}`);
console.log(`uk identical to en (ok for latin-only terms): ${sameAsEn}`);
if (problems.length === 0) {
  console.log("RESULT: OK — every zh/en key has a non-empty uk translation");
} else {
  console.log(`RESULT: ${problems.length} problem(s):`);
  for (const p of problems) console.log("  " + p);
  process.exitCode = 1;
}
