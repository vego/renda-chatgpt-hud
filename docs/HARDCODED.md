# Valori scrise direct în cod — inventar și sursă țintă

Stare la v4.37.0 (24.09.2026). `U` = `CHATGPT_RENDA_HUD.user.js`. Referințele sunt la nume de constante sau funcții,
nu la numere de linie, ca să nu se învechească.

**Sursă țintă:**
- **S2** = `GET /api/hud/me`, **S3** = `GET /api/hud/config`, **canon** = `GET /api/hud/canon`
  (vezi [SERVER_SPEC_HUD.md](SERVER_SPEC_HUD.md); Faza 8 pentru misiuni, boot general și canon)
- **cod** = rămâne în cod intenționat
- **setări** = `chrome.storage.local` (doar `rv_base`, din consola service worker-ului)

## 1. Seturi de date — toate scoase din cod

Din 24.09.2026 **niciun set de date al organizației nu mai stă în extensie**. Fiecare pornește gol și se
umple din RENDA după conectare, cu cache în extensie până la deconectare. Datele de pornire pentru server
sunt în pachetul de import `renda-hud-seed` (în afara repo-ului public).

| Constantă | Era (KB) | Conține | Sursă acum | În pachetul de import |
|---|---|---|---|---|
| `RV_BOOT` | 89 | registrul BOOT, 73 de angajați | S2 (doar rolul propriu) | `05_roluri` |
| `RV_SHKN` | 48 | 7 articole SHKN, cu autori | S3 `shkn` (articole CMS) | `04_shkn` |
| `RV_AGENTS` | 37 | 105 GPT-uri + 15 skills | S3 `agents` (gate-uri `chatgpt`) | `02_gates` |
| `RV_PLUGINS` | 20 | 139 de plugin-uri ChatGPT | S3 `plugins` | `02_gates/app.json` |
| `RV_TEZE` | 5 | Tezele VEGO | S3 `teze` | `03_doctrine` |
| `RV_BOOT_META` | 1,4 | modele de rol + pașii boot-ului | S3 `boot_meta` | `02_gates/role_model.json`, `03_doctrine` |
| `RV_MISSIONS` | 5 | 16 misiuni pe categorie | S3 `missions` (Faza 8) | `03_doctrine` |
| `MIS_MAP` | 1 | 23 de reguli funcție → categorie | S3 `mission_map` (Faza 8) | `03_doctrine` |
| `BOOT_EMBED` | 5,4 | blocul BOOT general (primul mesaj) | S3 `boot_block` (Faza 8) | `03_doctrine` |
| `CANON_EMBED` | 414 | 50 de reflexe, 699 de norme | canon (Faza 8), după serverul HUD local | `06_canon` |
| `CONFIG.azureTplDefault` | — | subscripția Azure | S3 `azure_tpl` | `01_config` |

Userscript-ul a scăzut de la ~835 KB la ~210 KB.

## 2. Adrese și identificatori

| Ce | Unde | Sursă țintă |
|---|---|---|
| `http://127.0.0.1:8765` (`sysmonUrl`, `canonUrl`), `http://localhost:8765/` | `U` `CONFIG` | cod (serverul HUD local) |
| `https://renda.holdings/api/sett/lists` | `U` `CONFIG.hudDataUrlDefault` | cod (la test local, `background.js` o mută pe `rv_base`) |
| `https://renda.holdings` (bază RENDA) | `background.js` `DEFAULT_BASE` | setări: `chrome.storage.local.rv_base` (doar din consola service worker-ului) |
| `ALLOWED`, `host_permissions` | `background.js`, `manifest.json` | cod: limită de securitate, nu se configurează la rulare |
| GitHub `virgilprofeanu/renda-chatgpt-hud` (`RAW_URL`, `@updateURL`, `$repoZip`, instalatorul) | `background.js`, `U`, `bootstrap.ps1`, `remote_install.bat` | cod |
| `D:\apps\renda-hud-chatgpt` | `bootstrap.ps1` | cod (convenția organizației) |
| rute ChatGPT (`/g/`, `/plugins/`, `/api/auth/session`, `CONFIG.links`) | `U` | cod |

## 3. Texte și prompturi

`TEMPLATES` (6), `RV_BOOT_FOOTER`, `RV_DAY_TEXT`, textul din `shknWrap`, directiva `RENDA::ACK` pentru plugins,
markerii `CANON_MARK` / `BOOT_MARK` / `ENV_END`, `PREAMBLE` (nefolosit din v4.27), `RV_SYN` (23 de grupuri de sinonime),
`RV_STRATA`, listele de detectare a limbii, etichetele din `startSkillLockdown`.

**Sursă țintă:** cod, prin decizie (24.09.2026). Sunt texte de interfață și protocol, versionate odată cu
codul care le folosește: cele 6 șabloane ⚡ Prompt, fraza de final a boot-ului, textul „Ziua mea”,
preambulul SHKN.

## 4. Chei în `localStorage` (pagina chatgpt.com)

`rendaVigiliaHudCollapsed`, `…PerpetualPrompt`, `…ApiData`, `…MisFunctie`, `…MisInchisAzi`, `…UserEmail`,
`…UserName`, `…CanonOn`, `…UserDirective`, `…SessionIdentity`, `rendaVigiliaTheme` (auto/dark/light), `rvBootIdent`, `rvDebug`.
Șterse la pornire (nu se mai folosesc): `…ApiKey`, `…ApiUrl`, `…AzureTpl`, `…BootSel`.

În extensie (`chrome.storage.local`): `rv_api_key`, `rv_user`, `rv_key_when`, `rv_key_via`, `rv_base`,
`rv_cache:<cale>`, `rv_code`, `rv_ver`, `rv_when`.

## 5. Timpi

Sysmon 2 s; timeout-uri 1,5 s (punte), 0,9 s (canon), 8 s (API); reîmprospătare date 10 min; config S3 60 min; canon 24 h;
rol S2 10 min; reîncercare identitate ChatGPT 3 × 12 s; cache canon 20 s; întârziere înainte de trimitere 140 ms;
alarmă background 1 min; GitHub cel mult la 10 min. **Sursă țintă:** cod.

## 6. Selectori ChatGPT (se strică atunci când OpenAI schimbă interfața)

`#prompt-textarea`, `button[data-testid="send-button"]`, `#composer-submit-button`, `[data-message-author-role]`,
`#__next` / `[data-testid="app-root"]` / `main`, `[data-testid*="profile|account"]`, meniurile `[role="menu"]`.
**Sursă țintă:** cod. Merită grupați într-o singură constantă `SEL`, ca o schimbare de UI să se repare într-un loc.
