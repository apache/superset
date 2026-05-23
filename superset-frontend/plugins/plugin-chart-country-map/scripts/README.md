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

# Country Map data pipeline

This directory contains the build pipeline that turns upstream Natural Earth data into the GeoJSON files consumed by `@superset-ui/plugin-chart-country-map`.

It replaces the legacy `scripts/Country Map GeoJSON Generator.ipynb` notebook. See `SIP_DRAFT.md` in the parent directory for the full design rationale.

## Layout

```
scripts/
  build.sh                   # one-shot reproducible build
  README.md                  # this file
  config/                    # declarative YAML — handles ~95% of fixes
    name_overrides.yaml      # typos, deprecated ISO codes, admin renames
    flying_islands.yaml      # repositioning + bbox drops for far-flung territories
    territory_assignments.yaml   # add features from sibling Admin 0 records
    regional_aggregations.yaml   # dissolve Admin 1 into administrative regions
    composite_maps.yaml      # multi-country composites (e.g. France-with-Overseas)
  procedural/                # escape hatch — handles the rare 5%
    README.md                # when to use, when not
    NN_<descriptive_name>.py # one focused script per genuine edge case
  output/                    # gitignored — build artifacts
```

## Worldviews

Natural Earth publishes per-country editorial variants of its Admin 0
(countries) layer: `ne_10m_admin_0_countries_<code>.shp`. Each variant
encodes that country's official stance on disputed borders — e.g.
`ne_10m_admin_0_countries_ukr.shp` shows Crimea as Ukrainian; `_chn`
shows Taiwan as part of China; `_iso` uses neutral ISO 3166-1 boundaries.

`build.py` builds Admin 0 for every NE-published worldview listed in
the `WORLDVIEWS_ADMIN_0` constant — outputs are named
`<worldview>_admin0.geo.json`. The plugin's worldview control reads the
list from `manifest.json` and shows whatever the build produced.

NE does **not** publish per-worldview Admin 1 variants — subdivisions
within a country come from a single global file. We build Admin 1 once
(under the `ukr` filename prefix for back-compat) and the frontend
always points Admin 1, regional, and composite URLs at that shared
output regardless of which worldview the user has selected. The
worldview choice only changes the country-borders map (Admin 0).

## Operating principles

- **Default tool: declarative YAML.** Most touchups are renames, repositions, dissolves, or filters — all expressible in YAML. Diffs are small, conflicts localize cleanly to one entry, contributors can submit "fix typo X" as a one-line PR.
- **Escape hatch: `procedural/` directory** of small, named, single-purpose Python scripts for the rare cases YAML can't express cleanly. Each script has a header comment explaining *why* it's not in YAML. See `procedural/README.md` for the bar.
- **Build is reproducible from a pinned NE version.** `build.sh` records the NE git SHA it consumed; outputs are deterministic given inputs.
- **CI regenerates on schema change** and opens a PR if outputs differ. Maintainers review the cartographic diff in legible GeoJSON, not opaque notebook JSON.

## Workflow for adding a fix

1. Identify the upstream NE issue (wrong name, missing territory, etc.).
2. **Try YAML first.** Add the smallest possible entry to the appropriate config file with a `description` field explaining the fix.
3. If YAML can't express it cleanly, add a numbered script in `procedural/` with a header comment explaining why YAML didn't fit.
4. Run `build.sh` locally, verify the output GeoJSON looks right.
5. Open PR. Reviewer sees the YAML diff (or new procedural script) plus the regenerated GeoJSON.

## See also

- `SIP_DRAFT.md` (parent dir) — design rationale, notebook audit, obsolescence check
- `procedural/README.md` — when to use the escape hatch
