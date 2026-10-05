# Teleo – modlitwy i afirmacje

> **Dokument projektowy + instrukcja implementacji dla Claude Code.**
> Wersja specyfikacji: 1.0 · Rynki: Polska 🇵🇱, USA 🇺🇸 · Typ: PWA (Progressive Web App) · Hosting: GitHub Pages · Koszt utrzymania: **0 zł / $0**

Nazwa: **Teleo** (gr. *τελέω* – „doprowadzać do końca, wypełniać”). Nazwa dobrze oddaje cel: nie tylko przeczytać, ale faktycznie **wypowiedzieć i ukończyć**.

- PL: **Teleo – modlitwy i afirmacje**
- EN: **Teleo – prayers & affirmations**

---

## 0. Instrukcje dla Claude Code (przeczytaj najpierw)

1. Traktuj ten plik jako **jedyne źródło prawdy** o produkcie. Jeśli coś jest niejasne – wybierz rozwiązanie najprostsze, zgodne z zasadą „zero kosztów, zero backendu”, i zapisz decyzję w `docs/DECISIONS.md`.
2. Pracuj **etapami** z sekcji 14 (Plan implementacji). Po każdym etapie: `npm run build`, `npm run test`, commit z opisem etapu.
3. Najważniejszy i najbardziej krytyczny moduł to **silnik porównywania wypowiedzi** (sekcja 6). Napisz go jako czysty TypeScript bez zależności od UI i pokryj testami jednostkowymi (Vitest) **przed** budową ekranu sesji.
4. Kod, nazwy plików, komentarze i commity – po angielsku. Teksty UI – przez i18n (PL + EN), nigdy na sztywno w komponentach.
5. Nie dodawaj żadnych płatnych usług, kluczy API, trackerów ani analityki zewnętrznej.
6. Utwórz na starcie plik `CLAUDE.md` w repo ze skrótem: stack, komendy, konwencje, link do tej specyfikacji (`docs/TELEO_SPEC.md` – skopiuj tam ten plik).

---

## 1. Wizja i cel

**Cel:** pomóc i zmotywować użytkownika do regularnego wypowiadania na głos wybranych modlitw, afirmacji i sentencji – oraz rzetelnie śledzić, **co faktycznie zostało wypowiedziane, ile razy i jak regularnie**.

**Kluczowa różnica wobec konkurencji:** aplikacja nie ufa deklaracji „zrobione” – weryfikuje mowę. Użytkownik mówi, aplikacja transkrybuje, porównuje ze źródłem zdanie po zdaniu i zalicza tylko poprawne wypowiedzi.

### Persony
| Persona | Rynek | Potrzeba |
|---|---|---|
| **Anna, 34**, praktykująca katoliczka | PL | Chce codziennie odmawiać dziesiątkę różańca i nie „przelatywać” modlitwy wzrokiem. |
| **Mike, 28**, self-development | US | Codzienne afirmacje poranne, chce streaków i poczucia postępu. |
| **Kasia, 22**, uczy się tekstu na pamięć | PL/US | Psalm, wiersz, przemówienie – chce ćwiczyć zdanie po zdaniu z weryfikacją. |
| **Grace, 45**, protestantka | US | Modlitwy i wersety po angielsku, spokojny, niegamingowy wygląd. |

### Zasady produktowe
- **Local-first i prywatność** – wszystkie dane tylko na urządzeniu użytkownika. Brak kont, brak serwera.
- **Neutralność światopoglądowa** – ta sama aplikacja służy modlitwie i świeckim afirmacjom; użytkownik wybiera, co widzi (onboarding).
- **Motywacja bez poczucia winy** – gamifikacja nagradza regularność, ale nie karze brutalnie za przerwy (zamrożenia serii, osiągnięcia za powrót).
- **Szybkość do działania** – od otwarcia aplikacji do pierwszego wypowiedzianego zdania: maksymalnie 2 tapnięcia.

---

## 2. Zakres funkcjonalny

### 2.1 MVP (wersja 1.0)
1. Biblioteka tekstów: wbudowane (PL/EN) + własne użytkownika.
2. Automatyczny podział tekstu na segmenty (domyślnie zdania) z ręczną korektą.
3. Sesje: lista 1–150 segmentów, budowana z tekstów, z powtórzeniami.
4. Rozpoznawanie mowy PL i EN, porównanie ze źródłem, próg 95%, zero dodatkowych słów.
5. Liczniki powtórzeń (segmentów i całych tekstów), historia prób.
6. Gamifikacja: XP, poziomy, osiągnięcia (globalne + automatycznie podpinane do każdego tekstu), serie dni, cel dzienny.
7. Statystyki: kalendarz aktywności, liczniki per tekst, skuteczność.
8. PWA: instalacja, działanie offline (poza silnikiem Web Speech, patrz 5.2), UI w PL i EN.
9. Eksport/import kopii zapasowej (JSON).

### 2.2 Poza MVP (backlog, v1.x)
- Tryb pamięciowy z progresywnym ukrywaniem słów (patrz 7.3 – zaprojektowany, można wdrożyć w v1.1).
- Offline’owy silnik Whisper w przeglądarce (patrz 5.3).
- Kolejne języki (ES, DE, UK) – architektura od początku wielojęzyczna.
- Udostępnianie tekstów/sesji linkiem (dane zakodowane w URL, bez serwera).

---

## 3. Stack technologiczny (100% darmowy)

| Obszar | Wybór | Uzasadnienie |
|---|---|---|
| Build | **Vite** + **TypeScript** | Szybki, statyczny output idealny pod GitHub Pages. |
| UI | **React** + **react-router** (`HashRouter`) | Najlepiej wspierany przez Claude Code; `HashRouter` omija problem 404 przy odświeżaniu podstron na GitHub Pages. |
| Style | **Tailwind CSS** | Szybkie, spójne UI, mały bundle. |
| Stan | **Zustand** | Lekki, prosty. |
| Baza danych | **IndexedDB** przez **Dexie.js** (+ `dexie-react-hooks`) | Lokalna, trwała, reaktywna, bez backendu. |
| PWA | **vite-plugin-pwa** (Workbox) | Manifest, service worker, precache, aktualizacje. |
| i18n | **i18next** + **react-i18next** | Standard; łatwe dodawanie języków. |
| Mowa → tekst | **Web Speech API** (domyślnie) + **Whisper w przeglądarce** przez `@huggingface/transformers` (fallback, v1.1) | Oba darmowe, bez kluczy API. Szczegóły w sekcji 5. |
| Tekst → mowa (opcjonalnie) | **speechSynthesis** (Web Speech API) | Darmowe odczytanie zdania na głos przy nauce nowego tekstu. |
| Podział na zdania | **Intl.Segmenter** (`granularity: 'sentence'`) + reguły własne | Wbudowany w przeglądarkę, rozumie locale `pl`/`en`. |
| Testy | **Vitest** (unit), opcjonalnie **Playwright** (e2e) | Darmowe. |
| Hosting / CI | **GitHub Pages** + **GitHub Actions** | Darmowe. **Uwaga:** na darmowym planie GitHub repozytorium musi być **publiczne**, by działały Pages. |

