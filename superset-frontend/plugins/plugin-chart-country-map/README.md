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

# `@superset-ui/plugin-chart-country-map`

> Modern country/region choropleth chart for Apache Superset. Replaces `legacy-plugin-chart-country-map`.

## Status

🚧 **Work in progress** — see `SIP_DRAFT.md` in this directory for the full design rationale and implementation phases. This plugin lives in the same PR as the build pipeline that produces its data; both are currently scaffolded and being progressively fleshed out.

## What it offers vs. the legacy plugin

| | Legacy | New |
|---|---|---|
| Backend endpoint | `explore_json` | `chart/data` (modern) |
| Disputed-region handling | Hardcoded NE editorial | Configurable per-deployment + per-chart worldview (NE `_ukr` default) |
| Subdivisions level | Country-only | Country (Admin 0) **and** Subdivisions (Admin 1) **and** Aggregated regions |
| Data pipeline | Jupyter notebook | Reproducible script + YAML configs (see `scripts/`) |
| Per-deployment customization | Fork required | `superset_config.COUNTRY_MAP` block + chart-level controls |
| Composite maps (e.g. France-with-Overseas) | Hardcoded in notebook | Declarative in `composite_maps.yaml` |
| Regional aggregations (NUTS-1 etc.) | Hardcoded | Declarative in `regional_aggregations.yaml` |

## Layout

```
src/
  index.ts          — package entry; exports CountryMapChartPlugin and types
  types.ts          — TypeScript types for form data + transform props
  CountryMap.tsx    — React component; renders the SVG chart
  plugin/
    index.ts        — ChartPlugin class with metadata
    buildQuery.ts   — modern chart/data query builder
    controlPanel.tsx— form controls (worldview, admin level, country, ...)
    transformProps.ts — form_data → renderer props
scripts/            — build pipeline (NE shapefile → simplified GeoJSON outputs)
SIP_DRAFT.md        — design draft for the eventual SIP issue
```

## See also

- `SIP_DRAFT.md` — design rationale, audit of legacy notebook, obsolescence findings, open questions
- `scripts/README.md` — build pipeline operating principles
- `scripts/config/*.yaml` — declarative transform configs (5 schemas for the 5 transform categories)
- `scripts/procedural/README.md` — escape hatch for edge cases YAML can't express
