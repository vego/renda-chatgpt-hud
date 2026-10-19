# Build pentru Chrome Web Store

Generează pachetul publicabil în Chrome Web Store din extensia RENDA HUD. Sursa e doar citită, nu se modifică.

```
python build_store.py                       # sursa implicită: C:\ws_vego\renda-chatgpt-hud
python build_store.py D:\alta\cale\sursa    # altă sursă
```

Iese `dist/renda-hud-chatgpt-store-<versiune>.zip`. Necesită Python 3 + Pillow.

## Ce diferă față de varianta internă

| | Internă (unpacked) | Store |
|---|---|---|
| Conectare RENDA (`identity` + PKCE) | da | da, neschimbată |
| Date RENDA (`/api/hud/*`) + cache | da | da, neschimbat |
| Auto-update de pe GitHub (`userScripts` + `alarms`) | da | scos: actualizările vin prin Store |
| Permisiuni | `userScripts`, `alarms`, `storage`, `identity` | `storage`, `identity` |
| Host-uri | + `chatgpt.com`, `raw.githubusercontent.com` | `renda.holdings`, `127.0.0.1:8765`, `localhost:8765` |
| Antet `==UserScript==` + comentarii | da | scoase |

Scriptul se oprește cu eroare dacă:
- o cheie de cuvânt folosită de extensie nu are text în dicționarul platformei (`renda/src/hud/hud_labels.ts`, verificat cu `check_labels.py`);
- vreun bloc de date (agenți, SHKN, canon, boot, misiuni, teze) nu e gol în sursă;
- în pachet rămâne o referință la GitHub sau la Azure;
- `background.js` pierde conectarea ori păstrează auto-update-ul.

## Verificare înainte de upload

1. `chrome://extensions` → Developer mode → **Load unpacked** → `dist/extension/` (dezactivați varianta internă cât testați).
2. Deschideți chatgpt.com: apare banda, „Temă” comută deschisă/închisă, iar „Conectează-te la RENDA” deschide fereastra RENDA și, după Connect, banda arată „Conectat la RENDA”.

Textele pentru Dashboard sunt în `STORE_LISTING.md`, politica de confidențialitate în `PRIVACY.md`, imaginile în `assets/`.
