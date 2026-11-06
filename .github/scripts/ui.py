#!/usr/bin/env python3
"""Ajudante do teste no emulador: lê o dump do uiautomator.

  ui.py find  <ui.xml> <regex>   -> imprime "x y" do centro do 1º elemento cujo texto
                                     ou descrição casa (inteiro, sem diferenciar maiúsculas)
  ui.py findlast <ui.xml> <regex> -> igual, mas o último elemento que casa
  ui.py edit  <ui.xml> <n>       -> imprime "x y" do n-ésimo campo de texto (0 = primeiro)
  ui.py board <ui.xml>           -> imprime as peças do tabuleiro, ex: "e2:branco:p"
"""
import re
import sys
import xml.etree.ElementTree as ET


def nodes(path):
    return ET.parse(path).getroot().iter('node')


def center(bounds):
    x1, y1, x2, y2 = map(int, re.findall(r'\d+', bounds))
    return (x1 + x2) // 2, (y1 + y2) // 2


def find(path, pattern, last=False):
    rx = re.compile(pattern, re.IGNORECASE | re.DOTALL)
    found = None
    for n in nodes(path):
        for attr in ('text', 'content-desc'):
            value = (n.get(attr) or '').strip()
            if value and rx.fullmatch(value):
                found = center(n.get('bounds'))
                if not last:
                    print(*found)
                    return 0
    if found:
        print(*found)
        return 0
    return 1


def edit(path, index):
    fields = [n for n in nodes(path) if n.get('class') == 'android.widget.EditText']
    if index >= len(fields):
        return 1
    print(*center(fields[index].get('bounds')))
    return 0


def board(path):
    # As casas têm descrição "e2 branco p" (com peça) ou "e4" (vazia).
    for n in nodes(path):
        m = re.fullmatch(r'([a-h][1-8]) (branco|preto) ([pnbrqk])', (n.get('content-desc') or '').strip())
        if m:
            print(f'{m.group(1)}:{m.group(2)}:{m.group(3)}')
    return 0


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'board':
        sys.exit(board(sys.argv[2]))
    if cmd == 'edit':
        sys.exit(edit(sys.argv[2], int(sys.argv[3])))
    sys.exit(find(sys.argv[2], sys.argv[3], last=(cmd == 'findlast')))
