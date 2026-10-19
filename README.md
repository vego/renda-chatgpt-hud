# RENDA VIGILIA HUD pentru ChatGPT — Extensie Chrome (MV3)

Userscript-ul `CHATGPT_RENDA_HUD.user.js` este **universal**: același fișier rulează
și în Tampermonkey, și ca extensie Chrome. Ca extensie, se **autoactualizează singură
din GitHub, pur în browser** (prin `chrome.userScripts`) — fără scheduled task, fără
PowerShell, cross-platform.

## Structură

| Fișier | Rol |
|---|---|
| `CHATGPT_RENDA_HUD.user.js` | **Unicul fișier de întreținut.** Codul HUD. În pachet e doar „sămânța" primei rulări; după aceea versiunea vie stă în `chrome.storage` și se actualizează din GitHub |
| `background.js` | Service worker, trei roluri: (1) conexiunea la RENDA: ține cheia API și o atașează cererilor spre RENDA; (2) proxy spre serverul HUD local `127.0.0.1:8765` și spre RENDA (echivalentul `GM_xmlhttpRequest` + `@connect`); (3) la 10 min aduce userscript-ul de pe GitHub și, dacă `@version` e mai nou (semver), îl re-înregistrează prin `chrome.userScripts` — niciodată downgrade |
| `manifest.json` | MV3 HIBRID: **`content_scripts` injectează direct `CHATGPT_RENDA_HUD.user.js`** (baza garantată — merge pe Chrome și Edge fără nicio setare) + permisiuni `userScripts`, `alarms`, `storage` pentru stratul opțional de auto-update și `identity` pentru conectarea la RENDA; `host_permissions` pe `chatgpt.com`, `127.0.0.1:8765`, `localhost:8765`, `renda.holdings` și `raw.githubusercontent.com` |
| `bootstrap.ps1` + `remote_install.bat` | Instalarea „de la zero", dintr-un singur fișier: descarcă repo-ul ca ZIP (fără git), îl pune în `D:\apps\renda-hud-chatgpt`, copiază calea în clipboard și deschide `chrome://extensions`. NU instalează niciun task; dacă găsește task-ul VECHI de update (de la instalările inițiale), îl șterge automat |
| `icon128.png` | Iconul oficial RENDA |
| `CHANGELOG.md` | Istoricul versiunilor (mutat din antetul userscript-ului la v4.37.0) |
| `tests/` | Teste `node --test` (fără dependențe): integritatea pachetului și `background.js` cu `chrome` simulat |
| `docs/SERVER_SPEC_HUD.md` | Ce îi trebuie serverului RENDA pentru conectare și pentru datele HUD |
| `docs/HARDCODED.md` | Inventarul valorilor scrise direct în cod și sursa în care ar trebui să stea |

## Instalare

### Cea mai simplă (un fișier, de trimis colegilor)

Dublu-click pe **`remote_install.bat`** → descarcă extensia în `D:\apps\renda-hud-chatgpt`
și deschide Chrome. Apoi, în Chrome:

1. Pornește **Developer mode** (dreapta-sus)
2. **Load unpacked** → Ctrl+V în bara de cale → Enter → *Select Folder*
3. Gata — HUD-ul pornește **fără nicio altă setare** (baza = `content_scripts`).
   *Opțional*, pe Chrome/Edge 138+, **„Allow user scripts"** pe cardul extensiei pornește
   auto-update-ul din browser. Fără comutator, versiunile noi vin rulând din nou `remote_install.bat`
   (apoi Reload pe cardul extensiei).

Apoi deschide chatgpt.com — banda HUD apare sus. Cine folosea userscript-ul în
Tampermonkey trebuie să-l **dezactiveze** (altfel rulează ambele).

### Din arhiva ZIP trimisă manual

