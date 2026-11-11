#!/bin/bash
# mac-service.sh — deja la galería corriendo sola en una Mac (launchd).
#
#   npm run mac:install     instala y arranca el servicio (y el respaldo diario de las 4:00)
#   npm run mac:restart     reinicia el sitio (después de actualizar o de cambiar .env)
#   npm run mac:status      dice si está corriendo
#   npm run mac:logs        muestra las últimas líneas del registro
#   npm run mac:stop        lo detiene (vuelve a arrancar al reiniciar la Mac)
#   npm run mac:uninstall   quita el servicio (no borra tus datos)
#
# El servicio arranca al encender la Mac, sin necesidad de iniciar sesión, y se
# levanta solo si se cae. Pide tu contraseña de administrador (sudo).
set -euo pipefail

LABEL="art.galeria.server"
BACKUP_LABEL="art.galeria.backup"
PLIST="/Library/LaunchDaemons/$LABEL.plist"
BACKUP_PLIST="/Library/LaunchDaemons/$BACKUP_LABEL.plist"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/Library/Logs/galeria"
RUN_USER="$(id -un)"

if [ "$(uname)" != "Darwin" ]; then echo "Este comando es solo para macOS."; exit 1; fi

write_plists() {
  local node; node="$(command -v node || true)"
  if [ -z "$node" ]; then echo "No encuentro 'node'. Instala Node.js (paso 3 de docs/DEPLOY.md)."; exit 1; fi
  if [ ! -f "$REPO/.env" ]; then echo "Falta el archivo .env en $REPO (paso 5 de docs/DEPLOY.md)."; exit 1; fi
  if [ ! -d "$REPO/node_modules" ]; then echo "Faltan las dependencias. Corre primero: npm ci"; exit 1; fi
  mkdir -p "$LOG_DIR"
  local tmp; tmp="$(mktemp -d)"

  cat > "$tmp/server.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>UserName</key><string>$RUN_USER</string>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>ProgramArguments</key>
  <array>
    <string>$node</string>
    <string>--env-file=$REPO/.env</string>
    <string>$REPO/src/server.js</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/server.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/server.log</string>
</dict>
</plist>
PLIST

  cat > "$tmp/backup.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$BACKUP_LABEL</string>
  <key>UserName</key><string>$RUN_USER</string>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>ProgramArguments</key>
  <array>
    <string>$node</string>
    <string>--env-file=$REPO/.env</string>
    <string>$REPO/tools/backup.js</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>4</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$LOG_DIR/backup.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/backup.log</string>
</dict>
</plist>
PLIST

  sudo install -m 644 -o root -g wheel "$tmp/server.plist" "$PLIST"
  sudo install -m 644 -o root -g wheel "$tmp/backup.plist" "$BACKUP_PLIST"
  rm -rf "$tmp"
}

unload() {
  sudo launchctl bootout "system/$LABEL" 2>/dev/null || true
  sudo launchctl bootout "system/$BACKUP_LABEL" 2>/dev/null || true
}

case "${1:-}" in
  install)
    unload
    write_plists
    sudo launchctl bootstrap system "$PLIST"
    sudo launchctl bootstrap system "$BACKUP_PLIST"
    sleep 3
    port="$(grep -E '^PORT=' "$REPO/.env" | tail -1 | cut -d= -f2 | tr -d '"' || true)"; port="${port:-3000}"
    if curl -fsS "http://127.0.0.1:$port/healthz" >/dev/null 2>&1; then
      echo "Listo: la galería está corriendo en http://localhost:$port y arrancará sola al encender la Mac."
      echo "Respaldo automático: todos los días a las 4:00."
    else
      echo "El servicio se instaló pero el sitio no responde todavía. Revisa el registro:"
      echo "  npm run mac:logs"
      exit 1
    fi
    ;;
  restart)
    sudo launchctl kickstart -k "system/$LABEL"
    echo "Reiniciado."
    ;;
  stop)
    sudo launchctl bootout "system/$LABEL" 2>/dev/null || true
    echo "Detenido. Para volver a arrancarlo: npm run mac:install"
    ;;
  status)
    if sudo launchctl print "system/$LABEL" 2>/dev/null | grep -q "state = running"; then echo "La galería está corriendo."; else echo "La galería NO está corriendo."; fi
    ;;
  logs)
    tail -n 60 "$LOG_DIR/server.log" 2>/dev/null || echo "Todavía no hay registro en $LOG_DIR/server.log"
    ;;
  uninstall)
    unload
    sudo rm -f "$PLIST" "$BACKUP_PLIST"
    echo "Servicio quitado. Tus datos y tu configuración no se tocaron."
    ;;
  *)
    echo "Uso: npm run mac:install | mac:restart | mac:status | mac:logs | mac:stop | mac:uninstall"
    exit 1
    ;;
esac
