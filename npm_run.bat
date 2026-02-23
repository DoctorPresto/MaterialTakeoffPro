@echo off
SET PORT=5173
SET URL=http://localhost:%PORT%

echo Starting npm development server...

:: Start the npm process in a new minimized window or the same one
:: Use 'start' to run them concurrently
start "" npm run dev

echo Waiting for server to initialize at %URL%...
:: Wait for 5 seconds
timeout /t 5 /nobreak > nul

echo Opening browser...
start %URL%

exit