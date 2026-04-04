@echo off
cd /d "%~dp0"
echo Personae: freeing ports 3000 and 9230, then client + server...
echo Use: npm run dev from this folder (not: npm run dev -w^)
npm run dev
pause
