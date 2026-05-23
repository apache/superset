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

# SIP Draft: Modernize the Country Map plugin

> **Status:** Draft / scratch — this file is a working reference for the eventual SIP. It will be filed as a GitHub issue when the POC is mature, then deleted from the tree.

> **Author:** @rusackas (with @anthropic Claude Code assistance)

> **Target release:** TBD (likely first appears as opt-in in Superset N, becomes default in N+1, legacy removed in N+2)

---

## Motivation

The current country-map plugin (`legacy-plugin-chart-country-map`) accumulates pain across three axes that we keep trying to solve technically when the underlying problem is editorial:

1. **Disputed borders are a recurring flashpoint.** Crimea/Sevastopol, Kashmir, Western Sahara, Kosovo, Palestine, Cyprus, Aksai Chin — every few months a contributor opens a PR claiming the map is "wrong". Most recently #35613 tried to redraw Russia's borders and was rejected because the project doesn't have a stated policy beyond "follow upstream Natural Earth". We have no mechanism for users who *do* want a specific cartographic perspective.

2. **The Jupyter notebook is the source of truth and it's killing us.** The notebook ingests Natural Earth, applies hand-rolled fixes (rename pins, flying-island moves, geometry touchups), and emits the per-country `.geojson` files we ship. It is:
   - opaque to git diff (the `.ipynb` JSON dump is unreadable in PRs)
   - fragile under conflict (cell ordering, kernel state, output churn)
   - bloated (years of one-off touchups, hard to audit)
   - undiscoverable (most contributors don't know it exists)

3. **The plugin is "legacy" for real reasons.** It still uses the `explore_json` endpoint instead of the modern `chart/data` endpoint. That means: no async, no chunking, no semantic-layer integration, bypasses modern caching, and registers as a `LegacyChartPlugin` rather than a modern `ChartPlugin`. We've been carrying the "legacy" prefix forever; this is the right moment to fix it.

Beyond those three, two related desires keep coming up:

- **Per-country subdivisions (Admin 1)** — French departments, Italian regions, US states, Türkiye city map (#32497), and others have all been submitted as bespoke per-country files over time. They're conceptually identical and should share infrastructure.
- **Per-deployment customization** — language overrides, name pins, region include/exclude. Currently impossible without forking.

## Goals

- New plugin (`plugin-chart-country-map`, no `legacy-` prefix) built against `chart/data` endpoint.
- Configurable **worldview** (default + per-deployment override + per-chart override) using Natural Earth's pre-baked worldview shapefiles.
- Support both **Admin 0 (countries)** and **Admin 1 (subdivisions)** in a single plugin — fold in the per-country submissions that have been accumulating.
- Per-chart **region include/exclude** controls, with **fit-to-selection** projection auto-zoom.
- **Flying islands** toggle (default on, with composite projections where available; off drops them entirely).
- **Replace the Jupyter notebook** with a script-based, reproducible build pipeline using `mapshaper` CLI.
- **Deprecate the legacy plugin** with an in-UI "switch to new chart" affordance plus a deprecation banner consistent with the project's existing pattern.
- Apache neutrality preserved by being explicit about default editorial choices and making them one-line-overrideable.

## Non-goals

- World map plugin (bubble/proportional symbol overlays). Out of scope for this SIP — separate concern, future fold-in.
- Custom GeoJSON upload as a first-class control. Useful but separate feature.
- Combining geometries at runtime ("show India and Pakistan as one merged blob"). Out of scope; users wanting this should upload custom GeoJSON.
- Admin 2 (counties, communes, etc.). Could come later; not in initial scope.

## Proposed design

### Data source

- **Natural Earth Vector** (https://github.com/nvkelso/natural-earth-vector), pinned to a specific release tag. Same source we use today.
- Use NE's pre-baked **worldview shapefiles**: `ne_10m_admin_0_countries_<XXX>.shp` for each supported worldview, plus the equivalent Admin 1 files where available.
- Available worldviews as of NE 5.x: `arg, bdg, bra, chn, deu, egy, esp, fra, gbr, grc, idn, ind, isr, ita, jpn, kor, mar, nep, nld, pak, pol, prt, pse, rus, sau, swe, tur, twn, ukr, usa, vnm` (plus default and a few others). 31 worldviews × 2 admin levels = ~62 GeoJSON files shipped at default simplification.

### Default worldview

**Recommendation: ship NE `_ukr` (Ukraine) worldview as Superset's default.** Documented as an explicit editorial choice, overridable via `superset_config.py`.

Rationale: spike (below) shows UA worldview cleanly delivers Crimea-as-Ukrainian, plus several other commonly-expected positions (Kosovo separate from Serbia, Western Sahara separate from Morocco, Palestine recognized, Cyprus undivided, Kashmir aligned with India). Default ("ungrouped" NE editorial) is more equivocal on these, which is closer to the current shipped behavior but doesn't match the stated preference for Crimea-as-Ukrainian.

Apache neutrality preserved by:
- Documenting the choice transparently in plugin README and Superset docs
- One-line override in `superset_config.py` to switch to any other NE worldview
- Per-chart override via control panel

### Build pipeline

Replace the notebook with `scripts/country-maps/`:

```
scripts/country-maps/
  build.sh                 # one-shot reproducible
  README.md                # how to regenerate, when, and why
  config/
    name_overrides.yaml    # ISO code → display name pinning
    flying_islands.yaml    # well-known multi-polygon parts to drop or inset
  output/                  # gitignored; CI artifacts go here
```

`build.sh` does:

1. Download pinned NE shapefiles (default + each shipped worldview) to a cache dir.
2. For each (worldview × admin_level) combination, run `mapshaper`:
   - Filter / select features
   - Apply `name_overrides.yaml` renames
   - Apply `flying_islands.yaml` part filtering
   - Simplify with topology preservation (`-simplify percentage=5% keep-shapes`)
   - Output as `<worldview>_admin<level>.geo.json` to `superset-frontend/plugins/plugin-chart-country-map/src/data/`.
3. Validate: schema check, ISO code coverage, no degenerate geometries.

CI runs this script in a workflow that opens a PR if outputs change. Maintainers review the cartographic diff in the PR (which is now legible because we're diffing GeoJSON, not a notebook).

### Plugin architecture

**Name:** `@superset-ui/plugin-chart-country-map` (no `legacy-` prefix).

**Endpoint:** modern `chart/data`, registered as a `ChartPlugin`.

**Controls:**

| Control | Type | Notes |
|---------|------|-------|
| `admin_level` | Select | `0 (countries)` or `1 (subdivisions)` |
| `country` | Select | Required when `admin_level == 1`; lists countries with available subdivisions |
| `worldview` | Select | Defaults from `superset_config.COUNTRY_MAP.default_worldview` |
| `region_includes` | MultiSelect | Optional whitelist by ISO code |
| `region_excludes` | MultiSelect | Optional blacklist by ISO code |
| `show_flying_islands` | Boolean | Default true |
| `name_language` | Select | NE's `NAME_<LANG>` field (en/fr/de/es/ar/zh/ja/ru/...) |
| ... existing color/data controls | | (preserved from legacy plugin) |

**Render flow:**

```
Load: GeoJSON for (worldview, admin_level, country?) — cached, immutable
Render:
  features = data.features
    .filter(by region_includes / region_excludes)
    .filter(by show_flying_islands → drop tagged parts)
    .map(applying name_overrides from form_data)
  projection.fitSize(viewport, featureCollection(features))   // fit-to-selection
  render paths
```

The heavy preprocessing (worldview, simplification, default islands, default name overrides) is baked at build time. Per-chart controls (include/exclude, fly islands, language, name overrides) operate client-side on the loaded GeoJSON. No server-side per-request GeoJSON regeneration.

### Configuration

```python
# superset_config.py
COUNTRY_MAP = {
    "default_worldview": "ukr",          # NE worldview code
    "default_name_language": "en",       # NAME_EN field
    "name_overrides": {                  # one-off touchups
        # "BIH": "Bosnia",
    },
    "region_excludes": [],               # ISO_A3 codes excluded globally
}
```

Static config only — no env var. This is a cartographic editorial decision, not a per-request flag.

### Hosting / asset path

Build outputs ship into Superset's Flask static directory at `superset/static/assets/country-maps/`, served at `/static/assets/country-maps/<file>`. No webpack involvement needed — Flask serves them directly.

The build script (`scripts/build.py`) writes there directly. Files are committed to the repo so a fresh ephemeral env can render the chart immediately without running the build first. Trade-off: ~17 MB of generated files in the tree (offset by removing the legacy plugin's ~34 MB of committed GeoJSON, net -17 MB).

Future optimizations if maintenance burden grows: gitignore + postinstall hook, CDN-hosted assets, or server-side lazy generation per request.

### Deprecation of legacy plugin

Three-phase, modeled on existing deprecated-chart patterns:

- **Phase 1 (release N):** legacy plugin gets a deprecation banner in the chart UI ("This chart type is deprecated. Switch to the new Country Map."). No separate "Switch to new Country Map" button is needed — Superset already supports cross-viz form_data hand-off when a user picks a different viz type, and we wired up `formDataOverrides` in the new plugin's controlPanel so the legacy `select_country` value auto-translates into the new admin_level + country + composite/region_set quartet. Users get one-click migration just by picking the new viz type from the chart-type chooser.
- **Phase 2 (release N+1):** ship a metadata-DB migration that bulk-rewrites every `viz_type='country_map'` row in `slices.params` using the same `migrateFromLegacy` mapping, so dashboards and saved charts pick up the new plugin without anyone clicking through. Migration is idempotent and runs offline.
- **Phase 3 (release N+2, ideally a major):** legacy plugin removed from default install, banner becomes a hard error for any unmigrated chart (rare — the Phase 2 migration should have caught them).

Phase 1 needs no DB migration. Phase 2 is a single one-shot migration with a downgrade that restores `viz_type='country_map'` and strips the new fields (loses worldview/composite picks but preserves country selection). Phase 3 is plugin-removal only.

## Spike findings: UA worldview vs Default

Ran `mapshaper` against pinned NE master snapshots of `ne_10m_admin_0_countries.shp` (Default) and `ne_10m_admin_0_countries_ukr.shp` (UA worldview). Source: https://github.com/nvkelso/natural-earth-vector.

### Feature counts

- Default: **258 features**
- UA: **249 features**

UA worldview drops 9 features that Default acknowledges as standalone disputed entities, consolidating them into their parent claimant: `BJN` (Bajo Nuevo Bank), `CNM` (Cyprus No Man's Land), `CYN` (Northern Cyprus), `KAB` (Baikonur), `KAS` (Siachen), `KOS` (Kosovo — wait, *kept* in UA but with different geometry; needs re-check), `SER` (Serranilla Bank), `SOL` (Somaliland), `SPI` (Spratly Islands).

These are micro-territories that don't materially affect a country-level choropleth. Worth documenting.

### Countries with geometry differences

18 shared features have different geometries between Default and UA. The cartographically meaningful ones:

| ISO | Country | What changes (UA vs Default) |
|-----|---------|------------------------------|
| **RUS** | Russia | Loses 1 polygon part (Crimea); area_proxy 5835 → 5828 |
| **UKR** | Ukraine | Gains Crimean peninsula; bbox lat 45.21°N → 44.38°N; area_proxy 129 → 144 |
| **SRB** | Serbia | Smaller (Kosovo treated as separate country) |
| **MAR** | Morocco | **Much** smaller (Western Sahara excluded); area_proxy 232 → 100 |
| **CYP** | Cyprus | Shown undivided (no separate Northern Cyprus); 4 parts → 3 parts |
| **ISR** | Israel | Smaller (Palestinian territories excluded); PSE feature recognized |
| **CHN** | China | Loses Aksai Chin (disputed border with India) |
| **IND** | India | Northern Kashmir included; bbox lat 35.5°N → 35.65°N |
| **KOR** | South Korea | Minor — possibly Liancourt Rocks / East Sea boundary |
| **COL, BRA, JOR, KAZ, LBN, GRL, SAH, SDN, SOM** | various | Same bbox, geometry slightly changed (probably small border refinements; need cartographic eyeball) |

### Conclusion

**UA worldview is a clean default.** It gives the user-requested Crimea-as-Ukrainian *and* aligns with broadly-expected positions on Kosovo, Western Sahara, Palestine, Cyprus, Kashmir, and Aksai Chin. It's a reasonable Superset editorial choice that we can defend on multiple cartographic axes (not just one).

The 9 dropped micro-territories are a non-issue for choropleth visualization.

## Notebook audit: existing touchups and how the new design covers them

Audit of `superset-frontend/plugins/legacy-plugin-chart-country-map/scripts/Country Map GeoJSON Generator.ipynb` (96 cells). Categorized below to confirm the new design has a home for each kind of work the notebook does.

Status legend:
- ✅ **Covered** — handled cleanly by the new design as currently sketched
- 🟡 **Needs config** — handled, but requires entries in YAML config files that we'll need to port
- 🟠 **Needs new feature** — design needs an addition before this works
- ⚪ **Can become obsolete** — current NE may have fixed the underlying problem; verify per case

### Category 1 — Data ingestion and scale blending ✅

Notebook downloads NE Admin 0 + Admin 1 at 10m and 50m, blends them (uses 50m for some large countries to cap file size). New `build.sh` does the same; mapshaper handles per-country `-simplify` more cleanly than the notebook's hand-tuned switch.

### Category 2 — Country list curation 🟡 → ✅

Cell 12 hand-curates ~190 countries with an alias dict (`korea`→`south korea`, etc.) and inline comments documenting why some entries are commented out (territories that NE rolls into a parent country). New design generates this list deterministically from NE's ISO_A3 codes; aliases handled by the `name_language` field. Auto-purge of single-subdivision countries (cell 89) becomes a build-script default.

### Category 3 — Flying islands repositioning 🟡 (config-driven)

The biggest category. Each `reposition()` call translates and scales a far-flung territory to fit within or near the mainland viewport. Maps to `flying_islands.yaml` entries (one per country/territory):

| Country | Territories repositioned | Cell |
|---------|--------------------------|------|
| **USA** | Hawaii, Alaska | 19 |
| **Norway** | Svalbard | 34 |
| **Portugal** | Azores, Madeira (with extra `simplify=0.015`) | 37 |
| **Spain** | Las Palmas, Santa Cruz de Tenerife (Canary Islands) | 40 |
| **France** | Guadeloupe, Martinique, Guyane française, La Réunion, Mayotte | 56 |

Each entry encodes `(territory_id, x_offset, y_offset, x_scale, y_scale, simplify?)`. Build script applies them.

D3 composite projections (e.g. `geoAlbersUsa`, `geoConicEqualAreaFrance`) handle some of these natively at *render* time without geometry mutation — worth offering as an alternative path per-country where available.

### Category 4 — Antimeridian fix 🟡 → ✅

Cell 44's `shift_geom` splits Russia's Chukchi Autonomous Okrug at the 180° meridian and translates the eastern part by +360° so it renders contiguously. **Mapshaper has `-clip` and `-affine` operators that do this cleanly.** Single use case currently (Russia/Chukchi); if more crop up, generalize.

### Category 5 — Bounds clipping 🟡 (config-driven)

Cells 69-71, 76: `apply_bounds(df, NW, SE)` filters out features whose geometries don't fit a bbox. Used for:

| Country | Bounding box | Purpose | Cell |
|---------|--------------|---------|------|
| **Netherlands** | NW=(-20, 60), SE=(20, 20) | Drop Caribbean territories (Bonaire, Sint Eustatius, Saba, ABC islands) | 71 |
| **UK** | NW=(-10, 60), SE=(20, 20) | Drop British Overseas Territories | 76 |

These overlap conceptually with flying islands. Decision: same `flying_islands.yaml` config, with two action modes — `drop` (current bounds-clip behavior) or `reposition` (current reposition behavior). Tied to the per-chart "Show flying islands" toggle.

### Category 6 — Adding territories to a country 🟠 (needs new feature)

The notebook has cases where it *adds* features to a country that NE has as a separate Admin 0 entity:

| Country | Added territories | Cell |
|---------|-------------------|------|
| **China** | Taiwan (CN-71), Hong Kong (CN-91), Macau (CN-92) — with Chinese names | 21-22 |
| **Finland** | Åland (FI-01) — with Finnish name | 25-26 |
| **Ukraine** | Crimea (UA-43), Sevastopol (UA-40) — moved from Russia | 28 |

**The Ukraine case is now handled by worldview selection (NE `_ukr` does this for free).**

The China and Finland cases are *editorial decisions*, not worldview decisions — NE genuinely has Taiwan as separate Admin 0, Åland as separate Admin 0, etc. We need a `territory_assignments.yaml` config that says "for the China Admin 1 view, also include features X, Y, Z from these other Admin 0 records, with these renamed iso codes". This is a real new feature in the build pipeline. Not hard to implement.

### Category 7 — Reassigning territories ✅ (covered by worldview)

The Crimea/Sevastopol move from Russia to Ukraine (cell 28) is exactly what UA worldview gives us for free. Confirmed by spike. **No config or code needed for this case in the new design.** Other reassignments (if they emerge) would also be candidates for worldview switches first, `territory_assignments.yaml` second.

### Category 8 — External GeoJSON replacement 🟠 (needs new feature, or work to obsolete)

The notebook fully bypasses NE for three countries by downloading third-party GeoJSON files:

| Country | Source | Why | Cell |
|---------|--------|-----|------|
| **India** | `geohacker/india` (Kashmir + Ladakh state shapes) | NE's India subdivisions deemed inadequate for J&K/Ladakh | 30 |
| **Latvia** | `eriks47/latvia` | NE's Latvia subdivisions deemed inadequate | 73 |
| **Philippines** | `jdruii/phgeojson` | NE's Philippines subdivisions deemed inadequate | 78 |

This is the gnarliest category. Two paths:

1. **Vendor the third-party GeoJSON in-tree** under `scripts/country-maps/external/` and have the build script merge them with the NE outputs. Config entry per country specifies the source file + which NE features it replaces.
2. **Verify that current NE 5.x has improved** for these countries — possibly some of these hacks are obsolete. If so, drop the override, accept what NE ships.

Action: per-country verification spike before the SIP locks in. If even one needs to stay, we ship path 1 as a first-class config layer (`external_overrides.yaml`).

### Category 9 — Name fixes (typos, encoding, native names) 🟡 (config-driven)

Three sub-cases:

- **Typo fixes**: France (Seien→Seine, Haute→Haut), iso_3166_2 corrections (FR-75→FR-75C, FR-GP→FR-971, etc.) — cell 55
- **Native script / diacritics**: Vietnam (~12 city names with Vietnamese diacritics) — cell 86; China SAR Chinese names; Finland Åland Finnish name
- **Administrative renames**: Philippines (Dinagat→Caraga, ARMM→BARMM) — cell 83

All map to entries in `name_overrides.yaml` keyed by ISO code. The native script cases might also be obsoleted by exposing NE's `NAME_<lang>` fields directly via the `name_language` selector — verify per case.

### Category 10 — Region aggregation (Admin 1 → administrative regions) 🟠 (needs new feature)

Notebook builds *intermediate* admin levels by dissolving Admin 1 into administrative regions:

| Country | Aggregation | Source |
|---------|-------------|--------|
| **Turkey** | NUTS-1 (12 statistical regions) — manually-coded city→region dict | Cell 48 |
| **France** | Administrative regions (dissolved from departments) | Cell 58-59 |
| **Italy** | Regions (dissolved from provinces) | Cell 66 |
| **Philippines** | Regions (dissolved from provinces) | Cell 81-82 |

Currently each is its own special case. Generalize via a `regional_aggregations.yaml` config: per (country, region_set_name), specify the mapping (Admin 1 ISO → region code + region name). Build script dissolves accordingly. New plugin exposes this as a third "admin level" option (`Admin 0 / Admin 1 / Aggregated regions`) when one is defined for the selected country.

This is a real feature, not just config porting. Worth calling out in the SIP as in-scope-but-distinct.

### Category 11 — Composite multi-country maps 🟠 (needs new feature, or punt)

Cell 63 ("France with Overseas") assembles a single map combining features from multiple Admin 0 entities (France + French Polynesia + French Southern Lands + Wallis-Futuna + New Caledonia + Saint-Pierre), each repositioned + dissolved. This is unique to the notebook.

Three paths:

1. **First-class composite-map support**: define `composite_maps.yaml` with rules for which Admin 0 records contribute to a composite, plus per-territory reposition rules. Build script generates a single composite GeoJSON.
2. **Punt to "France" + "France with Overseas" as two distinct map options**, where the second is hand-curated upstream of the build pipeline. Smaller scope but loses the elegance.
3. **Drop France-with-Overseas entirely** in the new plugin and let users use the regular France map; document the loss in UPDATING.md.

I'd argue **path 1** is small enough to fit the SIP scope and the cleanest answer. Builds reuse the same flying-islands + territory-assignment primitives. Path 3 would lose a feature people use.

### Category 12 — Geometry simplification ✅

Cell 90: hand-tuned `simplify_factors` per country, plus a size-based default. Mapshaper does this better with `-simplify` per layer. Build script per-country override config if needed.

### Category 13 — Output formatting ✅

Cell 90/94: writes per-country GeoJSON files plus a TypeScript `countries.ts` index with display-name overrides. New plugin generates the index from a known list of (worldview × admin level × country) tuples; display-name overrides become entries in `name_overrides.yaml`.

Backward-compatibility column rename (`iso_3166_2` → `ISO`, `name` → `NAME_1`) at the legacy plugin's data layer is a thing the new plugin doesn't need to inherit (we control both producer and consumer).

### Category 14 — Quality filtering ✅

Cell 89: auto-purge countries with only one subdivision. Becomes a build-script default. Already noted under Category 2.

### Summary of what the new design needs to add

To be a strict superset of the notebook's capabilities, the new design needs these config files / pipeline features beyond what's already sketched:

1. **`name_overrides.yaml`** ✅ (already in plan) — covers categories 2, 9, 13
2. **`flying_islands.yaml`** ✅ (already in plan, but extend with `drop|reposition` action modes) — covers categories 3, 5
3. **`territory_assignments.yaml`** 🟠 (NEW) — for adding features from other Admin 0 records (China + SARs, Finland + Åland) — covers category 6
4. **`regional_aggregations.yaml`** 🟠 (NEW) — for Admin 1 → administrative-region dissolves (Turkey NUTS-1, France/Italy/Philippines regions) — covers category 10
5. **`composite_maps.yaml`** 🟠 (NEW) — for France-with-overseas-style multi-country composites — covers category 11
6. **`external_overrides.yaml`** 🟠 (very likely NOT needed) — see obsolescence check below; likely obviated by worldview selection + regional_aggregations
7. **Antimeridian handling** ✅ (mapshaper primitives, possibly already obsolete)

The four `🟠 NEW` items are the design surface this audit added beyond what we'd already discussed. None of them are large; each is a config-driven build-script transform.

## Obsolescence check: which notebook fixes are still needed against current NE 5.x?

Ran a per-fix check against `ne_10m_admin_1_states_provinces.shp` (current). Findings:

| Notebook fix | Status in NE 5.x | Action |
|---|---|---|
| **France typos** (Seine, Haut-Rhin) | NE still ships "Seien-et-Marne" and "Haute-Rhin" | **KEEP** → `name_overrides.yaml` |
| **France ISO 3166-2 codes** (FR-75→75C, FR-GP→971, etc.) | NE still uses old codes (6 features affected) | **KEEP** → `name_overrides.yaml` (or new `iso_overrides.yaml`) |
| **Vietnam diacritics** (~12 manual rewrites) | NE's `.name` field still has unaccented values, BUT `.name_vi` field is correct ("Đồng Tháp", "Sơn La", etc.) | **OBSOLETE** → use `name_language=vi` instead of manual rewrites |
| **Philippines admin renames** (Dinagat→Caraga, ARMM→BARMM) | NE still has the old names (5+6 affected features) | **KEEP** → `name_overrides.yaml` |
| **Crimea/Sevastopol** (move from RUS to UKR) | Handled cleanly by NE `_ukr` worldview | **OBSOLETE** → falls out of worldview selection |
| **India Kashmir/Ladakh geometry** (third-party replacement) | NE has both as Union Territories with correct ISO codes (IN-JK, IN-LA); notebook only replaces geometry. UA worldview already adjusts northern boundary | **LIKELY OBSOLETE** → verify geometry match against current Indian boundary claims; if NE Default/_ind/_ukr is acceptable, drop the override |
| **Russia Chukchi antimeridian fix** | NE's Chukchi already has x range `[-180, 180]` — geometry has been split into multiple polygons that wrap correctly | **LIKELY OBSOLETE** → verify with actual D3 rendering; modern projections handle this |
| **China + SARs** (add Taiwan/HK/Macau to CN admin1) | NE keeps Taiwan (TWN), Hong Kong (HKG), Macau (MAC) as separate Admin 0 records — not in CN admin1 | **KEEP** → `territory_assignments.yaml` |
| **Finland + Åland** (add Åland to FIN admin1) | NE FIN admin1 has 18 features, missing Åland; ALA also absent from admin1 dataset | **KEEP** → `territory_assignments.yaml` (pull Åland from admin0) |
| **Latvia third-party replacement** | NE has 119 admin1 features (110 Novads municipalities + 9 cities) — modern, fine-grained | **OBSOLETE** → use NE directly. Notebook's third-party file probably matches an older 5-region model; if that's wanted, expose it via `regional_aggregations.yaml` (5 historical regions dissolved from 119 municipalities) |
| **Philippines third-party replacement** | NE has 118 admin1 features (80 provinces + 32 highly-urbanized cities + 6 others) | **OBSOLETE** → use NE directly. If users want the 17-region view, expose via `regional_aggregations.yaml` |
| **France/Italy/Turkey/PHL regional dissolves** | Pure aggregation — NE admin1 data is fine | **KEEP** → `regional_aggregations.yaml` |
| **France-with-Overseas composite** | No upstream support; NE has the territories spread across 6 separate Admin 0 records | **KEEP** → `composite_maps.yaml` |
| **Flying-island repositions** (USA, Norway, Portugal, Spain, France DOM) | Cartographic editorial choices — NE doesn't and shouldn't make these | **KEEP** → `flying_islands.yaml` |
| **Single-subdivision country auto-purge** | n/a, build-script default | **KEEP** → build script default |
| **TypeScript countries.ts generator** | n/a, output | **KEEP** → simpler version generated from build-script manifest |

### Headline wins from the obsolescence check

- **`external_overrides.yaml` is probably NOT needed.** All three third-party-GeoJSON cases (India, Latvia, Philippines) are obviated either by worldview selection (India) or by NE having matured fine-grained admin1 data (Latvia, Philippines). The "older / coarser" subdivisions some users want become use cases for `regional_aggregations.yaml` instead.
- **Vietnam manual rewrites disappear** when we expose NE's `NAME_<lang>` fields via the `name_language` selector. Twelve config entries collapse to zero.
- **Crimea/Sevastopol** confirmed obsolete via `_ukr` worldview (already validated in main spike).
- **Russia Chukchi antimeridian fix is likely obsolete.** NE has split Chukchi into properly-bounded polygons. We need to verify the new plugin's D3 projection handles them correctly at render time, but the data is in good shape.
- **Net design surface shrinks:** the 6 NEW config files I sketched in the audit collapse to **4 NEW** (`territory_assignments`, `regional_aggregations`, `composite_maps`, plus the existing `name_overrides`/`flying_islands`/`iso_overrides`). One less config file, one less ongoing maintenance burden, no third-party data dependencies in-tree.

### Procedural escape hatch for edge cases

Most touchups fit cleanly in declarative YAML (typos, ISO codes, repositions, dissolves, composites). A few don't — e.g., the France-with-Overseas notebook drops the *second sub-polygon* of the Windward Islands feature by array index to avoid visual conflict with Corsica. Forcing every such case into the YAML schema would bloat it.

**Solution: small `procedural/` directory of named, single-purpose Python scripts** as an escape hatch, run by the build orchestrator after the YAML transforms.

```
scripts/country-maps/
  build.sh                                # orchestrator
  config/                                 # declarative — handles 95%
    name_overrides.yaml
    flying_islands.yaml
    territory_assignments.yaml
    regional_aggregations.yaml
    composite_maps.yaml
  procedural/                             # escape hatch — handles the rare 5%
    README.md                             # when to use, when not
    01_fix_windward_islands_geometry.py
    # ... future numbered one-offs
```

Each procedural script is:
- Single-purpose, named after what it does
- Has a header comment explaining *why* this couldn't be expressed in YAML
- Takes a geo input path, mutates, writes — clear in/out interface
- Numbered prefix for deterministic execution order
- Easily reviewable in PR (one fix per file, no kernel state, no cell ordering)

Why this is much better than the notebook:
- Each fix is a separate file → conflicts localize to one fix at a time
- No kernel state, no output churn, pure functions on data
- Naming forces documentation; reviewers can see what's added/removed at a glance
- Bounded growth: a `procedural/` directory with 50 files is annoying enough to be a signal to push fixes back into YAML or upstream into NE. The notebook never had this signal — it just bloated.

### What still requires manual attention going forward

The fixes that survive (France typos/ISO codes, Philippines admin renames, China+SARs, Finland+Åland, regional aggregations, composite maps, flying islands) are all relatively **stable** — they don't change year over year. Once ported to YAML, the maintenance cost is roughly: "watch for new disputed-region PRs (handle via worldview switch) + occasional admin-name updates (one-line YAML edit)". Way better than the notebook treadmill.

## Open questions

1. **Default worldview confirmation.** Recommendation is `ukr`. Acceptable to ship that wholesale, or do we want a more granular `default_overrides` overlay model (NE Default + selectively swap Crimea geometry from `_ukr`)? The latter is more code but more editorially neutral on the non-Crimea pieces. — **resolved: ship `ukr` wholesale**
2. **External GeoJSON overrides (notebook category 8).** India, Latvia, Philippines currently replace NE entirely with third-party GeoJSON. — **resolved: obsolescence check shows none of the three need to stay.** Latvia/Philippines have fine-grained NE admin1 data; India's J&K is handled by worldview selection (verify per region under `_ukr`). **`external_overrides.yaml` is dropped from the design.**
3. **Composite maps (notebook category 11).** France-with-Overseas combines features from 6 different Admin 0 records. Three options: build first-class `composite_maps.yaml` support, ship hand-curated alternatives, or drop the feature entirely. **Lean: first-class config support.**
4. **Regional aggregations (notebook category 10).** Turkey NUTS-1, France/Italy/Philippines regions need a `regional_aggregations.yaml` and a third "admin level" UX option (`Admin 0 / Admin 1 / Aggregated regions`). Confirm scope.
5. **Admin 1 country coverage.** NE Admin 1 covers ~all countries but quality varies. Decide which countries are first-class supported (probably a curated list initially, opening up as we validate).
6. **Plugin scaffolding pattern.** Match modern plugin pattern (mirror `plugin-chart-pivot-table` or similar)? Or modify in-flight as we go.
7. **Smoke-test fixtures.** Five test cases that exercise the design end-to-end:
   - World choropleth (Admin 0, default worldview, no filters)
   - US states (Admin 1, country=USA, flying islands ON via Albers composite — Hawaii/Alaska repositioned)
   - US states (Admin 1, country=USA, flying islands OFF — Hawaii/Alaska dropped, viewport fits to mainland)
   - French departments (Admin 1, country=FRA, with the France-with-Overseas composite)
   - Turkey aggregated regions (Admin 1 → NUTS-1, country=TUR)
8. **TLC code.** New file `ne_10m_admin_0_countries_tlc.shp` — what worldview is this? Need to identify before deciding whether to ship it.
9. **Verify which notebook fixes are obsolete in current NE.** For each notebook touchup (typos, encoding, geometry replacements), check whether NE 5.x has it correct. Reduces config-file size; smaller surface to maintain.

## Implementation plan (rough)

### Phase 1: Data pipeline + spike validation
- [x] Spike: UA vs Default worldview diff
- [x] Audit existing notebook touchups; categorize → keep / drop / port to YAML config (see "Notebook audit" section)
- [x] Per-country obsolescence check against current NE 5.x (see "Obsolescence check" section)
- [x] Per-country external-GeoJSON check: India/Latvia/Philippines — confirmed `external_overrides.yaml` NOT needed
- [x] Design + draft all five config schemas: `name_overrides.yaml`, `flying_islands.yaml`, `territory_assignments.yaml`, `regional_aggregations.yaml`, `composite_maps.yaml` + `procedural/README.md` for the escape hatch
- [x] Write `scripts/build.sh` + `scripts/build.py` (mapshaper-based) consuming the YAML configs
- [x] Implement all 5 transforms: name_overrides, flying_islands, territory_assignments, regional_aggregations, composite_maps
- [x] Per-country Admin 1 split (220 output files instead of one monolith)
- [x] Pipeline produces correct counts on every transform vs. notebook expectations
- [ ] Verify Russia Chukchi renders correctly with current NE data + D3 projection (to confirm antimeridian-fix obsolescence)
- [ ] Verify India J&K geometry against current Indian boundary expectations under `_ukr` worldview
- [x] Generate all NE-published worldviews at Admin 0 (33 worldviews: default + 32 country-specific editorials shipped from NE 5.1.2). Admin 1 remains shared (single shared file per country, worldview-agnostic) because NE doesn't publish per-worldview Admin 1 variants.
- [x] CI workflow for regeneration (informational drift detection — cross-platform mapshaper output reproducibility is still WIP, so failures comment on the PR but don't block)

### Phase 2: Plugin scaffolding
- [x] Scaffold `plugin-chart-country-map` directory matching modern plugin structure
- [x] Register against `chart/data` endpoint (buildQuery + ChartPlugin class)
- [x] transformProps derives `geoJsonUrl` from form_data using the build script's output naming
- [x] D3 renderer ported to modern modules (d3-geo, d3-color, d3-array); fully typed, no @ts-nocheck; fit-to-selection projection
- [x] Hosting path wired — outputs ship to `superset/static/assets/country-maps/`, served by Flask at `/static/assets/country-maps/`
- [x] Click-to-zoom interaction (4x zoom on click, click-elsewhere to zoom out, 600ms transition)
- [ ] Cross-filter integration via setDataMask
- [ ] Composite projection support (geoAlbersUsa for USA, etc.) at render time

### Phase 3: Controls
- [x] Worldview selector (manifest-driven from build pipeline)
- [x] Admin level segmented control (0 / 1 / Aggregated)
- [x] Country selector (visible when admin_level !== 0; manifest-driven)
- [x] Region set selector (visible when admin_level === 'aggregated'; manifest-driven)
- [x] Composite selector (overrides admin_level + country; manifest-driven)
- [x] Region include/exclude multi-selects
- [x] Flying islands toggle (default ON)
- [x] Name language selector (20 NE languages)
- [x] Fit-to-selection projection refit (renderer auto-fits to filtered features)
- [x] Replace hardcoded choice tables with manifest-driven lookups

### Phase 4: Deprecation wiring
- [x] Add new VizType.CountryMapV2 = 'country_map_v2'
- [x] Register new plugin in MainPreset alongside legacy
- [x] Add @superset-ui/plugin-chart-country-map as workspace dep
- [x] Mark legacy plugin with `label: ChartLabel.Deprecated` + explanation
- [x] Rename legacy plugin's display to "Country Map (Legacy)"
- [x] form_data migration on viz-type switch (`formDataOverrides` in
      controlPanel.tsx + `migrateFromLegacy.ts`) — when a user switches a
      saved legacy chart's viz type to `country_map_v2`, `select_country`
      auto-translates to admin_level + country + composite/region_set
      via the standard cross-viz form_data hand-off; no separate "Switch
      to new Country Map" button needed
- [ ] **Future:** DB migration that auto-ports every existing
      `viz_type='country_map'` chart in the metadata DB to
      `country_map_v2` (using the same migrateFromLegacy mapping) —
      eliminates the legacy plugin entirely once shipped
- [ ] Auto-close superseded duplicate PRs (#32497, etc.) on merge

### Phase 5: Polish + docs
- [x] Build manifest output (NE SHA + worldviews + admin levels + sizes)
- [x] Tests: transformProps (10 cases) + buildQuery (3 cases) + controlPanel (10 cases) + build.py transforms (18 cases) = 41 total
- [x] UPDATING.md entry
- [x] CI workflow that regenerates outputs (fails PR if drift)
- [ ] Real example images / thumbnails for the chart type picker (need actual rendering capture)
- [ ] Update Superset docs site
- [x] Manifest also written to `src/data/manifest.json` for synchronous import in controlPanel

## Current PR state (snapshot as of latest commit)

**What's working end-to-end:**

```
$ ./scripts/build.sh
Country Map build — pinned to NE v5.1.2 (f1890d9f)
Loaded 10 name override entries
Loaded flying_islands rules for 7 countries
Loaded territory_assignments rules for 2 countries
Loaded regional_aggregations: 4 region-sets across 4 countries
Loaded composite_maps: 1 composites

Building worldview=ukr admin_level=0
  …  wrote ukr_admin0.geo.json (2,101,149 bytes, 249 features)
Building worldview=ukr admin_level=1
  …  name_overrides: applied 19 field updates across 10 entries
  …  flying_islands: repositioned 12 features, dropped 5 (outside-bbox)
  …  territory_assignments: added 4 features from sibling Admin 0 records
  …  TUR/nuts_1: 81 subdivisions → 12 regions → regional_TUR_nuts_1_ukr.geo.json (23 KB)
  …  FRA/regions: 101 subdivisions → 18 regions → regional_FRA_regions_ukr.geo.json (32 KB)
  …  ITA/regions: 110 subdivisions → 20 regions → regional_ITA_regions_ukr.geo.json (32 KB)
  …  PHL/regions: 118 subdivisions → 17 regions → regional_PHL_regions_ukr.geo.json (32 KB)
  …  france_overseas: 108 features → composite_france_overseas_ukr.geo.json (322 KB)
  …  wrote 214 per-country Admin 1 files (total 14.7 MB)
Done.
```

**Plugin scaffold compiles** (placeholder renderer, modern ChartPlugin, buildQuery against chart/data, transformProps deriving the right GeoJSON URL from form_data).

**Not yet wired:** real D3 rendering, full control panel, hosting path for the build outputs, legacy plugin deprecation. Each is a discrete next commit.

## Test plan (for the maintainer to validate before merge)

This section accumulates checks the maintainer should run themselves
rather than trust the agent's "looks right". Items get added as the
implementation progresses; check them off as verified.

### Build pipeline (data correctness)

- [ ] **Crimea/Sevastopol shown as Ukrainian** in `ukr_admin1_UKR.geo.json` — visually inspect the southern coastline; UKR feature should include the Crimean peninsula extending to ~44.4°N
- [ ] **France typos fixed**: `ukr_admin1_FRA.geo.json` should contain "Seine-et-Marne" and "Haut-Rhin" (NOT "Seien-et-Marne" or "Haute-Rhin")
- [ ] **France ISO codes updated**: search FRA features for `iso_3166_2: "FR-75C"` (NOT "FR-75"), `"FR-971"` (NOT "FR-GP"), etc.
- [ ] **Philippines admin renames**: PHL features should use "Caraga Administrative Region" and "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)" — not the older names
- [ ] **China + SARs in Admin 1**: `ukr_admin1_CHN.geo.json` should contain Taiwan (CN-71), Hong Kong (CN-91), Macau (CN-92) as features
- [ ] **Finland + Åland**: `ukr_admin1_FIN.geo.json` should contain Åland with iso_3166_2 = "FI-01"
- [ ] **Flying islands repositioned**: USA admin1 should show Hawaii and Alaska repositioned near the lower 48; France admin1 should show DROMs near mainland
- [ ] **Bbox drops applied**: Netherlands and UK admin1 should NOT show Caribbean / overseas territories
- [ ] **Regional aggregations**: open `regional_TUR_nuts_1_ukr.geo.json` — should have exactly 12 features named İstanbul, Batı Marmara, Ege, etc.
- [ ] **France with overseas composite**: `composite_france_overseas_ukr.geo.json` should contain mainland + 5 DROMs + Polynésie française + Kerguelen + Wallis-et-Futuna + Nouvelle-Calédonie + Saint-Pierre-et-Miquelon + Saint-Martin + Saint-Barthélémy + zoomed Paris/petite couronne
- [ ] **File sizes look sane**: world admin0 ~2 MB, per-country admin1 mostly < 1 MB, regional aggregations ~30 KB

### Visual / cartographic quality (in chart)

- [ ] World choropleth renders with no broken or missing countries
- [ ] Russia Chukchi region renders as one connected piece (verifies antimeridian-fix obsolescence)
- [ ] India J&K geometry under `_ukr` worldview matches what Indian-audience users expect — if not, may want to ship `_ind` for India-heavy deployments instead
- [ ] Per-chart payload sizes feel responsive (no multi-MB downloads on country-level charts)
- [ ] Tooltips show the right value for each region (verify ISO match between data + GeoJSON)
- [ ] Cross-filters work bidirectionally (clicking a region filters dashboard)

### Controls UX

- [ ] Worldview selector shows all built worldviews
- [ ] Picking a different worldview swaps the geometry without re-querying data
- [ ] Admin level segmented control (0/1/Aggregated) shows/hides the country picker correctly
- [ ] Region include/exclude actually filters rendered features client-side
- [ ] Flying islands toggle drops territories when off; viewport refits
- [ ] Name language selector switches displayed names (e.g. en → fr)
- [ ] Composite picker exposes France-with-Overseas as a discrete option

### Backward compatibility

- [ ] Existing legacy-plugin-chart-country-map dashboards continue to render unchanged
- [ ] Legacy plugin shows deprecation banner pointing at the new chart type
- [ ] "Switch to new Country Map" button creates a new chart with form_data correctly mapped (datasource, metric, color settings preserved; new fields default sensibly)
- [ ] No DB migrations needed (verify via `superset db upgrade` is a no-op)

### Per-deployment customization (config)

- [ ] `superset_config.COUNTRY_MAP.default_worldview = "default"` correctly switches the default to NE Default for that deployment
- [ ] `name_overrides` config in superset_config can add a deployment-specific rename without touching the YAML files
- [ ] `region_excludes` global config drops features from all charts

### Performance + ops

- [ ] Build script is reproducible: same NE SHA + same configs → identical outputs (byte-for-byte)
- [ ] Build script runs in CI and produces the expected files on a clean checkout
- [ ] Plugin lazy-loads correctly (chart-type registry doesn't pull D3 unless this chart type is actually used)
- [ ] No regression in legacy chart load times during the deprecation overlap

## References

- Natural Earth worldviews: https://www.naturalearthdata.com/blog/admin-0-disputed-areas/
- Natural Earth Vector repo: https://github.com/nvkelso/natural-earth-vector
- Mapshaper: https://github.com/mbloch/mapshaper
- Mapbox Boundaries (similar worldview model): https://www.mapbox.com/boundaries
- Prior PRs that surfaced this pain: #35613 (Russia borders), #32497 (Türkiye city names), and others.
