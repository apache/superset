---
status: completed
title: Document upgrade and support behavior
type: docs
complexity: low
dependencies:
  - task_01
  - task_02
  - task_03
---

# Task 05: Document upgrade and support behavior

## Overview
Add concise upgrade/support documentation for the migration reclassification, restored OSM choice, no-key Mapbox authoring affordance, and preserved true Mapbox missing-key behavior. This gives release and support teams an explicit reference for expected post-upgrade map chart behavior.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- [R9] Upgrade/support documentation MUST explain non-Mapbox deck.gl reclassification, no-key Mapbox choice visibility, saved true Mapbox behavior, and the restored OSM choice.
- [R9] Documentation MUST avoid promising silent fallback for true Mapbox charts and MUST mention OSM attribution/normal browser tile usage expectations.
</requirements>

## Subtasks
- [x] 5.1 Add a concise `UPDATING.md` entry for the migration and no-key renderer behavior.
- [x] 5.2 Add a release-note/changelog entry only if the repo convention requires it for this change type.
- [x] 5.3 Ensure wording distinguishes non-Mapbox saved chart preservation from true `mapbox://` missing-key behavior.
- [x] 5.4 Include the restored `Streets (OSM)` choice and attribution expectation without adding new CSP claims unless implementation changed CSP.
- [x] 5.5 Cross-check docs against implemented behavior from tasks 01-03 before marking complete.

## Implementation Details
Use TechSpec "OSM Tile, Attribution, and Support Design" and PRD "Core Features F8". Keep the docs short and support-facing; do not broaden scope into general MapLibre documentation or downstream Preset-only behavior.

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
- `UPDATING.md` — Required upgrade/support entry target.
- `CHANGELOG/` — Repo release-note location if maintainers require one for this behavior.
- `superset/config.py` — Historical OSM documentation and existing CSP map tile allowlist context.
- `.agor/compozy/rch-119-preserve-osm-map-charts/techspec.md` — Documentation wording constraints and OSM support design.

### Dependent Files
- `superset/migrations/versions/2026-03-02_00-00_ce6bd21901ab_migrate_deckgl_and_mapbox.py` — Docs must match migration behavior.
- `superset-frontend/plugins/preset-chart-deckgl/src/utilities/Shared_DeckGL.tsx` — Docs must match renderer option behavior.
- `superset-frontend/plugins/plugin-chart-point-cluster-map/src/controlPanel.ts` — Docs must match point-cluster behavior.

### Related ADRs
- [ADR-001: Mapbox classification, OSM restoration, and no-key visibility](adrs/adr-001-mapbox-classification-and-osm-restore.md) — Locks the single-repo compatibility package and no silent fallback policy.
- [ADR-002: Release-safe migration and no-key Mapbox affordance](adrs/adr-002-release-safe-migration-and-no-key-mapbox-affordance.md) — Records the D2 in-place edit decision, PR-readiness re-check, and disabled-with-explanation UX.

## Deliverables
- UPDATING.md entry for migration reclassification and no-key Mapbox authoring behavior.
- Release-note/changelog entry if repo convention requires it, otherwise recorded rationale in task evidence.
- Docs reviewed against implemented behavior with 80%+ coverage target satisfied by linked implementation tests **(REQUIRED)**.

## Tests
- Focused validation command before dispatch:
  - [x] `node -e "const fs=require('fs'); for (const file of ['UPDATING.md']) { const text=fs.readFileSync(file,'utf8'); if (/[^\\S\\r\\n]$/m.test(text)) throw new Error(file+' has trailing whitespace'); if (!text.endsWith('\\n')) throw new Error(file+' missing final newline'); }"`
- Unit tests:
  - [x] No code unit tests required for docs-only edits; rely on markdown/pre-commit checks.
- Integration tests:
  - [x] `pre-commit run prettier` or relevant markdown/documentation hooks pass for touched docs.
  - [x] Implementation tests from dependencies remain passing after docs-only changes.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Docs state non-Mapbox saved charts remain no-key-compatible after migration.
- Docs state true saved Mapbox charts remain Mapbox-backed and may show the missing-key signal without a key.
- Docs mention `Streets (OSM)` and attribution expectations.

## Completion Evidence

- Added a `UPDATING.md` entry under `Next` documenting the deck.gl migration
  reclassification, no-key Mapbox renderer behavior, and saved true Mapbox
  behavior.
- The entry states that saved non-Mapbox deck.gl styles, including
  OpenStreetMap, `tile://` templates, generic HTTPS style URLs, and missing
  styles, remain on the MapLibre-compatible path and do not require
  `MAPBOX_API_KEY` only because of the migration.
- The entry preserves the true `mapbox://` contract: saved Mapbox charts remain
  Mapbox-backed and keep the existing missing-key message when no key is
  configured; no silent fallback is promised.
- The entry mentions restored `Streets (OSM)`, the approved
  `https://tile.openstreetmap.org/{z}/{x}/{y}.png` tile URL, visible
  `© OpenStreetMap contributors` attribution, and normal browser tile
  request/cache expectations. It does not add new CSP claims.
- Release-note/changelog rationale: no separate release-note/changelog file was
  added because the repo's current changelog convention is versioned release
  assembly (`CHANGELOG/<version>.md`) and `UPDATING.md` is the maintained
  upgrade/backwards-compatibility surface for this behavior.
- Cross-check against implemented behavior: task_01 migration code classifies
  only `mapbox://` styles as Mapbox; task_02 and task_03 helpers/controls expose
  `Streets (OSM)`, disable Mapbox without a key while preserving saved state,
  and keep true Mapbox no-key error rendering.
- Coverage target evidence is inherited from dependency implementation tests:
  task_02 recorded 96.38% statements / 96.2% lines for collected map helper and
  deck.gl paths, and task_03 recorded 85.36% statements / 85.36% lines for
  collected point-cluster control/render helpers. This task is docs-only and did
  not add executable code.

### Validation Results

- `node -e "const fs=require('fs'); for (const file of ['UPDATING.md']) { const text=fs.readFileSync(file,'utf8'); if (/[^\\S\\r\\n]$/m.test(text)) throw new Error(file+' has trailing whitespace'); if (!text.endsWith('\\n')) throw new Error(file+' missing final newline'); }"` — passed.
- `pre-commit run end-of-file-fixer --files UPDATING.md` — passed.
- `pre-commit run trailing-whitespace --files UPDATING.md` — passed.
- `pre-commit run prettier-frontend --files UPDATING.md` — skipped (`no files to check`), confirming the frontend prettier hook does not target root `UPDATING.md`.
- `git diff --check` — passed.
- `pre-commit run end-of-file-fixer --files UPDATING.md .compozy/tasks/preserve-osm-custom-map-charts/task_05.md .compozy/tasks/preserve-osm-custom-map-charts/_tasks.md` — passed.
- `pre-commit run trailing-whitespace --files UPDATING.md .compozy/tasks/preserve-osm-custom-map-charts/task_05.md .compozy/tasks/preserve-osm-custom-map-charts/_tasks.md` — passed.
- `pre-commit run` — passed for the staged task_05 docs/status files.
- Runtime/environment evidence: `preset-dev:status` subset found no current-head PR and branch `rch-119-preserve-osm-map-charts`; `agor env health 019e92dd-aab8-70ce-bf70-c14df346847e --json` reported the environment stopped, which is acceptable for this docs-only task.

### Scope Boundary

No task_06, QA, Review, Memory, PR, provider, tracker, or board movement was performed.
