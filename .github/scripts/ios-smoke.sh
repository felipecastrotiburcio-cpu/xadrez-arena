#!/usr/bin/env bash
# Teste do app no simulador de iPhone: instala, abre, navega por links internos
# (xadrezarena://...) e confere que o app continua aberto e sem relatórios de travamento.
# Uso: ios-smoke.sh <XadrezArena.app> <pasta de saída>
set -u
APP="$1"
OUT="$2"
BUNDLE=app.xadrezarena
mkdir -p "$OUT"
REPORT="$OUT/report.txt"
: > "$REPORT"
FAILED=0
log() { echo "$*" | tee -a "$REPORT"; }
ok() { log "✅ $*"; }
fail() { log "❌ $*"; FAILED=1; }

UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devs = json.load(sys.stdin)["devices"]
best = None
for runtime, items in devs.items():
    if "iOS" not in runtime:
        continue
    for d in items:
        if d["name"].startswith("iPhone") and "Pro" in d["name"] and "Max" not in d["name"]:
            best = (runtime, d["udid"], d["name"])
print(best[1] if best else "")')
if [ -z "$UDID" ]; then
  UDID=$(xcrun simctl list devices available | grep -m1 -oE "iPhone[^(]*\(([0-9A-F-]{36})\)" | grep -oE "[0-9A-F-]{36}")
fi
NAME=$(xcrun simctl list devices | grep "$UDID" | sed -E 's/^ *//; s/ \(.*//')
RUNTIME=$(xcrun simctl list devices -j | python3 -c "
import json,sys
for r,items in json.load(sys.stdin)['devices'].items():
    for d in items:
        if d['udid']=='$UDID': print(r.split('.')[-1])")
log "Simulador: $NAME ($RUNTIME)"

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b > /dev/null
sleep 5
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" > /dev/null 2>&1; }
alive() { xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -q "UIKitApplication:$BUNDLE"; }

if xcrun simctl install "$UDID" "$APP"; then ok "App instalado no simulador"; else fail "Falha ao instalar"; exit 1; fi
START=$(date +%s)
if xcrun simctl launch "$UDID" "$BUNDLE" > /dev/null; then ok "App aberto"; else fail "Falha ao abrir o app"; fi
sleep 20
shot 01-inicio
if alive; then ok "App continua aberto após 20 s (tela inicial)"; else fail "App fechou ao abrir"; fi

visit() { # visit <link> <nome do print> <descrição>
  xcrun simctl openurl "$UDID" "$1" > /dev/null 2>&1
  sleep 8
  shot "$2"
  if alive; then ok "$3"; else fail "App fechou ao abrir: $3"; fi
}
visit "xadrezarena://ai" 02-escolher-ia "Tela de escolha da IA (níveis, cor e tempo)"
visit "xadrezarena://ai/play?level=1&color=w&time=5" 03-partida-5min "Partida contra a IA com relógio de 5 min"
visit "xadrezarena://ai/play?level=2&color=b" 04-partida-pretas "Partida com as pretas (a IA joga primeiro)"
sleep 4
shot 05-ia-jogou
visit "xadrezarena://login" 06-login "Tela de login / criar conta"
visit "xadrezarena://shop" 07-loja "Loja"
visit "xadrezarena://settings" 08-configuracoes "Configurações (som)"
visit "xadrezarena://leaderboard" 09-ranking "Ranking"

# Relatórios de travamento gerados desde o início do teste
CRASHES=$(find "$HOME/Library/Logs/DiagnosticReports" -newermt "@$START" \( -iname "*XadrezArena*" -o -iname "*xadrez*" \) 2>/dev/null)
if [ -n "$CRASHES" ]; then
  fail "Relatório de travamento encontrado"
  for c in $CRASHES; do cp "$c" "$OUT/" 2>/dev/null; done
else
  ok "Nenhum relatório de travamento"
fi
xcrun simctl spawn "$UDID" log show --last 5m --style compact --predicate 'process == "XadrezArena"' 2>/dev/null \
  | grep -iE "error|exception|fatal" | grep -viE "nw_|networkd|Failed to send|CFNetwork|tcp_" | head -60 > "$OUT/js-errors.txt" || true
[ -s "$OUT/js-errors.txt" ] && log "⚠️  Mensagens de erro no log: ver js-errors.txt"

if [ "$FAILED" = "0" ]; then log "RESULTADO: SUCESSO"; else log "RESULTADO: FALHOU"; fi
exit "$FAILED"
