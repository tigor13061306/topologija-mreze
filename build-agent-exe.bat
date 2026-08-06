@echo off
chcp 65001 >nul
title Build agent.exe
cd /d "%~dp0"
echo ============================================================
echo   Pravljenje agent.exe iz agent.py  (treba Python + internet)
echo ============================================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
  echo [GRESKA] Python nije pronadjen. Instaliraj Python 3 pa ponovo.
  pause & exit /b 1
)

echo Instaliram alate (jednokratno)...
python -m pip install --disable-pip-version-check fastapi uvicorn icmplib pyinstaller

echo.
echo Gradim agent.exe ...
python -m PyInstaller --onefile --name agent --noconfirm --clean ^
  --collect-all uvicorn --collect-all fastapi --collect-all starlette ^
  --hidden-import anyio --hidden-import sniffio --hidden-import h11 ^
  --hidden-import click --hidden-import icmplib ^
  --distpath . --workpath "%TEMP%\topo_pybuild" --specpath "%TEMP%\topo_pybuild" ^
  agent.py

echo.
if exist "agent.exe" (
  echo GOTOVO: agent.exe je napravljen u ovom folderu.
) else (
  echo [GRESKA] agent.exe nije napravljen — provjeri poruke iznad.
)
pause
