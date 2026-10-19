// Service worker de fundal — model HIBRID de injectare:
//
//   BAZA GARANTATA  = content_scripts din manifest (fisierul CHATGPT_RENDA_HUD.user.js,
//                     acelasi cod, incarcat de browser fara NICIO setare). Merge pe Chrome
//                     si pe Edge, la instalare curata. Aici nu e nevoie de service worker.
//   STRAT OPTIONAL  = chrome.userScripts, folosit EXCLUSIV pentru auto-update de pe GitHub.
//                     Cere comutatorul "Allow user scripts" pe cardul extensiei (Chrome/Edge
//                     138+). Daca lipseste, HUD-ul ruleaza oricum din pachet — se pierde doar
//                     actualizarea automata, nu functionarea.
//
// 0. CONEXIUNEA LA RENDA: cheia API, obtinuta DOAR prin butonul de conectare, tinuta doar aici; vezi sectiunea 0.
//
// 1. PROXY LOCALHOST: GET-uri catre serverul HUD local (127.0.0.1:8765). Nici lumea izolata a
//    unui content script, nici lumea USER_SCRIPT nu pot atinge serverul local direct (CORS);
//    fetch-ul de aici, cu host_permissions, poate. Mesajele sosesc pe onMessage (content
//    script) sau onUserScriptMessage (USER_SCRIPT) — ascultam pe ambele.
//
// 2. AUTO-UPDATE: codul HUD actualizat de pe GitHub e pastrat in chrome.storage si injectat
//    prin chrome.userScripts. ANTI-DUBLA-INJECTARE: cand pachetul are content_scripts (cazul
//    normal), inregistram userScript-ul DOAR daca in storage exista o versiune STRICT MAI NOUA
//    decat samanta din pachet — altfel baza deja ruleaza exact acelasi cod, iar o inregistrare
//    in plus ar insemna doua injectari. La 1 minut: self-heal; GitHub cel mult o data la 10 min,
//    doar versiuni MAI NOI (fara downgrade).
//
// DIAGNOSTIC in codul injectat prin userScripts (wrap): prima linie logheaza injectarea INAINTE
// de orice cod HUD, iar un try/catch prinde si afiseaza orice crash la pornire.

// Adrese pe care puntea are voie sa le ceara. 127.0.0.1:8765 = serverul HUD local.
// renda.holdings adaugat 2026-07-24: pe ruta content_scripts, extRuntimeOk() e true, deci
// apiFetch alege PUNTEA si nu mai ajunge la fetch-ul direct; fara adresa aici, cererile
// spre API-ul RENDA erau respinse cu 'blocked' si functia murea TACUT (prins de auditul
// adversarial). Service worker-ul are host_permissions, deci ocoleste CORS-ul paginii.
const ALLOWED = /^(http:\/\/(127\.0\.0\.1|localhost):8765\/|https:\/\/renda\.holdings\/)/;
const RAW_URL = 'https://raw.githubusercontent.com/virgilprofeanu/renda-chatgpt-hud/main/CHATGPT_RENDA_HUD.user.js';
// Acelasi fisier e si samanta stratului de auto-update si baza din content_scripts ⇒ versiunea
// bazei == versiunea samantei prin constructie (nu poate aparea decalaj intre ele).
const SEED_FILE = 'CHATGPT_RENDA_HUD.user.js';
const SCRIPT_ID = 'renda-vigilia-hud';
const OLD_IDS = ['renda-vigilia-hud-overlay', 'renda-canary', 'test-us', 'test-main'];
const MATCHES = ['https://chatgpt.com/*', 'https://chat.openai.com/*'];
const ALARM = 'renda-hud-tick';
const TICK_MIN = 1;                 // self-heal inregistrare la 1 min
const GITHUB_EVERY_MS = 10 * 60000; // GitHub cel mult o data la 10 min

