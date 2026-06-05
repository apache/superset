# Preserve OSM / custom map charts after MapLibre migration — Task List

## Tasks

| # | Title | Status | Complexity | Dependencies |
|---|-------|--------|------------|--------------|
| 01 | Correct deck.gl migration classification and migration fixtures | completed | medium | — |
| 02 | Add shared map helpers and deck.gl renderer controls | completed | medium | — |
| 03 | Align point-cluster controls and renderer behavior | completed | medium | task_02 |
| 04 | Propagate GeoJSON and Polygon renderer/style props | completed | medium | task_02 |
| 05 | Document upgrade and support behavior | pending | low | task_01, task_02, task_03 |
| 06 | Re-check D2 release state before PR readiness | pending | low | task_01, task_02, task_03, task_04, task_05 |
