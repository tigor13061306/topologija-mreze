# Topologija mreže — offline alat (React dashboard)

Samostalan **offline** alat za dokumentovanje i vizuelizaciju mrežne topologije: centralni firewall (HQ) + lokacijski firewall-ovi, dva transporta (**Transport A** / **Transport B**) sa auto-failover-om, opsezi/VLAN-ovi, inventar uređaja i oprema, te izvoz dokumentacije.

Aplikacija je React „dashboard", ali se isporučuje kao **jedan HTML fajl** koji radi bez interneta i bez servera — dovoljno je otvoriti `Topologija-mreze-offline.html` u pregledaču (Chrome, Edge, Firefox).

## Korišćenje (na offline računaru)

1. Otvori `Topologija-mreze-offline.html` (dupli klik).
2. Dodaj lokacije, opsege, uređaje i opremu.
3. Podaci se automatski pamte u pregledaču (`localStorage`, ključ `topo_state`).
4. Za prenos/backup koristi **Izvezi JSON** / **Uvezi JSON**.
5. Dokumentaciju praviš dugmadima za **Word** i **Excel** izvoz.

> Podaci se čuvaju lokalno u pregledaču tog računara. Za prenos između računara koristi izvoz/uvoz JSON-a.

## Nadzor uživo — ping/status (agent)

Modul **Nadzor** po lokaciji provjerava Transport A/B i sve opsege (ping na gateway). Pošto pregledač sam ne može da pinga, koristi se mali lokalni **agent** (`agent.py`).

**Agenta pokreni na računaru koji je na istoj mreži kao uređaji** (tamo gdje otvaraš aplikaciju):

1. Dupli klik na **`pokreni-agent.bat`** (prvi put instalira pakete — treba internet jednom).
   - Alternativa: `python agent.py`
2. Ostavi prozor otvoren (agent sluša na `http://localhost:8765`).
3. U aplikaciji, ekran **Nadzor** → **Pokreni sken**. Statusi postaju zeleni (online + ms) / crveni (offline).

Zahtjevi: instaliran **Python 3**; paketi `fastapi uvicorn icmplib` (instalira ih `.bat`). Radi i bez administratorskih prava (fallback na sistemski `ping`). Agent ništa ne šalje na internet.

## Razvoj (uređivanje aplikacije)

Ne uređuj `Topologija-mreze-offline.html` ručno — on je **generisan**. Izvor je u `izvor/`, a offline fajl se pravi skriptom:

```bash
python build.py
```

Kompletna pravila i radni ciklus: vidi **[RAZVOJ.md](RAZVOJ.md)**.

## Fajlovi

- `Topologija-mreze-offline.html` — gotov offline alat (generisano; ovo ide na offline računar).
- `agent.py` — lokalni agent za Nadzor (ping/traceroute/sken). Ide na računar na mreži.
- `pokreni-agent.bat` — pokretanje agenta duplim klikom (Windows).
- `izvor/` — izvorni kod (UI + logika + runtime).
- `vendor/` — zamrznute biblioteke (React, Babel, fontovi) za offline build.
- `build.py` — sklapa offline fajl iz izvora.

## Šta ide na računar (na mreži)

Za pun rad prekopiraj tri fajla: `Topologija-mreze-offline.html`, `agent.py`, `pokreni-agent.bat`.
Bez agenta aplikacija radi normalno (dokumentacija, izvoz), samo Nadzor ne pinga uživo.
