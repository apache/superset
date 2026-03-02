# Betriebsbereitschaftserklaerung -- Apache Superset WCAG 2.1 Barrierefreiheits-Patches

| Feld     | Wert                                |
|----------|-------------------------------------|
| Version  | Branch `fix/a11y-improvements-v3`   |
| Datum    | 2026-03-02                          |
| Status   | **Bereit fuer Deployment**          |

---

## A. Zusammenfassung

Dieses Paket umfasst additive Frontend-Patches fuer Apache Superset zur Erreichung der WCAG 2.1 Konformitaet auf Level A und AA.

**Umfang:**
- **15 WCAG 2.1 Erfolgskriterien** abgedeckt
  - 4 Kriterien Level A (1.1.1, 1.3.3, 1.4.1, 3.3.1)
  - 11 Kriterien Level AA (1.3.5, 1.4.4, 1.4.5, 1.4.10, 1.4.11, 1.4.13, 2.4.6, 2.4.7, 3.1.2, 3.2.3, 3.3.3)
- **Additive Patches** -- bestehende Funktionalitaet bleibt vollstaendig erhalten
- **Keine Backend-Aenderungen** -- ausschliesslich Frontend-Modifikationen
- **Keine Datenbankmigrationen** erforderlich

---

## B. Systemvoraussetzungen

### Superset

| Komponente       | Version          |
|------------------|------------------|
| Apache Superset  | 5.x (master)    |
| Node.js          | 18+ (LTS)       |
| npm              | 9+               |
| Python           | 3.10+            |

### Browser-Support

| Browser          | Mindestversion   | Getestet   |
|------------------|------------------|------------|
| Google Chrome    | 120+             | Ja         |
| Mozilla Firefox  | 120+             | Ja         |
| Apple Safari     | 17+              | Ja         |
| Microsoft Edge   | 120+             | Ja         |

### Screenreader-Kompatibilitaet

| Screenreader     | Version / Plattform         | Getestet   |
|------------------|-----------------------------|------------|
| NVDA             | 2024.1+ (Windows)           | Ja         |
| VoiceOver        | macOS Sonoma 14+ / iOS 17+  | Ja         |

---

## C. Deployment-Schritte

### 1. Repository klonen

```bash
git clone git@github.com:Aitema-gmbh/superset.git
cd superset
```

### 2. Branch auschecken

```bash
git checkout fix/a11y-improvements-v3
```

### 3. Frontend bauen

```bash
cd superset-frontend
npm ci
npm run build
```

Der Build erzeugt die Produktions-Assets unter `superset-frontend/dist/`.

### 4. Backend starten (unveraendert)

Das Backend wird wie gewohnt gestartet. Es sind keine Aenderungen am Backend, an der Konfiguration oder an Datenbankmigrationen erforderlich.

```bash
# Beispiel mit Docker Compose (Standard-Superset-Setup)
docker compose up -d

# Oder manuell:
superset run -h 0.0.0.0 -p 8088
```

### 5. Verifizierung mit automatisierten Tests

```bash
cd superset-frontend

# Axe-Core Accessibility Tests ausfuehren
npx jest --testPathPattern='a11y\.test' --no-coverage

# Regressionstests ausfuehren
npx jest --testPathPattern='a11y-regression' --no-coverage
```

Alle Tests muessen bestanden sein (gruenes Ergebnis).

---

## D. Geaenderte Bereiche

### Quellcode-Aenderungen (superset-frontend/src/)

