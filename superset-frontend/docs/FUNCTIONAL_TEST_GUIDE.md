# Funktionspruefungs-Leitfaden -- Apache Superset WCAG 2.1 Barrierefreiheit

| Feld     | Wert                                |
|----------|-------------------------------------|
| Version  | Branch `fix/a11y-improvements-v3`   |
| Datum    | 2026-03-02                          |
| Dauer    | 5 Werktage                          |

---

## Vorbereitung

### Testumgebung einrichten

1. **Superset deployen** gemaess `DEPLOYMENT_READY.md`
2. **Testbenutzer anlegen** mit Admin-Rolle (alle Bereiche zugaenglich)
3. **Testdaten laden**: mindestens 1 Dashboard, 3 Charts, 1 SQL-Query, 1 Alert/Report

### Werkzeuge installieren

| Werkzeug | Zweck | Installation |
|----------|-------|-------------|
| NVDA | Screenreader (Windows) | https://www.nvda-project.org/ -- kostenlos |
| VoiceOver | Screenreader (macOS) | Bereits integriert -- Aktivierung: Cmd+F5 |
| Chrome DevTools | Kontrastpruefung | Im Browser integriert (F12) |
| Axe DevTools | Automatisierte WCAG-Pruefung | Chrome-Erweiterung installieren |

### Tastenkuerzel fuer Screenreader

| Aktion | NVDA (Windows) | VoiceOver (macOS) |
|--------|---------------|-------------------|
| Screenreader starten | Strg+Alt+N | Cmd+F5 |
| Naechstes Element | Tab | Tab |
| Vorheriges Element | Shift+Tab | Shift+Tab |
| Ueberschriften auflisten | NVDA+F7 | VO+U |
| Formular-Interaktion | Enter | VO+Leertaste |
| Screenreader stoppen | NVDA+Q | Cmd+F5 |

---

## Tag 1 -- Level A Kriterien (4 Kriterien)

### Test 1.1: WCAG 1.1.1 -- Nicht-Text-Inhalte (Alternativtexte)

**Relevante Seiten:** Dashboard, Chart-Ansicht, Home

**Schritt-fuer-Schritt:**
1. Dashboard oeffnen, das mindestens 2 Charts enthaelt
2. NVDA/VoiceOver aktivieren
3. Mit Tab durch die Chart-Bereiche navigieren
4. Auf jeden Chart-Container fokussieren und Screenreader-Ausgabe pruefen

**ERWARTUNG:**
- Jeder Chart hat ein `aria-label` mit Chartname und Charttyp (z.B. "Sales Overview - Bar Chart")
- SVG-Elemente enthalten `<title>`-Tags oder `aria-label`
- Dekorative Bilder (Logos, Trennlinien) werden vom Screenreader ignoriert (`aria-hidden="true"`)
- Chart-Container kuendigen "Chart: [Name]" an

### Test 1.2: WCAG 1.3.3 -- Sensorische Eigenschaften

**Relevante Seiten:** Alert/Report-Liste, Dashboard, Status-Anzeigen

**Schritt-fuer-Schritt:**
1. Alert/Report-Liste oeffnen
2. Verschiedene Status pruefen (Success, Error, Working, Not Triggered)
3. Browser auf Graustufen umstellen (Chrome DevTools > Rendering > Emulate vision deficiencies > Achromatopsia)
4. Pruefen, ob Status-Informationen auch ohne Farbe erkennbar sind

**ERWARTUNG:**
- Status-Icons haben zusaetzlich zum Farbwert ein erkennbares Shape (Haken, Kreuz, Kreis)
- Text-Labels begleiten farbige Status-Anzeigen
- In Graustufen-Ansicht sind alle Status-Typen unterscheidbar
- Keine Information wird ausschliesslich durch Farbe, Form oder Position vermittelt

### Test 1.3: WCAG 1.4.1 -- Verwendung von Farbe

**Relevante Seiten:** Fehlerformulare, Alert-Status, Chart-Listen

**Schritt-fuer-Schritt:**
1. Login-Seite oeffnen
2. Falsches Passwort eingeben und absenden
3. Fehlermeldung pruefen: Ist neben der roten Farbe auch ein Icon oder Text-Hinweis sichtbar?
4. Alert/Report-Liste oeffnen und Status-Spalte pruefen

**ERWARTUNG:**
- Fehlermeldungen zeigen ein Warnsymbol (Icon) zusaetzlich zur roten Farbe
- Felder mit Fehler haben eine sichtbare Umrandung (nicht nur Farbwechsel)
- Status-Anzeigen nutzen Icons + Text + Farbe (dreifache Kodierung)
- In Graustufen bleibt alle Information verstaendlich

