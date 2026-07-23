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

# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [0.20.0](https://github.com/apache/superset/compare/v2021.41.0...v0.20.0) (2024-09-09)

### Bug Fixes

- Add mexico back to country map ([#18219](https://github.com/apache/superset/issues/18219)) ([7f3453f](https://github.com/apache/superset/commit/7f3453f3ea4d5185c3a5f2c1d8738f474817600f))
- adding missing examples for bubble chart, bullet chart, calendar heatmap chart and country map chart in the gallery ([#22523](https://github.com/apache/superset/issues/22523)) ([839ec7c](https://github.com/apache/superset/commit/839ec7ceacc66c65928fd0ddead2b014db3d5563))
- Correct Ukraine map ([#19528](https://github.com/apache/superset/issues/19528)) ([cccec9a](https://github.com/apache/superset/commit/cccec9a6ab8eadea2ecaac6ee2094c8eb7d6b1f4))
- Department names fixed for CountryMap of France ([#23988](https://github.com/apache/superset/issues/23988)) ([a9c4472](https://github.com/apache/superset/commit/a9c4472d25f6c77bbd89c0c56802fd9c9335610c))
- **Indian Map Changes:** fixed-Indian-map-border ([#24927](https://github.com/apache/superset/issues/24927)) ([0d0a81c](https://github.com/apache/superset/commit/0d0a81c0d2a3efcfa92c7a1ac441760d5a4bc8ff))
- **maps:** adds Crimea back to Ukraine 🇺🇦 ([#28226](https://github.com/apache/superset/issues/28226)) ([1e47e65](https://github.com/apache/superset/commit/1e47e65ac504ce58c58377378b333bdccbe1919c))
- **maps:** france_regions.geojson generated with the notebook, from natural earth data ([#27014](https://github.com/apache/superset/issues/27014)) ([42b7bd5](https://github.com/apache/superset/commit/42b7bd5c03146bd2ee5564c8f61058505c88169c))
- **maps:** Load indian map borders correctly (Restores [#24927](https://github.com/apache/superset/issues/24927) fixes) ([#29170](https://github.com/apache/superset/issues/29170)) ([8699571](https://github.com/apache/superset/commit/8699571654965a7975a44e6ddf8e7a9c9e69bacc))
- **maps:** Move Overseas department and regions closer to France mainland ([#26995](https://github.com/apache/superset/issues/26995)) ([2602527](https://github.com/apache/superset/commit/26025274a1ad7d3cb5842377a490555f984be695))

### Features

- Add Czech Republic country map. ([#28035](https://github.com/apache/superset/issues/28035)) ([63afa24](https://github.com/apache/superset/commit/63afa24c115ef29d623d2acf4f3ec6786466e33c))
- add France's regions to country map visualization ([#25676](https://github.com/apache/superset/issues/25676)) ([ee23690](https://github.com/apache/superset/commit/ee2369019694c55111bf4030e808cf6fd1fbf315))
- Add Turkey's regions to country map visualization ([#27455](https://github.com/apache/superset/issues/27455)) ([6b529a4](https://github.com/apache/superset/commit/6b529a4b68f26ec0f38926d78057473de3ed2648))
- Add Türkiye Map to Country Map ([#20801](https://github.com/apache/superset/issues/20801)) ([4ffa3c2](https://github.com/apache/superset/commit/4ffa3c22d17b189a384f43a0e352b137900b10bc))
- Added latin america countries to country map ([#21352](https://github.com/apache/superset/issues/21352)) ([f83af88](https://github.com/apache/superset/commit/f83af88fc7922774b4c1a7792f0602edcb80763d))
- **chart:** add Mexico to country map viz ([#18007](https://github.com/apache/superset/issues/18007)) ([f451081](https://github.com/apache/superset/commit/f45108116673d5810c238bb911058dc8ed05b75a))
- **chart:** Added SriLanka country map ([#23338](https://github.com/apache/superset/issues/23338)) ([a5c31b2](https://github.com/apache/superset/commit/a5c31b2426e21fc99afed5bde4151456144496af))
- **chart:** Added Central Asia countries to countries map ([#24870](https://github.com/apache/superset/issues/24870)) ([031e660](https://github.com/apache/superset/commit/031e6605068e45ae6e64a03f090831b7f227bf0b))
- **chart:** Added Latvia to countries map ([#22220](https://github.com/apache/superset/issues/22220)) ([9578a44](https://github.com/apache/superset/commit/9578a443ef713f01f4cc9cd3a8616b819a7a7a65))
- **chart:** Added Papua New Guinea to countries map ([#22589](https://github.com/apache/superset/issues/22589)) ([b352947](https://github.com/apache/superset/commit/b3529479ab39fcc273189bf4db4a0f1fd8b1cc0c))
- **country map:** Adding Hungary (and other touchups) ([#29627](https://github.com/apache/superset/issues/29627)) ([72caec1](https://github.com/apache/superset/commit/72caec10fe7fe192bdd37e5435f3eef6b41ef0b5))
- **country-map:** added new countries in country-chart-map ([#18081](https://github.com/apache/superset/issues/18081)) ([0cec0c9](https://github.com/apache/superset/commit/0cec0c9a68c9489c54bea8d10ea7b28c1729e2dc))
- **country-map:** Adds Philippines regional map and updates/cleans existing Philippines provincial map ([#27933](https://github.com/apache/superset/issues/27933)) ([ce1d18e](https://github.com/apache/superset/commit/ce1d18e5341b37769e2f73ec0e37c9c5782c5855))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache/superset/issues/20524)) ([e12ee59](https://github.com/apache/superset/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- improve color consistency (save all labels) ([#19038](https://github.com/apache/superset/issues/19038)) ([dc57508](https://github.com/apache/superset/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- **maps:** Add Italy regions code to the map generator notebook ([#27542](https://github.com/apache/superset/issues/27542)) ([86aa8bd](https://github.com/apache/superset/commit/86aa8bde8bcbf2461aede3025f8e2f15d8763546))
- **maps:** Adding ALL the countries to the Country Map plugin! 🌎 ([#28265](https://github.com/apache/superset/issues/28265)) ([cafc1a2](https://github.com/apache/superset/commit/cafc1a2c13eef303480beb8c68ec02b79dea31a9))
- **maps:** Consolidating all country maps (and TS) into the Jupyter notebook workflow. ([#26300](https://github.com/apache/superset/issues/26300)) ([73d118c](https://github.com/apache/superset/commit/73d118c0e2e967621a878ad73578d9d580f88678))

# [0.19.0](https://github.com/apache/superset/compare/v2021.41.0...v0.19.0) (2024-09-07)

### Bug Fixes

- Add mexico back to country map ([#18219](https://github.com/apache/superset/issues/18219)) ([7f3453f](https://github.com/apache/superset/commit/7f3453f3ea4d5185c3a5f2c1d8738f474817600f))
- adding missing examples for bubble chart, bullet chart, calendar heatmap chart and country map chart in the gallery ([#22523](https://github.com/apache/superset/issues/22523)) ([839ec7c](https://github.com/apache/superset/commit/839ec7ceacc66c65928fd0ddead2b014db3d5563))
- Correct Ukraine map ([#19528](https://github.com/apache/superset/issues/19528)) ([cccec9a](https://github.com/apache/superset/commit/cccec9a6ab8eadea2ecaac6ee2094c8eb7d6b1f4))
- Department names fixed for CountryMap of France ([#23988](https://github.com/apache/superset/issues/23988)) ([a9c4472](https://github.com/apache/superset/commit/a9c4472d25f6c77bbd89c0c56802fd9c9335610c))
- **Indian Map Changes:** fixed-Indian-map-border ([#24927](https://github.com/apache/superset/issues/24927)) ([0d0a81c](https://github.com/apache/superset/commit/0d0a81c0d2a3efcfa92c7a1ac441760d5a4bc8ff))
- **maps:** adds Crimea back to Ukraine 🇺🇦 ([#28226](https://github.com/apache/superset/issues/28226)) ([1e47e65](https://github.com/apache/superset/commit/1e47e65ac504ce58c58377378b333bdccbe1919c))
- **maps:** france_regions.geojson generated with the notebook, from natural earth data ([#27014](https://github.com/apache/superset/issues/27014)) ([42b7bd5](https://github.com/apache/superset/commit/42b7bd5c03146bd2ee5564c8f61058505c88169c))
- **maps:** Load indian map borders correctly (Restores [#24927](https://github.com/apache/superset/issues/24927) fixes) ([#29170](https://github.com/apache/superset/issues/29170)) ([8699571](https://github.com/apache/superset/commit/8699571654965a7975a44e6ddf8e7a9c9e69bacc))
- **maps:** Move Overseas department and regions closer to France mainland ([#26995](https://github.com/apache/superset/issues/26995)) ([2602527](https://github.com/apache/superset/commit/26025274a1ad7d3cb5842377a490555f984be695))

### Features

- Add Czech Republic country map. ([#28035](https://github.com/apache/superset/issues/28035)) ([63afa24](https://github.com/apache/superset/commit/63afa24c115ef29d623d2acf4f3ec6786466e33c))
- add France's regions to country map visualization ([#25676](https://github.com/apache/superset/issues/25676)) ([ee23690](https://github.com/apache/superset/commit/ee2369019694c55111bf4030e808cf6fd1fbf315))
- Add Turkey's regions to country map visualization ([#27455](https://github.com/apache/superset/issues/27455)) ([6b529a4](https://github.com/apache/superset/commit/6b529a4b68f26ec0f38926d78057473de3ed2648))
- Add Türkiye Map to Country Map ([#20801](https://github.com/apache/superset/issues/20801)) ([4ffa3c2](https://github.com/apache/superset/commit/4ffa3c22d17b189a384f43a0e352b137900b10bc))
- Added latin america countries to country map ([#21352](https://github.com/apache/superset/issues/21352)) ([f83af88](https://github.com/apache/superset/commit/f83af88fc7922774b4c1a7792f0602edcb80763d))
- **chart:** add Mexico to country map viz ([#18007](https://github.com/apache/superset/issues/18007)) ([f451081](https://github.com/apache/superset/commit/f45108116673d5810c238bb911058dc8ed05b75a))
- **chart:** Added SriLanka country map ([#23338](https://github.com/apache/superset/issues/23338)) ([a5c31b2](https://github.com/apache/superset/commit/a5c31b2426e21fc99afed5bde4151456144496af))
- **chart:** Added Central Asia countries to countries map ([#24870](https://github.com/apache/superset/issues/24870)) ([031e660](https://github.com/apache/superset/commit/031e6605068e45ae6e64a03f090831b7f227bf0b))
- **chart:** Added Latvia to countries map ([#22220](https://github.com/apache/superset/issues/22220)) ([9578a44](https://github.com/apache/superset/commit/9578a443ef713f01f4cc9cd3a8616b819a7a7a65))
- **chart:** Added Papua New Guinea to countries map ([#22589](https://github.com/apache/superset/issues/22589)) ([b352947](https://github.com/apache/superset/commit/b3529479ab39fcc273189bf4db4a0f1fd8b1cc0c))
- **country map:** Adding Hungary (and other touchups) ([#29627](https://github.com/apache/superset/issues/29627)) ([72caec1](https://github.com/apache/superset/commit/72caec10fe7fe192bdd37e5435f3eef6b41ef0b5))
- **country-map:** added new countries in country-chart-map ([#18081](https://github.com/apache/superset/issues/18081)) ([0cec0c9](https://github.com/apache/superset/commit/0cec0c9a68c9489c54bea8d10ea7b28c1729e2dc))
- **country-map:** Adds Philippines regional map and updates/cleans existing Philippines provincial map ([#27933](https://github.com/apache/superset/issues/27933)) ([ce1d18e](https://github.com/apache/superset/commit/ce1d18e5341b37769e2f73ec0e37c9c5782c5855))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache/superset/issues/20524)) ([e12ee59](https://github.com/apache/superset/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- improve color consistency (save all labels) ([#19038](https://github.com/apache/superset/issues/19038)) ([dc57508](https://github.com/apache/superset/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- **maps:** Add Italy regions code to the map generator notebook ([#27542](https://github.com/apache/superset/issues/27542)) ([86aa8bd](https://github.com/apache/superset/commit/86aa8bde8bcbf2461aede3025f8e2f15d8763546))
- **maps:** Adding ALL the countries to the Country Map plugin! 🌎 ([#28265](https://github.com/apache/superset/issues/28265)) ([cafc1a2](https://github.com/apache/superset/commit/cafc1a2c13eef303480beb8c68ec02b79dea31a9))
- **maps:** Consolidating all country maps (and TS) into the Jupyter notebook workflow. ([#26300](https://github.com/apache/superset/issues/26300)) ([73d118c](https://github.com/apache/superset/commit/73d118c0e2e967621a878ad73578d9d580f88678))

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

**Note:** Version bump only for package @superset-ui/legacy-plugin-chart-country-map

## [0.17.61](https://github.com/apache-superset/superset-ui/compare/v0.17.60...v0.17.61) (2021-07-02)

**Note:** Version bump only for package @superset-ui/legacy-plugin-chart-country-map
