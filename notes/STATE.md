# DSH addons — стан робіт (оновлюється після кожного завдання)

## Інсталяція
- DSH_HOME = `C:\All\Project\Vibecode\DeepSeek Harness`
- Сервер: `dsh-web.cmd` → http://127.0.0.1:3080 (зараз PID 10864, старт 02:00, усі плагіни наживо)
- Репо: локальний git у DSH_HOME + GitHub `GrandpaUA/deepseek-harness-addons` (public), гілка main

## Виконано
1. **Українська локаль**: патч ядра (`scripts/apply-uk-core-patch.mjs`, 4 заміни в `dsh-client-locale`) + плагін `profiles/web/local/dsh-locale-uk` (726 ключів/30 ns, перевірка `notes/verify-uk.mjs`) + рядок locale-uk у `profiles/web/cordis.patch.yml`. `locale.preference: uk` у settings.yaml.
2. **Workspace-захист**: плагін перенесено з node_modules у `profiles/web/local/`, pnpm-workspace.yaml `local/*`, dep `workspace:*`. pnpm доступний через corepack.
3. **Плагіни встановлено** (`dsh plugin` = `node --expose-internals runtime\...\dsh\lib\bin.js plugin --profile web add -w <pkg>`; git-депи потребують `allowBuilds` у pnpm-workspace.yaml):
   - dshmarket (маркет у Settings)
   - dsh-thinking-language (github:qingmomo233) — /thinking-language
   - dsh-session-fork — /branch
   - dsh-recall — пошук по сесіях
   - @dennisrongo/dsh-memory — /remember в ієрархію інструкцій
   - github:Buyi-wsgzg/dsh-sidechain — /side /btw
   - Усі 6 + locale-uk підтверджені в --dump-config і boot-маніфесті.

## Черга завдань
- [ ] Пояснити і поставити dsh-checkpoint-diff (/diff /rollback)
- [ ] Пояснити і поставити ultra-slash (/steer /new /skill /docs)
- [ ] Організація репо для наших майбутніх патчів
- Коміт: git add -A; commit; push (push stderr у pwsh = нормально, дивитись на `main -> main`)

## Нюанси
- grep/glob інструменти зламані → пошук через pwsh `Select-String`
- web_search без API-ключа → пошук через Invoke-RestMethod (GitHub API, npm registry)
- /compact не викликається агентом; стиснення = авто-чекпоінти харнесу + цей файл
- git у pwsh: push пише в stderr → NativeCommandError, це не помилка
