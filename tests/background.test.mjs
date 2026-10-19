// background.js rulat intr-un vm, cu chrome.* si fetch simulate. Testele trec prin mesaje,
// exact cum le trimite userscript-ul (chrome.runtime.sendMessage).
// Rulare: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'background.js'), 'utf8');
const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop';
const REDIRECT = 'https://' + EXT_ID + '.chromiumapp.org/';

function jsonRes(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

// routes: [(url, init) => response | undefined]; primul care raspunde castiga
function load({ routes = [], authFlow = null, storage = {} } = {}) {
  const store = { ...storage };
  const calls = [];
  let listener = null;
  const get = async (keys) => {
    if (keys === null || keys === undefined) return { ...store };
    const ks = Array.isArray(keys) ? keys : [keys];
    const out = {};
    ks.forEach((k) => { if (k in store) out[k] = store[k]; });
    return out;
  };
  const chrome = {
    storage: { local: {
      get,
      set: async (o) => { Object.assign(store, o); },
      remove: async (keys) => { (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]); }
    } },
    runtime: {
      getManifest: () => ({ version: '4.37.0', content_scripts: [{ js: ['CHATGPT_RENDA_HUD.user.js'] }] }),
      getURL: (p) => 'chrome-extension://' + EXT_ID + '/' + p,
      onMessage: { addListener: (fn) => { listener = fn; } },
      onInstalled: { addListener: () => {} },
      onStartup: { addListener: () => {} },
      reload: () => {}
    },
    alarms: { get: (n, cb) => cb({}), create: () => {}, onAlarm: { addListener: () => {} } },
    identity: authFlow === false ? undefined : {
      getRedirectURL: () => REDIRECT,
      launchWebAuthFlow: async ({ url }) => {
        calls.push({ authUrl: url });
        const state = new URL(url).searchParams.get('state');
        if (!authFlow) throw new Error('The user did not approve access.');
        return authFlow(state, url);
      }
    }
  };
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    for (const r of routes) { const res = r(String(url), init); if (res) return res; }
    throw new TypeError('Failed to fetch');
  };
  const ctx = vm.createContext({
    chrome, fetch, console: { log: () => {}, error: () => {} }, navigator: { userAgent: 'Chrome/140' },
    crypto: globalThis.crypto, URL, AbortController, setTimeout, clearTimeout, Promise, Date, JSON,
    btoa, TextEncoder, Uint8Array
  });
  vm.runInContext(SRC, ctx);
  const send = (msg) => new Promise((resolve) => { listener(msg, {}, resolve); });
  return { send, store, calls };
}

const VALIDATE_OK = (url) => url.endsWith('/api/auth/api-key/validate')
  ? jsonRes(200, { ok: true, data: { valid: true, user: { id: 'u1', email: 'ana@vego.ro', name: 'Ana' } } }) : undefined;

// Serverul RENDA simulat pentru v2: tine minte provocarea PKCE din URL-ul de connect, emite un
// cod o singura data si il schimba pe cheie DOAR cu verificatorul corect (ca serverul real).
const CODE = 'c0de_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmn';   // 43+ caractere, ca DEVICE_CODE_SHAPE
function renda(opts = {}) {
  const srv = { challenge: null, used: false, exchanges: 0 };
  srv.authFlow = (state, authUrl) => {
    const u = new URL(authUrl);
    srv.challenge = u.searchParams.get('code_challenge');
    srv.method = u.searchParams.get('code_challenge_method');
    return opts.redirect ? opts.redirect(state) : REDIRECT + '?code=' + CODE + '&state=' + state;
  };
  srv.route = (url, init) => {
    if (!url.endsWith('/api/account/device-connect/token')) return undefined;
    srv.exchanges++;
    const body = JSON.parse(init.body);
    srv.bodyKeys = Object.keys(body).sort().join(',');
    const expected = createHash('sha256').update(body.code_verifier).digest('base64url');
    if (body.code !== CODE || srv.used || expected !== srv.challenge) {
      return jsonRes(400, { ok: false, error: { code: 'invalid_grant' } });
    }
    srv.used = true;
    return jsonRes(200, { ok: true, data: { key: 'rk_abcdef123456', expires_at: '2027-09-23T00:00:00Z', account: opts.noAccount ? undefined : { email: 'ana@vego.ro', name: 'Ana' } } });
  };
  return srv;
}

