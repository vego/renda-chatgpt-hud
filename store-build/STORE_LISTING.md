# Chrome Web Store — ce completezi în Developer Dashboard

- Sursa: `C:\ws_vego\renda-chatgpt-hud` (v4.37.0, cu conectare RENDA și temă deschisă/închisă)
- Pachetul de urcat: `dist/renda-hud-chatgpt-store-4.47.0.zip`, generat cu `python build_store.py`

## Pachet

**Pachet → Încarcă un pachet nou** → `renda-hud-chatgpt-store-4.47.0.zip`. Înlocuiește orice versiune urcată anterior (4.36.4 / 4.37.0).

## Înregistrarea în magazin

**Descriere:**
```
RENDA HUD este instrumentul de lucru al echipelor RENDA în ChatGPT. Adaugă o bandă compactă în partea de sus a chatgpt.com, cu:

• Agenți RENDA – catalogul de agenți, skill-uri și plugin-uri, cu căutare.
• Misiunea mea – rolul, misiunea și boot-ul tău, din contul RENDA.
• Proiecte – proiectele din platforma RENDA, cu filtre.
• Reguli de lucru (Canon) – aplicate mesajelor trimise, comutabile oricând.
• Temă deschisă sau închisă, automat după sistem.
• Mai multe organizații: dacă lucrezi în mai multe, le schimbi din bară; fiecare își vede doar datele ei.
• Monitor CPU/RAM – dacă rulezi serverul RENDA HUD pe calculatorul tău.

Conectare cu un clic: butonul „Conectează-te la RENDA” deschide contul tău RENDA; cheia de acces stă doar în extensie și se poate revoca oricând din cont.

Extensia nu conține date proprii: tot ce afișează vine din contul RENDA al organizației tale. Necesită un cont RENDA.

Confidențialitate: extensia nu citește și nu trimite istoricul conversațiilor tale, nu încarcă cod de la distanță și nu partajează date cu terți.
```

- **Categorie:** Productivitate → Flux de lucru și planificare (sau Instrumente)
- **Limbă:** Română
- **Pictogramă:** `assets/store-icon-128.png`
- **Capturi 1280×800** (organizații fictive): `assets/screenshot-1-misiune.png`, `screenshot-2-agenti.png`, `screenshot-3-proiecte.png`, `screenshot-4-shkn.png`, `screenshot-5-conectare.png`
- **Imagine promoțională mică 440×280:** `assets/promo-small-440x280.png`
- **Marquee 1400×560:** `assets/promo-marquee-1400x560.png`
- **Site oficial / asistență:** `https://renda.holdings/`

## Confidențialitate

**Scop unic:**
```
Oferă membrilor RENDA o bandă de lucru pe chatgpt.com, cu agenții, misiunile, proiectele și regulile de lucru RENDA, după conectarea la contul RENDA.
```

**Justificare `identity`:**
```
Folosită exclusiv pentru butonul „Conectează-te la RENDA”: chrome.identity.launchWebAuthFlow deschide pagina de conectare renda.holdings și primește un cod de unică folosință, schimbat apoi pe cheia de acces (PKCE). Nu se folosește contul Google al utilizatorului.
```

**Justificare `storage`:**
```
Păstrează cheia de acces RENDA (în stocarea extensiei, inaccesibilă paginii chatgpt.com), organizația aleasă în comutator și cache-ul datelor RENDA ale organizației (agenți, misiuni, proiecte, reguli de lucru, textele interfeței), până la deconectare.
```

**Justificare permisiune gazde:**
```
renda.holdings: conectarea la contul RENDA și citirea (GET) datelor de lucru ale utilizatorului conectat (/api/hud/config, /api/hud/me, /api/hud/canon, /api/hud/directory); pagina chatgpt.com nu poate face aceste cereri direct din cauza CORS. 127.0.0.1:8765 și localhost:8765: comunică cu serverul opțional RENDA HUD care rulează pe calculatorul utilizatorului (indicatori CPU/RAM, selecția regulilor de lucru); datele nu părăsesc calculatorul. Content script-ul rulează doar pe chatgpt.com și chat.openai.com, unde afișează banda de lucru.
```

**Cod la distanță:** Nu, nu folosesc cod la distanță.

**Utilizarea datelor:** bifează doar
- ☑ Informații de identificare personală (nume, email, rol RENDA)
- ☑ Informații de autentificare (cheia de acces RENDA)
- ☑ Conținutul site-ului (textul trimis, transmis doar serverului local)

Apoi bifează **cele 3 declarații**.

**URL politică de confidențialitate:** adresa publică la care ai urcat `PRIVACY.md`.

## Distribuire

- Vizibilitate: **Nelistat (Unlisted)**
- Regiuni: toate

## Instrucțiuni pentru test

Creează în renda.holdings un **cont de test** (email + parolă) cu date fictive: câteva proiecte, un rol, agenți. În formular pui emailul și parola contului de test, iar în câmpul de instrucțiuni:
```
1. Install the extension and open https://chatgpt.com (signed in with any ChatGPT account).
2. The RENDA HUD bar appears at the top of the page. "Temă" switches light/dark theme.
3. Click "Conectează-te la RENDA" (right side of the bar, or in the "Misiune" card). A renda.holdings window opens: sign in with the test account above (password option) and click "Connect".
4. After connecting, the bar shows "Conectat la RENDA". Open "Agenți", "Misiune" and "Proiecte" to see the test data.
5. The CPU/RAM monitor shows "offline" — expected: it needs the optional RENDA HUD server on the user's own computer, which is not public.
```
