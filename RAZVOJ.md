# RAZVOJ — pravila rada na projektu

Ovo je naš stalni dogovor kako mijenjamo aplikaciju i kako izmjene stižu na **git** i na **offline računar**.

## Zlatno pravilo

> **Izvor se uređuje. Offline fajl se NIKAD ne dira ručno — uvijek se iznova *generiše* iz izvora skriptom `build.py`.**

## Struktura

```
topologija_mreze/
├─ izvor/                         ← OVDJE se uređuje
│   ├─ Topologija-redizajn.dc.html   UI: <x-dc> šablon + <script data-dc-script> logika (React/JSX)
│   ├─ support.js                    dc-runtime (auto-boot, transpilacija, render) — ne dira se
│   └─ backend.js                    logika: CIDR, model podataka, storage 'topo_state', seed/demo
├─ vendor/                        ← „zamrznute" biblioteke (offline), ne diraju se
│   ├─ react.production.min.js       React 18.3.1 UMD
│   ├─ react-dom.production.min.js   ReactDOM 18.3.1 UMD
│   ├─ babel.min.js                  @babel/standalone 7.29.0 (transpilira JSX u browseru)
│   └─ fonts.css                     @font-face sa ugrađenim (base64) woff2 — Albert Sans + JetBrains Mono
├─ build.py                       ← sklapa offline fajl iz izvor/ + vendor/
├─ Topologija-mreze-offline.html  ← GENERISANO (ovo ide na offline računar)
├─ README.md
└─ RAZVOJ.md                      ← ovaj dokument
```

## Radni ciklus za SVAKU izmjenu (vizuelnu ili logičku)

| Korak | Šta se radi | Gdje |
|---|---|---|
| 1 | Kažeš šta mijenjamo / dodajemo / ukidamo | — |
| 2 | **Izgled/ponašanje** se mijenja u `izvor/Topologija-redizajn.dc.html` | izvor |
| 3 | **Logika** (CIDR, podaci, izvoz, storage) se mijenja u `izvor/backend.js` | izvor |
| 4 | **Rebuild:** `python build.py` → nastane novi `Topologija-mreze-offline.html` | repo |
| 5 | Provjera u pregledaču (renderuje se, nema grešaka) | — |
| 6 | **git commit** (izvor + generisani offline fajl zajedno) | git |
| 7 | Kopiraš jedan fajl `Topologija-mreze-offline.html` na offline računar | USB/mreža |

Rebuild komanda:

```bash
python build.py
```

## Kako build radi (ukratko)

`build.py` uzme `izvor/Topologija-redizajn.dc.html` i:
1. zamijeni `<script src="./support.js">` ugrađenim: **React → ReactDOM → Babel → backend (kao blob-modul) → support.js**;
2. prepravi `import('./backend.js')` na blob-URL (da radi i sa `file://`, dupli klik);
3. ubaci `vendor/fonts.css` (ugrađeni fontovi) umjesto Google Fonts linka.

Rezultat je jedan fajl (~3.9 MB) koji radi **bez interneta i bez servera**. `support.js` sam preskače CDN kad su React/ReactDOM/Babel već prisutni kao `window` globali.

## Sigurnosna pravila (da app uvijek radi)

- **Podaci su odvojeni od aplikacije** — unesene lokacije/uređaji žive u `localStorage` (ključ `topo_state`) na offline računaru. Nova verzija app-a ne briše podatke dok se ne mijenja struktura podataka.
- **Prije izmjene strukture podataka** → prvo **Izvezi JSON** (backup). Novu verziju držimo unazad-kompatibilnom kad god je moguće.
- **Verzija** stoji u `izvor/backend.js` (`meta.version`) i u git tagu — uvijek znaš koja je verzija na offline računaru.
- **Git je sigurnosna mreža** — svaka verzija je povratna.

## Ako zatreba nadograditi biblioteku (rijetko)

`vendor/` je namjerno „zamrznut". React/Babel se mijenjaju samo svjesno; poslije zamjene obavezno rebuild + provjera u pregledaču.
