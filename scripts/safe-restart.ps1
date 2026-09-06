# safe-restart.ps1 — безпечно перезапустити основний web-сервер (3080) з новою конфігурацією.
# Гарантії: (1) канарка перевіряє старт ДО вбивства основного сервера; (2) якщо новий сервер
# не піднімається — авто-відкат конфігів через git і старт старої версії; (3) скрипт жити
# окремим процесом, тож смерть сервера його не зупиняє.
# Використання (з сесії — ВАЖЛИВО: запускати через WMI, бо Start-Process із тул-виклика
# вбивається разом із завершенням виклику):
#   Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
#     CommandLine = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<DSH_HOME>\scripts\safe-restart.ps1"';
#     CurrentDirectory = '<DSH_HOME>' }
# Результат завжди пишеться в notes\last-restart.log
param(
    [int]$Port = 3080,
    [int]$TimeoutSec = 90,
    [switch]$SkipCanary
)
$ErrorActionPreference = 'Continue'
$dshHome = Split-Path $PSScriptRoot -Parent
$logFile = Join-Path $dshHome 'notes\last-restart.log'
"=== safe-restart $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Set-Content $logFile

function Log($msg) {
    Add-Content $logFile $msg
    Write-Host $msg
}
function HealthOk {
    param([int]$P, [int]$Wait)
    $deadline = (Get-Date).AddSeconds($Wait)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 700
        if (-not (Get-NetTCPConnection -LocalPort $P -State Listen -ErrorAction SilentlyContinue)) { continue }
        try {
            $r = Invoke-WebRequest "http://127.0.0.1:$P/" -UseBasicParsing -TimeoutSec 5
            if ($r.StatusCode -eq 200) { return $true }
        } catch { }
    }
    return $false
}
function StartServer {
    $p = Start-Process (Join-Path $dshHome 'dsh-web.cmd') -ArgumentList '--no-open' `
        -WorkingDirectory $dshHome -PassThru -WindowStyle Hidden
    return $p
}

# 1) відкатна точка: git має бути чистим (усі зміни конфігів закомічені)
$dirty = git -C $dshHome status --porcelain
if ($dirty) { Log 'ABORT: git не чистий — закоміть зміни, щоб мати точку відкату'; exit 1 }

# 2) канарка
if (-not $SkipCanary) {
    Log '[1/4] канарка...'
    $canaryOut = & powershell -NoProfile -File (Join-Path $PSScriptRoot 'dev-canary.ps1') 2>&1 | Out-String
    Add-Content $logFile $canaryOut
    if ($LASTEXITCODE -ne 0) { Log 'ABORT: канарка не пройшла — основний сервер НЕ чіпався, сесія жива'; exit 1 }
    Log 'канарка PASS'
}

# 3) переключення
$oldPid = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($oldPid) { Log "[2/4] убиваю старий сервер PID $oldPid"; Stop-Process -Id $oldPid -Force -ErrorAction SilentlyContinue; Start-Sleep 2 }
Log '[3/4] стартую новий сервер...'
$newProc = StartServer

# 4) health check з авто-відкатом
if (HealthOk -P $Port -Wait $TimeoutSec) {
    Log "[4/4] OK: сервер наживо на $Port (PID $($newProc.Id))"
    Log 'RESULT: SUCCESS'
    exit 0
}
Log 'НОВИЙ СЕРВЕР НЕ ПІДНЯВСЯ — відкатую конфіги (git checkout) і стартую стару версію'
if (-not $newProc.HasExited) { Stop-Process -Id $newProc.Id -Force -ErrorAction SilentlyContinue; Start-Sleep 1 }
$gitOut = git -C $dshHome checkout -- . 2>&1 | Out-String
Add-Content $logFile $gitOut
$rollback = StartServer
if (HealthOk -P $Port -Wait $TimeoutSec) {
    Log "ВІДКАТ OK: стара конфігурація наживо на $Port (PID $($rollback.Id))"
    Log 'RESULT: ROLLED BACK — нова конфігурація зламана, див. лог вище'
    exit 2
}
Log 'RESULT: CATASTROPHIC — навіть стара конфігурація не стартує, потрібна ручна інтервенція'
exit 3