// baza garantata: pachetul propriu declara content_scripts?
function hasContentScripts() {
  try {
    const m = chrome.runtime.getManifest();
    return !!(m && Array.isArray(m.content_scripts) && m.content_scripts.length);
  } catch (e) { return false; }
}
const BASE_OK = hasContentScripts();

// ---------- 0. conexiunea la RENDA (cheia API) ----------
// v4.37.0 — cheia API RENDA sta DOAR aici, in chrome.storage.local (rv_api_key); nu mai ajunge
// in pagina (localStorage-ul chatgpt.com e citibil de scripturile OpenAI). Puntea o ataseaza
// singura cererilor spre RENDA. UN SINGUR DRUM de a o obtine:
//   - DEVICE-CONNECT v2 (butonul "Conecteaza-te la RENDA"): pagina de connect a RENDA, cu
//     callback-ul https://<id>.chromiumapp.org/ prins de chrome.identity.launchWebAuthFlow.
//     Intoarcerea poarta un COD DE UNICA FOLOSINTA, niciodata cheia (decizia HUD-3); codul se
//     schimba pe cheie cu verificatorul PKCE, pe care doar extensia il stie. Contractul: Faza 2
//     din docs/SERVER_SPEC_HUD.md.
// Cheile care nu au venit pe acest drum (lipite manual sau migrate din versiuni vechi) se sterg
// la pornire (purgeNonDeviceKey), ca "conectat" sa insemne mereu "a apasat butonul".
// rv_base: adresa RENDA; implicit productia. Se schimba DOAR din consola service worker-ului
// (chrome.storage.local.set({rv_base:'http://localhost:3000'})), pagina nu are acces la ea.
const DEFAULT_BASE = 'https://renda.holdings';
const AUTH_KEYS = ['rv_api_key', 'rv_user', 'rv_key_when', 'rv_key_via', 'rv_org'];
// v4.47.0 — ORGANIZATIA (HUD-7): cheia poate lucra in mai multe organizatii; cea aleasa in comutatorul din HUD
// pleaca la fiecare cerere spre RENDA in headerul x-renda-tenant (serverul o valideaza). Gol = organizatia
// implicita a cheii. Cache-ul e pe organizatie: datele uneia nu apar niciodata in alta.
const ORG_HEADER = 'x-renda-tenant';
const ORG_ID = /^[A-Za-z0-9_\-]{1,100}$/;
const CACHE_PREFIX = 'rv_cache:';
const REMOTE_PATH = /^\/api\/hud\/[a-z0-9_\-\/]+$/;   // rv_remote: doar endpoint-urile HUD
const PASS_HEADERS = ['authorization', 'x-api-key'];  // ce accepta puntea din msg.headers

async function getBase() {
  try {
    const s = await chrome.storage.local.get('rv_base');
    return String(s.rv_base || DEFAULT_BASE).replace(/\/+$/, '');
  } catch (_) { return DEFAULT_BASE; }
}
async function getOrg() {
  try { return String((await chrome.storage.local.get('rv_org')).rv_org || ''); } catch (_) { return ''; }
}
function rendaHeaders(key, org) {
  const h = { 'Authorization': 'Bearer ' + key };
  if (org) h[ORG_HEADER] = org;
  return h;
}
function sameOrigin(url, base) {
  try { return new URL(url).origin === new URL(base).origin; } catch (_) { return false; }
}
async function getKey() {
  try { return (await chrome.storage.local.get('rv_api_key')).rv_api_key || ''; } catch (_) { return ''; }
}
function unwrap(j) {
  // plicurile RENDA: {ok,data} / {_s,ok,data} / {success,data}; altfel obiectul insusi
  return (j && typeof j === 'object' && 'data' in j && ('ok' in j || '_s' in j || 'success' in j)) ? j.data : j;
}
function browserName() {
  try {
    const brands = (navigator.userAgentData && navigator.userAgentData.brands) || [];
    if (brands.some((b) => /edge/i.test(b.brand))) return 'Edge';
  } catch (_) {}
  return /Edg\//.test(navigator.userAgent || '') ? 'Edge' : 'Chrome';
}

