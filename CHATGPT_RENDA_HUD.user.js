// ==UserScript==
// @name         RENDA VIGILIA HUD pentru ChatGPT
// @namespace    renda.vego.virgil.profeanu
// @version      4.47.0
// Istoricul complet al versiunilor: CHANGELOG.md
// v4.37.0 (2026-09-23): CONECTARE LA RENDA + date de pe server. (1) Buton "🔑 Conecteaza-te la
// RENDA" (dreapta barei / panoul Proiecte): device-connect v2 — callback https://<id>.chromiumapp.org/ prins de
// chrome.identity, intoarcere cu COD DE UNICA FOLOSINTA schimbat pe cheie cu PKCE (Faza 2 din
// docs/SERVER_SPEC_HUD.md; cheia nu apare niciodata in URL); cheia rk_ sta DOAR in
// background.js (chrome.storage.local), nu mai ajunge in localStorage-ul paginii — cheia veche se
// muta automat. Puntea ataseaza singura Bearer spre RENDA (reparat: headerele erau aruncate).
// (2) /api/hud/config (agenti, plugins, misiuni, teze, SHKN, sablon Azure) si /api/hud/me
// (rolul + boot-ul contului + modelul de rol) inlocuiesc datele din pachet cand exista; altfel
// raman embed-urile. boot_meta se aplica pe bucati (models / steps), ca un raspuns partial sa nu
// stearga modelele de rol.
// (3) Auto-update-ul pe disc (task Windows + update.ps1) eliminat. (4) Un singur drum de conectare
// (butonul); fara cheie lipita manual, setarile vechi din pagina se sterg. (5) B4: registrul BOOT
// (73 de angajati) scos din pachet — cardul "Misiunea mea" arata rolul DOAR dupa conectare.
// (6) NICIO data a organizatiei in cod: SHKN, agenti, plugins, teze, modele, misiuni pe categorie,
// tabelul functie->categorie, blocul BOOT general, sablonul Azure si canonul vin din RENDA
// (/api/hud/config + /api/hud/canon), cu cache pana la deconectare. In cod raman doar textele de
// interfata (sabloanele Prompt, Ziua mea, fraza de final a boot-ului, preambulul SHKN). 830 KB -> 210 KB.
// @description  Bara RENDA/VIGILIA peste ChatGPT: agenți, SHKN, misiune și canon din RENDA (după conectare). Canonul citește textul de trimis și îl trimite doar serverului HUD local (127.0.0.1) pentru selecție; conversațiile nu pleacă spre RENDA.
// @author       Codex (GPT) v1 + Claude v2_cl/v3_cl pentru Virgil Profeanu
// @icon         https://raw.githubusercontent.com/virgilprofeanu/renda-chatgpt-hud/main/icon128.png
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @connect      renda.holdings
// @updateURL    https://raw.githubusercontent.com/virgilprofeanu/renda-chatgpt-hud/main/CHATGPT_RENDA_HUD.user.js
// @downloadURL  https://raw.githubusercontent.com/virgilprofeanu/renda-chatgpt-hud/main/CHATGPT_RENDA_HUD.user.js
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  if (window.top !== window.self) return;

  // v4.9.7: garda anti-dubla-montare. HUD-ul poate sosi pe mai multe cai simultan
  // (content_scripts de pe disc + overlay userScripts cu versiunea noua + eventual
  // Tampermonkey) — se monteaza DOAR prima instanta; restul se retrag tacut.
  // (2026-07-24) Claim-ul poarta ACUM eticheta rutei care a montat (TM = Tampermonkey /
  // US-<ver> = overlay chrome.userScripts / CS-<ver> = content script de pe disc) + un log
  // OPT-IN (localStorage.setItem('rvDebug','1')) pe instanta care cedeaza: un `return` mut
  // arata identic cu "HUD spart", asa ca in F12 se vede CINE ruleaza si CINE s-a retras.
  // De ce tine la cursa: cele doua rute stau in LUMI diferite (izolata vs USER_SCRIPT) si NU
  // impart window — dar impart <html>. Citirea + scrierea atributului sunt SINCRONE si sunt
  // primul lucru executat, deci nu exista fereastra in care ambele sa treaca de test.
  // Compatibil in ambele sensuri cu garda veche (valoarea '1'): testul e doar existenta.
  try {
    var rvRoute = 'CS';
    try { if (typeof GM_info !== 'undefined' && GM_info) rvRoute = 'TM'; } catch (_) {}
    try { if (rvRoute === 'CS' && typeof __RENDA_VER__ !== 'undefined' && __RENDA_VER__) rvRoute = 'US-' + __RENDA_VER__; } catch (_) {}
    try { if (rvRoute === 'CS') { var rvMv = chrome.runtime.getManifest().version; if (rvMv) rvRoute = 'CS-' + rvMv; } } catch (_) {}
    var rvHeldBy = document.documentElement.getAttribute('data-rv-hud-loaded');
    if (rvHeldBy !== null) {
      try {
        if (localStorage.getItem('rvDebug') === '1') {
          console.log('%c[RENDA HUD]', 'color:#378ADD;font-weight:600', 'instanta ' + rvRoute + ' CEDEAZA — HUD deja montat de: ' + (rvHeldBy || '?'));
        }
      } catch (_) {}
      return;
    }
    document.documentElement.setAttribute('data-rv-hud-loaded', rvRoute);
  } catch (_) {}

  // v4.9.5: DIAGNOSTIC — loguri in consola tab-ului (F12). Opt-in ca sa nu spameze colegii:
  // se aprind cu  localStorage.setItem('rvDebug','1')  + refresh; se sting cu '0'. NU se
  // logheaza NICIODATA textul din composer/conversatie (doar lungimi/status — confidentialitate).
  const RV_DEBUG = (function () { try { return localStorage.getItem('rvDebug') === '1'; } catch (_) { return false; } })();
  function rvlog() { if (!RV_DEBUG) return; try { console.log.apply(console, ['%c[RENDA HUD]', 'color:#378ADD;font-weight:600'].concat([].slice.call(arguments))); } catch (_) {} }

  // v4.9.3: punte pentru MEDIUL DE EXTENSIE Chrome — echivalentul GM_xmlhttpRequest cand
  // scriptul ruleaza ca content script MV3 (CORS-ul paginii interzice fetch direct spre
  // 127.0.0.1; service worker-ul extensiei, cu host_permissions, poate). In Tampermonkey
  // functia exista dar nu e folosita niciodata (GM_xmlhttpRequest are prioritate).
  function extHudRequest(opts) {
    const t0 = Date.now();
    const tag = (opts.url || '').split('/').pop().split('?')[0] || opts.url;
    rvlog('→ extHudRequest', tag);
    try {
      chrome.runtime.sendMessage({ type: 'hud_fetch', url: opts.url, headers: opts.headers || null, timeout: opts.timeout || 1500 }, (res) => {
        if (chrome.runtime.lastError || !res) {
          rvlog('✗ extHudRequest', tag, chrome.runtime.lastError ? ('lastError: ' + chrome.runtime.lastError.message) : 'fara raspuns de la background');
          if (opts.onerror) opts.onerror();
          return;
        }
        if (res.ok) { rvlog('✓ extHudRequest', tag, 'HTTP ' + res.status, (Date.now() - t0) + 'ms', (res.text || '').length + 'B'); if (opts.onload) opts.onload({ responseText: res.text, status: res.status }); }
        else if (res.timeout) { rvlog('⏱ extHudRequest', tag, 'timeout'); if (opts.ontimeout) opts.ontimeout(); else if (opts.onerror) opts.onerror(); }
        else { rvlog('✗ extHudRequest', tag, 'blocat/eroare la background:', res.error || '?'); if (opts.onerror) opts.onerror(); }
      });
    } catch (e) { rvlog('✗ extHudRequest', tag, 'exceptie:', e && e.message); if (opts.onerror) opts.onerror(); }
  }
  // escapare HTML pentru textele puse in innerHTML — o singura definitie, folosita de toate panourile
  function esc(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c])); }

  function extRuntimeOk() {
    // NU cere chrome.runtime.id: in lumea USER_SCRIPT (chrome.userScripts) id lipseste,
    // dar sendMessage exista daca world-ul are messaging activat (configureWorld).
    try { return typeof chrome !== 'undefined' && !!(chrome.runtime && typeof chrome.runtime.sendMessage === 'function'); } catch (_) { return false; }
  }

  const CONFIG = {
    // v4.47.0 (HUD-7): numele din bara, linkurile si toate cuvintele vin din /api/hud/config al organizatiei
    rendaHudUrl: 'http://localhost:8765/',
    sysmonUrl: 'http://127.0.0.1:8765/sysmon',
    canonUrl: 'http://127.0.0.1:8765/canon_select',
    // proiectele si oamenii organizatiei (background.js o muta pe rv_base la test local)
    hudDataUrlDefault: 'https://renda.holdings/api/hud/directory',
    sysmonIntervalMs: 2000
  };

  const HUD_ID = 'renda-vigilia-chatgpt-hud';
  const STYLE_ID = 'renda-vigilia-chatgpt-style';
  const ROOT_CLASS = 'renda-chatgpt-root';
  const VIEWPORT_CLASS = 'renda-chatgpt-viewport-shell';
  const MODE_SWITCH_CLASS = 'renda-chatgpt-mode-switch';
  const STORAGE_KEY = 'rendaVigiliaHudCollapsed';
  const PP_KEY = 'rendaVigiliaPerpetualPrompt';
  const PANEL_ID = 'renda-vigilia-pp-panel';
  const AG_PANEL_ID = 'renda-vigilia-ag-panel';
  const SHKN_PANEL_ID = 'renda-vigilia-shkn-panel';   // v4.14: Shared HUMAN Knowledge
  // v4.9.17: panoul SETT (setari): API key + URL-ul API-ului de date; cache-ul raspunsului
  const SETT_PANEL_ID = 'renda-vigilia-sett-panel';
  const API_URL_KEY = 'rendaVigiliaApiUrl';
  const API_KEY_KEY = 'rendaVigiliaApiKey';
  const API_DATA_KEY = 'rendaVigiliaApiData';
  const AZ_TPL_KEY = 'rendaVigiliaAzureTpl'; // v4.9.26: sablon link Azure Storage Explorer ({cod})
  // v4.9.30: cardul "Misiunea mea" (dreapta, deschis implicit) + tab Misiuni in SETT
  const MIS_PANEL_ID = 'renda-vigilia-mis-panel';
  const MIS_F_KEY = 'rendaVigiliaMisFunctie';
  const MIS_CLOSED_KEY = 'rendaVigiliaMisInchisAzi';
  const MIS_EMAIL_KEY = 'rendaVigiliaUserEmail';
  const MIS_NAME_KEY = 'rendaVigiliaUserName'; // v4.9.31: numele contului logat (afisat pe card)
  const BOOT_SEL_KEY = 'rendaVigiliaBootSel';  // v4.9.33: ID-ul de rol ales manual pt. boot session
  /*__RENDA_AGENTS_DATA_START__*/
  // v4.37.0: fara date de organizatie in cod — vine din /api/hud/config (dupa conectare)
  let RV_AGENTS = {"agents":[],"external":[],"skills":[]};
  /*__RENDA_AGENTS_DATA_END__*/
  /*__RENDA_SHKN_DATA_START__*/
  // v4.37.0: fara date de organizatie in cod — vine din /api/hud/config (dupa conectare)
  let RV_SHKN = {"items":[]};
  /*__RENDA_SHKN_DATA_END__*/
  /*__RENDA_PLUGINS_DATA_START__*/
  // catalogul PLUGINS: [{n, id, d, k: [[skill, descriere, comanda, nota]], g: [taguri]}] (formatul v4.43);
  // un plugin cu mai multe skilluri = cate o comanda de invocare pe skill.
  // v4.37.0: fara date de organizatie in cod — vine din /api/hud/config (dupa conectare)
  let RV_PLUGINS = [];
  /*__RENDA_PLUGINS_DATA_END__*/
  /*__RENDA_MISSIONS_DATA_START__*/
  // v4.9.30: misiuni + primele 3 actiuni PE CATEGORII DE FUNCTIE (seed din XLSX
  // "Misiuni si actiuni 20210909", foaia "misiuni generale"). Misiunile INDIVIDUALE
  // vin numai de pe API (employees[].mission/actions) si au prioritate.
  // v4.37.0: fara date de organizatie in cod — vine din /api/hud/config (dupa conectare)
  let RV_MISSIONS = [];
  /*__RENDA_MISSIONS_DATA_END__*/
  /*__RENDA_BOOT_DATA_START__*/
  // v4.9.45: forma unei intrari BOOT {i: ID rol, n: angajat, d: departament, f: functie,
  // dv: diviziune Ed2, rs: rol subsidiar (Board), sc: stadiu competenta, t: tip rol,
  // c: coordonator, b: textul de boot, st: statut} + foile MODELE_ROL si INSTRUCTIUNI (RV_BOOT_META).
  // v4.37.0 (B4): registrul NU mai sta in pachet (repo public, date personale). Rolul si boot-ul
  // vin DOAR din /api/hud/me, pentru contul conectat. Sursa pentru import: pachetul renda-hud-seed.
  const RV_BOOT = [];
  // v4.37.0: fara date de organizatie in cod — vine din /api/hud/config (dupa conectare)
  let RV_BOOT_META = {"models":[],"steps":[]};
  /*__RENDA_BOOT_DATA_END__*/
  /*__RENDA_TEZE_DATA_START__*/
  // v4.9.39: TEZELE VEGO integrale (3 teze x 10 principii, 3.1-3.30, furnizate 2026-07-17):
  // afisate pe cardul 🎯 langa BOOT si incluse la inserarea in composer
  // (boot -> teze -> instructiunea finala).
  // v4.37.0: fara date de organizatie in cod — vine din /api/hud/config (dupa conectare)
  let RV_TEZE = {"title":"","teze":[]};
  /*__RENDA_TEZE_DATA_END__*/
  const CANON_KEY = 'rendaVigiliaCanonOn';     // v3.3: ON/OFF injectie canon per-tura (default ON)
  const UDIR_KEY = 'rendaVigiliaUserDirective'; // v3.7: directiva canon a userului (capsula USER DIRECTIVE)
  const IDENT_KEY = 'rendaVigiliaSessionIdentity'; // v3.9: identitatea userului (Nume Prenume) — declaratie de sesiune
  // v4.27.0 — envelope canonic RENDA_TRAINSDOING_HUD_V1 (decizia autorului 2026-08-04).
  // Markerul anti-dubla-injectie ESTE linia BEGIN a envelope-ului => garda si emisia nu pot diverge.
  const CANON_MARK = '[RENDA_TRAINSDOING_HUD_V1_BEGIN]';   // marker anti-dubla-injectie in acelasi mesaj
  const ENV_END    = '[RENDA_TRAINSDOING_HUD_V1_END]';
  // v3.10: versiunea + momentul build-ului, AFISATE IN BANDA (auditabilitate: banda arata versiunea
  // codului care RULEAZA in acest tab — daca difera de ce e in Tampermonkey, tabul e vechi -> reload).
  const RUNNING_VER = (function () {
    try { if (GM_info && GM_info.script && GM_info.script.version) return GM_info.script.version; } catch (_) {}
    // __RENDA_VER__ e injectat de background.js la inregistrarea prin chrome.userScripts
    // (in lumea USER_SCRIPT nu exista chrome.runtime.getManifest)
    try { if (typeof __RENDA_VER__ !== 'undefined' && __RENDA_VER__) return __RENDA_VER__; } catch (_) {}
    try { return chrome.runtime.getManifest().version || '?'; } catch (_) { return '?'; }
  })();
  const BUILD_STAMP = '2026-10-19-15:00:00';   // aaaa-ll-zz-hh:mm:ss — se re-baga la fiecare release

  // v4.47.0 — EXTENSIA FARA DATE (HUD-7). Tot ce afiseaza HUD-ul vine din /api/hud/config al organizatiei in
  // care lucrezi: cuvintele interfetei (labels), linkurile, numele din bara (branding), sabloanele ⚡ Prompt, textele,
  // sinonimele cautarii si functiile pornite (features). In cod raman DOAR cuvintele de dinaintea conectarii (RV_PRE):
  // atunci extensia nu stie inca organizatia. La schimbarea organizatiei, totul se reincarca.
  let TEMPLATES = [];       // [[titlu, text, grup]]
  let RV_L = {};            // cuvintele interfetei, pe chei
  let RV_LINKS = [];        // [[text, cale]] spre paginile ChatGPT
  let RV_BRAND = {};        // {title, system, subtitle, command_title, command_subtitle}
  let RV_TEXTS = {};        // {boot_footer, day_text, shkn_owner}
  let RV_SYNONYMS = [];     // [{label, terms}]
  let RV_FEATURES = {};     // {skill_lockdown}
  let rvShknContact = '';   // cui i se trimite o propunere SHKN
  let rvOrg = null;         // {id, name}: organizatia in care lucrezi
  let rvOrgs = [];          // organizatiile contului, pentru comutator
  let rvCfgLoaded = false;  // a sosit macar o data configuratia organizatiei
  const RV_PRE = {
    brand: 'RENDA',
    connect: 'Conectează-te la RENDA',
    connect_title: 'Deschide RENDA: te autentifici și apeși Connect',
    connecting: 'se încarcă…',
    no_ext: 'Conectarea la RENDA merge doar în extensia Chrome/Edge.',
    legacy: 'Extensia are nevoie de pachetul nou — reinstalează RENDA HUD.',
    no_reply: 'extensia nu răspunde'
  };
  // cuvantul de la cheia k; {nume} din text se inlocuieste cu vars.nume
  function L(k, vars) {
    let t = RV_L[k];
    if (typeof t !== 'string') t = '';
    if (vars) Object.keys(vars).forEach((v) => { t = t.split('{' + v + '}').join(String(vars[v])); });
    return t;
  }
  // elementele construite o singura data poarta cheia in atribut; se rescriu la fiecare configuratie noua
  function refreshLabels(root) {
    const r = root || document;
    const sel = (a) => '#' + HUD_ID + ' [' + a + '], [id^="renda-vigilia-"] [' + a + ']';
    r.querySelectorAll(sel('data-rvl')).forEach((el) => { el.textContent = L(el.getAttribute('data-rvl')); });
    r.querySelectorAll(sel('data-rvlt')).forEach((el) => { el.title = L(el.getAttribute('data-rvlt')); });
    r.querySelectorAll(sel('data-rvlp')).forEach((el) => { el.placeholder = L(el.getAttribute('data-rvlp')); });
    r.querySelectorAll(sel('data-rvla')).forEach((el) => { el.setAttribute('aria-label', L(el.getAttribute('data-rvla'))); });
  }

  const css = String.raw`
    :root.renda-vigilia-theme {
      --rv-bg: #0d0f12;
      --rv-panel: #15181d;
      --rv-panel-2: #1b1f26;
      --rv-line: #262b33;
      --rv-text: #e7e9ee;
      --rv-text-2: #9aa3b0;
      --rv-text-3: #646c78;
      --rv-blue: #378ADD;
      --rv-blue-2: #1b3a57;
      --rv-violet: #7F77DD;
      --rv-violet-2: #2a2752;
      --rv-green: #1D9E75;
      --rv-amber: #BA7517;
      --rv-hud-height: 78px;
      /* v4.37.0: culorile regulilor HUD ca variabile — valorile de aici sunt tema INCHISA (exact cele de dinainte) */
      --rv-k-06090d: #06090d;
      --rv-k-090c10: #090c10;
      --rv-k-0a0f16: #0a0f16;
      --rv-k-0b0f17: #0b0f17;
      --rv-k-0d1117: #0d1117;
      --rv-k-0e1218: #0e1218;
      --rv-k-101622: #101622;
      --rv-k-101724: #101724;
      --rv-k-121824: #121824;
      --rv-k-131922: #131922;
      --rv-k-16202f: #16202f;
      --rv-k-1c222b: #1c222b;
      --rv-k-1d2635: #1d2635;
      --rv-k-232b38: #232b38;
      --rv-k-253046: #253046;
      --rv-k-2a3242: #2a3242;
      --rv-k-378add: #378ADD;
      --rv-k-39424f: #39424f;
      --rv-k-3a3470: #3a3470;
      --rv-k-7ee2a8: #7ee2a8;
      --rv-k-7fb3e8: #7fb3e8;
      --rv-k-8a93a0: #8a93a0;
      --rv-k-8fa8d6: #8fa8d6;
      --rv-k-8fd3ff: #8fd3ff;
      --rv-k-8fd49a: #8fd49a;
      --rv-k-9aa3ad: #9aa3ad;
      --rv-k-9aa3b0: #9aa3b0;
      --rv-k-9aa8ba: #9aa8ba;
      --rv-k-9cc6f3: #9cc6f3;
      --rv-k-b9a7ff: #b9a7ff;
      --rv-k-b9dcff: #b9dcff;
      --rv-k-bcb6f5: #bcb6f5;
      --rv-k-c9d2de: #c9d2de;
      --rv-k-cfe4ff: #cfe4ff;
      --rv-k-d8a75b: #d8a75b;
      --rv-k-dfeaff: #dfeaff;
      --rv-k-e0b24c: #e0b24c;
      --rv-k-e7e9ee: #e7e9ee;
      --rv-k-e8c07a: #e8c07a;
      --rv-k-f09595: #f09595;
      --rv-k-ffd27a: #ffd27a;
      --rv-k-ffd9a0: #ffd9a0;
      --rv-k-ffe2b0: #ffe2b0;
      --rv-k-6f8fb8: #6f8fb8;
      --rv-k-0d131c: #0d131c;
      --rv-k-ff9a8a: #ff9a8a;
      --rv-k-shadow: rgba(0,0,0,.55);
      --rv-k-btn55: rgba(20,40,60,.55);
      --rv-k-btn62: rgba(20,40,60,.62);
      --rv-k-amb35: rgba(60,40,10,.35);
      --rv-k-amb45: rgba(60,40,12,.45);
      --rv-k-amb50: rgba(60,40,15,.5);
      --rv-k-red35: rgba(90,29,29,.35);
      --rv-k-offbar: #5a1d1d;
      --rv-k-hot: #e06c6c;
    }

    /* v4.37.0: tema DESCHISA a HUD-ului (bara + panouri). Se aplica prin data-rv-theme="light" pe <html>,
       ales din butonul "◐ Temă" (auto = urmeaza tema ChatGPT). Pagina ChatGPT nu e atinsa. */
    :root.renda-vigilia-theme[data-rv-theme='light'] {
      --rv-bg: #F4F6F8;
      --rv-panel: #FFFFFF;
      --rv-panel-2: #F1F4F7;
      --rv-line: #D8DEE5;
      --rv-text: #0F1720;
      --rv-text-2: #4A5563;
      --rv-text-3: #5B6573;
      --rv-blue: #1F6FD1;
      --rv-blue-2: #DCE9FA;
      --rv-violet: #5E54C9;
      --rv-violet-2: #E7E4FA;
      --rv-green: #127A57;
      --rv-amber: #A86A00;
      --rv-k-06090d: #F4F7FB;
      --rv-k-090c10: #FFFFFF;
      --rv-k-0a0f16: #F7F9FB;
      --rv-k-0b0f17: #FFFFFF;
      --rv-k-0d1117: #FFFFFF;
      --rv-k-0e1218: #FFFFFF;
      --rv-k-101622: #F7F9FB;
      --rv-k-101724: #F7F9FB;
      --rv-k-121824: #F1F4F7;
      --rv-k-131922: #F7F9FB;
      --rv-k-16202f: #EEF3F8;
      --rv-k-1c222b: #E3E8EE;
      --rv-k-1d2635: #E8EDF3;
      --rv-k-232b38: #E3E8EE;
      --rv-k-253046: #CFD7E1;
      --rv-k-2a3242: #D8DEE5;
      --rv-k-378add: #1F6FD1;
      --rv-k-39424f: #C3CCD6;
      --rv-k-3a3470: #C9C3F0;
      --rv-k-7ee2a8: #127A57;
      --rv-k-7fb3e8: #1F6FD1;
      --rv-k-8a93a0: #4A5563;
      --rv-k-8fa8d6: #3B5B8C;
      --rv-k-8fd3ff: #1768B8;
      --rv-k-8fd49a: #127A57;
      --rv-k-9aa3ad: #4A5563;
      --rv-k-9aa3b0: #4A5563;
      --rv-k-9aa8ba: #4A5563;
      --rv-k-9cc6f3: #1F6FD1;
      --rv-k-b9a7ff: #5E54C9;
      --rv-k-b9dcff: #1858A8;
      --rv-k-bcb6f5: #4F46B8;
      --rv-k-c9d2de: #334155;
      --rv-k-cfe4ff: #173A63;
      --rv-k-d8a75b: #8A5A00;
      --rv-k-dfeaff: #10233F;
      --rv-k-e0b24c: #8A5A00;
      --rv-k-e7e9ee: #0F1720;
      --rv-k-e8c07a: #7A4F00;
      --rv-k-f09595: #B42318;
      --rv-k-ffd27a: #7A4F00;
      --rv-k-ffd9a0: #7A4F00;
      --rv-k-ffe2b0: #7A4F00;
      --rv-k-6f8fb8: #4A5563;
      --rv-k-0d131c: #FFFFFF;
      --rv-k-ff9a8a: #B42318;
      --rv-k-shadow: rgba(15,23,32,.14);
      --rv-k-btn55: rgba(31,111,209,.07);
      --rv-k-btn62: rgba(31,111,209,.08);
      --rv-k-amb35: rgba(168,106,0,.08);
      --rv-k-amb45: rgba(168,106,0,.10);
      --rv-k-amb50: rgba(168,106,0,.10);
      --rv-k-red35: rgba(180,35,24,.07);
      --rv-k-offbar: #C2362E;
      --rv-k-hot: #C2362E;
    }
    /* stralucirile de text sunt facute pentru fundal inchis; pe alb doar tulbura literele */
    :root.renda-vigilia-theme[data-rv-theme='light'] #${HUD_ID} *,
    :root.renda-vigilia-theme[data-rv-theme='light'] [id^='renda-vigilia-'] * { text-shadow: none !important; }

    /* v4.9.3: recolorarea intunecata a PAGINII ChatGPT se aplica DOAR cand ChatGPT
       e deja pe tema dark (clasa .dark pe <html>, pusa de ChatGPT si actualizata
       live la schimbarea temei). Pe tema light, fortarea fundalurilor intunecate
       lasa textul ChatGPT (inchis la culoare) ilizibil. Banda HUD nu e afectata:
       are paleta ei proprie, completa, si ramane intunecata pe ambele teme. */
    :root.renda-vigilia-theme.dark {
      --main-surface-primary: #0d0f12 !important;
      --main-surface-secondary: #15181d !important;
      --main-surface-tertiary: #1b1f26 !important;
      --sidebar-surface-primary: #101318 !important;
      --sidebar-surface-secondary: #15191f !important;
      --message-surface: #15181d !important;
      --composer-surface: #15181d !important;
    }

    :root.renda-vigilia-theme[data-rv-collapsed='true'] {
      --rv-hud-height: 38px;
    }

    :root.renda-vigilia-theme.dark,
    :root.renda-vigilia-theme.dark body {
      background: var(--rv-bg) !important;
      color: var(--rv-text) !important;
    }

    /* layout (independent de tema): pagina nu scrolleaza sub banda HUD */
    :root.renda-vigilia-theme body {
      overflow: hidden !important;
    }

    :root.renda-vigilia-theme .${ROOT_CLASS} {
      position: relative !important;
      margin-top: var(--rv-hud-height) !important;
      height: calc(100dvh - var(--rv-hud-height)) !important;
      max-height: calc(100dvh - var(--rv-hud-height)) !important;
      min-height: 0 !important;
      transition: margin-top .22s ease, height .22s ease, max-height .22s ease;
    }

    /* v4.36.3-local: shell-ul ChatGPT isi schimba periodic utilitarul de viewport
       (h-svh / h-dvh / h-screen / valori arbitrare 100dvh). Toate variantele cunoscute,
       plus shell-ul detectat geometric de JS, trebuie sa mosteneasca inaltimea REALA a
       root-ului comprimat sub HUD; altfel composer-ul depaseste ecranul cu exact 38/78px. */
    /* v3.2.2: shell-ul ChatGPT se dimensioneaza cu h-svh/100dvh (inaltimea VIEWPORTULUI) desi
       root-ul e comprimat cu inaltimea HUD => composer-ul cadea sub ecran pe /c/...
       Normalizare INGUSTA: doar elementele h-svh mostenesc inaltimea reala (100% din root).
       NU plafonam toti copiii root-ului (lectia v3.1.2: regula lata atingea sidebar-ul si
       strica masuratoarea virtualizatorului listei de chaturi). */
    :root.renda-vigilia-theme .${ROOT_CLASS} :is(
      [class*="h-svh"],
      [class*="h-dvh"],
      [class*="h-lvh"],
      [class~="h-screen"],
      [class*="h-[100dvh]"],
      [class*="h-[100svh]"],
      .${VIEWPORT_CLASS}
    ) {
      height: 100% !important;
      max-height: 100% !important;
      min-height: 0 !important;
    }

    /* Interfata ChatGPT 2026 pozitioneaza selectorul Chat / Work fata de viewport,
       independent de root-ul aplicatiei. Cand se suprapune cu HUD-ul, JS marcheaza doar
       capsula celor doua butoane, iar proprietatea translate o muta fara sa-i suprascrie
       transform-ul nativ de centrare. */
    /* 2026-09-25: shell-ul ChatGPT 2026-09 (#root, layout "Chat | Work") rezerva NATIV loc pentru un
       "root banner" prin --app-shell-root-banner-height (declarata inline, 0px, pe
       FullHeightPageSurfaceLayout): header-ul fix (Show sidebar / Temporary chat / Chat | Work)
       isi calculeaza top-ul din ea. Ii dam inaltimea benzii => elementele fixe coboara singure
       sub HUD (masurat: header 0 -> 78px), fara translate si fara dubla deplasare. */
    :root.renda-vigilia-theme .${ROOT_CLASS},
    :root.renda-vigilia-theme .${ROOT_CLASS} [style*="--app-shell-root-banner-height"],
    :root.renda-vigilia-theme .${ROOT_CLASS} [class*="FullHeightPageSurfaceLayout"] {
      --app-shell-root-banner-height: var(--rv-hud-height) !important;
    }

    /* 2026-09-25: tokenii de culoare NOI ai shell-ului 2026-09 (--color-surface = main, -tertiary =
       rama/sidebar, -secondary = suprafete), doar pe tema dark; aceeasi paleta ca
       --main-surface-* / --sidebar-surface-* de mai sus. */
    :root.renda-vigilia-theme.dark {
      --color-surface: #0d0f12 !important;
      --color-surface-secondary: #15181d !important;
      --color-surface-tertiary: #101318 !important;
    }

    :root.renda-vigilia-theme .${MODE_SWITCH_CLASS} {
      translate: 0 var(--rv-hud-height) !important;
      transition: translate .22s ease;
    }

    :root.renda-vigilia-theme.dark [class*='bg-token-sidebar-surface-primary'] {
      background-color: #101318 !important;
    }

    :root.renda-vigilia-theme.dark [class*='bg-token-main-surface-primary'] {
      background-color: var(--rv-bg) !important;
    }

    :root.renda-vigilia-theme.dark [class*='bg-token-main-surface-secondary'],
    :root.renda-vigilia-theme.dark [class*='bg-token-composer-surface'] {
      background-color: var(--rv-panel) !important;
    }

    :root.renda-vigilia-theme.dark #prompt-textarea,
    :root.renda-vigilia-theme.dark textarea,
    :root.renda-vigilia-theme.dark [contenteditable='true'] {
      caret-color: #9cc6f3 !important;
    }

    :root.renda-vigilia-theme.dark ::selection {
      background: rgba(55, 138, 221, .42);
      color: #fff;
    }

    :root.renda-vigilia-theme.dark * {
      scrollbar-color: #344252 #0d0f12;
    }

    #${HUD_ID} {
      position: fixed;
      inset: 0 0 auto 0;
      z-index: 40;
      height: var(--rv-hud-height);
      box-sizing: border-box;
      overflow: hidden;
      padding: 4px 18px 0;
      color: var(--rv-text);
      background: var(--rv-k-090c10);
      border-bottom: 1px solid var(--rv-line);
      font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      line-height: 1.35;
      transition: height .22s ease;
    }

    #${HUD_ID}, #${HUD_ID} * { box-sizing: border-box; }

    #${HUD_ID} .rv-shell {
      position: relative;
      height: 46px;
      display: grid;
      grid-template-columns: minmax(220px, 1fr) minmax(300px, 1.2fr) minmax(285px, 1.2fr);
      align-items: center;
      gap: 16px;
      padding: 4px 14px;
      overflow: hidden;
      border: 1px solid var(--rv-line);
      border-radius: 12px;
      box-shadow: inset 0 1px 0 rgba(55,138,221,.10), inset 0 -1px 0 rgba(127,119,221,.16);
      background:
        radial-gradient(135% 210% at 15% -55%, rgba(55,138,221,.22), transparent 60%),
        radial-gradient(110% 200% at 88% -45%, rgba(127,119,221,.19), transparent 58%),
        radial-gradient(60% 150% at 50% 135%, rgba(80,130,200,.11), transparent 62%),
        linear-gradient(180deg,var(--rv-k-0b0f17),var(--rv-k-06090d));
    }

    #${HUD_ID} .rv-shell::before {
      content: '';
      position: absolute;
      inset: -1px 0 auto;
      height: 2px;
      background:
        linear-gradient(90deg,transparent,rgba(55,138,221,.65) 26%,rgba(127,119,221,.65) 74%,transparent),
        radial-gradient(closest-side,rgba(175,215,255,1),transparent);
      background-size: 100% 100%,26% 260%;
      background-repeat: no-repeat;
      background-position: 0 0,-25% center;
      animation: rvSweep 11s linear infinite;
      pointer-events: none;
    }

    #${HUD_ID} .rv-field {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      opacity: .92;
      -webkit-mask-image: linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);
      mask-image: linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);
    }

    #${HUD_ID} .rv-left,
    #${HUD_ID} .rv-center,
    #${HUD_ID} .rv-right { position: relative; z-index: 2; min-width: 0; }

    #${HUD_ID} .rv-left { display: flex; align-items: center; gap: 12px; }
    #${HUD_ID} .rv-dot {
      width: 12px;
      height: 12px;
      flex: 0 0 12px;
      border-radius: 50%;
      background: var(--rv-violet);
      animation: rvPulse 2.4s infinite;
    }
    #${HUD_ID} .rv-brand-line { white-space: nowrap; }
    #${HUD_ID} .rv-brand {
      color: var(--rv-text);
      font-size: 13px;
      font-weight: 650;
      letter-spacing: .7px;
      text-shadow: 0 0 18px rgba(55,138,221,.30);
    }
    #${HUD_ID} .rv-system { color: var(--rv-text-3); letter-spacing: .5px; }
    #${HUD_ID} .rv-ver { color: var(--rv-text-3); opacity: .75; margin-left: 8px; font: 10.5px/1 ui-monospace, 'Cascadia Code', Consolas, monospace; letter-spacing: .3px; }
    #${HUD_ID} .rv-status { display: none; }
    #${HUD_ID} .rv-status b { color: var(--rv-green); font-weight: 500; }

    #${HUD_ID} .rv-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 0;
    }
    #${HUD_ID} .rv-orbit { display: none; }
    #${HUD_ID} .rv-orbit-off {
      position: absolute;
      top: -7px;
      width: 62px;
      height: 62px;
      border: 1px solid rgba(110,171,232,.58);
      border-radius: 50%;
      box-shadow: 0 0 24px rgba(55,138,221,.12), inset 0 0 18px rgba(127,119,221,.10);
      opacity: .78;
    }
    #${HUD_ID} .rv-orbit::before,
    #${HUD_ID} .rv-orbit::after {
      content: '';
      position: absolute;
      inset: 8px;
      border: 1px solid rgba(127,119,221,.55);
      border-radius: 50%;
      transform: rotate(55deg) scaleY(.38);
    }
    #${HUD_ID} .rv-orbit::after {
      inset: 17px;
      background: radial-gradient(circle,var(--rv-k-dfeaff) 0 7%,var(--rv-k-378add) 9% 18%,transparent 20%);
      animation: rvSpin 8s linear infinite;
    }
    #${HUD_ID} .rv-command {
      position: relative;
      margin-top: 0;
      color: var(--rv-k-dfeaff);
      font-size: 11px;
      font-weight: 650;
      letter-spacing: 3px;
      white-space: nowrap;
      text-shadow: 0 0 18px rgba(90,150,225,.6),0 0 5px rgba(120,170,235,.45);
    }
    #${HUD_ID} .rv-command-sub { color: var(--rv-text-3); font-size: 9px; letter-spacing: .6px; }

    #${HUD_ID} .rv-right {
      display: flex;
      align-items: center;
      gap: 6px;
      justify-self: end;
      min-width: 0;
      font-size: 10px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    #${HUD_ID} .rv-metric-label { color: var(--rv-text); font-weight: 650; letter-spacing: .6px; margin-left: 8px; }
    #${HUD_ID} .rv-metric-label:first-child { margin-left: 0; }
    #${HUD_ID} .rv-meter { width: 52px; height: 4px; overflow: hidden; border-radius: 4px; background: var(--rv-k-1c222b); flex: 0 0 52px; }
    #${HUD_ID} .rv-meter i { display: block; height: 100%; border-radius: inherit; background: var(--rv-blue); }
    #${HUD_ID} .rv-meter.route i { background: var(--rv-violet); }
    #${HUD_ID} .rv-metric-value { color: var(--rv-text-2); font-size: 10px; }
    #${HUD_ID} .rv-metric-value.online { color: var(--rv-green); }
    /* compact v3.1: RUTA (copiii 10-12) ascunsa — e in bara de adrese; bara decorativa a OREI (14) scoasa */
    #${HUD_ID} .rv-right > :nth-child(10),
    #${HUD_ID} .rv-right > :nth-child(11),
    #${HUD_ID} .rv-right > :nth-child(12),
    #${HUD_ID} .rv-right > :nth-child(14) { display: none; }

    #${HUD_ID} .rv-collapse {
      position: absolute;
      z-index: 4;
      top: 8px;
      right: 8px;
      width: 28px;
      height: 24px;
      display: grid;
      place-items: center;
      border: 1px solid rgba(55,138,221,.38);
      border-radius: 7px;
      color: var(--rv-k-9cc6f3);
      background: var(--rv-k-btn62);
      cursor: pointer;
      font: 600 13px/1 'Segoe UI',sans-serif;
    }
    #${HUD_ID} .rv-collapse:hover { border-color: var(--rv-blue); background: var(--rv-blue-2); }

    #${HUD_ID} .rv-nav {
      height: 28px;
      display: flex;
      align-items: center;
      gap: 5px;
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0 3px;
      scrollbar-width: none;
      white-space: nowrap;
    }
    #${HUD_ID} .rv-nav::-webkit-scrollbar { display: none; }
    #${HUD_ID} .rv-nav-label { color: var(--rv-text-3); margin-right: 2px; }
    #${HUD_ID} .rv-nav a {
      color: var(--rv-blue);
      padding: 3px 6px;
      border: 1px solid transparent;
      border-radius: 6px;
      text-decoration: none;
      transition: color .15s ease, background .15s ease, border-color .15s ease;
    }
    #${HUD_ID} .rv-nav a:hover { color: var(--rv-k-b9dcff); background: rgba(55,138,221,.10); border-color: rgba(55,138,221,.24); }
    #${HUD_ID} .rv-nav a.active { color: var(--rv-k-bcb6f5); background: var(--rv-violet-2); border-color: var(--rv-k-3a3470); }
    #${HUD_ID} .rv-nav a.renda { margin-left: auto; color: var(--rv-green); border-color: rgba(29,158,117,.25); }

    /* v3.2: butonul ⚡ Prompt in bara existenta (zero inaltime adaugata) */
    #${HUD_ID} .rv-pp-btn {
      margin-left: 10px;
      padding: 3px 8px;
      border: 1px solid rgba(186,117,23,.45);
      border-radius: 6px;
      color: var(--rv-k-e0b24c);
      background: transparent;
      cursor: pointer;
      font: inherit;
      white-space: nowrap;
    }
    #${HUD_ID} .rv-pp-btn:hover { background: rgba(186,117,23,.14); border-color: var(--rv-amber); }
    #${HUD_ID} .rv-pp-btn.on { color: var(--rv-k-ffd27a); border-color: var(--rv-amber); background: rgba(186,117,23,.18); }

    /* v4.9: butonul si panoul Agenti & Skills */
    #renda-vigilia-chatgpt-hud .rv-ag-btn {
      margin-left: 6px; padding: 3px 8px; border: 1px solid rgba(55,138,221,.45); border-radius: 6px;
      color: var(--rv-k-9cc6f3); background: transparent; cursor: pointer; font: inherit; white-space: nowrap;
    }
    #renda-vigilia-chatgpt-hud .rv-ag-btn:hover { background: rgba(55,138,221,.14); border-color: var(--rv-blue); }
    #renda-vigilia-ag-panel {
      position: fixed; top: calc(var(--rv-hud-height) + 6px); right: 14px; z-index: 60;
      width: min(560px, 94vw); max-height: calc(100dvh - var(--rv-hud-height) - 24px);
      overflow-y: auto; box-sizing: border-box; padding: 12px 14px; color: var(--rv-k-e7e9ee);
      background: var(--rv-k-0e1218); border: 1px solid var(--rv-k-2a3242); border-radius: 12px;
      box-shadow: 0 18px 50px var(--rv-k-shadow), inset 0 1px 0 rgba(55,138,221,.12);
      font: 12px/1.45 'Segoe UI', system-ui, sans-serif; display: none;
    }
    #renda-vigilia-ag-panel.open { display: block; }
    #renda-vigilia-ag-panel h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: .8px; color: var(--rv-k-dfeaff); }
    #renda-vigilia-ag-panel .ag-close { position: absolute; top: 8px; right: 10px; border: 0; background: transparent; color: var(--rv-k-8a93a0); cursor: pointer; font-size: 14px; }
    #renda-vigilia-ag-panel .ag-tabs { display: flex; gap: 6px; margin-bottom: 8px; }
    #renda-vigilia-ag-panel .ag-tab { padding: 4px 12px; border: 1px solid var(--rv-k-253046); border-radius: 7px; background: var(--rv-k-121824); color: var(--rv-k-9aa3b0); cursor: pointer; font: 600 11px 'Segoe UI',sans-serif; }
    #renda-vigilia-ag-panel .ag-tab.on { color: var(--rv-k-dfeaff); border-color: rgba(55,138,221,.5); background: var(--rv-k-16202f); }
    #renda-vigilia-ag-panel .ag-search { width: 100%; box-sizing: border-box; padding: 6px 8px; margin-bottom: 6px; color: var(--rv-k-e7e9ee); background: var(--rv-k-131922); border: 1px solid var(--rv-k-2a3242); border-radius: 8px; font: 12px 'Segoe UI',sans-serif; }
    #renda-vigilia-ag-panel .ag-cluster { margin: 10px 0 4px; color: var(--rv-k-8fa8d6); font-size: 10.5px; letter-spacing: .8px; text-transform: uppercase; }
    #renda-vigilia-ag-panel .ag-card { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; margin: 3px 0; border: 1px solid var(--rv-k-1d2635); border-radius: 8px; background: var(--rv-k-101622); }
    #renda-vigilia-ag-panel .ag-card:hover { border-color: rgba(55,138,221,.4); }
    #renda-vigilia-ag-panel .ag-info { flex: 1; min-width: 0; }
    #renda-vigilia-ag-panel .ag-name { color: var(--rv-k-dfeaff); font-weight: 600; font-size: 11.5px; }
    #renda-vigilia-ag-panel .ag-name[data-ins] { cursor: pointer; }
    #renda-vigilia-ag-panel .ag-name[data-ins]:hover { color: var(--rv-k-ffd27a); text-decoration: underline; }
    #renda-vigilia-ag-panel .ag-desc { color: var(--rv-k-8a93a0); font-size: 10.5px; margin-top: 1px; }
    #renda-vigilia-ag-panel .ag-tags { color: var(--rv-k-6f8fb8); font-size: 10px; margin-top: 2px; }
    #renda-vigilia-ag-panel .ag-act { display: flex; gap: 5px; flex: 0 0 auto; }
    #renda-vigilia-ag-panel .ag-act button { padding: 3px 8px; border: 1px solid rgba(55,138,221,.45); border-radius: 6px; color: var(--rv-k-9cc6f3); background: var(--rv-k-btn55); cursor: pointer; font: 600 10.5px 'Segoe UI',sans-serif; white-space: nowrap; }
    #renda-vigilia-ag-panel .ag-act button:hover { background: var(--rv-blue-2); }
    #renda-vigilia-ag-panel .ag-act button.amber { border-color: rgba(186,117,23,.45); color: var(--rv-k-e0b24c); background: var(--rv-k-amb35); }
    #renda-vigilia-ag-panel .ag-hint { color: var(--rv-k-8a93a0); font-size: 10px; margin-top: 8px; }
    /* v4.14: butonul si panoul SHKN (Shared HUMAN Knowledge) — fratele panoului Agenti */
    #renda-vigilia-chatgpt-hud .rv-shkn-btn {
      margin-left: 6px; padding: 3px 8px; border: 1px solid rgba(186,117,23,.5); border-radius: 6px;
      color: var(--rv-k-ffd27a); background: transparent; cursor: pointer; font: inherit; white-space: nowrap;
    }
    #renda-vigilia-chatgpt-hud .rv-shkn-btn:hover { background: rgba(186,117,23,.14); border-color: var(--rv-amber); }
    #renda-vigilia-shkn-panel {
      position: fixed; top: calc(var(--rv-hud-height) + 6px); right: 14px; z-index: 60;
      display: none; width: min(680px, 94vw); max-height: 76vh; overflow: auto; padding: 12px 14px;
      background: var(--rv-k-0d1117); border: 1px solid rgba(186,117,23,.4); border-radius: 12px;
      box-shadow: 0 12px 34px var(--rv-k-shadow); color: var(--rv-k-e7e9ee); font: 12px 'Segoe UI',sans-serif;
    }
    #renda-vigilia-shkn-panel.open { display: block; }
    #renda-vigilia-shkn-panel h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: .8px; color: var(--rv-k-ffe2b0); }
    #renda-vigilia-shkn-panel .ag-close { position: absolute; top: 8px; right: 10px; border: 0; background: transparent; color: var(--rv-k-8a93a0); cursor: pointer; font-size: 14px; }
    #renda-vigilia-shkn-panel .ag-search { width: 100%; box-sizing: border-box; padding: 6px 8px; margin-bottom: 6px; color: var(--rv-k-e7e9ee); background: var(--rv-k-131922); border: 1px solid var(--rv-k-2a3242); border-radius: 8px; font: 12px 'Segoe UI',sans-serif; }
    #renda-vigilia-shkn-panel .ag-card { display: flex; align-items: flex-start; gap: 8px; padding: 6px 8px; margin: 3px 0; border: 1px solid var(--rv-k-1d2635); border-radius: 8px; background: var(--rv-k-101622); flex-wrap: wrap; }
    #renda-vigilia-shkn-panel .ag-card:hover { border-color: rgba(186,117,23,.45); }
    #renda-vigilia-shkn-panel .ag-info { flex: 1; min-width: 0; }
    #renda-vigilia-shkn-panel .ag-name { color: var(--rv-k-ffe2b0); font-weight: 600; font-size: 11.5px; }
    #renda-vigilia-shkn-panel .ag-desc { color: var(--rv-k-8a93a0); font-size: 10.5px; margin-top: 1px; }
    #renda-vigilia-shkn-panel .shkn-tags { color: var(--rv-k-8fa8d6); font-size: 10px; margin-top: 3px; }
    #renda-vigilia-shkn-panel .shkn-id { color: var(--rv-k-8fa8d6); font-weight: 500; font-size: 10.5px; margin-right: 2px; }
    #renda-vigilia-shkn-panel .ag-act { display: flex; gap: 5px; flex: 0 0 auto; align-items: center; }
    #renda-vigilia-shkn-panel .ag-act button { padding: 3px 8px; border: 1px solid rgba(186,117,23,.5); border-radius: 6px; color: var(--rv-k-ffd27a); background: var(--rv-k-amb50); cursor: pointer; font: 600 10.5px 'Segoe UI',sans-serif; white-space: nowrap; }
    #renda-vigilia-shkn-panel .ag-act button:hover { background: rgba(186,117,23,.22); }
    #renda-vigilia-shkn-panel .shkn-pct { min-width: 44px; text-align: right; color: var(--rv-k-7ee2a8); font: 700 11.5px 'Segoe UI',sans-serif; }
    #renda-vigilia-shkn-panel .shkn-pct.low { color: var(--rv-k-8a93a0); }
    #renda-vigilia-shkn-panel .shkn-body { flex-basis: 100%; display: none; margin-top: 6px; padding: 8px; max-height: 42vh; overflow: auto; white-space: pre-wrap; background: var(--rv-k-0a0f16); border: 1px solid var(--rv-k-1d2635); border-radius: 8px; color: var(--rv-k-c9d2de); font: 11px 'Consolas',monospace; }
    #renda-vigilia-shkn-panel .shkn-body.open { display: block; }
    #renda-vigilia-shkn-panel .shkn-newprop { margin: 0 0 6px; padding: 3px 9px; border: 1px solid rgba(186,117,23,.5); border-radius: 6px; color: var(--rv-k-ffd27a); background: rgba(60,40,15,.5); cursor: pointer; font: 600 10.5px 'Segoe UI',sans-serif; }
    #renda-vigilia-shkn-panel .shkn-prop { display: none; margin: 0 0 8px; padding: 8px; border: 1px solid rgba(186,117,23,.55); border-radius: 8px; background: var(--rv-k-0d131c); }
    #renda-vigilia-shkn-panel .shkn-prop.open { display: block; }
    #renda-vigilia-shkn-panel .shkn-prop .sp-h { color: var(--rv-k-ffe2b0); font-weight: 600; font-size: 11.5px; margin-bottom: 4px; }
    #renda-vigilia-shkn-panel .shkn-prop label { display: block; color: var(--rv-k-8a93a0); font-size: 10.5px; margin: 6px 0 2px; }
    #renda-vigilia-shkn-panel .shkn-prop input, #renda-vigilia-shkn-panel .shkn-prop textarea { width: 100%; box-sizing: border-box; padding: 5px 7px; color: var(--rv-k-e7e9ee); background: var(--rv-k-131922); border: 1px solid var(--rv-k-2a3242); border-radius: 6px; font: 11.5px 'Segoe UI',sans-serif; }
    #renda-vigilia-shkn-panel .shkn-prop textarea { min-height: 150px; resize: vertical; font: 11px 'Consolas',monospace; }
    #renda-vigilia-shkn-panel .shkn-prop .sp-act { display: flex; gap: 6px; margin-top: 8px; }
    #renda-vigilia-shkn-panel .shkn-prop .sp-act button { padding: 4px 10px; border: 1px solid rgba(186,117,23,.5); border-radius: 6px; color: var(--rv-k-ffd27a); background: rgba(60,40,15,.5); cursor: pointer; font: 600 10.5px 'Segoe UI',sans-serif; }
    #renda-vigilia-shkn-panel .shkn-prop .sp-msg { color: var(--rv-k-8a93a0); font-size: 10.5px; margin-top: 6px; }
    #renda-vigilia-shkn-panel .shkn-prop .sp-msg.err { color: var(--rv-k-ff9a8a); }
    #renda-vigilia-shkn-panel .shkn-prop .sp-msg.ok { color: var(--rv-k-7ee2a8); }
    #renda-vigilia-shkn-panel .ag-hint { color: var(--rv-k-8a93a0); font-size: 10px; margin-top: 8px; }    #${HUD_ID} .rv-canon-btn.on { color: var(--rv-k-8fd3ff); border-color: var(--rv-blue); background: rgba(55,138,221,.18); }
    #${HUD_ID} .rv-canon-btn.compact { color: var(--rv-k-b9a7ff); border-color: var(--rv-violet); background: rgba(127,119,221,.18); }
    #${HUD_ID} .rv-canon-line {
      font-size: 10px; color: var(--rv-text-2); max-width: 360px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* v3.2: panoul PLUTITOR (sub banda, nu impinge nimic) */
    #${PANEL_ID} {
      position: fixed;
      top: calc(var(--rv-hud-height) + 6px);
      right: 14px;
      z-index: 60;
      width: min(460px, 92vw);
      max-height: calc(100dvh - var(--rv-hud-height) - 24px);
      overflow-y: auto;
      box-sizing: border-box;
      padding: 12px 14px;
      color: var(--rv-k-e7e9ee);
      background: var(--rv-k-0e1218);
      border: 1px solid var(--rv-k-2a3242);
      border-radius: 12px;
      box-shadow: 0 18px 50px var(--rv-k-shadow), inset 0 1px 0 rgba(55,138,221,.12);
      font: 12px/1.45 'Segoe UI', system-ui, sans-serif;
      display: none;
    }
    #${PANEL_ID}.open { display: block; }
    #${PANEL_ID} h3 { margin: 0 0 6px; font-size: 12px; letter-spacing: .8px; color: var(--rv-k-dfeaff); }
    #${PANEL_ID} .pp-hint { color: var(--rv-k-8a93a0); font-size: 10.5px; margin: 2px 0 8px; }
    #${PANEL_ID} textarea, #${PANEL_ID} .pp-ident {
      width: 100%;
      min-height: 84px;
      box-sizing: border-box;
      resize: vertical;
      padding: 8px;
      color: var(--rv-k-e7e9ee);
      background: var(--rv-k-131922);
      border: 1px solid var(--rv-k-2a3242);
      border-radius: 8px;
      font: 12px/1.4 'Segoe UI', system-ui, sans-serif;
    }
    #${PANEL_ID} .pp-ident { min-height: 0; resize: none; }
    #${PANEL_ID} .pp-row { display: flex; gap: 8px; margin: 8px 0 4px; align-items: center; }
    #${PANEL_ID} .pp-row .pp-state { margin-left: auto; font-size: 10.5px; color: var(--rv-k-8a93a0); }
    #${PANEL_ID} button.pp-act {
      padding: 5px 10px;
      border: 1px solid rgba(55,138,221,.45);
      border-radius: 7px;
      color: var(--rv-k-9cc6f3);
      background: var(--rv-k-btn55);
      cursor: pointer;
      font: 600 11px 'Segoe UI', sans-serif;
    }
    #${PANEL_ID} button.pp-act:hover { background: var(--rv-blue-2); }
    #${PANEL_ID} button.pp-act.danger { border-color: rgba(224,108,108,.4); color: var(--rv-k-f09595); background: var(--rv-k-red35); }
    #${PANEL_ID} hr { border: 0; border-top: 1px solid var(--rv-k-232b38); margin: 10px 0; }
    #${PANEL_ID} .pp-tpl {
      display: block;
      width: 100%;
      text-align: left;
      margin: 4px 0;
      padding: 6px 9px;
      border: 1px solid var(--rv-k-253046);
      border-radius: 7px;
      color: var(--rv-k-b9dcff);
      background: var(--rv-k-121824);
      cursor: pointer;
      font: 12px 'Segoe UI', sans-serif;
    }
    #${PANEL_ID} .pp-tpl:hover { border-color: rgba(55,138,221,.5); background: var(--rv-k-16202f); }
    #${PANEL_ID} .pp-tpl-grp { color: var(--rv-k-8fa8d6); font: 600 10px 'Segoe UI',sans-serif; text-transform: uppercase; letter-spacing: .6px; margin: 9px 0 3px; }
    #${PANEL_ID} .pp-close {
      position: absolute; top: 8px; right: 10px;
      border: 0; background: transparent; color: var(--rv-k-8a93a0); cursor: pointer; font-size: 14px;
    }

    /* v4.9.17: panoul SETT mosteneste stilurile pp prin :is() (vezi addStyle); aici doar extra */
    #${SETT_PANEL_ID} input.st-in {
      width: 100%; box-sizing: border-box; padding: 7px 8px; margin: 2px 0 6px;
      color: var(--rv-k-e7e9ee); background: var(--rv-k-131922); border: 1px solid var(--rv-k-2a3242); border-radius: 8px;
      font: 12px 'Segoe UI', system-ui, sans-serif;
    }
    #${SETT_PANEL_ID} label.pp-hint { display: block; margin: 6px 0 1px; }
    #${SETT_PANEL_ID} .st-config { display: none; }
    #${SETT_PANEL_ID} .st-config.open { display: block; }
    #${SETT_PANEL_ID} h3 .st-gear {
      float: right; margin-right: 22px; padding: 2px 8px;
      border: 1px solid rgba(55,138,221,.45); border-radius: 7px;
      color: var(--rv-k-9cc6f3); background: var(--rv-k-btn55); cursor: pointer;
      font: 600 10px 'Segoe UI', sans-serif;
    }
    #${SETT_PANEL_ID} h3 .st-gear:hover { background: var(--rv-blue-2); }
    #${SETT_PANEL_ID} .st-tabs { display: flex; gap: 6px; align-items: center; margin: 4px 0 6px; }
    #${SETT_PANEL_ID} .st-tab {
      padding: 4px 10px; border: 1px solid var(--rv-k-253046); border-radius: 7px;
      background: var(--rv-k-121824); color: var(--rv-k-8a93a0); cursor: pointer;
      font: 600 11px 'Segoe UI', sans-serif;
    }
    #${SETT_PANEL_ID} .st-tab.on { color: var(--rv-k-cfe4ff); border-color: rgba(55,138,221,.55); background: rgba(55,138,221,.14); }
    #${SETT_PANEL_ID} .st-tabs .st-refresh {
      margin-left: auto; padding: 4px 10px;
      border: 1px solid rgba(55,138,221,.45); border-radius: 7px;
      color: var(--rv-k-9cc6f3); background: var(--rv-k-btn55); cursor: pointer;
      font: 600 11px 'Segoe UI', sans-serif;
    }
    #${SETT_PANEL_ID} .st-tabs .st-refresh:hover { background: var(--rv-blue-2); }
    #${SETT_PANEL_ID} .st-tabs .st-state { font-size: 10.5px; color: var(--rv-k-8a93a0); }
    #${SETT_PANEL_ID} .st-item { display: flex; gap: 8px; align-items: center; padding: 5px 8px; border: 1px solid var(--rv-k-1d2635); border-radius: 7px; margin: 4px 0; background: var(--rv-k-101724); }
    #${SETT_PANEL_ID} .st-info { flex: 1 1 auto; min-width: 0; }
    #${SETT_PANEL_ID} .st-name { color: var(--rv-k-dfeaff); font-weight: 600; font-size: 11.5px; }
    #${SETT_PANEL_ID} .st-code { font-family: Consolas, 'Courier New', monospace; color: var(--rv-k-e8c07a); letter-spacing: .5px; }
    #${SETT_PANEL_ID} .st-act { display: flex; gap: 4px; }
    #${SETT_PANEL_ID} .st-sub { color: var(--rv-k-8a93a0); font-size: 10.5px; }
    #${SETT_PANEL_ID} .st-type { float: right; color: var(--rv-k-d8a75b); font-size: 9.5px; border: 1px solid rgba(186,117,23,.35); border-radius: 6px; padding: 0 5px; margin-left: 6px; }
    #${SETT_PANEL_ID} .st-act button {
      white-space: nowrap; padding: 3px 8px;
      border: 1px solid rgba(186,117,23,.45); border-radius: 7px;
      color: var(--rv-k-e8c07a); background: var(--rv-k-amb45); cursor: pointer;
      font: 600 10.5px 'Segoe UI', sans-serif;
    }
    #${SETT_PANEL_ID} .st-act button:hover { background: rgba(186,117,23,.25); }
    #${SETT_PANEL_ID} .st-filter-row { display: flex; gap: 6px; align-items: stretch; }
    #${SETT_PANEL_ID} .st-filter-row .st-q { flex: 1 1 auto; }
    #${SETT_PANEL_ID} .st-status-f {
      flex: 0 0 auto; max-width: 45%; margin: 2px 0 6px; padding: 6px 6px;
      color: var(--rv-k-e7e9ee); background: var(--rv-k-131922); border: 1px solid var(--rv-k-2a3242); border-radius: 8px;
      font: 11px 'Segoe UI', system-ui, sans-serif;
    }
    #${SETT_PANEL_ID} .st-types { display: flex; flex-wrap: wrap; gap: 4px; margin: 0 0 6px; }
    #${SETT_PANEL_ID} .st-type-chip {
      padding: 2px 8px; border: 1px solid var(--rv-k-253046); border-radius: 10px;
      background: var(--rv-k-121824); color: var(--rv-k-8a93a0); cursor: pointer;
      font: 600 10px 'Segoe UI', sans-serif;
    }
    #${SETT_PANEL_ID} .st-type-chip.on { color: var(--rv-k-ffd9a0); border-color: rgba(186,117,23,.55); background: rgba(186,117,23,.16); }
    #${SETT_PANEL_ID} .st-type-chip:hover { border-color: rgba(55,138,221,.5); }
    #${SETT_PANEL_ID} .st-status { float: right; color: var(--rv-k-9cc6f3); font-size: 9.5px; border: 1px solid rgba(55,138,221,.4); border-radius: 6px; padding: 0 5px; margin-left: 6px; }
    #${SETT_PANEL_ID} .st-status[data-s="activ"], #${SETT_PANEL_ID} .st-status[data-s="active"], #${SETT_PANEL_ID} .st-status[data-s="in lucru"] { color: var(--rv-k-8fd49a); border-color: rgba(90,190,120,.45); }
    #${SETT_PANEL_ID} .st-status[data-s="finalizat"], #${SETT_PANEL_ID} .st-status[data-s="closed"], #${SETT_PANEL_ID} .st-status[data-s="inchis"], #${SETT_PANEL_ID} .st-status[data-s="închis"], #${SETT_PANEL_ID} .st-status[data-s="arhivat"] { color: var(--rv-k-9aa3ad); border-color: var(--rv-k-39424f); }
    #${SETT_PANEL_ID} .st-status[data-s="blocat"], #${SETT_PANEL_ID} .st-status[data-s="suspendat"], #${SETT_PANEL_ID} .st-status[data-s="anulat"] { color: var(--rv-k-f09595); border-color: rgba(224,108,108,.4); }
    #${SETT_PANEL_ID} .st-more {
      display: block; width: 100%; margin: 6px 0; padding: 6px 9px;
      border: 1px solid var(--rv-k-253046); border-radius: 7px; color: var(--rv-k-b9dcff); background: var(--rv-k-121824);
      cursor: pointer; font: 600 11px 'Segoe UI', sans-serif;
    }
    #${SETT_PANEL_ID} .st-more:hover { border-color: rgba(55,138,221,.5); background: var(--rv-k-16202f); }

    /* v4.9.30: cardul "Misiunea mea" — mai ingust, sub nivelul celorlalte panouri (z),
       ca SETT/PP sa il acopere cand sunt deschise peste el */
    #${MIS_PANEL_ID} { width: min(320px, 86vw); z-index: 55; }
    #${MIS_PANEL_ID} .mis-who { color: var(--rv-k-e8c07a); font-size: 11px; font-weight: 600; margin: 0 0 8px; padding-bottom: 6px; border-bottom: 1px solid var(--rv-k-232b38); }
    #${MIS_PANEL_ID} .mis-who-off { color: var(--rv-k-8a93a0); font-weight: 400; }
    #${MIS_PANEL_ID} .mis-f { color: var(--rv-k-dfeaff); font-weight: 700; font-size: 12px; margin: 2px 0 6px; }
    #${MIS_PANEL_ID} .mis-src { color: var(--rv-k-8a93a0); font-weight: 400; font-size: 10px; }
    #${MIS_PANEL_ID} .mis-m { color: var(--rv-k-cfe4ff); font-size: 11.5px; line-height: 1.5; padding: 7px 9px; background: rgba(55,138,221,.08); border: 1px solid rgba(55,138,221,.25); border-radius: 8px; }
    #${MIS_PANEL_ID} ol.mis-a { margin: 8px 0 2px; padding-left: 18px; }
    #${MIS_PANEL_ID} ol.mis-a li { color: var(--rv-k-b9dcff); font-size: 11px; margin: 4px 0; line-height: 1.4; }
    #${MIS_PANEL_ID} .mis-pick {
      display: block; width: 100%; text-align: left; margin: 3px 0; padding: 5px 9px;
      border: 1px solid var(--rv-k-253046); border-radius: 7px; color: var(--rv-k-b9dcff); background: var(--rv-k-121824);
      cursor: pointer; font: 11.5px 'Segoe UI', sans-serif;
    }
    #${MIS_PANEL_ID} .mis-pick:hover { border-color: rgba(55,138,221,.5); background: var(--rv-k-16202f); }
    #${MIS_PANEL_ID} .mis-kvs { margin: 2px 0 8px; }
    #${MIS_PANEL_ID} .mis-kv { color: var(--rv-k-9aa8ba); font-size: 10.5px; line-height: 1.45; margin: 2px 0; }
    #${MIS_PANEL_ID} .mis-kv b { color: var(--rv-k-7fb3e8); font-weight: 600; }
    #${MIS_PANEL_ID} .mis-model { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--rv-k-232b38); }
    #${MIS_PANEL_ID} details.mis-instr { margin-top: 6px; }
    #${MIS_PANEL_ID} details.mis-instr summary { color: var(--rv-k-8a93a0); font-size: 10px; cursor: pointer; }
    #${MIS_PANEL_ID} details.mis-instr summary:hover { color: var(--rv-k-b9dcff); }
    #${MIS_PANEL_ID} details.mis-instr ol { margin: 4px 0 2px; padding-left: 16px; }
    #${MIS_PANEL_ID} details.mis-instr li { color: var(--rv-k-9aa8ba); font-size: 10px; margin: 3px 0; line-height: 1.4; }
    #${MIS_PANEL_ID} .mis-boot { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--rv-k-232b38); }
    #${MIS_PANEL_ID} .mis-teze { margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--rv-k-232b38); }
    #${MIS_PANEL_ID} details.mis-teza summary { color: var(--rv-k-b9dcff); font-size: 11px; margin: 4px 0; }
    #${MIS_PANEL_ID} details.mis-teza summary b { color: var(--rv-k-e8c07a); }
    #${MIS_PANEL_ID} details.mis-teza li b { color: var(--rv-k-7fb3e8); font-weight: 600; }
    #${MIS_PANEL_ID} .mis-boot-t { color: var(--rv-k-e8c07a); font-weight: 700; font-size: 11px; margin-bottom: 4px; }
    #${MIS_PANEL_ID} .mis-boot-p { color: var(--rv-k-8a93a0); font-size: 10px; line-height: 1.4; margin-bottom: 4px; }
    #${MIS_PANEL_ID} select.boot-sel, #${SETT_PANEL_ID} select.boot-sel {
      width: 100%; box-sizing: border-box; padding: 6px; margin: 2px 0 4px;
      color: var(--rv-k-e7e9ee); background: var(--rv-k-131922); border: 1px solid var(--rv-k-2a3242); border-radius: 8px;
      font: 11px 'Segoe UI', system-ui, sans-serif;
    }

    :root.renda-vigilia-theme[data-rv-collapsed='true'] #${HUD_ID} { padding: 0 8px; }
    :root.renda-vigilia-theme[data-rv-collapsed='true'] #${HUD_ID} .rv-shell { display: none; }
    :root.renda-vigilia-theme[data-rv-collapsed='true'] #${HUD_ID} .rv-nav { height: 38px; padding-right: 42px; }
    :root.renda-vigilia-theme[data-rv-collapsed='true'] #${HUD_ID} .rv-collapse { top: 7px; }

    @keyframes rvPulse {
      0% { box-shadow: 0 0 0 0 rgba(127,119,221,.55); }
      70% { box-shadow: 0 0 0 12px rgba(127,119,221,0); }
      100% { box-shadow: 0 0 0 0 rgba(127,119,221,0); }
    }
    @keyframes rvSweep { from { background-position: 0 0,-25% center; } to { background-position: 0 0,125% center; } }
    @keyframes rvSpin { to { transform: rotate(415deg) scaleY(.38); } }

    @media (max-width: 980px) {
      #${HUD_ID} .rv-shell { grid-template-columns: 1fr 1.25fr; }
      #${HUD_ID} .rv-right { display: none; }
      #${HUD_ID} .rv-command { letter-spacing: 2px; font-size: 11px; }
    }

    @media (max-width: 680px) {
      #${HUD_ID} .rv-shell { grid-template-columns: 1fr; }
      #${HUD_ID} .rv-left { display: none; }
      #${HUD_ID} .rv-command { font-size: 10px; }
      #${HUD_ID} .rv-nav a { padding-inline: 4px; }
    }

    @media (prefers-reduced-motion: reduce) {
      #${HUD_ID} *, .${ROOT_CLASS} { animation: none !important; transition: none !important; }
    }
    /* ===== v4.37.0 — REDESIGN (macheta "RENDA HUD — redesign light/dark"), fontul ramas neschimbat =====
       bara pe doua randuri peste tot campul de stele, iconite, indicator de conexiune, card nou */
    :root.renda-vigilia-theme { --rv-hud-height: 96px; --rv-accent-fill: #5AA2F0; --rv-on-accent: #0B1320; }
    :root.renda-vigilia-theme[data-rv-theme='light'] { --rv-accent-fill: #1F6FD1; --rv-on-accent: #FFFFFF; }
    :root.renda-vigilia-theme[data-rv-collapsed='true'] { --rv-hud-height: 44px; }
    #${HUD_ID} { padding: 0; display: flex; flex-direction: column; }
    #${HUD_ID} .rv-field { position: absolute; inset: 0; z-index: 0; }
    #${HUD_ID} .rv-shell {
      z-index: 1; height: 54px; padding: 0 56px 0 20px; border: 0; border-radius: 0; box-shadow: none; background: transparent;
      grid-template-columns: minmax(280px, 1fr) auto minmax(300px, 1fr);
    }
    #${HUD_ID} .rv-logo { display: flex; color: var(--rv-blue); flex: 0 0 auto; }
    #${HUD_ID} .rv-brand-line { display: flex; align-items: center; gap: 8px; }
    #${HUD_ID} .rv-brand { font-size: 14px; letter-spacing: .1em; }
    #${HUD_ID} .rv-ver { margin-left: 0; opacity: 1; padding: 3px 6px; border: 1px solid var(--rv-line); border-radius: 6px; color: var(--rv-text-2); }
    #${HUD_ID} .rv-system { display: block; margin-top: 3px; font-size: 11px; letter-spacing: .2px; color: var(--rv-text-2); }
    #${HUD_ID} .rv-command { font-size: 10.5px; letter-spacing: .24em; color: var(--rv-text); }
    #${HUD_ID} .rv-command-sub { font-size: 10.5px; color: var(--rv-text-2); }
    #${HUD_ID} .rv-right { gap: 8px; font-size: 11px; }
    #${HUD_ID} .rv-metric-label { color: var(--rv-text-2); font-weight: 600; margin-left: 10px; }
    #${HUD_ID} .rv-metric-value { color: var(--rv-text); font-size: 11px; }
    #${HUD_ID} .rv-meter { width: 60px; flex-basis: 60px; height: 6px; border-radius: 3px; }
    #${HUD_ID} .rv-collapse { top: 13px; right: 14px; }
    #${HUD_ID} .rv-nav {
      position: relative; z-index: 1; height: 42px; padding: 0 20px; gap: 3px;
      border-top: 1px solid var(--rv-line);
    }
    #${HUD_ID} .rv-nav-label { color: var(--rv-text-2); margin-right: 4px; }
    #${HUD_ID} .rv-nav a { color: var(--rv-text-2); padding: 6px 8px; font-weight: 500; }
    #${HUD_ID} .rv-nav a:hover { color: var(--rv-text); background: var(--rv-panel-2); border-color: transparent; }
    #${HUD_ID} .rv-nav a.active { color: var(--rv-text); background: var(--rv-panel-2); border-color: transparent; font-weight: 650; }
    #${HUD_ID} .rv-nav a.renda { margin-left: 6px; color: var(--rv-green); }
    #${HUD_ID} .rv-nav-sep { width: 1px; height: 20px; margin: 0 8px; background: var(--rv-line); flex: 0 0 1px; }
    #${HUD_ID} .rv-nav button {
      display: inline-flex; align-items: center; gap: 6px; height: 30px; margin-left: 0; padding: 0 10px;
      border: 1px solid transparent; border-radius: 8px; color: var(--rv-text); background: transparent;
      font: inherit; font-size: 12.5px; font-weight: 500; white-space: nowrap; cursor: pointer;
    }
    #${HUD_ID} .rv-nav button:hover { background: var(--rv-panel-2); border-color: var(--rv-line); }
    #${HUD_ID} .rv-nav button .rv-ic { color: var(--rv-blue); flex: 0 0 auto; }
    #${HUD_ID} .rv-nav .rv-canon-btn { border-color: var(--rv-line); margin-left: 6px; }
    #${HUD_ID} .rv-pill { font-size: 10px; font-weight: 700; letter-spacing: .04em; padding: 3px 6px; border-radius: 5px; color: var(--rv-green); background: rgba(29,158,117,.16); }
    #${HUD_ID} .rv-pill.off { color: var(--rv-text-2); background: var(--rv-panel-2); }
    #${HUD_ID} .rv-canon-line { color: var(--rv-text-2); font-size: 11px; margin-left: 6px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; }
    #${HUD_ID} .rv-nav .rv-conn { margin-left: auto; height: 30px; border-radius: 15px; border-color: var(--rv-line); background: var(--rv-panel-2); }
    #${HUD_ID} .rv-nav .rv-conn[hidden] { display: none; }
    /* v4.47.0: comutatorul de organizatie (doar cand contul are mai multe) */
    #${HUD_ID} .rv-nav .rv-org { margin-left: auto; height: 30px; max-width: 170px; padding: 0 10px; border: 1px solid var(--rv-line); border-radius: 15px; background: var(--rv-panel-2); color: var(--rv-text); font: inherit; cursor: pointer; }
    #${HUD_ID} .rv-nav .rv-org[hidden] { display: none; }
    /* v4.47.0: banda incape in 1280 px — linkul spre serverul HUD local apare doar cand acesta raspunde, tema
       ramane iconita sub 1500 px (cuvantul ei e in tooltip), iar sub 1400 px dispare eticheta „pagini:” */
    #${HUD_ID}:not(.rv-local-on) .rv-nav a.renda { display: none; }
    @media (max-width: 1500px) { #${HUD_ID} .rv-nav .rv-theme-btn .rv-lbl { display: none; } }
    @media (max-width: 1400px) { #${HUD_ID} .rv-nav .rv-nav-label { display: none; } #${HUD_ID} .rv-nav { padding-left: 12px; padding-right: 12px; } }
    #${HUD_ID} .rv-nav .rv-org:not([hidden]) + .rv-conn { margin-left: 6px; }
    /* cu comutatorul in bara, emailul ramane doar in tooltip — altfel butonul si tema ies din banda la 1280 px */
    #${HUD_ID} .rv-nav .rv-org:not([hidden]) + .rv-conn .rv-conn-em, #${HUD_ID} .rv-nav .rv-org:not([hidden]) + .rv-conn .rv-lbl { display: none; }
    /* v4.47.0: inainte de conectare — doar marca, butonul de conectare si tema; panourile ascunse */
    #${HUD_ID}.rv-pre .rv-center, #${HUD_ID}.rv-pre .rv-right, #${HUD_ID}.rv-pre .rv-status, #${HUD_ID}.rv-pre .rv-system,
    #${HUD_ID}.rv-pre .rv-nav > :not(.rv-conn):not(.rv-theme-btn) { display: none !important; }
    :root[data-rv-pre="1"] [id^="renda-vigilia-"]:not(#${HUD_ID}):not(#${STYLE_ID}) { display: none !important; }
    #${HUD_ID} .rv-conn-dot { width: 8px; height: 8px; border-radius: 4px; background: var(--rv-green); flex: 0 0 8px; }
    #${HUD_ID} .rv-conn-em { color: var(--rv-text-2); max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
    #${HUD_ID} .rv-nav .rv-conn.off { color: var(--rv-on-accent); background: var(--rv-accent-fill); border-color: var(--rv-accent-fill); font-weight: 650; }
    #${HUD_ID} .rv-nav .rv-conn.off .rv-ic { color: var(--rv-on-accent); }
    #${HUD_ID} .rv-nav .rv-conn[hidden] ~ .rv-theme-btn { margin-left: auto; }
    :root.renda-vigilia-theme[data-rv-collapsed='true'] #${HUD_ID} .rv-nav { height: 44px; border-top: 0; padding-right: 48px; }
    :root.renda-vigilia-theme[data-rv-collapsed='true'] #${HUD_ID} .rv-collapse { top: 10px; }

    /* cardul "Misiunea mea" */
    #${MIS_PANEL_ID} { width: min(400px, 90vw); padding: 18px; border-radius: 16px; }
    #${MIS_PANEL_ID} h3 { display: flex; align-items: center; gap: 8px; font-size: 12px; letter-spacing: .12em; color: var(--rv-text); }
    #${MIS_PANEL_ID} h3 .rv-ic, #${MIS_PANEL_ID} .mis-boot-t .rv-ic { color: var(--rv-blue); flex: 0 0 auto; }
    #${MIS_PANEL_ID} .mis-who { display: flex; align-items: center; gap: 10px; padding-bottom: 12px; margin-bottom: 10px; color: var(--rv-text); font-size: 12px; font-weight: 400; }
    #${MIS_PANEL_ID} .mis-av { width: 36px; height: 36px; border-radius: 18px; display: flex; align-items: center; justify-content: center; flex: 0 0 36px; background: rgba(55,138,221,.16); color: var(--rv-blue); font-weight: 700; font-size: 13px; }
    #${MIS_PANEL_ID} .mis-who-t { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    #${MIS_PANEL_ID} .mis-who-t b { font-size: 13.5px; color: var(--rv-text); }
    #${MIS_PANEL_ID} .mis-f { font-size: 13px; color: var(--rv-text); }
    #${MIS_PANEL_ID} .mis-kvs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; margin: 8px 0 12px; }
    #${MIS_PANEL_ID} .mis-kv { margin: 0; font-size: 12px; color: var(--rv-text); line-height: 1.35; }
    #${MIS_PANEL_ID} .mis-kv b { display: block; margin-bottom: 2px; font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--rv-text-2); }
    #${MIS_PANEL_ID} .mis-m { font-size: 13px; color: var(--rv-text); padding: 12px; border: 0; border-radius: 12px; background: var(--rv-panel-2); }
    #${MIS_PANEL_ID} .mis-a { color: var(--rv-text-2); font-size: 12px; }
    #${MIS_PANEL_ID} .mis-boot-t { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; color: var(--rv-text); font-size: 11px; letter-spacing: .1em; }
    #${MIS_PANEL_ID} .mis-model, #${MIS_PANEL_ID} .mis-boot, #${MIS_PANEL_ID} .mis-teze { margin-top: 14px; padding-top: 12px; }
    #${MIS_PANEL_ID} button.boot-ins, #${MIS_PANEL_ID} button.mis-connect {
      color: var(--rv-on-accent); background: var(--rv-accent-fill); border-color: var(--rv-accent-fill); font-weight: 650; min-height: 36px; padding: 0 14px; border-radius: 10px;
    }
    #${MIS_PANEL_ID} button.boot-copy { min-height: 36px; padding: 0 14px; border-radius: 10px; }
  `;

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    // v4.9.17: panourile SETT si Misiune refolosesc TOATE stilurile panoului PP fara
    // duplicare: fiecare selector "#pp-panel..." devine ":is(#pp-panel, #sett, #mis)..."
    style.textContent = css
      .split('#' + PANEL_ID).join(':is(#' + PANEL_ID + ', #' + SETT_PANEL_ID + ', #' + MIS_PANEL_ID + ')')
      // 2026-09-25: tema dark = .dark pe <html> (shell-ul vechi) SAU html[data-theme="dark"] (shell-ul 2026-09)
      .split(':root.renda-vigilia-theme.dark').join(':root.renda-vigilia-theme:is(.dark, [data-theme="dark"])');
    document.head.appendChild(style);
  }

  function findAndMarkRoot() {
    const candidates = [...document.body.children].filter((node) =>
      node instanceof HTMLElement && node.tagName === 'DIV' && node.id !== HUD_ID
    );
    // 2026-09-25: shell-ul ChatGPT 2026-09 monteaza aplicatia in <div id="root"> (fara #__next)
    const preferred = candidates.find((node) =>
      node.id === '__next' || node.id === 'root' || node.id === 'app' || node.getAttribute('data-testid') === 'app-root'
    );
    let root = preferred || null;
    if (!root) {
      // v3.2.2: ancora DETERMINISTA — containerul aplicatiei = stramosul lui <main> direct sub
      // body (shell-ul ChatGPT isi schimba structura intre incarcari; euristica de arie maxima
      // a marcat elementul gresit pe shell-ul nou => push aplicat aiurea).
      const main = document.querySelector('main');
      const viaMain = main ? main.closest('body > *') : null;
      if (viaMain && viaMain.tagName === 'DIV' && viaMain.id !== HUD_ID) root = viaMain;
    }
    if (!root) {
      // v2_cl: containerul real al aplicatiei = cel mai mare DIV vizibil din body.
      // Overlay-urile (toast-uri pointer-events-none, dialoguri, alerte) sunt excluse —
      // pe chatgpt.com apar INAINTEA aplicatiei in body si v1 le marca gresit drept root.
      let bestArea = 0;
      for (const node of candidates) {
        if (node.matches('[role="dialog"], [role="alert"], .pointer-events-none')) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width < 300 || rect.height < 200) continue;
        const area = rect.width * rect.height;
        if (area > bestArea) { bestArea = area; root = node; }
      }
    }
    if (root) {
      // marcaj UNIC: observer-ul re-ruleaza pe mutatii de body — curata orice marcaj vechi
      // ramas pe alt nod (altfel un overlay marcat gresit ocupa inaltimea viewportului).
      document.querySelectorAll('.' + ROOT_CLASS).forEach((node) => {
        if (node !== root) node.classList.remove(ROOT_CLASS);
      });
      root.classList.add(ROOT_CLASS);
    }
    return root;
  }

  // v4.37.0 — iconite SVG (in locul emoji-urilor din bara si din cardul Misiunea mea)
  const RV_ICON_PATHS = {
    logo: '<path d="M12 2.5 20.5 7.25v9.5L12 21.5 3.5 16.75v-9.5z"/><path d="M6.5 12s2-3.5 5.5-3.5 5.5 3.5 5.5 3.5-2 3.5-5.5 3.5-5.5-3.5-5.5-3.5z"/><circle cx="12" cy="12" r="1.4"/>',
    prompt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    agents: '<rect x="4" y="7" width="16" height="12" rx="3"/><path d="M12 7V4"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/>',
    shkn: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
    projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    mission: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    day: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    canon: '<path d="M12 4v16M7 20h10M5 7h14"/><path d="M5 7 2.5 13a2.5 2.5 0 0 0 5 0z"/><path d="M19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
    theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12 20 3M16 7l3 3"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>'
  };
  function rvIcon(name, size) {
    const z = size || 15;
    return '<svg class="rv-ic" width="' + z + '" height="' + z + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (RV_ICON_PATHS[name] || '') + '</svg>';
  }
  // butoanele cu iconita: textul sta intr-un .rv-lbl, ca mesajele temporare ("✓ inserat") sa nu stearga iconita
  function rvSetLabel(btn, text) { const l = btn && (btn.querySelector('.rv-lbl') || btn); if (l) l.textContent = text; }

  // ChatGPT isi redenumeste des clasele de viewport. Pe langa variantele CSS cunoscute,
  // marcheaza strict ancestorii lui <main>/composer care au inaltime apropiata de viewport.
  // Marcajul este ingust: nu atinge listele virtualizate din sidebar sau panourile HUD.
  function markViewportShells(root) {
    if (!(root instanceof HTMLElement)) return;
    const anchors = [document.querySelector('main'), findComposer()]
      .filter((node) => node instanceof HTMLElement && root.contains(node));
    const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
    const seen = new Set();

    for (const anchor of anchors) {
      let node = anchor;
      while (node && node !== root && node instanceof HTMLElement) {
        if (!seen.has(node)) {
          seen.add(node);
          const cls = typeof node.className === 'string' ? node.className : '';
          const rect = node.getBoundingClientRect();
          const namedViewport = /(?:^|\s)h-(?:s|d|l)vh(?:\s|$)|(?:^|\s)h-screen(?:\s|$)|h-\[100(?:s|d|l)?vh\]/.test(cls);
          const geometricViewport = viewportHeight > 0
            && rect.height >= viewportHeight - 4
            && rect.height <= viewportHeight + 96;
          if (namedViewport || geometricViewport) node.classList.add(VIEWPORT_CLASS);
        }
        node = node.parentElement;
      }
    }
  }

  // Selectorul nativ Chat / Work este acum un element viewport-fixed. Il identificam dupa
  // perechea de butoane si marcam numai cel mai apropiat container comun, daca este o capsula
  // mica aflata in zona acoperita de HUD. Linkul "Chat" din HUD nu este buton si este exclus.
  function markNativeModeSwitch() {
    const buttons = [...document.querySelectorAll('button')].filter((button) =>
      button instanceof HTMLElement && !button.closest('#' + HUD_ID)
    );
    const label = (button) => String(button.getAttribute('aria-label') || button.textContent || '')
      .trim().toLowerCase();
    const chat = buttons.find((button) => label(button) === 'chat');
    const work = buttons.find((button) => label(button) === 'work');
    if (!chat || !work) return;

    let wrapper = chat.parentElement;
    while (wrapper && wrapper !== document.body && !wrapper.contains(work)) wrapper = wrapper.parentElement;
    if (!(wrapper instanceof HTMLElement) || wrapper === document.body) return;

    const rect = wrapper.getBoundingClientRect();
    const hudHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rv-hud-height')) || 0;
    // 2026-09-25: shell-ul nou onoreaza --app-shell-root-banner-height (CSS-ul HUD o seteaza la inaltimea
    // benzii) => capsula coboara singura; translate-ul ramane DOAR pentru shell-ul vechi (altfel s-ar
    // deplasa de doua ori: o data nativ, o data prin translate).
    const native = parseFloat(getComputedStyle(wrapper).getPropertyValue('--app-shell-root-banner-height')) || 0;
    if (native >= hudHeight - 1) { wrapper.classList.remove(MODE_SWITCH_CLASS); return; }
    if (rect.width > 0 && rect.width <= 640 && rect.height > 0 && rect.height <= 120 && rect.top < hudHeight + 8) {
      wrapper.classList.add(MODE_SWITCH_CLASS);
    }
  }

  function syncResponsiveLayout() {
    const root = findAndMarkRoot();
    markViewportShells(root);
    markNativeModeSwitch();
  }

  function createHud() {
    const existing = document.getElementById(HUD_ID);
    if (existing) return existing;

    const hud = document.createElement('section');
    hud.id = HUD_ID;
    hud.setAttribute('data-rvla', 'bar.aria');

    hud.innerHTML = `
      <canvas class="rv-field" aria-hidden="true"></canvas>
      <div class="rv-shell">
        <div class="rv-left">
          <span class="rv-logo" aria-hidden="true">${rvIcon('logo', 26)}</span>
          <div>
            <div class="rv-brand-line"><span class="rv-brand" data-rv-brand="title"></span><span class="rv-ver" data-rvlt="bar.version_title">v${RUNNING_VER} · ${BUILD_STAMP}</span></div><div class="rv-system" data-rv-brand="system"></div>
            <div class="rv-status">● <b data-rv-online></b></div>
          </div>
        </div>
        <div class="rv-center">
          <span class="rv-orbit" aria-hidden="true"></span>
          <div class="rv-command" data-rv-brand="command_title"></div>
          <div class="rv-command-sub" data-rv-brand="command_subtitle"></div>
        </div>
        <div class="rv-right" data-rvla="bar.metrics_aria">
          <span class="rv-metric-label" data-rvl="bar.m_hud"></span><span class="rv-meter"><i data-rv-hud-bar style="width:0%"></i></span><span class="rv-metric-value" data-rv-hud>…</span>
          <span class="rv-metric-label" data-rvl="bar.m_cpu"></span><span class="rv-meter"><i data-rv-cpu-bar style="width:0%"></i></span><span class="rv-metric-value" data-rv-cpu>—</span>
          <span class="rv-metric-label" data-rvl="bar.m_ram"></span><span class="rv-meter"><i data-rv-ram-bar style="width:0%"></i></span><span class="rv-metric-value" data-rv-ram>—</span>
          <span class="rv-metric-label" data-rvl="bar.m_route"></span><span class="rv-meter route"><i style="width:72%"></i></span><span class="rv-metric-value" data-rv-route>/</span>
          <span class="rv-metric-label" data-rvl="bar.m_clock"></span><span class="rv-meter"><i style="width:45%"></i></span><span class="rv-metric-value" data-rv-clock>--:--:--</span>
        </div>
      </div>
      <nav class="rv-nav" data-rvla="bar.nav_aria">
        <span class="rv-nav-label" data-rvl="bar.pages"></span><span class="rv-links"></span><span class="rv-nav-sep" aria-hidden="true"></span>
        <button class="rv-pp-btn" type="button" data-rvlt="bar.prompt_title">${rvIcon('prompt')}<span class="rv-lbl" data-rvl="bar.prompt"></span></button>
        <button class="rv-ag-btn" type="button" data-rvlt="bar.agents_title">${rvIcon('agents')}<span class="rv-lbl" data-rvl="bar.agents"></span></button>
        <button class="rv-shkn-btn" type="button" data-rvlt="bar.shkn_title">${rvIcon('shkn')}<span class="rv-lbl" data-rvl="bar.shkn"></span></button>
        <button class="rv-pp-btn rv-sett-btn" type="button" data-rvlt="bar.projects_title">${rvIcon('projects')}<span class="rv-lbl" data-rvl="bar.projects"></span></button>
        <button class="rv-pp-btn rv-mis-btn" type="button" data-rvlt="bar.mission_title">${rvIcon('mission')}<span class="rv-lbl" data-rvl="bar.mission"></span></button>
        <button class="rv-pp-btn rv-day-btn" type="button" data-rvlt="bar.day_title">${rvIcon('day')}<span class="rv-lbl" data-rvl="bar.day"></span></button>
        <button class="rv-pp-btn rv-canon-btn" type="button" data-rvlt="bar.canon_title">${rvIcon('canon')}<span class="rv-lbl" data-rvl="bar.canon"></span></button>
        <span class="rv-canon-line" data-rv-canon></span>
        <select class="rv-org" hidden></select>
        <button class="rv-conn" type="button" hidden></button>
        <button class="rv-pp-btn rv-theme-btn" type="button" data-rvlt="bar.theme_title" data-rvla="bar.theme_aria">${rvIcon('theme')}<span class="rv-lbl"></span></button>
        <a class="renda" href="${CONFIG.rendaHudUrl}" target="_blank" rel="noopener" data-rvl="bar.local_hud"></a>
      </nav>
      <button class="rv-collapse" type="button">−</button>
    `;

    document.body.prepend(hud);
    return hud;
  }

  // v4.47.0 (HUD-7): partea benzii care vine din organizatie — numele, linkurile, cuvintele. Inainte de conectare
  // (sau pana soseste prima configuratie) banda arata doar marca si butonul de conectare (clasa rv-pre), iar
  // panourile stau ascunse: nu au inca nimic de aratat.
  function renderBar(hud) {
    if (!hud) return;
    const pre = !hasApiAuth() || !rvCfgLoaded;
    hud.classList.toggle('rv-pre', pre);
    document.documentElement.dataset.rvPre = pre ? '1' : '0';
    const b = RV_BRAND || {};
    const set = (k, v) => { const el = hud.querySelector('[data-rv-brand="' + k + '"]'); if (el) el.textContent = v; };
    set('title', pre ? RV_PRE.brand : (b.title || (rvOrg ? rvOrg.name : '')));
    set('system', pre ? '' : [b.system, b.subtitle].filter(Boolean).join(' · '));
    set('command_title', pre ? '' : (b.command_title || ''));
    set('command_subtitle', pre ? '' : (b.command_subtitle || ''));
    const links = hud.querySelector('.rv-links');
    if (links) links.innerHTML = pre ? '' : RV_LINKS.map((x) => '<a href="' + esc(x[1]) + '" data-rv-path="' + esc(x[1]) + '">' + esc(x[0]) + '</a>').join('');
    refreshLabels(hud);
    applyTheme(hud);
    updateState(hud);
  }

  function setCollapsed(hud, collapsed) {
    document.documentElement.dataset.rvCollapsed = String(collapsed);
    const button = hud.querySelector('.rv-collapse');
    if (button) {
      button.textContent = collapsed ? '+' : '−';
      button.title = L(collapsed ? 'bar.expand' : 'bar.collapse');
      button.setAttribute('aria-label', button.title);
    }
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch (_) {}
    requestAnimationFrame(syncResponsiveLayout);
  }

  function updateState(hud) {
    const online = navigator.onLine;
    const onlineNode = hud.querySelector('[data-rv-online]');
    const linkNode = hud.querySelector('[data-rv-link]');
    const routeNode = hud.querySelector('[data-rv-route]');
    const clockNode = hud.querySelector('[data-rv-clock]');
    if (onlineNode) onlineNode.textContent = L(online ? 'bar.online' : 'bar.offline');
    if (linkNode) {
      linkNode.textContent = L(online ? 'bar.link_online' : 'bar.link_offline');
      linkNode.classList.toggle('online', online);
    }
    if (routeNode) routeNode.textContent = location.pathname.length > 12 ? '…' + location.pathname.slice(-10) : location.pathname;
    if (clockNode) clockNode.textContent = new Intl.DateTimeFormat('ro-RO', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date());

    hud.querySelectorAll('[data-rv-path]').forEach((link) => {
      const path = link.getAttribute('data-rv-path');
      link.classList.toggle('active', path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));
    });
  }

  // === v3.2: PROMPT PERPETUU + SABLOANE (scriptul DOAR SCRIE in composer, nu trimite niciodata) ===
  function getPP() { try { return localStorage.getItem(PP_KEY) || ''; } catch (_) { return ''; } }
  function setPP(text) { try { text ? localStorage.setItem(PP_KEY, text) : localStorage.removeItem(PP_KEY); } catch (_) {} }

  // v3.7: DIRECTIVA CANON (a userului, LOCALA) — intra in capsula [USER DIRECTIVE] a blocului canon.
  // Distincta de Prompt Perpetuu (acela scrie in COMPOSER); asta se adauga in stratul canon la trimitere.
  // Salvata in localStorage (nu pe disc HUD) -> merge independent de server. Combinata cu directivele HUD.
  function getUserDirective() { try { return localStorage.getItem(UDIR_KEY) || ''; } catch (_) { return ''; } }
  function setUserDirective(t) { try { t ? localStorage.setItem(UDIR_KEY, t) : localStorage.removeItem(UDIR_KEY); } catch (_) {} }

  // v3.9: IDENTITATE SESIUNE (Nume Prenume) — declaratie de deschidere de sesiune/continuum.
  function getIdent() { try { return localStorage.getItem(IDENT_KEY) || ''; } catch (_) { return ''; } }
  function setIdent(t) { try { t ? localStorage.setItem(IDENT_KEY, t) : localStorage.removeItem(IDENT_KEY); } catch (_) {} }

  // 2026-09-25: COMPOSER-UL NOU. ChatGPT (layout "Chat | Work", shell #root) a scos id-ul #prompt-textarea:
  // composer-ul e un ProseMirror FARA id —
  //   div[contenteditable="true"][role="textbox"][aria-label="Ask ChatGPT"][data-composer-markdown]
  // — intr-un <form>; pe pagina FARA login e <textarea id="mobile-composer-prompt" name="prompt">.
  // Cautare pe straturi: id-ul vechi (daca e vizibil) -> textbox/ProseMirror VIZIBIL -> textarea de prompt.
  // Se sar elementele din HUD/panouri si cele invizibile (ChatGPT tine uneori un textarea de rezerva
  // ascuns, mereu gol). execCommand('insertText') ramane calea de inserare: pe DOM-ul logat 2026-09-25
  // textul intra ca paragrafe si React vede starea (butonul Send apare imediat).
  const COMPOSER_SEL = [
    '#prompt-textarea',
    '[contenteditable="true"][role="textbox"]',
    '.ProseMirror[contenteditable="true"]',
    '[contenteditable="true"][data-composer-markdown]',
    'textarea#mobile-composer-prompt',
    'textarea[name="prompt"]',
    'textarea[name="prompt-textarea"]'
  ].join(', ');
  function rvVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (_) { return false; }
  }
  function isHudNode(el) { return !!(el && el.closest && el.closest('#' + HUD_ID + ', [id^="renda-vigilia-"]')); }
  function isTextarea(ed) { return !!ed && (ed.tagName === 'TEXTAREA' || ed.tagName === 'INPUT'); }
  // textul din composer: .value la textarea; .innerText (cu newline intre paragrafe) la ProseMirror
  function composerText(ed) {
    if (!ed) return '';
    if (isTextarea(ed)) return ed.value || '';
    return (typeof ed.innerText === 'string' ? ed.innerText : ed.textContent) || '';
  }
  function findComposer() {
    const legacy = document.getElementById('prompt-textarea');
    if (legacy && rvVisible(legacy)) return legacy;
    // DOAR candidati VIZIBILI: un composer ascuns ar insemna o inserare "reusita" intr-un element gresit
    // (mai bine "composer negasit" sincer). Cand sunt mai multi vizibili (editorul "Edit message" al unui
    // mesaj vechi e tot un ProseMirror role=textbox cu data-composer-markdown, intr-un <form>, dar sta
    // DEASUPRA firului), il alegem pe cel mai de JOS de pe ecran = composer-ul real (verificat 2026-09-25).
    let best = null, bestTop = -Infinity;
    const all = document.querySelectorAll(COMPOSER_SEL);
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (isHudNode(el) || !rvVisible(el)) continue;
      const top = el.getBoundingClientRect().top;
      if (top > bestTop) { best = el; bestTop = top; }
    }
    return best;
  }

  // inserare la cursor cu sincronizare React — UNICA rutina, folosita si de BOOT/canon la trimitere:
  // execCommand('insertText') merge pe ProseMirror si pe textarea; daca esueaza pe textarea, setter-ul nativ.
  function rvInsertText(ed, text) {
    let ok = false;
    try { ok = !!document.execCommand('insertText', false, text); } catch (_) { ok = false; }
    if (!ok && isTextarea(ed)) {
      // textarea controlat de React: setter-ul nativ + eveniment input (altfel React nu vede valoarea)
      try {
        const proto = ed.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        const s = ed.selectionStart != null ? ed.selectionStart : ed.value.length;
        const e = ed.selectionEnd != null ? ed.selectionEnd : s;
        setter.call(ed, ed.value.slice(0, s) + text + ed.value.slice(e));
        ed.setSelectionRange(s + text.length, s + text.length);
        ok = true;
      } catch (_) {}
    }
    if (ok) {
      // sincronizare React/ProseMirror: un input-event explicit dupa inserare (starea butonului Send)
      try { ed.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text })); } catch (_) {}
    }
    return ok;
  }
  function insertIntoComposer(text) {
    const ed = findComposer();
    if (!ed) { rvlog('composer: NEGASIT (niciun element VIZIBIL pentru COMPOSER_SEL)'); return false; }
    ed.focus();
    const ok = rvInsertText(ed, text);
    rvlog('composer: ' + (ok ? 'inserat' : 'inserare ESUATA') + ' in <' + ed.tagName.toLowerCase() + (ed.id ? '#' + ed.id : '') + '> (' + String(text).length + ' caractere)');
    return ok;
  }

  // v4.9: panoul Agenti GPT + Skills (catalog copt din registrele RENDA prin build_agents_data.py)
  function buildAgentsPanel(hud) {
    let panel = document.getElementById(AG_PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = AG_PANEL_ID;
    // v4.9.15: tab-ul Plugins primul (si implicit); agentii impartiti in Workspace / Externi
    panel.innerHTML = '<button class="ag-close" type="button" data-rvla="common.close">✕</button>'
      + '<h3 data-rvl="ag.h"></h3>'
      + '<div class="ag-tabs">'
      + '<button class="ag-tab on" data-tab="skills" type="button"></button>'
      + '<button class="ag-tab" data-tab="agents" type="button"></button>'
      + '<button class="ag-tab" data-tab="external" type="button"></button>'
      + '</div>'
      + '<input class="ag-search" type="text" data-rvlp="ag.search_ph">'
      + '<div class="ag-list"></div>'
      + '<div class="ag-hint" data-rvl="ag.hint"></div>';
    document.body.appendChild(panel);
    const list = panel.querySelector('.ag-list');
    const search = panel.querySelector('.ag-search');
    let tab = 'skills';
    // v4.9.16: cautare cu SINONIME + fara diacritice. Fiecare grup = termeni echivalenti (radacini, fara diacritice);
    // termenii scurti (<=4 litere) se potrivesc doar la INCEPUT de cuvant (altfel "sea" ar gasi "research").
    // v4.47.0 (HUD-7): grupurile sunt ale organizatiei (/api/hud/config → synonyms: [{label, terms}]); eticheta unui
    // grup e tagul pus pe cardurile de pluginuri (null = prea general pentru tag). Indexul se reface la alta lista.
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let synFor = null;
    let SYN_NORM = [];
    let SYN_LBL = [];
    let SYN_SCURTE = new Set();
    function syncSynonyms() {
      if (synFor === RV_SYNONYMS) return;
      synFor = RV_SYNONYMS;
      SYN_NORM = RV_SYNONYMS.map((g) => g.terms.map(norm));
      SYN_LBL = RV_SYNONYMS.map((g) => g.label || null);
      SYN_SCURTE = new Set([].concat(...SYN_NORM).filter((t) => t.length <= 4));   // v4.44.0: termenii scurți rămân cuvinte întregi
    }
    // un cuvant >=3 litere se extinde la toate grupurile in care se potriveste ca prefix
    function expandWord(w) {
      const out = new Set([w]);
      // v4.44.0: 3 litere = numai potrivire exactă cu un termen (sea → mediu, nu și search); de la 4 litere, prefix în ambele sensuri
      if (w.length >= 3) SYN_NORM.forEach((g) => { if (g.some((t) => (w.length === 3 ? t === w : t.startsWith(w)) || (w.length >= 4 && w.startsWith(t)))) g.forEach((t) => out.add(t)); });
      return [...out];
    }
    // variantele scurte se potrivesc restrictiv, ca "sea"/"ran" sa nu prinda "search"/"transcriere":
    // <=3 litere = cuvant intreg (PUG, SEA, RAN, GIS); 4 litere = inceput de cuvant (lege->legea); >4 = oriunde
    const vHit = (h, v) => {
      if (v.length > 4) return h.indexOf(v) !== -1;
      const e = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp('(^|[^a-z0-9])' + e + (v.length <= 3 ? '($|[^a-z0-9])' : '')).test(h);
    };
    // v4.37.0: numaratorile se recalculeaza la fiecare randare (datele pot veni de pe RENDA)
    function renderTabs() {
      const n = (a) => (a || []).length;
      panel.querySelector('[data-tab="skills"]').textContent = L('ag.tab_skills', { n: n(RV_AGENTS.skills) + n(RV_PLUGINS) });
      panel.querySelector('[data-tab="agents"]').textContent = L('ag.tab_agents', { n: n(RV_AGENTS.agents) });
      panel.querySelector('[data-tab="external"]').textContent = L('ag.tab_external', { n: n(RV_AGENTS.external) });
    }
    function render() {
      syncSynonyms();
      renderTabs();
      const qRaw = norm(search.value || '').split(/\s+/).filter(Boolean);
      const qWords = qRaw.map(expandWord);
      // itemul trece daca FIECARE cuvant cautat (sau un sinonim al lui) apare in text
      // v4.44.0: cuvântul tastat (3+ litere) se potrivește și ca ÎNCEPUT de cuvânt («wol» găsește Wolfram, în timp ce tastezi);
      // termenii scurți din sinonime (sea, ran, pug, gis…) rămân cuvinte întregi, ca «sea» să nu prindă «search».
      const hit = (hay) => { const h = norm(hay); return qWords.every((vars, i) => vars.some((v) => vHit(h, v)) || (qRaw[i].length >= 3 && !SYN_SCURTE.has(qRaw[i]) && new RegExp('(^|[^a-z0-9])' + qRaw[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h))); };
      const q = qWords.length ? '1' : '';
      let html = '';
      if (tab === 'agents' || tab === 'external') {
        let last = null;
        ((tab === 'agents' ? RV_AGENTS.agents : RV_AGENTS.external) || []).forEach((a) => {
          if (q && !hit(a.n + ' ' + (a.e || '') + ' ' + (a.c || ''))) return;
          if (a.c !== last) { html += '<div class="ag-cluster">' + esc(a.c || '—') + '</div>'; last = a.c; }
          const ar = a.a ? '<button class="amber" type="button" data-copy="@' + esc(a.a) + '" title="' + esc(L('ag.copy_alias_title')) + '">📋 @' + esc(a.a) + '</button>' : '';
          html += '<div class="ag-card"><div class="ag-info"><div class="ag-name">' + esc(a.n) + '</div><div class="ag-desc">' + esc(a.e || '') + '</div></div><div class="ag-act"><button type="button" data-open="' + esc(a.u) + '">' + esc(L('ag.open')) + '</button>' + ar + '</div></div>';
        });
      } else {
        // v4.43.0: lista vine din inventarul ChatGPT (CATALOG_PLUGINURI_SKILLURI, coaptă de build_plugins_data.py):
        // fiecare plugin cu comanda lui de invocare (fraza + RENDA::REQUEST + «Sarcina: »). Întâi pluginurile cu o
        // singură comandă, apoi cele cu mai multe skilluri, fiecare sub numele lui, câte un rând pe skill.
        // Click pe nume = comanda intră în composer; «📋 activare» = comanda în clipboard; «▶ Deschide» = pagina pluginului.
        // Vechea listă RV_AGENTS.skills (15 skilluri native) nu se mai afișează: sunt în inventar, sub «OpenAI · …».
        const card = (p, nume, desc, k) => '<div class="ag-card"><div class="ag-info"><div class="ag-name" data-ins="' + esc(k[2]) + '" title="' + esc(L('ag.insert_title')) + '">' + esc(nume) + '</div><div class="ag-desc">' + esc(desc || '') + (k[3] ? ' <i>(' + esc(k[3]) + ')</i>' : '') + '</div>' + tagsHtml(p) + '</div><div class="ag-act"><button type="button" class="amber" data-copy="' + esc(k[2]) + '" title="' + esc(L('ag.copy_cmd_title')) + '">' + esc(L('ag.copy_cmd')) + '</button>' + (p.id ? '<button type="button" data-plugin="' + esc(p.id) + '" title="' + esc(L('ag.open_plugin_title')) + '">' + esc(L('ag.open')) + '</button>' : '') + '</div></div>';
        // v4.44.0: tagurile unui plugin: sursa (RENDA / aplicație / OpenAI), tipul (din numele lui și al skillurilor) și domeniile
        // (grupurile de sinonime care apar în nume, în descrierea scurtă și în numele skillurilor); intră și în căutare.
        // cuvintele din numele pluginurilor (persona, tool, mech, flow, sys) → tagul afisat, din dictionar
        const TIPURI = ['persona', 'tool', 'mech', 'flow', 'sys'];
        const tagsOf = (p) => {
          if (p._tg) return p._tg;
          const h = norm(p.n + ' ' + (p.d || '') + ' ' + (p.k || []).map((k) => k[0]).join(' '));
          const t = [L(!p.id || /^plugin_connector_1p_/.test(p.id) ? 'ag.src_openai' : (/^plugin_asdk_app_/.test(p.id) ? 'ag.src_app' : 'ag.src_own'), { org: rvOrg ? rvOrg.name : '' })];
          TIPURI.forEach((w) => { if (new RegExp('(^|[^a-z0-9])' + w + '($|[^a-z0-9])').test(h)) t.push(L('ag.type_' + w)); });
          SYN_NORM.forEach((g, i) => { if (SYN_LBL[i] && g.some((v) => vHit(h, v))) t.push(SYN_LBL[i]); });
          (p.g || []).forEach((x) => { if (t.indexOf(x) < 0) t.push(x); });   // tagurile puse de mână (TAGURI_MANUALE.json)
          return (p._tg = t);
        };
        const tagsHtml = (p) => '<div class="ag-tags">' + tagsOf(p).map((x) => '#' + esc(x)).join(' ') + '</div>';
        // căutarea vede ce se vede pe card: numele, descrierea, tagurile, skillul; descrierea lungă a skillului numai unde e afișată (pluginurile cu mai multe skilluri)
        const potriv = (p) => (p.k || []).filter((k) => !q || hit(p.n + ' ' + (p.d || '') + ' ' + tagsOf(p).join(' ') + ' ' + k[0] + ' ' + ((p.k || []).length > 1 ? (k[1] || '') : '')));
        let shown1 = 0;
        (RV_PLUGINS || []).forEach((p) => {
          if ((p.k || []).length !== 1) return;
          const ks = potriv(p);
          if (!ks.length) return;
          if (!shown1++) html += '<div class="ag-cluster">' + esc(L('ag.plugins_h')) + '</div>';
          html += card(p, p.n + (ks[0][0] ? ' · $' + ks[0][0] : ''), p.d, ks[0]);
        });
        (RV_PLUGINS || []).forEach((p) => {
          if ((p.k || []).length < 2) return;
          const ks = potriv(p);
          if (!ks.length) return;
          html += '<div class="ag-cluster">' + esc(p.n) + '</div>';
          ks.forEach((k) => { html += card(p, '$' + k[0], k[1] || p.d, k); });
        });
      }
      const empty = !(RV_AGENTS.agents || []).length && !(RV_AGENTS.external || []).length && !(RV_AGENTS.skills || []).length && !(RV_PLUGINS || []).length;
      list.innerHTML = html || '<div class="ag-desc">' + esc(empty ? rvEmptyHint(L('ag.what')) : L('common.nothing_found')) + '</div>';
    }
    panel.querySelector('.ag-close').addEventListener('click', () => panel.classList.remove('open'));
    panel.querySelectorAll('.ag-tab').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      panel.querySelectorAll('.ag-tab').forEach((x) => x.classList.toggle('on', x === b));
      render();
    }));
    search.addEventListener('input', render);
    list.addEventListener('click', (ev) => {
      // v4.9.43: click pe numele unui plugin -> directiva RENDA::ACTIVATE intra in composer
      const ni = ev.target.closest('[data-ins]');
      if (ni && !ev.target.closest('button')) {
        const ok = insertIntoComposer(ni.dataset.ins + '\n');
        const t = ni.textContent;
        ni.textContent = L(ok ? 'common.inserted_composer' : 'common.no_composer');
        setTimeout(() => { ni.textContent = t; }, 1000);
        return;
      }
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.open) {
        panel.classList.remove('open');
        // v4.9.4: URL corect de GPT = chatgpt.com/g/g-<id>-slug. Datele poarta doar
        // "g-<id>-slug", deci trebuie prefixat cu /g/ (inainte naviga la /g-... = 404/gresit).
        let u = b.dataset.open || '';
        if (!/^https?:/i.test(u)) {
          u = u.replace(/^\/+/, '');
          if (!u.startsWith('g/')) u = 'g/' + u;
          u = 'https://chatgpt.com/' + u;
        }
        location.href = u;
      }
      else if (b.dataset.plugin) {
        panel.classList.remove('open');
        location.href = 'https://chatgpt.com/plugins/' + b.dataset.plugin;
      }
      else if (b.dataset.copy) {
        navigator.clipboard.writeText(b.dataset.copy).then(() => {
          const t = b.textContent; b.textContent = L('common.copied');
          setTimeout(() => { b.textContent = t; }, 900);
        }).catch(() => {});
      }
    });
    panel.rvRender = render;
    render();
    return panel;
  }

  // v4.38: numarul fisei (id) se vede pe card si intra in cautare ca tag (decizia autorului 13.10.2026:
  // un singur cod pentru toate fisele = numarul din SHKN; ghidul colegilor se regenereaza din banca).
  // v4.14: panoul SHKN — Shared HUMAN Knowledge (biblioteca de experienta umana testata,
  // coapta din SHKN/ITEMS prin build_shkn_data.py). Cautarea = potrivire PROCENTUALA pe
  // cuvintele nevoii (taguri > titlu > corp), rezultate ordonate descrescator, % afisat
  // in dreapta (cerinta autor 2026-07-25). Copierea = knowledge INCAPSULAT: pastreaza
  // ideea generala, construieste-ti propriul scenariu pe cererea userului.
  // v4.47.0 (HUD-7): textul de incadrare e al platformei (shkn.wrap), proprietarul e al organizatiei (texts.shkn_owner)
  function shknWrap(it) {
    // corpul fisei intra ULTIMUL, ca acoladele din textul ei sa nu fie citite drept campuri
    return L('shkn.wrap', {
      owner: RV_TEXTS.shkn_owner || (rvOrg ? rvOrg.name : ''),
      origin: it.o || 'N/A', date: it.d || 'N/A', case: it.cz || 'N/A', id: it.id || '?',
      body: it.b || ''
    });
  }
  // cui i se trimite o propunere SHKN: persoana numita de organizatie, altfel formula neutra din dictionar
  function shknContact() { return rvShknContact || L('shkn.contact_default'); }
  // SHKN_PROPUNERE_FN_START — v4.40.0: fișierul de propunere al unui coleg, în forma fișelor din bancă
  // (TITLU/OPERATOR/DATA/CAZ/EDITIE/TAGS, apoi --- și textul) + câmpurile PROPUNERE_*. Extensia nu trimite nimic:
  // colegul trimite fișierul pe e-mail sau WhatsApp; primirea e mecanică (SHKN/shkn_propuneri.py, fără AI).
  function shknPropFile(p) {
    const pad = (n) => String(n).padStart(2, '0');
    const d = p.when || new Date();
    const zi = pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear();
    const ora = pad(d.getHours()) + ':' + pad(d.getMinutes());
    const one = (x) => String(x == null ? '' : x).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
    const baza = p.base ? String(p.base.id || '') : 'NOUA';
    const slug = one(p.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'coleg';
    const fname = 'SHKN_PROPUNERE_' + baza + '_' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '_' + slug + '.md';
    const head = [
      'TITLU: ' + one(p.title || (p.base && p.base.t) || ''),
      'OPERATOR: ' + one(p.name),
      'DATA: ' + zi,
      'CAZ: ' + one(p.base ? (p.base.cz || '') : (p.caz || '')),
      'EDITIE: Propunere de la ' + one(p.name) + ', ' + zi + ' ' + ora + ', prin butonul «Propune» din extensia RENDA HUD ' + one(p.ver || '?') + ': ' + one(p.why),
      'PROPUNERE_BAZA: ' + baza,
      'PROPUNERE_BAZA_SHA16: ' + one(p.baseSha16 || ''),
      'PROPUNERE_MOTIV: ' + one(p.why),
      'PROPUNERE_EXTENSIE: ' + one(p.ver || '?'),
      'TAGS: ',
    ];
    const body = String(p.text || '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
    return { name: fname, text: head.join('\n') + '\n---\n' + body + '\n' };
  }
  // SHKN_PROPUNERE_FN_END
  function buildShknPanel(hud) {
    let panel = document.getElementById(SHKN_PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = SHKN_PANEL_ID;
    let items = [];   // v4.37.0: re-citit la fiecare randare (itemii pot veni de pe RENDA)
    panel.innerHTML = '<button class="ag-close" type="button" data-rvla="common.close">✕</button>'
      + '<h3><span data-rvl="shkn.h"></span> (<span class="shkn-n">0</span>)</h3>'
      + '<button class="shkn-newprop" type="button" data-rvl="shkn.newprop"></button>'
      + '<div class="shkn-prop"></div>'
      + '<input class="ag-search" type="text" data-rvlp="shkn.search_ph">'
      + '<div class="ag-list"></div>'
      + '<div class="ag-hint shkn-hint"></div>';
    document.body.appendChild(panel);
    const list = panel.querySelector('.ag-list');
    const search = panel.querySelector('.ag-search');
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    // scor de potrivire per item: fiecare cuvant al nevoii (>=3 litere) cantareste 1.0 daca
    // loveste un TAG (prefix-5, ca selectorul de canon), 0.9 daca apare in TITLU, 0.5 daca
    // apare doar in CORP; procent = medie * 100. Determinist, fara aleator.
    function shknScore(qWords, it) {
      if (!qWords.length) return -1;
      const tags = (it.tags || []).concat(it.id ? [String(it.id)] : []).map(norm);
      const title = norm(it.t);
      const body = norm(it.b || '');
      let sum = 0;
      qWords.forEach((w) => {
        const w5 = w.slice(0, 5);
        if (tags.some((t) => t.slice(0, 5) === w5 || t.indexOf(w) !== -1)) sum += 1.0;
        else if (title.indexOf(w) !== -1) sum += 0.9;
        else if (w.length >= 4 && body.indexOf(w) !== -1) sum += 0.5;
      });
      return Math.round(100 * sum / qWords.length);
    }
    // la PROCENT EGAL (din 14.10.2026): (1) tagurile EGALE cu nevoia intreaga sau cu un cuvant al ei
    // (tagul citit ca nevoia: _ si - devin spatiu, cuvintele sub 3 litere cad), (2) cuvintele nevoii
    // gasite in TITLU, (3) abia apoi ordinea din banca. Procentul nu se schimba; fisa cu tema proprie
    // bate fisa care doar contine cuvintele.
    function shknTie(qWords, it) {
      if (!qWords.length) return [0, 0];
      const q = qWords.join(' ');
      const tags = (it.tags || []).map((t) => norm(t).replace(/[_-]+/g, ' ').split(/\s+/).filter((w) => w.length >= 3).join(' '));
      const title = norm(it.t);
      const exact = tags.filter((t) => t === q || qWords.indexOf(t) !== -1).length;
      const inTitle = qWords.filter((w) => title.indexOf(w) !== -1).length;
      return [exact, inTitle];
    }
    function render() {
      items = (RV_SHKN && RV_SHKN.items) || [];
      panel.querySelector('.shkn-n').textContent = items.length;
      // textele cu persoana de contact se rescriu aici (contactul vine din configuratia organizatiei)
      panel.querySelector('.shkn-newprop').title = L('shkn.newprop_title', { contact: shknContact() });
      panel.querySelector('.shkn-hint').textContent = L('shkn.hint', { contact: shknContact() });
      const qWords = norm(search.value || '').split(/\s+/).filter((w) => w.length >= 3);
      let rows = items.map((it, i) => ({it, i, pct: shknScore(qWords, it), tie: shknTie(qWords, it)}));
      if (qWords.length) rows = rows.filter((r) => r.pct > 0).sort((a, b) => b.pct - a.pct || b.tie[0] - a.tie[0] || b.tie[1] - a.tie[1] || a.i - b.i);
      let html = '';
      rows.forEach((r) => {
        const pct = r.pct >= 0 ? '<span class="shkn-pct' + (r.pct < 50 ? ' low' : '') + '">' + r.pct + '%</span>' : '';
        html += '<div class="ag-card"><div class="ag-info">'
          + '<div class="ag-name"><span class="shkn-id">' + esc(r.it.id || '') + '</span> ' + esc(r.it.t) + '</div>'
          + '<div class="ag-desc">' + esc((r.it.o || '') + ' · ' + (r.it.d || '') + ' · ' + (r.it.cz || '')) + '</div>'
          + '<div class="shkn-tags">' + esc((r.it.tags || []).slice(0, 10).join(' · ')) + '</div>'
          + '</div><div class="ag-act">' + pct
          + '<button type="button" data-shkn-view="' + r.i + '">' + esc(L('shkn.view')) + '</button>'
          + '<button type="button" class="amber" data-shkn-copy="' + r.i + '" title="' + esc(L('shkn.copy_title')) + '">' + esc(L('shkn.copy')) + '</button>'
          + '<button type="button" data-shkn-prop="' + r.i + '" title="' + esc(L('shkn.prop_title', { contact: shknContact() })) + '">' + esc(L('shkn.prop')) + '</button>'
          + '</div><pre class="shkn-body" data-shkn-body="' + r.i + '"></pre></div>';
      });
      list.innerHTML = html || '<div class="ag-desc">' + esc(!items.length ? rvEmptyHint(L('shkn.what')) : qWords.length ? L('shkn.no_match') : L('shkn.none_loaded')) + '</div>';
    }
    panel.querySelector('.ag-close').addEventListener('click', () => panel.classList.remove('open'));
    search.addEventListener('input', render);
    // v4.40.0: formularul «Propune» — numele (ținut local), ce s-a schimbat, textul; «Descarcă» = fișier pe calculatorul colegului.
    const prop = panel.querySelector('.shkn-prop');
    const PROP_NAME_KEY = 'renda_shkn_prop_name';
    function openProp(it) {
      let nm = ''; try { nm = localStorage.getItem(PROP_NAME_KEY) || ''; } catch (_) {}
      prop.innerHTML = '<div class="sp-h">' + esc(it ? L('shkn.prop_h_item', { id: it.id, title: it.t }) : L('shkn.prop_h_new')) + '</div>'
        + '<label>' + esc(L('shkn.prop_name')) + '</label><input class="sp-name" type="text" placeholder="' + esc(L('shkn.prop_name_ph')) + '" value="' + esc(nm) + '">'
        + (it ? '' : '<label>' + esc(L('shkn.prop_title_f')) + '</label><input class="sp-title" type="text" maxlength="110">'
          + '<label>' + esc(L('shkn.prop_case')) + '</label><input class="sp-caz" type="text">')
        + '<label>' + esc(L('shkn.prop_why')) + '</label><input class="sp-why" type="text">'
        + '<label>' + esc(L(it ? 'shkn.prop_text_item' : 'shkn.prop_text_new')) + '</label><textarea class="sp-text"></textarea>'
        + '<div class="sp-act"><button type="button" class="sp-dl">' + esc(L('shkn.prop_download')) + '</button><button type="button" class="sp-cancel">' + esc(L('common.cancel')) + '</button></div>'
        + '<div class="sp-msg">' + esc(L('shkn.prop_msg', { contact: shknContact() })) + '</div>';
      prop.querySelector('.sp-text').value = it ? (it.b || '') : '';
      prop.classList.add('open');
      try { prop.scrollIntoView({ block: 'nearest' }); } catch (_) {}
      const msg = prop.querySelector('.sp-msg');
      const say = (t, cls) => { msg.textContent = t; msg.className = 'sp-msg' + (cls ? ' ' + cls : ''); };
      const val = (c) => { const e = prop.querySelector(c); return e ? e.value.trim() : ''; };
      prop.querySelector('.sp-cancel').addEventListener('click', () => { prop.classList.remove('open'); prop.innerHTML = ''; });
      prop.querySelector('.sp-dl').addEventListener('click', () => {
        const name = val('.sp-name'), why = val('.sp-why'), text = prop.querySelector('.sp-text').value;
        const title = it ? it.t : val('.sp-title');
        if (!name) return say(L('shkn.err_name'), 'err');
        if (!it && !title) return say(L('shkn.err_title'), 'err');
        if (!why) return say(L('shkn.err_why'), 'err');
        if (!text.trim()) return say(L('shkn.err_empty'), 'err');
        if (it && text.replace(/\r\n/g, '\n').trim() === String(it.b || '').trim()) return say(L('shkn.err_same'), 'err');
        try { localStorage.setItem(PROP_NAME_KEY, name); } catch (_) {}
        const go = (sha16) => {
          const f = shknPropFile({ base: it, name: name, why: why, text: text, title: title, caz: it ? null : val('.sp-caz'), baseSha16: sha16, ver: RUNNING_VER, when: new Date() });
          const url = URL.createObjectURL(new Blob([f.text], { type: 'text/markdown;charset=utf-8' }));
          const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
          say(L('shkn.prop_done', { file: f.name, contact: shknContact() }), 'ok');
        };
        if (it && window.crypto && crypto.subtle && window.TextEncoder) {
          crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(it.b || '').trim()))
            .then((h) => go(Array.from(new Uint8Array(h)).slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('')))
            .catch(() => go(''));
        } else go('');
      });
    }
    panel.querySelector('.shkn-newprop').addEventListener('click', () => openProp(null));
    list.addEventListener('click', (ev) => {
      const b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.shknView !== undefined) {
        const pre = list.querySelector('[data-shkn-body="' + b.dataset.shknView + '"]');
        if (pre) {
          if (!pre.textContent) pre.textContent = (items[+b.dataset.shknView] || {}).b || '';
          pre.classList.toggle('open');
          b.textContent = L(pre.classList.contains('open') ? 'shkn.view_close' : 'shkn.view');
        }
      } else if (b.dataset.shknProp !== undefined) {
        const it = items[+b.dataset.shknProp];
        if (it) openProp(it);
      } else if (b.dataset.shknCopy !== undefined) {
        const it = items[+b.dataset.shknCopy];
        if (!it) return;
        navigator.clipboard.writeText(shknWrap(it)).then(() => {
          const t = b.textContent; b.textContent = L('shkn.copied');
          setTimeout(() => { b.textContent = t; }, 1100);
        }).catch(() => {});
      }
    });
    panel.rvRender = render;
    render();
    return panel;
  }

  // === v4.9.17: SETT — sursa de date HUD (proiecte {id,label,type} + angajati VEGO
  // {id,name,email,phone}). v4.37.0: fara setari in pagina — adresa e fixa (background.js o
  // muta pe rv_base la test local), cheia exista doar in extensie, sablonul Azure vine din RENDA.
  function getApiUrl() { return CONFIG.hudDataUrlDefault; }
  function getApiData() { try { return JSON.parse(localStorage.getItem(API_DATA_KEY) || 'null'); } catch (_) { return null; } }
  function setApiData(d) { try { localStorage.setItem(API_DATA_KEY, JSON.stringify(d)); } catch (_) {} }
  function getAzTpl() { return rvCfgAzTpl || CONFIG.azureTplDefault; }

  // v4.37.0 — CONEXIUNEA LA RENDA: un singur drum, butonul "Conecteaza-te la RENDA" (extensie).
  // Cheia sta in background.js (chrome.storage.local) si puntea o ataseaza singura; pagina vede
  // doar starea {connected, email, name}. Fara cheie lipita manual. In Tampermonkey nu exista
  // conectare: HUD-ul merge pe datele din pachet.
  const RV_TM = (typeof GM_xmlhttpRequest === 'function') || (typeof GM !== 'undefined' && !!GM && typeof GM.xmlHttpRequest === 'function');
  const RV_EXT = !RV_TM && extRuntimeOk();
  let rvAuth = { connected: false, email: '', name: '', keysUrl: '' };
  // background.js vechi (userscript nou venit prin userScripts, pachet neactualizat) nu stie
  // mesajele rv_auth_* si raspunde 'blocked' => fara conectare pana la reinstalarea pachetului
  let rvBgLegacy = false;
  function extAuthOn() { return RV_EXT && !rvBgLegacy; }
  function extCall(msg, cb) {
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError || !res) cb({ ok: false, error: RV_PRE.no_reply });
        else cb(res);
      });
    } catch (_) { cb({ ok: false, error: RV_PRE.no_reply }); }
  }
  function hasApiAuth() { return extAuthOn() && !!rvAuth.connected; }
  function applyAuth(r) { if (r && r.ok) rvAuth = r; }
  function refreshAuth(cb) {
    if (!RV_EXT) { if (cb) cb(); return; }
    extCall({ type: 'rv_auth_status' }, (r) => {
      if (!r.ok && r.error === 'blocked') { rvBgLegacy = true; rvlog('background.js vechi — conectarea cere reinstalarea pachetului'); }
      applyAuth(r);
      if (cb) cb();
    });
  }
  // curatenie: setarile vechi din localStorage-ul paginii (cheia lipita, URL-ul, sablonul Azure)
  // nu se mai folosesc — se sterg, ca o cheie veche sa nu mai stea la vedere pe chatgpt.com
  function dropLegacyPageSettings() {
    [API_KEY_KEY, API_URL_KEY, AZ_TPL_KEY, BOOT_SEL_KEY].forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} });
  }

  // v4.37.0 — DATE HUD DE PE RENDA (docs/SERVER_SPEC_HUD.md): /api/hud/config (agenti, plugins,
  // misiuni, teze, SHKN, sablon Azure) si /api/hud/me (rolul + boot-ul contului conectat).
  // Cand lipsesc (neconectat / endpoint inexistent / offline), raman datele din pachet.
  const HUD_CFG_TTL = 60 * 60000;
  const HUD_ME_TTL = 10 * 60000;
  const HUD_CANON_TTL = 24 * 60 * 60000;
  let rvMyBoot = null;     // boot-ul contului conectat, forma RV_BOOT ({i,n,d,f,...,b})
  let rvAccount = null;    // {email, name} al contului RENDA
  let rvCfgAzTpl = '';
  function remoteGet(path, ttl, cb) {
    if (!extAuthOn()) { cb(null); return; }
    extCall({ type: 'rv_remote', path: path, ttl: ttl }, (r) => cb(r.data ? r : null));
  }
  const isArr = Array.isArray;
  const isObj = (o) => !!o && typeof o === 'object' && !isArr(o);
  // fiecare cheie se aplica DOAR daca are forma asteptata — un raspuns partial nu strica restul
  function applyHudConfig(c) {
    if (!isObj(c)) return false;
    if (isObj(c.agents) && (isArr(c.agents.agents) || isArr(c.agents.external) || isArr(c.agents.skills))) RV_AGENTS = c.agents;
    if (isArr(c.plugins)) RV_PLUGINS = c.plugins;
    if (isArr(c.missions) && c.missions.every((m) => m && m.f && isArr(m.a))) RV_MISSIONS = c.missions;
    if (isObj(c.teze) && isArr(c.teze.teze)) RV_TEZE = c.teze;
    // boot_meta pe bucati: o parte lipsa (ex. doar steps, fara models) pastreaza partea din pachet
    if (isObj(c.boot_meta)) {
      RV_BOOT_META = {
        models: isArr(c.boot_meta.models) ? c.boot_meta.models : ((RV_BOOT_META && RV_BOOT_META.models) || []),
        steps: isArr(c.boot_meta.steps) ? c.boot_meta.steps : ((RV_BOOT_META && RV_BOOT_META.steps) || [])
      };
    }
    if (isObj(c.shkn) && isArr(c.shkn.items)) RV_SHKN = c.shkn;
    if (typeof c.azure_tpl === 'string') rvCfgAzTpl = c.azure_tpl;
    // Faza 8: tabelul functie -> categorie si blocul BOOT general (acesta doar cu markerul anti-dubla-injectie)
    if (isArr(c.mission_map) && c.mission_map.every((x) => isArr(x) && x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'string')) MIS_MAP = c.mission_map;
    if (typeof c.boot_block === 'string' && c.boot_block.indexOf(BOOT_MARK) !== -1) BOOT_EMBED = c.boot_block;
    // v4.47.0 (HUD-7): organizatia si tot ce afiseaza interfata
    if (isObj(c.org) && c.org.id) rvOrg = { id: String(c.org.id), name: String(c.org.name || c.org.id) };
    if (isArr(c.orgs)) rvOrgs = c.orgs.filter((o) => isObj(o) && o.id).map((o) => ({ id: String(o.id), name: String(o.name || o.id) }));
    if (isObj(c.labels)) RV_L = c.labels;
    if (isArr(c.links)) RV_LINKS = c.links.filter((x) => isArr(x) && x.length === 2 && /^\//.test(String(x[1])));
    RV_BRAND = isObj(c.branding) ? c.branding : {};
    TEMPLATES = isArr(c.templates) ? c.templates.filter((t) => isArr(t) && t.length >= 2) : [];
    RV_TEXTS = isObj(c.texts) ? c.texts : {};
    RV_SYNONYMS = isArr(c.synonyms) ? c.synonyms.filter((g) => isObj(g) && isArr(g.terms)) : [];
    RV_FEATURES = isObj(c.features) ? c.features : {};
    rvShknContact = typeof c.shkn_contact === 'string' ? c.shkn_contact : '';
    rvCfgLoaded = true;
    return true;
  }
  // canonul (GET /api/hud/canon): { version, canon } sau direct obiectul canonului
  function applyHudCanon(d) {
    const c = isObj(d) && isObj(d.canon) ? d.canon : d;
    if (!isObj(c) || !isObj(c.reflexe) || !isArr(c.norme)) return false;
    CANON_EMBED = c;
    rvEmbedIdx = null;   // indexul pe limbi se reface pe canonul nou
    return true;
  }
  // la deconectare: nimic de organizatie nu ramane in pagina (cache-ul din extensie e deja sters)
  function resetHudData() {
    RV_AGENTS = { agents: [], external: [], skills: [] };
    RV_PLUGINS = [];
    RV_SHKN = { items: [] };
    RV_TEZE = { title: '', teze: [] };
    RV_BOOT_META = { models: [], steps: [] };
    RV_MISSIONS = [];
    MIS_MAP = [];
    BOOT_EMBED = '';
    CANON_EMBED = { reflexe: {}, norme: [], signals: [], nucleu: [], top_n: 3 };
    rvEmbedIdx = null;
    rvCfgAzTpl = '';
    rvMyBoot = null;
    rvAccount = null;
    TEMPLATES = [];
    RV_L = {};
    RV_LINKS = [];
    RV_BRAND = {};
    RV_TEXTS = {};
    RV_SYNONYMS = [];
    RV_FEATURES = {};
    rvShknContact = '';
    rvOrg = null;
    rvOrgs = [];
    rvCfgLoaded = false;
    setApiData(null);
  }
  // mesajul din panourile goale: invitatie la conectare sau "RENDA nu are inca"
  function rvEmptyHint(what) {
    return hasApiAuth() ? L('empty.none', { what: what }) : RV_PRE.connect + ' — ' + what;
  }
  // /api/hud/me: role = ProfileRole de pe RENDA (fara salariu) -> forma RV_BOOT
  function applyHudMe(m) {
    if (!isObj(m)) return false;
    const a = isObj(m.account) ? m.account : {};
    rvAccount = { email: String(a.email || '').toLowerCase(), name: String(a.name || '') };
    const r = isObj(m.role) ? m.role : null;
    rvMyBoot = r ? {
      i: String(r.rol_id || ''), n: rvAccount.name, d: String(r.departament || ''), f: String(r.functie || ''),
      dv: String(r.diviziune || ''), rs: String(r.rol_board || ''), sc: String(r.stadiu || ''),
      t: String(r.tip_rol || ''), c: String(r.coordinator_name || ''), b: String(r.boot_session || ''),
      st: String(r.statut || ''), mi: String(r.misiune || ''),
      ac: isArr(r.actiuni) ? r.actiuni.map(String).slice(0, 3) : [],
      // modelul de rol potrivit, trimis de server langa rol ({t, cp, v}); altfel se cauta in boot_meta
      model: isObj(m.role_model) && m.role_model.t ? { t: String(m.role_model.t), cp: String(m.role_model.cp || ''), v: String(m.role_model.v || '') } : null
    } : null;
    return true;
  }
  function loadHudRemote(onChange) {
    if (!hasApiAuth()) return;
    remoteGet('/api/hud/config', HUD_CFG_TTL, (r) => { if (r && applyHudConfig(r.data)) { rvlog('config HUD de pe RENDA (' + (r.when || '') + ')'); onChange(); } });
    remoteGet('/api/hud/canon', HUD_CANON_TTL, (r) => { if (r && applyHudCanon(r.data)) { rvlog('canon de pe RENDA'); onChange(); } });
    remoteGet('/api/hud/me', HUD_ME_TTL, (r) => { if (r && applyHudMe(r.data)) { rvlog('rol/boot de pe RENDA' + (rvMyBoot ? '' : ' — fara rol')); onChange(); } });
  }
  // lista de boot-uri afisata: registrul din pachet cat timp exista, altfel doar boot-ul propriu
  function bootList() { return RV_BOOT.length ? RV_BOOT : (rvMyBoot ? [rvMyBoot] : []); }

  // GET pe API-ul de date prin puntea extensiei (background.js ataseaza cheia contului conectat).
  function apiFetch(onOk, onErr) {
    const url = getApiUrl();
    if (!hasApiAuth()) { onErr(extAuthOn() ? RV_PRE.connect : RV_PRE.no_ext); return; }
    rvlog('→ apiFetch', url);
    // v4.9.23: normalizare TOLERANTA — accepta atat formatul propriu ({vego_employees, projects}),
    // cat si formatul platformei renda.holdings (/api/sett/lists: containere ok/data/lists,
    // proiecte cm_project cu label/short_code/ref/id/status ACTIVE|CLOSED|PENDING).
    const normP = (p) => ({
      id: String(p.short_code || p.code || p.id || ''),
      label: p.label || p.name || String(p.id || ''),
      // v4.9.28: type canonic UPPERCASE — API-ul real trimite variante amestecate
      // ("Productie"/"PRODUCTIE", "Suport"/"SUPORT") care ar dubla chips-urile de filtrare
      type: String(p.type || '').trim().toUpperCase(),
      status: p.status || '',
      // v4.9.27: ref-ul numeric — folderele din share-ul Azure incep cu el (<ref>_...)
      ref: String(p.ref || ''),
      // v4.9.29: calea folderului proiectului in share — cu ea, 📂 Azure deschide direct folderul
      cp: String(p.container_path || ''),
      // v4.9.26: link direct de storage per proiect, daca API-ul il trimite
      az: p.azure || p.storage_url || p.storageUrl || ''
    });
    const normE = (x) => ({
      id: x.id, name: x.name || ((x.first_name || '') + ' ' + (x.last_name || '')).trim() || String(x.id || ''),
      email: x.email || '', phone: x.phone || '',
      // v4.9.30: misiunea INDIVIDUALA + actiunile — daca API-ul le trimite, au prioritate
      // fata de misiunile pe functie din seed-ul XLSX
      mi: String(x.mission || x.misiune || ''),
      ac: Array.isArray(x.actions) ? x.actions.map(String).slice(0, 3) : (Array.isArray(x.actiuni) ? x.actiuni.map(String).slice(0, 3) : [])
    });
    const done = (txt, status) => {
      if (status < 200 || status >= 300) { rvlog('✗ apiFetch HTTP ' + status); onErr('HTTP ' + status + (status === 401 ? ' — ' + L('err.expired') : status === 403 ? ' — ' + L('err.forbidden') : '')); return; }
      try {
        const d0 = JSON.parse(txt);
        const d = (d0 && typeof d0 === 'object' && (d0.lists || d0.data)) ? (d0.lists || d0.data) : d0;
        const rawP = Array.isArray(d.projects) ? d.projects : (Array.isArray(d.items) ? d.items : []);
        const rawE = Array.isArray(d.employees) ? d.employees : (Array.isArray(d.users) ? d.users : []);
        const data = { projects: rawP.map(normP), employees: rawE.map(normE), when: new Date().toISOString() };
        rvlog('✓ apiFetch', data.projects.length + ' proiecte, ' + data.employees.length + ' angajati');
        setApiData(data);
        onOk(data);
      } catch (_) { rvlog('✗ apiFetch raspuns non-JSON, ' + (txt || '').length + 'B'); onErr(L('err.not_json')); }
    };
    extHudRequest({ url: url, timeout: 8000,
      onload: (r) => done(r.responseText, r.status),
      onerror: () => onErr(L('err.network')),
      ontimeout: () => onErr(L('err.timeout')) });
  }

  // v4.9.22: datele API se ACTUALIZEAZA SINGURE la fiecare 10 minute, cu timer PROGRAMAT
  // PRECIS: urmatorul fetch e pus exact la momentul cand cache-ul implineste 10 minute
  // (d.when + 10 min) — NU ruleaza nimic periodic mai des. Timestampul e partajat intre
  // tab-uri prin localStorage: daca alt tab a reimprospatat intre timp, aici doar se
  // reprogrameaza (fara fetch). Conditii: cheie configurata + tab vizibil; la revenirea
  // pe tab se verifica imediat. Esecul NU atinge cache-ul; se reincearca la 10 minute
  // (intre timp exista butonul manual ↻ Reincarca).
  const API_REFRESH_MS = 10 * 60000;
  function startApiAutoRefresh(panel) {
    let inFlight = false;
    let timer = null;
    function msUntilDue() {
      const d = getApiData();
      if (!d || !d.when) return 0;
      return Math.max(0, new Date(d.when).getTime() + API_REFRESH_MS - Date.now());
    }
    function schedule(ms) {
      clearTimeout(timer);
      timer = setTimeout(tick, typeof ms === 'number' ? ms : Math.max(1500, msUntilDue()));
    }
    function tick() {
      if (inFlight) return;
      if (!hasApiAuth() || document.hidden) { schedule(API_REFRESH_MS); return; }
      const due = msUntilDue();
      if (due > 0) { schedule(due); return; } // alt tab / refresh manual a adus deja date proaspete
      inFlight = true;
      rvlog('auto-refresh date API (interval 10 min)');
      apiFetch(
        (nd) => { inFlight = false; if (panel.rvRender) panel.rvRender(L('st.auto_loaded', { p: nd.projects.length, e: nd.employees.length })); schedule(API_REFRESH_MS); },
        (err) => { inFlight = false; rvlog('auto-refresh esuat: ' + err); schedule(API_REFRESH_MS); }
      );
    }
    panel.rvReschedule = schedule;
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    schedule();
  }

  // === v4.9.30: MISIUNEA & PRIMELE 3 ACTIUNI — card andocat DREAPTA, deschis implicit ===
  // Misiunile din seed sunt PE CATEGORII DE FUNCTIE (XLSX "misiuni generale" 2021-09);
  // cele INDIVIDUALE apar numai cand vin pe API (employees[].mission/actions) si emailul
  // sesiunii ChatGPT corespunde. Emailul se citeste same-origin din /api/auth/session si
  // ramane LOCAL (nu se trimite nicaieri; in loguri doar lungimea).
  // v4.9.36: categoria de misiune aleasa manual e PER ANGAJAT ({id_rol: categorie} in
  // localStorage). Valorile vechi (string simplu, dinaintea identificarii pe email) raman
  // valabile DOAR pentru cazul neidentificat — alegerile facute la testare nu mai umbresc
  // categoria derivata automat din functia angajatului identificat.
  function getMisF(pid) {
    try {
      const raw = localStorage.getItem(MIS_F_KEY) || '';
      if (!raw) return '';
      try { const v = JSON.parse(raw); if (v && typeof v === 'object') return v[pid] || ''; } catch (_) {}
      return pid === '_anon' ? raw : '';
    } catch (_) { return ''; }
  }
  function setMisF(pid, val) {
    try {
      let v = {};
      try { const p = JSON.parse(localStorage.getItem(MIS_F_KEY) || 'null'); if (p && typeof p === 'object') v = p; } catch (_) {}
      if (val) v[pid] = val; else delete v[pid];
      localStorage.setItem(MIS_F_KEY, JSON.stringify(v));
    } catch (_) {}
  }
  function misClosedToday() { try { return localStorage.getItem(MIS_CLOSED_KEY) === new Date().toDateString(); } catch (_) { return false; } }
  function setMisClosedToday() { try { localStorage.setItem(MIS_CLOSED_KEY, new Date().toDateString()); } catch (_) {} }

  let rvUserEmail = '';
  let rvUserName = '';
  try { rvUserEmail = (localStorage.getItem(MIS_EMAIL_KEY) || '').toLowerCase(); } catch (_) {}
  try { rvUserName = localStorage.getItem(MIS_NAME_KEY) || ''; } catch (_) {}
  // v4.9.32: nume de afisare derivat din email cand sesiunea nu da numele
  // ("prenume.nume@..." -> "Prenume Nume")
  function prettyNameFromEmail(em) {
    const local = String(em || '').split('@')[0];
    const parts = local.split(/[._\-]+/).filter((t) => t && !/^\d+$/.test(t));
    if (!parts.length) return '';
    return parts.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
  }
  // v4.9.32: fallback pe DOM — emailul apare in meniul de cont; scanare prudenta, doar
  // noduri scurte din zone de profil/nav (nu citim continutul conversatiei)
  function scanDomIdentity() {
    try {
      const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
      const nodes = document.querySelectorAll('[data-testid*="profile"], [data-testid*="account"], nav div, aside div');
      for (let i = 0; i < nodes.length && i < 400; i++) {
        const t = (nodes[i].textContent || '').trim();
        if (t && t.length <= 60 && !t.includes(' ')) {
          const m = t.match(re);
          if (m) return m[0].toLowerCase();
        }
      }
    } catch (_) {}
    return '';
  }
  // 2026-09-25: identitatea din scriptul #client-bootstrap al shell-ului nou (sincron, zero retea):
  // {session:{user:{id,email,name}}} — sursa primara; /api/auth/session ramane confirmarea async
  // (pe DOM-ul logat 2026-09-25 ambele dau email + nume; fara login /api/auth/session e doar WARNING_BANNER).
  function bootstrapIdentity() {
    try {
      const el = document.getElementById('client-bootstrap');
      if (!el) return null;
      const j = JSON.parse(el.textContent || '');
      const u = (j && j.session && j.session.user) || (j && j.user) || null;
      if (u && u.email) return { email: String(u.email).toLowerCase(), name: String(u.name || '').trim() };
    } catch (_) {}
    return null;
  }
  function fetchSessionEmail(cb, attempt) {
    attempt = attempt || 1;
    const finish = () => { if (cb) cb(); };
    const save = (em, nm) => {
      if (em && em !== rvUserEmail) {
        rvUserEmail = em;
        try { localStorage.setItem(MIS_EMAIL_KEY, em); } catch (_) {}
        rvlog('identitate: email detectat (' + em.length + ' caractere)');
      }
      if (nm && nm !== rvUserName) {
        rvUserName = nm;
        try { localStorage.setItem(MIS_NAME_KEY, nm); } catch (_) {}
        rvlog('identitate: nume detectat (' + nm.length + ' caractere)');
      }
    };
    const bi = bootstrapIdentity();
    if (bi) { rvlog('identitate: #client-bootstrap (sincron)'); save(bi.email, bi.name); }
    try {
      fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
        .then((r) => { rvlog('identitate: /api/auth/session HTTP ' + r.status + ' (incercarea ' + attempt + ')'); return r.json(); })
        .then((j) => {
          const u = j && j.user ? j.user : null;
          save(u && u.email ? String(u.email).toLowerCase() : '', u && u.name ? String(u.name).trim() : '');
          if (!rvUserEmail) {
            const domEm = scanDomIdentity();
            if (domEm) { rvlog('identitate: email gasit in DOM (fallback)'); save(domEm, ''); }
          }
          // sesiunea se poate incalzi tarziu (mai ales pe conturi business) — reincercam
          if ((!rvUserEmail || !rvUserName) && attempt < 3) setTimeout(() => fetchSessionEmail(cb, attempt + 1), 12000);
          finish();
        })
        .catch((e) => {
          rvlog('identitate: /api/auth/session EROARE (incercarea ' + attempt + '):', e && e.message);
          const domEm = scanDomIdentity();
          if (domEm) { rvlog('identitate: email gasit in DOM (fallback)'); save(domEm, ''); }
          if (!rvUserEmail && attempt < 3) setTimeout(() => fetchSessionEmail(cb, attempt + 1), 12000);
          finish();
        });
    } catch (_) { finish(); }
  }
  // cuvintele unui nume, fara diacritice si semne (comparatii tolerante: functie -> misiune, tip rol -> model)
  function normNameTokens(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
  }
  // v4.9.37: textul COMPLET care intra in composer/clipboard: boot -> Tezele VEGO ->
  // instructiunea finala (skill-uri/plugin-uri potrivite, in acord cu tezele).
  // v4.9.39: tezele au structura reala — 3 teze cu cate 10 principii (3.1-3.30).
  function composeBootText(bt) {
    let out = bt.b;
    if (RV_TEZE.teze && RV_TEZE.teze.length) {
      out += '\n\n' + RV_TEZE.title + ':';
      RV_TEZE.teze.forEach((tz) => {
        out += '\n' + L('mis.teza_line', { n: tz.n, t: tz.t });
        tz.p.forEach((p) => { out += '\n' + p.c + '. ' + p.k + ': ' + p.d; });
      });
    }
    // instructiunea finala dupa boot + teze: a organizatiei (texts.boot_footer); fara ea, nimic
    if (RV_TEXTS.boot_footer) out += '\n\n' + RV_TEXTS.boot_footer;
    out += '\n\n';
    return out;
  }
  // v4.37.0 (B4): rolul si boot-ul vin DOAR de pe RENDA, pentru contul conectat (/api/hud/me).
  // Fara conectare nu exista rol — nu mai ghicim persoana dupa emailul contului ChatGPT.
  function findMyBoot() { return rvMyBoot; }
  // v4.9.34: functia operationala din registru -> categoria de misiune (RV_MISSIONS).
  // Ordinea conteaza: cheile specifice inaintea celor generice ("sisteme"/"it" inaintea
  // lui "arhitect", ca "Arhitect de Sisteme (Head IT)" sa cada pe Specialist IT).
  // v4.37.0: fara date de organizatie in cod — vine din /api/hud/config (dupa conectare) (mission_map)
  let MIS_MAP = [];
  function mapFunctieToMission(fn) {
    const f = ' ' + normNameTokens(fn).join(' ') + ' ';
    for (const [k, cat] of MIS_MAP) if (f.indexOf(k) !== -1) return RV_MISSIONS.find((x) => x.f === cat) || null;
    return null;
  }

  // misiunea individuala a userului logat, DACA a venit pe API si emailul corespunde
  function apiIndividual() {
    if (rvMyBoot && rvMyBoot.mi) return { name: rvMyBoot.n, mi: rvMyBoot.mi, ac: rvMyBoot.ac };
    if (!rvUserEmail) return null;
    const d = getApiData();
    if (!d || !Array.isArray(d.employees)) return null;
    const e = d.employees.find((x) => String(x.email || '').toLowerCase() === rvUserEmail);
    return (e && e.mi) ? e : null;
  }

  function buildMissionCard(hud) {
    let panel = document.getElementById(MIS_PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = MIS_PANEL_ID;
    panel.innerHTML = '<button class="pp-close" type="button" data-rvla="mis.close">✕</button>'
      + '<h3>' + rvIcon('mission') + '<span data-rvl="mis.h"></span></h3><div class="mis-body"></div>';
    document.body.appendChild(panel);
    const body = panel.querySelector('.mis-body');
    // v4.9.33/34: sectiunea BOOT SESSION — a angajatului identificat (dupa email);
    // [⤵ În composer] insereaza textul integral la cursor.
    // v4.9.40: butoanele de comutare ("schimbă categoria…", "alt angajat…") au fost
    // ELIMINATE la cererea userului — fiecare isi vede DOAR misiunea si boot-ul propriu;
    // selectoarele raman numai ca fallback, cand identificarea/derivarea automata esueaza.
    // v4.9.35: modelul comportamental al tipului de rol (foaia MODELE_ROL) — match tolerant
    // la diacritice ("COORDONATOR OPERATIONAL" din registru = "COORDONATOR OPERAȚIONAL" din foaie)
    function bootModelFor(t) {
      const k = normNameTokens(t).join(' ');
      return ((RV_BOOT_META && RV_BOOT_META.models) || []).find((m) => normNameTokens(m.t).join(' ') === k) || null;
    }
    // v4.9.37: TEZELE VEGO — sectiune langa boot; intra si in textul inserat/copiat.
    // v4.9.39: cele 3 teze sunt mereu vizibile (titlurile), fiecare cu principiile ei
    // (3.1-3.30) intr-un expander — cardul ramane compact, continutul e complet.
    function tezeHtml() {
      if (!RV_TEZE.teze || !RV_TEZE.teze.length) return '';   // tezele vin din RENDA; fara ele, sectiunea lipseste
      return '<div class="mis-teze"><div class="mis-boot-t">' + rvIcon('shkn') + ' ' + esc(RV_TEZE.title) + ' <span class="mis-src">' + esc(L('mis.teze_auto')) + '</span></div>'
        + RV_TEZE.teze.map((tz) =>
          '<details class="mis-instr mis-teza"><summary><b>' + esc(L('mis.teza_n', { n: tz.n })) + '</b> — „' + esc(tz.t) + '" <span class="mis-src">' + esc(L('mis.teza_count', { n: tz.p.length })) + '</span></summary>'
          + '<ol class="mis-a">' + tz.p.map((p) => '<li><b>' + esc(p.c) + '. ' + esc(p.k) + ':</b> ' + esc(p.d) + '</li>').join('') + '</ol></details>'
        ).join('') + '</div>';
    }
    function bootHtml(my) {
      if (!my) {
        return '<div class="mis-boot"><div class="mis-boot-t">' + rvIcon('prompt') + ' ' + esc(L('mis.boot_h')) + '</div>'
          + '<div class="pp-hint">' + esc(L('mis.no_role_boot')) + '</div></div>' + tezeHtml();
      }
      if (my && !my.b) {
        return '<div class="mis-boot"><div class="mis-boot-t">' + rvIcon('prompt') + ' ' + esc(L('mis.boot_h')) + '</div><div class="pp-hint">' + esc(L('mis.no_boot_text')) + '</div></div>' + tezeHtml();
      }
      if (my) {
        const steps = (RV_BOOT_META && RV_BOOT_META.steps) || [];
        return '<div class="mis-boot"><div class="mis-boot-t">' + rvIcon('prompt') + ' ' + esc(L('mis.boot_h')) + ' <span class="mis-src">· ' + esc(my.i) + (my.st ? ' · ' + esc(my.st) : '') + '</span></div>'
          + '<div class="mis-boot-p">' + esc(my.b.slice(0, 140)) + '…</div>'
          + '<div class="pp-row"><button class="pp-act boot-ins" type="button" title="' + esc(L('mis.boot_ins_title', { teze: RV_TEZE.title })) + '">' + esc(L('mis.boot_ins')) + '</button>'
          + '<button class="pp-act boot-copy" type="button" title="' + esc(L('mis.boot_copy_title', { teze: RV_TEZE.title })) + '">' + esc(L('shkn.copy')) + '</button></div>'
          + (steps.length ? '<details class="mis-instr"><summary>' + esc(L('mis.boot_how')) + '</summary><ol>' + steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol></details>' : '')
          + '</div>' + tezeHtml();
      }
    }
    // dropdown compact pentru categoria de misiune (fallback, NU lista de 16 butoane)
    function misSelHtml(cur) {
      if (!RV_MISSIONS.length) return '';
      return '<select class="st-in mis-f-sel"><option value="">' + esc(L('mis.pick_category')) + '</option>'
        + RV_MISSIONS.map((x) => '<option value="' + esc(x.f) + '"' + (x.f === cur ? ' selected' : '') + '>' + esc(x.f) + '</option>').join('')
        + '</select>';
    }
    function missionBlock(rec) {
      return '<div class="mis-m">' + esc(rec.m) + '</div>'
        + '<ol class="mis-a">' + rec.a.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ol>';
    }
    function render() {
      // v4.37.0 (B4): fara conectare la RENDA, cardul nu arata nimic personal — doar invitatia
      // de conectare si Tezele VEGO. Identitatea din capul cardului e a contului RENDA.
      if (!hasApiAuth()) {
        body.innerHTML = '<div class="mis-boot"><div class="pp-row"><button class="pp-act mis-connect" type="button">🔑 ' + esc(RV_PRE.connect) + '</button></div></div>';
        return;
      }
      const whoEmail = (rvAccount && rvAccount.email) || rvAuth.email || '';
      const dispName = (rvAccount && rvAccount.name) || rvAuth.name || prettyNameFromEmail(whoEmail);
      const initials = String(dispName || whoEmail || '?').split(/[\s.@_-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
      const who = '<div class="mis-who"><span class="mis-av" aria-hidden="true">' + esc(initials) + '</span><span class="mis-who-t"><b>' + esc(dispName || '—') + '</b>'
        + (whoEmail ? '<span class="mis-src">' + esc(whoEmail) + '</span>' : '') + '</span></div>';
      const my = findMyBoot();
      const ind = apiIndividual();
      // v4.37.0: rolul venit de pe RENDA are fisa completa (functie, model de rol) — ramura `my`
      if (ind && !rvMyBoot) {
        body.innerHTML = who
          + '<div class="mis-f">' + esc(ind.name) + '<span class="mis-src"> · ' + esc(L('mis.individual')) + '</span></div>'
          + '<div class="mis-m">' + esc(ind.mi) + '</div>'
          + (ind.ac.length ? '<ol class="mis-a">' + ind.ac.map((a) => '<li>' + esc(a) + '</li>').join('') + '</ol>' : '')
          + bootHtml(my);
        return;
      }
      // v4.9.34: DOAR intrarea proprie, conform registrului XLSX — fara lista de 16
      const pid = my ? my.i : '_anon';
      const manual = RV_MISSIONS.find((x) => x.f === getMisF(pid));
      if (my) {
        const rec = (my.mi ? { m: my.mi, a: my.ac || [] } : null) || manual || mapFunctieToMission(my.f);
        // v4.9.35: FISA COMPLETA din registru — toate coloanele XLSX-ului
        const kv = (label, val) => val && val !== '—' ? '<div class="mis-kv"><b>' + label + '</b>' + esc(val) + '</div>' : '';
        const model = my.model || bootModelFor(my.t);
        body.innerHTML = who
          + '<div class="mis-f">' + esc(my.n) + '<span class="mis-src"> · ' + esc(my.i) + '</span></div>'
          + '<div class="mis-kvs">'
          + kv(esc(L('mis.f_function')), my.f) + kv(esc(L('mis.f_department')), my.d) + kv(esc(L('mis.f_division')), my.dv)
          + kv(esc(L('mis.f_board')), my.rs) + kv(esc(L('mis.f_stage')), my.sc)
          + kv(esc(L('mis.f_type')), my.t) + kv(esc(L('mis.f_coordinator')), my.c)
          + '</div>'
          + (rec
              ? missionBlock(rec)
              : (RV_MISSIONS.length ? '<div class="pp-hint">' + esc(L('mis.pick_mission')) + '</div>' + misSelHtml('') : ''))
          + (model ? '<div class="mis-model"><div class="mis-boot-t">' + rvIcon('agents') + ' ' + esc(L('mis.model_h')) + ' <span class="mis-src">· ' + esc(model.t) + '</span></div>'
              + '<div class="mis-kv">' + esc(model.cp) + '</div>'
              + '<div class="mis-kv"><b>' + esc(L('mis.model_validation')) + '</b> ' + esc(model.v) + '</div></div>' : '')
          + bootHtml(my);
        return;
      }
      if (manual) {
        body.innerHTML = who + '<div class="mis-f">' + esc(manual.f) + '<span class="mis-src"> · ' + esc(L('mis.function_mission')) + '</span></div>'
          + missionBlock(manual) + bootHtml(null);
      } else {
        body.innerHTML = who
          + '<div class="pp-hint">' + esc(L('mis.no_role')) + (RV_MISSIONS.length ? ' ' + esc(L('mis.pick_function')) : '') + '</div>'
          + misSelHtml(manual ? manual.f : '') + bootHtml(null);
      }
    }
    body.addEventListener('click', (ev) => {
      // butonul de conectare din card deschide panoul de conexiune (acolo e fluxul complet)
      const mc = ev.target.closest('button.mis-connect');
      if (mc) {
        const sp = document.getElementById(SETT_PANEL_ID);
        if (sp && sp.rvConnect) sp.rvConnect(mc);
        return;
      }
      const bi = ev.target.closest('button.boot-ins');
      if (bi) {
        const bt = findMyBoot();
        if (!bt) return;
        // conform INSTRUCTIUNI: boot-ul intra la INCEPUTUL sesiunii; sarcina se adauga dupa.
        // v4.9.37: se insereaza boot + Tezele VEGO + instructiunea finala.
        // Scriptul DOAR scrie in composer — trimiterea ramane a userului.
        const full = composeBootText(bt);
        const ok = insertIntoComposer(full);
        const t = bi.textContent;
        bi.textContent = L(ok ? 'common.inserted' : 'common.no_composer');
        setTimeout(() => { bi.textContent = t; }, 1200);
        rvlog('boot+teze ' + (ok ? 'inserat in composer' : 'NEINSERAT — composer negasit') + ' (' + full.length + ' caractere)');
        return;
      }
      const bc = ev.target.closest('button.boot-copy');
      if (bc) {
        const bt = findMyBoot();
        if (!bt) return;
        navigator.clipboard.writeText(composeBootText(bt)).then(() => {
          const t = bc.textContent; bc.textContent = L('common.copied');
          setTimeout(() => { bc.textContent = t; }, 1200);
        }).catch(() => {});
        return;
      }
    });
    body.addEventListener('change', (ev) => {
      const f = ev.target.closest('select.mis-f-sel');
      if (f && f.value) {
        const cur = findMyBoot();
        setMisF(cur ? cur.i : '_anon', f.value);
        render();
      }
    });
    panel.querySelector('.pp-close').addEventListener('click', () => { panel.classList.remove('open'); setMisClosedToday(); });
    panel.rvRender = render;
    render();
    return panel;
  }

  function buildSettPanel(hud) {
    let panel = document.getElementById(SETT_PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = SETT_PANEL_ID;
    // v4.9.18: tab-uri Proiecte/Angajati; setarile (URL + API key) ascunse dupa butonul
    // "⚙ Setari" (afisate automat doar la prima configurare, cand nu exista cheie);
    // proiectele au buton de copiere a CODULUI (campul id = cod string).
    panel.innerHTML = `
      <button class="pp-close" type="button" data-rvla="common.close">✕</button>
      <h3><span data-rvl="st.h"></span> <button class="st-gear" type="button" data-rvlt="st.gear_title" data-rvl="st.gear"></button></h3>
      <div class="st-config">
        <div class="st-auth"></div>
      </div>
      <div class="st-tabs">
        <button class="st-tab on" data-tab="projects" type="button"></button>
        <button class="st-tab" data-tab="employees" type="button"></button>
        <button class="st-tab" data-tab="missions" type="button"></button>
        <button class="st-tab" data-tab="boot" type="button"></button>
        <button class="st-refresh" type="button" data-rvlt="st.refresh_title" data-rvl="st.refresh"></button>
        <span class="st-state">—</span>
      </div>
      <div class="st-filter-row">
        <input class="st-in st-q" type="text" data-rvlp="st.search_ph">
        <select class="st-status-f" data-rvlt="st.status_title"></select>
      </div>
      <div class="st-types"></div>
      <div class="st-list"></div>
    `;
    document.body.appendChild(panel);
    const $ = (s) => panel.querySelector(s);
    const state = $('.st-state');
    const config = $('.st-config');
    let tab = 'projects';
    if (!hasApiAuth()) config.classList.add('open');
    // v4.37.0: blocul de conectare = un singur buton. Cheia ajunge direct in extensie (device-connect).
    function renderAuth() {
      const box = $('.st-auth');
      if (!RV_EXT) { box.innerHTML = '<div class="pp-hint">' + esc(RV_PRE.no_ext) + '</div><hr>'; return; }
      if (rvBgLegacy) { box.innerHTML = '<div class="pp-hint">' + esc(RV_PRE.legacy) + '</div><hr>'; return; }
      if (rvAuth.connected) {
        box.innerHTML = '<div class="pp-hint">' + esc(L('st.connected_as', { email: rvAuth.email || '' })) + (rvOrg ? ' · <b>' + esc(rvOrg.name) + '</b>' : '') + '</div>'
          + '<div class="pp-row"><button class="pp-act danger st-logout" type="button">' + esc(L('st.logout')) + '</button>'
          + (rvAuth.keysUrl ? '<a class="pp-act" href="' + esc(rvAuth.keysUrl) + '" target="_blank" rel="noopener" title="' + esc(L('st.keys_title')) + '">' + esc(L('st.keys')) + '</a>' : '') + '</div><hr>';
      } else {
        // inainte de conectare: cuvintele de dinainte de organizatie (RV_PRE)
        box.innerHTML = '<div class="pp-row"><button class="pp-act st-connect" type="button" title="' + esc(RV_PRE.connect_title) + '">🔑 ' + esc(RV_PRE.connect) + '</button></div><hr>';
      }
    }
    panel.rvRenderAuth = () => { renderAuth(); if (hasApiAuth()) config.classList.remove('open'); };
    $('.st-gear').addEventListener('click', () => config.classList.toggle('open'));
    // v4.9.19: SCALARE la mii de intrari — index de cautare precomputat (o singura
    // concatenare lowercase per item, la schimbarea datelor), randare PAGINATA (PAGE
    // itemi + buton "Arata inca"), debounce pe cautare, filtru de status, delegare
    // de evenimente (un singur listener pe lista, indiferent cate randuri sunt).
    const PAGE = 200;
    let shown = PAGE;
    // v4.9.29: null = "auto" — la primele date, filtrul de status se aseaza singur pe
    // ACTIVE/activ (daca exista in date); dupa ce userul alege ceva, ramane alegerea lui
    let statusF = null;
    let typeF = '';   // v4.9.25: filtru dupa TIPUL proiectului (chips sub cautare)
    let idx = null, idxWhen = null;
    function buildIdx(d) {
      if (idx && idxWhen === d.when) return idx;
      idxWhen = d.when;
      idx = {
        projects: (d.projects || []).map((p) => ({ o: p, h: ((p.label || '') + ' ' + (p.type || '') + ' ' + (p.status || '') + ' ' + (p.id || '') + ' ' + (p.ref || '')).toLowerCase() })),
        employees: (d.employees || []).map((x) => ({ o: x, h: ((x.name || '') + ' ' + (x.email || '') + ' ' + (x.phone || '')).toLowerCase() }))
      };
      return idx;
    }
    // v4.9.25: chips de TIP proiect (construite dinamic din date, cu numaratori),
    // vizibile doar pe tab-ul Proiecte; se combina cu statusul si cautarea.
    function refreshTypeChips(ix) {
      const box = panel.querySelector('.st-types');
      if (tab !== 'projects') { box.style.display = 'none'; return; }
      const counts = {};
      ix.projects.forEach((r) => { const t = r.o.type || ''; if (t) counts[t] = (counts[t] || 0) + 1; });
      const names = Object.keys(counts).sort();
      if (!names.length) { box.style.display = 'none'; typeF = ''; return; }
      if (typeF && !counts[typeF]) typeF = '';
      box.style.display = '';
      box.innerHTML = '<button type="button" class="st-type-chip' + (typeF ? '' : ' on') + '" data-t="">' + esc(L('st.all_n', { n: ix.projects.length })) + '</button>'
        + names.map((t) => '<button type="button" class="st-type-chip' + (t === typeF ? ' on' : '') + '" data-t="' + esc(t) + '">' + esc(t) + ' (' + counts[t] + ')</button>').join('');
    }
    function refreshStatusFilter(ix) {
      const sel = $('.st-status-f');
      if (tab !== 'projects') { sel.style.display = 'none'; return; }
      const counts = {};
      ix.projects.forEach((r) => { const s = r.o.status || ''; if (s) counts[s] = (counts[s] || 0) + 1; });
      const names = Object.keys(counts).sort();
      if (!names.length) { sel.style.display = 'none'; statusF = ''; return; }
      if (statusF === null) statusF = names.find((s) => /^activ/i.test(s)) || '';
      sel.style.display = '';
      const cur = statusF;
      sel.innerHTML = '<option value="">' + esc(L('st.all_statuses')) + '</option>'
        + names.map((s) => '<option value="' + esc(s) + '"' + (s === cur ? ' selected' : '') + '>' + esc(s) + ' (' + counts[s] + ')</option>').join('');
      if (cur && !counts[cur]) statusF = '';
    }
    function renderData() {
      const d = getApiData();
      const box = $('.st-list');
      $('[data-tab="projects"]').textContent = d ? L('st.tab_projects_n', { n: (d.projects || []).length }) : L('st.tab_projects');
      $('[data-tab="employees"]').textContent = d ? L('st.tab_people_n', { n: (d.employees || []).length }) : L('st.tab_people');
      // v4.9.30: tab-ul Misiuni functioneaza si FARA date de la API (seed-ul pe functii)
      const indAll = d ? (d.employees || []).filter((x) => x.mi) : [];
      $('[data-tab="missions"]').textContent = L('st.tab_missions_n', { n: RV_MISSIONS.length + indAll.length });
      $('[data-tab="boot"]').textContent = L('st.tab_boot_n', { n: bootList().length });
      // v4.9.33: tab-ul BOOT — registrul boot sessions, cu cautare; [⤵] insereaza in composer
      if (tab === 'boot') {
        $('.st-status-f').style.display = 'none';
        panel.querySelector('.st-types').style.display = 'none';
        const q3 = ($('.st-q').value || '').toLowerCase().trim();
        const hit3 = (s) => !q3 || s.toLowerCase().indexOf(q3) !== -1;
        const parts3 = [];
        const bts = bootList().filter((x) => hit3(x.n + ' ' + x.d + ' ' + x.f + ' ' + x.t + ' ' + x.c + ' ' + (x.dv || '') + ' ' + (x.rs || '') + ' ' + (x.sc || '') + ' ' + x.b));
        parts3.push('<div class="st-group">' + esc(L('st.boot_group', { n: bts.length })) + '</div>');
        bts.forEach((x) => {
          parts3.push('<div class="st-item"><div class="st-info">'
            + '<span class="st-type">' + esc(x.t) + '</span>'
            + '<div class="st-name">' + esc(x.n) + '</div>'
            + '<div class="st-sub">' + esc(x.f) + ' · ' + esc(x.d) + (x.dv ? ' · ' + esc(x.dv) : '') + '</div>'
            + '<div class="st-sub">' + (x.rs && x.rs !== '—' ? esc(L('st.boot_board', { v: x.rs })) + ' · ' : '') + (x.sc ? esc(L('st.boot_stage', { v: x.sc })) + ' · ' : '') + (x.c ? esc(L('st.boot_coord', { v: x.c })) : '') + '</div></div>'
            + '<div class="st-act"><button type="button" data-bootins="' + esc(x.i) + '" title="' + esc(L('st.boot_ins_title')) + '">⤵</button>'
            + '<button type="button" data-bootcopy="' + esc(x.i) + '" title="' + esc(L('st.boot_copy_title')) + '">📋</button></div></div>');
        });
        if (!bts.length) parts3.push('<div class="pp-hint">' + esc(L('common.nothing_found')) + '</div>');
        box.innerHTML = parts3.join('');
        return;
      }
      if (tab === 'missions') {
        $('.st-status-f').style.display = 'none';
        panel.querySelector('.st-types').style.display = 'none';
        const q2 = ($('.st-q').value || '').toLowerCase().trim();
        const hit2 = (s) => !q2 || s.toLowerCase().indexOf(q2) !== -1;
        const parts2 = [];
        const inds = indAll.filter((x) => hit2((x.name || '') + ' ' + (x.email || '') + ' ' + x.mi + ' ' + x.ac.join(' ')));
        if (inds.length) {
          parts2.push('<div class="st-group">' + esc(L('st.mis_individual', { n: inds.length })) + '</div>');
          inds.forEach((x) => {
            parts2.push('<div class="st-item"><div class="st-info"><div class="st-name">' + esc(x.name) + '</div>'
              + '<div class="st-sub">' + esc(x.mi) + '</div>'
              + (x.ac.length ? '<div class="st-sub">▸ ' + x.ac.map(esc).join('<br>▸ ') + '</div>' : '') + '</div></div>');
          });
        }
        const fns = RV_MISSIONS.filter((x) => hit2(x.f + ' ' + x.m + ' ' + x.a.join(' ')));
        parts2.push('<div class="st-group">' + esc(L('st.mis_by_function', { n: fns.length })) + '</div>');
        fns.forEach((x) => {
          parts2.push('<div class="st-item"><div class="st-info"><div class="st-name">' + esc(x.f) + '</div>'
            + '<div class="st-sub">' + esc(x.m) + '</div>'
            + '<div class="st-sub">▸ ' + x.a.map(esc).join('<br>▸ ') + '</div></div></div>');
        });
        if (!inds.length && !fns.length) parts2.push('<div class="pp-hint">' + esc(RV_MISSIONS.length ? L('common.nothing_found') : rvEmptyHint(L('st.mis_what'))) + '</div>');
        box.innerHTML = parts2.join('');
        return;
      }
      if (!d) { $('.st-status-f').style.display = 'none'; panel.querySelector('.st-types').style.display = 'none'; box.innerHTML = '<div class="pp-hint">' + esc(L('st.no_data')) + '</div>'; return; }
      const ix = buildIdx(d);
      refreshStatusFilter(ix);
      refreshTypeChips(ix);
      const q = ($('.st-q').value || '').toLowerCase().trim();
      let rows = tab === 'projects' ? ix.projects : ix.employees;
      if (tab === 'projects' && typeF) rows = rows.filter((r) => (r.o.type || '') === typeF);
      if (tab === 'projects' && statusF) rows = rows.filter((r) => (r.o.status || '') === statusF);
      if (q) rows = rows.filter((r) => r.h.indexOf(q) !== -1);
      const total = rows.length;
      const page = rows.slice(0, shown);
      const parts = [];
      if (tab === 'projects') {
        // v4.9.26: CODUL proiectului e afisat PRIMUL (inaintea denumirii); butonul 📂 Azure
        // deschide Azure Storage Explorer — fie linkul per-proiect din API (az), fie sablonul
        // din Setari cu {cod}/{label} inlocuite.
        const azTpl = getAzTpl();
        page.forEach((r) => {
          const p = r.o;
          // v4.9.29: daca proiectul are container_path, deep-link-ul primeste si calea
          // folderului ({path} in sablon, sau &path= adaugat automat la sablonul implicit)
          let az = p.az;
          if (!az && azTpl) {
            az = azTpl.split('{cod}').join(encodeURIComponent(p.id)).split('{ref}').join(encodeURIComponent(p.ref || '')).split('{label}').join(encodeURIComponent(p.label || '')).split('{path}').join(encodeURIComponent(p.cp || ''));
            if (p.cp && azTpl.indexOf('{path}') === -1) az += '&path=' + encodeURIComponent(p.cp);
          }
          // v4.9.27: codul afisat in formatul folderelor din share (<ref>_<cod>);
          // butonul Azure copiaza si termenul de cautare (ref-ul, sau codul daca ref lipseste)
          const codeShown = (p.ref ? p.ref + '_' : '') + p.id;
          parts.push('<div class="st-item"><div class="st-info">'
            + (p.status ? '<span class="st-status" data-s="' + esc(String(p.status).toLowerCase()) + '">' + esc(p.status) + '</span>' : '')
            + (p.type ? '<span class="st-type">' + esc(p.type) + '</span>' : '')
            + '<div class="st-name"><span class="st-code">' + esc(codeShown) + '</span>' + (p.label && p.label !== p.id ? ' · ' + esc(p.label) : '') + '</div></div>'
            + '<div class="st-act">'
            + (az ? '<button type="button" data-az="' + esc(az) + '" title="' + esc(L('st.azure_title')) + '">' + esc(L('st.azure')) + '</button>' : '')
            + '<button type="button" data-copy="' + esc(p.id) + '" title="' + esc(L('st.copy_code_title')) + '">' + esc(L('st.copy_code')) + '</button></div></div>');
        });
      } else {
        page.forEach((r) => {
          const x = r.o;
          parts.push('<div class="st-item"><div class="st-info"><div class="st-name">' + esc(x.name || x.id) + '</div>'
            + '<div class="st-sub">' + esc(x.email || '—') + (x.phone ? ' · ' + esc(x.phone) : '') + '</div></div>'
            + (x.email ? '<div class="st-act"><button type="button" data-copy="' + esc(x.email) + '" title="' + esc(L('st.copy_email_title')) + '">' + esc(L('st.copy_email')) + '</button></div>' : '')
            + '</div>');
        });
      }
      if (!total) parts.push('<div class="pp-hint">' + esc(L('common.nothing_found')) + '</div>');
      if (total > page.length) {
        parts.push('<button class="st-more" type="button">' + esc(L('st.more', { n: Math.min(PAGE, total - page.length), shown: page.length, total: total })) + '</button>');
      }
      parts.push('<div class="pp-hint">' + esc(L('st.updated', { when: d.when ? new Date(d.when).toLocaleString('ro-RO') : '—' })) + '</div>');
      box.innerHTML = parts.join('');
    }
    // v4.9.22: incarcarea manuala ("↻ Reincarca" si dupa conectare); reprogrameaza auto-refresh-ul.
    function loadNow() {
      state.textContent = L('common.loading') || RV_PRE.connecting;
      apiFetch(
        (d) => {
          state.textContent = L('st.loaded', { p: d.projects.length, e: d.employees.length });
          shown = PAGE;
          renderData();
          if (panel.rvReschedule) panel.rvReschedule();
        },
        (err) => { state.textContent = '✗ ' + err; }
      );
    }
    $('.st-refresh').addEventListener('click', () => loadNow());
    function logout() {
      extCall({ type: 'rv_auth_logout' }, (r) => {
        applyAuth(r); renderAuth(); config.classList.add('open');
        state.textContent = L('st.logged_out');
        if (panel.rvOnAuth) panel.rvOnAuth();
      });
    }
    // v4.47.0: conectarea porneste si din bara / din cardul Misiune (inainte de conectare panoul e ascuns)
    function connect(btn) {
      if (btn) btn.disabled = true;
      extCall({ type: 'rv_auth_connect' }, (r) => {
        if (btn) btn.disabled = false;
        if (!r.ok) { state.textContent = '✗ ' + (r.error || ''); rvlog('conectare esuata: ' + (r.error || '')); return; }
        applyAuth(r); renderAuth();
        if (panel.rvOnAuth) panel.rvOnAuth();
        loadNow();
      });
    }
    panel.rvConnect = connect;
    panel.rvReload = loadNow;
    $('.st-auth').addEventListener('click', (ev) => {
      if (ev.target.closest('.st-logout')) { logout(); return; }
      const c = ev.target.closest('.st-connect');
      if (c) connect(c);
    });
    panel.querySelectorAll('.st-tab').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.tab;
      shown = PAGE;
      panel.querySelectorAll('.st-tab').forEach((x) => x.classList.toggle('on', x === b));
      renderData();
    }));
    // debounce: la mii de intrari nu filtram la fiecare tasta, ci la 150ms de liniste
    let qTimer = null;
    $('.st-q').addEventListener('input', () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { shown = PAGE; renderData(); }, 150);
    });
    $('.st-status-f').addEventListener('change', (ev) => { statusF = ev.target.value; shown = PAGE; renderData(); });
    panel.querySelector('.st-types').addEventListener('click', (ev) => {
      const b = ev.target.closest('button.st-type-chip');
      if (!b) return;
      typeF = b.dataset.t || '';
      shown = PAGE;
      renderData();
    });
    $('.st-list').addEventListener('click', (ev) => {
      const more = ev.target.closest('button.st-more');
      if (more) { shown += PAGE; renderData(); return; }
      // v4.9.33: butoanele din tab-ul Boot
      const bin = ev.target.closest('button[data-bootins]');
      if (bin) {
        const bt = bootList().find((x) => x.i === bin.dataset.bootins);
        if (!bt) return;
        const ok = insertIntoComposer(composeBootText(bt));
        const t = bin.textContent; bin.textContent = ok ? '✓' : '✗';
        setTimeout(() => { bin.textContent = t; }, 1200);
        return;
      }
      const bcp = ev.target.closest('button[data-bootcopy]');
      if (bcp) {
        const bt = bootList().find((x) => x.i === bcp.dataset.bootcopy);
        if (!bt) return;
        navigator.clipboard.writeText(composeBootText(bt)).then(() => {
          const t = bcp.textContent; bcp.textContent = '✓';
          setTimeout(() => { bcp.textContent = t; }, 1200);
        }).catch(() => {});
        return;
      }
      const azb = ev.target.closest('button[data-az]');
      if (azb) {
        // v4.9.28: DOAR deschide Storage Explorer (copierea automata a ref-ului dezactivata
        // la cererea userului). Protocol custom — pagina NU se navigheaza; nu logam URL-ul.
        rvlog('deschid Azure Storage Explorer');
        // v4.37.0: sablonul vine de pe server — deschidem doar Storage Explorer sau https, nimic altceva
        if (/^(storageexplorer:|https:)/i.test(azb.dataset.az || '')) location.href = azb.dataset.az;
        return;
      }
      const b = ev.target.closest('button[data-copy]');
      if (!b) return;
      navigator.clipboard.writeText(b.dataset.copy).then(() => {
        const t = b.textContent; b.textContent = L('common.copied');
        setTimeout(() => { b.textContent = t; }, 900);
      }).catch(() => {});
    });
    $('.pp-close').addEventListener('click', () => panel.classList.remove('open'));
    // v4.9.21: carlig pentru auto-refresh — redeseneaza lista si actualizeaza statusul
    panel.rvRender = (msg) => { if (typeof msg === 'string') state.textContent = msg; renderData(); };
    renderAuth();
    renderData();
    return panel;
  }

  function buildPanel(hud) {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('div');
    panel.id = PANEL_ID;
    // v4.47.0: șabloanele sunt ale organizației (/api/hud/config → templates), desenate la fiecare configurație nouă;
    // titlu de grupă la fiecare grup nou
    panel.innerHTML = `
      <button class="pp-close" type="button" data-rvla="common.close">✕</button>
      <h3 data-rvl="pp.ident_h"></h3>
      <div class="pp-hint" data-rvl="pp.ident_hint"></div>
      <input class="pp-ident" type="text" data-rvlp="pp.ident_ph" />
      <div class="pp-row">
        <button class="pp-act pp-ident-save" type="button" data-rvl="pp.ident_save"></button>
        <button class="pp-act danger pp-ident-clear" type="button" data-rvl="common.delete"></button>
        <span class="pp-ident-state"></span>
      </div>
      <hr>
      <h3 data-rvl="pp.pp_h"></h3>
      <div class="pp-hint" data-rvl="pp.pp_hint"></div>
      <textarea class="pp-text" data-rvlp="pp.pp_ph"></textarea>
      <div class="pp-row">
        <button class="pp-act pp-save" type="button" data-rvl="common.save"></button>
        <button class="pp-act danger pp-clear" type="button" data-rvl="pp.pp_clear"></button>
        <span class="pp-state"></span>
      </div>
      <hr>
      <h3 data-rvl="pp.dir_h"></h3>
      <div class="pp-hint" data-rvl="pp.dir_hint"></div>
      <textarea class="pp-dir" data-rvlp="pp.dir_ph"></textarea>
      <div class="pp-row">
        <button class="pp-act pp-dir-save" type="button" data-rvl="pp.dir_save"></button>
        <button class="pp-act danger pp-dir-clear" type="button" data-rvl="pp.dir_clear"></button>
        <span class="pp-dir-state"></span>
      </div>
      <hr>
      <h3 data-rvl="pp.tpl_h"></h3>
      <div class="pp-hint" data-rvl="pp.tpl_hint"></div>
      <div class="pp-tpls"></div>
    `;
    document.body.appendChild(panel);
    const ta = panel.querySelector('.pp-text');
    const state = panel.querySelector('.pp-state');
    const btn = hud.querySelector('.rv-pp-btn');
    function refresh() {
      const pp = getPP();
      ta.value = pp;
      state.textContent = L(pp ? 'pp.pp_on' : 'pp.pp_off');
      if (btn) btn.classList.toggle('on', !!pp);
    }
    panel.querySelector('.pp-save').addEventListener('click', () => { setPP(ta.value.trim()); refresh(); });
    panel.querySelector('.pp-clear').addEventListener('click', () => { setPP(''); refresh(); });
    // v3.9: identitate sesiune
    const ida = panel.querySelector('.pp-ident');
    const idstate = panel.querySelector('.pp-ident-state');
    function refreshIdent() { const v = getIdent(); ida.value = v; idstate.textContent = L(v ? 'pp.ident_on' : 'pp.off_f'); }
    panel.querySelector('.pp-ident-save').addEventListener('click', () => { setIdent(ida.value.trim()); refreshIdent(); });
    panel.querySelector('.pp-ident-clear').addEventListener('click', () => { setIdent(''); refreshIdent(); });
    refreshIdent();
    // v3.7: directiva canon (localStorage -> capsula USER DIRECTIVE)
    const da = panel.querySelector('.pp-dir');
    const dstate = panel.querySelector('.pp-dir-state');
    function refreshDir() { const v = getUserDirective(); da.value = v; dstate.textContent = L(v ? 'pp.dir_on' : 'pp.off_f'); }
    panel.querySelector('.pp-dir-save').addEventListener('click', () => { setUserDirective(da.value.trim()); refreshDir(); });
    panel.querySelector('.pp-dir-clear').addEventListener('click', () => { setUserDirective(''); refreshDir(); });
    refreshDir();
    panel.querySelector('.pp-close').addEventListener('click', () => panel.classList.remove('open'));
    const tplBox = panel.querySelector('.pp-tpls');
    function renderTemplates() {
      tplBox.innerHTML = TEMPLATES.map((t, i) => ((t[2] && (i === 0 || TEMPLATES[i - 1][2] !== t[2])) ? '<div class="pp-tpl-grp">' + esc(t[2]) + '</div>' : '')
        + '<button class="pp-tpl" type="button" data-tpl="' + i + '">📋 ' + esc(t[0]) + '</button>').join('')
        || '<div class="pp-hint">' + esc(rvEmptyHint(L('pp.tpl_what'))) + '</div>';
    }
    tplBox.addEventListener('click', (ev) => {
      const b = ev.target.closest('.pp-tpl');
      if (!b) return;
      const t = TEMPLATES[Number(b.dataset.tpl)];
      if (t && insertIntoComposer(t[1])) panel.classList.remove('open');
    });
    // la fiecare configuratie noua: cuvintele (prin refreshLabels), starile si sabloanele
    panel.rvRender = () => { refresh(); refreshIdent(); refreshDir(); renderTemplates(); };
    panel.rvRender();
    return panel;
  }

  // Auto-insertie: O SINGURA data per sosire pe o pagina de chat NOU, doar in composer GOL
  // (nu suprascrie draftul omului; daca omul sterge textul din composer, nu revine pana la
  // urmatorul chat nou). "Perpetuu" = pana la stergerea din panou (setPP('')).
  let ppInsertedHere = false;
  function isNewChatPage() {
    const p = location.pathname;
    if (isConversationUrl()) return false;   // 2026-09-25: /g/<gizmo>/c/<id> = conversatie existenta, nu chat nou
    return p === '/' || p.startsWith('/g/');
  }
  // v3.8/3.9: deschiderea de sesiune inserata INCAPSULAT in composer, la chat nou, in engleza,
  // cu o linie goala DUPA (Enter) ca mesajul tau sa inceapa pe rand nou dedesubt. Trei cazuri:
  //   (A) identitate + directiva perpetua  (B) doar identitate  (C) doar directiva (fara identitate).
  // Identitatea = declaratie de sesiune/continuum + asumarea corectitudinii datelor introduse.
  // (composer-ul ProseMirror accepta \n prin execCommand insertText.)
  function buildSessionOpener(ident, pp) {
    ident = (ident || '').trim(); pp = (pp || '').trim();
    if (ident && pp) {
      return '[SESSION — ' + ident + "'s working session (continuum); I answer for the correctness of the data I provide. "
        + 'Standing directive for this whole conversation, apply it to every reply below:]\n' + pp + '\n\n';
    }
    if (ident) {
      return '[SESSION — ' + ident + "'s working session (continuum); I answer for the correctness of the data I provide.]\n\n";
    }
    // doar directiva (comportamentul v3.8)
    return '[SESSION DIRECTIVE — a standing instruction I set for this whole conversation (continuum); '
      + 'apply it to every reply below, alongside answering my request]\n' + pp + '\n\n';
  }
  function autoInsertPerpetual() {
    if (!isNewChatPage()) { ppInsertedHere = false; return; }
    if (ppInsertedHere) return;
    const ident = getIdent();
    const pp = getPP();
    if (!ident && !pp) return;                              // nimic de declarat
    const ed = findComposer();
    if (!ed) return;
    if (composerText(ed).trim() !== '') { ppInsertedHere = true; return; }
    if (insertIntoComposer(buildSessionOpener(ident, pp))) ppInsertedHere = true;
  }

  // === v3.3: CANON PER-TURA (echivalentul hook-ului UserPromptSubmit de la Claude) ===
  // La fiecare trimitere (Enter sau butonul de send), textul TASTAT e trimis serverului HUD local
  // (/canon_select ruleaza vigilia_router.pick_reflexes + pick_norme — ACELASI selector ca la Claude),
  // iar blocul [CANON RENDA] se adauga la FINALUL mesajului inainte de trimitere. Fail-open: server
  // oprit / timeout -> mesajul pleaca NEatins. Butonul ⚖ Canon = suprimare (teste A/B).
  // v3.4: trei stari — 'full' | 'compact' | 'off' (migrare din vechiul true/false)
  function getCanonMode() {
    try {
      const v = localStorage.getItem(CANON_KEY);
      if (v === 'full' || v === 'compact' || v === 'off') return v;
      if (v === 'false') return 'off';
      return 'full';
    } catch (_) { return 'full'; }
  }
  function setCanonMode(m) { try { localStorage.setItem(CANON_KEY, m); } catch (_) {} }
  function getCanonOn() { return getCanonMode() !== 'off'; }

  function setCanonLine(hud, text, ok) {
    const n = hud.querySelector('[data-rv-canon]');
    if (n) { n.textContent = text; n.style.color = ok ? '' : 'var(--rv-k-e0b24c)'; }
  }

  // === v4.3: CANON EMBEDAT + SELECTOR LOCAL (independenta de HUD) ===
  // Portul JS al vigilia_router.pick_reflexes/pick_norme. Cand HUD-ul (127.0.0.1:8765) raspunde,
  // il folosim (are si directivele). Cand tace, selectam LOCAL din canonul de mai jos -> banda
  // merge pe ORICE calculator, cu HUD sau fara. Directivele exista DOAR cu HUD (local nu le are).
  // v4.37.0: canonul NU mai sta in pachet — vine din /api/hud/canon (dupa conectare, cache 24 h) sau
  // de la serverul HUD local (127.0.0.1:8765/canon_select). Gol = mesajul pleaca fara bloc de canon.
  let CANON_EMBED = {"reflexe":{},"norme":[],"signals":[],"nucleu":[],"top_n":3};
  function _tok(s) { const m = String(s).toLowerCase().match(/[a-z0-9ăâîşţ]{4,}/g); return new Set(m || []); }
  function localPickReflexes(prompt) {
    const plow = ' ' + prompt.toLowerCase() + ' ';
    const ptok = _tok(prompt);
    const idx = CANON_EMBED.reflexe, scores = {};
    (CANON_EMBED.signals || []).forEach((sig) => {
      const w = sig.weight || 2;
      let hits = 0; (sig.keywords || []).forEach((k) => { let p = 0; while ((p = plow.indexOf(k, p)) >= 0) { hits++; p += k.length; } });
      if (hits) (sig.reflexes || []).forEach((c) => { if (idx[c]) scores[c] = (scores[c] || 0) + w * Math.min(hits, 3); });
    });
    Object.keys(idx).forEach((c) => {
      const rt = _tok((idx[c].axis || '') + ' ' + (idx[c].why || ''));
      let ov = 0; rt.forEach((t) => { if (ptok.has(t)) ov++; });
      if (ov) scores[c] = (scores[c] || 0) + ov;
    });
    const topN = CANON_EMBED.top_n || 3;
    const ranked = Object.keys(scores).sort((a, b) => (scores[b] - scores[a]) || (a < b ? -1 : 1));
    const picked = ranked.slice(0, topN);
    (CANON_EMBED.nucleu || ['R01', 'R49']).forEach((c) => { if (picked.length < Math.max(2, topN) && idx[c] && picked.indexOf(c) < 0) picked.push(c); });
    return picked.map((c) => ({code: c, axis: idx[c].axis, dpi: idx[c].dpi, dni: idx[c].dni}));
  }
  // [v4.13.0, decizie autor 2026-07-24] CATE O NORMA DIN FIECARE STRAT (7/tura), fara rotatie
  // pe zi — oglinda exacta a pick_norme din vigilia_router (zero drift de selector). In fiecare
  // strat: overlap-ul lexical maxim (stem-5 prompt ∩ taguri); egalitate -> id alfabetic; prompt
  // fara overlap -> prima norma (alfabetic) din strat. dateStr ramane in semnatura (compat), nefolosit.
  const RV_STRATA = ['axioma', 'postulat', 'protocol', 'idee-forta', 'idee_forta_autor', 'axioma_proprie', 'cod_sophailo'];
  function localPickNorme(prompt, dateStr) {
    const pstem = new Set(); _tok(prompt).forEach((t) => pstem.add(t.slice(0, 5)));
    const pool = CANON_EMBED.norme || [];
    const out = [];
    RV_STRATA.forEach((s) => {
      let best = null, bestOv = -1;
      pool.forEach((it) => {
        if ((it.strat || '') !== s) return;
        // stem-urile tagurilor DEDUPLICATE intr-un Set inainte de numarare — identic cu
        // serverul (len(set ∩ set)); numararea per-tag ar umfla scorul la taguri cu acelasi stem
        const tg = new Set(); (it.tags || []).forEach((x) => tg.add(String(x).slice(0, 5)));
        let ov = 0; tg.forEach((x) => { if (pstem.has(x)) ov++; });
        if (ov > bestOv || (ov === bestOv && best && String(it.id) < String(best.id))) { best = it; bestOv = ov; }
      });
      if (best) {
        const n = {id: best.id, name: best.name, formula: best.formula, why: 'fit'};
        if (best.strat) n.strat = best.strat;
        if (best.lang) n.lang = best.lang;
        if (best.pills) n.pills = best.pills;
        out.push(n);
      }
    });
    return out;
  }
  // v4.12.1 — oglinda lang_swap-ului din server (fallback-ul LOCAL avea gaura): corpusul trilingv
  // se serveste in LIMBA promptului (radacinile latine comune dau egalitati cazute pe EN), iar o
  // unitate apare O SINGURA data per tura (dedup pe unit). Fail-open: orice eroare -> lista neatinsa.
  function rvDetectLang(text) {
    const p = ' ' + String(text || '').toLowerCase() + ' ';
    let ro = (p.match(/[ăâîșț]/g) || []).length;
    ['si', 'sa', 'de', 'cu', 'pe', 'este', 'sunt', 'care', 'pentru', 'vreau', 'fara', 'asta'].forEach((w) => { ro += p.split(' ' + w + ' ').length - 1; });
    let en = 0;
    ['the', 'and', 'with', 'for', 'that', 'this', 'are', 'have', 'will', 'what', 'how', 'not'].forEach((w) => { en += p.split(' ' + w + ' ').length - 1; });
    let la = 0;
    ['est', 'enim', 'ergo', 'atque', 'igitur', 'quoniam', 'quibus', 'esse'].forEach((w) => { la += p.split(' ' + w + ' ').length - 1; });
    if (la >= 3 && la > en && la > ro) return 'LA';
    if (en > ro) return 'EN';
    return 'RO';
  }
  let rvEmbedIdx = null;   // cache: id -> intrare embed + (unit|lang) -> intrare
  function rvLangSwapDedup(text, norme) {
    try {
      if (!rvEmbedIdx) {
        rvEmbedIdx = {byId: {}, byUL: {}};
        (CANON_EMBED.norme || []).forEach((n) => {
          rvEmbedIdx.byId[n.id] = n;
          if (n.unit && n.lang) rvEmbedIdx.byUL[n.unit + '|' + n.lang] = n;
        });
      }
      const lang = rvDetectLang(text);
      const seen = new Set();
      const out = [];
      (norme || []).forEach((it) => {
        if (!it) return;
        const full = rvEmbedIdx.byId[it.id] || it;
        let pick = it;
        if (full.unit && full.lang && full.lang !== lang) {
          const sib = rvEmbedIdx.byUL[full.unit + '|' + lang];
          if (sib) pick = Object.assign({}, sib, {why: it.why});   // fratele in limba promptului, pastram motivul
        }
        const u = (rvEmbedIdx.byId[pick.id] || pick).unit;
        if (u) { if (seen.has(u)) return; seen.add(u); }           // o singura limba per unitate per tura
        out.push(pick);
      });
      return out;
    } catch (_) { return norme; }
  }

  function localCanonSelect(text) {
    const now = new Date();
    const ds = '' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    return {ok: true, source: 'local', reflexe: localPickReflexes(text), norme: rvLangSwapDedup(text, localPickNorme(text, ds)), directive: withUserDirective([])};
  }
  // v3.7: adauga directiva LOCALA a userului (din panou) la orice lista de directive (HUD sau local)
  function withUserDirective(dirs) {
    const ud = getUserDirective();
    const out = (dirs || []).slice();
    if (ud) out.push({key: 'user', text: ud});
    return out;
  }

  function gmCanonSelect(text, cb) {
    const gm = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest
      : (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest
      : extRuntimeOk() ? extHudRequest : null;
    if (!gm) { rvlog('canon: fara transport -> selectie LOCALA'); return cb(localCanonSelect(text)); }
    // NB: nu logam textul (confidentialitate) — doar lungimea si sursa selectiei
    rvlog('canon: cerere HUD (', String(text).length, 'caractere )');
    gm({
      method: 'GET',
      url: CONFIG.canonUrl + '?q=' + encodeURIComponent(String(text).slice(0, 2000)),
      timeout: 900,
      onload: (res) => { try { const d = JSON.parse(res.responseText); if (d && d.ok) { d.directive = withUserDirective(d.directive); rvlog('canon: sursa HUD ✓ (', (d.reflexe || []).length, 'reflexe,', (d.norme || []).length, 'norme )'); cb(d); } else { rvlog('canon: HUD a raspuns dar fara ok -> LOCAL'); cb(localCanonSelect(text)); } } catch (_) { rvlog('canon: raspuns HUD ne-parsabil -> LOCAL'); cb(localCanonSelect(text)); } },
      onerror: () => { rvlog('canon: eroare transport -> LOCAL'); cb(localCanonSelect(text)); },
      ontimeout: () => { rvlog('canon: timeout HUD -> LOCAL'); cb(localCanonSelect(text)); }
    });
  }

  // Preambul scurt in engleza: spune AI-ului CE e pachetul asta si cum sa-l trateze.
  // Capsulat cu separatoare ----- : directiva user (aditionala) intr-o capsula, canonul in alta.
  const SEP = '-----';
  // [RETRAS din envelope la v4.27.0 — envelope-ul e strict cel cerut de autor; textul ramane
  //  aici pentru reactivare, guvernanta o poarta acum sectiunea [CANON MEMORY] din BOOT.]
  const PREAMBLE = 'RENDA ADD-ON — an auto-selected behavioral layer appended to the user message above. ' +
    'It is ADDITIONAL guidance, not the user\'s request: apply it as method and lens while answering the request. ' +
    'GOVERNANCE NOTE: norms tagged [AX-RENDA-*] (own axioms, author-ratified), [IFA-*] (author\'s driving ideas) and ' +
    '[FC/CL/FS/PA/VC/VH/TCR-*] (SoPh[A]iloTechnoLogy codes, served in the language you write) are RENDA canon layers ' +
    'that may be ABSENT from your installed CANON/PILL registry — do NOT quarantine them; treat them as valid RENDA ' +
    'guidance CORRELATED with the installed pills (their "pills:" tag names the related pill). ' +
    'PRECEDENCE on any conflict: installed PILLS prevail over these add-on norms; R01 ZERO-INVENTION (never fabricate facts) prevails over everything.';

  // v4.10.0 — BOOT DE IDENTITATE (strat 1): blocul ALTER_EGO PROTOCOL + VIGILIA NUCLEU, embedat.
  // v4.16.0 — corp v2.2-refact EN (2026-07-27), text VERBATIM al autorului: lane-uri de activare
  // (plugin/standalone/knowledge), politici separate PILL ROUTING vs CANON MEMORY SELECTION (max 5+5,
  // DEFERRED/VALID_TRIMMED in loc de carantina pe numar), licenta LicenseRef-RENDA-Proprietary-1.0.
  // (reprezentare derivata, P03; SSOT = canonul local). Se injecteaza O DATA, in capul PRIMULUI mesaj.
  const BOOT_MARK = '[START] RENDA_BOOT';   // marker anti-dubla-injectie (capul blocului; acopera RENDA_BOOT_CHATGPT vechi + RENDA_BOOT nou)
  const BOOT_IDENT_KEY = 'rvBootIdent';     // localStorage 'off' => doar canon per-tura, fara boot
  /*__RENDA_BOOT_EMBED_START__*/
  // v4.37.0: blocul BOOT general vine din /api/hud/config (boot_block); gol = fara bloc la primul mesaj
  let BOOT_EMBED = "";
  /*__RENDA_BOOT_EMBED_END__*/

  function getBootIdentOn() { try { return localStorage.getItem(BOOT_IDENT_KEY) !== 'off'; } catch (_) { return true; } }

  // Conversatie NOUA = zero mesaje randate la momentul trimiterii. Heuristica DOM, fara bookkeeping:
  // pe /c/<id> exista deja [data-message-author-role]; pe chat nou (inclusiv proiecte) nu exista inca.
  // 2026-09-25: ChatGPT nou NU mai pune data-message-author-role pe mesaje; turele au data-turn-key /
  // data-content-search-turn-key, raspunsul are h4[data-conversation-role], mesajul userului
  // data-user-message-bubble. Conversatia existenta sta pe /c/<id> (si /g/<gizmo>/c/<id>).
  // Prima tura = niciun marker de tura in DOM SI URL fara /c/<id>. (Fara corectie, pe shell-ul nou
  // BOOT-ul intra in FIECARE mesaj, nu doar in primul.)
  const TURN_SEL = '[data-message-author-role], [data-message-id], [data-turn-key], [data-content-search-turn-key], '
    + '[data-conversation-role], [data-user-message-bubble], article[data-turn], [data-testid^="conversation-turn"]';
  function isConversationUrl() { return /\/c\/[0-9a-f-]{8,}/i.test(location.pathname); }
  function isFirstMessageOfConversation() {
    try {
      if (isConversationUrl()) return false;
      return !document.querySelector(TURN_SEL);
    } catch (_) { return false; }
  }

  function moveCursorToStart(ed) {
    if (isTextarea(ed)) { try { ed.setSelectionRange(0, 0); } catch (_) {} return; }
    try {
      const range = document.createRange();
      range.selectNodeContents(ed);
      range.collapse(true);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }

  function buildCanonBlock(d, mode) {
    const cut = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const reflexe = d.reflexe || [];
    const norme = d.norme || [];
    // Envelope-ul se emite NUMAI dupa o selectie reusita; selectie goala => nimic (zero envelope partial)
    if (!reflexe.length && !norme.length) return '';

    const out = ['', ''];

    // DIRECTIVA USER = textul PROPRIU al userului, nu continut generat de HUD => ramane IN AFARA
    // envelope-ului (envelope-ul poarta SOURCE=RENDA_HUD si contine strict selectia canonica).
    (d.directive || []).forEach((dd) => {
      out.push('[USER DIRECTIVE — persistent, additional: ' + cut(dd.text, mode === 'compact' ? 220 : 400) + ']');
    });

    out.push(CANON_MARK);
    out.push('SOURCE=RENDA_HUD');
    out.push('SCOPE=CURRENT_MESSAGE_ONLY');
    out.push('SCHEMA=1');
    out.push('MODE=' + (mode === 'compact' ? 'COMPACT' : 'FULL'));

    if (mode === 'compact') {
      // doar codurile — canonul complet il cara skill-ul de canon memory (references)
      const r = reflexe.map((x) => x.code).join('·');
      const n = norme.map((x) => x.id).join('·');
      out.push('[CANON (codes) — reflexes ' + r + ' + norms ' + n + '; resolve these from the RENDA canon]');
    } else {
      // FULL = reflexe si norme INTREGI (fara taiere — userul le vrea complete)
      out.push('[CANON — reflexes & norms selected for this request]');
      reflexe.forEach((r) => {
        out.push('REFLEX ' + r.code + ' ' + r.axis + ' | DPI: ' + r.dpi + ' | DNI: ' + r.dni);
      });
      norme.forEach((n) => {
        // activatorii de pastile + proveniența stratului pe linia normei (pills prevalează; corelezi, nu topești)
        const ex = [];
        if (n.strat && !['axioma', 'postulat', 'protocol', 'idee_forta'].includes(n.strat)) ex.push('strat: ' + n.strat);
        if (n.lang) ex.push('lang: ' + n.lang);
        if (n.pills && n.pills.length) ex.push('pills: ' + n.pills.join(','));
        const sufix = ex.length ? ' · ' + ex.join(' · ') : '';
        out.push('NORMA [' + n.id + '] ' + n.name + ' — ' + n.formula + ' (' + (n.why === 'zi' ? 'daily rotation' : 'lexical match') + sufix + ')');
      });
    }
    out.push(ENV_END);
    return out.join('\n');
  }

  function canonSummary(d) {
    const r = (d.reflexe || []).map((x) => x.code).join('·');
    const n = (d.norme || []).map((x) => x.id).join('·');
    const dir = (d.directive || []).length ? ' + DIR:' + d.directive.length : '';
    const mode = getCanonMode() === 'compact' ? ' ·c' : '';
    const src = d.source === 'local' ? ' [local]' : ' [HUD]';   // v4.3: transparenta sursei
    return L('canon.st_summary', { codes: r + ' + ' + n + dir + mode + src });
  }

  function moveCursorToEnd(ed) {
    if (isTextarea(ed)) { try { const n = (ed.value || '').length; ed.setSelectionRange(n, n); } catch (_) {} return; }
    try {
      const range = document.createRange();
      range.selectNodeContents(ed);
      range.collapse(false);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_) {}
  }

  // 2026-09-25: butonul de trimitere NOU = <button type="submit" aria-label="Send"> in <form>-ul
  // composer-ului (fara data-testid="send-button", fara #composer-submit-button); apare DOAR cand
  // composer-ul are text. Ordinea: selectorii vechi -> submit-ul din formularul composer-ului ->
  // aria-label EXACT Send/Trimite (nu prefix: "Send Feedback" NU e buton de trimitere). Butoanele HUD
  // si cele invizibile/dezactivate sunt sarite.
  const SEND_LABELS = ['send', 'send prompt', 'send message', 'trimite', 'trimite mesajul', 'trimite mesaj'];
  const SEND_LEGACY_SEL = 'button[data-testid="send-button"], #composer-submit-button';
  function sendLabelOk(btn) { return SEND_LABELS.indexOf((btn.getAttribute('aria-label') || '').trim().toLowerCase()) !== -1; }
  function composerForm() { const ed = findComposer(); return ed && ed.closest ? ed.closest('form') : null; }
  function isSendButton(btn, form) {
    if (!(btn instanceof HTMLElement) || btn.tagName !== 'BUTTON' || isHudNode(btn)) return false;
    if (btn.matches(SEND_LEGACY_SEL)) return true;
    // cand composer-ul are formular, DOAR butoanele din acel formular conteaza: formularul de editare a
    // unui mesaj vechi ("Edit message") are si el un buton Send, care NU trebuie sa declanseze canonul
    if (form) return form.contains(btn) && (btn.type === 'submit' || sendLabelOk(btn));
    return sendLabelOk(btn);
  }
  function findSendButton() {
    const form = composerForm();
    const cands = [];
    const push = (list) => { for (let i = 0; i < list.length; i++) cands.push(list[i]); };
    push(document.querySelectorAll(SEND_LEGACY_SEL));
    if (form) push(form.querySelectorAll('button[type="submit"], button[aria-label]'));
    push(document.querySelectorAll('button[aria-label]'));
    // DOAR un buton vizibil si activ: pe unul dezactivat click() nu emite nimic (bypass-ul ar ramane agatat);
    // fara buton utilizabil, proceedSend trece pe Enter sintetic, iar watchdog-ul curata bypass-ul.
    const usable = (b) => isSendButton(b, form) && !b.disabled && b.getAttribute('aria-disabled') !== 'true' && rvVisible(b);
    return cands.find(usable) || null;
  }
  function isSendControl(t) {
    const btn = t && t.closest ? t.closest('button') : null;
    return !!btn && isSendButton(btn, composerForm());
  }

  let canonBusy = false;    // injectia e in curs (asteptam serverul)
  let canonBypass = false;  // urmatoarea trimitere trece NEinterceptata (re-dispatch programatic / fail-open)
  let canonBusyWatchdog = 0;
  // (dupa review 2026-09-25) bypass-ul se armeaza abia la dispatch si EXPIRA singur daca trimiterea programatica
  // nu ajunge la interceptor (buton indisponibil, eveniment neemis) — altfel ramanea agatat si urmatoarea
  // trimitere MANUALA trecea fara canon.
  let canonBypassWatchdog = 0;
  function armCanonBypass() {
    canonBypass = true;
    clearTimeout(canonBypassWatchdog);
    canonBypassWatchdog = setTimeout(() => {
      if (canonBypass) { canonBypass = false; rvlog('canon: bypass expirat — trimiterea programatica nu a fost interceptata (buton indisponibil?)'); }
    }, 1500);
  }
  function consumeCanonBypass() { canonBypass = false; clearTimeout(canonBypassWatchdog); }
  // v3.3.1: PREFETCH-ON-INPUT — selectia se ia DIN TIMP (cat userul tasteaza), ca la Enter sa fie
  // cache-hit SINCRON (fara gaura asincrona in care tab-ul de fundal throttle-uieste callback-ul GM).
  const canonCache = {key: '', data: null, ts: 0};

  function cacheKey(text) { return text.length + ':' + text.slice(0, 48) + ':' + text.slice(-24); }

  function prefetchCanon() {
    if (!getCanonOn()) return;
    const ed = findComposer();
    if (!ed) return;
    const text = composerText(ed).trim();
    if (!text || text.includes(CANON_MARK)) return;
    const k = cacheKey(text);
    if (canonCache.key === k && canonCache.data && Date.now() - canonCache.ts < 20000) return;
    gmCanonSelect(text, (d) => {
      if (d) { canonCache.key = k; canonCache.data = d; canonCache.ts = Date.now(); }
    });
  }

  function wireCanonIntercept(hud) {
    function proceedSend(ed) {
      // sincronizarea ProseMirror/React: input-event + un tick INAINTE de click pe send —
      // click-ul in acelasi tick cu execCommand risca sa trimita starea VECHE (cursa reala, prinsa la test)
      try { ed.dispatchEvent(new InputEvent('input', {bubbles: true})); } catch (_) {}
      setTimeout(() => {
        const btn = findSendButton();   // doar vizibil si activ; altfel Enter sintetic
        armCanonBypass();               // armat abia acum, cu expirare automata (vezi armCanonBypass)
        if (btn) { btn.click(); return; }
        try {
          ed.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', code: 'Enter', bubbles: true, cancelable: true}));
        } catch (_) { consumeCanonBypass(); }
      }, 140);
    }
    function injectAndSend(hud2, d, expectText) {
      const ed = findComposer();                           // RE-gaseste composer-ul (SPA-ul il poate inlocui)
      if (!ed) { setCanonLine(hud2, L('canon.st_no_composer'), false); return; }
      const now = composerText(ed).trim();
      if (!now || now.includes(CANON_MARK)) { setCanonLine(hud2, L('canon.st_changed'), false); return; }
      if (expectText && now !== expectText) { setCanonLine(hud2, L('canon.st_text_changed'), false); return; }
      ed.focus();
      // v4.10.0 — strat 1: boot de identitate, O DATA, in CAPUL primului mesaj al conversatiei
      let booted = false;
      if (BOOT_EMBED && getBootIdentOn() && isFirstMessageOfConversation() && !now.includes(BOOT_MARK)) {
        moveCursorToStart(ed);
        booted = rvInsertText(ed, BOOT_EMBED + '\n\n');
      }
      moveCursorToEnd(ed);
      let injected = false;
      const block = buildCanonBlock(d, getCanonMode());
      if (block) injected = rvInsertText(ed, block);
      setCanonLine(hud2,
        !block ? L('canon.st_empty')
               : (injected ? canonSummary(d) + (booted ? ' +BOOT' : '') : L('canon.st_failed')),
        !!injected);
      proceedSend(ed);
    }
    function handleAttempt(e) {
      if (canonBypass) { consumeCanonBypass(); return; }   // trimiterea noastra programatica / fail-open
      // v4.15.0 — Electron HUD: apelul AUTOMAT (renda_gpt.py -> GPTI din pages/gpt.html) seteaza
      // window.__rvAutoBypass in webview inainte de send: canonul ramane DOAR pe trimiterea MANUALA
      // (decizie Virgil 2026-07-25; comutabil la "canon si pe automat" scotand flagul din gpt.html).
      // In Chrome flagul nu e setat de nimeni (lumea izolata a content-scriptului) => inert.
      if (window.__rvAutoBypass === true) return;
      if (!getCanonOn() || canonBusy) return;
      const ed = findComposer();
      if (!ed) return;
      const text = composerText(ed).trim();
      if (!text) return;
      if (text.includes(CANON_MARK)) return;               // deja injectat in acest mesaj
      e.preventDefault();
      e.stopImmediatePropagation();
      // CACHE-HIT (calea normala, sincrona): selectia e deja luata in timpul tastarii
      if (canonCache.data && canonCache.key === cacheKey(text) && Date.now() - canonCache.ts < 20000) {
        injectAndSend(hud, canonCache.data, text);
        return;
      }
      canonBusy = true;
      clearTimeout(canonBusyWatchdog);
      canonBusyWatchdog = setTimeout(() => { canonBusy = false; }, 2500);   // anti-blocaj: callback pierdut != garda blocata
      gmCanonSelect(text, (d) => {
        canonBusy = false;
        clearTimeout(canonBusyWatchdog);
        // gmCanonSelect cade deja pe local cand HUD tace; d nu mai e null in mod normal.
        // Ultima plasa: daca totusi e null, selectam local aici (banda NU pleaca goala).
        injectAndSend(hud, d || localCanonSelect(text), text);
      });
    }
    // v3.3.1: prefetch pe tastare (debounce) — la Enter selectia e deja in cache (cale sincrona)
    let ppDeb = 0;
    document.addEventListener('input', (e) => {
      const ed = findComposer();
      if (!ed || !e.target || (e.target !== ed && !(ed.contains && ed.contains(e.target)))) return;
      clearTimeout(ppDeb);
      ppDeb = setTimeout(prefetchCanon, 500);
    }, true);
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      const ed = findComposer();
      if (!ed) return;
      const a = document.activeElement;
      if (a !== ed && !(ed.contains && ed.contains(a))) return;
      handleAttempt(e);
    }, true);
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (!isSendControl(t)) return;   // 2026-09-25: si butonul nou (type=submit in formularul composer-ului)
      handleAttempt(e);
    }, true);
  }

  // v3_cl: monitor CPU/RAM live din serverul HUD local (/sysmon). GM_xmlhttpRequest ocolește CORS
  // (serverul HUD nu trimite Access-Control-* și rămâne neatins); @connect limitează la 127.0.0.1.
  // Trafic: DOAR GET pe mașina proprie; nimic din pagină nu pleacă nicăieri.
  function startSysmon(hud) {
    const gm = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest
      : (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') ? GM.xmlHttpRequest
      : extRuntimeOk() ? extHudRequest : null;
    const hudNode = hud.querySelector('[data-rv-hud]');
    const cpuNode = hud.querySelector('[data-rv-cpu]');
    const ramNode = hud.querySelector('[data-rv-ram]');
    const hudBar = hud.querySelector('[data-rv-hud-bar]');
    const cpuBar = hud.querySelector('[data-rv-cpu-bar]');
    const ramBar = hud.querySelector('[data-rv-ram-bar]');
    if (!gm) { if (hudNode) hudNode.textContent = L('sys.no_transport'); rvlog('sysmon: fara transport (nici GM, nici extensie)'); return; }
    let lastSys = '';
    const sysLog = (s, extra) => { if (s !== lastSys) { rvlog('sysmon:', s, extra || ''); lastSys = s; } };
    const color = (p) => p >= 85 ? 'var(--rv-k-hot)' : (p >= 65 ? 'var(--rv-k-e0b24c)' : 'var(--rv-blue)');   // v4.37.0: pe tema curenta
    function setOffline() {
      sysLog('OFFLINE', '(serverul HUD nu raspunde pe ' + CONFIG.sysmonUrl + ')');
      if (hudNode) { hudNode.textContent = L('sys.offline'); hudNode.classList.remove('online'); }
      hud.classList.remove('rv-local-on');
      if (hudBar) { hudBar.style.width = '100%'; hudBar.style.background = 'var(--rv-k-offbar)'; }
      if (cpuNode) cpuNode.textContent = '—';
      if (ramNode) ramNode.textContent = '—';
      if (cpuBar) cpuBar.style.width = '0%';
      if (ramBar) ramBar.style.width = '0%';
    }
    function tick() {
      if (document.hidden) return;
      gm({
        method: 'GET',
        url: CONFIG.sysmonUrl,
        timeout: 1500,
        onload: (res) => {
          try {
            const d = JSON.parse(res.responseText);
            if (!d) return setOffline();
            if (!d.ok) {
              // serverul HUD e VIU dar samplerul CPU/RAM nu are date (ex. copil sysmon oprit) —
              // stare reala distincta de "server oprit" (onest, nu OFFLINE fals)
              sysLog('LIVE (fara metrici CPU/RAM)');
              if (hudNode) { hudNode.textContent = L('sys.live'); hudNode.classList.add('online'); } hud.classList.add('rv-local-on');
              if (hudBar) { hudBar.style.width = '100%'; hudBar.style.background = 'var(--rv-green)'; }
              if (cpuNode) cpuNode.textContent = '—';
              if (ramNode) ramNode.textContent = '—';
              if (cpuBar) cpuBar.style.width = '0%';
              if (ramBar) ramBar.style.width = '0%';
              return;
            }
            const cpu = Math.round(d.cpu || 0);
            const ram = Math.round(d.ram_pct || 0);
            const rcpu = Math.round(d.renda_cpu || 0);
            const rram = d.renda_ram_gb || 0;
            sysLog('LIVE', 'CPU ' + cpu + '% / RAM ' + ram + '%');
            if (hudNode) { hudNode.textContent = L('sys.live'); hudNode.classList.add('online'); } hud.classList.add('rv-local-on');
            if (hudBar) { hudBar.style.width = '100%'; hudBar.style.background = 'var(--rv-green)'; }
            if (cpuNode) cpuNode.textContent = cpu + '% · R ' + rcpu + '%';
            if (ramNode) ramNode.textContent = ram + '% · R ' + rram + 'G';
            if (cpuBar) { cpuBar.style.width = cpu + '%'; cpuBar.style.background = color(cpu); }
            if (ramBar) { ramBar.style.width = ram + '%'; ramBar.style.background = color(ram); }
          } catch (_) { setOffline(); }
        },
        onerror: setOffline,
        ontimeout: setOffline
      });
    }
    tick();
    setInterval(tick, CONFIG.sysmonIntervalMs);
  }

  // v4.37.0 — TEMA HUD: 'auto' (urmeaza ChatGPT: clasa .dark pe <html>, altfel sistemul), 'dark', 'light'.
  // Alegerea se tine in localStorage; efectul e data-rv-theme pe <html> (CSS-ul HUD citeste doar atat).
  const THEME_KEY = 'rendaVigiliaTheme';
  function getThemePref() { try { const v = localStorage.getItem(THEME_KEY); return v === 'dark' || v === 'light' ? v : 'auto'; } catch (_) { return 'auto'; } }
  function setThemePref(v) { try { v === 'auto' ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, v); } catch (_) {} }
  function resolveTheme() {
    const pref = getThemePref();
    if (pref !== 'auto') return pref;
    const cl = document.documentElement.classList;
    if (cl.contains('dark')) return 'dark';
    if (cl.contains('light')) return 'light';
    try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (_) { return 'dark'; }
  }
  function applyTheme(hud) {
    // plasa: daca ChatGPT isi rescrie clasele de pe <html>, variabilele HUD (definite pe clasa asta) ar disparea
    if (!document.documentElement.classList.contains('renda-vigilia-theme')) document.documentElement.classList.add('renda-vigilia-theme');
    const mode = resolveTheme();
    if (document.documentElement.dataset.rvTheme !== mode) document.documentElement.dataset.rvTheme = mode;
    const b = hud && hud.querySelector('.rv-theme-btn');
    if (b) rvSetLabel(b, L('bar.theme', { mode: L('theme.' + getThemePref()) }));
  }
  function startTheme(hud) {
    applyTheme(hud);
    const b = hud.querySelector('.rv-theme-btn');
    if (b) b.addEventListener('click', () => {
      const order = ['auto', 'dark', 'light'];
      setThemePref(order[(order.indexOf(getThemePref()) + 1) % order.length]);
      applyTheme(hud);
    });
    // ChatGPT isi schimba tema punand .dark/.light pe <html>; urmarim doar atributul class (nu si data-rv-*)
    new MutationObserver(() => applyTheme(hud)).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme(hud)); } catch (_) {}
  }

  function startField(canvas) {
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 1;
    let height = 1;
    let frame = 0;
    let nodes = [];
    let last = 0;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const colors = ['55,138,221', '127,119,221', '120,190,235'];
    const colorsLight = ['31,111,209', '98,86,200', '32,128,190'];   // v4.37.0: pe alb, nuante mai inchise
    const isLight = () => document.documentElement.dataset.rvTheme === 'light';

    function resetNodes() {
      const count = Math.max(24, Math.min(52, Math.round(width / 36)));
      nodes = Array.from({length: count}, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - .5) * .045,
        vy: (Math.random() - .5) * .028,
        r: .7 + Math.random() * 1.35,
        phase: Math.random() * Math.PI * 2,
        color: colors[i % colors.length]
      }));
    }

    function resize() {
      cancelAnimationFrame(frame);
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      resetNodes();
      draw(performance.now(), true);
    }

    function draw(now, forced = false) {
      if (!forced && now - last < 32) {
        frame = requestAnimationFrame(draw);
        return;
      }
      const delta = last ? Math.min(50, now - last) : 16;
      last = now;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (!reduced) {
          a.x += a.vx * delta;
          a.y += a.vy * delta;
          if (a.x < -8) a.x = width + 8;
          if (a.x > width + 8) a.x = -8;
          if (a.y < -8) a.y = height + 8;
          if (a.y > height + 8) a.y = -8;
        }
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 105) {
            ctx.strokeStyle = isLight()
              ? `rgba(40,90,170,${((1 - distance / 105) * .24).toFixed(3)})`
              : `rgba(110,150,210,${((1 - distance / 105) * .14).toFixed(3)})`;
            ctx.lineWidth = .55;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        const glow = .38 + .28 * Math.sin(now / 820 + a.phase);
        const col = isLight() ? colorsLight[colors.indexOf(a.color)] || a.color : a.color;
        const gradient = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r * 4.5);
        gradient.addColorStop(0, `rgba(${col},${Math.max(.2, glow).toFixed(3)})`);
        gradient.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r * 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${col},${Math.min(1, glow * 1.7).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reduced && !document.hidden) frame = requestAnimationFrame(draw);
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && !reduced) frame = requestAnimationFrame(draw);
    });
  }

  function mount() {
    if (!document.head || !document.body) return;
    // linie de start MEREU vizibila: confirma ca scriptul s-a incarcat + ce transport foloseste
    // pentru serverul HUD local (asa se vede din prima daca extensia ruleaza si pe ce cale merge).
    const transport = (typeof GM_xmlhttpRequest === 'function' || (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function'))
      ? 'Tampermonkey (GM)'
      : (extRuntimeOk() ? 'extensie (background.js)' : 'LOCAL (fara server)');
    try { console.log('%c[RENDA HUD]', 'color:#378ADD;font-weight:600', 'v' + RUNNING_VER + ' pornit · transport HUD: ' + transport + ' · debug: ' + (RV_DEBUG ? 'ON' : 'OFF (localStorage.setItem(\'rvDebug\',\'1\')+refresh)')); } catch (_) {}
    document.documentElement.classList.add('renda-vigilia-theme');
    addStyle();
    findAndMarkRoot();
    const hud = createHud();
    renderBar(hud);

    let collapsed = false;
    try { collapsed = localStorage.getItem(STORAGE_KEY) === 'true'; } catch (_) {}
    setCollapsed(hud, collapsed);
    syncResponsiveLayout();

    hud.querySelector('.rv-collapse')?.addEventListener('click', () => {
      const next = document.documentElement.dataset.rvCollapsed !== 'true';
      setCollapsed(hud, next);
    });

    updateState(hud);
    setInterval(() => {
      updateState(hud);
      syncResponsiveLayout();
    }, 1000);
    addEventListener('resize', syncResponsiveLayout, {passive: true});
    addEventListener('online', () => updateState(hud));
    addEventListener('offline', () => updateState(hud));
    addEventListener('popstate', () => updateState(hud));
    startTheme(hud);
    startField(hud.querySelector('.rv-field'));
    startSysmon(hud);

    // v3.2: panou prompt perpetuu + sabloane
    const panel = buildPanel(hud);
    hud.querySelector('.rv-pp-btn')?.addEventListener('click', () => panel.classList.toggle('open'));
    const agPanel = buildAgentsPanel(hud);
    const settPanel = buildSettPanel(hud);
    const shknPanel = buildShknPanel(hud);   // v4.14: Shared HUMAN Knowledge
    hud.querySelector('.rv-ag-btn')?.addEventListener('click', () => {
      agPanel.classList.toggle('open');
      panel.classList.remove('open');
      settPanel.classList.remove('open');
      shknPanel.classList.remove('open');
    });
    hud.querySelector('.rv-shkn-btn')?.addEventListener('click', () => {
      shknPanel.classList.toggle('open');
      panel.classList.remove('open');
      settPanel.classList.remove('open');
      agPanel.classList.remove('open');
    });
    // v4.9.17: panoul SETT (API key + date proiecte/angajati VEGO)
    hud.querySelector('.rv-sett-btn')?.addEventListener('click', () => {
      settPanel.classList.toggle('open');
      panel.classList.remove('open');
      agPanel.classList.remove('open');
      shknPanel.classList.remove('open');
    });
    startApiAutoRefresh(settPanel);
    // v4.37.0: conexiunea RENDA + datele HUD de pe server (config + rolul propriu)
    // v4.47.0: la fiecare configuratie noua (sau alta organizatie) se redeseneaza tot: banda, cuvintele, panourile
    const rerenderAll = () => {
      renderBar(hud);
      renderOrg();
      renderConnChip();
      const day = hud.querySelector('.rv-day-btn');
      if (day) day.hidden = !RV_TEXTS.day_text;
      refreshLabels();
      refreshCanonBtn();
      [panel, settPanel, agPanel, shknPanel, document.getElementById(MIS_PANEL_ID)]
        .forEach((p) => { if (p && p.rvRender) p.rvRender(); });
    };
    // v4.37.0: indicatorul de conexiune din bara — "Conectat la RENDA · email" sau butonul de conectare
    const connChip = hud.querySelector('.rv-conn');
    function renderConnChip() {
      if (!connChip) return;
      if (!extAuthOn()) { connChip.hidden = true; return; }
      connChip.hidden = false;
      connChip.classList.toggle('off', !rvAuth.connected);
      // inainte de conectare extensia nu stie organizatia, deci nici cuvintele ei: butonul foloseste RV_PRE
      connChip.innerHTML = rvAuth.connected
        ? '<span class="rv-conn-dot" aria-hidden="true"></span><span class="rv-lbl">' + esc(L('conn.connected') || RV_PRE.connecting) + '</span>' + (rvAuth.email ? '<span class="rv-conn-em">' + esc(rvAuth.email) + '</span>' : '')
        : rvIcon('key') + '<span class="rv-lbl">' + esc(RV_PRE.connect) + '</span>';
      connChip.title = rvAuth.connected ? L('conn.connected_title') + (rvAuth.email ? ' · ' + rvAuth.email : '') : RV_PRE.connect_title;
    }
    // v4.47.0 (HUD-7): comutatorul de organizatie — apare cand contul e membru in mai multe. Alegerea pleaca in
    // background.js (headerul x-renda-tenant); datele organizatiei vechi se sterg din pagina si totul se reincarca.
    const orgSel = hud.querySelector('.rv-org');
    function renderOrg() {
      if (!orgSel) return;
      const show = hasApiAuth() && rvOrgs.length > 1;
      orgSel.hidden = !show;
      if (!show) return;
      orgSel.title = L('conn.org_title');
      orgSel.setAttribute('aria-label', L('conn.org_title'));
      orgSel.innerHTML = rvOrgs.map((o) => '<option value="' + esc(o.id) + '"' + (rvOrg && o.id === rvOrg.id ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('');
    }
    orgSel?.addEventListener('change', () => {
      const id = orgSel.value;
      if (rvOrg && id === rvOrg.id) return;
      extCall({ type: 'rv_set_org', org: id }, (r) => {
        applyAuth(r);
        resetHudData();
        settPanel.rvOnAuth();
        if (settPanel.rvReload) settPanel.rvReload();
      });
    });
    connChip?.addEventListener('click', () => {
      if (!rvAuth.connected) { if (settPanel.rvConnect) settPanel.rvConnect(connChip); return; }
      settPanel.classList.add('open');
      settPanel.querySelector('.st-config')?.classList.add('open');
      panel.classList.remove('open'); agPanel.classList.remove('open'); shknPanel.classList.remove('open');
    });
    settPanel.rvOnAuth = () => {
      if (!hasApiAuth()) resetHudData();
      renderConnChip();
      settPanel.rvRenderAuth();
      rerenderAll();
      loadHudRemote(rerenderAll);
    };
    dropLegacyPageSettings();
    // v4.9.30: cardul "Misiunea mea" — deschis implicit (inchiderea tine pana a doua zi);
    // emailul sesiunii se citeste async, apoi cardul se redeseneaza (pt. override individual)
    const misPanel = buildMissionCard(hud);
    hud.querySelector('.rv-mis-btn')?.addEventListener('click', () => misPanel.classList.toggle('open'));
    // v4.9.42: butonul "📅 Ziua mea" e DIRECT in HUD (mutat de pe card, la cererea userului):
    // insereaza in composer deschiderea de sesiune pentru organizarea zilei, cu numele
    // angajatului identificat completat automat
    const dayBtn = hud.querySelector('.rv-day-btn');
    dayBtn?.addEventListener('click', () => {
      const bt = findMyBoot();
      const nm = (bt && bt.n) || rvUserName || prettyNameFromEmail(rvUserEmail) || L('day.name_placeholder');
      const ok = insertIntoComposer(String(RV_TEXTS.day_text || '').split('{name}').join(nm) + '\n\n');
      rvSetLabel(dayBtn, L(ok ? 'common.inserted' : 'common.no_composer'));
      setTimeout(() => { rvSetLabel(dayBtn, L('bar.day')); }, 1200);
      rvlog('deschidere "ziua mea" ' + (ok ? 'inserata' : 'NEINSERATA — composer negasit'));
    });
    if (!misClosedToday()) misPanel.classList.add('open');
    fetchSessionEmail(() => { if (misPanel.rvRender) misPanel.rvRender(); });
    setInterval(autoInsertPerpetual, 1200);

    // v3.4: CANON per-tura — buton ⚖ ciclic FULL -> COMPACT -> OFF (persistat) + interceptarea trimiterii
    const canonBtn = hud.querySelector('.rv-canon-btn');
    function refreshCanonBtn() {
      const m = getCanonMode();
      if (canonBtn) {
        canonBtn.classList.toggle('on', m !== 'off');
        canonBtn.classList.toggle('compact', m === 'compact');
        canonBtn.innerHTML = rvIcon('canon') + '<span class="rv-lbl">' + esc(L('bar.canon')) + '</span><span class="rv-pill' + (m === 'off' ? ' off' : '') + '">'
          + esc(L('canon.pill_' + m)) + '</span>';
      }
      setCanonLine(hud, L('canon.line_' + m), true);
    }
    canonBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = {full: 'compact', compact: 'off', off: 'full'}[getCanonMode()] || 'full';
      setCanonMode(next);
      refreshCanonBtn();
    });
    refreshCanonBtn();
    wireCanonIntercept(hud);
    // v4.47.0: conexiunea si configuratia organizatiei pornesc ULTIMELE — fara extensie, raspunsul vine sincron,
    // iar redesenarea are nevoie de toate elementele benzii (butonul Canon, comutatorul) deja create
    refreshAuth(settPanel.rvOnAuth);

    const bodyObserver = new MutationObserver(() => {
      syncResponsiveLayout();
      updateState(hud);
    });
    bodyObserver.observe(document.body, {childList: true});

    startSkillLockdown();
  }

  // v4.9.4: LOCKDOWN SKILLS pe pagina nativa ChatGPT (/plugins). Ascunde din UI tabul "Skills"
  // si optiunile Download/Share/Uninstall din meniul "..." al fiecarui skill. Ascundere VIZUALA,
  // nu bariera de securitate: blocarea reala se face din admin-ul workspace OpenAI.
  function startSkillLockdown() {
    // etichete de ascuns in meniul "..." (engleza + romana). Meniul e considerat "de skill/plugin"
    // doar daca CONTINE Download/Uninstall — asa nu atingem meniul de share al unui chat obisnuit.
    const MENU_HIDE = ['download', 'share', 'uninstall', 'descarca', 'descarcă', 'distribuie', 'partajeaza', 'partajează', 'dezinstaleaza', 'dezinstalează'];
    const MENU_MARK = ['download', 'uninstall', 'descarc', 'dezinstal'];
    const TAB_HIDE = ['skills'];

    function hideTab() {
      // Ascunde TOT comutatorul Plugins/Skills (nu doar Skills). Il identificam sigur ca fiind
      // ancestorul apropiat al tabului "Skills" care contine SI un control "Plugins" — asa nu
      // atingem titlul mare "Plugins" (h1, nu e control) si nici linkul "Plugins" din sidebar
      // (departe in DOM). Daca nu gasim containerul, ascundem macar tabul Skills.
      const clickables = Array.from(document.querySelectorAll('button, a, [role="tab"]'));
      clickables.forEach((sk) => {
        if (sk.dataset.rvSkillLock || sk.closest('#' + HUD_ID)) return;
        if (!TAB_HIDE.includes((sk.textContent || '').trim().toLowerCase())) return;
        sk.dataset.rvSkillLock = '1';
        let node = sk;
        for (let i = 0; i < 5 && node.parentElement; i++) {
          node = node.parentElement;
          const hasPlugins = Array.from(node.querySelectorAll('button, a, [role="tab"]'))
            .some((c) => (c.textContent || '').trim().toLowerCase() === 'plugins');
          if (hasPlugins) { node.style.setProperty('display', 'none', 'important'); rvlog('lockdown: comutator Plugins/Skills ascuns'); return; }
        }
        sk.style.setProperty('display', 'none', 'important');
        rvlog('lockdown: tab Skills ascuns (container negasit)');
      });
    }

    function hideMenus() {
      document.querySelectorAll('[role="menu"]').forEach((menu) => {
        const items = menu.querySelectorAll('[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]');
        let isSkillMenu = false;
        items.forEach((it) => {
          const t = (it.textContent || '').trim().toLowerCase();
          if (MENU_MARK.some((w) => t.indexOf(w) !== -1)) isSkillMenu = true;
        });
        if (!isSkillMenu) return;
        let hid = 0;
        items.forEach((it) => {
          const t = (it.textContent || '').trim().toLowerCase();
          if (MENU_HIDE.some((w) => t === w || t.indexOf(w) !== -1)) { it.style.setProperty('display', 'none', 'important'); hid++; }
        });
        if (hid) rvlog('lockdown: meniu skill — ascunse', hid, 'optiuni (Download/Share/Uninstall)');
      });
    }

    // v4.47.0 (HUD-7): politica organizatiei (features.skill_lockdown), nu a extensiei
    function sweep() { if (!RV_FEATURES.skill_lockdown) return; try { hideTab(); hideMenus(); } catch (_) {} }
    let scheduled = false;
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => { scheduled = false; sweep(); }, 120);   // throttle: max ~8 treceri/sec
    }
    sweep();
    new MutationObserver(schedule).observe(document.body, {childList: true, subtree: true});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, {once: true});
  } else {
    mount();
  }
})();
