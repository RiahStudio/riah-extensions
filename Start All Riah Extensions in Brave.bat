@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "DIST=%CD%\extension-source\dist\chrome"
set "PROFILE=%LOCALAPPDATA%\Riah Extensions\Brave Profile"
set "BRAVE="

if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BRAVE=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined BRAVE if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BRAVE=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
if not defined BRAVE if exist "%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe" set "BRAVE=%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe"

if not defined BRAVE (
  echo [ERROR] Brave Browser was not found.
  echo Install Brave or update the BRAVE paths in this launcher.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Node.js is required to build the extensions.
  pause
  exit /b 1
)

echo Building the current Riah extension packages...
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] The extension build failed. Brave was not opened.
  pause
  exit /b 1
)

set "EXTENSION_PATHS="
set /a EXTENSION_COUNT=0

for /d %%D in ("%DIST%\*") do (
  if exist "%%~fD\manifest.json" (
    if defined EXTENSION_PATHS (
      set "EXTENSION_PATHS=!EXTENSION_PATHS!,%%~fD"
    ) else (
      set "EXTENSION_PATHS=%%~fD"
    )
    set /a EXTENSION_COUNT+=1
  )
)

if !EXTENSION_COUNT! EQU 0 (
  echo [ERROR] No loadable Chromium extensions were found in:
  echo %DIST%
  pause
  exit /b 1
)

if /I "%~1"=="--check" (
  echo.
  echo Ready: !EXTENSION_COUNT! Riah extensions found.
  echo Brave: %BRAVE%
  echo Profile: %PROFILE%
  exit /b 0
)

echo Opening !EXTENSION_COUNT! Riah extensions in a dedicated Brave profile...
start "" "%BRAVE%" "--user-data-dir=%PROFILE%" "--load-extension=!EXTENSION_PATHS!" --no-first-run --no-default-browser-check --new-window "brave://extensions/"

if errorlevel 1 (
  echo [ERROR] Brave could not be started.
  pause
  exit /b 1
)

exit /b 0
