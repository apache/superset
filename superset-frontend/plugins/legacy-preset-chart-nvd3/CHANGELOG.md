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

- adding missing examples for bubble chart, bullet chart, calendar heatmap chart and country map chart in the gallery ([#22523](https://github.com/apache/superset/issues/22523)) ([839ec7c](https://github.com/apache/superset/commit/839ec7ceacc66c65928fd0ddead2b014db3d5563))
- Adds the Deprecated label to Time-series Percent Change chart ([#30148](https://github.com/apache/superset/issues/30148)) ([5e42d7a](https://github.com/apache/superset/commit/5e42d7aed0d11c7aac91ab19088d2632e49da614))
- **area chart legacy:** tool tip shows actual value rather than y axi… ([#23469](https://github.com/apache/superset/issues/23469)) ([db9ca20](https://github.com/apache/superset/commit/db9ca20737fecda8eee342b34d62d3b700ef3687))
- **Dashboard:** Color inconsistency on refreshes and conflicts ([#27439](https://github.com/apache/superset/issues/27439)) ([313ee59](https://github.com/apache/superset/commit/313ee596f5435894f857d72be7269d5070c8c964))
- **explore:** Fix chart standalone URL for report/thumbnail generation ([#20673](https://github.com/apache/superset/issues/20673)) ([84d4302](https://github.com/apache/superset/commit/84d4302628d18aa19c13cc5322e68abbc690ea4d))
- **explore:** make SORT-Descending visible if Sort-by has value ([#17726](https://github.com/apache/superset/issues/17726)) ([d5768ab](https://github.com/apache/superset/commit/d5768ab649a70fd4f541ad4982498f622160b220))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- **legacy-chart:** corrupted raw chart data ([#24850](https://github.com/apache/superset/issues/24850)) ([1c5971d](https://github.com/apache/superset/commit/1c5971d3afb70a338444c41943ff90c3a9c03ec3))
- Rename legacy line and area charts ([#28113](https://github.com/apache/superset/issues/28113)) ([b4c4ab7](https://github.com/apache/superset/commit/b4c4ab7790cbeb8d65ec7c1084482c21932e755b))
- Reset sorting bar issue in Barchart ([#19371](https://github.com/apache/superset/issues/19371)) ([94e06c2](https://github.com/apache/superset/commit/94e06c2b6a1f782133bb9ef85a1d46ce7eacf9ba))
- **storybook:** fix broken Storybook stories during development ([#29587](https://github.com/apache/superset/issues/29587)) ([462cda4](https://github.com/apache/superset/commit/462cda400baa00b3bcc4a7f8aded362ca55e18a5))
- Tooltip of area chart shows undefined total ([#24916](https://github.com/apache/superset/issues/24916)) ([ec9e9a4](https://github.com/apache/superset/commit/ec9e9a46f2f092ce56d3ed5a8a9a3ea0214db88a))
- warning of nth-child ([#23638](https://github.com/apache/superset/issues/23638)) ([16cc089](https://github.com/apache/superset/commit/16cc089b198dcdebc2422845aa08d18233c6b3a4))
- Zero values on Dual Line axis bounds ([#23649](https://github.com/apache/superset/issues/23649)) ([d66e6e6](https://github.com/apache/superset/commit/d66e6e6d400db0fee35d73cd43e610cd1c491f4b))

### Features

- Adds the ECharts Bubble chart ([#22107](https://github.com/apache/superset/issues/22107)) ([c81c60c](https://github.com/apache/superset/commit/c81c60c91fbcb09dd63c05f050e18ee09ceebfd6))
- apply standardized form data to tier 2 charts ([#20530](https://github.com/apache/superset/issues/20530)) ([de524bc](https://github.com/apache/superset/commit/de524bc59f011fd361dcdb7d35c2cb51f7eba442))
- **chart & legend:** make to enable show legend by default ([#19927](https://github.com/apache/superset/issues/19927)) ([7b3d0f0](https://github.com/apache/superset/commit/7b3d0f040b050905f7d0901d0227f1cd6b761b56))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache/superset/issues/20524)) ([e12ee59](https://github.com/apache/superset/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- **explore:** Denormalize form data in echarts, world map and nvd3 bar and line charts ([#20313](https://github.com/apache/superset/issues/20313)) ([354a899](https://github.com/apache/superset/commit/354a89950c4d001da3e107f60788cea873bd6bf6))
- **explore:** improve UI in the control panel ([#19748](https://github.com/apache/superset/issues/19748)) ([e3a54aa](https://github.com/apache/superset/commit/e3a54aa3c15bdd0c970aa73f898288a408205c97))
- **explore:** standardized controls for time pivot chart ([#21321](https://github.com/apache/superset/issues/21321)) ([79525df](https://github.com/apache/superset/commit/79525dfaf29b810af668e3b6c5a56cd866370d92))
- **formatters:** Add custom d3-time-format locale ([#24263](https://github.com/apache/superset/issues/24263)) ([024cfd8](https://github.com/apache/superset/commit/024cfd86e408ec5f7ddf49a9e90908e2fb2e6b70))
- improve color consistency (save all labels) ([#19038](https://github.com/apache/superset/issues/19038)) ([dc57508](https://github.com/apache/superset/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- **legacy-preset-chart-nvd3:** add richtooltip in nvd3 bar chart ([#17615](https://github.com/apache/superset/issues/17615)) ([72f3215](https://github.com/apache/superset/commit/72f3215ffc74ead33dba57196aeaf4e1db63fd6c))
- Migrates Dual Line Chart to Mixed Chart ([#23910](https://github.com/apache/superset/issues/23910)) ([f5148ef](https://github.com/apache/superset/commit/f5148ef728ce649697c10fb7aa65982d7dd05638))
- Removes the Multiple Line Charts ([#23933](https://github.com/apache/superset/issues/23933)) ([6ce8592](https://github.com/apache/superset/commit/6ce85921fc103ba0e93b437d473003e6f1b4a42b))
- update time comparison choices (again) ([#17968](https://github.com/apache/superset/issues/17968)) ([05d9cde](https://github.com/apache/superset/commit/05d9cde203b99f8c63106446f0be58668cc9f0c9))
- update time comparison choices (again) ([#22458](https://github.com/apache/superset/issues/22458)) ([9e81c3a](https://github.com/apache/superset/commit/9e81c3a1192a18226d505178d16e1e395917a719))
- **viz picker:** Remove some tags, refactor Recommended section ([#27708](https://github.com/apache/superset/issues/27708)) ([c314999](https://github.com/apache/superset/commit/c3149994ac0d4392e0462421b62cd0c034142082))

# [0.19.0](https://github.com/apache/superset/compare/v2021.41.0...v0.19.0) (2024-09-07)

### Bug Fixes

- adding missing examples for bubble chart, bullet chart, calendar heatmap chart and country map chart in the gallery ([#22523](https://github.com/apache/superset/issues/22523)) ([839ec7c](https://github.com/apache/superset/commit/839ec7ceacc66c65928fd0ddead2b014db3d5563))
- Adds the Deprecated label to Time-series Percent Change chart ([#30148](https://github.com/apache/superset/issues/30148)) ([5e42d7a](https://github.com/apache/superset/commit/5e42d7aed0d11c7aac91ab19088d2632e49da614))
- **area chart legacy:** tool tip shows actual value rather than y axi… ([#23469](https://github.com/apache/superset/issues/23469)) ([db9ca20](https://github.com/apache/superset/commit/db9ca20737fecda8eee342b34d62d3b700ef3687))
- **Dashboard:** Color inconsistency on refreshes and conflicts ([#27439](https://github.com/apache/superset/issues/27439)) ([313ee59](https://github.com/apache/superset/commit/313ee596f5435894f857d72be7269d5070c8c964))
- **explore:** Fix chart standalone URL for report/thumbnail generation ([#20673](https://github.com/apache/superset/issues/20673)) ([84d4302](https://github.com/apache/superset/commit/84d4302628d18aa19c13cc5322e68abbc690ea4d))
- **explore:** make SORT-Descending visible if Sort-by has value ([#17726](https://github.com/apache/superset/issues/17726)) ([d5768ab](https://github.com/apache/superset/commit/d5768ab649a70fd4f541ad4982498f622160b220))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- **legacy-chart:** corrupted raw chart data ([#24850](https://github.com/apache/superset/issues/24850)) ([1c5971d](https://github.com/apache/superset/commit/1c5971d3afb70a338444c41943ff90c3a9c03ec3))
- Rename legacy line and area charts ([#28113](https://github.com/apache/superset/issues/28113)) ([b4c4ab7](https://github.com/apache/superset/commit/b4c4ab7790cbeb8d65ec7c1084482c21932e755b))
- Reset sorting bar issue in Barchart ([#19371](https://github.com/apache/superset/issues/19371)) ([94e06c2](https://github.com/apache/superset/commit/94e06c2b6a1f782133bb9ef85a1d46ce7eacf9ba))
- **storybook:** fix broken Storybook stories during development ([#29587](https://github.com/apache/superset/issues/29587)) ([462cda4](https://github.com/apache/superset/commit/462cda400baa00b3bcc4a7f8aded362ca55e18a5))
- Tooltip of area chart shows undefined total ([#24916](https://github.com/apache/superset/issues/24916)) ([ec9e9a4](https://github.com/apache/superset/commit/ec9e9a46f2f092ce56d3ed5a8a9a3ea0214db88a))
- warning of nth-child ([#23638](https://github.com/apache/superset/issues/23638)) ([16cc089](https://github.com/apache/superset/commit/16cc089b198dcdebc2422845aa08d18233c6b3a4))
- Zero values on Dual Line axis bounds ([#23649](https://github.com/apache/superset/issues/23649)) ([d66e6e6](https://github.com/apache/superset/commit/d66e6e6d400db0fee35d73cd43e610cd1c491f4b))

### Features

- Adds the ECharts Bubble chart ([#22107](https://github.com/apache/superset/issues/22107)) ([c81c60c](https://github.com/apache/superset/commit/c81c60c91fbcb09dd63c05f050e18ee09ceebfd6))
- apply standardized form data to tier 2 charts ([#20530](https://github.com/apache/superset/issues/20530)) ([de524bc](https://github.com/apache/superset/commit/de524bc59f011fd361dcdb7d35c2cb51f7eba442))
- **chart & legend:** make to enable show legend by default ([#19927](https://github.com/apache/superset/issues/19927)) ([7b3d0f0](https://github.com/apache/superset/commit/7b3d0f040b050905f7d0901d0227f1cd6b761b56))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache/superset/issues/20524)) ([e12ee59](https://github.com/apache/superset/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- **explore:** Denormalize form data in echarts, world map and nvd3 bar and line charts ([#20313](https://github.com/apache/superset/issues/20313)) ([354a899](https://github.com/apache/superset/commit/354a89950c4d001da3e107f60788cea873bd6bf6))
- **explore:** improve UI in the control panel ([#19748](https://github.com/apache/superset/issues/19748)) ([e3a54aa](https://github.com/apache/superset/commit/e3a54aa3c15bdd0c970aa73f898288a408205c97))
- **explore:** standardized controls for time pivot chart ([#21321](https://github.com/apache/superset/issues/21321)) ([79525df](https://github.com/apache/superset/commit/79525dfaf29b810af668e3b6c5a56cd866370d92))
- **formatters:** Add custom d3-time-format locale ([#24263](https://github.com/apache/superset/issues/24263)) ([024cfd8](https://github.com/apache/superset/commit/024cfd86e408ec5f7ddf49a9e90908e2fb2e6b70))
- improve color consistency (save all labels) ([#19038](https://github.com/apache/superset/issues/19038)) ([dc57508](https://github.com/apache/superset/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- **legacy-preset-chart-nvd3:** add richtooltip in nvd3 bar chart ([#17615](https://github.com/apache/superset/issues/17615)) ([72f3215](https://github.com/apache/superset/commit/72f3215ffc74ead33dba57196aeaf4e1db63fd6c))
- Migrates Dual Line Chart to Mixed Chart ([#23910](https://github.com/apache/superset/issues/23910)) ([f5148ef](https://github.com/apache/superset/commit/f5148ef728ce649697c10fb7aa65982d7dd05638))
- Removes the Multiple Line Charts ([#23933](https://github.com/apache/superset/issues/23933)) ([6ce8592](https://github.com/apache/superset/commit/6ce85921fc103ba0e93b437d473003e6f1b4a42b))
- update time comparison choices (again) ([#17968](https://github.com/apache/superset/issues/17968)) ([05d9cde](https://github.com/apache/superset/commit/05d9cde203b99f8c63106446f0be58668cc9f0c9))
- update time comparison choices (again) ([#22458](https://github.com/apache/superset/issues/22458)) ([9e81c3a](https://github.com/apache/superset/commit/9e81c3a1192a18226d505178d16e1e395917a719))
- **viz picker:** Remove some tags, refactor Recommended section ([#27708](https://github.com/apache/superset/issues/27708)) ([c314999](https://github.com/apache/superset/commit/c3149994ac0d4392e0462421b62cd0c034142082))

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

**Note:** Version bump only for package @superset-ui/legacy-preset-chart-nvd3

## [0.17.63](https://github.com/apache-superset/superset-ui/compare/v0.17.62...v0.17.63) (2021-07-02)

**Note:** Version bump only for package @superset-ui/legacy-preset-chart-nvd3

## [0.17.62](https://github.com/apache-superset/superset-ui/compare/v0.17.61...v0.17.62) (2021-07-02)

**Note:** Version bump only for package @superset-ui/legacy-preset-chart-nvd3

## [0.17.61](https://github.com/apache-superset/superset-ui/compare/v0.17.60...v0.17.61) (2021-07-02)

**Note:** Version bump only for package @superset-ui/legacy-preset-chart-nvd3