Wersje bibliotek: aktualne stabilne w momencie inicjalizacji projektu.

---

## 4. Architektura

```
┌─────────────────────────── Przeglądarka (PWA) ───────────────────────────┐
│  UI (React)  ──►  Stores (Zustand)  ──►  Domain services                 │
│                                          ├─ segmenter/                   │
│                                          ├─ matcher/   (porównanie)      │
│                                          ├─ speech/    (silniki STT)     │
│                                          ├─ gamification/ (XP, rules)    │
│                                          └─ stats/                       │
│                         Dexie (IndexedDB)  ◄──────────┘                  │
│  Service Worker (Workbox): precache app shell, cache modeli Whisper      │
└──────────────────────────────────────────────────────────────────────────┘
        │ (tylko silnik Web Speech w Chrome/Edge/Safari może wysyłać
        ▼  audio do serwerów dostawcy przeglądarki – patrz 5.2 i 12)
```

### 4.1 Struktura katalogów
```
teleo/
├─ CLAUDE.md
├─ docs/
│  ├─ TELEO_SPEC.md
│  └─ DECISIONS.md
├─ public/
│  ├─ icons/            (192, 512, maskable, apple-touch-icon)
│  └─ privacy.html      (polityka prywatności PL/EN)
├─ src/
│  ├─ app/              (router, layout, providers)
│  ├─ screens/          (Today, Library, TextEditor, Sessions, SessionPlayer,
│  │                     SessionSummary, Progress, Settings, Onboarding)
│  ├─ components/
│  ├─ domain/
│  │  ├─ segmenter/     (splitIntoSegments.ts + testy)
│  │  ├─ matcher/       (normalize.ts, align.ts, evaluate.ts + testy)
│  │  ├─ speech/        (SpeechEngine.ts, WebSpeechEngine.ts, WhisperEngine.ts, whisper.worker.ts)
│  │  ├─ gamification/  (xp.ts, levels.ts, achievements.ts, rules.json, streaks.ts)
│  │  └─ stats/
│  ├─ db/               (schema.ts, migrations, seed/)
│  ├─ content/          (builtin texts: pl.json, en.json)
│  ├─ i18n/             (pl.json, en.json)
│  └─ main.tsx
├─ .github/workflows/deploy.yml
└─ vite.config.ts
```

---

## 5. Rozpoznawanie mowy (STT)

### 5.1 Abstrakcja silnika
```ts
interface SpeechEngine {
  id: 'webspeech' | 'whisper';
  isSupported(): Promise<boolean>;
  start(opts: { lang: 'pl-PL' | 'en-US'; onInterim?: (text: string) => void }): Promise<void>;
  stop(): Promise<SpeechResult>;        // ręczne zakończenie
  abort(): void;
}
interface SpeechResult {
  alternatives: string[];               // najlepsze N transkrypcji
  durationMs: number;
  engine: 'webspeech' | 'whisper';
}
```
Silnik wybierany automatycznie (feature detection), z możliwością zmiany w Ustawieniach.

### 5.2 Silnik domyślny: Web Speech API
- `SpeechRecognition || webkitSpeechRecognition`.
- Ustawienia: `lang` wg języka tekstu (`pl-PL` / `en-US`), `interimResults = true` (podgląd na żywo), `maxAlternatives = 3`, `continuous = true` + własny timer ciszy (np. 1,5 s po ostatnim wyniku → koniec), bo przy `continuous = false` przeglądarka ucina dłuższe zdania.
- Ocena: matcher sprawdza **wszystkie alternatywy** i bierze najlepszą (zwiększa trafność bez obniżania progu).
- Wsparcie: Chrome/Edge (desktop i Android), Safari (macOS, iOS). **Firefox – brak** → fallback Whisper.
- **Prywatność:** w części przeglądarek (np. Chrome) audio jest przetwarzane na serwerach dostawcy przeglądarki. Aplikacja **musi** o tym jasno poinformować przy pierwszym użyciu mikrofonu i w polityce prywatności. Jeśli przeglądarka udostępnia rozpoznawanie lokalne (on-device), wykryj to i preferuj (feature detection, bez twardych założeń o wersjach).
- iOS: w trybie standalone (zainstalowana PWA) historycznie bywały problemy z rozpoznawaniem mowy – przetestować na urządzeniu; w razie błędu pokazać komunikat i zaproponować Whisper.

### 5.3 Silnik offline: Whisper w przeglądarce (v1.1)
- `@huggingface/transformers` w **Web Workerze**, WebGPU gdy dostępne, inaczej WASM.
- Modele wielojęzyczne do wyboru w Ustawieniach: `whisper-tiny` (najmniejszy, słabszy dla PL) i `whisper-base` (zalecany kompromis). Pobierane **na żądanie** z Hugging Face, cache w Cache Storage, potem działa w pełni offline.
- Przed pobraniem pokaż rozmiar modelu i ostrzeżenie o transferze danych mobilnych.
- Nagrywanie: `MediaRecorder`/`AudioWorklet` → 16 kHz mono → worker → transkrypcja z wymuszonym językiem (`pl`/`en`).
- Zaleta: 100% prywatności, działa w Firefoxie. Wada: wolniejszy, ciężki na starszych telefonach.

### 5.4 Nagrania
Audio **nie jest zapisywane**. Przechowywana jest tylko transkrypcja (z opcją wyłączenia jej zapisu w Ustawieniach – wtedy zapisujemy tylko wynik oceny).

---

## 6. Silnik porównywania (matcher) – serce aplikacji

### 6.1 Reguła akceptacji (wymaganie biznesowe)
Segment jest **zaliczony**, gdy jednocześnie:
1. **Pokrycie ≥ 95%** – co najmniej 95% słów źródła zostało wypowiedzianych (dopasowanych),
2. **Zero słów dodatkowych** – w wypowiedzi nie ma żadnego słowa spoza źródła.

`coverage = matchedWords / sourceWords`

Konsekwencja do zakomunikowania w UI (tooltip „Jak liczymy?”): dla zdań krótszych niż 20 słów próg 95% oznacza w praktyce **100%** (np. 1 pominięte słowo z 10 = 90%). Pominięcie jednego słowa jest dopuszczalne dopiero od 20 słów w zdaniu.