// Valideaza cheia pe RENDA. {valid:true,user} / {valid:false,error} / {valid:null} (retea).
async function validateKey(key, base) {
  try {
    const res = await fetch(base + '/api/auth/api-key/validate', { method: 'POST', headers: { 'X-API-Key': key }, cache: 'no-store' });
    if (res.status === 401 || res.status === 403) return { valid: false, error: 'cheie respinsă de RENDA' };
    if (!res.ok) return { valid: null };
    const d = unwrap(await res.json());
    if (d && d.valid === false) return { valid: false, error: d.error || 'cheie invalidă' };
    const u = (d && d.user) || {};
    return { valid: true, user: { email: String(u.email || ''), name: String(u.name || '') } };
  } catch (_) { return { valid: null }; }
}

async function storeKey(key, user, via) {
  await chrome.storage.local.set({ rv_api_key: key, rv_user: user || null, rv_key_when: new Date().toISOString(), rv_key_via: via });
  await clearRemoteCache();
}
async function clearRemoteCache() {
  try {
    const all = await chrome.storage.local.get(null);
    const ks = Object.keys(all).filter((k) => k.indexOf(CACHE_PREFIX) === 0);
    if (ks.length) await chrome.storage.local.remove(ks);
  } catch (_) {}
}

// PKCE (RFC 7636, S256): verificatorul = 32 de octeti aleatori in base64url (43 de caractere);
// provocarea = base64url(SHA-256(verificator)). Doar provocarea pleaca spre RENDA la inceput.
function b64url(bytes) {
  let bin = '';
  new Uint8Array(bytes).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function pkcePair() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

// Citeste raspunsul device-connect v2: callback?code=…&state=… sau ?error=access_denied&state=…
// Un raspuns care poarta cheia direct (v1) e respins: decizia HUD-3 cere cod.
function parseConnectRedirect(redirect, state, callback) {
  let u;
  try { u = new URL(String(redirect || '')); } catch (_) { return { error: 'răspuns de conectare ilizibil' }; }
  if (u.origin !== new URL(callback).origin) return { error: 'răspuns de conectare de la altă adresă' };
  if (u.searchParams.get('state') !== state) return { error: 'răspuns de conectare nepotrivit (state)' };
  const err = u.searchParams.get('error');
  if (err) return { error: err === 'access_denied' ? 'conectare refuzată' : 'conectare eșuată: ' + err };
  if (u.searchParams.has('key')) return { error: 'RENDA a trimis cheia în adresă (flux vechi) — conectare refuzată' };
  const code = u.searchParams.get('code') || '';
  if (!/^[A-Za-z0-9_\-]{16,128}$/.test(code)) return { error: 'RENDA nu a trimis un cod de conectare valid' };
  return { code };
}

// Schimba codul pe cheie: POST /api/account/device-connect/token (ruta publica; dovada e
// verificatorul PKCE). Corpul = EXACT { code, code_verifier } (DEVICE_CONNECT_TOKEN_BODY pe server).
// Raspuns: { key: 'rk_…' }; daca serverul adauga si { account }, il folosim, altfel validam cheia.
// Codul expira in 120 s si se arde la prima incercare gresita.
async function exchangeCode(base, code, verifier) {
  let res;
  try {
    res = await fetch(base + '/api/account/device-connect/token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify({ code, code_verifier: verifier })
    });
  } catch (_) { return { error: 'RENDA nu răspunde — reîncearcă conectarea' }; }
  let d = null;
  try { d = unwrap(await res.json()); } catch (_) {}
  if (!res.ok) return { error: res.status === 400 ? 'codul de conectare a expirat sau a fost deja folosit — reîncearcă' : 'schimbul codului a eșuat (HTTP ' + res.status + ')' };
  const key = d && String(d.key || '');
  if (!key || !/^rk_[A-Za-z0-9_\-]{8,}$/.test(key)) return { error: 'RENDA nu a trimis o cheie validă' };
  const a = (d && d.account) || null;
  return { key, user: a ? { email: String(a.email || ''), name: String(a.name || '') } : null };
}

