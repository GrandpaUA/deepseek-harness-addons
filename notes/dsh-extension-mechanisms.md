# DSH — механізми плагінів і доповнень (дослідження)

> Досліджено на встановленому деплойменті `@deepseek-ai/dsh@0.1.0-rc.7`
> (`runtime\node_modules\@deepseek-ai\*`). DSH_HOME = `C:\All\Project\Vibecode\DeepSeek Harness`.

## Архітектура загалом

- Усе в DSH — це **плагіни Cordis** (`@deepseek-ai/cordis`), організовані як **рядки (rows)**
  в композиції `cordis.yml`. Рядок = `{ id, name, config, disabled?, inject? }`,
  де `name` — модульний специфікатор npm-пакета з плагіном.
- Профіль (`$DSH_HOME/profiles/<name>`) — це **порожній корінь**, поверх якого
  накочуються патч-шари у фіксованому порядку (останній запис по `id` перемагає):
  1. бандли з `dsh.profile.bundles` (у порядку списку),
  2. `profiles/<name>/cordis.patch.yml` (шар профілю),
  3. `$DSH_HOME/cordis.patch.yml` (домашній шар — діє на ВСІ профілі, вищий пріоритет за профільний),
  4. оверлеї `--patch <file>`,
  5. телеметрія-вимикач (службовий).
- Патч **замінює `config` рядка цілком** (без deep-merge) — треба повторювати всі поля,
  які рядок має зберегти. Є `!!js <вираз>` — вирази, що обчислюються при активації
  (доступні `ctx`, `dshHomePath()`, `process` тощо).
- Перевірка композиції без запуску: `dsh --profile web --dump-config`
  (також `--dump-default-config`).

Поточний стан деплойменту:
- Єдиний профіль `web`: бандли `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`.
- `profiles/web/cordis.patch.yml` — порожній (`[]`); домашнього `cordis.patch.yml` ще немає;
  кастомних агентних пресетів (`$DSH_HOME/.agent-presets`) і каталогу скілів (`$DSH_HOME/skills`) ще немає.
- Запуск: `dsh-web.cmd` → `node runtime\node_modules\@deepseek-ai\dsh\lib\bin.js web`.

## Шляхи доповнення (від найлегшого до найважчого)

### 1. Скіли (Skills) — markdown, без коду і без рестарту
Файли скануються `@deepseek-ai/dsh-skill-filesystem` (hot-reload через chokidar-вотчер).
Корені (у порядку пріоритету):
| ранг | шлях |
|---|---|
| 100 | `<проєкт>/.dsh/skills` (проєкт = найближчий предок з `.git`, інакше cwd) |
| 200 | `<проєкт>/.agents/skills` |
| 300 | `customSkillDirs` (з конфіга) |
| 400 | `$DSH_HOME/skills` |
| 500 | `$DSH_AGENTS_HOME/skills` (типово `~/.agents/skills`) |

Формат: `<root>/<name>/SKILL.md` (бандл) або плоский `<root>/<name>.md`.
Frontmatter: обов'язкові `name` (kebab-case) і `description`; опційні `whenToUse`,
`metadata`, `disable-model-invocation`, `user-invocable`. Вкладені `**/SKILL.md` НЕ скануються.

### 2. Патч-шари — конфігурація без коду (перезапис/вимкнення/вставка рядків)
Редагування `profiles/web/cordis.patch.yml` (або створення `$DSH_HOME/cordis.patch.yml`).
Приклади записів (формат патч-списку):
```yaml
# вимкнути наявний рядок
- id: hmr
  disabled: true

# замінити config рядка ЦІЛКОМ (усі поля, що лишаються, повторити)
- id: session-query-sqlite
  config:
    path: ':memory:'
    openAt: first-search

# вставити нові рядки (можна з !!js-виразами)
- insert:
    - id: my-row
      name: '@scope/my-plugin'
      config:
        root: !!js dshHomePath('sessions')
```
Патч, що не знаходить цільовий `id`, попереджає і пропускається. Вотчер профільного
патч-шару активний (`watchUserPatches`), але для гарантії — рестарт `dsh web`.

### 3. Динамічні Cordis-плагіни (runtime, без файлів)
Доступні, коли сесія використовує агентний пресет **`cordis` (创造模式)** —
він монтує `dsh-tool-cordis` (рядки `tool-cordis` в `config/agent-presets/cordis/agent.cordis.yml`).
Інструменти: `cordis_inspect_list`, `cordis_inspect_query`, `cordis_inspect_self`,
`cordis_define`, `cordis_run`, `cordis_stop`, `cordis_undefine`, `cordis_mount`/`cordis_unmount`.
- Код — чисті JS-тіла функцій (`code.host` і/або `code.client`), що повертають
  плагін `{ apply(ctx) {...} }`; без import/require/TS/JSX.
- Host: сервіси, події, динамічні модел-тули (`harness`), файли/процеси.
- Client: UI через **слоти** (`ctx.get('slots')` → `slots.inject/register`),
  лише `React.createElement(...)`; теми через `theme`-сервіс; хост↔клієнт —
  `harness.handle(method)` / `host.call(method)`.
