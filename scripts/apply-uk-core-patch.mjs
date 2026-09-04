// Adds the "uk" locale to @deepseek-ai/dsh-client-locale so the settings schema
// and the language picker accept Ukrainian. Idempotent: safe to run repeatedly.
//
// Usage:  node scripts/apply-uk-core-patch.mjs   (from the DSH home directory)
//
// Note: DSH ships only zh/en. The translation dictionaries themselves come from
// the client plugin profiles/web/node_modules/@local/dsh-locale-uk, which is
// wired in through profiles/web/cordis.patch.yml.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgDir = join(root, "runtime", "node_modules", "@deepseek-ai", "dsh-client-locale", "lib");

function patch(file, replacements) {
  const path = join(pkgDir, file);
  let text = readFileSync(path, "utf8");
  let changed = false;
  for (const { name, from, to } of replacements) {
    if (text.includes(to)) {
      console.log(`[skip] ${file}: ${name} (already applied)`);
      continue;
    }
    if (!text.includes(from)) {
      throw new Error(`${file}: cannot find the original "${name}" snippet — package layout changed?`);
    }
    text = text.replace(from, to);
    changed = true;
    console.log(`[ok]   ${file}: ${name}`);
  }
  if (changed) writeFileSync(path, text, "utf8");
}

patch("index.js", [
  {
    name: "LOCALE_IDS",
    from: `const LOCALE_IDS = ["zh", "en"];`,
    to: `const LOCALE_IDS = ["zh", "en", "uk"];`,
  },
]);

patch("client.js", [
  {
    name: "LOCALE_IDS",
    from: `const LOCALE_IDS = ["zh", "en"];`,
    to: `const LOCALE_IDS = ["zh", "en", "uk"];`,
  },
  {
    name: "LOCALES entry",
    from: `\t\t\tlabel: "English"\n\t\t}]);`,
    to: `\t\t\tlabel: "English"\n\t\t}, {\n\t\t\tid: "uk",\n\t\t\tlabel: "Українська"\n\t\t}]);`,
  },
  {
    name: "DOCUMENT_LANGUAGE entry",
    from: `\t\t\ten: "en"\n\t\t};`,
    to: `\t\t\ten: "en",\n\t\t\tuk: "uk"\n\t\t};`,
  },
]);

console.log("Done. Restart the dsh web server to pick up the change.");
