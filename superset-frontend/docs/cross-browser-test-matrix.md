# Apache Superset -- Cross-Browser Accessibility Test Matrix

## Testumgebung

| Feld | Wert |
|------|------|
| Superset-Version | Branch `fix/a11y-improvements-v3` |
| Datum | ___________ |
| Tester | ___________ |
| Auftraggeber | ___________ |

### Browser-Versionen

| Browser | Mindestversion | Getestete Version | Plattform |
|---------|----------------|-------------------|-----------|
| Google Chrome | 120+ | ___________ | Windows / macOS |
| Mozilla Firefox | 120+ | ___________ | Windows / macOS |
| Apple Safari | 17+ | ___________ | macOS |
| Microsoft Edge | 120+ | ___________ | Windows |

## Legende

| Symbol | Bedeutung |
|--------|-----------|
| P | Bestanden (Pass) |
| F | Nicht bestanden (Fail) |
| N/A | Nicht anwendbar |
| -- | Nicht getestet |

---

## Kategorie A: ARIA-Attribute

Prueft die korrekte Interpretation und Darstellung von ARIA-Attributen in allen Browsern.

| Nr | Test | Beschreibung | Chrome | Firefox | Safari | Edge | Anmerkung |
|----|------|--------------|--------|---------|--------|------|-----------|
| A1 | aria-label auf Buttons | Toolbar-Buttons (Bearbeiten, Speichern, Aktualisieren) haben lesbares `aria-label` | | | | | |
| A2 | aria-expanded auf Dropdowns | Filter-Bar und Navigations-Dropdowns melden korrekten Expand/Collapse-Zustand | | | | | |
| A3 | aria-pressed auf Toggles | Toggle-Buttons (z.B. Favorit, Aktiv/Inaktiv) melden korrekten Zustand | | | | | |
| A4 | role="alert" bei Fehlern | Fehlermeldungen in Login, SQL Lab, Database-Modal werden als Live-Region angekuendigt | | | | | |
| A5 | aria-invalid auf Feldern | Formularfelder mit Validierungsfehler setzen `aria-invalid="true"` | | | | | |
| A6 | aria-describedby fuer Fehler | Fehlerhafte Felder referenzieren ihre Fehlermeldung via `aria-describedby` | | | | | |

### Testprozedur Kategorie A

**A1 -- aria-label auf Buttons:**
1. DevTools oeffnen, zu einem Toolbar-Button navigieren.
2. Pruefen: `aria-label` ist vorhanden und beschreibend.
3. Screenreader aktivieren: Button-Name wird korrekt vorgelesen.

**A2 -- aria-expanded auf Dropdowns:**
1. Filter-Bar Expand-Button klicken.
2. Pruefen: Attribut wechselt zwischen `aria-expanded="true"` und `aria-expanded="false"`.
3. Screenreader meldet Zustandswechsel.

**A3 -- aria-pressed auf Toggles:**
1. Favorit-Stern auf Dashboard-Liste klicken.
2. Pruefen: Attribut wechselt zwischen `aria-pressed="true"` und `aria-pressed="false"`.
3. Screenreader meldet "gedrueckt" bzw. "nicht gedrueckt".

**A4 -- role="alert" bei Fehlern:**
1. Login mit falschem Passwort versuchen.
2. Pruefen: Fehlermeldungs-Container hat `role="alert"`.
3. Screenreader liest Fehlermeldung automatisch vor (ohne manuelles Navigieren).

**A5 -- aria-invalid auf Feldern:**
1. Pflichtfeld leer lassen und Formular absenden.
2. Pruefen: Feld hat `aria-invalid="true"`.
3. Screenreader meldet "ungueltig" beim Fokussieren des Feldes.

**A6 -- aria-describedby fuer Fehler:**
1. Feld mit Fehler fokussieren.
2. Pruefen: `aria-describedby` zeigt auf die ID der Fehlermeldung.
3. Screenreader liest Feldname UND Fehlermeldung vor.

---

## Kategorie B: Visuell

Prueft visuelle Barrierefreiheitsaspekte uebergreifend in allen Browsern.