- Тимчасові й процес-локальні (зникають з процесом), активація клієнтської частини
  потребує схвалення користувача в GUI.
- Документація: вбудований скіл `cordis-plugin-development/SKILL.md`
  (у каталозі пресета `cordis`, монтується разом із ним).

### 4. Власні агентні пресети (композиція однієї сесії)
Пресет = каталог з `agent.cordis.yml` (+ `preset.yml` з `name`/`description`).
- Вбудовані (лише для читання!): `config/agent-presets/{standard,code,minimal,cordis}`
  деплойменту. Їх редагувати/перезаписувати заборонено політикою скіла
  `editing-cordis-compositions` — тільки копіювати.
- Користувацькі: `$DSH_HOME/.agent-presets/<id>/` (id: `[a-z0-9][a-z0-9-]*`).
- Ключове правило: рядок у пресеті, що ПУБЛІКУЄ сервіс, мусить бути в групі
  `cordis:group` з `isolate`-realm; рядки, що лише споживають хостові сервіси,
  залишаються поза realm. Перевірка: `agentPresets.standingKeyFor(id)`.
- Типовий пресет сесій: `standard` (`default: standard` у рядку `agent-presets`).

### 5. Бандл-пакети (npm-плагіни профілю) — повноцінні плагіни з кодом
Пакет-бандл декларує в `package.json`:
```json
"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
```
і постачає сам `cordis.patch.yml` (insert-рядки з плагінами, приклади —
`dsh-base/cordis.patch.yml`, `dsh-web-app/cordis.patch.yml`).

Встановлення:
```
dsh plugin --profile web add <назва-пакета|шлях|git-url>
```
Це форвардить аргументи в `pnpm` у каталозі профілю, а потім автоматично
додає пакет до `dsh.profile.bundles` у `profiles/web/package.json`, якщо він
декларує `dsh.bundle` (і прибирає, якщо залежність видалена). Відносні шляхи
(`.`, `../plugin`, `file:`, `link:`) прив'язуються до каталогу запуску `dsh`.

⚠️ **У цій системі ще немає `pnpm`** — `dsh plugin` без нього не працює
(повертає 127). Встановити: `npm i -g pnpm` або `corepack enable pnpm` (Node v24 уже є).

### 6. Клієнтські (браузерні) плагіни
Рядки з прапорцем `dsh.client` (у патчах — напр. усі `ui-*` рядки `dsh-web-app`):
node-половина сканує їх у `window.__DSH_BOOT__` і віддає бандли за
`/plugins/<id>/client.js`; браузерна половина — модуль у клієнтському Loader.
HMR-приймач (`dsh-client-hmr`) активний завжди, але автоперезавантаження без
перезапуску працює лише коли запущений вотчер збірки `pnpm run dev:web` із
джерельного checkout (цього деплойменту це стосується лише за наявності сирців).

## GUI-поверхня для плагінів
- Налаштування → сторінка інвентарю плагінів (`dsh-host-plugin-inventory` →
  `dsh-client-ui-settings-plugin-inventory`): read-only список рядків Loader
  (id, модуль, увімкненість, фаза) — без керування.
- `dsh-client-ui-settings-plugins`: секції налаштувань плагінів хоста, якими володіє користувач.

## Що НЕ є активним шляхом у цьому деплойменті
- `dsh-mcp-client` присутній у залежностях `dsh`, але жоден профіль/пресет
  (`web`, `standard`) його зараз не монтує — рядків `mcp` у композиціях немає.
- Профілі `headless`/інші: шаблони є (`PROFILE_TEMPLATES`), але створюються
  лише через `dsh plugin --profile <name>`.

## Корисні команди
| дія | команда |
|---|---|
| переглянути композицію без запуску | `node runtime\node_modules\@deepseek-ai\dsh\lib\bin.js --profile web --dump-config` |
| додати пакет-плагін у профіль | `node runtime\node_modules\@deepseek-ai\dsh\lib\bin.js plugin --profile web add <пакет>` |
| help лаунчера | `node runtime\node_modules\@deepseek-ai\dsh\lib\bin.js --help` |
| help веб-застосунку | `node runtime\node_modules\@deepseek-ai\dsh\lib\bin.js --profile web --help` |

## Ключові файли
- `runtime\node_modules\@deepseek-ai\dsh\lib\plugin-9h8shc4d.js` — логіка `dsh plugin`
- `runtime\node_modules\@deepseek-ai\dsh\lib\profile-boot-DG5t9aNs.js` — композиція профілю (`composeProfile`)
- `runtime\node_modules\@deepseek-ai\dsh-base\cordis.patch.yml` — базовий шар (451 рядок)
- `runtime\node_modules\@deepseek-ai\dsh-web-app\cordis.patch.yml` — веб-шар
- `runtime\node_modules\@deepseek-ai\dsh\config\agent-presets\cordis\skills\cordis-plugin-development\SKILL.md`
- `runtime\node_modules\@deepseek-ai\dsh\config\agent-presets\cordis\skills\editing-cordis-compositions\SKILL.md`
- `profiles\web\package.json` / `profiles\web\cordis.patch.yml`