| Bereich | Dateien | Beschreibung |
|---------|---------|--------------|
| **Login / Registrierung** | `pages/Login/index.tsx`, `pages/Register/index.tsx` | ARIA-Labels, Autocomplete-Attribute, Fehlermeldungen mit `role="alert"` |
| **Dashboard** | `dashboard/components/Header/`, `dashboard/components/SliceHeader/`, `dashboard/components/nativeFilters/`, `dashboard/styles.ts` | Fokus-Indikatoren, Ueberschriften-Hierarchie, Filter-Landmarks, Skip-Links |
| **Chart / Explore** | `components/Chart/Chart.tsx`, `explore/components/controls/`, `visualizations/` | SVG-Renderer fuer Charts, ARIA-Labels fuer Controls, Kontrastverbesserungen |
| **SQL Lab** | `SqlLab/components/RunQueryActionButton/`, `SqlLab/components/TabbedSqlEditors/` | Tastaturnavigation, Tab-ARIA-Labels |
| **Listen-Seiten** | `pages/ChartList/`, `pages/DashboardList/`, `pages/DatabaseList/`, `pages/DatasetList/`, `pages/AlertReportList/`, `pages/SavedQueryList/` | Tabellen-Accessibility, Status-Icons mit Textlabels |
| **Fehlerbehandlung** | `components/ErrorMessage/`, `components/ImportModal/ErrorAlert.tsx` | `role="alert"`, `aria-invalid`, `aria-describedby` |
| **Navigation** | `features/home/Menu.tsx`, `features/home/SubMenu.tsx` | Navigationslevel-Landmarks, `<nav>`-Labels, konsistente Navigation |
| **Formulare** | `components/Modal/ModalFormField.tsx`, `features/databases/DatabaseModal/`, `features/alerts/AlertReportModal.tsx` | `autocomplete`-Attribute, Fehlersuggestionen, Label-Verknuepfungen |
| **Status-Indikatoren** | `features/alerts/components/AlertStatusIcon.tsx`, `features/tasks/TaskStatusIcon.tsx` | Farb-unabhaengige Erkennbarkeit (Icons + Text + Shape) |
| **Globale Styles** | `dashboard/styles.ts`, `dashboard/util/useFilterFocusHighlightStyles.ts` | Responsive Reflow (320px), Fokus-Sichtbarkeit, Kontrastverstarkung |
| **App-Level** | `views/App.tsx`, `components/Accessibility/SkipLink.tsx` | `lang`-Attribut, Skip-Navigation |

### Tests (superset-frontend/src/)

| Bereich | Dateien | Beschreibung |
|---------|---------|--------------|
| **Axe-Core Tests** | `pages/*/\*.a11y.test.tsx` (11 Dateien) | Automatisierte WCAG-Pruefung pro Seite |
| **Regressionstests** | `a11y-regression.test.tsx` | Upstream-Kompatibilitaetspruefung |
| **Unit Tests** | `components/Chart/Chart.test.tsx`, `features/alerts/components/AlertStatusIcon.test.tsx`, u.a. | Komponenten-spezifische A11y-Tests |

### Dokumentation (superset-frontend/docs/)

| Dokument | Beschreibung |
|----------|--------------|
| `screenreader-test-protocol.md` | Manuelles Screenreader-Testprotokoll |
| `cross-browser-test-matrix.md` | Browser-Kompatibilitaetsmatrix |
| `a11y-test-report.md` | Automatisierter Testergebnis-Bericht |
| `DEPLOYMENT_READY.md` | Dieses Dokument |
| `FUNCTIONAL_TEST_GUIDE.md` | 5-Tage Funktionspruefungs-Leitfaden |
| `ACCEPTANCE_CHECKLIST.md` | Abnahme-Checkliste |

---

## E. Bekannte Einschraenkungen

| Nr | Einschraenkung | Auswirkung | Workaround |
|----|----------------|-----------|------------|
| 1 | **SVG-Renderer Performance** bei Charts mit >10.000 Datenpunkten | Charts mit sehr vielen Datenpunkten koennen langsamer rendern als mit Canvas-Renderer | Fuer datenintensive Dashboards kann der Canvas-Renderer per Chart-Konfiguration zurueckgesetzt werden |
| 2 | **Safari Tab-Focus-Highlights** | Safari zeigt Tab-Focus standardmaessig nicht fuer alle Elemente an | Nutzer muessen in Safari unter Einstellungen > Erweitert > "Tabulator zum Hervorheben von Objekten verwenden" aktivieren |
| 3 | **Mobile-Scope** | Responsive Reflow ist fuer 320px Desktop-Viewport optimiert, kein vollstaendiger Mobile-Scope | Mobile-Optimierung ist nicht Teil des Auftrags; Desktop-Barrierefreiheit ist vollstaendig gewaehrleistet |
| 4 | **Drittanbieter-Plugins** | Benutzerdefinierte Chart-Plugins von Drittanbietern sind nicht im Scope | Nur die Standard-Superset-Visualisierungen wurden angepasst |

---

## F. Ansprechpartner

| Rolle | Kontakt |
|-------|---------|
| **Auftragnehmer** | Aitema GmbH i.G. |
| **Technischer Ansprechpartner** | fedo.hagge-kubat@aitema.de |
| **Repository** | github.com/Aitema-gmbh/superset (Branch: `fix/a11y-improvements-v3`) |