### 6.2 Normalizacja (obie strony: źródło i transkrypcja)
Kolejność kroków:
1. Unicode NFC, małe litery (locale-aware: `toLocaleLowerCase(lang)`).
2. Usunięcie interpunkcji i symboli (`.,;:!?…"„”«»()[]–—-` itd.); myślnik między słowami → spacja.
3. Ujednolicenie apostrofów (`’` → `'`).
4. **EN:** rozwinięcie skrótów (`I'm → i am`, `don't → do not`, `you're → you are`, `it's → it is`, `we'll → we will`, `can't → cannot`, `won't → will not` …) – po obu stronach, więc „I'm” i „I am” są równoważne.
5. **Liczby:** jeśli token jest liczbą zapisaną cyframi, zamień na kanoniczną formę; słowne liczebniki PL/EN (0–1000, podstawowe formy) zamień na cyfry. Zalecenie w edytorze: pisz liczby słownie.
6. Tokenizacja po białych znakach.
7. Usunięcie **wypełniaczy** tylko z transkrypcji: PL `yyy, eee, hmm, mmm`, EN `um, uh, er, hmm, mm` (patrz uzasadnienie w sekcji 15).
8. Dla porównania „miękkiego” dodatkowo wersja bez polskich znaków diakrytycznych (`ą→a, ć→c, ę→e, ł→l, ń→n, ó→o, ś→s, ź→z, ż→z`).

### 6.3 Dopasowanie słów
Wyrównanie sekwencji tokenów źródła `S` i transkrypcji `T` algorytmem **edit distance na poziomie słów** (Needleman–Wunsch / Levenshtein z backtrackingiem). Operacje:

| Operacja | Znaczenie | Wpływ |
|---|---|---|
| `match` | słowo identyczne po normalizacji | +1 dopasowane |
| `near` | słowo podobne (błąd STT), patrz niżej | +1 dopasowane, oznaczone jako „przybliżone” |
| `missing` (deletion) | słowo źródła nie padło | obniża pokrycie |
| `extra` (insertion) | dodatkowe słowo w wypowiedzi | **odrzucenie** |
| `wrong` (substitution) | inne słowo w miejscu słowa źródła | tryb ścisły: traktowane jak słowo dodatkowe → **odrzucenie** |

**Near-match** (tolerancja błędów rozpoznawania, nie użytkownika):
- porównanie po zdjęciu diakrytyków; lub
- dla słów o długości ≥ 4: podobieństwo znakowe `1 - levenshtein(a,b)/max(len)` ≥ **0,8**;
- słowa ≤ 3 znaków: tylko dokładne dopasowanie (po zdjęciu diakrytyków).

Koszty w DP: `match = 0`, `near = 0.2`, `missing = 1`, `extra = 1`, `wrong = 1.5` (preferuje interpretację „pominięte + dodane” tylko gdy to faktycznie lepsze dopasowanie).

### 6.4 Tryby rygoru (Ustawienia)
- **Ścisły (domyślny, zgodny z wymaganiem):** `extra = 0` i `wrong = 0`, `coverage ≥ 0.95`.
- **Łagodny (opcjonalny):** `wrong` liczone jako słowo pominięte, nie dodatkowe; `extra` nadal = 0. Dla osób, u których STT często myli słowa.
Tryb zapisywany przy każdej próbie (dla uczciwości statystyk).

### 6.5 Wynik
```ts
interface MatchResult {
  accepted: boolean;
  coverage: number;            // 0..1
  matched: number; near: number; missing: number; extra: number; wrong: number;
  ops: Array<{ op: 'match'|'near'|'missing'|'extra'|'wrong'; source?: string; spoken?: string }>;
  bestAlternativeIndex: number;
}
```
UI pokazuje diff: słowa zielone (dopasowane), żółte (przybliżone), szare przekreślone (pominięte), czerwone (dodatkowe/błędne) + krótki komunikat, np. „Dodatkowe słowo: *bardzo*. Spróbuj jeszcze raz.”

### 6.6 Obowiązkowe przypadki testowe (Vitest)
| Źródło | Wypowiedź | Oczekiwane |
|---|---|---|
| `Jestem spokojny i pewny siebie.` | `jestem spokojny i pewny siebie` | ✅ |
| `Jestem spokojny i pewny siebie.` | `jestem bardzo spokojny i pewny siebie` | ❌ extra |
| `Jestem spokojny i pewny siebie.` | `jestem spokojny pewny siebie` | ❌ coverage 80% |
| 20-słowne zdanie | pominięte 1 słowo | ✅ (95%) |
| 20-słowne zdanie | pominięte 2 słowa | ❌ (90%) |
| `I am enough.` | `I'm enough` | ✅ (rozwinięcie skrótu) |
| `Zdrowaś Maryjo, łaski pełna` | `zdrowas maryjo laski pelna` | ✅ (near, diakrytyki) |
| `I am grateful for today.` | `um I am grateful for today` | ✅ (wypełniacz) |
| `I am grateful for today.` | `I am grateful for for today` | ❌ extra (powtórzone słowo) |
| `Mam 10 celów.` | `mam dziesięć celów` | ✅ (liczby) |
| `Chleba naszego powszedniego` | `chleba waszego powszedniego` | ✅ near (1 litera, dł. ≥ 4) |
| `I am calm` | `I am cold` | ❌ wrong (słowo ≤ 4, zbyt różne) |
| dowolne | pusta transkrypcja | ❌, komunikat „Nic nie usłyszałem” |

---

## 7. Teksty i segmentacja

### 7.1 Typy treści
`affirmation` (afirmacja) · `prayer` (modlitwa) · `text` (tekst / sentencja / wiersz).
Każdy tekst ma **jeden język** (`pl` | `en`) – wyznacza język rozpoznawania mowy.

### 7.2 Algorytm podziału na segmenty
1. `Intl.Segmenter(lang, { granularity: 'sentence' })`; fallback regex na `[.!?…]` + wielka litera.
2. Ochrona skrótów przed błędnym cięciem: PL `np., itd., itp., tzn., św., ks., dr., prof., r., w.`; EN `Mr., Mrs., Dr., St., e.g., i.e., vs.`.
3. Tryb alternatywny: **każda linia = segment** (przydatne dla afirmacji wklejanych jako lista i dla wierszy).
4. **Długie zdania > 40 słów** → sugerowany podział po `;` / `:` / `,` najbliżej środka (użytkownik zatwierdza). Powód: rozpoznawanie mowy traci trafność przy długich wypowiedziach, a timeouty przeglądarki ucinają nagranie.
5. Segmenty < 3 słów (np. „Amen.”) → sugestia scalenia z poprzednim.
6. Podgląd w edytorze: lista segmentów z przyciskami **Podziel tutaj / Scal z następnym / Edytuj**.
7. Limit: maks. 150 segmentów na tekst (spójne z limitem sesji), maks. 80 słów na segment.

