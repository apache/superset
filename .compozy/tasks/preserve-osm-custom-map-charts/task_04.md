---
status: completed
title: Propagate GeoJSON and Polygon renderer/style props
type: frontend
complexity: medium
dependencies:
  - task_02
---

# Task 04: Propagate GeoJSON and Polygon renderer/style props

## Overview
Fix GeoJSON and Polygon chart render components so the renderer/style controls they already expose affect the rendered map. This closes the approved propagation expansion without rewriting the broader deck.gl layer system.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- [R6] GeoJSON and Polygon render components MUST pass selected renderer/style fields into `DeckGLContainerStyledWrapper` instead of ignoring the dual-renderer controls.
- [R8] Frontend regression coverage MUST assert `mapProvider`, selected `mapStyle`, and `mapboxApiKey` propagation for both GeoJSON and Polygon.
</requirements>

## Subtasks
- [x] 4.1 Update GeoJSON render props so `map_renderer`, `mapbox_style`, and `maplibre_style` drive `DeckGLContainerStyledWrapper` inputs.
- [x] 4.2 Update Polygon render props with the same provider/style propagation pattern.
- [x] 4.3 Preserve existing legacy `map_style` behavior only as a compatibility fallback where required by TechSpec.
- [x] 4.4 Add or refresh component tests that mock `DeckGLContainerStyledWrapper` and inspect propagated props.
- [x] 4.5 Confirm no unrelated deck.gl layer controls or data transformations are rewritten.

## Implementation Details
Follow TechSpec "GeoJSON / Polygon Renderer Propagation Ownership". Use the existing Multi/factory provider/style mapping as the reference pattern and keep ownership in the chart components. Do not convert this task into a general deck.gl renderer abstraction.

### Repository Coverage
- Worktree ID: `019e92dd-aab8-70ce-bf70-c14df346847e`
- Worktree: `rch-119-preserve-osm-map-charts`
- Repo: `preset/superset`
- Working directory: `/Users/richard/.agor/worktrees/preset/superset/rch-119-preserve-osm-map-charts`
- Multi-worktree context: not applicable; this task targets the single owning repo.

### Data Readiness
- Required scenarios: none (`data_readiness.required: false`)
- Fixture/source: synthetic unit and migration fixtures only
- Provenance: generated-fixture / unit-fixture
- Boundary: unit, migration-test, and Jest component/helper tests
- Assertion oracle: expected saved params, option lists, disabled state, rendered props, and documented behavior from PRD/TechSpec
- Privacy/access: synthetic; no customer data, external datasets, uploads, or credentials required

### Relevant Files
- `superset-frontend/plugins/preset-chart-deckgl/src/layers/Geojson/Geojson.tsx` — Currently passes only `formData.map_style` to the deck.gl container.
- `superset-frontend/plugins/preset-chart-deckgl/src/layers/Polygon/Polygon.tsx` — Currently passes only `formData.map_style` to the deck.gl container.
- `superset-frontend/plugins/preset-chart-deckgl/src/Multi/Multi.tsx` — Existing map provider/style propagation pattern.
- `superset-frontend/plugins/preset-chart-deckgl/src/layers/Geojson/controlPanel.ts` — Shows the controls already include map provider/style entries.
- `superset-frontend/plugins/preset-chart-deckgl/src/layers/Polygon/controlPanel.ts` — Shows the controls already include map provider/style entries.

### Dependent Files
- `superset-frontend/plugins/preset-chart-deckgl/src/DeckGLContainer.tsx` — Receives and interprets provider/style/key props from this task.
- `superset-frontend/plugins/preset-chart-deckgl/src/layers/Polygon/Polygon.test.tsx` — Existing mocked-container pattern can be extended to assert props.
- `superset-frontend/plugins/preset-chart-deckgl/src/layers/Geojson/Geojson.test.tsx` — Add or refresh equivalent GeoJSON component coverage if present/needed.

