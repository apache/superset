# Apache Superset -- Screenreader-Testprotokoll

## Testumgebung

| Feld | Wert |
|------|------|
| Screenreader | NVDA 2024+ (Windows, Chrome/Firefox), VoiceOver (macOS Sonoma+, Safari) |
| Superset-Version | Branch `fix/a11y-improvements-v3` |
| Datum | ___________ |
| Tester | ___________ |
| Auftraggeber | ___________ |

## Hinweise zur Durchfuehrung

- Jedes Kriterium muss in allen drei Kombinationen getestet werden: NVDA + Chrome, NVDA + Firefox, VoiceOver + Safari.
- Ergebnisse werden mit Pass/Fail und optionalem Kommentar dokumentiert.
- Bei Abweichungen zwischen Browsern wird der Unterschied im Kommentarfeld festgehalten.
- Alle Testschritte beziehen sich auf die Standard-Superset-Oberflaeche nach Login.

---

## Level A Kriterien

### 1. WCAG 1.1.1 -- Nicht-Text-Inhalt

**Ziel:** Alle nicht-textuellen Inhalte (Icons, Charts, Bilder) haben eine Textalternative, die dem Screenreader zugaenglich ist.

**Testschritte:**

1. Dashboard oeffnen, mit Tab zu den Chart-Containern navigieren.
   - **ERWARTUNG:** Screenreader sagt den Chart-Namen und den Chart-Typ (z.B. "Umsatz Q1 -- Balkendiagramm").
2. Toolbar-Icons in der oberen Navigation aktivieren (z.B. Bearbeiten, Aktualisieren, Speichern).
   - **ERWARTUNG:** Jeder Button wird mit seinem Zweck vorgelesen (z.B. "Bearbeiten", "Dashboard aktualisieren", "Speichern").
3. Alert-Liste oeffnen und zu den Status-Icons navigieren.
   - **ERWARTUNG:** Neben dem Icon wird der Status-Text vorgelesen (z.B. "Erfolgreich", "Fehlgeschlagen", "Geplant").
4. Chart-Liste oeffnen, Favoriten-Sterne pruefen.
   - **ERWARTUNG:** Screenreader liest "Favorit" oder "Kein Favorit" vor, nicht nur ein leeres Icon.

**Relevante Seiten:** Dashboard-Ansicht, Chart-Liste, Alert-Liste, Toolbar

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 2. WCAG 1.3.3 -- Sensorische Eigenschaften

**Ziel:** Anweisungen und Informationen sind nicht ausschliesslich ueber Form, Groesse, visuelle Position oder Orientierung vermittelt.

**Testschritte:**

1. Filter Bar oeffnen und die Expand/Collapse-Buttons testen.
   - **ERWARTUNG:** Screenreader sagt `aria-expanded="true"` oder `aria-expanded="false"` -- der Zustand ist programmatisch erkennbar, nicht nur visuell.
2. Toggle-Buttons (z.B. in Dashboard-Einstellungen) aktivieren und deaktivieren.
   - **ERWARTUNG:** Screenreader liest `aria-pressed="true"` bzw. `aria-pressed="false"` vor.
3. Tab-Navigation in SQL Lab pruefen (Ergebnisse, Abfrageverlauf).
   - **ERWARTUNG:** Aktiver Tab wird als "ausgewaehlt" vorgelesen, inaktive Tabs als "nicht ausgewaehlt" -- nicht nur durch Farbe erkennbar.

**Relevante Seiten:** Filter Bar, Dashboard-Einstellungen, SQL Lab

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 3. WCAG 1.4.1 -- Benutzung von Farbe

**Ziel:** Farbe wird nicht als einziges visuelles Mittel zur Informationsvermittlung verwendet.

**Testschritte:**

1. Alert-Liste oeffnen und Status-Spalte pruefen.
   - **ERWARTUNG:** Neben der Farbe wird ein eindeutiges Icon mit unterschiedlicher Form und ein Textlabel fuer jeden Status angezeigt (Kreis = Erfolgreich, Dreieck = Warnung, Quadrat = Fehler).
2. Dashboard-Charts mit Farbkodierung pruefen (z.B. Pie-Chart-Segmente).
   - **ERWARTUNG:** Segmente haben Textlabels oder Pattern/Muster zusaetzlich zur Farbe.