### 7.3 Tryby wyświetlania w sesji
- **Czytanie** (domyślny) – pełny tekst segmentu widoczny.
- **Pamięciowy** (v1.1) – poziomy: pierwsze litery słów → co drugie słowo ukryte → tekst ukryty (podpowiedź na przytrzymanie). Liczy się do osiągnięć „Na pamięć”.
- **Posłuchaj najpierw** – opcjonalne odczytanie segmentu przez `speechSynthesis` przed wypowiedzeniem (nauka nowych tekstów).

### 7.4 Treści wbudowane (seed)
Wszystkie teksty wbudowane mogą być przez użytkownika ukryte, a do edycji – skopiowane jako własne. Używać wyłącznie tekstów w domenie publicznej lub napisanych od zera.

**PL – modlitwy (tradycyjne teksty liturgiczne):**
- *Ojcze nasz* – „Ojcze nasz, któryś jest w niebie, święć się imię Twoje, przyjdź królestwo Twoje, bądź wola Twoja jako w niebie, tak i na ziemi. Chleba naszego powszedniego daj nam dzisiaj. I odpuść nam nasze winy, jako i my odpuszczamy naszym winowajcom. I nie wódź nas na pokuszenie, ale nas zbaw ode złego. Amen.”
- *Zdrowaś Maryjo* – „Zdrowaś Maryjo, łaski pełna, Pan z Tobą, błogosławionaś Ty między niewiastami i błogosławiony owoc żywota Twojego, Jezus. Święta Maryjo, Matko Boża, módl się za nami grzesznymi teraz i w godzinę śmierci naszej. Amen.”
- *Chwała Ojcu* – „Chwała Ojcu i Synowi, i Duchowi Świętemu. Jak była na początku, teraz i zawsze, i na wieki wieków. Amen.”
- *Aniele Boży* – „Aniele Boży, stróżu mój, Ty zawsze przy mnie stój. Rano, wieczór, we dnie, w nocy bądź mi zawsze ku pomocy. Strzeż duszy, ciała mego i zaprowadź mnie do żywota wiecznego. Amen.”

**EN – prayers (traditional public-domain wording):**
- *The Lord’s Prayer* – “Our Father, who art in heaven, hallowed be thy name; thy kingdom come; thy will be done on earth as it is in heaven. Give us this day our daily bread. And forgive us our trespasses, as we forgive those who trespass against us. And lead us not into temptation, but deliver us from evil. Amen.”
- *Hail Mary* – “Hail Mary, full of grace, the Lord is with thee. Blessed art thou among women, and blessed is the fruit of thy womb, Jesus. Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.”
- *Glory Be* – “Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.”
- *Psalm 23* (King James Version, domena publiczna) – pełny tekst do wklejenia w seed.

**PL – afirmacje (autorskie, zestaw „Poranek”):**
Jestem spokojny i skupiony. · Każdego dnia staję się lepszą wersją siebie. · Mam w sobie siłę, by poradzić sobie z tym dniem. · Zasługuję na dobro i szacunek. · Moje myśli są jasne, a decyzje przemyślane. · Jestem wdzięczny za to, co mam. · Uczę się na błędach i idę dalej. · Dbam o swoje ciało i umysł. · Robię dziś małe kroki w stronę moich celów. · Wybieram spokój zamiast pośpiechu.
(Wersje żeńskie: „spokojna”, „skupiona”, „gotowa” – wybór formy w onboardingu, patrz sekcja 15.)

**EN – affirmations (original, “Morning” set):**
I am calm and focused. · Every day I am becoming a better version of myself. · I have the strength to handle this day. · I deserve kindness and respect. · My mind is clear and my choices are wise. · I am grateful for what I have. · I learn from my mistakes and keep moving forward. · I take care of my body and my mind. · Today I take small steps toward my goals. · I choose peace over hurry.

**Sesje wbudowane:** „Poranne afirmacje” (10 segmentów), „Dziesiątka różańca” PL (Ojcze nasz ×1, Zdrowaś Maryjo ×10, Chwała Ojcu ×1), „Morning affirmations” EN, „Decade of the Rosary” EN.

---

## 8. Sesje

### 8.1 Definicje
- **Szablon sesji** – zapisana lista pozycji: `{ textId, segmentIds?: string[], repeat: number }`. Pozycja może być całym tekstem lub wybranymi segmentami.
- **Rozwinięta sesja** – płaska lista segmentów po uwzględnieniu powtórzeń. **Limit: 1–150 segmentów** (walidacja w kreatorze z licznikiem „87/150”).
- **Przebieg sesji (SessionRun)** – jedno faktyczne wykonanie sesji.

### 8.2 Szybki start
- Ekran „Dziś”: duży przycisk **„Rozpocznij”** uruchamiający ostatnio używaną lub przypiętą sesję.
- Z poziomu dowolnego tekstu: **„Powiedz teraz”** (sesja ad hoc z tego tekstu).
- „Sesja dnia”: automatyczna propozycja z tekstów, których dziś jeszcze nie wypowiedziano.

### 8.3 Przebieg (ekran odtwarzacza)
1. Na ekranie: bieżący segment dużą czcionką, poprzedni i następny wyszarzone, pasek postępu `12/40`, licznik XP w sesji.
2. Tap mikrofonu (lub **tryb bez rąk**: po zaliczeniu segmentu nasłuch startuje automatycznie po ~600 ms).
3. Podgląd transkrypcji na żywo (interim).
4. Ocena → ✅ animacja + wibracja (`navigator.vibrate`, gdzie dostępne) + automatyczne przejście; ❌ diff + „Spróbuj ponownie”.
5. Po **3 nieudanych próbach** pojawia się opcja „Pomiń” (segment niezaliczony, bez XP) – żeby użytkownik nie utknął.
6. Pauza/wyjście w dowolnym momencie; przebieg zapisuje się jako `partial`, można wznowić tego samego dnia.
7. **Screen Wake Lock API** – ekran nie gaśnie w trakcie sesji.
8. Ekran podsumowania: zaliczone segmenty, ukończone teksty, skuteczność pierwszej próby, zdobyte XP, nowe osiągnięcia, postęp celu dziennego i serii.

### 8.4 Liczenie powtórzeń
- **Powtórzenie segmentu** = zaakceptowana próba tego segmentu.
- **Powtórzenie tekstu** = wszystkie segmenty tekstu zaliczone w ramach jednego przebiegu sesji, w kolejności (poprawki dozwolone, pominięcia – nie). Tekst powtórzony 10× w sesji daje 10 powtórzeń.
- Dla afirmacji jednozdaniowej: powtórzenie segmentu = powtórzenie tekstu.

