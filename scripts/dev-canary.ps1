# dev-canary.ps1 — перевірити, що поточна конфігурація web-профілю стартує, НЕ чіпаючи основний сервер (3080).
# Використання: pwsh -File scripts\dev-canary.ps1 [-Port 3099] [-TimeoutSec 90]
param(
    [int]$Port = 3099,
    [int]$TimeoutSec = 90
)
$ErrorActionPreference = 'Stop'
$dshHome = Split-Path $PSScriptRoot -Parent
$bin = Join-Path $dshHome 'runtime\node_modules\@deepseek-ai\dsh\lib\bin.js'
$log = Join-Path $env:TEMP "dsh-canary-$Port.log"

function Fail($msg) {
    Write-Host "CANARY FAIL: $msg" -ForegroundColor Red
    if (Test-Path $log) { Write-Host '--- останні рядки логу ---'; Get-Content $log -Tail 25 }
    exit 1
}

# 0) порт має бути вільний
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Fail "порт $Port уже зайнятий"
}

# 1) перевірка композиції без старту
Write-Host '[1/3] dump-config...'
$env:DSH_HOME = $dshHome
$ErrorActionPreference = 'Continue'
& node --expose-internals $bin --profile web --dump-config *> $log
$ErrorActionPreference = 'Stop'
if ($LASTEXITCODE -ne 0) { Fail 'композиція не валідна' }

# 2) канарка-старт
Write-Host "[2/3] канарка на порті $Port (таймаут $TimeoutSec с)..."
$proc = Start-Process node -ArgumentList @('--expose-internals', "`"$bin`"", 'web', '--no-open', '--port', "$Port") `
    -WorkingDirectory $dshHome -RedirectStandardOutput $log -RedirectStandardError "$log.err" `
    -PassThru -WindowStyle Hidden

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$healthy = $false
while ((Get-Date) -lt $deadline) {
    if ($proc.HasExited) { Fail "канарка впала (exit $($proc.ExitCode))" }
    Start-Sleep -Milliseconds 700
    $listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($listening) {
        try {
            $r = Invoke-WebRequest "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { $healthy = $true; break }
        } catch { }
    }
}

# 3) прибрати канарку
if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
if (-not $healthy) { Fail "не дочекались listen+HTTP 200 за $TimeoutSec с" }
Write-Host '[3/3] OK' -ForegroundColor Green
Write-Host "CANARY PASS: конфігурація стартує і віддає HTTP 200 (канарку вбито, основний сервер не чіпався)"
exit 0
