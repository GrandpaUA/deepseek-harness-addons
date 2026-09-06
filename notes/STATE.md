# DSH addons — стан робіт (оновлюється після кожного завдання)

## Інсталяція
- DSH_HOME = `C:\All\Project\Vibecode\DeepSeek Harness`
- Сервер: `dsh-web.cmd` → http://127.0.0.1:3080 (PID 30368, старт 09:35, усі плагіни наживо)
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
   - dsh-checkpoint-rewind + dsh-checkpoint-diff — знімки змін, /diff /rollback (пояснено, поставлено)
   - Усі 8 + locale-uk підтверджені в --dump-config і boot-маніфесті.

## Черга завдань
- [ ] Пояснити і поставити ultra-slash (/steer /new /skill /docs) — юзеру пояснено, чекає рішення
- [ ] Організація репо для наших майбутніх патчів
- [ ] Бойовий тест safe-restart (перерве сесію на лічені секунди — за командою юзера)

## Безпечний дев-цикл (проти дропу сесії)
- Зміни конфігів/плагінів НЕ впливають на запущений сервер (композиція фіксується на boot)
- `scripts/dev-canary.ps1` — перевірка нової конфігурації на порті 3099, основний сервер (3080) не чіпається; тест пройдено (CANARY PASS)
- `scripts/safe-restart.ps1` — переключення: git clean → канарка → kill 3080 → старт → health-check → авто-відкат `git checkout -- .` якщо не стартує; лог у `notes/last-restart.log`; запускати відокремлено: `Start-Process powershell -ArgumentList '-NoProfile','-File','scripts\safe-restart.ps1' -WorkingDirectory <DSH_HOME> -WindowStyle Hidden`
- Сесії персистують на диску (sessions/, storages/) — після рестарту GUI відновлює сесію
- УВАГА: тулзи працюють у Windows PowerShell 5.1 (не pwsh 7); скрипти з BOM
- Коміт: git add -A; commit; push (push stderr у pwsh = нормально, дивитись на `main -> main`)

## Нюанси
- grep/glob інструменти зламані → пошук через pwsh `Select-String`
- web_search без API-ключа → пошук через Invoke-RestMethod (GitHub API, npm registry)
- /compact не викликається агентом; стиснення = авто-чекпоінти харнесу + цей файл
- git у pwsh: push пише в stderr → NativeCommandError, це не помилка
