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

- Allow empty CSS in Handlebars ([#22422](https://github.com/apache/superset/issues/22422)) ([bb318cb](https://github.com/apache/superset/commit/bb318cb137acd27009ddbe63ba4f8e0c37b754ca))
- explore warnings cleanup ([#20864](https://github.com/apache/superset/issues/20864)) ([5d107b8](https://github.com/apache/superset/commit/5d107b86abd1712571861e92f922ace57fb622ba))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- Force configuration for SafeMarkdown component in Handlebars ([#22417](https://github.com/apache/superset/issues/22417)) ([ebaa949](https://github.com/apache/superset/commit/ebaa94974b2fca41d21f1c0972c288e086525687))
- **plugin-chart-handlebars:** fix overflow, debounce and control reset ([#19879](https://github.com/apache/superset/issues/19879)) ([d5ea537](https://github.com/apache/superset/commit/d5ea537b0eb3e102677d63811b99cf2c4b31a3ab))
- **plugin-chart-handlebars:** Fix TypeError when using handlebars columns raw mode ([#23801](https://github.com/apache/superset/issues/23801)) ([422e21e](https://github.com/apache/superset/commit/422e21eb16bfbadc02b15d751b0357c729b55da2))
- **plugin-chart-handlebars:** order by control not work ([#21005](https://github.com/apache/superset/issues/21005)) ([e70699f](https://github.com/apache/superset/commit/e70699fb433849e07af81ea1812f20aa271d028e))

### Features

- Add currencies controls in control panels ([#24718](https://github.com/apache/superset/issues/24718)) ([f7e76d0](https://github.com/apache/superset/commit/f7e76d02b7cbe4940946673590bb979984ace9f5))
- Adds plugin-chart-handlebars ([#17903](https://github.com/apache/superset/issues/17903)) ([e632b82](https://github.com/apache/superset/commit/e632b82395bd379e2c4d42cb581972e6fe690a50))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache/superset/issues/20524)) ([e12ee59](https://github.com/apache/superset/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache/superset/issues/19855)) ([ba0c37d](https://github.com/apache/superset/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **handlebars plugin:** adding handlebars helpers for common math operations ([#20648](https://github.com/apache/superset/issues/20648)) ([9856d88](https://github.com/apache/superset/commit/9856d88c03c78a97f6037077e0d0e1e2bac491fe))
- Move cross filters to Dashboard ([#22785](https://github.com/apache/superset/issues/22785)) ([9ed2326](https://github.com/apache/superset/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- support mulitple temporal filters in AdhocFilter and move the Time Section away ([#21767](https://github.com/apache/superset/issues/21767)) ([a9b229d](https://github.com/apache/superset/commit/a9b229dd1dd9cb9dc8166b1392179fcccb4da138))

# [0.19.0](https://github.com/apache/superset/compare/v2021.41.0...v0.19.0) (2024-09-07)

### Bug Fixes

- Allow empty CSS in Handlebars ([#22422](https://github.com/apache/superset/issues/22422)) ([bb318cb](https://github.com/apache/superset/commit/bb318cb137acd27009ddbe63ba4f8e0c37b754ca))
- explore warnings cleanup ([#20864](https://github.com/apache/superset/issues/20864)) ([5d107b8](https://github.com/apache/superset/commit/5d107b86abd1712571861e92f922ace57fb622ba))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- Force configuration for SafeMarkdown component in Handlebars ([#22417](https://github.com/apache/superset/issues/22417)) ([ebaa949](https://github.com/apache/superset/commit/ebaa94974b2fca41d21f1c0972c288e086525687))
- **plugin-chart-handlebars:** fix overflow, debounce and control reset ([#19879](https://github.com/apache/superset/issues/19879)) ([d5ea537](https://github.com/apache/superset/commit/d5ea537b0eb3e102677d63811b99cf2c4b31a3ab))
- **plugin-chart-handlebars:** Fix TypeError when using handlebars columns raw mode ([#23801](https://github.com/apache/superset/issues/23801)) ([422e21e](https://github.com/apache/superset/commit/422e21eb16bfbadc02b15d751b0357c729b55da2))
- **plugin-chart-handlebars:** order by control not work ([#21005](https://github.com/apache/superset/issues/21005)) ([e70699f](https://github.com/apache/superset/commit/e70699fb433849e07af81ea1812f20aa271d028e))

### Features

- Add currencies controls in control panels ([#24718](https://github.com/apache/superset/issues/24718)) ([f7e76d0](https://github.com/apache/superset/commit/f7e76d02b7cbe4940946673590bb979984ace9f5))
- Adds plugin-chart-handlebars ([#17903](https://github.com/apache/superset/issues/17903)) ([e632b82](https://github.com/apache/superset/commit/e632b82395bd379e2c4d42cb581972e6fe690a50))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache/superset/issues/20524)) ([e12ee59](https://github.com/apache/superset/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache/superset/issues/19855)) ([ba0c37d](https://github.com/apache/superset/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **handlebars plugin:** adding handlebars helpers for common math operations ([#20648](https://github.com/apache/superset/issues/20648)) ([9856d88](https://github.com/apache/superset/commit/9856d88c03c78a97f6037077e0d0e1e2bac491fe))
- Move cross filters to Dashboard ([#22785](https://github.com/apache/superset/issues/22785)) ([9ed2326](https://github.com/apache/superset/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- support mulitple temporal filters in AdhocFilter and move the Time Section away ([#21767](https://github.com/apache/superset/issues/21767)) ([a9b229d](https://github.com/apache/superset/commit/a9b229dd1dd9cb9dc8166b1392179fcccb4da138))