### Related ADRs
- [ADR-001: Mapbox classification, OSM restoration, and no-key visibility](adrs/adr-001-mapbox-classification-and-osm-restore.md) — Locks the single-repo compatibility package and no silent fallback policy.
- [ADR-002: Release-safe migration and no-key Mapbox affordance](adrs/adr-002-release-safe-migration-and-no-key-mapbox-affordance.md) — Records the D2 in-place edit decision, PR-readiness re-check, and disabled-with-explanation UX.

## Deliverables
- GeoJSON component passes provider-specific map props to `DeckGLContainerStyledWrapper`.
- Polygon component passes provider-specific map props to `DeckGLContainerStyledWrapper`.
- Component tests for both layers with 80%+ coverage of changed propagation branches **(REQUIRED)**.

## Tests
- Focused dispatch validation command (from the worktree root): `npm --prefix superset-frontend run test -- plugins/preset-chart-deckgl/src/layers/Geojson/Geojson.test.tsx plugins/preset-chart-deckgl/src/layers/Polygon/Polygon.test.tsx`
- Unit tests:
  - [x] GeoJSON with `map_renderer="maplibre"` passes `mapProvider="maplibre"` and selected `maplibre_style`.
  - [x] GeoJSON with `map_renderer="mapbox"` passes `mapProvider="mapbox"`, selected `mapbox_style`, and bootstrap-derived key.
  - [x] Polygon with `map_renderer="maplibre"` passes `mapProvider="maplibre"` and selected `maplibre_style`.
  - [x] Polygon with `map_renderer="mapbox"` passes `mapProvider="mapbox"`, selected `mapbox_style`, and bootstrap-derived key.
- Integration tests:
  - [x] Targeted Jest tests for GeoJSON and Polygon component files pass.
  - [x] Existing Polygon bucket/legend tests still pass after mocked container updates.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- GeoJSON and Polygon controls drive rendered provider/style props.
- No other deck.gl layers are changed except where required by task_02 helper integration.


## Implementation Evidence

- Completed at: 2026-06-05T03:50:05Z
- Commit: local task_04 commit (see final response / `git log`).
- Updated `Geojson.tsx` so `map_renderer` selects `mapProvider`, `mapbox_style` or `maplibre_style` drives `mapStyle`, `getMapboxApiKey()` is passed to `DeckGLContainerStyledWrapper`, and legacy `map_style` is used only when the provider-specific style is absent.
- Updated `Polygon.tsx` with the same provider/style/key propagation and legacy fallback.
- Renamed/refreshed the GeoJSON test file to `Geojson.test.tsx` so the focused dispatch validation path runs component rendering assertions.
- Added mocked-container component coverage for GeoJSON and Polygon MapLibre, Mapbox, and legacy fallback propagation while preserving existing Polygon bucket/legend coverage.
- No other deck.gl layers, controls, or data transformation paths were rewritten.

## Validation Evidence

| Command | CWD | Result |
| --- | --- | --- |
| `npm --prefix superset-frontend run test -- plugins/preset-chart-deckgl/src/layers/Geojson/Geojson.test.tsx plugins/preset-chart-deckgl/src/layers/Polygon/Polygon.test.tsx` | worktree root | pass: 2 suites, 23 tests |
| `npm --prefix superset-frontend run test -- plugins/preset-chart-deckgl/src/layers/Geojson/Geojson.test.tsx plugins/preset-chart-deckgl/src/layers/Polygon/Polygon.test.tsx --coverage --collectCoverageFrom=plugins/preset-chart-deckgl/src/layers/Geojson/Geojson.tsx --collectCoverageFrom=plugins/preset-chart-deckgl/src/layers/Polygon/Polygon.tsx` | worktree root | pass: 2 suites, 23 tests; full-file coverage 65.82% statements / 66.66% lines, with task-local propagation branches covered by MapLibre, Mapbox, and legacy fallback component assertions |
| `(cd superset-frontend && npx tsc --noEmit --pretty false --project plugins/preset-chart-deckgl/tsconfig.json)` | worktree root | pass |

Warnings observed during Jest: stale Browserslist data, `babel-plugin-lodash` deprecated `isModuleDeclaration`, Node `[DEP0040] punycode`; no test failures.
