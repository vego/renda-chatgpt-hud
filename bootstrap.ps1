# ============================================================================
# RENDA HUD - BOOTSTRAP: pune extensia pe disc si deschide Chrome.
# Acest script:
#   1. descarca arhiva ZIP a repo-ului (branch main) - fara git
#   2. o pune in D:\apps\renda-hud-chatgpt (sau %LOCALAPPDATA%\apps\... daca nu e D:)
#   3. pune calea in clipboard si deschide chrome://extensions
# Raman cei 2 pasi din browser, O SINGURA DATA (Developer mode / Load unpacked / Ctrl+V).
# Daca extensia era deja incarcata din acest folder: un Reload pe cardul ei, in fiecare browser.
# NU instaleaza niciun task Windows. Auto-update-ul vine din browser (comutatorul
# "Allow user scripts", Chrome/Edge 138+) sau rulind din nou acest instalator.
# Fisier ASCII-only (PS 5.1 fara BOM = ANSI).
# ============================================================================
$ErrorActionPreference = 'Stop'
$repoZip = 'https://github.com/virgilprofeanu/renda-chatgpt-hud/archive/refs/heads/main.zip'
$appName = 'renda-hud-chatgpt'

try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072 } catch {}

$base = 'D:\apps'
if (-not (Test-Path 'D:\')) {
  $base = Join-Path $env:LOCALAPPDATA 'apps'
  Write-Host "Unitatea D: nu exista - instalez in $base" -ForegroundColor Yellow
}
$dest = Join-Path $base $appName

$tmpZip = Join-Path $env:TEMP 'renda-hud-repo.zip'
$tmpDir = Join-Path $env:TEMP 'renda-hud-repo'
Write-Host "Descarc extensia de pe GitHub (fara git)..."
Invoke-WebRequest -Uri $repoZip -OutFile $tmpZip -UseBasicParsing -TimeoutSec 60
if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
Expand-Archive -Path $tmpZip -DestinationPath $tmpDir -Force

$src = Get-ChildItem $tmpDir -Directory | Select-Object -First 1
if (-not $src -or -not (Test-Path (Join-Path $src.FullName 'manifest.json'))) {
  Write-Host 'EROARE: repo-ul nu contine (inca) fisierele extensiei (manifest.json).' -ForegroundColor Red
  Write-Host 'Publica pachetul in GitHub (branch main), apoi ruleaza din nou.' -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item (Join-Path $src.FullName '*') $dest -Recurse -Force
Remove-Item $tmpZip, $tmpDir -Recurse -Force -ErrorAction SilentlyContinue

# curatenie: mecanismul VECHI de update (task Windows), daca acest calculator a avut
# o instalare initiala. try/catch obligatoriu: cu EAP=Stop, stderr-ul de la schtasks
# (task inexistent = cazul obisnuit) ar deveni eroare fatala in PS 5.1.
try {
  schtasks /Delete /TN 'RENDA HUD Extension AutoUpdate' /F 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { Write-Host 'Task-ul vechi de auto-update a fost sters.' -ForegroundColor Yellow }
} catch {}

try { Set-Clipboard -Value $dest } catch {}
$chromeOk = $false
try { Start-Process 'chrome' 'chrome://extensions/'; $chromeOk = $true } catch {}

Write-Host ""
Write-Host "Extensia e in: $dest" -ForegroundColor Green
Write-Host "Calea e in CLIPBOARD (Ctrl+V la 'Load unpacked')." -ForegroundColor Green
if ($chromeOk) { Write-Host "Am deschis chrome://extensions." -ForegroundColor Green } else { Write-Host "Deschide manual chrome://extensions" -ForegroundColor Yellow }
Write-Host ""
Write-Host "MAI AI DE FACUT IN CHROME (o singura data):" -ForegroundColor Cyan
Write-Host "  1. Porneste 'Developer mode' (dreapta-sus)"
Write-Host "  2. 'Load unpacked' -> Ctrl+V in bara de cale -> Enter -> Select Folder"
Write-Host "  (gata - HUD-ul merge fara alte setari; la fel in Edge: edge://extensions)"
Write-Host "  Daca extensia era DEJA incarcata din acest folder: sari peste cei 2 pasi si apasa"
Write-Host "  Reload pe cardul ei, in fiecare browser (Chrome si Edge)."
Write-Host ""
Write-Host "OPTIONAL - actualizare automata: porneste 'Allow user scripts' pe cardul extensiei"
Write-Host "  (Chrome/Edge 138+). Fara el, versiunile noi vin rulind din nou acest instalator."
Write-Host ""
Write-Host "Apoi deschide https://chatgpt.com - banda HUD apare sus."
Write-Host "Daca folosesti userscript-ul in Tampermonkey: DEZACTIVEAZA-L (altfel HUD dublu)."