3. Formular-Validierung pruefen (z.B. Datenbank-Verbindung anlegen mit fehlerhaften Daten).
   - **ERWARTUNG:** Fehlerhafte Felder haben nicht nur eine rote Umrandung, sondern auch einen Fehlertext und ein Fehler-Icon.

**Relevante Seiten:** Alert-Liste, Dashboard-Charts, Database-Modal, Formular-Seiten

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 4. WCAG 3.3.1 -- Fehlerkennzeichnung

**Ziel:** Bei Eingabefehlern wird der Fehler automatisch erkannt und dem Benutzer in Textform beschrieben.

**Testschritte:**

1. Login-Seite: Falsches Passwort eingeben und Formular absenden.
   - **ERWARTUNG:** Screenreader liest eine Fehlermeldung vor (z.B. "Benutzername oder Passwort falsch"). Die Meldung hat `role="alert"` und wird sofort angekuendigt.
2. Database-Modal: Pflichtfelder leer lassen und "Speichern" klicken.
   - **ERWARTUNG:** Screenreader nennt das fehlerhafte Feld und die Fehlerbeschreibung (z.B. "Datenbankname: Pflichtfeld"). Felder haben `aria-invalid="true"` und `aria-describedby` verweist auf die Fehlermeldung.
3. SQL Lab: Fehlerhafte SQL-Abfrage ausfuehren.
   - **ERWARTUNG:** Fehlermeldung wird in einer `role="alert"` Region angezeigt und vom Screenreader automatisch vorgelesen.
4. Chart-Erstellung: Pflichtfeld "Datasource" nicht auswaehlen und speichern versuchen.
   - **ERWARTUNG:** Validierungsfehler wird als Text vorgelesen, nicht nur visuell markiert.

**Relevante Seiten:** Login-Seite, Database-Modal, SQL Lab, Chart-Erstellung

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

## Level AA -- Visuell

### 5. WCAG 1.4.4 -- Textgroesse aendern (200% Zoom)

**Ziel:** Text kann auf 200% vergroessert werden, ohne dass Inhalte oder Funktionalitaet verloren gehen.

**Testschritte:**

1. Browser-Zoom auf 200% setzen und Dashboard-Liste aufrufen.
   - **ERWARTUNG:** Alle Texte sind lesbar, keine Ueberlappung, Tabelle scrollt horizontal wenn noetig. Kein Text wird abgeschnitten.
2. SQL Lab bei 200% Zoom oeffnen.
   - **ERWARTUNG:** Editor, Ergebnistabelle und Tabs bleiben bedienbar. Text im Code-Editor ist vollstaendig sichtbar.
3. Filter Bar bei 200% Zoom testen.
   - **ERWARTUNG:** Filter-Eingabefelder und Labels sind vollstaendig lesbar und bedienbar.

**Relevante Seiten:** Dashboard-Liste, SQL Lab, Filter Bar, Chart-Erstellung

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 6. WCAG 1.4.5 -- Bilder von Text

**Ziel:** Text wird nicht als Bild dargestellt, wenn dieselbe visuelle Praesentation mit echtem Text moeglich ist.

**Testschritte:**

1. Chart-Titel und Achsenbeschriftungen pruefen.
   - **ERWARTUNG:** Titel und Labels sind als SVG-Text (`<text>`-Element) gerendert, nicht als Canvas-Bitmap. Screenreader kann den Text lesen.
2. Dashboard-Titel und Widget-Ueberschriften pruefen.
   - **ERWARTUNG:** Alle Ueberschriften sind echte HTML-Textelemente, keine gerenderten Bilder.
3. Navigations-Logos pruefen.
   - **ERWARTUNG:** Wenn ein Logo ein Bild ist, hat es ein `alt`-Attribut. Text neben dem Logo ist echtes HTML.

**Relevante Seiten:** Dashboard-Ansicht, Chart-Explore, Navigation

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 7. WCAG 1.4.10 -- Reflow (320px Viewport)

**Ziel:** Bei 320px Breite (bzw. 400% Zoom) ist der Inhalt ohne horizontales Scrollen nutzbar (ausser bei Datentabellen und komplexen Diagrammen).

**Testschritte:**

1. Browser-Fenster auf 320px Breite setzen (oder 400% Zoom) und Dashboard-Liste aufrufen.
   - **ERWARTUNG:** Navigation wird zu einem Hamburger-Menu. Listeneintraege umbrechen sinnvoll. Kein horizontales Scrollen fuer Hauptinhalt.
