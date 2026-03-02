# Abnahme-Checkliste -- Apache Superset WCAG 2.1 Barrierefreiheit

| Feld                | Wert                                                  |
|---------------------|-------------------------------------------------------|
| Version             | Branch `fix/a11y-improvements-v3`                     |
| Pruefungsdatum      | ___________________                                   |
| Pruefer (Name)      | ___________________                                   |
| Pruefer (Rolle)     | ___________________                                   |
| Superset-Version    | ___________________                                   |
| Browser             | ___________________                                   |
| Betriebssystem      | ___________________                                   |

---

## A. Abnahme-Kriterien -- WCAG 2.1 Erfolgskriterien

### Level A (4 Kriterien)

| Nr | WCAG   | Kriterium                       | Level | Bestanden | Nicht bestanden | Maengel (Verweis) | Anmerkungen |
|----|--------|---------------------------------|-------|-----------|-----------------|-------------------|-------------|
| 1  | 1.1.1  | Nicht-Text-Inhalte              | A     | [ ]       | [ ]             |                   |             |
| 2  | 1.3.3  | Sensorische Eigenschaften       | A     | [ ]       | [ ]             |                   |             |
| 3  | 1.4.1  | Verwendung von Farbe            | A     | [ ]       | [ ]             |                   |             |
| 4  | 3.3.1  | Fehlererkennung                 | A     | [ ]       | [ ]             |                   |             |

### Level AA (11 Kriterien)

| Nr | WCAG   | Kriterium                       | Level | Bestanden | Nicht bestanden | Maengel (Verweis) | Anmerkungen |
|----|--------|---------------------------------|-------|-----------|-----------------|-------------------|-------------|
| 5  | 1.3.5  | Eingabezweck bestimmen          | AA    | [ ]       | [ ]             |                   |             |
| 6  | 1.4.4  | Textgroessenanpassung           | AA    | [ ]       | [ ]             |                   |             |
| 7  | 1.4.5  | Bilder von Text                 | AA    | [ ]       | [ ]             |                   |             |
| 8  | 1.4.10 | Umfliessen (Reflow)             | AA    | [ ]       | [ ]             |                   |             |
| 9  | 1.4.11 | Nicht-Text-Kontrast             | AA    | [ ]       | [ ]             |                   |             |
| 10 | 1.4.13 | Inhalt bei Hover oder Fokus     | AA    | [ ]       | [ ]             |                   |             |
| 11 | 2.4.6  | Ueberschriften und Labels       | AA    | [ ]       | [ ]             |                   |             |
| 12 | 2.4.7  | Sichtbarer Fokus                | AA    | [ ]       | [ ]             |                   |             |
| 13 | 3.1.2  | Sprache von Teilen              | AA    | [ ]       | [ ]             |                   |             |
| 14 | 3.2.3  | Konsistente Navigation          | AA    | [ ]       | [ ]             |                   |             |
| 15 | 3.3.3  | Fehlervorschlaege               | AA    | [ ]       | [ ]             |                   |             |

**Zusammenfassung Level A:** ____/4 bestanden
**Zusammenfassung Level AA:** ____/11 bestanden
**Gesamt:** ____/15 bestanden

---

## B. Automatisierte Tests

| Nr | Testbereich                  | Werkzeug     | Bestanden | Nicht bestanden | Anmerkungen |
|----|------------------------------|-------------|-----------|-----------------|-------------|
| 1  | Axe-Core WCAG-Scan           | jest-axe     | [ ]       | [ ]             |             |
| 2  | Jest Unit Tests (A11y)       | Jest         | [ ]       | [ ]             |             |
| 3  | Regressionstests             | Jest         | [ ]       | [ ]             |             |
| 4  | Chrome Cross-Browser         | Manuell      | [ ]       | [ ]             |             |
| 5  | Firefox Cross-Browser        | Manuell      | [ ]       | [ ]             |             |
| 6  | Safari Cross-Browser         | Manuell      | [ ]       | [ ]             |             |
| 7  | Edge Cross-Browser           | Manuell      | [ ]       | [ ]             |             |

---

## C. Screenreader-Tests

| Nr | Kombination            | Getestet | Bestanden | Nicht bestanden | Anmerkungen |
|----|------------------------|----------|-----------|-----------------|-------------|
| 1  | NVDA + Chrome          | [ ]      | [ ]       | [ ]             |             |
| 2  | NVDA + Firefox         | [ ]      | [ ]       | [ ]             |             |
| 3  | VoiceOver + Safari     | [ ]      | [ ]       | [ ]             |             |

### Screenreader-Pruefpunkte (pro Kombination)

| Pruefpunkt                                | NVDA+Chrome | NVDA+Firefox | VO+Safari |
|-------------------------------------------|-------------|--------------|-----------|
| Seitenstruktur wird korrekt vorgelesen    | [ ]         | [ ]          | [ ]       |
| Ueberschriften-Hierarchie erkennbar       | [ ]         | [ ]          | [ ]       |
| Formular-Labels werden vorgelesen         | [ ]         | [ ]          | [ ]       |
| Fehlermeldungen werden angekundigt        | [ ]         | [ ]          | [ ]       |
| Navigation als Landmark erkannt           | [ ]         | [ ]          | [ ]       |
| Chart-Beschreibungen vorhanden            | [ ]         | [ ]          | [ ]       |
| Status-Informationen vorgelesen           | [ ]         | [ ]          | [ ]       |
| Modale Dialoge korrekt angekundigt        | [ ]         | [ ]          | [ ]       |

