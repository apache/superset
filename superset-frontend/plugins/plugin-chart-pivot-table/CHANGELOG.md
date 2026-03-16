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

- Adds time grain to Pivot Table v2 ([#22170](https://github.com/apache/superset/issues/22170)) ([9a2cb43](https://github.com/apache/superset/commit/9a2cb431ce9b82d656838d70c088bc00f3e4bd5e))
- **capitalization:** Capitalizing the 'metric' label in Pivot Tables ([#24265](https://github.com/apache/superset/issues/24265)) ([46c2479](https://github.com/apache/superset/commit/46c2479db2507d5117264b33a5266526e7a3b829))
- **charts:** Time grain is None when dataset uses Jinja ([#25842](https://github.com/apache/superset/issues/25842)) ([7536dd1](https://github.com/apache/superset/commit/7536dd12cdd58a1bca7d72952a2b74641f16c959))
- **conditional formatting:** controls looses on save ([#23137](https://github.com/apache/superset/issues/23137)) ([ce3ba67](https://github.com/apache/superset/commit/ce3ba67cf63e90059d94e2aa956982ad4ea44d1e))
- Dashboard time grain in Pivot Table ([#24665](https://github.com/apache/superset/issues/24665)) ([6e59f11](https://github.com/apache/superset/commit/6e59f11f4ce76305c1b0adee883f3b958199805b))
- **dashboard:** Allow selecting text in cells in Table and PivotTable without triggering cross filters ([#23283](https://github.com/apache/superset/issues/23283)) ([d16512b](https://github.com/apache/superset/commit/d16512b7758e36a1263fc63bd7d9d1f93060dc93))
- **dashboard:** fix Pivot Table V2 dragPreview in the dashboard ([#21539](https://github.com/apache/superset/issues/21539)) ([ab53d77](https://github.com/apache/superset/commit/ab53d77abacaf03e67c5a922c1e9dbd9a62fedbf))
- Further drill by in Pivot Table ([#23692](https://github.com/apache/superset/issues/23692)) ([da5f715](https://github.com/apache/superset/commit/da5f7155c63c2a9f7b42a31130fa24e9698b1191))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache/superset/issues/19071)) ([0e0bece](https://github.com/apache/superset/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **Pivot Table v2:** resolved full width issue ([#23393](https://github.com/apache/superset/issues/23393)) ([832e8fb](https://github.com/apache/superset/commit/832e8fb0ac7599e87135d002b361475403d2791a))
- pivot v2 charts created before `GENERIC_CHART_AXES` is enabled ([#23731](https://github.com/apache/superset/issues/23731)) ([314987f](https://github.com/apache/superset/commit/314987f32dee789d7aa6af14943727af979ee30b))
- **pivot-table-v2:** Added forgotten translation pivot table v2 ([#22840](https://github.com/apache/superset/issues/22840)) ([60fe581](https://github.com/apache/superset/commit/60fe58196a6e8dd1ea7a2e6aaf8401d0a718bc41))
- **PivotTable:** Pass string only to safeHtmlSpan ([#29895](https://github.com/apache/superset/issues/29895)) ([fb6efb9](https://github.com/apache/superset/commit/fb6efb9e9a049ecd7985a50a902810484b0fc37a))
- **plugin-chart-pivot-table:** Invalid Formats Date Fields ([#20909](https://github.com/apache/superset/issues/20909)) ([3f124d9](https://github.com/apache/superset/commit/3f124d9d67f194746da0a49ee2456a0530ec73f9))
- string aggregation is incorrect in PivotTableV2 ([#19102](https://github.com/apache/superset/issues/19102)) ([22b7496](https://github.com/apache/superset/commit/22b7496d2ea444ca619aa21f9e820bb610cc5648))

### Features

- Add currencies controls in control panels ([#24718](https://github.com/apache/superset/issues/24718)) ([f7e76d0](https://github.com/apache/superset/commit/f7e76d02b7cbe4940946673590bb979984ace9f5))
- Adds drill to detail context menu to Pivot Table ([#21198](https://github.com/apache/superset/issues/21198)) ([859b6d2](https://github.com/apache/superset/commit/859b6d2d20a58f2079c43bb66645fd3b604e077e))
- Adds drill to detail context menu to Table ([#21168](https://github.com/apache/superset/issues/21168)) ([68fa4d2](https://github.com/apache/superset/commit/68fa4d2665cc0742b2194533271ce562a3ebbf14))
- Adds options to show subtotals in Pivot Table ([#24960](https://github.com/apache/superset/issues/24960)) ([be11556](https://github.com/apache/superset/commit/be1155679963a90c7a0d699a2ebdceade40fb5a9))
- Adds the Featured Charts dashboard ([#28789](https://github.com/apache/superset/issues/28789)) ([95706d9](https://github.com/apache/superset/commit/95706d9be2b5414ed496ad762ba1996041429e01))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache/superset/issues/21993)) ([22fab5e](https://github.com/apache/superset/commit/22fab5e58ce574e962518067d982e3036449e580))
- **dashboard:** Add cross filter from context menu ([#23141](https://github.com/apache/superset/issues/23141)) ([ee1952e](https://github.com/apache/superset/commit/ee1952e488f2cd0913fe6f35ffe551d18ee3d143))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache/superset/issues/21351)) ([76e57ec](https://github.com/apache/superset/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache/superset/issues/19855)) ([ba0c37d](https://github.com/apache/superset/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **formatters:** Add custom d3-time-format locale ([#24263](https://github.com/apache/superset/issues/24263)) ([024cfd8](https://github.com/apache/superset/commit/024cfd86e408ec5f7ddf49a9e90908e2fb2e6b70))
- get html (links/styling/img/...) to work in pivot table ([#29724](https://github.com/apache/superset/issues/29724)) ([c582941](https://github.com/apache/superset/commit/c5829419e32f3c99c202c4f47c4e1f5882ebdbc1))
- Implement context menu for drill by ([#23454](https://github.com/apache/superset/issues/23454)) ([9fbfd1c](https://github.com/apache/superset/commit/9fbfd1c1d883f983ef96b8812297721e2a1a9695))
- Implement currencies formatter for saved metrics ([#24517](https://github.com/apache/superset/issues/24517)) ([83ff4cd](https://github.com/apache/superset/commit/83ff4cd86a4931fc8eda83aeb3d8d3c92d773202))
- Move cross filters to Dashboard ([#22785](https://github.com/apache/superset/issues/22785)) ([9ed2326](https://github.com/apache/superset/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **plugin-chart-pivot-table:** support series limit ([#17803](https://github.com/apache/superset/issues/17803)) ([2c3f39f](https://github.com/apache/superset/commit/2c3f39f3f2a4369bf03403c452d124c24c521e7d))
- standardized form_data ([#20010](https://github.com/apache/superset/issues/20010)) ([dd4b581](https://github.com/apache/superset/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- **storybook:** Co-habitating/Upgrading Storybooks to v7 (dependency madness ensues) ([#26907](https://github.com/apache/superset/issues/26907)) ([753ef69](https://github.com/apache/superset/commit/753ef695294ce26238b68ff41ba0a9af6aea74de))
- support multiple time columns with time grain in Pivot Table v2 ([#21537](https://github.com/apache/superset/issues/21537)) ([e671d80](https://github.com/apache/superset/commit/e671d8020982111e117e7415dee41672cc32d780))

# [0.19.0](https://github.com/apache/superset/compare/v2021.41.0...v0.19.0) (2024-09-07)

### Bug Fixes

- Adds time grain to Pivot Table v2 ([#22170](https://github.com/apache/superset/issues/22170)) ([9a2cb43](https://github.com/apache/superset/commit/9a2cb431ce9b82d656838d70c088bc00f3e4bd5e))
- **capitalization:** Capitalizing the 'metric' label in Pivot Tables ([#24265](https://github.com/apache/superset/issues/24265)) ([46c2479](https://github.com/apache/superset/commit/46c2479db2507d5117264b33a5266526e7a3b829))
- **charts:** Time grain is None when dataset uses Jinja ([#25842](https://github.com/apache/superset/issues/25842)) ([7536dd1](https://github.com/apache/superset/commit/7536dd12cdd58a1bca7d72952a2b74641f16c959))
- **conditional formatting:** controls looses on save ([#23137](https://github.com/apache/superset/issues/23137)) ([ce3ba67](https://github.com/apache/superset/commit/ce3ba67cf63e90059d94e2aa956982ad4ea44d1e))
- Dashboard time grain in Pivot Table ([#24665](https://github.com/apache/superset/issues/24665)) ([6e59f11](https://github.com/apache/superset/commit/6e59f11f4ce76305c1b0adee883f3b958199805b))
- **dashboard:** Allow selecting text in cells in Table and PivotTable without triggering cross filters ([#23283](https://github.com/apache/superset/issues/23283)) ([d16512b](https://github.com/apache/superset/commit/d16512b7758e36a1263fc63bd7d9d1f93060dc93))
- **dashboard:** fix Pivot Table V2 dragPreview in the dashboard ([#21539](https://github.com/apache/superset/issues/21539)) ([ab53d77](https://github.com/apache/superset/commit/ab53d77abacaf03e67c5a922c1e9dbd9a62fedbf))
- Further drill by in Pivot Table ([#23692](https://github.com/apache/superset/issues/23692)) ([da5f715](https://github.com/apache/superset/commit/da5f7155c63c2a9f7b42a31130fa24e9698b1191))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache/superset/issues/19071)) ([0e0bece](https://github.com/apache/superset/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **Pivot Table v2:** resolved full width issue ([#23393](https://github.com/apache/superset/issues/23393)) ([832e8fb](https://github.com/apache/superset/commit/832e8fb0ac7599e87135d002b361475403d2791a))
- pivot v2 charts created before `GENERIC_CHART_AXES` is enabled ([#23731](https://github.com/apache/superset/issues/23731)) ([314987f](https://github.com/apache/superset/commit/314987f32dee789d7aa6af14943727af979ee30b))
- **pivot-table-v2:** Added forgotten translation pivot table v2 ([#22840](https://github.com/apache/superset/issues/22840)) ([60fe581](https://github.com/apache/superset/commit/60fe58196a6e8dd1ea7a2e6aaf8401d0a718bc41))
- **PivotTable:** Pass string only to safeHtmlSpan ([#29895](https://github.com/apache/superset/issues/29895)) ([fb6efb9](https://github.com/apache/superset/commit/fb6efb9e9a049ecd7985a50a902810484b0fc37a))
- **plugin-chart-pivot-table:** Invalid Formats Date Fields ([#20909](https://github.com/apache/superset/issues/20909)) ([3f124d9](https://github.com/apache/superset/commit/3f124d9d67f194746da0a49ee2456a0530ec73f9))
- string aggregation is incorrect in PivotTableV2 ([#19102](https://github.com/apache/superset/issues/19102)) ([22b7496](https://github.com/apache/superset/commit/22b7496d2ea444ca619aa21f9e820bb610cc5648))

### Features

- Add currencies controls in control panels ([#24718](https://github.com/apache/superset/issues/24718)) ([f7e76d0](https://github.com/apache/superset/commit/f7e76d02b7cbe4940946673590bb979984ace9f5))
- Adds drill to detail context menu to Pivot Table ([#21198](https://github.com/apache/superset/issues/21198)) ([859b6d2](https://github.com/apache/superset/commit/859b6d2d20a58f2079c43bb66645fd3b604e077e))
- Adds drill to detail context menu to Table ([#21168](https://github.com/apache/superset/issues/21168)) ([68fa4d2](https://github.com/apache/superset/commit/68fa4d2665cc0742b2194533271ce562a3ebbf14))
- Adds options to show subtotals in Pivot Table ([#24960](https://github.com/apache/superset/issues/24960)) ([be11556](https://github.com/apache/superset/commit/be1155679963a90c7a0d699a2ebdceade40fb5a9))
- Adds the Featured Charts dashboard ([#28789](https://github.com/apache/superset/issues/28789)) ([95706d9](https://github.com/apache/superset/commit/95706d9be2b5414ed496ad762ba1996041429e01))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache/superset/issues/21993)) ([22fab5e](https://github.com/apache/superset/commit/22fab5e58ce574e962518067d982e3036449e580))
- **dashboard:** Add cross filter from context menu ([#23141](https://github.com/apache/superset/issues/23141)) ([ee1952e](https://github.com/apache/superset/commit/ee1952e488f2cd0913fe6f35ffe551d18ee3d143))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache/superset/issues/21351)) ([76e57ec](https://github.com/apache/superset/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache/superset/issues/19855)) ([ba0c37d](https://github.com/apache/superset/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **formatters:** Add custom d3-time-format locale ([#24263](https://github.com/apache/superset/issues/24263)) ([024cfd8](https://github.com/apache/superset/commit/024cfd86e408ec5f7ddf49a9e90908e2fb2e6b70))
- get html (links/styling/img/...) to work in pivot table ([#29724](https://github.com/apache/superset/issues/29724)) ([c582941](https://github.com/apache/superset/commit/c5829419e32f3c99c202c4f47c4e1f5882ebdbc1))
- Implement context menu for drill by ([#23454](https://github.com/apache/superset/issues/23454)) ([9fbfd1c](https://github.com/apache/superset/commit/9fbfd1c1d883f983ef96b8812297721e2a1a9695))
- Implement currencies formatter for saved metrics ([#24517](https://github.com/apache/superset/issues/24517)) ([83ff4cd](https://github.com/apache/superset/commit/83ff4cd86a4931fc8eda83aeb3d8d3c92d773202))
- Move cross filters to Dashboard ([#22785](https://github.com/apache/superset/issues/22785)) ([9ed2326](https://github.com/apache/superset/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **plugin-chart-pivot-table:** support series limit ([#17803](https://github.com/apache/superset/issues/17803)) ([2c3f39f](https://github.com/apache/superset/commit/2c3f39f3f2a4369bf03403c452d124c24c521e7d))
- standardized form_data ([#20010](https://github.com/apache/superset/issues/20010)) ([dd4b581](https://github.com/apache/superset/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- **storybook:** Co-habitating/Upgrading Storybooks to v7 (dependency madness ensues) ([#26907](https://github.com/apache/superset/issues/26907)) ([753ef69](https://github.com/apache/superset/commit/753ef695294ce26238b68ff41ba0a9af6aea74de))
- support multiple time columns with time grain in Pivot Table v2 ([#21537](https://github.com/apache/superset/issues/21537)) ([e671d80](https://github.com/apache/superset/commit/e671d8020982111e117e7415dee41672cc32d780))

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

### Bug Fixes

- Make the scrollbar appear inside the table ([#1310](https://github.com/apache-superset/superset-ui/issues/1310)) ([1aad2d1](https://github.com/apache-superset/superset-ui/commit/1aad2d11af95f5046f2b67d86b30c9581de4994b))

## [0.17.61](https://github.com/apache-superset/superset-ui/compare/v0.17.60...v0.17.61) (2021-07-02)

**Note:** Version bump only for package @superset-ui/plugin-chart-pivot-table
