// Integritatea pachetului: ce trebuie sa fie adevarat inainte de orice release.
// Rulare: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const us = read('CHATGPT_RENDA_HUD.user.js');

test('manifest MV3 cu versiunea egala cu @version din userscript', () => {
  assert.equal(manifest.manifest_version, 3);
  const m = us.match(/\/\/\s*@version\s+(\S+)/);
  assert.ok(m, '@version lipseste');
  assert.equal(manifest.version, m[1]);
});

test('content_scripts = baza garantata: exista si fisierele ei sunt in pachet', () => {
  assert.ok(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length);
  for (const cs of manifest.content_scripts) {
    assert.ok(cs.matches.includes('https://chatgpt.com/*'));
    for (const f of cs.js) assert.ok(existsSync(join(ROOT, f)), f + ' lipseste');
  }
});

test('permisiuni: identity pentru device-connect, host_permissions pe ChatGPT si RENDA', () => {
  for (const p of ['storage', 'alarms', 'identity']) assert.ok(manifest.permissions.includes(p), p);
  // fara host_permissions pe chatgpt.com, userScripts se inregistreaza dar nu ruleaza (README)
  for (const h of ['https://chatgpt.com/*', 'https://chat.openai.com/*', 'https://renda.holdings/*']) {
    assert.ok(manifest.host_permissions.includes(h), h);
  }
});

test('userscript dual-environment (puntea de extensie)', () => {
  for (const marker of ['function extHudRequest', 'function extRuntimeOk', 'chrome.runtime.getManifest()']) {
    assert.ok(us.includes(marker), marker);
  }
});

test('seturile de date JSON din userscript se pot citi', () => {
  for (const name of ['RV_AGENTS', 'RV_SHKN', 'RV_MISSIONS', 'RV_BOOT_META', 'RV_TEZE', 'CANON_EMBED']) {
    const line = us.split('\n').find((l) => new RegExp('^  (const|let) ' + name + ' = ').test(l));
    assert.ok(line, name + ' negasit');
    const json = line.slice(line.indexOf('= ') + 2).replace(/;\s*$/, '');
    assert.doesNotThrow(() => JSON.parse(json), name);
  }
});

test('un singur drum de conectare: fara cheie manuala in pagina sau in extensie', () => {
  for (const gone of ['st-key', 'rv_auth_set_key', 'getApiKey', 'migrateLegacyKey']) {
    assert.ok(!us.includes(gone), 'userscript-ul inca are ' + gone);
  }
  const bg = read('background.js');
  assert.ok(!bg.includes('rv_auth_set_key') && !bg.includes('authSetKey'), 'background.js inca accepta cheie lipita');
  assert.ok(bg.includes('purgeNonDeviceKey'), 'lipseste curatenia cheilor care nu vin din buton');
});

test('fisierele .ps1/.bat sunt ASCII (PowerShell 5.1 citeste fara BOM ca ANSI)', () => {
  for (const f of ['bootstrap.ps1', 'remote_install.bat']) {
    assert.ok(!/[^\x00-\x7F]/.test(read(f)), f);
  }
});

test('mecanismul de update pe disc a fost scos complet', () => {
  for (const f of ['update.ps1', 'version.txt', 'opreste-auto-update.bat', 'sterge-task-vechi.bat']) {
    assert.ok(!existsSync(join(ROOT, f)), f + ' inca exista');
  }
  assert.ok(!read('background.js').includes('version.txt'));
  assert.ok(!read('bootstrap.ps1').includes('Register-ScheduledTask'));
});

// B4: registrul BOOT (73 de angajati) nu mai sta in pachet — rolul vine doar din /api/hud/me
test('registrul BOOT nu mai e in pachet', () => {
  assert.match(us, /^\s*const RV_BOOT = \[\];/m, 'RV_BOOT trebuie sa fie gol');
  assert.ok(!/VEGO-ROL-\d{3}/.test(us), 'un ID de rol VEGO-ROL-nnn inca apare in pachet');
});

