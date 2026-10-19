"""Construieste pachetul pentru Chrome Web Store din extensia RENDA HUD (v4.37+).

Sursa (DOAR citita, nu se modifica):  C:\\ws_vego\\renda-chatgpt-hud
Iesire:  dist/extension/  +  dist/renda-hud-chatgpt-store-<versiune>.zip

Ce face:
  - copiaza DOAR fisierele necesare in Store (fara CHANGELOG, docs, tests, .bat/.ps1);
  - background.js: pastreaza conectarea la RENDA (chrome.identity + PKCE), puntea si cache-ul;
    scoate auto-update-ul de pe GitHub (chrome.userScripts + alarms) — interzis in Store;
  - manifestul Store: permisiuni doar storage + identity, fara raw.githubusercontent.com;
  - userscript: scoate antetul ==UserScript== (link-uri GitHub) si comentariile pe linie proprie;
    verifica faptul ca datele organizatiei NU sunt in cod (vin din /api/hud/* dupa conectare);
  - genereaza iconitele 16/48/128.

Rulare:  python build_store.py   [cale_sursa]
"""
import json
import re
import shutil
import sys
import zipfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
# sursa: repo-ul unic (acest folder e store-build/ in el); cuvintele: dictionarul platformei din renda
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent
LABELS_TS = Path(r'C:\ws_vego\renda\src\hud\hud_labels.ts')
DIST = HERE / 'dist'
OUT = DIST / 'extension'
USERSCRIPT = 'CHATGPT_RENDA_HUD.user.js'

PUBLISHER = 'RENDA Research Center'

# blocuri care trebuie sa fie GOALE in pachet (datele vin din RENDA dupa conectare)
EMPTY_EMBEDS = ['RV_AGENTS', 'RV_SHKN', 'RV_PLUGINS', 'RV_MISSIONS', 'RV_BOOT', 'RV_BOOT_META', 'RV_TEZE', 'CANON_EMBED', 'BOOT_EMBED',
                'TEMPLATES', 'RV_L', 'RV_LINKS', 'RV_BRAND', 'RV_TEXTS', 'RV_SYNONYMS', 'RV_FEATURES']
FORBIDDEN = ('raw.githubusercontent.com', 'virgilprofeanu', '63d29971', 'BADDOUR', 'storageexplorer://')


def fail(msg):
    print('EROARE: ' + msg)
    sys.exit(1)


# ---------- userscript ----------

def strip_comments(src):
    """Scoate antetul ==UserScript== si comentariile `//` aflate pe linie proprie.

    Liniile din interiorul template literal-urilor (`...`) nu se ating. Rezultatul se verifica
    cu un parser JS inainte de upload (vezi README.md).
    """
    lines = src.split('\n')
    start = next((i for i, l in enumerate(lines) if l.strip() == '(() => {'), None)
    if start is None:
        fail('nu gasesc inceputul IIFE `(() => {`')
    out = []
    in_tpl = False
    for line in lines[start:]:
        if not in_tpl and line.lstrip().startswith('//'):
            continue
        out.append(line)
        in_tpl = toggle_template(line, in_tpl)
    if in_tpl:
        fail('template literal neinchis la final — stripper-ul s-a desincronizat')
    return '\n'.join(out)


def toggle_template(line, in_tpl):
    quote = None
    i = 0
    while i < len(line):
        c = line[i]
        if c == '\\':
            i += 2
            continue
        if in_tpl:
            if c == '`':
                in_tpl = False
        elif quote:
            if c == quote:
                quote = None
        else:
            if c in '\'"':
                quote = c
            elif c == '`':
                in_tpl = True
            elif c == '/' and line[i + 1:i + 2] == '/':
                break
        i += 1
    return in_tpl


def check_empty_embeds(src):
    for name in EMPTY_EMBEDS:
        m = re.search(r'^\s*(?:const|let) ' + name + r' = (.*?);\s*(?://.*)?$', src, re.M)
        if not m:
            fail('nu gasesc blocul %s' % name)
        if len(m.group(1)) > 200:
            fail('blocul %s NU e gol in sursa (%d caractere) — date ale organizatiei in cod' % (name, len(m.group(1))))


def build_userscript():
    src = (SRC / USERSCRIPT).read_text(encoding='utf-8')
    m = re.search(r'//\s*@version\s+(\S+)', src)
    if not m:
        fail('@version negasit in userscript')
    version = m.group(1)
    check_empty_embeds(src)
    src = strip_comments(src)
    for needle in FORBIDDEN:
        if needle in src:
            fail('in userscript a ramas "%s"' % needle)
    for needle in ('function extHudRequest', 'rv_auth_connect', '/api/hud/config', 'function L(k, vars)', "type: 'rv_set_org'"):
        if needle not in src:
            fail('lipseste "%s" din userscript' % needle)
    return src, version


# ---------- background.js ----------

STORE_BG_HEADER = """// Service worker — varianta Chrome Web Store (generata de store-build/build_store.py).
//
// 0. CONEXIUNEA LA RENDA: cheia API, obtinuta DOAR prin butonul de conectare
//    (chrome.identity + PKCE), tinuta doar aici, in chrome.storage.local.
// 1. PUNTE: GET-uri catre serverul HUD local (127.0.0.1:8765) si catre RENDA, cu cache.
//
// Fata de varianta interna: fara user scripts si fara descarcare de cod de la distanta.
// Actualizarile vin exclusiv prin Chrome Web Store.

"""