2. Login-Seite bei 320px testen.
   - **ERWARTUNG:** Formular ist einzeilig gestapelt, Buttons sind voll sichtbar, kein Content wird abgeschnitten.
3. Chart-Explore-Seite bei 320px testen.
   - **ERWARTUNG:** Sidebar und Chart-Bereich werden vertikal gestapelt. Steuerungselemente bleiben erreichbar.

**Relevante Seiten:** Dashboard-Liste, Login-Seite, Chart-Explore, SQL Lab

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 8. WCAG 1.4.11 -- Nicht-Text-Kontrast (3:1 Minimum)

**Ziel:** UI-Komponenten und grafische Objekte haben ein Kontrastverhaeltnis von mindestens 3:1 gegenueber dem Hintergrund.

**Testschritte:**

1. Focus-Indikatoren auf interaktiven Elementen pruefen (Buttons, Links, Eingabefelder).
   - **ERWARTUNG:** Der Focus-Ring hat mindestens 3:1 Kontrast zum Hintergrund. Messung mit Color Contrast Analyzer oder axe DevTools.
2. Formular-Rahmen (Input Borders) pruefen.
   - **ERWARTUNG:** Eingabefeld-Raender haben mindestens 3:1 Kontrast zum umgebenden Hintergrund.
3. Chart-Elemente (Balken, Linien, Kreissegmente) auf Kontrast zum Hintergrund pruefen.
   - **ERWARTUNG:** Alle grafischen Elemente im Chart haben mindestens 3:1 Kontrast zur Zeichenflaeche.
4. Toggle-Switches und Checkboxes pruefen.
   - **ERWARTUNG:** Zustandsaenderung (an/aus) ist mit mindestens 3:1 Kontrast visuell erkennbar.

**Relevante Seiten:** Alle Formulare, Dashboard-Charts, Einstellungsseiten

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

## Level AA -- Interaktion

### 9. WCAG 1.3.5 -- Eingabezweck bestimmen (autocomplete)

**Ziel:** Eingabefelder fuer persoenliche Daten haben das korrekte `autocomplete`-Attribut.

**Testschritte:**

1. Login-Seite: Benutzername- und Passwort-Feld pruefen.
   - **ERWARTUNG:** Benutzername-Feld hat `autocomplete="username"`, Passwort-Feld hat `autocomplete="current-password"`.
2. Profil-Einstellungen: E-Mail- und Name-Felder pruefen.
   - **ERWARTUNG:** E-Mail hat `autocomplete="email"`, Vorname hat `autocomplete="given-name"`, Nachname hat `autocomplete="family-name"`.
3. Passwort-Aendern-Dialog pruefen.
   - **ERWARTUNG:** Altes Passwort hat `autocomplete="current-password"`, neues Passwort hat `autocomplete="new-password"`.

**Relevante Seiten:** Login-Seite, Profil-Einstellungen, Passwort-Dialog

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 10. WCAG 1.4.13 -- Hover/Fokus-Inhalte (Tooltips)

**Ziel:** Zusaetzliche Inhalte, die bei Hover oder Fokus erscheinen, sind verweilbar, schliessbar und persistent.

**Testschritte:**

1. Toolbar-Buttons mit Tooltips: Maus ueber Button bewegen.
   - **ERWARTUNG:** Tooltip erscheint, bleibt sichtbar wenn Maus zum Tooltip bewegt wird (verweilbar), verschwindet mit Escape (schliessbar).
2. Chart-Datenpunkte: Maus ueber Datenpunkt in einem Chart bewegen.
   - **ERWARTUNG:** Tooltip mit Datenwert erscheint, bleibt stabil und verdeckt keine anderen interaktiven Elemente.
3. Fokus-basierte Tooltips: Per Tab zu einem Element mit Tooltip navigieren.
   - **ERWARTUNG:** Tooltip erscheint bei Fokus, bleibt sichtbar bis Fokus weiterbewegt wird, kann mit Escape geschlossen werden ohne den Fokus zu verlieren.

**Relevante Seiten:** Toolbar, Dashboard-Charts, Chart-Explore, SQL Lab

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 11. WCAG 2.4.6 -- Ueberschriften und Beschriftungen

**Ziel:** Ueberschriften und Labels beschreiben den Zweck oder das Thema klar und eindeutig.

**Testschritte:**