### Test 1.4: WCAG 3.3.1 -- Fehlererkennung

**Relevante Seiten:** Login, SQL Lab, Alert/Report-Erstellung

**Schritt-fuer-Schritt:**
1. Login-Seite oeffnen, leeres Formular absenden
2. Pruefen: Werden Fehlerfelder identifiziert und beschrieben?
3. NVDA/VoiceOver aktivieren und Fehlermeldungen vorlesen lassen
4. SQL Lab oeffnen, ungueltiges SQL ausfuehren
5. Fehlermeldung pruefen

**ERWARTUNG:**
- Fehlerhafte Felder erhalten `aria-invalid="true"`
- Fehlermeldungen sind mit `aria-describedby` verknuepft
- Fehler-Container haben `role="alert"` (werden sofort vorgelesen)
- Fehlermeldung beschreibt klar, welches Feld betroffen ist und was erwartet wird

---

## Tag 2 -- AA Visuell (4 Kriterien)

### Test 2.1: WCAG 1.4.4 -- Textgroessenanpassung

**Relevante Seiten:** Alle Seiten

**Schritt-fuer-Schritt:**
1. Browser-Zoom auf 200% setzen (Strg/Cmd + Plus)
2. Login-Seite, Dashboard-Liste, Chart-Ansicht, SQL Lab nacheinander besuchen
3. Pruefen: Ist aller Text lesbar? Ueberlappt kein Text?
4. Zoom auf 100% zuruecksetzen

**ERWARTUNG:**
- Alle Texte skalieren proportional mit dem Browser-Zoom
- Kein Text wird abgeschnitten oder ueberlappt andere Elemente
- Navigation bleibt funktional bei 200% Zoom
- Schaltflaechen und Links bleiben klickbar

### Test 2.2: WCAG 1.4.5 -- Bilder von Text

**Relevante Seiten:** Charts, Dashboard

**Schritt-fuer-Schritt:**
1. Dashboard mit verschiedenen Chart-Typen oeffnen
2. Rechtsklick auf einen Chart > Element untersuchen (F12)
3. Pruefen: Werden Charts als SVG (`<svg>`) statt Canvas (`<canvas>`) gerendert?
4. Text in Charts pruefen: Ist er selektierbar?

**ERWARTUNG:**
- Charts werden als SVG gerendert (sichtbar im DOM als `<svg>`-Elemente)
- Achsenbeschriftungen und Legenden sind selektierbarer Text (kein gerasteter Bild-Text)
- Bei Zoom bleibt Chart-Text scharf (kein Pixel-Artefakt)

### Test 2.3: WCAG 1.4.10 -- Umfliessen (Reflow)

**Relevante Seiten:** Dashboard, Listen-Seiten, SQL Lab

**Schritt-fuer-Schritt:**
1. Browserfenster auf 320px Breite verkleinern (oder Chrome DevTools > Geraete-Symbolleiste > 320px)
2. Dashboard-Liste oeffnen
3. Login-Seite pruefen
4. Horizontales Scrollen pruefen

**ERWARTUNG:**
- Inhalte fliessen in eine Spalte um (kein horizontales Scrollen noetig)
- Navigation passt sich an (Hamburger-Menue oder gestapelte Navigation)
- Alle Informationen bleiben zugaenglich
- Datentabellen duerfen horizontal scrollen (Ausnahme gemaess WCAG)

### Test 2.4: WCAG 1.4.11 -- Nicht-Text-Kontrast

**Relevante Seiten:** Formulare, Buttons, Icons, Chart-Raender

**Schritt-fuer-Schritt:**
1. Chrome DevTools oeffnen (F12)
2. Auf ein Formular-Eingabefeld klicken und den Rand-Kontrast pruefen
3. Fokus-Indikator pruefen: Hat er genuegend Kontrast zum Hintergrund?
4. Icons und grafische Elemente mit dem Kontrastrechner pruefen

**ERWARTUNG:**
- Formularfelder-Raender haben mindestens 3:1 Kontrast zum Hintergrund
- Fokus-Indikatoren haben mindestens 3:1 Kontrast
- Icons und grafische Steuerelemente haben mindestens 3:1 Kontrast
- Buttons sind visuell vom Hintergrund abgegrenzt (3:1 Kontrast)

---

## Tag 3 -- AA Interaktion (4 Kriterien)

### Test 3.1: WCAG 1.3.5 -- Eingabezweck bestimmen

**Relevante Seiten:** Login, Registrierung, Datenbankverbindung, Alert/Report-Erstellung