### 8.5 Dzień i seria
- „Dzień” liczony w czasie lokalnym z **konfigurowalną godziną początku dnia (domyślnie 03:00)** – modlitwa o 00:30 liczy się do poprzedniego dnia.
- **Dzień aktywny** = co najmniej 1 zaliczony segment. **Cel dzienny** (domyślnie 10 segmentów, konfigurowalny 1–150) – osobny od aktywności.
- **Seria (streak)** = liczba kolejnych dni aktywnych.

---

## 9. Gamifikacja

### 9.1 Założenia projektowe
- Nagradzamy trzy rzeczy, w tej kolejności ważności: **regularność** > **wolumen** > **precyzja**.
- Punkty rosną z wysiłkiem (dłuższe zdania = więcej XP), ale krótkie afirmacje nie są „nieopłacalne”.
- Brak kar odejmujących XP. Przerwy łagodzone przez **zamrożenia serii** i osiągnięcie **„Powrót”**.
- Wizualnie spokojnie: metafora **wzrostu rośliny** (neutralna dla modlitwy i afirmacji), bez agresywnej estetyki gier.

### 9.2 Punkty doświadczenia (XP)
| Zdarzenie | XP |
|---|---|
| Zaliczony segment | `5 + liczba słów` (maks. 30) |
| Zaliczenie za pierwszym podejściem | +2 |
| Ukończony tekst (wszystkie segmenty w przebiegu) | +20% sumy XP segmentów tego tekstu |
| Ukończona sesja (≥ 1 segment, bez pominięć) | +25 |
| Osiągnięty cel dzienny (raz dziennie) | +50 |
| Odblokowane osiągnięcie | wg rangi (9.4) |

**Mnożnik serii** (dotyczy XP z segmentów): seria 3+ dni ×1,1 · 7+ ×1,25 · 30+ ×1,5 (maksimum).
XP zapisywane w **księdze XP** (`xpLedger`) – każda pozycja z powodem – co pozwala przeliczyć stan i uniknąć błędów.

### 9.3 Poziomy
Próg łączny: `XP(n) = 250 · n · (n − 1)`. Przy typowych ~350–450 XP dziennie: poziom 5 po ~2 tygodniach, 10 po ~2 miesiącach, 20 po ~8–9 miesiącach.

| Poz. | XP łącznie | PL | EN |
|---|---|---|---|
| 1 | 0 | Ziarno | Seed |
| 2 | 500 | Kiełek | Sprout |
| 3 | 1 500 | Siewka | Seedling |
| 4 | 3 000 | Pęd | Shoot |
| 5 | 5 000 | Łodyga | Stem |
| 6 | 7 500 | Liść | Leaf |
| 7 | 10 500 | Pąk | Bud |
| 8 | 14 000 | Kwiat | Blossom |
| 9 | 18 000 | Owoc | Fruit |
| 10 | 22 500 | Krzew | Shrub |
| 11 | 27 500 | Młode drzewo | Sapling |
| 12 | 33 000 | Drzewo | Tree |
| 13 | 39 000 | Mocne korzenie | Deep Roots |
| 14 | 45 500 | Rozłożysta korona | Wide Canopy |
| 15 | 52 500 | Gaj | Grove |
| 16 | 60 000 | Sad | Orchard |
| 17 | 68 000 | Las | Forest |
| 18 | 76 500 | Stary las | Old-growth Forest |
| 19 | 85 500 | Ogród | Garden |
| 20 | 95 000 | Teleo | Teleo |

Po poziomie 20: **kręgi** (Teleo I, II, III…) co kolejne 25 000 XP – niekończący się postęp.
Ekran postępów pokazuje ilustrację rośliny zmieniającą się z poziomem (proste SVG, generowane w kodzie).

### 9.4 Rangi osiągnięć
| Ranga | XP za odblokowanie |
|---|---|
| Brąz | 50 |
| Srebro | 100 |
| Złoto | 250 |
| Platyna | 500 |
| Diament | 1000 |

### 9.5 Osiągnięcia per tekst (automatycznie podpinane do KAŻDEGO tekstu, także własnego)
Nazwa generowana z tytułem tekstu, np. „Ojcze nasz – 100 powtórzeń”.

| ID szablonu | Warunek | Ranga | PL | EN |
|---|---|---|---|---|
| `text.reps.1` | 1 powtórzenie tekstu | Brąz | Pierwsze słowo | First Word |
| `text.reps.7` | 7 powtórzeń | Brąz | Tydzień słów | Seven Times |
| `text.reps.21` | 21 | Srebro | Nawyk w drodze | Habit Forming |
| `text.reps.50` | 50 | Srebro | Pół setki | Half Hundred |
| `text.reps.100` | 100 | Złoto | Setka | Centurion |
| `text.reps.365` | 365 | Platyna | Rok słów | A Year of Words |
| `text.reps.1000` | 1000 | Diament | Tysiąc razy | Thousandfold |
| `text.streak.3` | tekst wypowiadany 3 dni z rzędu | Brąz | Trzy dni wierności | Three Faithful Days |
| `text.streak.7` | 7 dni z rzędu | Srebro | Tydzień wierności | Faithful Week |
| `text.streak.30` | 30 dni z rzędu | Złoto | Miesiąc wierności | Faithful Month |
| `text.streak.100` | 100 dni z rzędu | Platyna | Sto dni | Hundred Days |
| `text.perfect` | cały tekst zaliczony bez żadnej poprawki | Srebro | Bez zająknięcia | Flawless |
| `text.memory` | cały tekst w trybie pamięciowym (poziom „ukryty”) | Złoto | Na pamięć | By Heart |

Dla tekstów jednozdaniowych `text.perfect` wymaga 10 kolejnych zaliczeń za pierwszym podejściem (inaczej byłoby trywialne).

### 9.6 Osiągnięcia globalne
**Regularność (seria dni):**
| ID | Warunek | Ranga | PL | EN |
|---|---|---|---|---|
| `streak.2` | 2 dni z rzędu | Brąz | Drugi dzień | Day Two |
| `streak.5` | 5 dni | Brąz | Pięć dni | Five Days |
| `streak.7` | 7 dni | Srebro | Pełny tydzień | Full Week |
| `streak.14` | 14 dni | Srebro | Dwa tygodnie | Fortnight |
| `streak.30` | 30 dni | Złoto | Miesiąc | Month Strong |
| `streak.60` | 60 dni | Złoto | Dwa miesiące | Two Months |
| `streak.100` | 100 dni | Platyna | Setka dni | 100 Days |
| `streak.365` | 365 dni | Diament | Rok | One Full Year |

**Konsekwencja (łagodna alternatywa dla serii):**
| `weekly.5of7.x4` | 4 tygodnie z rzędu, w każdym ≥ 5 dni aktywnych | Złoto | Stały rytm | Steady Rhythm |
| `goal.days.30` | cel dzienny osiągnięty łącznie 30 razy | Złoto | Cel osiągnięty ×30 | Goal Crusher |