STORE_BG_FOOTER = """
// Curatenia de la pornire: o cheie care nu vine din device-connect se sterge.
chrome.runtime.onInstalled.addListener(() => { purgeDone = purgeNonDeviceKey(); });
purgeDone = purgeNonDeviceKey();
"""


def build_background():
    lines = (SRC / 'background.js').read_text(encoding='utf-8').split('\n')
    start = next((i for i, l in enumerate(lines) if l.startswith('// Adrese pe care puntea')), None)
    upd = next((i for i, l in enumerate(lines) if l.startswith('// ---------- 2. auto-update')), None)
    if start is None or upd is None:
        fail('background.js: nu gasesc reperele "// Adrese pe care puntea" / "// ---------- 2. auto-update"')
    body = [l for l in lines[start:upd]
            if not l.startswith('const RAW_URL') and 'onUserScriptMessage' not in l]
    # ts()/log() sunt folosite de sectiunea de conectare; stau imediat dupa reper
    helpers = [l for l in lines[upd + 1:upd + 4] if l.startswith('function ts()') or l.startswith('function log(')]
    if len(helpers) != 2:
        fail('background.js: nu gasesc ts()/log() dupa reperul auto-update')
    code = STORE_BG_HEADER + '\n'.join(body).rstrip() + '\n\n' + '\n'.join(helpers) + '\n' + STORE_BG_FOOTER
    for bad in ('chrome.userScripts', 'chrome.alarms', 'raw.githubusercontent.com', 'checkGithub', 'registerCode'):
        if bad in code:
            fail('background.js Store contine inca "%s"' % bad)
    for need in ('authConnect', 'launchWebAuthFlow', 'hudFetch', 'remoteGet', 'purgeNonDeviceKey', 'HANDLERS', 'setOrg', 'x-renda-tenant'):
        if need not in code:
            fail('background.js Store a pierdut "%s"' % need)
    return code


# ---------- manifest + iconite ----------

def build_manifest(version):
    src_manifest = json.loads((SRC / 'manifest.json').read_text(encoding='utf-8'))
    if src_manifest.get('version') != version:
        fail('manifest.json are versiunea %s, userscript-ul %s' % (src_manifest.get('version'), version))
    return {
        'manifest_version': 3,
        'name': 'RENDA HUD',
        'short_name': 'RENDA HUD',
        'version': version,
        'description': 'Bandă de lucru RENDA pe chatgpt.com: agenți, misiuni, proiecte și reguli de lucru pentru echipele RENDA. Necesită cont RENDA.',
        'author': PUBLISHER,
        'homepage_url': 'https://renda.holdings/',
        'minimum_chrome_version': src_manifest.get('minimum_chrome_version', '120'),
        'icons': {'16': 'icon16.png', '48': 'icon48.png', '128': 'icon128.png'},
        'permissions': ['storage', 'identity'],
        'host_permissions': [
            'https://renda.holdings/*',
            'http://127.0.0.1:8765/*',
            'http://localhost:8765/*',
        ],
        'background': {'service_worker': 'background.js'},
        'content_scripts': [{
            'matches': ['https://chatgpt.com/*', 'https://chat.openai.com/*'],
            'js': [USERSCRIPT],
            'run_at': 'document_idle',
        }],
    }


def build_icons():
    big = SRC / 'icon.png'
    base = Image.open(big if big.exists() else SRC / 'icon128.png').convert('RGBA')
    for size in (16, 48, 128):
        base.resize((size, size), Image.LANCZOS).save(OUT / ('icon%d.png' % size), optimize=True)


def main():
    if not (SRC / USERSCRIPT).exists():
        fail('nu gasesc sursa in ' + str(SRC))
    code, version = build_userscript()
    # HUD-7: fiecare cheie de cuvant folosita trebuie sa aiba textul ei pe server, altfel HUD-ul arata goluri
    if LABELS_TS.exists():
        import check_labels
        used = check_labels.used_keys((SRC / USERSCRIPT).read_text(encoding='utf-8'))
        defined = check_labels.defined_keys(LABELS_TS.read_text(encoding='utf-8'))
        if used - defined:
            fail('cuvinte fara text pe server: ' + ', '.join(sorted(used - defined)))
        print('cuvinte: %d chei, toate definite pe server' % len(used))
    else:
        print('ATENTIE: nu gasesc %s — cheile de cuvinte nu au fost verificate' % LABELS_TS)
    bg = build_background()
    manifest = build_manifest(version)

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    (OUT / USERSCRIPT).write_text(code, encoding='utf-8')
    (OUT / 'background.js').write_text(bg, encoding='utf-8')
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    build_icons()

    zip_path = DIST / ('renda-hud-chatgpt-store-%s.zip' % version)
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in sorted(OUT.iterdir()):
            z.write(f, f.name)  # manifest.json direct in radacina arhivei

    print('OK  v%s  din %s' % (version, SRC))
    print('    ->  %s' % zip_path)
    for f in sorted(OUT.iterdir()):
        print('    %-28s %7d B' % (f.name, f.stat().st_size))


if __name__ == '__main__':
    main()
