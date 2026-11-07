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
# Desliga o tutorial do teclado ("deslize para digitar"), que cobre a tela na 1ª digitação.
xcrun simctl spawn "$UDID" defaults write com.apple.keyboard.preferences DidShowContinuousPathIntroduction -bool true 2>/dev/null || true
xcrun simctl spawn "$UDID" defaults write com.apple.Preferences DidShowContinuousPathIntroduction -bool true 2>/dev/null || true
sleep 5
shot() { xcrun simctl io "$UDID" screenshot "$OUT/$1.png" > /dev/null 2>&1; }
alive() { xcrun simctl spawn "$UDID" launchctl list 2>/dev/null | grep -q "UIKitApplication:$BUNDLE"; }

if xcrun simctl install "$UDID" "$APP"; then ok "App instalado no simulador"; else fail "Falha ao instalar"; exit 1; fi
START=$(date +%s)
if xcrun simctl launch "$UDID" "$BUNDLE" > /dev/null; then ok "App aberto"; else fail "Falha ao abrir o app"; fi
sleep 20
shot 01-inicio
if alive; then ok "App continua aberto após 20 s (tela inicial)"; else fail "App fechou ao abrir"; fi

# Uso do app tocando na tela (Maestro): partida, desistência, finalização, conta, loja.
USERNAME="ios$(date +%s | tail -c 5)"
if maestro --device "$UDID" test -e OUT="$OUT" -e USERNAME="$USERNAME" --debug-output "$OUT/maestro" \
     "$(dirname "$0")/../maestro/ios-smoke.yaml" > "$OUT/maestro.log" 2>&1; then
  ok "Partida contra a IA (5 min): lance e2→e4, resposta da IA e lance ilegal recusado"
  ok "Desistência, finalização 3D e tela de resultado (Derrota)"
  ok "Conta '$USERNAME' criada no aparelho com 300 moedas"
  ok "Compra na loja (Verde Torneio) e prévia do tabuleiro Nogueira Entalhada"
else
  fail "Teste de uso falhou: ver maestro.log"
  grep -E "✅|❌|FAILED|Element not found|Assertion" "$OUT/maestro.log" | tail -25 | tee -a "$REPORT"
  shot 99-falha
  # Árvore de elementos da tela no momento da falha (para diagnóstico)
  maestro --device "$UDID" hierarchy > "$OUT/tela-na-falha.json" 2>/dev/null || true
fi
find "$OUT/maestro" -path "*takeScreenshot*" -name "*.png" -exec cp {} "$OUT/" \; 2>/dev/null || true
# Os registros completos do Maestro são enormes: guarda só as capturas e o resumo.
find "$OUT/maestro" -type f ! -name "*.png" ! -name "commands*.json" ! -name "maestro.log" -delete 2>/dev/null || true
find "$OUT/maestro" -type f -size +20M -delete 2>/dev/null || true
if alive; then ok "App continua aberto ao final"; else fail "App não está aberto ao final"; fi

# Relatórios de travamento gerados desde o início do teste
CRASHES=$(find "$HOME/Library/Logs/DiagnosticReports" -newermt "@$START" \( -iname "*XadrezArena*" -o -iname "*xadrez*" \) 2>/dev/null)
if [ -n "$CRASHES" ]; then
  fail "Relatório de travamento encontrado"
  for c in $CRASHES; do cp "$c" "$OUT/" 2>/dev/null; done
else
  ok "Nenhum relatório de travamento"
fi
xcrun simctl spawn "$UDID" log show --last 15m --style compact --predicate 'process == "XadrezArena" AND (subsystem == "com.facebook.react.log" OR messageType == error OR messageType == fault)' 2>/dev/null \
  | grep -iE "error|exception|fatal" | grep -viE "nw_|networkd|Failed to send|CFNetwork|tcp_" | head -60 > "$OUT/js-errors.txt" || true
# Tudo o que o JavaScript do app escreveu (console.log/warn/error), para diagnóstico
xcrun simctl spawn "$UDID" log show --last 15m --style compact --predicate 'process == "XadrezArena" AND subsystem == "com.facebook.react.log"' 2>/dev/null \
  | tail -300 > "$OUT/js-console.txt" || true
[ -s "$OUT/js-errors.txt" ] && log "⚠️  Mensagens de erro no log: ver js-errors.txt"

if [ "$FAILED" = "0" ]; then log "RESULTADO: SUCESSO"; else log "RESULTADO: FALHOU"; fi
exit "$FAILED"