async function authConnect() {
  if (!chrome.identity || typeof chrome.identity.launchWebAuthFlow !== 'function') {
    return { ok: false, error: 'browserul nu permite conectarea din extensie (Chrome/Edge 120+ necesar)' };
  }
  const base = await getBase();
  const state = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '').slice(0, 32);
  const callback = chrome.identity.getRedirectURL();
  const device = ('RENDA HUD pe ' + browserName()).slice(0, 60);
  const pkce = await pkcePair();
  const url = base + '/rui/app/connect-device?callback=' + encodeURIComponent(callback)
    + '&state=' + state + '&device=' + encodeURIComponent(device)
    + '&code_challenge=' + pkce.challenge + '&code_challenge_method=S256';
  let redirect;
  try {
    redirect = await chrome.identity.launchWebAuthFlow({ url, interactive: true });
  } catch (e) {
    log('conectare RENDA: ' + (e && e.message));
    return { ok: false, error: 'fereastra de conectare s-a închis fără cheie' };
  }
  const got = parseConnectRedirect(redirect, state, callback);
  if (got.error) return { ok: false, error: got.error };
  const ex = await exchangeCode(base, got.code, pkce.verifier);
  if (ex.error) return { ok: false, error: ex.error };
  let user = ex.user;
  if (!user) {   // raspuns fara cont: il aflam din validare (cheia e deja emisa, deci se pastreaza)
    const v = await validateKey(ex.key, base);
    if (v.valid === false) return { ok: false, error: v.error };
    user = v.user || null;
  }
  await storeKey(ex.key, user, 'device');
  log('conectat la RENDA prin device-connect v2' + (user && user.email ? ' (' + user.email.length + ' caractere email)' : ''));
  return authStatus();
}

// O cheie care nu vine din device-connect (lipita manual / migrata de v4.37.0-dev) nu mai e acceptata.
async function purgeNonDeviceKey() {
  try {
    const s = await chrome.storage.local.get(['rv_api_key', 'rv_key_via']);
    if (s.rv_api_key && s.rv_key_via !== 'device') {
      await chrome.storage.local.remove(AUTH_KEYS);
      await clearRemoteCache();
      log('cheie care nu vine din butonul de conectare — stearsa; conectarea se reface din ⚙ Conexiune');
    }
  } catch (_) {}
}

// Starea conexiunii pentru pagina: FARA cheie.
async function authStatus() {
  const s = await chrome.storage.local.get(AUTH_KEYS);
  const u = s.rv_user || {};
  return { ok: true, connected: !!s.rv_api_key, email: u.email || '', name: u.name || '', when: s.rv_key_when || '', via: s.rv_key_via || '', org: s.rv_org || '', keysUrl: (await getBase()) + '/ui/#/api-keys' };
}

// Comutatorul de organizatie: '' = organizatia implicita a cheii. Cache-ul ramane, fiind pe organizatie.
async function setOrg(org) {
  const v = String(org || '');
  if (v !== '' && !ORG_ID.test(v)) return { ok: false, error: 'organizație invalidă' };
  if (v === '') await chrome.storage.local.remove('rv_org');
  else await chrome.storage.local.set({ rv_org: v });
  return authStatus();
}

// Deconectarea sterge DOAR local: revocarea cheii pe server cere sesiunea de browser RENDA
// (pagina de chei, keysUrl), nu merge cu Bearer.
async function authLogout() {
  await chrome.storage.local.remove(AUTH_KEYS);
  await clearRemoteCache();
  return authStatus();
}

