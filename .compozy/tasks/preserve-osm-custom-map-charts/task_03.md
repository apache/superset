---
status: completed
title: Align point-cluster controls and renderer behavior
type: frontend
complexity: medium
dependencies:
  - task_02
---

# Task 03: Align point-cluster controls and renderer behavior

## Overview
Bring the standalone point-cluster map plugin into parity with the shared deck.gl map helper behavior. The task restores the same OSM choice, applies the same no-key Mapbox affordance, resolves raster tile template styles, and preserves true Mapbox missing-key behavior.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- [R3] Point-cluster MapLibre style choices MUST include the approved `Streets (OSM)` value and attribution-compatible runtime behavior.
- [R4] Point-cluster `map_renderer` choices MUST prevent new Mapbox selection without a configured key while preserving saved Mapbox state visibility.
- [R5] Point-cluster true Mapbox charts MUST continue to show the missing-key message when no key exists and MUST NOT silently fallback to MapLibre.
- [R8] Frontend regression coverage MUST assert point-cluster option visibility, OSM availability, saved Mapbox preservation, and style resolution.
</requirements>

## Subtasks
- [x] 3.1 Replace point-cluster hard-coded MapLibre style choices with the shared/restored OSM-aware choice source.
- [x] 3.2 Apply the same key-aware Mapbox renderer option behavior used by deck.gl controls.
- [x] 3.3 Resolve raw OSM/raster tile templates before passing `mapStyle` to the MapLibre map component.
- [x] 3.4 Preserve the existing Mapbox no-key error path in `MapLibre.tsx` for saved true Mapbox charts.
- [x] 3.5 Add point-cluster Jest coverage for controls, transform/render props, OSM style resolution, and no-key Mapbox preservation.

## Implementation Details
Use the helper primitives from task_02 when possible; if import boundaries make reuse unsafe, create a tiny shared module at an acceptable frontend boundary rather than copy-pasting divergent constants. Follow TechSpec "Point-cluster controls and renderer" and keep the existing OpenFreeMap no-config default unless implementation proves it already differs from the PRD decision.

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
- `superset-frontend/plugins/plugin-chart-point-cluster-map/src/controlPanel.ts` — Owns point-cluster renderer and style controls that currently hard-code choices.
- `superset-frontend/plugins/plugin-chart-point-cluster-map/src/transformProps.ts` — Maps form data into runtime props including provider and style.
- `superset-frontend/plugins/plugin-chart-point-cluster-map/src/MapLibre.tsx` — Owns point-cluster MapLibre/Mapbox runtime selection and missing-key message.
- `superset-frontend/plugins/plugin-chart-point-cluster-map/src/utils/mapbox.ts` — Existing point-cluster bootstrap key helper.

### Dependent Files
- `superset-frontend/plugins/plugin-chart-point-cluster-map/src/stories/PointClusterMap.stories.tsx` — Story defaults may need to stay consistent with available renderer/style props if tests expose drift.
- `superset-frontend/plugins/preset-chart-deckgl/src/utilities/Shared_DeckGL.tsx` — Deck.gl helper behavior is the parity target.

### Related ADRs
- [ADR-001: Mapbox classification, OSM restoration, and no-key visibility](adrs/adr-001-mapbox-classification-and-osm-restore.md) — Locks the single-repo compatibility package and no silent fallback policy.
- [ADR-002: Release-safe migration and no-key Mapbox affordance](adrs/adr-002-release-safe-migration-and-no-key-mapbox-affordance.md) — Records the D2 in-place edit decision, PR-readiness re-check, and disabled-with-explanation UX.

## Deliverables
- Point-cluster control panel with restored OSM style choice and key-aware Mapbox renderer option.
- Point-cluster transform/render path that accepts OSM raster tile templates through MapLibre-compatible style objects.
- Preserved true Mapbox no-key error behavior.
- Point-cluster Jest tests with 80%+ coverage for changed controls/render helpers **(REQUIRED)**.

## Tests
- Unit tests:
  - [x] Control config includes `Streets (OSM)` with the approved value.
  - [x] No-key renderer options disable or hide Mapbox for new selections while preserving current saved Mapbox value.
  - [x] With a key, renderer options include enabled Mapbox.
  - [x] OSM tile template style resolves before reaching the map component.
  - [x] Saved Mapbox provider with no key returns the existing `MAPBOX_API_KEY` required message.
- Integration tests:
  - [x] `npm run test -- plugin-chart-point-cluster-map` or the targeted Jest equivalent passes for the added tests.
  - [x] Transform/render test covers both `map_renderer="maplibre"` and `map_renderer="mapbox"` branches.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Point-cluster no-key authoring behavior matches deck.gl behavior.
- Point-cluster OSM style renders through MapLibre-compatible style resolution.

## Implementation Evidence

- Commit: local task_03 commit (see final response / `git log`)
- Added `src/utils/mapControls.ts` to keep point-cluster style choices and renderer option props aligned with the shared task_02 map helper primitives.
- Updated `controlPanel.ts` so `map_renderer` uses disabled-with-explanation Mapbox options when no key exists, while preserving saved Mapbox visibility, and `maplibre_style` includes `Streets (OSM)`.
- Updated `MapLibre.tsx` so MapLibre style inputs resolve raw OSM/raster tile templates to attribution-bearing raster style objects before reaching the map component; Mapbox style strings still pass through unchanged.
- Updated `src/utils/mapbox.ts` to reuse the shared bootstrap key parsing helpers.
- Added/expanded point-cluster Jest coverage for OSM style availability, key-aware renderer options, saved Mapbox no-key behavior, OSM style resolution, and transform props for both renderer branches.

## Validation Evidence

| Command | CWD | Result |
| --- | --- | --- |
| `npm run test -- plugin-chart-point-cluster-map` | `superset-frontend` | pass: 4 suites, 65 tests |
| `npx jest --maxWorkers=80% --silent plugins/plugin-chart-point-cluster-map/test/controlPanel.test.ts plugins/plugin-chart-point-cluster-map/test/MapLibre.test.tsx --coverage --collectCoverageFrom=plugins/plugin-chart-point-cluster-map/src/utils/mapControls.ts --collectCoverageFrom=plugins/plugin-chart-point-cluster-map/src/utils/mapbox.ts --collectCoverageFrom=plugins/plugin-chart-point-cluster-map/src/MapLibre.tsx` | `superset-frontend` | pass: 85.36% statements / 85.36% lines overall for collected task_03 control/render helpers |
| `npx tsc --build packages/superset-ui-core/tsconfig.json plugins/plugin-chart-point-cluster-map/tsconfig.json --pretty false` | `superset-frontend` | pass |
| `git diff --check` | worktree root | pass |

Warnings observed during Jest: stale Browserslist data, `babel-plugin-lodash` deprecated `isModuleDeclaration`, Node `[DEP0040] punycode`; no test failures.