**Wolumen dzienny:**
| `daily.10` | 10 segmentów w jednym dniu | Brąz | Dziesiątka | Ten Today |
| `daily.25` | 25 | Brąz | Ćwierć setki | Twenty-Five |
| `daily.50` | 50 | Srebro | Pięćdziesiątka | Fifty in a Day |
| `daily.100` | 100 | Złoto | Setka dnia | Hundred in a Day |
| `daily.150` | 150 | Platyna | Maraton | Marathon |

**Wolumen łączny (segmenty):** 100 (Brąz) · 500 (Srebro) · 1 000 (Złoto) · 5 000 (Platyna) · 10 000 (Diament) · 50 000 (Diament, „Legenda / Legend”).

**Sesje:**
| `session.first` | pierwsza ukończona sesja | Brąz | Pierwsza sesja | First Session |
| `session.10` / `50` / `100` | liczba ukończonych sesji | Brąz/Srebro/Złoto | Sesje ×N | Sessions ×N |
| `session.perfect` | sesja ≥ 10 segmentów, wszystkie za pierwszym razem | Srebro | Czysta sesja | Clean Session |
| `session.long` | sesja 150 segmentów bez pominięć | Złoto | Pełna setka i pół | The Full 150 |

**Pora dnia i nawyki:**
| `time.morning.7` | 7 dni z aktywnością przed 8:00 | Srebro | Ranny ptaszek | Early Bird |
| `time.evening.7` | 7 dni z aktywnością po 21:00 | Srebro | Wieczorna cisza | Evening Calm |

**Inne:**
| `create.1` | dodanie pierwszego własnego tekstu | Brąz | Własne słowa | My Own Words |
| `create.5` | 5 własnych tekstów | Srebro | Autor | Author |
| `bilingual` | zaliczone segmenty w PL i EN tego samego dnia | Srebro | Dwujęzyczny | Bilingual |
| `comeback` | powrót po ≥ 3 dniach przerwy | Brąz | Powrót | Welcome Back |
| `level.5` / `10` / `20` | osiągnięcie poziomu | Srebro/Złoto/Diament | Poziom N | Level N |

### 9.7 Zamrożenia serii (streak freeze)
- 1 zamrożenie zdobywane za każde 7 dni serii; maks. 2 w zapasie.
- Dzień bez aktywności automatycznie zużywa zamrożenie (seria trwa, ale dzień nie jest aktywny i nie liczy się do `streak.N`… – liczy się do ciągłości).
- Komunikat następnego dnia: „Twoja seria jest bezpieczna – użyliśmy zamrożenia”.

### 9.8 Silnik reguł
Osiągnięcia jako **dane** (`rules.json`), nie kod:
```json
{ "id": "text.reps.100", "scope": "text", "metric": "textRepetitions", "threshold": 100, "tier": "gold" }
```
- `scope: "text"` → reguła ewaluowana dla każdego tekstu (także nowo dodanego – nic nie trzeba tworzyć ręcznie).
- Ewaluacja po każdej zaakceptowanej próbie i na końcu sesji, na podstawie zagregowanych liczników (`stats`).
- Odblokowanie idempotentne (klucz `ruleId + textId`).
- Ukryte osiągnięcia (np. `time.*`, `comeback`) pokazane jako „???” do odblokowania.

---

## 10. Model danych (Dexie / IndexedDB)

```ts
db.version(1).stores({
  texts:        'id, lang, type, source, archived, updatedAt',
  segments:     'id, textId, [textId+order]',
  sessionTemplates: 'id, pinned, updatedAt',
  sessionRuns:  'id, templateId, dayKey, startedAt, status',
  attempts:     'id, segmentId, textId, sessionRunId, dayKey, timestamp, accepted',
  dailyStats:   'dayKey',                    // agregaty dzienne
  textStats:    'textId',                    // agregaty per tekst
  achievements: 'key, ruleId, textId, unlockedAt',
  xpLedger:     '++id, timestamp, reason',
  settings:     'key'
});
```

```ts
type Lang = 'pl' | 'en';
type TextType = 'affirmation' | 'prayer' | 'text';

interface TextItem { id: string; title: string; type: TextType; lang: Lang;
  body: string; source: 'builtin' | 'user'; tags: string[]; archived: boolean;
  splitMode: 'sentence' | 'line'; createdAt: number; updatedAt: number; }

interface Segment { id: string; textId: string; order: number; content: string; wordCount: number; }

interface SessionTemplate { id: string; name: string; pinned: boolean;
  items: { textId: string; segmentIds?: string[]; repeat: number }[]; updatedAt: number; }

interface SessionRun { id: string; templateId?: string; dayKey: string; // 'YYYY-MM-DD' wg godziny startu dnia
  startedAt: number; endedAt?: number; status: 'in_progress' | 'completed' | 'partial';
  plan: string[]; /* segmentIds w kolejności, max 150 */ cursor: number; xpEarned: number; }

interface Attempt { id: string; segmentId: string; textId: string; sessionRunId: string; dayKey: string;
  timestamp: number; transcript?: string; coverage: number; extra: number; wrong: number;
  accepted: boolean; firstTry: boolean; strictness: 'strict' | 'lenient';
  engine: 'webspeech' | 'whisper'; durationMs: number; }

interface DailyStats { dayKey: string; segmentsAccepted: number; attempts: number;
  textsCompleted: number; sessionsCompleted: number; xp: number; langs: Lang[];
  goalReached: boolean; frozen: boolean; firstActivityAt?: number; }

interface TextStats { textId: string; repetitions: number; segmentsAccepted: number;
  currentDayStreak: number; bestDayStreak: number; lastDayKey?: string; perfectRuns: number; }
```

Edycja tekstu z historią: jeśli segmenty tekstu zmienią się po wypowiedzeniach, stare segmenty są archiwizowane (nie kasowane), liczniki powtórzeń tekstu **zostają** (użytkownik poprawia literówkę, nie traci postępu).

Przy starcie aplikacji: `navigator.storage.persist()` – prośba o trwałe przechowywanie (ochrona przed czyszczeniem danych przez przeglądarkę, szczególnie Safari/iOS).

---

## 11. Ekrany i UX