// Date HUD de pe RENDA (/api/hud/*), cu cache in chrome.storage.local. Esecul intoarce
// cache-ul vechi (stale), ca HUD-ul sa ramana utilizabil offline.
async function remoteGet(path, ttlMs) {
  if (!REMOTE_PATH.test(String(path || ''))) return { ok: false, error: 'blocked' };
  const org = await getOrg();
  const ck = CACHE_PREFIX + (org || '-') + ':' + path;
  const cached = (await chrome.storage.local.get(ck))[ck] || null;
  const ttl = typeof ttlMs === 'number' ? ttlMs : 600000;
  if (cached && Date.now() - new Date(cached.when).getTime() < ttl) return { ok: true, data: cached.data, when: cached.when };
  const key = await getKey();
  if (!key) return { ok: false, error: 'neconectat', data: cached ? cached.data : null, stale: !!cached };
  try {
    const res = await fetch((await getBase()) + path, { headers: rendaHeaders(key, org), cache: 'no-store' });
    // organizatia aleasa nu mai e a contului (scos din ea): inapoi la organizatia implicita a cheii
    if (org && (res.status === 403 || res.status === 400)) {
      await chrome.storage.local.remove('rv_org');
      log('organizatia aleasa nu mai e accesibila (HTTP ' + res.status + ') — revin la cea implicita');
      return remoteGet(path, ttlMs);
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = unwrap(await res.json());
    const when = new Date().toISOString();
    await chrome.storage.local.set({ [ck]: { when, data } });
    return { ok: true, data, when };
  } catch (e) {
    return { ok: false, error: (e && e.message) || 'eroare', data: cached ? cached.data : null, when: cached ? cached.when : '', stale: !!cached };
  }
}

// ---------- 1. proxy localhost + RENDA ----------
async function hudFetch(msg) {
  let url = String(msg.url || '');
  const base = await getBase();
  // pagina cere mereu adrese renda.holdings; la test local (rv_base) le mutam pe serverul local
  if (base !== DEFAULT_BASE && url.indexOf(DEFAULT_BASE + '/') === 0) url = base + url.slice(DEFAULT_BASE.length);
  const toRenda = sameOrigin(url, base);
  if (!ALLOWED.test(url) && !toRenda) return { ok: false, error: 'blocked' };
  // v4.37.0: headerele cerute se transmit (inainte erau aruncate => fara token pe RENDA),
  // dar numai cele din lista alba; spre RENDA, cheia din storage are prioritate.
  let headers = {};
  if (msg.headers && typeof msg.headers === 'object') {
    Object.keys(msg.headers).forEach((h) => { if (PASS_HEADERS.includes(h.toLowerCase())) headers[h] = String(msg.headers[h]); });
  }
  if (toRenda) {
    const key = await getKey();
    if (key) headers = rendaHeaders(key, await getOrg());
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), msg.timeout || 1500);
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: ctl.signal, cache: 'no-store' });
    const text = await res.text();
    return { ok: true, status: res.status, text };
  } catch (err) {
    return { ok: false, timeout: !!(err && err.name === 'AbortError') };
  } finally { clearTimeout(timer); }
}

const HANDLERS = {
  hud_fetch: hudFetch,
  rv_auth_connect: () => authConnect(),
  rv_auth_status: () => authStatus(),
  rv_auth_logout: () => authLogout(),
  rv_set_org: (m) => setOrg(m.org),
  rv_remote: (m) => remoteGet(m.path, m.ttl)
};
// Curatenia de la pornire (purgeNonDeviceKey) trebuie sa se termine INAINTE de orice raspuns:
// altfel pagina poate vedea o data "conectat" cu o cheie care urmeaza sa fie stearsa.
let purgeDone = Promise.resolve();
function onHudMsg(msg, sender, sendResponse) {
  const h = msg && HANDLERS[msg.type];
  if (!h) { sendResponse({ ok: false, error: 'blocked' }); return false; }
  purgeDone.then(() => h(msg))
    .then((r) => sendResponse(r))
    .catch((e) => sendResponse({ ok: false, error: (e && e.message) || 'eroare' }));
  return true; // raspuns asincron
}
chrome.runtime.onMessage.addListener(onHudMsg);
if (chrome.runtime.onUserScriptMessage) chrome.runtime.onUserScriptMessage.addListener(onHudMsg);