test('puntea respinge adrese din afara listei', async () => {
  const { send } = load();
  assert.equal((await send({ type: 'hud_fetch', url: 'https://evil.example/x' })).error, 'blocked');
  assert.equal((await send({ type: 'nimic' })).error, 'blocked');
});

test('puntea ataseaza Bearer din storage DOAR spre RENDA si arunca headerele nepermise', async () => {
  const { send, calls } = load({
    storage: { rv_api_key: 'rk_secret12345', rv_key_via: 'device' },
    routes: [() => ({ ok: true, status: 200, text: async () => '{}' })]
  });
  await send({ type: 'hud_fetch', url: 'https://renda.holdings/api/sett/lists', headers: { 'X-API-Key': 'vechi', Cookie: 'x' } });
  const r = calls.find((c) => c.url.startsWith('https://renda.holdings'));
  assert.deepEqual({ ...r.init.headers }, { Authorization: 'Bearer rk_secret12345' });

  await send({ type: 'hud_fetch', url: 'http://127.0.0.1:8765/sysmon', headers: { 'X-API-Key': 'k', Cookie: 'x' } });
  const l = calls.find((c) => c.url.startsWith('http://127.0.0.1'));
  assert.deepEqual({ ...l.init.headers }, { 'X-API-Key': 'k' }, 'cheia RENDA nu pleaca spre serverul local');
});