1. **Onboarding (4 kroki, pomijalny):** język interfejsu → co chcesz praktykować (modlitwy / afirmacje / oba / własne teksty) + forma gramatyczna afirmacji PL (m/ż/neutralna) → test mikrofonu (powiedz „Teleo” / „Dzień dobry”) z informacją o prywatności silnika → cel dzienny.
2. **Dziś (ekran główny):** seria 🔥, pierścień celu dziennego, pasek poziomu, przycisk „Rozpocznij”, przypięte sesje, „Sesja dnia”.
3. **Biblioteka:** filtry (typ, język, własne/wbudowane), wyszukiwarka, na kartach licznik powtórzeń i najbliższe osiągnięcie („jeszcze 12 do Setki”).
4. **Edytor tekstu:** tytuł, typ, język, treść (wklej), tryb podziału, podgląd segmentów z edycją, ostrzeżenia (za długie zdanie, cyfry, > 150 segmentów).
5. **Sesje:** lista szablonów, kreator (dodaj teksty/segmenty, ustaw powtórzenia, licznik n/150, przeciągnij by zmienić kolejność).
6. **Odtwarzacz sesji** (8.3).
7. **Podsumowanie sesji** (8.3 pkt 8), z animacją odblokowanych osiągnięć.
8. **Postępy:** roślina + poziom, galeria osiągnięć (odblokowane / w toku z paskiem / ukryte), kalendarz-heatmapa, statystyki per tekst, skuteczność pierwszej próby w czasie.
9. **Ustawienia:** język UI, silnik mowy (+ pobranie modelu Whisper), rygor oceny, godzina początku dnia, cel dzienny, tryb bez rąk, zapisywanie transkrypcji, przypomnienia, eksport/import, polityka prywatności, „Usuń wszystkie dane”.

**Dostępność:** kontrast WCAG AA, obsługa klawiatury (Spacja = mikrofon), `aria-live` dla wyniku oceny, skalowanie czcionki segmentu (3 rozmiary), tryb ciemny.

**Design:** spokojna paleta (np. ciepła biel / głęboka zieleń / złoty akcent), duże typografie, dużo przestrzeni, animacje subtelne (`prefers-reduced-motion` respektowane).

---

## 12. Przypomnienia (bez serwera)

Prawdziwe powiadomienia push wymagają serwera, więc w modelu zerokosztowym stosujemy:
1. **Eksport przypomnienia do kalendarza (.ics)** – plik z wydarzeniem cyklicznym (np. codziennie 7:00, „Czas na Teleo”) i linkiem do aplikacji. Działa na każdym telefonie, niezawodnie, 0 kosztów. **Rozwiązanie główne.**
2. Powiadomienie lokalne przy otwartej aplikacji / w tle tam, gdzie przeglądarka wspiera (np. Periodic Background Sync w zainstalowanej PWA na Chrome) – jako dodatek, z feature detection, bez obietnic w UI.