1. Dashboard-Ansicht: Ueberschriften-Hierarchie mit Screenreader pruefen (H-Taste in NVDA).
   - **ERWARTUNG:** Eine logische Hierarchie existiert: h1 fuer Seitentitel, h2 fuer Abschnitte, h3 fuer Unterabschnitte. Keine uebersprungenen Ebenen.
2. Chart-Explore: Formular-Labels pruefen.
   - **ERWARTUNG:** Jedes Eingabefeld hat ein zugehoeriges `<label>` oder `aria-label`. Screenreader liest den Feldnamen vor dem Eingabefeld.
3. SQL Lab: Abschnittsueberschriften pruefen.
   - **ERWARTUNG:** "Ergebnisse", "Abfrageverlauf", "Gespeicherte Abfragen" sind als Ueberschriften oder Tab-Labels korrekt ausgezeichnet.
4. Listenansichten (Dashboard-Liste, Chart-Liste): Spaltenkoepfe pruefen.
   - **ERWARTUNG:** Tabellen-Header (`<th>`) haben eindeutige Beschriftungen. Sortierbare Spalten haben `aria-sort`.

**Relevante Seiten:** Dashboard-Ansicht, Chart-Explore, SQL Lab, Listen-Seiten

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 12. WCAG 2.4.7 -- Fokus sichtbar

**Ziel:** Alle interaktiven Elemente haben einen sichtbaren Fokus-Indikator bei Tastaturnavigation.

**Testschritte:**

1. Mit Tab durch die Hauptnavigation navigieren.
   - **ERWARTUNG:** Jedes fokussierte Element hat einen klar sichtbaren Focus-Ring (mindestens 2px, kontrastreicher Rahmen). Der Fokus ist auf dunklem und hellem Hintergrund sichtbar.
2. Dashboard-Filter-Bar: Durch alle Filter-Elemente tabben.
   - **ERWARTUNG:** Dropdowns, Eingabefelder und Buttons zeigen alle einen deutlichen Fokus-Indikator. Fokus geht nicht "verloren" in der Filter-Bar.
3. Modale Dialoge: Tab-Reihenfolge innerhalb eines Modals testen (z.B. "Neues Dashboard erstellen").
   - **ERWARTUNG:** Fokus ist auf das Modal beschraenkt (Focus Trap). Jedes Element im Modal hat sichtbaren Fokus. Escape schliesst das Modal und Fokus kehrt zum Ausloeser zurueck.
4. Dropdown-Menus: Menu oeffnen und durch Optionen navigieren.
   - **ERWARTUNG:** Aktuelle Option ist visuell hervorgehoben UND hat Fokus-Indikator. Pfeiltasten bewegen den Fokus durch die Optionen.

**Relevante Seiten:** Navigation, Filter Bar, Modale Dialoge, Dropdown-Menus

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 13. WCAG 3.1.2 -- Sprache von Teilen

**Ziel:** Die menschliche Sprache jedes Abschnitts oder Satzes kann programmatisch bestimmt werden, wenn sie von der Hauptsprache abweicht.

**Testschritte:**

1. HTML `lang`-Attribut auf dem `<html>`-Element pruefen.
   - **ERWARTUNG:** `lang="de"` (oder die konfigurierte Sprache) ist gesetzt. Screenreader wechselt auf die korrekte Sprachausgabe.
2. Mischsprachige Inhalte pruefen (z.B. englische Fachbegriffe in deutscher Oberflaeche).
   - **ERWARTUNG:** Abschnitte mit abweichender Sprache haben ein `lang`-Attribut auf dem umschliessenden Element (z.B. `<span lang="en">Dashboard</span>`).
3. Sprachumschaltung testen (falls vorhanden).
   - **ERWARTUNG:** Nach Sprachwechsel wird das `lang`-Attribut aktualisiert. Screenreader wechselt die Sprachausgabe.

**Relevante Seiten:** Alle Seiten, besonders mehrsprachige Konfigurationen

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 14. WCAG 3.2.3 -- Konsistente Navigation

**Ziel:** Navigationselemente, die auf mehreren Seiten wiederholt werden, erscheinen in derselben relativen Reihenfolge.

**Testschritte:**

1. Hauptnavigation auf drei verschiedenen Seiten vergleichen (Dashboard-Liste, Chart-Liste, SQL Lab).
   - **ERWARTUNG:** Die Reihenfolge der Navigationseintraege ist identisch. Screenreader liest dieselbe Sequenz auf allen Seiten.
