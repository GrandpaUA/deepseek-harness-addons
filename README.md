# DeepSeek Harness — доповнення

Доповнення для [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) (DSH), зібрані в нашій інсталяції так, щоб їх можна було перенести на будь-яку іншу.

## Структура репо

```
plugins/            — НАШІ власні доповнення (кожен = окрема тека-пакет)
  dsh-locale-uk/    — українська мова інтерфейсу (перший і поки єдиний)
scripts/            — інструменти: патчер ядра, канарка, безпечний рестарт
profiles/web/       — конфігурація веб-профілю (package.json, pnpm-workspace.yaml,
                      cordis.patch.yml — усе під git, це точка відкату)
notes/              — робочі матеріали, STATE.md (якір стану розробки)
```

**Конвенція для наших майбутніх доповнень:** кожен аддон — тека в `plugins/` з `package.json` (ім'я `@local/<назва>`), `index.js` (серверна частина) і за потреби `client.js` (клієнтський бандл у обгортці `__ModuleLoader__`). Підключення автоматичне: `profiles/web/pnpm-workspace.yaml` уже містить `../../plugins/*`; лишається додати залежність `"@local/<назва>": "workspace:*"` у `profiles/web/package.json` і рядок у `cordis.patch.yml` (або декларацію `dsh.bundle.patch` у самому пакеті — тоді підхопиться само).

## 🇺🇦 Українська мова інтерфейсу (`uk`)

Повний переклад веб-інтерфейсу DSH: 30 просторів назв, 726 ключів.

| Частина | Де лежить | Навіщо |
|---|---|---|
| Клієнтський плагін зі словниками | `plugins/dsh-locale-uk/` | Реєструє uk-словники в системі локалей |
| Рядок у композиції | `profiles/web/cordis.patch.yml` | Вмикає плагін у веб-профілі |
| Патч ядра | `scripts/apply-uk-core-patch.mjs` | Додає `uk` до `LOCALE_IDS`/`LOCALES`/`DOCUMENT_LANGUAGE` у `@deepseek-ai/dsh-client-locale` |

### Встановлення на іншій інсталяції DSH

1. Скопіювати `plugins/dsh-locale-uk/` у цільову інсталяцію й підключити як workspace-пакет (у нашій: glob `../../plugins/*` у `profiles/web/pnpm-workspace.yaml` + dep `workspace:*` + `pnpm install`).
2. Додати в `<DSH_HOME>/profiles/web/cordis.patch.yml` (файл може не існувати — створити):
   ```yaml
   - insert:
       - id: locale-uk
         name: '@local/dsh-locale-uk'
   ```
3. Застосувати патч ядра: `node scripts/apply-uk-core-patch.mjs` (ідемпотентний).
4. У `<DSH_HOME>/settings.yaml` додати `locale:\n  preference: uk` або обрати «Українська» в GUI.
5. Перезапустити веб-сервер.

Перевірка без запуску: `node runtime\node_modules\@deepseek-ai\dsh\lib\bin.js web --dump-config` — у списку має бути `locale-uk`.

## Сторонні плагіни (встановлені в нашій інсталяції)

Ставляться через `dsh plugin --profile web add -w <пакет>` (потрібен pnpm — `corepack enable`):

| Плагін | Дає |
|---|---|
| dshmarket | маркет плагінів у Налаштуваннях |
| dsh-thinking-language | `/thinking-language` — мова думок моделі |
| dsh-session-fork | `/branch` — гілкування сесій |
| dsh-recall | пошук по минулих сесіях |
| @dennisrongo/dsh-memory | `/remember` — факти в ієрархію інструкцій (AGENTS.md) |
| github:Buyi-wsgzg/dsh-sidechain | `/side`, `/btw` — побічні сесії (git-деп, потребує `allowBuilds`) |
| dsh-checkpoint-rewind + dsh-checkpoint-diff | знімки змін воркспейсу, кнопка Diff, `/diff`, `/rollback` |
| deepseek-harness-ultra-slash | `/steer` (вказівка агенту на льоту), `/new`, `/skill`, `/docs` |

## Безпечний дев-цикл (ми працюємо всередині самого DSH)

Зміни конфігів не впливають на запущений сервер — композиція фіксується при старті. Тому:

1. **Розробка** — спокійно змінюємо конфіги/плагіни, сесія не дропає.
2. **Канарка** — `scripts\dev-canary.ps1`: dump-config + тестовий старт на 3099; основний сервер (3080) не чіпає. Не пройшла — сесія жива, правимо далі.
3. **Переключення** — `scripts\safe-restart.ps1` (лише після CANARY PASS): git clean → канарка → kill 3080 → старт → health-check; якщо не стартує — авто-відкат `git checkout -- .` і підйом старої конфігурації. Лог: `notes/last-restart.log`. Перерва сесії ~17 с, потім F5.
   Запуск **тільки через WMI** (відокремлений процес):
   ```powershell
   Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
     CommandLine = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<DSH_HOME>\scripts\safe-restart.ps1"';
     CurrentDirectory = '<DSH_HOME>' }
   ```

## Обмеження

- Кілька рядків вшиті прямо в скомпільований шел (`розгорнути решту N рядків`, лічильники, банер перепідключення) — вони поза системою локалей.
- Правки в `runtime/node_modules` затираються при оновленні DSH — перезапустити `scripts/apply-uk-core-patch.mjs`.

## Матеріали для розробки (`notes/`)

- `STATE.md` — поточний стан робіт (якір після стиснень контексту).
- `dsh-extension-mechanisms.md` — як у DSH влаштовані плагіни, локалі, композиція.
- `locales-extracted.json` — еталон ключів (zh/en словники з бандлів).
- `uk/part-01..04.json` — вихідні переклади; `verify-uk.mjs` — перевірка повноти (`RESULT: OK`, 726 ключів).