test('device-connect v2: cod + PKCE -> cheia ajunge in storage, dar NU in raspunsul catre pagina', async () => {
  const srv = renda();
  const { send, store, calls } = load({ routes: [srv.route], authFlow: srv.authFlow });
  const r = await send({ type: 'rv_auth_connect' });
  assert.equal(r.ok, true, r.error);
  assert.equal(r.connected, true);
  assert.equal(r.email, 'ana@vego.ro');
  assert.ok(!JSON.stringify(r).includes('rk_abcdef123456'), 'cheia a scapat spre pagina');
  assert.equal(store.rv_api_key, 'rk_abcdef123456');
  assert.equal(store.rv_key_via, 'device');
  const auth = new URL(calls.find((c) => c.authUrl).authUrl);
  assert.equal(auth.origin + auth.pathname, 'https://renda.holdings/rui/app/connect-device');
  assert.equal(auth.searchParams.get('callback'), REDIRECT);
  assert.match(auth.searchParams.get('state'), /^[A-Za-z0-9_-]{16,128}$/);
  assert.ok(auth.searchParams.get('device').length <= 60);
  assert.equal(srv.method, 'S256');
  assert.match(srv.challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(!auth.searchParams.has('code_verifier'), 'verificatorul nu pleaca in URL');
  assert.equal(srv.exchanges, 1);
  assert.equal(srv.bodyKeys, 'code,code_verifier', 'corpul schimbului = exact DEVICE_CONNECT_TOKEN_BODY de pe server');
  assert.ok(!calls.some((c) => c.url && c.url.endsWith('/validate')), 'contul vine din schimb, fara validare separata');
});

// asa raspunde serverul RENDA azi (DEVICE_CONNECT_exchange intoarce doar { key })
test('device-connect v2: schimbul fara cont in raspuns cade pe validarea cheii', async () => {
  const srv = renda({ noAccount: true });
  const { send, store } = load({ routes: [srv.route, VALIDATE_OK], authFlow: srv.authFlow });
  const r = await send({ type: 'rv_auth_connect' });
  assert.equal(r.email, 'ana@vego.ro');
  assert.equal(store.rv_api_key, 'rk_abcdef123456');
});

test('device-connect v2: state gresit, refuz, cheie in URL (v1), cod invalid, alta adresa, fereastra inchisa', async () => {
  const cases = [
    [() => REDIRECT + '?code=' + CODE + '&state=altceva', /state/],
    [(s) => REDIRECT + '?error=access_denied&state=' + s, /refuzat/],
    [(s) => REDIRECT + '?key=rk_abcdef123456&state=' + s, /flux vechi/],
    [(s) => REDIRECT + '?code=scurt&state=' + s, /cod de conectare valid/],
    [(s) => 'https://altundeva.example/?code=' + CODE + '&state=' + s, /alt/],
    [null, /închis/]
  ];
  for (const [redirect, err] of cases) {
    const srv = renda({ redirect: redirect || undefined });
    const { send, store } = load({ routes: [srv.route], authFlow: redirect === null ? null : srv.authFlow });
    const r = await send({ type: 'rv_auth_connect' });
    assert.equal(r.ok, false);
    assert.match(r.error, err);
    assert.equal(store.rv_api_key, undefined);
    assert.equal(srv.exchanges, 0, 'nu se schimba niciun cod dupa un raspuns respins');
  }
});

test('device-connect v2: RENDA respinge schimbul (cod expirat/folosit) => nimic salvat, mesaj clar', async () => {
  const srv = renda();
  srv.used = true;   // codul a fost deja consumat
  const { send, store } = load({ routes: [srv.route], authFlow: srv.authFlow });
  const r = await send({ type: 'rv_auth_connect' });
  assert.equal(r.ok, false);
  assert.match(r.error, /expirat|folosit/);
  assert.equal(store.rv_api_key, undefined);
});

test('fara chrome.identity: eroare clara, fara crash', async () => {
  const { send } = load({ authFlow: false });
  const r = await send({ type: 'rv_auth_connect' });
  assert.equal(r.ok, false);
  assert.match(r.error, /nu permite/);
});

test('un singur drum: cheia lipita nu mai e acceptata, iar una care nu vine din buton se sterge la pornire', async () => {
  const a = load();
  assert.equal((await a.send({ type: 'rv_auth_set_key', key: 'rk_xxxxxxxxxxxx' })).error, 'blocked');
  assert.equal(a.store.rv_api_key, undefined);

  for (const via of ['manual', undefined]) {
    const b = load({ storage: { rv_api_key: 'rk_vechi123456', rv_key_via: via, rv_user: { email: 'x@y' }, 'rv_cache:/api/hud/me': { when: '2000-01-01', data: {} } } });
    const st = await b.send({ type: 'rv_auth_status' });
    assert.equal(st.connected, false, 'cheia ' + via + ' trebuia stearsa');
    assert.equal(b.store.rv_api_key, undefined);
    assert.equal(b.store['rv_cache:/api/hud/me'], undefined);
  }

  const c = load({ storage: { rv_api_key: 'rk_buton123456', rv_key_via: 'device' } });
  assert.equal((await c.send({ type: 'rv_auth_status' })).connected, true, 'cheia din buton ramane');
});

test('rv_remote: doar /api/hud/*, cu cache, iar la eroare intoarce cache-ul vechi', async () => {
  let n = 0;
  const { send, store } = load({
    storage: { rv_api_key: 'rk_secret12345', rv_key_via: 'device' },
    routes: [(u) => u === 'https://renda.holdings/api/hud/config' ? (++n === 1 ? jsonRes(200, { ok: true, data: { version: 1 } }) : jsonRes(500, {})) : undefined]
  });
  assert.equal((await send({ type: 'rv_remote', path: '/api/sett/lists' })).error, 'blocked');
  assert.deepEqual({ ...(await send({ type: 'rv_remote', path: '/api/hud/config', ttl: 60000 })).data }, { version: 1 });
  await send({ type: 'rv_remote', path: '/api/hud/config', ttl: 60000 });
  assert.equal(n, 1, 'a doua cerere trebuia servita din cache');
  const stale = await send({ type: 'rv_remote', path: '/api/hud/config', ttl: 0 });
  assert.equal(stale.ok, false);
  assert.equal(stale.stale, true);
  assert.equal(stale.data.version, 1);
  assert.ok(store['rv_cache:-:/api/hud/config'], 'cache-ul e pe organizatie (- = cea implicita a cheii)');
});

test('deconectarea sterge cheia si cache-ul, iar rv_remote devine "neconectat"', async () => {
  const { send, store } = load({ storage: { rv_api_key: 'rk_secret12345', rv_key_via: 'device', rv_user: { email: 'a@b' }, 'rv_cache:/api/hud/me': { when: '2000-01-01', data: {} } } });
  const r = await send({ type: 'rv_auth_logout' });
  assert.equal(r.connected, false);
  assert.equal(store.rv_api_key, undefined);
  assert.equal(store['rv_cache:/api/hud/me'], undefined);
  assert.equal((await send({ type: 'rv_remote', path: '/api/hud/me' })).error, 'neconectat');
});

test('rv_base schimbat (dev local) muta si tinta device-connect si atasarea cheii', async () => {
  const { send, calls } = load({
    storage: { rv_base: 'http://localhost:3000/', rv_api_key: 'rk_secret12345', rv_key_via: 'device' },
    routes: [() => ({ ok: true, status: 200, text: async () => '{}' })]
  });
  await send({ type: 'hud_fetch', url: 'http://localhost:3000/api/sett/lists' });
  assert.equal(calls[0].init.headers.Authorization, 'Bearer rk_secret12345');
  // pagina cere mereu renda.holdings; la test local cererea ajunge pe serverul local
  await send({ type: 'hud_fetch', url: 'https://renda.holdings/api/sett/lists?x=1' });
  assert.equal(calls[1].url, 'http://localhost:3000/api/sett/lists?x=1');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer rk_secret12345');
  const st = await send({ type: 'rv_auth_status' });
  assert.equal(st.keysUrl, 'http://localhost:3000/ui/#/api-keys');
});

test('organizatia (HUD-7): aleasa in comutator, pleaca in x-renda-tenant spre RENDA, cu cache separat', async () => {
  const seen = [];
  const { send, store, calls } = load({
    storage: { rv_api_key: 'rk_secret12345', rv_key_via: 'device' },
    routes: [(u, init) => {
      if (u !== 'https://renda.holdings/api/hud/config') return undefined;
      const org = (init.headers || {})['x-renda-tenant'] || '';
      seen.push(org);
      return jsonRes(200, { ok: true, data: { org: { id: org || 'implicita' } } });
    }]
  });
  assert.equal((await send({ type: 'rv_set_org', org: 'nu bun!' })).ok, false, 'un id de organizatie invalid e refuzat');
  const a = await send({ type: 'rv_remote', path: '/api/hud/config', ttl: 60000 });
  assert.equal(a.data.org.id, 'implicita');
  const st = await send({ type: 'rv_set_org', org: 'org_b' });
  assert.equal(st.org, 'org_b');
  const b = await send({ type: 'rv_remote', path: '/api/hud/config', ttl: 60000 });
  assert.equal(b.data.org.id, 'org_b', 'organizatia noua nu ia cache-ul celeilalte');
  assert.deepEqual(seen, ['', 'org_b']);
  assert.ok(store['rv_cache:-:/api/hud/config'] && store['rv_cache:org_b:/api/hud/config']);
  // puntea (hud_fetch) trimite si ea organizatia, doar spre RENDA
  await send({ type: 'hud_fetch', url: 'https://renda.holdings/api/hud/directory' });
  const last = calls.filter((c) => c.url === 'https://renda.holdings/api/hud/directory').pop();
  assert.equal(last.init.headers['x-renda-tenant'], 'org_b');
  // deconectarea uita si organizatia
  await send({ type: 'rv_auth_logout' });
  assert.equal(store.rv_org, undefined);
});

test('organizatia aleasa nu mai e a contului (403): revine la cea implicita si reincearca o data', async () => {
  const { send, store } = load({
    storage: { rv_api_key: 'rk_secret12345', rv_key_via: 'device', rv_org: 'fosta' },
    routes: [(u, init) => u === 'https://renda.holdings/api/hud/config'
      ? ((init.headers || {})['x-renda-tenant'] ? jsonRes(403, {}) : jsonRes(200, { ok: true, data: { org: { id: 'implicita' } } }))
      : undefined]
  });
  const r = await send({ type: 'rv_remote', path: '/api/hud/config', ttl: 60000 });
  assert.equal(r.data.org.id, 'implicita');
  assert.equal(store.rv_org, undefined);
});