| Nr | Test | Beschreibung | Chrome | Firefox | Safari | Edge | Anmerkung |
|----|------|--------------|--------|---------|--------|------|-----------|
| B1 | 200% Zoom Textgroesse | Alle Texte lesbar bei 200% Browser-Zoom, kein Abschneiden | | | | | |
| B2 | 320px Reflow | Hauptinhalt ohne horizontales Scrollen bei 320px Breite nutzbar | | | | | |
| B3 | Nicht-Text-Kontrast 3:1 | Focus-Ringe, Formularrahmen, UI-Icons haben mindestens 3:1 Kontrast | | | | | |
| B4 | SVG statt Canvas-Text | Chart-Achsenbeschriftungen und -Titel als SVG-Text gerendert | | | | | |
| B5 | Farb-unabhaengige Statusanzeige | Status-Icons verwenden Form + Text zusaetzlich zu Farbe | | | | | |

### Testprozedur Kategorie B

**B1 -- 200% Zoom Textgroesse:**
1. Browser-Zoom auf 200% setzen (Ctrl/Cmd + Plus).
2. Dashboard-Liste, Chart-Explore, SQL Lab nacheinander aufrufen.
3. Pruefen: Kein Text ueberlappt, wird abgeschnitten oder ist unlesbar. Alle Funktionen erreichbar.

**B2 -- 320px Reflow:**
1. Browser-Fenster auf 320px Breite setzen (DevTools Responsive Mode).
2. Hauptnavigation, Dashboard-Liste, Login-Seite testen.
3. Pruefen: Kein horizontales Scrollen fuer Hauptinhalt. Navigation wird zu Mobile-Menu.

**B3 -- Nicht-Text-Kontrast 3:1:**
1. Color Contrast Analyzer oder axe DevTools verwenden.
2. Focus-Ring auf einem Button messen: Kontrast >= 3:1.
3. Formularfeld-Rahmen messen: Kontrast >= 3:1.
4. Icon-Kontrast auf verschiedenen Hintergruenden messen.

**B4 -- SVG statt Canvas-Text:**
1. Chart mit Achsenbeschriftungen oeffnen (z.B. Balkendiagramm).
2. DevTools: Pruefen ob Text als `<text>`-Element im SVG steht (nicht Canvas).
3. Text selektieren: SVG-Text ist mit der Maus selektierbar.

**B5 -- Farb-unabhaengige Statusanzeige:**
1. Alert-Liste oeffnen.
2. Pruefen: Verschiedene Status haben verschiedene Icon-Formen (nicht nur Farben).
3. Graustufen-Modus im Browser aktivieren: Status-Unterschiede bleiben erkennbar.

---

## Kategorie C: Interaktion

Prueft tastatur- und fokusbasierte Interaktion in allen Browsern.

| Nr | Test | Beschreibung | Chrome | Firefox | Safari | Edge | Anmerkung |
|----|------|--------------|--------|---------|--------|------|-----------|
| C1 | Sichtbarer Fokus-Indikator | Alle interaktiven Elemente haben sichtbaren Focus-Ring bei Tab-Navigation | | | | | |
| C2 | Focus Trap in Modals | Fokus bleibt innerhalb geoeffneter Modale, Escape schliesst das Modal | | | | | |
| C3 | Tooltip bei Hover und Fokus | Tooltips erscheinen bei Maus-Hover UND Tastatur-Fokus | | | | | |
| C4 | Konsistente Tab-Reihenfolge | Tab-Reihenfolge folgt der visuellen Lesereihenfolge (links-nach-rechts, oben-nach-unten) | | | | | |
| C5 | autocomplete auf Login-Feldern | Benutzername- und Passwortfelder haben korrekte `autocomplete`-Attribute | | | | | |

### Testprozedur Kategorie C

**C1 -- Sichtbarer Fokus-Indikator:**
1. Tab-Taste druecken, durch die gesamte Seite navigieren.
2. Pruefen: Jedes fokussierte Element hat einen sichtbaren Rahmen/Outline.
3. Besonders pruefen: Buttons ohne sichtbaren Rand, Icon-only Buttons, Links in Tabellen.

**C2 -- Focus Trap in Modals:**
1. Modal oeffnen (z.B. "Neues Dashboard erstellen").
2. Tab-Taste wiederholt druecken.
3. Pruefen: Fokus bleibt im Modal (springt nicht zum Hintergrund).
4. Escape druecken: Modal schliesst, Fokus kehrt zum ausloesenden Element zurueck.

