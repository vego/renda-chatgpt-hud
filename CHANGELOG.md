# Istoricul versiunilor — RENDA VIGILIA HUD

Mutat din antetul `CHATGPT_RENDA_HUD.user.js` la v4.37.0 (era ~40 KB de comentarii încărcate în fiecare tab).
Cele mai noi versiuni sunt primele. Nota pentru v4.37.0 e în antetul fișierului și aici.

```text
v4.47.0 (2026-10-19): COMBINARE — linia locala v4.37.0 (conectare RENDA, date din /api/hud/*, tema deschisa/inchisa) peste
v4.46.0 de pe GitHub (Virgil Profeanu). Din 4.36.3–4.46.0 raman in cod: reparatiile de layout pentru noul ChatGPT (Chat | Work,
composer ProseMirror, capsula Chat/Work sub HUD), cautarea noua (inceput de cuvant, sinonime EN, taguri), tab-ul Skills & Plugins pe
comenzi de invocare (k), SHKN cu numarul fisei si "Propune o fisa noua", sabloanele Prompt pe grupuri. NU raman in cod: fisele SHKN
0008–0101, inventarul de 252 de comenzi, BOOT v6.3 — merg in pachetul de import (seed) si pe server. Fara auto-update pe disc
(update.ps1, version.txt si scripturile de Mac scoase, ca in v4.37.0): actualizarile vin din Chrome Web Store.

Versiunile de pe GitHub dintre v4.36.2 si v4.46.0 (din mesajele de commit):
  2026-09-25 · v4.36.3 — compatibilitate cu noul layout ChatGPT: selectorul Chat/Work nu mai e acoperit de HUD
  2026-09-25 · v4.36.4 — compatibilitate cu composer-ul nou ChatGPT (Chat | Work, 2026-09): bootul si canonul se injecteaza din nou
  2026-09-25 · Suport Mac (Chrome si Edge): install-mac.sh, update-mac.sh, opreste-auto-update-mac.sh + README + update.ps1
  2026-10-11 · v4.36.5 — SHKN: 13 fise noi (0008–0020: suita mediu-ape v2 001–005 + 8 resurse din resurse_prompturi_gpt.zip), antete curatate (EDITIE, titluri, operator, caz, taguri ≤ 30), corpuri verbatim; ACT-0074 + ACT-0076 sigilate 11.10.2026
  2026-10-11 · v4.36.6 — SHKN: antetele fiselor 0001–0007 curatate (taguri 30 alese la 0001/0003/0004, titluri scurte la 0006/0007, EDITIE cu istoricul publicarii), corpuri neatinse; la cuvantul proprietarului (ACT-0076 §2)
  2026-10-12 · v4.36.7 — BOOT v6.3: IRS4T la livrabilele cu mandat, linia de apelare a pluginului TrA[I]nsDoing, RENDA Packages apelat cu @ (scenarii, incheiere, recolta), continuitatea cu IRS4T; validat de proprietar 12.10.2026
  2026-10-12 · v4.36.8 — SHKN: fisa 0021, promptul de activare a recoltei automate prin RENDA Packages (validat de proprietar 12.10.2026)
  2026-10-12 · v4.36.9 — SHKN: fisele 0022 (prompt de consiliere cu Sfatuitorul VEGO) si 0023 (prompt de coaching cu OMNIA), textele proprietarului verbatim
  2026-10-12 · v4.37.0 — SHKN: 77 de fise noi (0024–0100) din ghidul «De la cerere la livrabil», editia 2.0: prompturile P01–P60 si P84–P100, corpurile la octet; fisele 0001–0023 neatinse
  2026-10-13 · v4.38.0 — SHKN: fisa 0101 (promptul general V6 de corectare nedistructiva a studiilor, Mihaela Ceptureanu, verbatim) + numarul fisei pe card si in cautare; fisele 0001–0100 neatinse
  2026-10-14 · v4.39.0 — SHKN: 15 fise noi (0102–0116) scoase din fisa 0101 (promptul general V6, Mihaela Ceptureanu), editia 2 a 9 fise din ghid, ordinea panoului la procent egal
  2026-10-14 · v4.40.0 — SHKN: butonul «Propune» (colegii trimit fise adaptate sau noi printr-un fisier descarcat, fara retea si fara AI)
  2026-10-14 · v4.41.0 — Sabloane RENDA in setari: 16 sabloane pe momente (inceput, in lucru, conversatie lunga, final), fiecare cu fraza omeneasca si randul RENDA:: (TrAInsLingua)
  2026-10-15 · v4.42.0 — Sabloane RENDA: grupa «zbateri» (5 sabloane pe forma canonica TrA[I]nsUni[Activity], randul RENDA::UNIACTIVITY)
  2026-10-15 · v4.43.0 — Skills & Plugins din inventarul ChatGPT (15.10.2026): 252 de comenzi de invocare
  2026-10-15 · v4.44.0 — Skills & Plugins: sinonime si taguri
  2026-10-15 · v4.44.0 — cautarea: inceput de cuvant si trei litere exacte
  2026-10-16 · v4.45.0 — Sablon nou S22: IRS4T + DoD canonic, din ce cer in cuvintele mele
  2026-10-16 · v4.45.0 — S22: pluginul nu se reincarca daca e activ; se incarca numai ce lipseste
  2026-10-16 · v4.45.0 — S22: locul de scris cu marcajul ..¿ ?.. (nevoia, livrabilul sau partea de livrabil)
  2026-10-16 · v4.45.0 — S22 pe prima pozitie, la inceput, deasupra «Disciplina RENDA»
  2026-10-16 · v4.46.0 — Sablon nou S23: DoD pentru o modificare pe ceva care exista (pozitia a doua)

v4.37.0 (2026-09-23): CONECTARE LA RENDA + date de pe server. (1) Buton "🔑 Conecteaza-te la
RENDA" in ⚙ SETT: device-connect v2 — callback https://<id>.chromiumapp.org/ prins de
chrome.identity, intoarcere cu COD DE UNICA FOLOSINTA schimbat pe cheie cu PKCE (Faza 2 din
docs/SERVER_SPEC_HUD.md; cheia nu apare niciodata in URL); cheia rk_ sta DOAR in
background.js (chrome.storage.local), nu mai ajunge in localStorage-ul paginii — cheia veche se
muta automat. Puntea ataseaza singura Bearer spre RENDA (reparat: headerele erau aruncate).
(2) /api/hud/config (agenti, plugins, misiuni, teze, SHKN, sablon Azure) si /api/hud/me
(rolul + boot-ul contului + modelul de rol) inlocuiesc datele din pachet cand exista; altfel
raman embed-urile. boot_meta se aplica pe bucati (models / steps), ca un raspuns partial sa nu
stearga modelele de rol.
(3) Auto-update-ul pe disc (task Windows + update.ps1) eliminat. (4) Un singur drum de conectare
(butonul); fara cheie lipita manual, setarile vechi din pagina se sterg. (5) B4: registrul BOOT
(73 de angajati) scos din pachet — cardul "Misiunea mea" arata rolul DOAR dupa conectare.
(6) NICIO data a organizatiei in cod: SHKN, agenti, plugins, teze, modele, misiuni pe categorie,
tabelul functie->categorie, blocul BOOT general, sablonul Azure si canonul vin din RENDA
(/api/hud/config + /api/hud/canon), cu cache pana la deconectare. In cod raman doar textele de
interfata (sabloanele Prompt, Ziua mea, fraza de final a boot-ului, preambulul SHKN). 830 KB -> 210 KB.
v4.15.0 (2026-07-25, unificare Electron, decizie autor): acest fisier devine banda COMUNA a doua
gazde — Chrome (content_script, neschimbat) si HUD Electron (pages/gpt.html il ia de la
GET /hud_userscript si il injecteaza in webview-ul persist:gpt cu executeJavaScript; IIFE +
garda data-rv-hud-loaded fac re-injectia inofensiva). Un singur cod => identitate prin
constructie (AX.4). + garda window.__rvAutoBypass in handleAttempt: apelul AUTOMAT
(renda_gpt.py/GPTI) NU primeste canonul — canonul ramane pe trimiterea manuala (D2 Virgil
2026-07-25, comutabil); in Chrome flagul e inert (nimeni nu-l seteaza).
v4.14.0 (2026-07-25, cerinta autor): SHKN — SHARED HUMAN KNOWLEDGE. Buton nou 📚 SHKN in nav +
panou-biblioteca de experienta umana TESTATA (oamenii trimit catre Virgil, Virgil incarca in
SHKN/ITEMS/*.md; build_shkn_data.py coace itemii intre markerii RENDA_SHKN_DATA, cu 20-30
taguri per item — manuale + auto-derivate). Cautarea = "spune nevoia ta": potrivire PROCENTUALA
(taguri 1.0 > titlu 0.9 > corp 0.5), rezultate ordonate descrescator, % afisat in dreapta.
[👁 Vezi] deschide continutul in panou; [📋 Copiaza] pune in clipboard knowledge-ul INCAPSULAT
(shknWrap, EN): "knowledge din experienta umana; skill-urile se pot schimba — pastreaza ideea
generala si construieste-ti propriul scenariu pe cererea userului" + proprietate VEGO/RRC.
Primul item: 0001 jurnalul 4084 (calcul structural din planse PDF).
v4.13.3 (2026-07-25, decizie autor): BOOT v2.1-derivat EN — sectiunea [CONTINUUM ACTIVATION]:
la primul raspuns, instanta INCEARCA activarea RENDA CONTINUUM prin skill-ul instalat
`start-continuum` (comanda canonica RENDA::START_CONTINUUM, textul autorului VERBATIM: rezolvare
dupa numele canonic din frontmatter, un singur match verificat, Series A P01-P10 -> Canon Memory
-> Series B on-demand, READY doar dupa checks, NACK cu motiv exact). FAIL-OPEN: skill negasit /
activare esuata -> pills: NO in marker si LUCREAZA MAI DEPARTE sub protocol — nu se opreste,
nu fabrica READY/chitante. pills: YES doar dupa READY real.
v4.13.2 (2026-07-25, decizii autor): BOOT v2.0-derivat EN — cadrul fix trece in ENGLEZA (masurat
cu tokenizerul GPT o200k: -12.7% tokeni pe traducerea pura; -7.6% net cu tot cu sectiunea noua),
semnal de meta-nivel (rama EN, conversatia in limba userului; omogen cu [SESSION] si [CANON RENDA]
care erau deja EN). Tezele VEGO raman VERBATIM in romana (text canonic citat). + sectiunea
[LICENSE]: totul ruleaza sub cadrul RENDA RESEARCH CENTER — skills/pills/knowledge = componente
RENDA licentiate, iar orice output produs cu ele = proprietatea VEGO / RENDA RESEARCH CENTER,
fara drept de extragere/reutilizare in afara VEGO.
v4.13.1 (2026-07-25, decizii autor): BOOT v1.2-derivat — (1) [SCOPE GUARD] limitativ INLOCUIT cu
[POSIBILITATI — fara limitari artificiale]: orice sarcina (calcul, solutionare, proiectare) e
permisa cat timp foloseste instrumente/skill-uri/knowledge ADECVAT si ramane AUDITABILA; unde
legea cere asumare atestata, lucrarea se produce complet si se marcheaza pasul de asumare umana.
(2) [LANSAREA DE BOOT]: primul raspuns al conversatiei incepe OBLIGATORIU cu lansarea de boot
(marker + scop + teze + ce aduce), INDIFERENT ce a scris userul; abia apoi se trateaza mesajul.
v4.13.0 (2026-07-24, decizii autor): (1) SELECTOR PE STRATURI — canonul per-tura trage CATE O
NORMA DIN FIECARE din cele 7 straturi (axioma/postulat/protocol/idee-forta/idee_forta_autor/
axioma_proprie/cod_sophailo), 7/tura; ROTATIA PE ZI = ELIMINATA (acoperire garantata a tuturor
categoriilor, nu emergenta); oglinda exacta a pick_norme din vigilia_router (zero drift; server-ul
schimbat in acelasi timp). (2) BOOT v1.1-derivat: introducerea subtiata; [IDENTITATE] persoana ->
[SCOP — pe cine servesti]: scopul VEGO + RENDA RESEARCH CENTER + implicit Virgil Profeanu (omul si
GPT-ul lucreaza PENTRU VEGO); + [TEZELE VEGO] verbatim (T1 interesul VEGO primeaza · T2 deadline
si bugete · T3 comunicare pe orizontala si verticala).
v4.12.3 (2026-07-24): ARHITECTURA HIBRIDA restaurata dupa regresia 805dcf7 (care scosese
content_scripts => extensia cerea comutatorul "Allow user scripts" ca sa porneasca deloc).
Baza garantata = content_scripts injecteaza DIRECT userscript-ul (dual-env din v4.9.3), zero
setari de browser, Chrome+Edge; userScripts = strat OPTIONAL doar pt auto-update (se inregistreaza
numai la versiune strict mai noua). Garda anti-dubla-montare eticheteaza ruta (CS-/US-/TM) in
data-rv-hud-loaded + log discret la cedare. Puntea background accepta si https://renda.holdings
(pe ruta content-script apiFetch alege puntea, iar fara adresa in ALLOWED cererile mureau tacut).
Release-gate: poarta G9 (anti-regresie content_scripts) + verificare dual-env fail-closed.
v4.12.2 (2026-07-24): carcasa aliniata — manifest.version = versiunea userscript (numarul de pe cardul
chrome://extensions devine cel real); BUILD_STAMP restampilat; fara schimbari de cod HUD.
v4.12.1 (2026-07-24): fallback-ul LOCAL primeste lang_swap + dedup pe unitate (oglinda serverului):
rvDetectLang (RO implicit / EN / LA>=3 markeri) + rvLangSwapDedup — corpusul trilingv se serveste
in limba promptului si o unitate apare o singura data per tura, SI cand HUD-ul e offline.
v4.12.0 (2026-07-24): CORPUS COMPLET + NOTA DE GUVERNARE + ACTIVATORI. (1) Pool 699 norme:
141 EL_EA_T + 55 axiome proprii (publice) + 146 IDEI-FORTA AUTOR (corpus curat RO, IFA-*)
+ 357 CODURI SoPh[A]iloTechnoLogy (7 manifeste x 17 coduri x 3 limbi EN/RO/LA — o intrare
per limba; tagurile fiecarei limbi => scrii engleza, tragi varianta EN; activarea pe limba
vorbita). (2) GOVERNANCE NOTE in PREAMBLE: straturile [AX-RENDA-*]/[IFA-*]/[FC..TCR-*] NU
se carantineaza de guvernorul CANON al GPT-urilor (pot lipsi din registrul instalat) — sunt
canon RENDA corelat cu pastilele; PRECEDENTA: pills instalate > add-on; R01 > tot. (3) Linia
NORMA poarta activatorii: strat · lang · pills (pastila corelata, numita explicit). (4)
/canon_select trece pills/strat/lang + dedup pe unitate (o singura limba per cod per tura).
Sursele canonice: IDEI_FORTA_AUTOR_RO_v2.txt + CORPUS_TRILINGV_119_v2.md + _PILLS_IDEI_FORTA.json
(sidecar activatori) in EL_EA_T; generatorul pool_norme.py le include la orice regenerare.
v4.11.0 (2026-07-23): + CANON PUBLIC — CANON_EMBED regenerat din pool-ul viu: stratul
axioma_proprie trece de la 2 axiome cu text intern la 55 de axiome in FORMA PUBLICA
(de-sensibilizate: fara coduri de proiect / nume / ancore de fisiere; verbatimul ramane
DOAR local, in AXIOME_PROPRII formula_sursa). Fiecare axioma poarta si "pills" —
activatorii pastilelor corelate (P01-P31) — temelia stratului de activare pe sens.
Total norme in embed: 196 (141 EL_EA_T + 55 axiome proprii publice).
v4.11.0 (2026-07-23): RECONCILIERE — linia 4.9.45 (panoul SETT + API renda.holdings,
cardul "Misiunea mea" per-angajat, Tezele VEGO, butonul "Ziua mea", registrul de boot
73 angajati, directive ACK plugins) UNITA cu BOOT DE IDENTITATE din 4.10.0 (bloc ALTER_EGO
PROTOCOL + VIGILIA NUCLEU inserat automat la primul mesaj, gate ⚖ Canon + rvBootIdent).
Ambele linii porneau din baza comuna 4.9.16; codul BOOT s-a altoit curat peste 4.9.45
(singurul conflict = antetul de changelog, rezolvat aici). Nimic pierdut din niciuna.
v4.10.0 (2026-07-23): BOOT DE IDENTITATE (Calea C, cerere autor) — la PRIMUL mesaj dintr-o
conversatie NOUA (zero [data-message-author-role] in DOM la momentul trimiterii), blocul
ALTER_EGO PROTOCOL + VIGILIA NUCLEU (embedat, derivat din S33/ALLINONE 2026-07-23, zero secrete)
se insereaza O DATA in CAPUL mesajului; canonul per-tura continua neschimbat la finalul lui.
Oglinda mecanica a hook-ului SessionStart de pe masina: strat 1 = corpul (boot), strat 2 =
condimentul (reflexe/norme per prompt). Gated de butonul ⚖ Canon + localStorage 'rvBootIdent'
('off' = doar canon per-tura, fara boot). Marker anti-dubla-injectie: 'RENDA_BOOT_CHATGPT';
proba auditabila = raspunsul modelului trebuie sa inceapa cu [BOOT-CHATGPT]. Linia de stare
arata '+BOOT' cand blocul a intrat. Actualizarea blocului embedat = regenerare din S33 (SSOT
= canonul local; aceasta e reprezentare derivata, P03).
v4.9.45 (2026-07-21): registrul de boot REIMPROSPATAT din XLSX (snapshot 2026-07-21):
aceiasi 73 de angajati; 4 schimbari de coordonator. Nota: antetul coloanei 5 din XLSX a
devenit "ca" (probabil accidental) —
valorile diviziunilor sunt insa intacte si extractia se face pe pozitie, nu pe antet.
v4.9.44 (2026-07-18): directiva de plugin schimbata in formatul ACK complet (cerut de
user): RENDA::ACK(plugin_id=<NUME>;activation=COMMITTED;scope=current_request;persist=
current_session;reuse=if_relevant;state=READY_AWAITING_INPUT;reconfirmation=NOT_REQUIRED;
execution=CONTINUE_IF_ACTIONABLE;missing_data_policy=ASK_ONLY_IF_BLOCKING;
input=AWAITING_ARTIFACT;mutation=NONE) — la click pe nume (composer) si la 📋 (clipboard).
v4.9.43 (2026-07-17): DIRECTIVA DE ACTIVARE la plugins (tab-ul Skills & Plugins):
click pe NUMELE pluginului insereaza in composer, iar butonul 📋 (redenumit "activare")
copiaza: RENDA::ACTIVATE(plugin=<NUME>;scope=current_request;persist=current_session;
reuse=if_relevant). Numele pluginului e clicabil (hover amber + underline).
v4.9.42 (2026-07-17): butonul "📅 Ziua mea" MUTAT de pe cardul 🎯 DIRECT in bara HUD
(langa "🎯 Misiune") — un click insereaza in composer deschiderea de sesiune pentru
organizarea zilei, cu numele completat automat; cardul ramane doar cu ⤵/📋 pentru boot.
v4.9.41 (2026-07-17): buton nou "📅 Organizeaza-mi ziua" pe cardul 🎯 (sub butoanele de
boot): insereaza in composer deschiderea de sesiune pentru organizarea zilei — "In aceasta
sesiune ma vei asista pe mine, <NUME>, ca sa imi organizez ziua in concordanta cu Misiunea
mea si cu Tezele VEGO. Eu iti spun aici cam la ce lucrez, tu ma ajuti sa planific, iar
seara ma ajuti sa raportez." — cu numele angajatului completat AUTOMAT din identitatea
detectata. Se combina natural cu "⤵ In composer" (boot+teze) inserat inainte.
v4.9.40 (2026-07-17): eliminata COMUTAREA de pe cardul 🎯, la cererea userului: au disparut
butoanele "schimbă categoria…" si "alt angajat…" (cu tot cu vizualizarea temporara) —
fiecare isi vede DOAR misiunea si boot-ul propriu, identificate dupa email. Dropdown-urile
raman numai ca fallback automat (email negasit in registru / functie fara categorie
derivabila); tab-ul Boot din SETT ramane pentru acces administrativ la tot registrul.
v4.9.39 (2026-07-17): TEZELE VEGO INTEGRALE (furnizate de user): 3 teze — 1 "Urmareste
doar interesul VEGO", 2 "Respecta deadline si bugete", 3 "Comunica eficient pe orizontala
si pe verticala" — fiecare cu cele 10 principii (3.1-3.30, cheie EN + explicatie RO).
Pe cardul 🎯: titlurile tezelor mereu vizibile, principiile in expandere per teza.
La "⤵ In composer"/"📋 Copiaza": intra TOT (boot -> cele 30 de principii -> instructiunea
finala cu skill-uri/plugin-uri potrivite).
v4.9.38 (2026-07-17): sectiunea "📜 TEZELE VEGO" e vizibila si cand textul tezelor nu e
inca incarcat (mesaj explicit in loc de sectiune ascunsa).
v4.9.37 (2026-07-17): TEZELE VEGO in UI: (1) bloc nou RV_TEZE (markeri __RENDA_TEZE_DATA__;
items gol => sectiunea nu apare — textul tezelor se toarna in bloc cand e furnizat);
(2) sectiune "📜 TEZELE VEGO" pe cardul 🎯, langa BOOT SESSION; (3) inserarea in composer
si copierea (card + tab-ul Boot din SETT) compun acum: boot -> Tezele VEGO -> instructiunea
finala ("Foloseste skill-urile si plugin-urile potrivite pentru a indeplini sarcina trasata,
in acord cu Tezele VEGO, cu misiunea si actiunile rolului tau si cu procedurile RENDA/VEGO.
Semnaleaza blocajele si nu inventa date lipsa.").
v4.9.36 (2026-07-17): fix "de ce imi apare alt angajat": IDENTIFICAREA PE EMAIL BATE
alegerea manuala salvata (alegerile ramase de la teste nu mai umbresc contul detectat;
selectia persistata mai conteaza doar cand identificarea automata esueaza). "alt angajat…"
devine VIZUALIZARE TEMPORARA (marcata explicit, cu buton "inapoi la mine"; la refresh
revii automat la tine). Categoria de misiune aleasa manual e acum PER ANGAJAT (nu globala)
— alegerile vechi raman valabile doar pentru cazul neidentificat.
v4.9.35 (2026-07-17): registrul de boot preluat INTEGRAL din XLSX (toate textele, cerut de
user): (1) fisa de pe cardul 🎯 are TOATE cele 11 coloane — Functie, Departament, Diviziune
Ed2, Rol subsidiar (Board), Stadiu competenta, Tip rol, Coordonator, Statut (langa ID);
(2) foaia MODELE_ROL: sectiune "📐 MODEL DE ROL" cu comportamentul in sesiune + validarea,
potrivita dupa tipul de rol al angajatului (EXECUTANT / COORDONATOR OPERATIONAL / MANAGER);
(3) foaia INSTRUCTIUNI: cei 6 pasi, sub boot, intr-un expander "ℹ cum se foloseste boot-ul";
(4) tab-ul Boot din SETT afiseaza si cauta si prin diviziune / rol Board / stadiu competenta.
v4.9.34 (2026-07-17): identificarea in registrul de boot se face DUPA EMAIL (prioritar,
cerut de user): tokenii din local-part (prenume.nume@ -> prenume+nume) regasiti toti
in numele angajatului — numele contului ChatGPT poate fi altul decat cel real (alt prenume
pe acelasi cont). Cardul 🎯 afiseaza DOAR intrarea proprie conform
registrului XLSX (nume, functie operationala, departament, tip rol, coordonator) + misiunea
categoriei DERIVATE automat din functia operationala (mapare cuvinte-cheie; "schimbă
categoria…" deschide un dropdown compact) + boot-ul propriu. Lista de 16 butoane a
disparut — selectoarele apar doar cand identificarea/derivarea nu reuseste.
v4.9.33 (2026-07-17): BOOT SESSIONS din registrul "VEGO_HOLDING_BOOT_SESSIONS_v02" (73 de
angajati, bloc RV_BOOT cu markeri, ~70KB): (1) pe cardul 🎯, sub misiune, apare sectiunea
"🚀 BOOT SESSION" a angajatului LOGAT — potrivit automat dupa numele detectat (toate
cuvintele numelui regasite in numele din registru; la ambiguitate/nepotrivire: selector
manual, memorat local, cu "alt angajat…" pentru schimbare). Butoane: [⤵ În composer]
(insereaza textul INTEGRAL de boot la cursor — conform foii INSTRUCTIUNI, boot-ul intra la
inceputul sesiunii, sarcina se adauga dupa; trimiterea ramane a userului) si [📋 Copiaza].
(2) tab nou "Boot (73)" in SETT: tot registrul, cautare peste nume/departament/functie/
coordonator/text, cu ⤵ si 📋 pe fiecare rand.
v4.9.32 (2026-07-16): detectarea identitatii FACUTA ROBUSTA (pe conturi business/workspace
sesiunea poate raspunde tarziu sau fara nume): (1) pana la 3 incercari la 12s pe
/api/auth/session, cu status HTTP logat in rvDebug; (2) fallback: emailul e cautat in DOM
(doar noduri scurte din zonele de profil/nav — NU continutul conversatiei); (3) daca numele
lipseste, se deriveaza din email ("prenume.nume@..." -> "Prenume Nume"); cardul se
redeseneaza dupa fiecare incercare.
v4.9.31 (2026-07-16): cardul 🎯 afiseaza IDENTITATEA DETECTATA a contului logat, in capul
cardului: "👤 Nume · email" (numele si emailul vin din /api/auth/session — same-origin,
raman locale; pana la detectare apare "cont nedetectat inca…"). Identitatea era deja
folosita pentru match-ul misiunilor individuale; acum e si vizibila.
v4.9.30 (2026-07-16): MISIUNEA & PRIMELE 3 ACTIUNI: (1) card nou "🎯 MISIUNEA MEA" andocat
in DREAPTA, deschis IMPLICIT (inchiderea cu ✕ tine pana a doua zi; buton "🎯 Misiune" in
meniu pentru redeschidere). Seed-ul = misiuni PE CATEGORII DE FUNCTIE (16, din XLSX
"Misiuni si actiuni 20210909", foaia "misiuni generale"; bloc RV_MISSIONS cu markeri);
userul isi alege functia o data (memorata local). (2) misiunile INDIVIDUALE vin NUMAI de
pe API: cand /api/sett/lists trimite employees[].mission (+actions[]) si emailul sesiunii
ChatGPT (citit same-origin din /api/auth/session, ramane local) corespunde, cardul trece
automat pe misiunea individuala. (3) tab nou "Misiuni (n)" in SETT: individuale (cand
exista) + toate categoriile de functie, cu cautare.
v4.9.29 (2026-07-16): (1) daca proiectul are container_path (de la API), butonul 📂 Azure
deschide DIRECT folderul proiectului: sablonul primeste &path=<container_path> automat
(sau prin placeholder-ul {path}, daca sablonul il contine); fara container_path se deschide
share-ul, ca pana acum. (2) filtrul de status porneste IMPLICIT pe ACTIVE/activ (primul
status care incepe cu "activ" din date); dupa ce userul alege altceva, ramane alegerea lui.
v4.9.28 (2026-07-16): (1) butonul 📂 Azure SIMPLIFICAT la cererea userului: doar deschide
Storage Explorer pe share-ul ws-vego (copierea automata a ref-ului in clipboard a fost
scoasa). (2) API-ul /api/sett/lists e LIVE (3087 proiecte, 1824 angajati, si o lista
"companies" inca nefolosita); adaptare la datele reale: type se canonizeaza UPPERCASE
(venea amestecat: "Productie"/"PRODUCTIE", "Suport"/"SUPORT" — dubla chips-urile de tip).
Nota: id-urile reale sunt "vego<numar>", iar numarul = prefixul folderului din ws-vego
(verificat: vego4085 = 4085-SCOALA 153).
v4.9.27 (2026-07-16): butonul 📂 Azure e FUNCTIONAL implicit: sablonul default = share-ul
ws-vego (storageexplorer://..., sablonul vine acum din RENDA
&resourcetype=Azure.FileShare&resourcename=ws-vego), configurabil in ⚙ Setari (goleste +
salveaza => revii la implicit; {cod}/{ref}/{label} disponibile). Deep-link-ul NU poate
tinti un folder din share, asa ca la click se COPIAZA automat ref-ul (sau codul) —
lipeste-l in cautarea din Storage Explorer ca sa sari la folderul proiectului (folderele
sunt numite <ref>_<cod>/<ref>_<denumire>). In lista, codul se afiseaza in formatul
folderelor: <ref>_<cod> (ref-ul vine din API in campul "ref" si intra si in cautare).
v4.9.26 (2026-07-16): (1) CODUL proiectului e afisat PRIMUL in lista, inaintea denumirii
(monospace, amber: "PUGEXEMPLU · PUG Comuna Exemplu"); linia separata "cod: ..." a disparut.
(2) buton "📂 Azure" per proiect — deschide Azure Storage Explorer: foloseste linkul
per-proiect din API (campurile azure/storage_url, daca vin) SAU sablonul configurabil din
⚙ Setari, in care {cod} si {label} sunt inlocuite (URL-encoded) cu datele proiectului
(ex. storageexplorer://v=1&accountid=...&resourcename={cod}). Fara sablon si fara camp
din API, butonul nu apare. URL-ul de storage nu se logheaza.
v4.9.25 (2026-07-16): (1) URL-ul IMPLICIT al API-ului de date = productie
(https://renda.holdings/api/sett/lists) — token-ul se introduce manual in ⚙ Setari;
URL-ul salvat anterior in localStorage ramane valabil (implicitul conteaza doar cand
nu e nimic salvat). (2) FILTRU dupa TIPUL proiectului: rand de chips sub cautare
("toate (N)" + cate un chip per tip, cu numaratori, construite dinamic din date),
vizibil doar pe tab-ul Proiecte; se combina cu filtrul de status si cu cautarea.
v4.9.24 (2026-07-16): Agenti Workspace actualizati la 51 (snapshot 2026-07-16): 5 redenumiti
cu prefix [TB] (acelasi ID, slug nou tb-*: EXPERIENCE_AUGMENTER, jurist-procese, PROMPTING
ORCHESTRATOR, C09 Avizare PUG, EMITENT_OS) + 23 NOI in 3 clustere noi: TENDER — ACHIZITII
PUBLICE (7: a4q, autoritate, legiuitor, judecator, ofertant, procuror, refactor), USTDE/BOQ —
REPERE & CANTITATI (9: armonitect, corector-boq x2 cu ID-uri diferite, fise-tehnice-28col,
lista-repere-creator, repere-audit-21col, ulsp-planner, ustde-repere-boq, veritas-piata),
FINANCIAR — ACB/DEVIZE/FINANTARE (7: acb, banking-credit, deviz-general-hg907, finantare-grant,
kiss-acb-creator, kiss-acb-elements, pret-rapid). Externii raman 54.
v4.9.23 (2026-07-16): adaptare la API-ul REAL renda.holdings (/api/sett/lists, dupa deploy):
(1) autentificare prin "Authorization: Bearer <token>" (X-API-Key ramane trimis in paralel;
background.js propaga acum ambele); (2) normalizare toleranta a raspunsului: containere
ok/data/lists, proiecte cu short_code (devine CODUL afisat/copiat), statusuri ACTIVE/CLOSED/
PENDING (cu culori: ACTIVE=verde, CLOSED=gri), angajati si ca users/first_name+last_name.
Verificat pe prod: token-ul merge pe /logbook/mcp; /api/sett/lists exista dar respinge
Bearer pana la urmatorul deploy al platformei.
v4.9.22 (2026-07-16): (1) buton "↻ Reincarca" in randul de tab-uri — aduce datele de la
API la cerere, fara a deschide setarile. (2) auto-refresh-ul de 10 minute refacut cu timer
PROGRAMAT PRECIS (setTimeout la momentul d.when+10min): nu mai ruleaza NIMIC la 1 minut;
refresh-ul manual / alt tab reprogrameaza urmatoarea actualizare. Restul neschimbat:
doar cu cheie + tab vizibil, verificare imediata la revenirea pe tab, esecul nu atinge cache-ul.
v4.9.21 (2026-07-16): datele API (proiecte + angajati) se ACTUALIZEAZA AUTOMAT la fiecare
10 minute; panoul deschis se redeseneaza singur, cu status "auto ✓ N proiecte · M angajati".
v4.9.20 (2026-07-16): pregatire pentru API-ul de PRODUCTIE https://renda.holdings/api/hud_data:
+@connect renda.holdings (Tampermonkey) si +host_permissions https://renda.holdings/* (extensie,
in manifest.json) — cu ele, fetch-ul ocoleste CORS pe AMBELE transporturi, deci serverul NU are
nevoie de headere CORS. Serverul trebuie doar sa expuna GET /api/hud_data cu X-API-Key ->
{vego_employees:[{id,name,email,phone}], projects:[{id,label,type,status}]} (la 2026-07-16 inca 404).
v4.9.19 (2026-07-15): proiectele au si STATUS (badge colorat: activ=verde, finalizat=gri,
blocat/suspendat=rosu, restul=albastru) + FILTRU de status (dropdown cu numaratori, construit
dinamic din date). Panoul SETT scaleaza la MII de proiecte: index de cautare precomputat
(concatenarea lowercase se face O DATA per item, la schimbarea datelor, nu la fiecare tasta),
debounce 150ms pe cautare, randare PAGINATA (200 itemi + buton "Arata inca N — afisate X din Y"),
un singur listener delegat pe lista. Masurat: index 2ms + filtrare <1ms la 2500 de proiecte.
v4.9.18 (2026-07-15): panoul SETT reorganizat: (1) TAB-uri "Proiecte (n)" / "Angajati (n)";
(2) setarile (URL API + API key) sunt ASCUNSE — apar doar la apasarea butonului "⚙ Setari"
din antetul panoului (si automat la prima configurare, cand nu exista cheie; dupa o incarcare
reusita se inchid singure); (3) proiectele au buton "📋 cod" care copiaza CODUL proiectului
(campul id = cod string), afisat ca "cod: ..."; angajatii au "📋 email".
v4.9.17 (2026-07-15): buton nou "⚙ SETT" in meniul HUD -> panou de SETARI: (1) URL-ul
API-ului de date HUD (implicit http://localhost:3000/api/hud_data, configurabil — merge
si cu un domeniu extern pe HTTPS) + API key trimis ca header X-API-Key; ambele stau LOCAL
(localStorage), cheia nu se logheaza niciodata. (2) "Testeaza & Incarca" aduce de la API
proiectele {id,label,type} si angajatii VEGO (vego_employees {id,name,email,phone}) si le
afiseaza in panou, cu cautare; raspunsul se tine in cache local. Transport: GM (Tampermonkey)
-> puntea extensiei (background, fara CORS pe localhost) -> fetch direct (necesita CORS).
background.js: proxy-ul accepta acum localhost pe orice port + HTTPS extern si propaga
DOAR headerul X-API-Key; manifest: +host_permissions localhost:3000.
v4.9.16 (2026-07-15): cautarea din panoul 🤖 intelege SINONIME si merge fara diacritice:
~23 grupuri de radacini (ex. avocat/jurist/legal/legislat -> juridic; licitat/seap/ofert -> tender;
bani/buget/credit -> financiar), aplicate pe toate tab-urile. Termenii scurti (PUG, SEA, RAN, GIS)
se potrivesc doar ca cuvant intreg, ca sa nu prinda "research"/"transcriere". Cuvintele multiple
din cautare trebuie sa se potriveasca TOATE (fiecare direct sau printr-un sinonim).
v4.9.15 (2026-07-15): panoul 🤖 restructurat: (1) tab-ul "Skills & Plugins" e PRIMUL si implicit;
(2) tab "Agenți Workspace" = doar cei 28 de agenti din vederea workspace (snapshot 2026-07-15),
cu nume/descrieri actualizate si 2 ID-uri corectate (jurist-urbanism, legislatie-urbanism —
inainte aveau ID-uri gresite/incrucisate); (3) tab nou "Agenți Externi" = restul de 54 de agenti
din catalogul vechi. Datele: RV_AGENTS = {agents: workspace, external, skills}.
v4.9.14 (2026-07-14): catalog PLUGINS FINAL — 139 intrari (23 noi fata de 4.9.12, intre care
JURIST_PROCESE/URBANISM, SOCIO_TELEOLOG, TENDER_OFERTANT, VERITAS_PIATA, ACB, BANKING_CREDIT,
AUDIT_ENERGETIC, EXPERTIZA_TEHNICA, MEMORIU_GENERAL_PUG, STUDIU_ISTORIC, VANATOR_CERINTE_A7,
DNSH, STUDII_CIRCULATII, PATRIMONIU_FAI, ADN_PROIECT_YAML, CITATE_PARAFRAZARI, DRAFT_CREATOR,
CODEREX_STRICT, CORECTOR_TACIT, MICROPASS_WWH, NEAR_ZERO_GAP, VERSION_SENTINEL), toate cu ID
si descriere din vederea workspace /plugins.
v4.9.13 (2026-07-14): +20 agenti GPT noi in catalog (decident-vego, deep-search-prompt-engineer,
pm-proiecte v2, pm-urbanism-warp, telos-drift-guard, vego-core, warp-agentivity-doctor,
chronicler-jurnal, expert-autoadaptiv, gold-way, jurist-general/urbanism, legislatie-urbanism,
rag-miner fhairo/files/hybrid/web, ricar-dosar-strateg, socio-teleolog, trilogia-doctrina) —
total 82 agenti, inserati in clusterele existente.
v4.9.12 (2026-07-14): catalog PLUGINS actualizat la 116 intrari (34 noi, intre care
RENDA_CANON_MEMORY, TENDER_PROCUROR/REFACTOR, SF_DALI, SSI_INCENDIU, STUDII_TEREN,
MEDIU_SEA, AVIZARE_CIRCULATII, SIGURANTA_RUTIERA, MINUTE_MEETING, ALL_TO_TEXT,
STAFETA_HANDOFF, TELOS_DRIFT_GUARD, PLAN_COMPOZITOR, RAG FHAIRO/FILES_ONLY etc.),
toate cu ID si descriere din vederea workspace /plugins.
v4.9.11 (2026-07-14): (1) tab-urile Skills si Plugins COMASATE intr-unul singur ("Skills & Plugins"):
sectiunea PLUGINS (APPS) sus, grupele de skills sub ea, cautare peste tot. (2) Fiecare plugin are
si buton [📋 nume] (copiaza numele) pe langa [▶ Deschide]. (3) Lista de SKILLS inlocuita complet
cu cele 15 skills NATIVE OpenAI (answers-charts..writing-blocks, snapshot 2026-07-14); butonul de
copy al skill-urilor copiaza @apelul (@nume), gata de scris in mesaj.
v4.9.10 (2026-07-14): +8 agenti GPT noi in catalog (EXPERIENCE_AUGMENTER sys, PROMPTING
ORCHESTRATOR flow, unlimited-generalist, jurist-procese, Avizare PUG Integrator, EMITENT_OS,
pm-proiecte-persona, ACRONYM10) — inserati in clusterele existente, cu link /g/ corect.
v4.9.9 (2026-07-14): TAB PLUGINS complet — toate cele 82 de plugins au ID (extras din vederea
workspace a /plugins) si DESCRIERE; [▶ Deschide] functioneaza pentru toate, cautarea acopera
nume + descriere.
v4.9.8 (2026-07-14): TAB PLUGINS in panoul 🤖 — catalogul celor 82 de plugins (apps) din
workspace, cu cautare si buton [▶ Deschide] -> chatgpt.com/plugins/Plugin_<id>. ID-urile se
completeaza in RV_PLUGINS (marcat __RENDA_PLUGINS_DATA__): click pe plugin in /plugins ->
copiezi "Plugin_<hex>" din bara de adrese. Pana la completare, intrarea are buton de copiat
numele. Titlul panoului devine AGENTI · SKILLS · PLUGINS.
v4.9.7 (2026-07-14): ARHITECTURA HIBRIDA de extensie. Injectarea de baza revine la
content_scripts (fisierul de pe disc — garantat, fara comutatorul "Allow user scripts",
care s-a dovedit ca pe unele masini nu injecteaza desi inregistrarea reuseste). Stratul
userScripts ramane DOAR ca auto-update: unde API-ul functioneaza, overlay-ul cu versiunea
mai noua din GitHub (document_start) se monteaza primul si o GARDA anti-dubla-montare
(atribut data-rv-hud-loaded pe <html>) retrage tacut instantele urmatoare — inclusiv
Tampermonkey daca ruleaza in paralel (nu mai exista HUD dublu).
v4.9.6 (2026-07-13): DIAGNOSTIC — loguri in consola tab-ului (F12). O linie de start MEREU
vizibila (versiune + transport HUD: Tampermonkey / extensie / local). Restul (extHudRequest,
sysmon LIVE/OFFLINE, canon HUD/local, lockdown) sunt OPT-IN: localStorage.setItem('rvDebug','1')
+ refresh; se sting cu '0'. NU se logheaza niciodata textul din composer/conversatie.
v4.9.5 (2026-07-13): compat cu AUTO-UPDATE PUR IN BROWSER (chrome.userScripts): (a) RUNNING_VER
citeste si __RENDA_VER__ (injectat de background.js, fiindca in lumea USER_SCRIPT nu exista
chrome.runtime.getManifest); (b) extRuntimeOk nu mai cere chrome.runtime.id (lipseste in
USER_SCRIPT) — doar sendMessage. Extensia se autoactualizeaza singura din GitHub, fara
scheduled task / PowerShell. In Tampermonkey nimic nu se schimba.
v4.9.4 (2026-07-13): (1) LOCKDOWN SKILLS pe pagina nativa ChatGPT (/plugins). Ascunde din UI:
(a) TOT comutatorul Plugins/Skills (ambele taburi — identificat ca ancestorul tabului "Skills"
care contine si "Plugins", ca sa nu atinga titlul h1 sau linkul din sidebar); (b) optiunile
Download / Share / Uninstall din meniul "..." al fiecarui skill (meniul e recunoscut prin
prezenta unei optiuni Download/Uninstall, ca sa nu atinga meniul de share al unui chat). Tot
din HUD-ul propriu dispare linkul de nav "Skills". Ascundere VIZUALA prin MutationObserver —
NU bariera de securitate (devtools/URL direct tot ajung; blocarea reala = admin workspace OpenAI).
(2) FIX link GPT: butonul "▶ Deschide" naviga la /g-<id> (gresit) -> acum /g/g-<id>-slug corect.
(3) update.ps1 actualizeaza DOAR spre versiuni mai noi (semver) — fara downgrade accidental.
v4.9.3 (2026-07-13): (1) UNIVERSAL — ACELASI fisier ruleaza in Tampermonkey SI ca content
script de extensie Chrome, fara adaptari externe: cand GM_* lipseste dar chrome.runtime
exista (extensie), gm cade pe extHudRequest (mesaj 'hud_fetch' catre service worker-ul
background.js, care face fetch-ul spre 127.0.0.1:8765 cu host_permissions — echivalentul
@connect), iar RUNNING_VER cade pe chrome.runtime.getManifest().version. Fara nici GM,
nici chrome (pagina goala): comportamentul vechi (canon local, sysmon 'fara GM').
(2) FIX LIGHT MODE — recolorarea intunecata a paginii ChatGPT (body,
--main-surface-*/--sidebar-surface-*/composer, caret, selection, scrollbar) se aplica de
acum DOAR cand ChatGPT e pe tema dark (clasa .dark pe <html>, pusa de ChatGPT, urmarita
pur din CSS => reactioneaza si la schimbarea temei din mers). Pe light, fortarea fundalului
intunecat lasa textul ChatGPT (inchis) ilizibil. Banda HUD si panourile ei raman intunecate
pe ambele teme (paleta proprie, completa). Layout-ul (impingerea sub banda, overflow,
h-svh) ramane NEatins de tema.
v4.9.2: dedup skills normalizat pe sufixul '-tool' (5 dubluri scoase din panou — variantele
urcate in ChatGPT poarta '-tool', folderele DIST nu).
v4.9.1: catalogul de skills completat de pe DISC (DIST + CREATED_BY_USER scanate mecanic,
nu doar snapshot-ul manual — lipseau 14, intre care renda-install-hud).
v4.9.0: PANOUL AGENTI & SKILLS (buton 🤖 in nav, zero inaltime adaugata) — catalogul celor 54
agenti GPT (pe clustere, cautare, [▶ Deschide]=dialog nou + [📋 @aroma]=mentiune in chatul curent)
si al skill-urilor RENDA (nume+descriere, copy). Datele = coapte din gpt_registry/gpt_mentionable/
SKILS_LIST prin build_agents_data.py (regenerabile la fiecare publish).
v4.8.0: icon oficial RENDA (ochiul-V in hexagon-retea, autor Virgil Profeanu) — @icon din repo.
v3.7.0 (2026-07-11, cerere autor): (1) REFLEXE + NORME INTREGI in blocul FULL — scoase ambele
taieri (extractie _CANON_EMBED + afisare buildCanonBlock + /canon_select server): formulele apar
complet, nu mai sunt trunchiate cu "…". (2) DIRECTIVA CANON in panoul ⚡ — camp NOU, distinct de
Prompt Perpetuu (acela scrie in COMPOSER): directiva userului se salveaza LOCAL (localStorage) si
intra in capsula [USER DIRECTIVE] a blocului canon, combinata cu directivele HUD daca exista.
Astfel directiva se pune din UI, fara editarea directives.json pe disc, si merge si fara HUD.
v3.6.0 (2026-07-11, cerere autor): BLOC CAPSULAT — preambul scurt in engleza care spune AI-ului
ca stratul e ADITIONAL promptului userului (aplica-l ca metoda; R01 prevaleaza la conflict) +
directiva user in CAPSULA proprie [USER DIRECTIVE — persistent, additional: ...] + canonul in
capsula separata, toate delimitate cu separatoare -----. Capsula directivei apare doar daca exista.
v3.5.0 (2026-07-11, cerere autor): INDEPENDENTA DE HUD — canonul (50 reflexe + 143 norme + 9
semnale de escaladare) e EMBEDAT in script, iar selectia (pick_reflexes/pick_norme) e portata in
JS. Cand serverul HUD local raspunde, e folosit (are si directivele); cand tace / alt calculator /
alt user fara RENDA -> selectie LOCALA din canonul embedat. Banda merge ORIUNDE, cu HUD sau fara.
Badge-ul arata sursa: [HUD] vs [local]. Fail-open vechi ("mesaj trimis LIBER") DISPARE: mesajul
pleaca mereu cu canon (local daca nu e HUD). Confidentialitate: in mod LOCAL nu se face niciun
request de retea — selectia e in pagina; requestul spre 127.0.0.1 se incearca doar daca HUD-ul
exista si raspunde. Actualizarea canonului embedat = regenerare din SSOT + republicare script.
v3.4.0 (2026-07-11, cerere autor): (1) DIRECTIVELE persistente intra in blocul canon — endpoint-ul
/canon_select intoarce si directivele active din directives.json (cheile "all" + "gpt"), blocul
le adauga ca linii DIRECTIVA; (2) MOD COMPACT — butonul ⚖ cicleaza FULL -> COMPACT -> OFF:
COMPACT = o singura linie discreta cu CODURILE selectiei ([CANON RENDA R##·R##·R## + ID·ID·ID]),
gandita pentru arhitectura combinata cu skill-ul renda-canon-memory (skill-ul cara canonul complet
invizibil in references; modelul rezolva codurile de acolo). Stare persistata; migrare automata
de la ON/OFF-ul vechi (true->full, false->off).
v3.3.1 (2026-07-11): FIX 2 defecte prinse la TESTUL REAL (CDP pe cont live): (1) CURSA de
sincronizare — click-ul pe send in acelasi tick cu execCommand risca trimiterea starii VECHI
(ProseMirror/React sincronizeaza asincron) => input-event + 140ms inainte de click; (2) callback
GM THROTTLE-uit in tab de fundal (lectia 5) lasa canonBusy blocat si a doua trimitere trecea RAW
pe langa garda => watchdog 2.5s + PREFETCH-ON-INPUT (selectia se ia in timpul tastarii, la Enter
e cache-hit SINCRON) + re-gasirea composer-ului la callback + garda de stare (text schimbat/SPA
navigat => NU injecta orbeste, badge onest).
v3.3.0 (2026-07-11, cerere autor): CANON PER-TURA — echivalentul hook-ului UserPromptSubmit de la
Claude, pe chatgpt.com: la FIECARE trimitere, textul din composer e trimis DOAR la serverul HUD
local (127.0.0.1:8765/canon_select, care ruleaza CHIAR vigilia_router.pick_reflexes/pick_norme —
zero drift de selector) iar blocul [CANON RENDA] (3 reflexe VIGILIA + 3 norme ELEAT potrivite
cererii) e ADAUGAT la finalul mesajului inainte de trimitere. BUTON ⚖ Canon ON/OFF in nav
(suprimare pentru teste A/B — comportament liber vs canon); linia de selectie vizibila in nav.
Fail-open: server oprit -> mesajul pleaca NEatins + badge "canon: HUD offline". AMENDAMENT DE
CONFIDENTIALITATE fata de v3_cl: cand CANON e ON, textul TASTAT DE TINE in composer (doar el,
nu conversatia) pleaca spre 127.0.0.1 (masina proprie) pentru selectie; OFF = zero trafic nou.
v3.2.2 (2026-07-11): FIX sidebar (lista de chaturi/sectiuni cu flapping) + robustete la shell-ul
schimbator ChatGPT. Doua schimbari structurale, probate live pe /c/..., home si /plugins:
(1) ROOT DETERMINIST: containerul aplicatiei = stramosul lui <main> direct sub <body>
    (main.closest('body > *')) — nu "cel mai mare DIV" (shell-ul ChatGPT s-a schimbat intre
    incarcari si euristica de arie marca alt element => push pe elementul gresit).
(2) CAP INGUST: dispare plafonul lat pe TOTI copiii root-ului (v3.1.2 — atingea si sidebar-ul
    si strica masuratoarea virtualizatorului listei de chaturi); ramane o singura normalizare:
    elementele cu clasa h-svh din interiorul root-ului => height:100% (mostenesc inaltimea
    reala de sub HUD in loc de inaltimea viewportului); composer-ul ramane vizibil pe /c/...
v3.2.0 (2026-07-11, cerere autor): PROMPT PERPETUU + SABLOANE RENDA — buton ⚡ in bara de nav
(zero inaltime adaugata; panou PLUTITOR sub banda). Promptul perpetuu = text directiv scris de
user, INSERAT AUTOMAT in composer la fiecare chat NOU, pana cand userul il sterge din panou;
o data pe pagina (daca il stergi din composer, nu revine pana la urmatorul chat nou). Sabloanele
= lista predefinita RENDA (disciplina anti-inventie, contract de sarcina, verificare adversariala
etc.), click = inserat in composer. Scriptul DOAR SCRIE in composer — NU trimite NICIODATA singur;
nimic din conversatie nu e citit (verificarea "composer gol" = textContent al campului de INPUT).
v3.1.2 (2026-07-11): FIX pagina goala pe /plugins (regresie v3.1.1) — root-ul are si un DIV gol
de sistem printre copii; height:100% fortat il umfla pe TOT ecranul si strivea continutul flex-1
la 0. Regula devine DOAR plafon (max-height:100%, height:auto) — taie depasirea 100dvh (composer)
fara sa creasca copiii goi. Probat pe AMBELE: /c/... composer vizibil + /plugins continut plin.
v3.1.1 (2026-07-11): FIX composer taiat pe paginile de conversatie — ChatGPT isi dimensioneaza
scena interioara cu 100dvh (inaltimea VIEWPORTULUI), dar root-ul e comprimat la 100dvh-78px =>
interiorul depasea cu 78px in jos exact unde sta composer-ul. Fix: copiii directi ai root-ului
fortati la height:100% (mostenesc inaltimea reala); probat pe conversatie reala (composer
853->775, header intern intact sub HUD la top=78).
v3.1 (2026-07-11, cerere autor): HUD COMPACT — inaltimea injumatatita 154px -> 78px (shell 48px
+ nav 26px): status/orbita/subtitlu ascunse, comanda 11px, metricile pe UN rand flex (RUTA scoasa
— vizibila oricum in bara de adrese; barele decorative ORA scoase). Pliat ramane 38px.
v3_cl (2026-07-11, Claude): metricile false LINK/RUTĂ/ORA devin monitor REAL — CPU/RAM (sistem +
RENDA) trase din serverul HUD local prin GM_xmlhttpRequest (@connect 127.0.0.1; serverul nu are
CORS și NU e atins). Poll la 2s, pauză pe tab ascuns, fallback onest „HUD offline" când serverul
e oprit. Confidențialitate neschimbată: singura comunicare = GET către 127.0.0.1:8765/sysmon
(mașina proprie), zero date din pagină trimise.
v2_cl (2026-07-11, Claude): fix detectie root pe chatgpt.com real — v1 marca overlay-ul de
toast-uri (pointer-events-none, primul DIV din body) drept container al aplicatiei si CSS-ul
il forta position:relative cu inaltimea viewportului => aplicatia reala era impinsa sub ecran
(pagina neagra la montare si la pliere). v2: fallback = cel mai mare DIV vizibil din body
(excluzand overlay-urile), cu marcaj unic (curata clasa de pe alte noduri la fiecare re-scan).
```
