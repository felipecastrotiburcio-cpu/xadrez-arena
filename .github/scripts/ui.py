#!/usr/bin/env python3
"""Ajudante do teste no emulador: lê o dump do uiautomator.

  ui.py find  <ui.xml> <regex>   -> imprime "x y" do centro do 1º elemento cujo texto
                                     ou descrição casa (inteiro, sem diferenciar maiúsculas)
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


def find(path, pattern):
    rx = re.compile(pattern, re.IGNORECASE | re.DOTALL)
    for n in nodes(path):
        for attr in ('text', 'content-desc'):
            value = (n.get(attr) or '').strip()
            if value and rx.fullmatch(value):
                x, y = center(n.get('bounds'))
                print(x, y)
                return 0
    return 1


def board(path):
    # As casas têm descrição "e2 branco p" (com peça) ou "e4" (vazia).
    for n in nodes(path):
        m = re.fullmatch(r'([a-h][1-8]) (branco|preto) ([pnbrqk])', (n.get('content-desc') or '').strip())
        if m:
            print(f'{m.group(1)}:{m.group(2)}:{m.group(3)}')
    return 0


if __name__ == '__main__':
    cmd = sys.argv[1]
    sys.exit(find(sys.argv[2], sys.argv[3]) if cmd == 'find' else board(sys.argv[2]))
