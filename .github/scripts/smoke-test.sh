#!/usr/bin/env bash
# Teste de fumaça no emulador Android: instala o APK, abre o app, joga contra a IA,
# verifica regras básicas, abre a finalização 3D e procura travamentos no logcat.
# Uso: smoke-test.sh <apk> <pasta-de-saida>
set -u
APK="$1"
OUT="$2"
PKG="app.xadrezarena"
UI="$(dirname "$0")/ui.py"
mkdir -p "$OUT"
REPORT="$OUT/report.txt"
FAILED=0

log() { echo "$*" | tee -a "$REPORT"; }
ok() { log "✅ $*"; }
fail() { log "❌ $*"; FAILED=1; }
shot() { adb exec-out screencap -p > "$OUT/$1.png"; }
# Lê a tela. Avisos do sistema do emulador ("X isn't responding") são fechados com "Wait".
dump() {
  for _ in 1 2 3 4; do
    rm -f "$OUT/ui.xml"
    adb shell uiautomator dump /sdcard/ui.xml >> "$OUT/dump.log" 2>&1
    adb pull /sdcard/ui.xml "$OUT/ui.xml" > /dev/null 2>&1
    if grep -qE "t responding|não está respondendo" "$OUT/ui.xml" 2>/dev/null; then
      log "ℹ️  Aviso do sistema do emulador fechado (app do sistema lento)"
      xy=$(python3 "$UI" find "$OUT/ui.xml" '(Wait|Aguardar)') && adb shell input tap $xy
      sleep 3
      continue
    fi
    return 0
  done
}
# Toca no elemento cujo texto/descrição casa com a regex (tenta por até ~20 s).
tap() {
  for _ in $(seq 1 10); do
    dump
    if xy=$(python3 "$UI" find "$OUT/ui.xml" "$1"); then
      adb shell input tap $xy
      return 0
    fi
    sleep 2
  done
  return 1
}
board() { dump; python3 "$UI" board "$OUT/ui.xml" | sort; }
alive() { adb shell pidof "$PKG" > /dev/null; }

log "Dispositivo: $(adb shell getprop ro.product.model | tr -d '\r') · Android $(adb shell getprop ro.build.version.release | tr -d '\r') (API $(adb shell getprop ro.build.version.sdk | tr -d '\r'))"

# 1. Instalação
if adb install -r "$APK" > "$OUT/install.txt" 2>&1; then ok "APK instalado"; else fail "Falha ao instalar: $(cat "$OUT/install.txt")"; exit 1; fi

# 2. Abertura (espera o sistema do emulador estabilizar e fecha avisos pendentes)
adb shell input keyevent KEYCODE_HOME
sleep 30
dump
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 25
dump
shot 01-inicio
if alive; then ok "App abriu e continua em execução"; else fail "App fechou ao abrir"; fi
if tap 'JOGAR!'; then ok "Tela inicial carregada (botão JOGAR! encontrado)"; adb shell input keyevent KEYCODE_BACK; sleep 3; else fail "Tela inicial não apareceu"; fi
# Voltar à tela inicial (o toque em JOGAR! sem conta abre o login)
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 3

# 3. Partida contra a IA
if tap 'Contra a IA'; then ok "Menu 'Contra a IA' abriu"; else fail "Botão 'Contra a IA' não encontrado"; fi
sleep 3
shot 02-escolher-ia
if tap '.*Começar partida'; then ok "Partida contra a IA iniciada"; else fail "Botão 'Começar partida' não encontrado"; fi
sleep 5
shot 03-tabuleiro
INITIAL=$(board)
COUNT=$(echo "$INITIAL" | grep -c ':' || true)
if [ "$COUNT" = "32" ]; then ok "Tabuleiro com as 32 peças na posição inicial"; else fail "Tabuleiro inesperado ($COUNT peças)"; fi

# Lance do jogador: e2-e4
tap 'e2 branco p' && sleep 1 && shot 04-selecionado && tap 'e4'
black() { echo "$1" | grep ':preto:'; }
AFTER=""
for _ in $(seq 1 20); do
  sleep 3
  AFTER=$(board)
  # A IA respondeu quando o conjunto de peças pretas mudou.
  if [ "$(black "$INITIAL")" != "$(black "$AFTER")" ]; then break; fi
done
shot 05-ia-respondeu
if echo "$AFTER" | grep -q 'e4:branco:p'; then ok "Peça movida pelo toque (peão e2 → e4)"; else fail "O peão não foi para e4"; fi
BLACK_MOVED=$(diff <(black "$INITIAL") <(black "$AFTER") | grep '^>' | sed 's/^> //' | tr '\n' ' ')
if [ -n "$BLACK_MOVED" ]; then ok "A IA respondeu com um lance (agora em: $BLACK_MOVED)"; else fail "A IA não respondeu em 60 s"; fi

# Regra: lance ilegal (peão e4 → e6) deve ser recusado
tap 'e4 branco p' && sleep 1 && tap 'e6( .*)?'
sleep 2
CHECK=$(board)
if echo "$CHECK" | grep -q 'e4:branco:p' && ! echo "$CHECK" | grep -q 'e6:branco'; then ok "Lance ilegal recusado (peão não anda 2 casas a partir de e4)"; else fail "Lance ilegal foi aceito"; fi

# Dica do motor
if tap '.*Dica'; then sleep 4; shot 06-dica; ok "Botão de dica respondeu"; else fail "Botão Dica não encontrado"; fi

# Desistir -> finalização 3D da IA -> resultado
if tap '.*Desistir'; then
  sleep 2
  if tap 'desistir'; then ok "Desistência confirmada"; else fail "Confirmação de desistência não apareceu"; fi
  sleep 3; shot 07-finalizacao-3d-a
  sleep 2; shot 08-finalizacao-3d-b
  if alive; then ok "Finalização 3D exibida sem travar o app"; else fail "App fechou durante a finalização 3D"; fi
  sleep 6; shot 09-resultado
  dump
  if python3 "$UI" find "$OUT/ui.xml" 'Derrota' > /dev/null; then ok "Tela de resultado (Derrota) exibida"; else log "⚠️  Tela de resultado não detectada"; fi
else
  fail "Botão Desistir não encontrado"
fi

# 4. Tela de login (modo online sem servidor configurado)
adb shell am force-stop "$PKG"
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 10
if tap 'Criar conta'; then
  sleep 3; shot 10-login
  dump
  if python3 "$UI" find "$OUT/ui.xml" '.*modo online ainda não está disponível.*' > /dev/null; then
    ok "Login avisa que o servidor online não está configurado"
  else
    log "⚠️  Aviso de servidor não encontrado na tela de login"
  fi
else
  fail "Botão 'Criar conta' não encontrado na tela inicial"
fi

# 5. Travamentos
adb logcat -d > "$OUT/logcat.txt"
if grep -q "FATAL EXCEPTION" "$OUT/logcat.txt"; then fail "Travamento encontrado no logcat (FATAL EXCEPTION)"; else ok "Nenhum travamento (FATAL EXCEPTION) no logcat"; fi
grep -E "ReactNativeJS|ReactNative" "$OUT/logcat.txt" | grep -iE "error|exception" | head -40 > "$OUT/js-errors.txt" || true
if [ -s "$OUT/js-errors.txt" ]; then log "⚠️  Mensagens de erro do JavaScript: ver js-errors.txt"; fi

rm -f "$OUT/ui.xml"
if [ "$FAILED" = "0" ]; then log "RESULTADO: SUCESSO"; else log "RESULTADO: FALHOU"; fi
exit "$FAILED"
