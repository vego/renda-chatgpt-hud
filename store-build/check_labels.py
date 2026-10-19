"""Cheile de cuvinte folosite de extensie trebuie sa existe in dictionarul platformei (renda: src/hud/hud_labels.ts).

Extensia nu poarta niciun cuvant (HUD-7): daca o cheie lipseste pe server, in HUD apare un loc gol. Verificarea
citeste cheile din userscript — L('…'), data-rvl / data-rvlt / data-rvlp / data-rvla, si cheile compuse
(prefix + valoare) — si le cauta in HUD_DEFAULT_LABELS.

Rulare:  python check_labels.py [userscript] [hud_labels.ts]
"""
import io
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
US = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / 'CHATGPT_RENDA_HUD.user.js'
LABELS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(r'C:\ws_vego\renda\src\hud\hud_labels.ts')

# cheile compuse in cod: prefixul si valorile posibile
COMPOSED = {
    'theme.': ['auto', 'dark', 'light'],
    'canon.pill_': ['off', 'compact', 'full'],
    'canon.line_': ['off', 'compact', 'full'],
    'ag.type_': ['persona', 'tool', 'mech', 'flow', 'sys'],
}


def used_keys(src):
    keys = set()
    # orice sir care arata a cheie (grup.nume) intr-un apel L(…) sau intr-un atribut de cuvant
    for m in re.finditer(r"L\(([^;]*?)\)", src):
        for k in re.findall(r"'([a-z]+\.[a-z0-9_]+)'", m.group(1)):
            keys.add(k)
    for m in re.finditer(r'data-rvl[tpa]?="([a-z]+\.[a-z0-9_]+)"', src):
        keys.add(m.group(1))
    for m in re.finditer(r"setAttribute\('data-rvl[tpa]?', '([a-z]+\.[a-z0-9_]+)'\)", src):
        keys.add(m.group(1))
    # cheile din expresii imbricate (L(a ? 'x.y' : b ? 'x.z' : …)): orice sir de forma grup.nume dintr-un grup cunoscut
    groups = {k.split('.')[0] for k in keys}
    for k in re.findall(r"'([a-z]+\.[a-z0-9_]+)'", src):
        if k.split('.')[0] in groups:
            keys.add(k)
    for prefix, values in COMPOSED.items():
        if ("'" + prefix + "'") in src:
            for v in values:
                keys.add(prefix + v)
    # prefixele compuse nu sunt chei
    return {k for k in keys if not k.endswith('_') and not k.endswith('.')}


def defined_keys(ts):
    block = ts[ts.index('HUD_DEFAULT_LABELS'):ts.index('\n}\n', ts.index('HUD_DEFAULT_LABELS'))]
    return set(re.findall(r"^\t'([a-z0-9_.]+)':", block, re.M))


def main():
    src = io.open(US, encoding='utf-8').read()
    ts = io.open(LABELS, encoding='utf-8').read()
    used = used_keys(src)
    defined = defined_keys(ts)
    missing = sorted(used - defined)
    unused = sorted(defined - used)
    print('chei folosite: %d · definite pe server: %d' % (len(used), len(defined)))
    if unused:
        print('definite, dar nefolosite de extensie (%d): %s' % (len(unused), ', '.join(unused)))
    if missing:
        print('LIPSESC pe server (%d): %s' % (len(missing), ', '.join(missing)))
        sys.exit(1)
    print('OK: fiecare cheie folosita are cuvantul ei pe server')


if __name__ == '__main__':
    main()
