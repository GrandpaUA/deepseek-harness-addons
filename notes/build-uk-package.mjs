// Merge uk translation parts, validate against extracted zh key sets,
// and build the @local/dsh-locale-uk client plugin package.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const NOTES = "C:\\All\\Project\\Vibecode\\DeepSeek Harness\\notes";
const PKG_DIR = "C:\\All\\Project\\Vibecode\\DeepSeek Harness\\profiles\\web\\node_modules\\@local\\dsh-locale-uk";

const extracted = JSON.parse(readFileSync(join(NOTES, "locales-extracted.json"), "utf8"));
const uk = {};
for (const f of readdirSync(join(NOTES, "uk")).filter((n) => n.endsWith(".json")).sort()) {
  const part = JSON.parse(readFileSync(join(NOTES, "uk", f), "utf8"));
  for (const [ns, dict] of Object.entries(part)) {
    if (uk[ns]) throw new Error(`duplicate namespace ${ns}`);
    uk[ns] = dict;
  }
}

let problems = 0;
for (const [ns, locs] of Object.entries(extracted)) {
  const zhKeys = Object.keys(locs.zh).sort();
  const ukDict = uk[ns];
  if (!ukDict) { console.log(`MISSING ns: ${ns}`); problems++; continue; }
  const ukKeys = Object.keys(ukDict).sort();
  const missing = zhKeys.filter((k) => !ukKeys.includes(k));
  const extra = ukKeys.filter((k) => !zhKeys.includes(k));
  if (missing.length) { console.log(`${ns}: missing uk keys: ${missing.join(", ")}`); problems++; }
  if (extra.length) { console.log(`${ns}: extra uk keys: ${extra.join(", ")}`); problems++; }
}
const extraNs = Object.keys(uk).filter((ns) => !extracted[ns]);
if (extraNs.length) { console.log("extra namespaces:", extraNs.join(", ")); problems++; }
if (problems) { console.log(`\n${problems} problem(s) — aborting`); process.exit(1); }

const total = Object.values(uk).reduce((s, d) => s + Object.keys(d).length, 0);
console.log(`OK: ${Object.keys(uk).length} namespaces, ${total} uk keys — all match zh key sets`);

mkdirSync(PKG_DIR, { recursive: true });

writeFileSync(join(PKG_DIR, "package.json"), JSON.stringify({
  name: "@local/dsh-locale-uk",
  description: "Ukrainian locale dictionaries for the DSH web UI (local translation layer)",
  version: "0.1.0",
  type: "module",
  exports: {
    "./client": "./client.js",
    "./package.json": "./package.json"
  },
  dsh: { client: { inject: [], platform: "web", immediately: true } }
}, null, 2), "utf8");

const dictsJson = JSON.stringify(uk);
const clientJs = `window.__ModuleLoader__.load({
	id: "@local/dsh-locale-uk",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		/** Ukrainian dictionaries for every shipped locale namespace. */
		const DICTS = ${dictsJson};
		const inject = ["locale"];
		/** Register every namespace's uk dictionary on the locale service. */
		function apply(ctx) {
			ctx.effect(() => {
				const disposers = [];
				for (const [ns, dict] of Object.entries(DICTS)) disposers.push(ctx.locale.register(ns, "uk", dict));
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "dsh-locale-uk: ukrainian dictionaries");
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
`;
writeFileSync(join(PKG_DIR, "client.js"), clientJs, "utf8");
console.log("package written:", PKG_DIR);
