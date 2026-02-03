@echo off
echo Iniciando bot...
:loop
node index.js
echo El bot se cayó. Reiniciando...
timeout /t 5
goto loop
