# Politica de confidențialitate — RENDA HUD

*Ultima actualizare: 19 octombrie 2026 · Publicată de RENDA Research Center*

RENDA HUD este o extensie Chrome care adaugă o bandă de lucru peste chatgpt.com, pentru membrii echipelor RENDA. Documentul de față explică ce date atinge extensia și ce face cu ele.

## Conectarea la RENDA

Te conectezi cu butonul **„Conectează-te la RENDA”**. Se deschide o fereastră renda.holdings, în care te autentifici și aprobi conectarea. Extensia primește o cheie de acces personală, pe care o păstrează **numai în spațiul de stocare al extensiei** (`chrome.storage.local`), unde pagina chatgpt.com nu are acces. Cheia apare în contul tău RENDA („Cheile mele”) și o poți revoca oricând de acolo.

## Ce date folosește extensia

| Dată | De unde vine | Unde ajunge | De ce |
|---|---|---|---|
| Cheia de acces RENDA | renda.holdings, la conectare | Stocarea extensiei; trimisă **doar** către `https://renda.holdings` | Autentificare |
| Numele, emailul și rolul tău RENDA | `https://renda.holdings` (după conectare) | Afișate în bandă, păstrate local | Profilul, misiunea și boot-ul tău |
| Emailul contului ChatGPT | Pagina chatgpt.com (sesiunea deja deschisă) | Rămâne **doar în browserul tău** | Potrivirea cu contul RENDA |
| Agenți, misiuni, reguli de lucru, textele interfeței | `https://renda.holdings` (după conectare), ale organizației în care lucrezi | Cache local, separat pe organizație, până la deconectare | Conținutul benzii |
| Proiectele și colegii organizației (nume, email, telefon) | `https://renda.holdings` (după conectare), doar pentru membrii organizației | Cache local | Panoul Proiecte |
| Organizația aleasă în comutator | Tu | Stocarea extensiei; trimisă către `https://renda.holdings` cu fiecare cerere | Ce organizație vezi |
| Textul pe care îl trimiți în ChatGPT (maxim 2.000 de caractere) | Câmpul de scriere de pe chatgpt.com | **Doar** serverul RENDA HUD de pe **propriul tău calculator** (`127.0.0.1:8765`), dacă rulează | Alegerea regulilor de lucru potrivite |
| Indicatori CPU/RAM | Serverul RENDA HUD de pe propriul tău calculator | Afișați în bandă | Monitorizare |
| Preferințe (temă, bandă pliată, directive) | Tu | Doar în browser | Păstrarea setărilor |

## Ce NU face extensia

- Nu citește, nu salvează și nu trimite istoricul conversațiilor tale din ChatGPT.
- Nu trimite datele tale către terți, nu le vinde și nu le folosește pentru publicitate.
- Nu folosește datele pentru a stabili bonitatea sau pentru acordarea de credite.
- Nu încarcă și nu execută cod de la distanță.

## Păstrare și ștergere

La deconectare, extensia șterge cheia și datele RENDA din cache. Dezinstalarea extensiei șterge tot ce a stocat. Preferințele de pe chatgpt.com se șterg odată cu datele site-ului. Datele de pe renda.holdings sunt gestionate de RENDA conform contractului tău cu RENDA.

## Contact

RENDA Research Center — [adresă de email de contact]

---

# Privacy Policy — RENDA HUD (English)

RENDA HUD adds a work bar on top of chatgpt.com for RENDA team members.

- **Sign-in**: the "Conectează-te la RENDA" button opens renda.holdings, where you sign in and approve. The extension receives a personal access key, stored only in extension storage (not visible to chatgpt.com) and sent only to `https://renda.holdings`. You can revoke it from your RENDA account at any time.
- **RENDA profile** (name, email, role) and **work data** (agents, missions, working rules, interface texts) of the organisation you work in, plus its **projects and colleagues** (name, email, phone, members only): fetched from `https://renda.holdings` after sign-in and cached locally, separately per organisation, until you sign out.
- **Organisation switcher**: the organisation you choose is stored in the extension and sent to `https://renda.holdings` with each request.
- **ChatGPT account email**: read from the open chatgpt.com session and kept only in your browser.
- **Text you submit in ChatGPT** (up to 2,000 characters): sent only to the RENDA HUD server on **your own computer** (`127.0.0.1:8765`), if it is running. It never leaves your machine through this extension.
- **CPU/RAM figures**: read from that same local server.

The extension does not read or transmit your conversation history, does not sell or share data with third parties, does not use data for advertising or creditworthiness, and does not load remote code. Signing out clears the key and cached RENDA data; uninstalling removes everything the extension stored.

Contact: RENDA Research Center — [contact email]