Dezarhivezi într-un loc stabil, apoi aceiași pași din Chrome (Developer mode →
Load unpacked; „Allow user scripts" rămâne opțional, doar pentru auto-update).

## Conectare la RENDA

Conectarea are un singur drum: butonul **„Conectează-te la RENDA”** din dreapta barei HUD (sau din
panoul **Proiecte → ⚙ Conexiune**) deschide RENDA într-o fereastră. Când ești conectat, în același loc
apare „Conectat la RENDA · email”.
Te autentifici (Microsoft sau parolă) și apeși **Connect**. Cheia API se salvează direct în extensie,
fără nimic de copiat. Fluxul e „connect device” v2: RENDA întoarce un cod de unică folosință, pe care
extensia îl schimbă pe cheie cu PKCE, deci cheia nu apare niciodată într-o adresă. Cheia apare în
contul RENDA cu numele „RENDA HUD pe Chrome” și se revocă de acolo („Cheile mele”).

- Cheia stă doar în extensie (`chrome.storage.local`); pagina chatgpt.com nu o vede.
- **Nu există cheie lipită manual.** Setările vechi din pagină (cheia, URL-ul, șablonul Azure) se șterg
  la prima pornire, iar o cheie care n-a venit prin buton se șterge și din extensie.
- Butonul cere pe server Faza 2 din [docs/SERVER_SPEC_HUD.md](docs/SERVER_SPEC_HUD.md), deployată.

### Ce vine din RENDA și ce e în cod

**Extensia nu mai conține date ale organizației.** După conectare, totul vine din RENDA și rămâne în
cache până la „Deconectează”:

| Din RENDA | Rută |
|---|---|
| rolul, misiunea, modelul de rol și boot-ul personal | `/api/hud/me` |
| agenții GPT, skills, plugin-urile, SHKN, Tezele VEGO, modelele de rol, pașii boot-ului, misiunile pe categorie, blocul BOOT general, șablonul Azure | `/api/hud/config` |
| canonul (rezervă când serverul HUD local e oprit) | `/api/hud/canon` |

Fără conectare, panourile Agenți, SHKN, Misiune și tab-ul Misiuni arată „Conectează-te la RENDA”, iar
primul mesaj pleacă fără bloc BOOT. **În cod rămân** doar textele de interfață: cele 6 șabloane Prompt,
textul „Ziua mea”, fraza de final a boot-ului și preambulul SHKN.

**Release:** varianta aceasta se publică doar după ce serverul RENDA are fazele 1–8 deployate și datele
importate (pachetul `renda-hud-seed`). Altfel colegii văd panourile goale.

- În Tampermonkey nu există conectare, deci nici date.
- Userscript-ul nou poate sosi prin auto-update peste un `background.js` vechi. În acest caz, panoul cere
  instalarea pachetului nou.

## Tema: închisă / deschisă

Butonul **Temă** din bara HUD trece prin **auto** → **închisă** → **deschisă**. Pe *auto*, HUD-ul urmează
tema ChatGPT (și se schimbă odată cu ea). Alegerea se ține în browser (`rendaVigiliaTheme`). Tema schimbă
doar HUD-ul și panourile lui; pagina ChatGPT rămâne pe tema ei. Câmpul de stele din bară își adaptează
culorile. Macheta: artefactul „RENDA HUD — redesign light/dark”.

**Aspectul (v4.37.0, după machetă, cu fontul de dinainte):** bara pe două rânduri peste câmpul de stele
(identitate · titlu · CPU/RAM/ceas; apoi pagini · Prompt, Agenți, SHKN, Proiecte, Misiune, Ziua mea,
Canon cu starea lui · conexiunea la RENDA · Temă), iconițe în locul emoji-urilor, cardul „Misiunea mea”
cu inițiale, fișa pe două coloane și butoanele principale colorate.

## Teste

```
node --test
```

Fără `npm install`. Verifică pachetul (manifest, versiuni, fișiere, că nu intră date ale organizației
în cod, tema) și `background.js` (conectare, proxy, cache).

## Cum funcționează auto-update-ul (pur în browser)

`background.js` verifică GitHub la 10 minute (`chrome.alarms`). Dacă `@version` de
acolo e mai nou decât cel din `chrome.storage`, descarcă noul cod și îl
re-înregistrează cu `chrome.userScripts.update()`. Codul nou se aplică la
**următorul refresh** al paginii chatgpt.com. Nimic nu se scrie pe disc, nimic din
afara browserului. O gardă refuză userscript-uri fără puntea de extensie și orice
versiune care nu e strict mai nouă (fără downgrade).

**Capcană de reținut** (ne-a costat o zi de depanare): `chrome.userScripts`
acceptă `register()` cu orice `matches` **fără eroare**, dar injectează DOAR pe
site-urile pentru care extensia are `host_permissions` în manifest. De aceea
`https://chatgpt.com/*` și `https://chat.openai.com/*` TREBUIE să rămână în
`host_permissions` — fără ele, totul pare că merge (înregistrare OK, zero erori)
dar scriptul nu rulează niciodată în pagină.

## Fără comutator: actualizare prin reinstalare

Extensia nu mai folosește niciun task Windows. Fără „Allow user scripts", HUD-ul rulează versiunea din
pachet; pentru una nouă se rulează din nou `remote_install.bat`, apoi Reload pe cardul extensiei, în
fiecare browser. Tab-urile ChatGPT deja deschise cer un F5.

## De ce HIBRID: `content_scripts` CA BAZĂ + `chrome.userScripts` ca strat de update?

Lecția din 2026-07-24: o versiune doar-pe-`userScripts` **nu pornea deloc** fără
comutatorul „Allow user scripts" (Chrome/Edge 138+) — adică cerea o setare de
browser doar ca să existe. Inacceptabil ca bază.

- **`content_scripts`** (fișierul din pachet) = **baza garantată**: se injectează pe
  orice Chrome/Edge, la instalare curată, zero setări. Userscript-ul e
  dual-environment din v4.9.3 (`extHudRequest` vorbește cu `background.js` când
  `GM_xmlhttpRequest` nu există), deci același fișier merge nemodificat.
- **`chrome.userScripts`** = **stratul opțional**: o extensie unpacked nu-și poate
  rescrie fișierele de pe disc, dar `userScripts` înregistrează cod **dintr-un
  string** ținut în `chrome.storage` → auto-update pur în browser. Se activează
  DOAR dacă userul pornește comutatorul; `background.js` înregistrează exclusiv
  versiuni **strict mai noi** decât sămânța din pachet.
- O **gardă anti-dublă-montare** (atribut `data-rv-hud-loaded` pe `<html>`,
  test-and-set sincron) garantează o singură instanță indiferent câte rute rulează.
- Limită cunoscută (declarată onest): când baza câștigă cursa de injectare,
  versiunea nouă din storage nu se vede în acel tab — updater-ul devine efectiv la
  refresh-ul următor sau la actualizarea pachetului. Niciodată HUD dublu, niciodată
  HUD lipsă.

Poarta de release **G9** (`hud_release.py`) face regresia imposibilă prin
construcție: niciun release nu trece fără `content_scripts` valid, cu fișierul
referit prezent în HEAD, inclus în pachet și purtând capabilitățile dual-env.
Codul încărcat de la distanță rămâne nepublicabil în Chrome Web Store (pentru
distribuție unpacked/internă e în regulă).

## Flux de release (un singur pas)

Editează `CHATGPT_RENDA_HUD.user.js`, incrementează `@version`, commit + push în
`main`. Userii de Tampermonkey primesc update-ul prin `@updateURL`; userii de
extensie prin `background.js` (max ~10 min). Recomandat: ține și `"version"` din
`manifest.json` la aceeași valoare (cosmetic).

## Confidențialitate

Trafic: GET către `127.0.0.1:8765` (serverul HUD local, dacă există; `background.js` refuză orice
alt URL local), `renda.holdings` (date HUD, doar cu contul conectat) și `raw.githubusercontent.com`
(descărcarea versiunilor noi). Cu ⚖ Canon pornit, textul din composer (primele 2000 de caractere) merge
la serverul HUD local pentru selecția canonului, iar HUD-ul adaugă blocul de canon și, la primul mesaj,
BOOT-ul în mesajul trimis. Conversațiile nu pleacă spre RENDA.
