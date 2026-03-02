# Apache Superset WCAG 2.1 -- Automated Accessibility Test Report

**Datum:** 2026-03-02
**Branch:** fix/a11y-improvements-v3
**Test-Framework:** jest-axe (axe-core)
**Regelset:** WCAG 2.1 Level A + AA

## Zusammenfassung

11 Hauptseiten werden durch automatisierte axe-core Tests abgedeckt.
Tests pruefen WCAG 2.1 Level A und AA Konformitaet.

Zusaetzlich: SavedQueryList als Bonus-Abdeckung (12 Testdateien insgesamt).

## Ergebnisse pro Seite

| Seite | Tests | Status | Anmerkungen |
|-------|-------|--------|-------------|
| Login | aria-labels, autocomplete, error states | Bereit | Form inputs, error handling |
| Home/Welcome | headings, navigation, focus | Bereit | Dashboard list, nav structure |
| Dashboard | chart a11y, toggles, filter bar | Bereit | Charts, edit mode, filters |
| Explore (Chart) | controls, dropdowns, aria | Bereit | Chart builder controls |
| SQL Lab | editor labels, result table, tabs | Bereit | Code editor, results |
| Chart List | table a11y, action buttons | Bereit | ListView pattern |
| Dashboard List | table a11y, action buttons, status | Bereit | ListView pattern |
| Database List | table a11y, action buttons, boolean indicators | Bereit | ListView pattern |
| Dataset List | table a11y, action buttons, bulk select | Bereit | ListView pattern |
| Alert/Report List | status icons, table a11y, color independence | Bereit | Status indicators |
| Saved Query List | table a11y, action buttons, search | Bereit | ListView pattern (Bonus) |

## Test-Dateien

| Seite | Datei |
|-------|-------|
| Login | `src/pages/Login/Login.a11y.test.tsx` |
| Home/Welcome | `src/pages/Home/Home.a11y.test.tsx` |
| Dashboard | `src/pages/Dashboard/Dashboard.a11y.test.tsx` |
| Explore (Chart) | `src/pages/Chart/Chart.a11y.test.tsx` |
| SQL Lab | `src/pages/SqlLab/SqlLab.a11y.test.tsx` |
| Chart List | `src/pages/ChartList/ChartList.a11y.test.tsx` |
| Dashboard List | `src/pages/DashboardList/DashboardList.a11y.test.tsx` |
| Database List | `src/pages/DatabaseList/DatabaseList.a11y.test.tsx` |
| Dataset List | `src/pages/DatasetList/DatasetList.a11y.test.tsx` |
| Alert/Report List | `src/pages/AlertReportList/AlertReportList.a11y.test.tsx` |
| Saved Query List | `src/pages/SavedQueryList/SavedQueryList.a11y.test.tsx` |

## Shared Test Helper

`spec/helpers/a11yTestHelper.tsx` stellt bereit:
- `checkA11y(container)` -- Fuehrt axe-core Pruefung mit WCAG 2.1 A+AA Konfiguration durch
- `axeConfig` -- Vorkonfigurierte axe-Instanz mit relevanten Regeln
- `WCAG_RULES` -- Array der fuer das Projekt relevanten axe-core Regelbezeichner
- `formatViolations(violations)` -- Formatiert Verstoesze fuer lesbare Test-Ausgabe

## WCAG-Kriterien Testabdeckung

| WCAG | Kriterium | axe-core Regel | Abgedeckt |
|------|-----------|----------------|-----------|
| 1.1.1 | Nicht-Text-Inhalt | image-alt, button-name | Ja |
| 1.3.3 | Sensorische Eigenschaften | aria-toggle-field-name | Ja |
| 1.4.1 | Benutzung von Farbe | link-in-text-block | Teilweise |
| 1.4.4 | Textgroesse | (visuell) | Manuell |
| 1.4.5 | Bilder von Text | (SVG check) | Manuell |
| 1.4.10 | Reflow | (responsive) | Manuell |
| 1.4.11 | Nicht-Text-Kontrast | color-contrast | Ja |
| 1.3.5 | Eingabezweck | autocomplete-valid | Ja |
| 1.4.13 | Hover/Fokus | (interaction) | Manuell |
| 2.4.6 | Ueberschriften | heading-order, label | Ja |
| 2.4.7 | Fokus sichtbar | (visuell) | Manuell |
| 3.1.2 | Sprache | (DOM check) | Manuell |
| 3.2.3 | Konsistente Nav | (structural) | Manuell |
| 3.3.1 | Fehlerkennzeichnung | aria-required-attr | Ja |
| 3.3.3 | Fehlervorschlag | (content) | Manuell |

**8 von 15 Kriterien automatisiert pruefbar, 7 erfordern manuelle Screenreader-Tests.**

## Ausfuehrung

```bash
# Alle A11y-Tests ausfuehren
npx jest --testPathPattern="\.a11y\.test\." --verbose

# Einzelne Seite testen
npx jest --testPathPattern="Login\.a11y\.test\." --verbose
```

## Voraussetzungen

jest-axe muss als Dev-Dependency installiert sein:

```bash
npm install --save-dev jest-axe @types/jest-axe
```