---

## D. Dokumentation

| Nr | Dokument                       | Vorhanden | Vollstaendig | Anmerkungen |
|----|-------------------------------|-----------|--------------|-------------|
| 1  | Betriebsbereitschaftserklaerung (`DEPLOYMENT_READY.md`)     | [ ] | [ ] |  |
| 2  | Quellcode-Dokumentation (inline JSDoc/Kommentare)            | [ ] | [ ] |  |
| 3  | Screenreader-Testprotokoll (`screenreader-test-protocol.md`) | [ ] | [ ] |  |
| 4  | Cross-Browser-Matrix (`cross-browser-test-matrix.md`)        | [ ] | [ ] |  |
| 5  | Automatisierter Testbericht (`a11y-test-report.md`)          | [ ] | [ ] |  |
| 6  | Funktionspruefungs-Leitfaden (`FUNCTIONAL_TEST_GUIDE.md`)    | [ ] | [ ] |  |
| 7  | Diese Abnahme-Checkliste (`ACCEPTANCE_CHECKLIST.md`)         | [ ] | [ ] |  |

---

## E. Gesamtergebnis

| Nr | Kriterium                                                    | Erfuellt |
|----|--------------------------------------------------------------|----------|
| 1  | Alle 15 WCAG 2.1 Kriterien bestanden                        | [ ]      |
| 2  | Keine kritischen Maengel offen                               | [ ]      |
| 3  | Keine schwerwiegenden Maengel offen                          | [ ]      |
| 4  | Automatisierte Tests bestanden                               | [ ]      |
| 5  | Screenreader-Tests bestanden (mind. 1 Kombination)           | [ ]      |
| 6  | Cross-Browser-Tests bestanden (mind. 2 Browser)              | [ ]      |
| 7  | Dokumentation vollstaendig                                   | [ ]      |
| 8  | **Abnahme erteilt**                                          | [ ]      |

### Entscheidung

- [ ] **Abnahme erteilt** -- Alle Kriterien erfuellt, keine offenen kritischen/schwerwiegenden Maengel
- [ ] **Abnahme mit Auflagen** -- Geringfuegige Maengel vorhanden, Nachbesserungsfrist vereinbart
- [ ] **Abnahme verweigert** -- Kritische oder schwerwiegende Maengel vorhanden

Begruendung (bei Auflagen oder Verweigerung):

> ___________________________________________________________________________
> ___________________________________________________________________________
> ___________________________________________________________________________

---

## F. Unterschriften

### Auftraggeber

| Feld           | Eintrag                   |
|----------------|---------------------------|
| Name           | _________________________  |
| Rolle          | _________________________  |
| Organisation   | _________________________  |
| Datum          | _________________________  |
| Unterschrift   | _________________________  |

### Auftragnehmer

| Feld           | Eintrag                   |
|----------------|---------------------------|
| Name           | _________________________  |
| Rolle          | _________________________  |
| Organisation   | Aitema GmbH i.G.          |
| Datum          | _________________________  |
| Unterschrift   | _________________________  |

---

## G. Maengelliste

| Nr | WCAG  | Beschreibung | Schweregrad | Gefunden am | Status | Behoben am | Nachtest bestanden |
|----|-------|-------------|-------------|-------------|--------|------------|-------------------|
| 1  |       |             |             |             |        |            | [ ]               |
| 2  |       |             |             |             |        |            | [ ]               |
| 3  |       |             |             |             |        |            | [ ]               |
| 4  |       |             |             |             |        |            | [ ]               |
| 5  |       |             |             |             |        |            | [ ]               |
| 6  |       |             |             |             |        |            | [ ]               |
| 7  |       |             |             |             |        |            | [ ]               |
| 8  |       |             |             |             |        |            | [ ]               |
| 9  |       |             |             |             |        |            | [ ]               |
| 10 |       |             |             |             |        |            | [ ]               |

### Schweregrad-Legende

| Schweregrad      | Definition |
|------------------|-----------|
| **Kritisch**     | WCAG-Kriterium komplett nicht erfuellt, Nutzung fuer Betroffene unmoeglich |
| **Schwerwiegend** | WCAG-Kriterium teilweise nicht erfuellt, Nutzung stark eingeschraenkt |
| **Geringfuegig** | Kosmetische Abweichung, Nutzung moeglich aber nicht optimal |
| **Hinweis**      | Verbesserungsvorschlag, kein WCAG-Verstoss |

### Maengel-Status-Legende

| Status          | Bedeutung |
|-----------------|-----------|
| **Offen**       | Mangel identifiziert, noch nicht behoben |
| **In Arbeit**   | Auftragnehmer arbeitet an Behebung |
| **Behoben**     | Auftragnehmer meldet Behebung, Nachtest ausstehend |
| **Abgeschlossen** | Nachtest bestanden, Mangel ist behoben |
| **Zurueckgestellt** | Einvernehmlich auf spaeteres Release verschoben |