// ---------- 2. auto-update (strat optional) ----------
function ts() { return new Date().toLocaleTimeString('ro-RO'); }
function log(m) { console.log('[RENDA HUD ' + ts() + '] ' + m); }

function parseVer(src) { const m = src && src.match(/\/\/\s*@version\s+(\S+)/); return m ? m[1] : null; }
function isNewer(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x > y; }
  return false;
}
function wrap(code, ver) {
  return 'console.log("%c[RENDA HUD]","color:#378ADD;font-weight:600","injectat prin userScripts (auto-update), v' + String(ver) + ', pe", location.pathname);\n'
    + 'var __RENDA_VER__=' + JSON.stringify(String(ver)) + ';\n'
    + 'try {\n' + code + '\n} catch (e) { console.error("[RENDA HUD] CRASH la pornire:", e && e.message, "\\n", e && e.stack); }';
}

async function registerCode(code, ver) {
  await chrome.userScripts.configureWorld({ messaging: true });
  const def = { id: SCRIPT_ID, matches: MATCHES, js: [{ code: wrap(code, ver) }], runAt: 'document_idle', world: 'USER_SCRIPT' };
  const existing = await chrome.userScripts.getScripts({ ids: [SCRIPT_ID] });
  if (existing.length) { await chrome.userScripts.update([def]); log('userScript actualizat in registru, v' + ver); return; }
  try {
    await chrome.userScripts.register([def]);
    log('userScript INREGISTRAT, v' + ver + ' — deschide/refresh chatgpt.com');
  } catch (e) {
    if (e && /Duplicate script ID/i.test(e.message || '')) { await chrome.userScripts.update([def]); log('userScript deja inregistrat (cursa) — actualizat, v' + ver); }
    else throw e;
  }
}

// Scoate din registru o inregistrare devenita inutila (ex. pachetul de pe disc a ajuns la
// versiunea care fusese luata de pe GitHub) — altfel baza + userScript = doua injectari.
async function unregisterStale() {
  try {
    const existing = await chrome.userScripts.getScripts({ ids: [SCRIPT_ID] });
    if (existing.length) {
      await chrome.userScripts.unregister({ ids: [SCRIPT_ID] });
      log('userScript scos din registru — baza din pachet (content_scripts) acopera aceeasi versiune');
    }
  } catch (e) { log('unregister: ' + (e && e.message)); }
}

let settled = false;         // stare stabila atinsa in viata acestui service worker
let ensureInFlight = null;   // anti-cursa: o singura evaluare in zbor
let warnedNoApi = false;
let seedCache = null;        // {code, ver} — fisierul din pachet, citit o data

async function readSeed() {
  if (seedCache) return seedCache;
  const code = await (await fetch(chrome.runtime.getURL(SEED_FILE))).text();
  seedCache = { code: code, ver: parseVer(code) || '0.0.0' };
  return seedCache;
}

