@echo off
setlocal

rem Run from this file's directory so double-clicking works from any cwd.
set "LAUNCHER_DIR=%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER_DIR%Start-LuxeGlow.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
    echo.
    echo LuxeGlow did not start. Review the error above.
    pause
)

endlocal & exit /b %EXIT_CODE%
