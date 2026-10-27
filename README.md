# Wirtualne Okno — etap PoC

Całe zdjęcie kubka ustawione kilkanaście cm „za” ekranem. Ruch myszy udaje ruch głowy,
a obraz zmienia się tak, jakby patrzeć przez prawdziwe okno. Bez śledzenia twarzy.

## Uruchomienie

```bash
npm install
npm run dev
```

Otwórz `http://localhost:5173`.

## Pliki

- `docs/` — sprawozdanie wstępne z opisem projektu i etapu PoC.
- `src/main.js` — cały program (ok. 100 linii). Na górze są ustawienia.
- `index.html` — strona z jednym canvasem na cały ekran.
- `public/mug.png` — zdjęcie. Z iPhone'a (HEIC) konwertuje się poleceniem:
  ```bash
  sips -s format png -Z 2048 public/mug.HEIC --out public/mug.png
  ```
  Pliki `.HEIC` nie trafiają do repozytorium (`.gitignore`), bo zawierają m.in. lokalizację GPS.
- `public/depth.png` — mapa głębi tego zdjęcia (jasne = blisko, ciemne = daleko). iPhone zapisuje ją
  w pliku HEIC; wyciąga się ją poleceniem:
  ```bash
  swift tools/depth-from-heic.swift public/mug.HEIC public/depth.png
  ```
  Dla zdjęcia bez głębi można ją wygenerować modelem AI (np. demo *Depth Anything V2* na Hugging Face).

## Co sprawdzamy (z sprawozdania)

1. **Skalowanie** — `PX_PER_CM` w `src/main.js` musi pasować do ekranu (szerokość ekranu w px / szerokość w cm).
2. **Maskowanie krawędzi** — oknem jest cały ekran, a ramą obudowa monitora.
   Zdjęcie jest powiększane tak, żeby przy ruchu głowy nigdy nie było widać jego krawędzi.
3. **Oświetlenie** — jasność zdjęcia klawiszami `+` / `-`.

Pozostałe klawisze: `F` — pełny ekran, `W` — pokaż siatkę.

## Jak to działa

Wszystko liczymy w centymetrach. Ekran (okno) leży w `z = 0`, zdjęcie w `z = -PHOTO_DEPTH`, oko w `z = EYE_DISTANCE`.
Kamera stoi w miejscu oka, a jej ostrosłup widzenia jest „przyklejony” do krawędzi okna
(projekcja off-axis, funkcja `updateCamera`). Gdy oko się przesuwa, ostrosłup robi się niesymetryczny —
dokładnie tak, jak wygląda widok przez prawdziwe okno.

Zdjęcie nie jest płaskie: to siatka 256 × 192 punktów, którą `displacementMap` wypycha do przodu
według mapy głębi (białe miejsca o `RELIEF` cm). Dzięki temu przy ruchu głowy blat, kubek i ściana
przesuwają się o różne odległości (paralaksa). Klawisz `W` pokazuje tę siatkę. Na krawędziach kubka
zdjęcie się rozciąga, bo to wciąż jedna ciągła powierzchnia — to znane ograniczenie tej metody.