2. Breadcrumbs-Navigation auf verschiedenen Unterseiten pruefen.
   - **ERWARTUNG:** Breadcrumbs erscheinen immer an derselben Position, als `<nav aria-label="Breadcrumb">` ausgezeichnet.
3. Navigation-Landmarks mit Screenreader auflisten (D-Taste in NVDA).
   - **ERWARTUNG:** Dieselben Landmarks (Navigation, Main, Complementary) sind auf allen Seiten vorhanden und in derselben Reihenfolge.

**Relevante Seiten:** Dashboard-Liste, Chart-Liste, SQL Lab, Profil-Seite

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

### 15. WCAG 3.3.3 -- Vorschlag bei Fehler

**Ziel:** Wenn ein Eingabefehler erkannt wird und Korrekturvorschlaege bekannt sind, werden diese dem Benutzer bereitgestellt.

**Testschritte:**

1. Login-Seite: Benutzername leer lassen und absenden.
   - **ERWARTUNG:** Fehlermeldung enthaelt einen konkreten Hinweis (z.B. "Bitte geben Sie Ihren Benutzernamen ein"), nicht nur "Fehler".
2. Database-Modal: Ungueltigen Connection-String eingeben.
   - **ERWARTUNG:** Fehlermeldung beschreibt das erwartete Format (z.B. "Erwartet: postgresql://user:pass@host:port/dbname").
3. SQL Lab: Syntaxfehler in SQL-Abfrage.
   - **ERWARTUNG:** Fehlermeldung zeigt die Position des Fehlers und einen Hinweis zur Korrektur. Screenreader liest die Meldung mit `role="alert"` vor.
4. Chart-Erstellung: Inkompatiblen Datentyp fuer eine Metrik auswaehlen.
   - **ERWARTUNG:** Fehlermeldung erklaert, welche Datentypen erwartet werden oder schlaegt eine Alternative vor.

**Relevante Seiten:** Login-Seite, Database-Modal, SQL Lab, Chart-Erstellung

**Ergebnis:** | NVDA Chrome: ☐ Pass ☐ Fail | NVDA Firefox: ☐ Pass ☐ Fail | VoiceOver Safari: ☐ Pass ☐ Fail |

**Kommentar:** ___________

---

## Ergebnis-Protokoll (Zusammenfassung)

| Nr | WCAG | Kriterium | NVDA Chrome | NVDA Firefox | VoiceOver Safari | Bestanden |
|----|------|-----------|-------------|--------------|------------------|-----------|
| 1 | 1.1.1 | Nicht-Text-Inhalt | | | | ☐ |
| 2 | 1.3.3 | Sensorische Eigenschaften | | | | ☐ |
| 3 | 1.4.1 | Benutzung von Farbe | | | | ☐ |
| 4 | 3.3.1 | Fehlerkennzeichnung | | | | ☐ |
| 5 | 1.4.4 | Textgroesse aendern (200%) | | | | ☐ |
| 6 | 1.4.5 | Bilder von Text | | | | ☐ |
| 7 | 1.4.10 | Reflow (320px) | | | | ☐ |
| 8 | 1.4.11 | Nicht-Text-Kontrast (3:1) | | | | ☐ |
| 9 | 1.3.5 | Eingabezweck bestimmen | | | | ☐ |
| 10 | 1.4.13 | Hover/Fokus-Inhalte | | | | ☐ |
| 11 | 2.4.6 | Ueberschriften und Beschriftungen | | | | ☐ |
| 12 | 2.4.7 | Fokus sichtbar | | | | ☐ |
| 13 | 3.1.2 | Sprache von Teilen | | | | ☐ |
| 14 | 3.2.3 | Konsistente Navigation | | | | ☐ |
| 15 | 3.3.3 | Vorschlag bei Fehler | | | | ☐ |

### Gesamtergebnis

| Kategorie | Bestanden | Nicht bestanden | Gesamt |
|-----------|-----------|-----------------|--------|
| Level A (1-4) | | | 4 |
| Level AA Visuell (5-8) | | | 4 |
| Level AA Interaktion (9-15) | | | 7 |
| **Gesamt** | | | **15** |

### Anmerkungen

_Platz fuer allgemeine Beobachtungen, bekannte Einschraenkungen und Empfehlungen:_

1. ___________
2. ___________
3. ___________

### Freigabe

| Rolle | Name | Datum | Unterschrift |
|-------|------|-------|--------------|
| Tester | | | |
| Fachliche Abnahme | | | |
| Auftraggeber | | | |
