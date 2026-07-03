<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# UPDATES: staged entries for UPDATING.md

> **Working tracker for the `remove-legacy-viz-pipeline` feature branch.**
> Each bullet below is drafted in UPDATING.md's voice and will be moved into
> `UPDATING.md` under "Next" before the feature branch merges. This file is
> then deleted.

## Breaking changes (drafts)

- [ ] The deprecated `/superset/explore_json/` endpoints (deprecated since 3.0,
      EOL 5.0.0) have been removed. All charts now use `/api/v1/chart/data`.
- [ ] `superset/viz.py` has been removed. Anything importing `superset.viz`
      (custom code, plugins) must migrate to the QueryContext /
      `pandas_postprocessing` pipeline.
- [ ] The `useLegacyApi` field of `ChartMetadata` in `@superset-ui/core` has been
      removed. Third-party viz plugins that set it must provide a `buildQuery`
      and use the v1 chart data API.
- [ ] Legacy plugin packages have been renamed to drop the `legacy-` prefix
      (e.g. `@superset-ui/legacy-plugin-chart-chord` → `@superset-ui/plugin-chart-chord`).
      (enumerate final list here)
- [ ] "Bubble Chart (legacy)" (`bubble`) charts are automatically migrated to the
      ECharts Bubble Chart (`bubble_v2`).
- [ ] "Time-series Percent Change" (`compare`) charts are automatically migrated to
      the ECharts Line Chart. The interactive re-basing of the nvd3 renderer is not
      preserved.

## Non-breaking notes (drafts)

(add as they come up — e.g. behavior nuances found while porting get_data reshapes)