> Od v1.6 (DECISIONS #122): 1–3 stałe godziny dziennie; plik .ics zawiera wydarzenie dla każdej godziny i jedno dla każdego bieżącego zadania (`RRULE:FREQ=DAILY;UNTIL`); powiadomienia lokalne (opcjonalne) przy otwartej aplikacji, plakietka na ikonie z liczbą powtórzeń zadań, a na Chrome Android w zainstalowanej aplikacji – Periodic Background Sync w naszym własnym service workerze (`src/sw.ts`).

---

## 13. Prywatność, prawo, rynki

- **RODO (PL/UE):** dane o praktykach religijnych to dane szczególnej kategorii (art. 9). Model local-first oznacza, że **twórca aplikacji ich nie przetwarza** – to kluczowy argument i trzeba go jasno napisać w polityce prywatności. Wyjątek: silnik Web Speech w niektórych przeglądarkach przesyła audio do dostawcy przeglądarki – obowiązkowa informacja + możliwość wyboru Whisper (lokalnie).
- **USA:** brak kont i zbierania danych upraszcza kwestie COPPA/CCPA; polityka prywatności nadal wymagana (PL + EN, `public/privacy.html`).
- **Treści:** tylko domena publiczna lub treści autorskie. Nie dodawać współczesnych przekładów Biblii objętych prawami autorskimi.
- **Eksport danych:** pełny JSON (teksty, historia, osiągnięcia, ustawienia) + import z walidacją wersji schematu. Przypomnienie o kopii co 30 dni.
- **Rynek PL:** domyślnie mocniejsza ekspozycja modlitw katolickich (różaniec). **Rynek US:** domyślnie afirmacje + modlitwy chrześcijańskie ekumeniczne; ton bardziej „self-growth”. Domyślny zestaw treści wynika z wyboru w onboardingu, nie z kraju.

---

## 14. Plan implementacji (etapy dla Claude Code)

**Etap 0 – Szkielet**
Vite + React + TS + Tailwind + router (Hash) + i18n (PL/EN) + Zustand + Dexie + vite-plugin-pwa. `base: '/teleo/'` w `vite.config.ts`. Workflow GitHub Actions (poniżej). `CLAUDE.md`, `docs/`.
✔ Akceptacja: pusta aplikacja z nawigacją działa na GitHub Pages, instaluje się jako PWA, przełącza język.

**Etap 1 – Dane i treści**
Schemat Dexie, seed treści wbudowanych, segmenter + testy, Biblioteka, Edytor tekstu.
✔ Akceptacja: można dodać własny tekst, zobaczyć i poprawić podział; testy segmentera przechodzą.

**Etap 2 – Matcher**
`normalize`, `align`, `evaluate` + wszystkie testy z 6.6 (i więcej).
✔ Akceptacja: 100% testów zielonych; funkcje czyste, bez zależności od DOM.

**Etap 3 – Mowa**
`SpeechEngine` + `WebSpeechEngine`, strona testowa mikrofonu w Ustawieniach, obsługa błędów (brak uprawnień, brak wsparcia, cisza, brak sieci).
✔ Akceptacja: w Chrome i Safari można wypowiedzieć zdanie PL i EN i zobaczyć wynik matchera.

**Etap 4 – Sesje**
Kreator szablonów (limit 150), odtwarzacz, tryb bez rąk, Wake Lock, zapis prób i przebiegów, wznowienie, podsumowanie.
✔ Akceptacja: pełna sesja „Dziesiątka różańca” przechodzi end-to-end; liczniki powtórzeń poprawne.

**Etap 5 – Gamifikacja**
Księga XP, poziomy, silnik reguł osiągnięć, serie, zamrożenia, cel dzienny, animacje odblokowań. Testy jednostkowe XP/serii/reguł (w tym przejścia przez północ i godzinę startu dnia).
✔ Akceptacja: osiągnięcia per tekst działają automatycznie dla nowo dodanego tekstu.

**Etap 6 – Postępy i statystyki**
Ekran „Dziś”, ekran Postępy (roślina SVG, galeria, heatmapa, statystyki per tekst).

**Etap 7 – PWA, onboarding, ustawienia, eksport**
Onboarding, ustawienia, eksport/import, `.ics`, `storage.persist()`, polityka prywatności, ikony, Lighthouse PWA/Accessibility ≥ 90.

**Etap 8 (v1.1) – Whisper offline + tryb pamięciowy + „Posłuchaj najpierw”.**

### Workflow wdrożenia (`.github/workflows/deploy.yml`)
```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test -- --run
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
W repozytorium: Settings → Pages → Source: **GitHub Actions**.

### Manifest PWA (kluczowe pola)
`name: "Teleo – modlitwy i afirmacje"`, `short_name: "Teleo"`, `start_url: "/teleo/"`, `scope: "/teleo/"`, `display: "standalone"`, `theme_color`, `background_color`, ikony 192/512 + maskable. Nazwa EN przez osobny manifest lub dynamicznie nie jest konieczna – `short_name` „Teleo” jest uniwersalne.

---

## 15. Zmiany i dodatki względem pierwotnych założeń – uzasadnienie

| # | Zmiana / dodatek | Uzasadnienie |
|---|---|---|
| 1 | **Dwa silniki STT (Web Speech + Whisper w przeglądarce)** | Web Speech jest darmowy i dokładny, ale nie działa w Firefoksie i w Chrome wysyła audio do Google. Whisper lokalnie daje pełną prywatność (ważne przy modlitwie) i pokrywa brakujące przeglądarki – nadal za 0 zł. |
| 2 | **Near-match (tolerancja błędów rozpoznawania)** | STT myli polskie końcówki i diakrytyki. Bez tolerancji użytkownik byłby odrzucany za błędy maszyny, nie swoje – to najszybsza droga do porzucenia aplikacji. Tolerancja nie łamie zasady „zero dodatkowych słów”. |
| 3 | **Podmiana słowa = słowo dodatkowe (tryb ścisły) + opcjonalny tryb łagodny** | Doprecyzowanie Twojej reguły: powiedzenie innego słowa to wypowiedzenie słowa spoza źródła. Tryb łagodny jako opcja dla osób z trudnościami (akcent, wada wymowy). |
| 4 | **Ignorowanie wypełniaczy („yyy”, „um”)** | To nie są słowa treści; STT czasem je zapisuje. Odrzucanie za nie byłoby frustrujące i niezgodne z intencją reguły. |
| 5 | **Rozwijanie skrótów EN i normalizacja liczb** | „I'm” vs „I am” i „10” vs „dziesięć” to ta sama treść – STT zapisuje je różnie. |
| 6 | **Uwidocznienie, że 95% przy krótkich zdaniach = 100%** | Matematyczna konsekwencja progu; użytkownik powinien wiedzieć, dlaczego w 10-słownym zdaniu nie można pominąć słowa. |
| 7 | **Dzielenie zdań > 40 słów i scalanie „Amen.”** | Długie wypowiedzi obniżają trafność STT i są ucinane przez przeglądarkę; jednowyrazowe segmenty sztucznie zawyżają liczniki. |
| 8 | **Tryb „każda linia = segment”** | Afirmacje i wiersze wkleja się zwykle jako listę linii, często bez kropek. |
| 9 | **Powtórzenia pozycji w sesji (np. Zdrowaś Maryjo ×10)** | Podstawa praktyki różańcowej i afirmacji powtarzanych wielokrotnie; bez tego trzeba by ręcznie dodawać 10 razy to samo. |
| 10 | **„Pomiń” po 3 nieudanych próbach** | Zapobiega zablokowaniu sesji przez jedno trudne zdanie lub słabe rozpoznawanie. |
| 11 | **Godzina początku dnia (03:00)** | Wieczorna modlitwa po północy nie powinna zrywać serii. |
| 12 | **Zamrożenia serii + osiągnięcie „Powrót” + „Stały rytm” (5/7 dni)** | Serie „wszystko albo nic” po pierwszym zerwaniu często powodują porzucenie nawyku; łagodniejsze mechanizmy utrzymują motywację. |
| 13 | **Metafora rośliny dla poziomów** | Neutralna dla wierzących i świeckich, spokojna, nawiązuje do wzrostu i do znaczenia słowa „teleo” (dojrzewanie do pełni). |
| 14 | **XP zależne od długości zdania + mnożnik serii** | Uczciwie wynagradza wysiłek i regularność – dwa główne cele aplikacji. |
| 15 | **Osiągnięcia jako dane (silnik reguł)** | Spełnia wymóg automatycznego podpinania osiągnięć do nowych tekstów bez dodatkowego kodu; łatwo dodawać nowe. |
| 16 | **Przypomnienia przez plik .ics** | Push wymaga serwera (koszt/utrzymanie); kalendarz w telefonie jest darmowy i niezawodny. |
| 17 | **Tryb pamięciowy i „Posłuchaj najpierw” (v1.1)** | Naturalne rozszerzenie dla osób uczących się modlitw/tekstów; wykorzystuje ten sam matcher i darmowy speechSynthesis. |
| 18 | **Brak zapisu audio, opcjonalny zapis transkrypcji** | Minimalizacja wrażliwych danych (RODO art. 9), mniejsze zużycie pamięci. |
| 19 | **`storage.persist()` + przypomnienie o kopii** | Bez backendu utrata danych przeglądarki = utrata całej historii; to realne ryzyko, zwłaszcza na iOS. |
| 20 | **Wybór formy gramatycznej afirmacji PL (m/ż/neutralna)** | Polskie afirmacje są odmieniane przez rodzaj; wypowiadanie niewłaściwej formy byłoby nienaturalne, a zmiana słowa nie przejdzie reguły „zero dodatkowych słów”. |
| 21 | **Repozytorium publiczne** | Wymóg darmowego planu GitHub Pages – warto wiedzieć przed startem. |

---

## 16. Metryki sukcesu (mierzone lokalnie, widoczne tylko dla użytkownika)
- Skuteczność pierwszej próby ≥ 80% (jeśli niższa → sygnał do dostrojenia matchera).
- Odsetek dni z osiągniętym celem dziennym.
- Najdłuższa seria.

Brak analityki zewnętrznej. Jeśli kiedyś potrzebna – tylko anonimowa, opt-in i darmowa, po osobnej decyzji.

---

## 17. Definicja „gotowe” dla v1.0
- [ ] Wszystkie etapy 0–7 zakończone, testy zielone w CI.
- [ ] Sesja PL i EN przechodzi end-to-end w Chrome (Android, desktop) i Safari (iOS, macOS).
- [ ] Aplikacja instaluje się jako PWA i otwiera offline (bez rozpoznawania mowy Web Speech – z komunikatem).
- [ ] Nowy tekst użytkownika od razu ma osiągnięcia per tekst.
- [ ] Eksport → wyczyszczenie danych → import przywraca pełny stan.
- [ ] Polityka prywatności PL/EN dostępna z Ustawień i onboardingu.
- [ ] Lighthouse: PWA, Accessibility, Best Practices ≥ 90.
