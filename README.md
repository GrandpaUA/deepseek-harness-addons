# DSH Locale UK 🇺🇦

Повний український переклад веб-інтерфейсу [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) (DSH): 30 просторів назв, 726 ключів.

Корінь цього репо — це і є плагін `@local/dsh-locale-uk` (`package.json` + `index.js` + `client.js`). Клієнтський бандл реєструє uk-словники в системі локалей; серверна частина — no-op.

## Встановлення на інсталяцію DSH

1. Скопіювати репо як workspace-пакет у профіль `web`:
   - покласти теку плагіна в `<DSH_HOME>/plugins/dsh-locale-uk/` (або зробити junction на клон репо),
   - у `<DSH_HOME>/profiles/web/pnpm-workspace.yaml` мати glob `../../plugins/*`,
   - у `<DSH_HOME>/profiles/web/package.json` додати залежність `"@local/dsh-locale-uk": "workspace:*"` і виконати `pnpm install`.
2. Додати в `<DSH_HOME>/profiles/web/cordis.patch.yml` (файл може не існувати — створити):
   ```yaml
   - insert:
       - id: locale-uk
         name: '@local/dsh-locale-uk'
   ```
3. Застосувати патч ядра (додає `uk` до `LOCALE_IDS`/`LOCALES`/`DOCUMENT_LANGUAGE` у `@deepseek-ai/dsh-client-locale`; ідемпотентний):
   ```
   node scripts/apply-uk-core-patch.mjs
   ```
   запускати з теки `<DSH_HOME>` або зі встановленим `DSH_HOME`.
4. У `<DSH_HOME>/settings.yaml` додати `locale:\n  preference: uk` або обрати «Українська» в GUI.
5. Перезапустити веб-сервер.

Перевірка без запуску: `node <DSH_HOME>\runtime\node_modules\@deepseek-ai\dsh\lib\bin.js web --dump-config` — у списку має бути `locale-uk`.

## Обмеження

- Кілька рядків вшиті прямо в скомпільований шел (`розгорнути решту N рядків`, лічильники, банер перепідключення) — вони поза системою локалей.
- Патч ядра затирається при оновленні DSH — перезапустити `scripts/apply-uk-core-patch.mjs`.

## Розробка (`dev/`)

| Скрипт | Навіщо |
|---|---|
| `extract-locales.mjs` | витягує еталонні zh/en словники з бандлів DSH у `locales-extracted.json` |
| `build-uk-package.mjs` | зливає `uk/part-*.json`, валідує проти zh ключів і генерує `client.js` + `package.json` у корінь репо |
| `verify-uk.mjs` | перевірка повноти пакета (726 ключів/30 ns) — `RESULT: OK` |
| `scan-cjk.mjs` | CJK-рядки в бандлах, яких немає в словниках |
| `inline-cjk-audit.mjs` | оцінка, скільки UI-тексту сидить поза реєстром локалей |

Усі скрипти приймають `DSH_HOME` з env (дефолт — шлях авторської інсталяції).

Робоче середовище (профіль, плагіни, безпечний дев-цикл), на якому це розроблялось: [GrandpaUA/deepseek-harness-env](https://github.com/GrandpaUA/deepseek-harness-env).
