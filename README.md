# DeepSeek Harness — доповнення

Доповнення для [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) (DSH), зібрані в нашій інсталяції так, щоб їх можна було перенести на будь-яку іншу.

## Що тут є

### 🇺🇦 Українська мова інтерфейсу (`uk`)
Повний переклад веб-інтерфейсу DSH: 30 просторів назв, 726 ключів.

| Частина | Де лежить | Навіщо |
|---|---|---|
| Клієнтський плагін зі словниками | `profiles/web/node_modules/@local/dsh-locale-uk/` | Реєструє uk-словники в системі локалей |
| Рядок у композиції | `profiles/web/cordis.patch.yml` | Вмикає плагін у веб-профілі |
| Патч ядра | `scripts/apply-uk-core-patch.mjs` | Додає `uk` до `LOCALE_IDS`/`LOCALES`/`DOCUMENT_LANGUAGE` у `@deepseek-ai/dsh-client-locale`, щоб налаштування приймали нову мову |

## Встановлення на іншій інсталяції DSH

1. Скопіювати теку `profiles/web/node_modules/@local/dsh-locale-uk/` у `профіль/` цільової інсталяції (шлях: `<DSH_HOME>/profiles/web/node_modules/@local/dsh-locale-uk/`).
2. Додати в `<DSH_HOME>/profiles/web/cordis.patch.yml` (файл може не існувати — створити):
   ```yaml
   - insert:
       - id: locale-uk
         name: '@local/dsh-locale-uk'
   ```
   Якщо файл уже містить список — просто додати цей елемент у наявний масив.
3. Застосувати патч ядра:
   ```
   node scripts/apply-uk-core-patch.mjs
   ```
   (шляхи в скрипті відносні до кореня репозиторію; скрипт ідемпотентний)
4. У `<DSH_HOME>/settings.yaml` додати:
   ```yaml
   locale:
     preference: uk
   ```
   або обрати «Українська» в GUI: Налаштування → Загальні → Мова.
5. Перезапустити веб-сервер DSH.

Перевірка без запуску: `node runtime\node_modules\@deepseek-ai\dsh\lib\bin.js web --dump-config` — у списку має бути рядок `locale-uk`.

## Обмеження

- Більшість тексту інтерфейсу проходить через систему локалей і перекладена повністю. Кілька рядків вшиті прямо в скомпільований шел (`розгорнути решту N рядків`, лічильники виводу/дифів, банер перепідключення) — вони поза системою локалей.
- Правки в `runtime/node_modules` затираються при оновленні пакетів DSH — після оновлення просто перезапустити `scripts/apply-uk-core-patch.mjs`.

## Матеріали для розробки (`notes/`)

- `dsh-extension-mechanisms.md` — як у DSH влаштовані плагіни, локалі, композиція профілів.
- `locales-extracted.json` — усі zh/en словники, витягнуті з клієнтських бандлів (еталон ключів).
- `uk/part-01..04.json` — вихідні українські переклади.
- `extract-locales.mjs` / `build-uk-package.mjs` — скрипти видобутку і збірки пакета.
- `verify-uk.mjs` — перевірка повноти перекладу: `node notes/verify-uk.mjs` (має видати `RESULT: OK`, 726 ключів).