function ensureRegistered() {
  if (settled) return Promise.resolve(true);
  if (!ensureInFlight) ensureInFlight = doEnsureRegistered().finally(() => { ensureInFlight = null; });
  return ensureInFlight;
}
async function doEnsureRegistered() {
  if (settled) return true;
  if (!chrome.userScripts) {
    if (!warnedNoApi) {
      warnedNoApi = true;
      log(BASE_OK
        ? 'userScripts indisponibil — auto-update in browser INACTIV. HUD-ul ruleaza din pachet (content_scripts), nu e nevoie de nicio setare de browser. OPTIONAL: comutatorul "Allow user scripts" pe cardul extensiei (Chrome/Edge 138+) porneste actualizarea automata de pe GitHub.'
        : 'userScripts indisponibil SI pachetul nu are content_scripts — HUD-ul nu se incarca. Activeaza "Allow user scripts" pe cardul extensiei (Chrome/Edge 138+) sau reinstaleaza un pachet complet.');
    }
    return false;
  }
  try {
    const seed = await readSeed();
    const st = await chrome.storage.local.get(['rv_code', 'rv_ver']);
    let code = st.rv_code, ver = st.rv_ver || '0.0.0';
    // anti-downgrade: samanta din pachet CASTIGA daca e mai noua decat ce e in storage
    // (ex. dupa actualizarea pachetului pe disc, storage-ul poate tine o versiune veche)
    if (!code || isNewer(seed.ver, ver)) {
      code = seed.code; ver = seed.ver;
      await chrome.storage.local.set({ rv_code: code, rv_ver: ver });
      log('samanta din pachet: v' + ver);
    }

    // BAZA acopera cazul normal: injectam prin userScripts DOAR ce e strict mai nou decat ea.
    if (BASE_OK && !isNewer(ver, seed.ver)) {
      await unregisterStale();
      log('baza garantata activa: HUD v' + seed.ver + ' din pachet (content_scripts); userScripts = doar auto-update');
      settled = true;
      return true;
    }

    await registerCode(code, ver);
    settled = true;
    return true;
  } catch (e) {
    log('evaluare inregistrare ESUATA: ' + (e && e.message));
    return false;
  }
}

let lastGithub = 0;
let infoNoUpdate = false;
async function checkGithub() {
  if (!chrome.userScripts) {
    if (!infoNoUpdate) { infoNoUpdate = true; log('auto-update de pe GitHub inactiv (userScripts indisponibil) — HUD-ul ruleaza din pachet; actualizarea vine prin comutatorul "Allow user scripts" (Chrome/Edge 138+) sau reinstalind pachetul (remote_install.bat).'); }
    return;
  }
  if (Date.now() - lastGithub < GITHUB_EVERY_MS) return;
  lastGithub = Date.now();
  try {
    const res = await fetch(RAW_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('GitHub HTTP ' + res.status);
    const code = await res.text();
    const ver = parseVer(code);
    if (!ver) throw new Error('@version negasit');
    if (!/function extHudRequest/.test(code)) throw new Error('userscript fara puntea de extensie — ignorat');
    const st = await chrome.storage.local.get('rv_ver');
    const cur = st.rv_ver || '0.0.0';
    if (!isNewer(ver, cur)) return;
    await chrome.storage.local.set({ rv_code: code, rv_ver: ver, rv_when: new Date().toISOString() });
    await registerCode(code, ver);
    settled = true;
    log('ACTUALIZAT ' + cur + ' -> ' + ver + ' (activ la urmatorul refresh)');
  } catch (e) { log('self-update: ' + (e && e.message)); }
}

function ensureAlarm() { chrome.alarms.get(ALARM, (a) => { if (!a) chrome.alarms.create(ALARM, { periodInMinutes: TICK_MIN }); }); }
async function tick() { const ok = await ensureRegistered(); if (ok) checkGithub(); }

chrome.runtime.onInstalled.addListener(() => {
  settled = false; seedCache = null;   // pachet nou pe disc → re-evalueaza baza vs storage
  purgeDone = purgeNonDeviceKey();
  ensureAlarm();
  if (chrome.userScripts) chrome.userScripts.unregister({ ids: OLD_IDS }).catch(() => {});
  tick();
});
chrome.runtime.onStartup.addListener(() => { ensureAlarm(); tick(); });
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) tick(); });
ensureAlarm();
purgeDone = purgeNonDeviceKey();
tick();