**Schritt-fuer-Schritt:**
1. Login-Seite oeffnen
2. Rechtsklick auf Benutzername-Feld > Element untersuchen
3. `autocomplete`-Attribut pruefen
4. Passwort-Feld pruefen
5. Weitere Formulare pruefen (Registrierung, Datenbankverbindung)

**ERWARTUNG:**
- Benutzername-Feld hat `autocomplete="username"`
- Passwort-Feld hat `autocomplete="current-password"` (Login) bzw. `autocomplete="new-password"` (Registrierung)
- E-Mail-Felder haben `autocomplete="email"`
- Browser kann Formularfelder automatisch ausfuellen

### Test 3.2: WCAG 1.4.13 -- Inhalt bei Hover oder Fokus

**Relevante Seiten:** Dashboard (Tooltips), Chart-Ansicht, Tabellen

**Schritt-fuer-Schritt:**
1. Dashboard oeffnen und ueber einen Chart-Datenpunkt hovern (Tooltip erscheint)
2. Maus auf den Tooltip bewegen -- bleibt er sichtbar?
3. Escape-Taste druecken -- verschwindet der Tooltip?
4. Weitere Tooltips und Popovers testen

**ERWARTUNG:**
- Tooltips bleiben sichtbar, wenn die Maus auf den Tooltip bewegt wird (hoverable)
- Tooltips koennen mit der Escape-Taste geschlossen werden (dismissible)
- Tooltips verdecken keinen wesentlichen Inhalt dauerhaft
- Tooltip verschwindet nicht, solange der Fokus/Hover bestehen bleibt (persistent)

### Test 3.3: WCAG 2.4.6 -- Ueberschriften und Labels

**Relevante Seiten:** Alle Seiten

**Schritt-fuer-Schritt:**
1. NVDA starten und Ueberschriften-Liste oeffnen (NVDA+F7)
2. Pruefen: Gibt es eine logische Ueberschriften-Hierarchie (H1 > H2 > H3)?
3. Dashboard oeffnen und Ueberschriften pruefen
4. Formular-Labels pruefen: Sind alle Eingabefelder beschriftet?

**ERWARTUNG:**
- Jede Seite hat genau eine H1-Ueberschrift
- Ueberschriften-Hierarchie ist logisch (kein Sprung von H1 zu H4)
- Alle Formulareingabefelder haben sichtbare, verknuepfte Labels
- Abschnitte haben beschreibende Ueberschriften
- Screenreader liest: "Ueberschrift Ebene 1: [Seitenname]", "Ueberschrift Ebene 2: [Abschnitt]" etc.

### Test 3.4: WCAG 2.4.7 -- Sichtbarer Fokus

**Relevante Seiten:** Alle Seiten (besonders Navigation, Formulare, Buttons)

**Schritt-fuer-Schritt:**
1. Maus beiseitelegen -- nur Tastatur verwenden
2. Tab-Taste druecken, um durch die Seite zu navigieren
3. Pruefen: Ist bei jedem fokussierten Element klar erkennbar, wo der Fokus liegt?
4. Durch Navigation, Formulare, Buttons, Links tabben
5. Shift+Tab fuer Rueckwaertsnavigation testen

**ERWARTUNG:**
- Jedes fokussierbare Element hat einen sichtbaren Fokus-Indikator
- Fokus-Indikator ist mindestens 2px breit und hat ausreichend Kontrast
- Fokusreihenfolge ist logisch (links-nach-rechts, oben-nach-unten)
- Kein Element wird uebersprungen
- Fokus "verschwindet" nie (kein unsichtbarer Fokus auf versteckten Elementen)

---

## Tag 4 -- Restliche AA + Cross-Browser (3 Kriterien)

### Test 4.1: WCAG 3.1.2 -- Sprache von Teilen

**Relevante Seiten:** App-Level (alle Seiten)

**Schritt-fuer-Schritt:**
1. Beliebige Superset-Seite oeffnen
2. Rechtsklick > Element untersuchen (F12)
3. `<html>`-Tag pruefen: Hat es ein `lang`-Attribut?
4. Bei fremdsprachigem Inhalt: Hat der Container ein eigenes `lang`-Attribut?

**ERWARTUNG:**
- `<html lang="en">` ist vorhanden (oder entsprechend der konfigurierten Sprache)
- Screenreader verwendet die korrekte Sprachausgabe
- Bei mehrsprachigem Inhalt sind Abschnitte mit `lang`-Attribut markiert

### Test 4.2: WCAG 3.2.3 -- Konsistente Navigation

**Relevante Seiten:** Alle Seiten (Hauptnavigation)

