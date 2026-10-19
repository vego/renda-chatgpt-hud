@echo off
REM ===========================================================================
REM RENDA HUD - instalare DIRECT DE PE GITHUB, dintr-un singur fisier.
REM Acesta e SINGURUL fisier pe care trebuie sa-l primeasca un coleg
REM (pe mail/chat). Dublu-click si:
REM   - descarca tot repo-ul (fara git) in D:\apps\renda-hud-chatgpt
REM   - NU instaleaza niciun task Windows
REM   - deschide Chrome pe pagina de extensii, cu calea deja in clipboard
REM Raman doar cei 3 pasi din Chrome, afisati pe ecran.
REM ===========================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; $t = Join-Path $env:TEMP 'renda-hud-bootstrap.ps1'; Invoke-WebRequest 'https://raw.githubusercontent.com/virgilprofeanu/renda-chatgpt-hud/main/bootstrap.ps1' -OutFile $t -UseBasicParsing; & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $t"
echo.
pause
