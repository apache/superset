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

- **ci:** fix failed `docker-build` CI job ([#28442](https://github.com/apache/superset/issues/28442)) ([4f51f05](https://github.com/apache/superset/commit/4f51f051334e5285495a53074c54aae0fea77156))
- **plugin-chart-echarts:** invalid total label location for negative values in stacked bar chart ([#21032](https://github.com/apache/superset/issues/21032)) ([a8ba544](https://github.com/apache/superset/commit/a8ba544e609ad3af449239c1fb956bb18c7066c4))
- **plugin-chart-echarts:** missing value format in mixed timeseries ([#21044](https://github.com/apache/superset/issues/21044)) ([2d1ba46](https://github.com/apache/superset/commit/2d1ba468441b113c574d6fcc5984e8e09ddbc1c6))
- **plugin-chart-pivot-table:** Invalid Formats Date Fields ([#20909](https://github.com/apache/superset/issues/20909)) ([3f124d9](https://github.com/apache/superset/commit/3f124d9d67f194746da0a49ee2456a0530ec73f9))
- **storybook:** fix broken Storybook stories during development ([#29587](https://github.com/apache/superset/issues/29587)) ([462cda4](https://github.com/apache/superset/commit/462cda400baa00b3bcc4a7f8aded362ca55e18a5))

### Features

- add drag and drop column rearrangement for table viz ([#19381](https://github.com/apache/superset/issues/19381)) ([7e9b85f](https://github.com/apache/superset/commit/7e9b85f76ca8cae38c38e11f857634216b1cd71c))
- add Nightingale chart support for echarts pie chart ([#28597](https://github.com/apache/superset/issues/28597)) ([f9d2451](https://github.com/apache/superset/commit/f9d2451b23e0f5b0316a61889a8d964704e888dc))
- Adds the ECharts Bubble chart ([#22107](https://github.com/apache/superset/issues/22107)) ([c81c60c](https://github.com/apache/superset/commit/c81c60c91fbcb09dd63c05f050e18ee09ceebfd6))
- Adds the ECharts Sunburst chart ([#22833](https://github.com/apache/superset/issues/22833)) ([30abefb](https://github.com/apache/superset/commit/30abefb519978e2760a492de51dc0d19803edf3a))
- **build:** uplift Storybook to v8 ([#29408](https://github.com/apache/superset/issues/29408)) ([3bf8989](https://github.com/apache/superset/commit/3bf89893dc17a8dea94a40a6d590625d215e8dab))
- Migrates Dual Line Chart to Mixed Chart ([#23910](https://github.com/apache/superset/issues/23910)) ([f5148ef](https://github.com/apache/superset/commit/f5148ef728ce649697c10fb7aa65982d7dd05638))
- Migrates Pivot Table v1 to v2 ([#23712](https://github.com/apache/superset/issues/23712)) ([522eb97](https://github.com/apache/superset/commit/522eb97b65dcaceb82f7f1b7de8545997a415253))
- Migrates TreeMap chart ([#23741](https://github.com/apache/superset/issues/23741)) ([af24092](https://github.com/apache/superset/commit/af24092440f23f807554dcc63e3e45c3c73273bf))
- **plugin-chart-echarts:** Echarts Waterfall ([#17906](https://github.com/apache/superset/issues/17906)) ([17792a5](https://github.com/apache/superset/commit/17792a507c7245c9e09c6eb98a774f2ef4ec8568))
- Removes the preset-chart-xy plugin ([#23943](https://github.com/apache/superset/issues/23943)) ([e922f09](https://github.com/apache/superset/commit/e922f0993d31732f048eb4d638c67cd7fc18bdfa))
- **storybook:** Co-habitating/Upgrading Storybooks to v7 (dependency madness ensues) ([#26907](https://github.com/apache/superset/issues/26907)) ([753ef69](https://github.com/apache/superset/commit/753ef695294ce26238b68ff41ba0a9af6aea74de))
- **timeseries-chart:** add percentage threshold input control ([#17758](https://github.com/apache/superset/issues/17758)) ([6bd4dd2](https://github.com/apache/superset/commit/6bd4dd257a6089a093bae3f251cf9f0976d353e6))

# [0.19.0](https://github.com/apache/superset/compare/v2021.41.0...v0.19.0) (2024-09-07)

### Bug Fixes

- **ci:** fix failed `docker-build` CI job ([#28442](https://github.com/apache/superset/issues/28442)) ([4f51f05](https://github.com/apache/superset/commit/4f51f051334e5285495a53074c54aae0fea77156))
- **plugin-chart-echarts:** invalid total label location for negative values in stacked bar chart ([#21032](https://github.com/apache/superset/issues/21032)) ([a8ba544](https://github.com/apache/superset/commit/a8ba544e609ad3af449239c1fb956bb18c7066c4))
- **plugin-chart-echarts:** missing value format in mixed timeseries ([#21044](https://github.com/apache/superset/issues/21044)) ([2d1ba46](https://github.com/apache/superset/commit/2d1ba468441b113c574d6fcc5984e8e09ddbc1c6))
- **plugin-chart-pivot-table:** Invalid Formats Date Fields ([#20909](https://github.com/apache/superset/issues/20909)) ([3f124d9](https://github.com/apache/superset/commit/3f124d9d67f194746da0a49ee2456a0530ec73f9))
- **storybook:** fix broken Storybook stories during development ([#29587](https://github.com/apache/superset/issues/29587)) ([462cda4](https://github.com/apache/superset/commit/462cda400baa00b3bcc4a7f8aded362ca55e18a5))

### Features

- add drag and drop column rearrangement for table viz ([#19381](https://github.com/apache/superset/issues/19381)) ([7e9b85f](https://github.com/apache/superset/commit/7e9b85f76ca8cae38c38e11f857634216b1cd71c))
- add Nightingale chart support for echarts pie chart ([#28597](https://github.com/apache/superset/issues/28597)) ([f9d2451](https://github.com/apache/superset/commit/f9d2451b23e0f5b0316a61889a8d964704e888dc))
- Adds the ECharts Bubble chart ([#22107](https://github.com/apache/superset/issues/22107)) ([c81c60c](https://github.com/apache/superset/commit/c81c60c91fbcb09dd63c05f050e18ee09ceebfd6))
- Adds the ECharts Sunburst chart ([#22833](https://github.com/apache/superset/issues/22833)) ([30abefb](https://github.com/apache/superset/commit/30abefb519978e2760a492de51dc0d19803edf3a))
- **build:** uplift Storybook to v8 ([#29408](https://github.com/apache/superset/issues/29408)) ([3bf8989](https://github.com/apache/superset/commit/3bf89893dc17a8dea94a40a6d590625d215e8dab))
- Migrates Dual Line Chart to Mixed Chart ([#23910](https://github.com/apache/superset/issues/23910)) ([f5148ef](https://github.com/apache/superset/commit/f5148ef728ce649697c10fb7aa65982d7dd05638))
- Migrates Pivot Table v1 to v2 ([#23712](https://github.com/apache/superset/issues/23712)) ([522eb97](https://github.com/apache/superset/commit/522eb97b65dcaceb82f7f1b7de8545997a415253))
- Migrates TreeMap chart ([#23741](https://github.com/apache/superset/issues/23741)) ([af24092](https://github.com/apache/superset/commit/af24092440f23f807554dcc63e3e45c3c73273bf))
- **plugin-chart-echarts:** Echarts Waterfall ([#17906](https://github.com/apache/superset/issues/17906)) ([17792a5](https://github.com/apache/superset/commit/17792a507c7245c9e09c6eb98a774f2ef4ec8568))
- Removes the preset-chart-xy plugin ([#23943](https://github.com/apache/superset/issues/23943)) ([e922f09](https://github.com/apache/superset/commit/e922f0993d31732f048eb4d638c67cd7fc18bdfa))
- **storybook:** Co-habitating/Upgrading Storybooks to v7 (dependency madness ensues) ([#26907](https://github.com/apache/superset/issues/26907)) ([753ef69](https://github.com/apache/superset/commit/753ef695294ce26238b68ff41ba0a9af6aea74de))
- **timeseries-chart:** add percentage threshold input control ([#17758](https://github.com/apache/superset/issues/17758)) ([6bd4dd2](https://github.com/apache/superset/commit/6bd4dd257a6089a093bae3f251cf9f0976d353e6))

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

**Note:** Version bump only for package @superset-ui/demo

## [0.17.63](https://github.com/apache-superset/superset-ui/compare/v0.17.62...v0.17.63) (2021-07-02)

**Note:** Version bump only for package @superset-ui/demo

## [0.17.62](https://github.com/apache-superset/superset-ui/compare/v0.17.61...v0.17.62) (2021-07-02)

**Note:** Version bump only for package @superset-ui/demo

## [0.17.61](https://github.com/apache-superset/superset-ui/compare/v0.17.60...v0.17.61) (2021-07-02)

**Note:** Version bump only for package @superset-ui/demo