**Schritt-fuer-Schritt:**
1. Home-Seite oeffnen und Position der Navigationsleiste notieren
2. Dashboard-Liste oeffnen -- ist die Navigation an derselben Stelle?
3. Chart-Liste, SQL Lab, Einstellungen nacheinander besuchen
4. NVDA starten: Wird die Navigation als `<nav>`-Landmark erkannt?

**ERWARTUNG:**
- Hauptnavigation ist auf allen Seiten an derselben Position
- Navigationsreihenfolge ist identisch auf allen Seiten
- Navigation hat ein `<nav>`-Element mit `aria-label`
- Screenreader kuendigt "Navigation" als Landmark an

### Test 4.3: WCAG 3.3.3 -- Fehlervorschlaege

**Relevante Seiten:** Login, Alert/Report-Erstellung, Datenbankverbindung

**Schritt-fuer-Schritt:**
1. Login-Seite: Ungueltiges E-Mail-Format eingeben
2. Pruefen: Schlaegt das System ein korrektes Format vor?
3. Alert/Report erstellen: Pflichtfelder leer lassen
4. Datenbankverbindung: Falschen Connection-String eingeben

**ERWARTUNG:**
- Fehlermeldungen enthalten konkrete Korrekturhinweise (z.B. "Bitte geben Sie eine gueltige E-Mail-Adresse ein")
- Bei Pflichtfeldern: "Dieses Feld ist erforderlich"
- Fehlermeldungen sind kontextbezogen und hilfreich (nicht nur "Fehler")
- Screenreader liest Fehlervorschlaege automatisch vor (`role="alert"`)

### Test 4.4: Cross-Browser-Pruefung

**Schritt-fuer-Schritt:**
1. Alle Tests von Tag 1-4 in folgenden Browsern wiederholen (Stichprobe):
   - Firefox: Login-Test + Fokus-Test + Screenreader-Test (NVDA)
   - Safari: Login-Test + Fokus-Test + VoiceOver-Test
   - Edge: Login-Test + Zoom-Test
2. Abweichungen dokumentieren

**ERWARTUNG:**
- Grundlegende Funktionalitaet ist in allen Browsern identisch
- Fokus-Indikatoren sind in allen Browsern sichtbar
- Screenreader-Ausgabe ist konsistent (geringe Abweichungen zwischen Browsern sind normal)

---

## Tag 5 -- Abschluss

### 5.1 Maengel dokumentieren

Alle gefundenen Abweichungen von den ERWARTUNGEN in der Maengelliste erfassen (siehe `ACCEPTANCE_CHECKLIST.md`, Abschnitt G).

### 5.2 Ergebnis-Protokoll ausfuellen

1. `ACCEPTANCE_CHECKLIST.md` oeffnen
2. Fuer jedes der 15 WCAG-Kriterien "Bestanden" oder "Nicht bestanden" ankreuzen
3. Automatisierte Testergebnisse eintragen (Abschnitt B)
4. Screenreader-Testergebnisse eintragen (Abschnitt C)
5. Gesamtergebnis bewerten (Abschnitt E)

### 5.3 Abschlussbesprechung

- Ergebnisse mit dem Auftragnehmer besprechen
- Offene Maengel priorisieren
- Abnahme erteilen oder Nachbesserung vereinbaren

---

## Maengel-Behandlung

### Schweregrade

| Schweregrad | Definition | Frist |
|-------------|-----------|-------|
| **Kritisch** | WCAG-Kriterium komplett nicht erfuellt, Nutzung fuer Betroffene unmoeglich | Sofortige Nachbesserung (5 Werktage) |
| **Schwerwiegend** | WCAG-Kriterium teilweise nicht erfuellt, Nutzung stark eingeschraenkt | Nachbesserung innerhalb 10 Werktage |
| **Geringfuegig** | Kosmetische Abweichung, Nutzung moeglich aber nicht optimal | Nachbesserung im naechsten Release |
| **Hinweis** | Verbesserungsvorschlag, kein WCAG-Verstoss | Zur Kenntnis genommen |

### Nachtest-Verfahren

1. Auftragnehmer behebt gemeldete Maengel
2. Auftragnehmer stellt aktualisierten Branch bereit
3. Auftraggeber fuehrt gezielten Nachtest der betroffenen Kriterien durch
4. Ergebnis wird in der Maengelliste aktualisiert
5. Bei Bestehen: Abnahme fuer das jeweilige Kriterium erteilen

### Kontakt fuer Maengelmeldungen

| Kanal | Adresse |
|-------|---------|
| E-Mail | fedo.hagge-kubat@aitema.de |
| Betreff-Format | `[Superset-A11y] Mangel: [WCAG-Nr] -- [Kurzbeschreibung]` |