**C3 -- Tooltip bei Hover und Fokus:**
1. Maus ueber einen Toolbar-Button mit Tooltip bewegen: Tooltip erscheint.
2. Maus zum Tooltip bewegen: Tooltip bleibt sichtbar (verweilbar).
3. Per Tab zum selben Button navigieren: Tooltip erscheint auch bei Fokus.
4. Escape druecken: Tooltip verschwindet, Fokus bleibt auf Element.

**C4 -- Konsistente Tab-Reihenfolge:**
1. Tab-Reihenfolge auf Dashboard-Seite dokumentieren.
2. Vergleichen mit visueller Anordnung.
3. Pruefen: Keine unerwarteten Spruenge, Reihenfolge ist logisch.

**C5 -- autocomplete auf Login-Feldern:**
1. Login-Seite oeffnen, DevTools: Benutzername-Feld inspizieren.
2. Pruefen: `autocomplete="username"` vorhanden.
3. Passwort-Feld: `autocomplete="current-password"` vorhanden.
4. Browser-Autovervollstaendigung testen: Felder werden korrekt vorausgefuellt.

---

## Kategorie D: Screenreader-Kompatibilitaet

Prueft die korrekte Screenreader-Ausgabe in den jeweiligen Browser-Kombinationen.

| Nr | Test | Beschreibung | NVDA + Chrome | NVDA + Firefox | VoiceOver + Safari | NVDA + Edge | Anmerkung |
|----|------|--------------|---------------|----------------|--------------------|----|-----------|
| D1 | Landmarks-Navigation | Screenreader erkennt Navigation, Main, Complementary Landmarks | | | | | |
| D2 | Ueberschriften-Hierarchie | h1-h3 Struktur ist logisch, keine uebersprungenen Ebenen | | | | | |
| D3 | Live-Regions fuer Fehler | Fehlermeldungen werden automatisch vorgelesen ohne manuelles Navigieren | | | | | |
| D4 | Tabellen-Navigation | Daten-Tabellen (Dashboard-Liste, Ergebnisse) sind mit Screenreader-Tabellen-Navigation nutzbar | | | | | |

### Testprozedur Kategorie D

**D1 -- Landmarks-Navigation:**
1. Screenreader starten, Landmarks auflisten (NVDA: D-Taste; VoiceOver: Rotor > Landmarks).
2. Pruefen: `<nav>`, `<main>`, `<aside>` (falls vorhanden) sind erkennbar.
3. Pruefen: Landmarks haben beschreibende Labels (`aria-label` auf `<nav>`).

**D2 -- Ueberschriften-Hierarchie:**
1. Ueberschriften-Liste oeffnen (NVDA: H-Taste; VoiceOver: Rotor > Ueberschriften).
2. Pruefen: Es gibt genau ein h1 pro Seite (Seitentitel).
3. Pruefen: Hierarchie ist logisch (h1 > h2 > h3), keine Ebenen uebersprungen.

**D3 -- Live-Regions fuer Fehler:**
1. Screenreader aktivieren, Login mit falschem Passwort versuchen.
2. Pruefen: Fehlermeldung wird SOFORT vorgelesen (Live-Region), ohne dass der Benutzer manuell dorthin navigieren muss.
3. SQL Lab: Fehlerhafte Abfrage ausfuehren. Pruefen: Fehlermeldung wird automatisch angekuendigt.

**D4 -- Tabellen-Navigation:**
1. Dashboard-Liste oeffnen, in die Tabelle navigieren.
2. NVDA: Ctrl+Alt+Pfeiltasten fuer Tabellen-Navigation verwenden.
3. Pruefen: Spaltenkoepfe werden beim Zellenwechsel vorgelesen.
4. Pruefen: Sortierbare Spalten melden ihren Sortierstatus (`aria-sort`).

---

## Bekannte Browser-Unterschiede

### Safari-spezifische Einschraenkungen

