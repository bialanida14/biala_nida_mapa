# Biała Nida — publikacja WWW (wydanie 19)

**Gotowy statyczny katalog na GitHub Pages.** Wgraj zawartość tego katalogu bez katalogu nadrzędnego.

## Najprostsza publikacja

1. Zachowaj lokalną kopię dotychczasowego repozytorium i sprawdź, jakie dane wolno udostępnić publicznie.
2. Rozpakuj archiwum. Wejdź do katalogu `Biala_Nida_GitHub_Pages_GOTOWE`.
3. Otwórz https://github.com/bialanida14/biala_nida_mapa (jeśli ten adres jest nadal aktualny).
4. W zakładce **Code** wybierz **Add file → Upload files**, przeciągnij pliki **oraz foldery z wnętrza rozpakowanego katalogu** na stronę. `index.html` musi leżeć w głównym katalogu repozytorium, a nie wewnątrz podfolderu.
5. Wybierz **Commit changes**. Jeśli GitHub odmówi przesłania folderów w przeglądarce, użyj GitHub Desktop i skopiuj zawartość archiwum do lokalnego klonu repozytorium (potem Commit i Push).
6. Wejdź w **Settings → Pages → Build and deployment**. Źródło: **Deploy from a branch**; gałąź: `main`; folder: `/(root)`; Save, jeśli nie ustawiono wcześniej.
7. Otwórz https://bialanida14.github.io/biala_nida_mapa/ i sprawdź checklistę z `TEST_PO_PUBLIKACJI.md`.

Jeśli serwis jest już skonfigurowany, zazwyczaj wystarczy zastąpienie plików i commit.

## Dane i bezpieczeństwo (ważne)

W archiwum znajdują się wyłącznie 226 działek z 4 polami: identyfikator, numer, obręb i powierzchnia. Nie zawiera wcześniejszych danych KW, aktów ani 1013 działek sąsiednich.

**Nadpisanie pliku `index.html` nie usuwa jego starszych wersji z historii Git!** Wcześniejsze publiczne pliki mogły zawierać dane prawne, a GitHub może nadal udostępniać je w historii. Jeśli trzeba ograniczyć ich publiczną dostępność, rozważ stworzenie **nowego repozytorium z czystą historią** i publikację nowego adresu; dodatkowo przeanalizuj historię i cache poprzedniego repozytorium. Samo usunięcie plików nie gwarantuje wycofania już udostępnionych danych.

**Do publikacji ortofotomapy koniecznie potwierdź prawo do jej ponownego publicznego udostępnienia i wymagane oznaczenia źródła/licencji.** Plik dostarczony wcześniej jest w pakiecie; praw do jego rozpowszechniania nie zweryfikowano.

## Zawartość

- `index.html` — strona
- `assets/app.js`, `assets/style.css` — interfejs i funkcje
- `data/dzialki.geojson` — 226 działek
- `data/strefa100m.geojson` — orientacyjna strefa 100 m
- `biala_nida_ortofoto_hd.webp` — lokalny obraz 9000×6000 (georeferencja odzyskana z wcześniejszej mapy)
- `tiles/` — miejsce na opcjonalne kafelki
- `.nojekyll` — plik techniczny GitHub Pages
- `TEST_PO_PUBLIKACJI.md` — kontrola wdrożenia

Wymagane połączenie internetowe dla biblioteki Leaflet i podkładu OpenStreetMap oraz usług WMS. Lokalny obraz i dane działek są plikami repozytorium. Pojedynczy obraz 9000×6000 pikseli nie zyskuje detali podczas zoomu; w przyszłości możliwe kafelkowanie z georeferencją.

## Ograniczenia weryfikacji

Walidowano strukturę i identyfikatory GeoJSON, zgodność zasobów i składnię JavaScript. Pełnego testu w przeglądarce nie udało się wykonać, ponieważ środowisko testowe blokuje adresy lokalne. Test po publikacji jest obowiązkowy.
