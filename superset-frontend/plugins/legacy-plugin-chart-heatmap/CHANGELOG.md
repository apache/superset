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

- **chart & heatmap:** make to fix that y label is rendering out of bounds ([#20011](https://github.com/apache/superset/issues/20011)) ([56e9695](https://github.com/apache/superset/commit/56e96950c17ec65ef18cedfb2ed6591796a96cfc))
- Date column in Heatmap is displayed as unix timestamp ([#25009](https://github.com/apache/superset/issues/25009)) ([35eb66a](https://github.com/apache/superset/commit/35eb66a322f7938f840778633a4aea11c7f24dce))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- Heatmap numeric sorting ([#27360](https://github.com/apache/superset/issues/27360)) ([fe2f5a7](https://github.com/apache/superset/commit/fe2f5a7be9fb6218aa72ab9173481fd21fa40b20))
- **heatmap:** add detail descriptions for heatmap 'normalize across' ([#20566](https://github.com/apache/superset/issues/20566)) ([d925b0c](https://github.com/apache/superset/commit/d925b0c8835fb1773b80298a3de1bdc368c88850))
- **legacy-plugin-chart-heatmap:** fix adhoc column tooltip ([#23507](https://github.com/apache/superset/issues/23507)) ([0cebe8b](https://github.com/apache/superset/commit/0cebe8bf18204d17f311345744e67c4bf5961083))
- **select:** select component sort functionality on certain options ([#17638](https://github.com/apache/superset/issues/17638)) ([f476ba2](https://github.com/apache/superset/commit/f476ba23a279cb87a94ad3075e035cad0ae264b6))
- Timeseries Y-axis format with contribution mode ([#27106](https://github.com/apache/superset/issues/27106)) ([af577d6](https://github.com/apache/superset/commit/af577d64b17a9730e28e9021376318326fe31437))
- Tooltips don't disappear on the Heatmap chart ([#24959](https://github.com/apache/superset/issues/24959)) ([9703490](https://github.com/apache/superset/commit/97034901291420af844257fc76ac107d4a891f18))

### Features

- Add currencies controls in control panels ([#24718](https://github.com/apache/superset/issues/24718)) ([f7e76d0](https://github.com/apache/superset/commit/f7e76d02b7cbe4940946673590bb979984ace9f5))
- Adds the ECharts Heatmap chart ([#25353](https://github.com/apache/superset/issues/25353)) ([546d48a](https://github.com/apache/superset/commit/546d48adbb84b1354d6a3d4ae88dbeba0ad14d44))
- **chart & legend:** make to enable show legend by default ([#19927](https://github.com/apache/superset/issues/19927)) ([7b3d0f0](https://github.com/apache/superset/commit/7b3d0f040b050905f7d0901d0227f1cd6b761b56))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache/superset/issues/20524)) ([e12ee59](https://github.com/apache/superset/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- Implement support for currencies in more charts ([#24594](https://github.com/apache/superset/issues/24594)) ([d74d7ec](https://github.com/apache/superset/commit/d74d7eca23a3c94bc48af082c115d34c103e815d))

### Reverts

- Revert "chore(deps): bump d3-svg-legend in /superset-frontend (#19846)" (#19972) ([f144de4](https://github.com/apache/superset/commit/f144de4ee2bf213bb7e17f903bd3975d504c4136)), closes [#19846](https://github.com/apache/superset/issues/19846) [#19972](https://github.com/apache/superset/issues/19972)

# [0.19.0](https://github.com/apache/superset/compare/v2021.41.0...v0.19.0) (2024-09-07)

### Bug Fixes

- **chart & heatmap:** make to fix that y label is rendering out of bounds ([#20011](https://github.com/apache/superset/issues/20011)) ([56e9695](https://github.com/apache/superset/commit/56e96950c17ec65ef18cedfb2ed6591796a96cfc))
- Date column in Heatmap is displayed as unix timestamp ([#25009](https://github.com/apache/superset/issues/25009)) ([35eb66a](https://github.com/apache/superset/commit/35eb66a322f7938f840778633a4aea11c7f24dce))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- Heatmap numeric sorting ([#27360](https://github.com/apache/superset/issues/27360)) ([fe2f5a7](https://github.com/apache/superset/commit/fe2f5a7be9fb6218aa72ab9173481fd21fa40b20))
- **heatmap:** add detail descriptions for heatmap 'normalize across' ([#20566](https://github.com/apache/superset/issues/20566)) ([d925b0c](https://github.com/apache/superset/commit/d925b0c8835fb1773b80298a3de1bdc368c88850))
- **legacy-plugin-chart-heatmap:** fix adhoc column tooltip ([#23507](https://github.com/apache/superset/issues/23507)) ([0cebe8b](https://github.com/apache/superset/commit/0cebe8bf18204d17f311345744e67c4bf5961083))
- **select:** select component sort functionality on certain options ([#17638](https://github.com/apache/superset/issues/17638)) ([f476ba2](https://github.com/apache/superset/commit/f476ba23a279cb87a94ad3075e035cad0ae264b6))
- Timeseries Y-axis format with contribution mode ([#27106](https://github.com/apache/superset/issues/27106)) ([af577d6](https://github.com/apache/superset/commit/af577d64b17a9730e28e9021376318326fe31437))
- Tooltips don't disappear on the Heatmap chart ([#24959](https://github.com/apache/superset/issues/24959)) ([9703490](https://github.com/apache/superset/commit/97034901291420af844257fc76ac107d4a891f18))

### Features

- Add currencies controls in control panels ([#24718](https://github.com/apache/superset/issues/24718)) ([f7e76d0](https://github.com/apache/superset/commit/f7e76d02b7cbe4940946673590bb979984ace9f5))
- Adds the ECharts Heatmap chart ([#25353](https://github.com/apache/superset/issues/25353)) ([546d48a](https://github.com/apache/superset/commit/546d48adbb84b1354d6a3d4ae88dbeba0ad14d44))
- **chart & legend:** make to enable show legend by default ([#19927](https://github.com/apache/superset/issues/19927)) ([7b3d0f0](https://github.com/apache/superset/commit/7b3d0f040b050905f7d0901d0227f1cd6b761b56))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache/superset/issues/20524)) ([e12ee59](https://github.com/apache/superset/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- Implement support for currencies in more charts ([#24594](https://github.com/apache/superset/issues/24594)) ([d74d7ec](https://github.com/apache/superset/commit/d74d7eca23a3c94bc48af082c115d34c103e815d))

### Reverts

- Revert "chore(deps): bump d3-svg-legend in /superset-frontend (#19846)" (#19972) ([f144de4](https://github.com/apache/superset/commit/f144de4ee2bf213bb7e17f903bd3975d504c4136)), closes [#19846](https://github.com/apache/superset/issues/19846) [#19972](https://github.com/apache/superset/issues/19972)

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

**Note:** Version bump only for package @superset-ui/legacy-plugin-chart-heatmap

## [0.17.61](https://github.com/apache-superset/superset-ui/compare/v0.17.60...v0.17.61) (2021-07-02)

**Note:** Version bump only for package @superset-ui/legacy-plugin-chart-heatmap