| Problem | Beschreibung | Workaround |
|---------|-------------|------------|
| Tab-Navigation | Safari fokussiert standardmaessig keine Links per Tab-Taste | Benutzer muss "Alle Steuerungen per Tab ansteuern" in Safari Einstellungen > Erweitert aktivieren |
| VoiceOver + ARIA | VoiceOver ignoriert teilweise `aria-describedby` bei bestimmten Rollen | Sicherstellen, dass `aria-label` zusaetzlich gesetzt ist |
| Custom Selects | Safari rendert `<select>` mit nativen Stilen, Custom-Dropdowns koennen abweichen | Ant Design Dropdown-Komponenten verwenden statt native Selects |

### Firefox-spezifische Hinweise

| Problem | Beschreibung | Workaround |
|---------|-------------|------------|
| Focus-Outline | Firefox verwendet eigene Focus-Styles, die von CSS-Resets betroffen sein koennen | `:focus-visible` explizit stylen, `::-moz-focus-inner` zuruecksetzen |
| NVDA + aria-live | NVDA in Firefox kann doppelte Ansagen bei `aria-live="assertive"` erzeugen | `aria-live="polite"` bevorzugen, nur bei kritischen Fehlern `assertive` |

### Chrome/Edge-spezifische Hinweise

| Problem | Beschreibung | Workaround |
|---------|-------------|------------|
| Forced Colors Mode | Windows High Contrast Mode kann Custom-Focus-Styles ueberschreiben | `@media (forced-colors: active)` CSS-Query verwenden |
| NVDA Compatibility | NVDA funktioniert am zuverlaessigsten mit Chrome und Edge (gleiche Chromium-Engine) | Chrome oder Edge als primaeren NVDA-Testbrowser verwenden |

### Cross-Browser CSS Hinweise

| Eigenschaft | Chrome/Edge | Firefox | Safari |
|-------------|-------------|---------|--------|
| `:focus-visible` | Vollstaendig unterstuetzt | Vollstaendig unterstuetzt | Ab Safari 15.4 unterstuetzt |
| `outline-offset` | Unterstuetzt | Unterstuetzt | Unterstuetzt |
| `forced-colors` Media Query | Unterstuetzt | Ab Firefox 89 | Nicht unterstuetzt |
| `prefers-reduced-motion` | Unterstuetzt | Unterstuetzt | Unterstuetzt |
| `prefers-contrast` | Unterstuetzt | Ab Firefox 96 | Ab Safari 14.1 |

---

## Ergebnis-Vorlage

### Zusammenfassung pro Kategorie

| Kategorie | Chrome | Firefox | Safari | Edge | Gesamt |
|-----------|--------|---------|--------|------|--------|
| A: ARIA-Attribute (6 Tests) | /6 | /6 | /6 | /6 | /24 |
| B: Visuell (5 Tests) | /5 | /5 | /5 | /5 | /20 |
| C: Interaktion (5 Tests) | /5 | /5 | /5 | /5 | /20 |
| D: Screenreader (4 Tests) | /4 | /4 | /4 | /4 | /16 |
| **Gesamt (20 Tests)** | **/20** | **/20** | **/20** | **/20** | **/80** |

### Bestanden-Schwellenwert

| Bewertung | Schwellenwert | Beschreibung |
|-----------|---------------|-------------|
| Bestanden | >= 90% (72/80) | Alle kritischen Tests bestanden, nur geringfuegige Abweichungen |
| Bedingt bestanden | >= 75% (60/80) | Keine kritischen ARIA-Fehler, visuelle Maengel akzeptabel |
| Nicht bestanden | < 75% (< 60/80) | Kritische Barrierefreiheitsmaengel vorhanden |

### Einzelergebnisse mit Fehlerbeschreibung

_Fuer jeden nicht-bestandenen Test folgendes ausfuellen:_

| Feld | Wert |
|------|------|
| Test-Nr | |
| Browser | |
| WCAG-Kriterium | |
| Fehlerbeschreibung | |
| Screenshot/Aufnahme | |
| Schweregrad | Kritisch / Hoch / Mittel / Niedrig |
| Empfohlene Korrektur | |
| Zugewiesen an | |

---

## Freigabe

| Rolle | Name | Datum | Ergebnis |
|-------|------|-------|----------|
| Tester | | | |
| Fachliche Abnahme | | | |
| Auftraggeber | | | |
