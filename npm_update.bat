@echo off
echo Updating Project Dependencies...

:: Install dependencies and wait for completion
call npm install

:: Clear vite cache
if exist "node_modules\.vite" (
    echo Clearing cache...
    rd /s /q "node_modules\.vite"
)

echo Update Complete.
pause
exit