test('niciun set de date al organizatiei in pachet: totul vine din RENDA dupa conectare', () => {
  const empty = {
    RV_AGENTS: '{"agents":[],"external":[],"skills":[]}', RV_SHKN: '{"items":[]}', RV_PLUGINS: '[]',
    RV_MISSIONS: '[]', RV_BOOT_META: '{"models":[],"steps":[]}', RV_TEZE: '{"title":"TEZELE VEGO","teze":[]}',
    MIS_MAP: '[]', BOOT_EMBED: '""', CANON_EMBED: '{"reflexe":{},"norme":[],"signals":[],"nucleu":[],"top_n":3}'
  };
  for (const [name, val] of Object.entries(empty)) {
    assert.ok(us.includes('  let ' + name + ' = ' + val + ';'), name + ' trebuie sa porneasca gol');
  }
  assert.ok(!/63d29971/.test(us), 'subscriptia Azure inca e in pachet');
  assert.ok(!/Plugin_[0-9a-f]{8}/.test(us), 'ID-uri de plugin ChatGPT inca in pachet');
  assert.ok(!/g-[0-9a-f]{32}/.test(us), 'ID-uri de GPT inca in pachet');
  assert.ok(us.length < 260000, 'userscript-ul a crescut la ' + us.length + ' octeti — date intrate inapoi?');
});

test('textele de interfata raman in cod (sabloane Prompt, Ziua mea, fraza de final, preambul SHKN)', () => {
  assert.match(us, /const TEMPLATES = \[/);
  assert.equal((us.match(/^    \['[^']+',$/gm) || []).length, 6, 'cele 6 sabloane ⚡ Prompt');
  for (const k of ['const RV_DAY_TEXT = ', 'const RV_BOOT_FOOTER = ', 'function shknWrap(']) assert.ok(us.includes(k), k);
});

test('tema HUD: toate culorile regulilor HUD sunt variabile, cu pereche pentru tema deschisa', () => {
  const css = us.slice(us.indexOf('const css = String.raw`'), us.indexOf('function addStyle()'));
  const rules = css.slice(css.indexOf('#${HUD_ID} {'));
  const hard = (rules.match(/#[0-9a-fA-F]{3,8}/g) || []).filter((h) => h !== '#000');
  assert.deepEqual(hard, [], 'culori scrise direct in regulile HUD (tema deschisa nu le-ar schimba)');
  const used = new Set((rules.match(/var\(--rv-k-[\w]+\)/g) || []).map((v) => v.slice(4, -1)));
  const lightBlock = css.slice(css.indexOf("[data-rv-theme='light'] {"), css.indexOf('stralucirile de text'));
  for (const v of used) assert.ok(lightBlock.includes(v + ':'), v + ' nu are valoare pentru tema deschisa');
  assert.ok(used.size >= 40, 'prea putine variabile: ' + used.size);
});

test('tema HUD: butonul de tema si cheia de preferinta exista', () => {
  assert.ok(us.includes('rv-theme-btn') && us.includes("const THEME_KEY = 'rendaVigiliaTheme'"));
  assert.ok(us.includes('startTheme(hud);'), 'tema trebuie pornita la montare');
});

test('curatenie: fara icon.png nefolosit, fara promisiunea falsa de confidentialitate, esc o singura data', () => {
  assert.ok(!existsSync(join(ROOT, 'icon.png')), 'icon.png (1,5 MB, nefolosit) a revenit');
  for (const t of [manifest.description, us.match(/\/\/ @description\s+(.*)/)[1]]) {
    assert.ok(!/Nu citește și nu transmite conversațiile/.test(t), 'descrierea promite ca nu citeste conversatiile');
    assert.ok(t.length > 20, 'descriere lipsa');
  }
  assert.ok(manifest.description.length <= 132, 'Chrome refuza descrieri peste 132 de caractere');
  assert.equal((us.match(/function esc\(/g) || []).length, 1);
  assert.ok(!/const esc = /.test(us), 'o copie locala a lui esc a revenit');
  assert.match(us, /\/\^\(storageexplorer:\|https:\)\/i\.test\(azb\.dataset\.az/, 'butonul Azure trebuie sa accepte doar storageexplorer: / https:');
  assert.ok(existsSync(join(ROOT, 'CHANGELOG.md')), 'istoricul versiunilor lipseste');
  assert.ok(us.length < 200000, 'userscript-ul a crescut: ' + us.length);
});

