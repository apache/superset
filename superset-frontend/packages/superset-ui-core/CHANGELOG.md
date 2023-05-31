 <!-- * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License. -->

 # Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [2.1.0](https://github.com/apache-superset/superset-ui/compare/v2021.41.0...v2.1.0) (2023-04-18)

### Bug Fixes

- [sc-54864] Adds safety check to provide near term fix to save query ([#21034](https://github.com/apache-superset/superset-ui/issues/21034)) ([ab6ec89](https://github.com/apache-superset/superset-ui/commit/ab6ec89f680dbf022a39ed568c6fcdce0439b2dd))
- annotation broken ([#20651](https://github.com/apache-superset/superset-ui/issues/20651)) ([7f918a4](https://github.com/apache-superset/superset-ui/commit/7f918a4ec0e162be13bf3fc0e2f15aaaa5450cec))
- avoid while cycle in computeMaxFontSize for big Number run forever when css rule applied ([#20173](https://github.com/apache-superset/superset-ui/issues/20173)) ([365acee](https://github.com/apache-superset/superset-ui/commit/365acee663f7942ba7d8dfd0e4cf72c4cecb7a2d))
- BIGINT rendering regression in chartAction ([#21937](https://github.com/apache-superset/superset-ui/issues/21937)) ([4002406](https://github.com/apache-superset/superset-ui/commit/40024064ae35e596215a79d98ed8d0b4a90847f2))
- chart empty state & result panel when multiple queries are executed display incorrectly ([#20816](https://github.com/apache-superset/superset-ui/issues/20816)) ([279ab95](https://github.com/apache-superset/superset-ui/commit/279ab954b1977f7729442733a31c67715476a620))
- **charts:** Hide Values greater than Max Y Axis Bound on Mixed Time Series with Bar series ([#21015](https://github.com/apache-superset/superset-ui/issues/21015)) ([bdcc0a9](https://github.com/apache-superset/superset-ui/commit/bdcc0a9bcfff476bcd43edc84f08423d8f415d50))
- clean up chart metadata config ([#19143](https://github.com/apache-superset/superset-ui/issues/19143)) ([3d66912](https://github.com/apache-superset/superset-ui/commit/3d66912d89851f03c38803b29128a45d66b34cb6))
- **codecov:** improve core code coverage ([#20274](https://github.com/apache-superset/superset-ui/issues/20274)) ([5425504](https://github.com/apache-superset/superset-ui/commit/54255042310b9810c09fee25d475a4a1bc8f75de))
- core coverage and add a coverage step in workflow ([#20784](https://github.com/apache-superset/superset-ui/issues/20784)) ([9c7bcfc](https://github.com/apache-superset/superset-ui/commit/9c7bcfceadb1101899d6c09330aa8e79330d656f))
- custom SQL in the XAxis ([#21847](https://github.com/apache-superset/superset-ui/issues/21847)) ([0a4ecca](https://github.com/apache-superset/superset-ui/commit/0a4ecca9f259e2ee9cff27a879f2a889f876c7d7))
- **dashboard:** Add correct icon, label and badge to horizontal native filters dropdown button ([#22211](https://github.com/apache-superset/superset-ui/issues/22211)) ([435926b](https://github.com/apache-superset/superset-ui/commit/435926b89e08395f3017a32ea00f3de252fd4fb7))
- **dashboard:** Fix FilterWithDataMask typing and add null check ([#22260](https://github.com/apache-superset/superset-ui/issues/22260)) ([a642d12](https://github.com/apache-superset/superset-ui/commit/a642d126f8019d8f96cc206abfeda7ddc19eda7f))
- **dashboard:** Prevent XSS attack vector ([#21822](https://github.com/apache-superset/superset-ui/issues/21822)) ([ec20c01](https://github.com/apache-superset/superset-ui/commit/ec20c0104e6913cd9b2ab8bacae22eb25ae4cce1))
- Drill to detail on values with comma ([#21151](https://github.com/apache-superset/superset-ui/issues/21151)) ([0bf4e56](https://github.com/apache-superset/superset-ui/commit/0bf4e56dc3e129d2b9239f055212249ba95521e4))
- drilling on the categorical xaxis on the stacked barchart v2 ([#21844](https://github.com/apache-superset/superset-ui/issues/21844)) ([f41d0b0](https://github.com/apache-superset/superset-ui/commit/f41d0b0cbf47042bf510dc2b0b24b68e3fa11d37))
- drop the first level of MultiIndex ([#19716](https://github.com/apache-superset/superset-ui/issues/19716)) ([9425dd2](https://github.com/apache-superset/superset-ui/commit/9425dd2cac42f1a92f621848c469cadcc483e757))
- **embedded:** CSV download for chart ([#20261](https://github.com/apache-superset/superset-ui/issues/20261)) ([ab9f72f](https://github.com/apache-superset/superset-ui/commit/ab9f72f1a1359a59e64afd9e820d5823fd53b77b))
- **embedded:** Ensure guest token is passed to log endpoint ([#20647](https://github.com/apache-superset/superset-ui/issues/20647)) ([dfab521](https://github.com/apache-superset/superset-ui/commit/dfab521f50593b97fc778475498920552cad15dc))
- **embedded:** third party cookies ([#20019](https://github.com/apache-superset/superset-ui/issues/20019)) ([3e36d4a](https://github.com/apache-superset/superset-ui/commit/3e36d4a0a1d9e1a1d2d009b6b8db1042d3d37d8b))
- **explore:** Adhoc columns don't display correctly ([#20802](https://github.com/apache-superset/superset-ui/issues/20802)) ([af1bddf](https://github.com/apache-superset/superset-ui/commit/af1bddffad930efc0583b638716980db6747bfbc))
- **explore:** Filters with custom SQL disappearing ([#21114](https://github.com/apache-superset/superset-ui/issues/21114)) ([55304b0](https://github.com/apache-superset/superset-ui/commit/55304b02cd599827359cd13e3fe6ccb8581e0fd2))
- **Explore:** Pivot table V2 sort by failure with D&D enabled ([#18835](https://github.com/apache-superset/superset-ui/issues/18835)) ([eafe0cf](https://github.com/apache-superset/superset-ui/commit/eafe0cfc6f040670a9b35ebcd27f5c83eabe068e))
- Fix console errors about feature flags when running tests ([#21275](https://github.com/apache-superset/superset-ui/issues/21275)) ([742dbdd](https://github.com/apache-superset/superset-ui/commit/742dbdd0a5c0f0f75d56101b3551077ec06cd53f))
- invalid float number format by json-bigint ([#21968](https://github.com/apache-superset/superset-ui/issues/21968)) ([3bb9187](https://github.com/apache-superset/superset-ui/commit/3bb91877974650ab3fa82539a30dc0e2a7045dd7))
- invalid float number format by json-bigint ([#21996](https://github.com/apache-superset/superset-ui/issues/21996)) ([3a02339](https://github.com/apache-superset/superset-ui/commit/3a023392e6bfec9660449b7b739530574d2a8238))
- local warning in the frontend development ([#17727](https://github.com/apache-superset/superset-ui/issues/17727)) ([142b5bc](https://github.com/apache-superset/superset-ui/commit/142b5bc506c81847e503e76e498c06e8321dffb1))
- **nav:** infinite redirect and upload dataset nav permissions ([#19708](https://github.com/apache-superset/superset-ui/issues/19708)) ([32a9265](https://github.com/apache-superset/superset-ui/commit/32a9265cc0cb850910e55b6f49a73169fc7ed377))
- Only redirect to relative paths when authentication expires ([#18714](https://github.com/apache-superset/superset-ui/issues/18714)) ([8027f5f](https://github.com/apache-superset/superset-ui/commit/8027f5f0a63425c280121d671ae843e4c420793b))
- process color scheme configs correctly ([#17786](https://github.com/apache-superset/superset-ui/issues/17786)) ([de3d397](https://github.com/apache-superset/superset-ui/commit/de3d3973a249ab56b294d3f5d770a79fe8970abd))
- Redirect on 401 ([#17597](https://github.com/apache-superset/superset-ui/issues/17597)) ([46cdc77](https://github.com/apache-superset/superset-ui/commit/46cdc77ae64d0cc55a54719c748391b92a475a33))
- Redirect to full url on 401 ([#19357](https://github.com/apache-superset/superset-ui/issues/19357)) ([b8e5954](https://github.com/apache-superset/superset-ui/commit/b8e595413fa02b5f00c7b91df6283701a5f1b972))
- save dataset and repopulate state ([#20965](https://github.com/apache-superset/superset-ui/issues/20965)) ([463406f](https://github.com/apache-superset/superset-ui/commit/463406ff095375613bf0270343a4af53142c84d6))
- superset-ui/core code coverage ([#20676](https://github.com/apache-superset/superset-ui/issues/20676)) ([8d4994a](https://github.com/apache-superset/superset-ui/commit/8d4994a89900c2cf636444e4febad61ce3b69d68))
- superset-ui/core codes coverage ([#20324](https://github.com/apache-superset/superset-ui/issues/20324)) ([d04357c](https://github.com/apache-superset/superset-ui/commit/d04357c47bec7bac49c602f3d2166375892200ad))
- suppress translation warning in jest ([#20404](https://github.com/apache-superset/superset-ui/issues/20404)) ([9fad26f](https://github.com/apache-superset/superset-ui/commit/9fad26fa1919fceda4abdfce0b973d536b42b6af))
- Time Column on Generic X-axis ([#23021](https://github.com/apache-superset/superset-ui/issues/23021)) ([464ddee](https://github.com/apache-superset/superset-ui/commit/464ddee4b4164460193027645d87cb25e7b2320e))
- type of AnnotationLayer ([#21878](https://github.com/apache-superset/superset-ui/issues/21878)) ([f4a4ab4](https://github.com/apache-superset/superset-ui/commit/f4a4ab41e05be90b31ab2f9d2a0f23110bd5df21))
- Typing of labelMap ([#21181](https://github.com/apache-superset/superset-ui/issues/21181)) ([1143e17](https://github.com/apache-superset/superset-ui/commit/1143e17742d1fa4c4cbae2c86e4998f4cc7e9f88))
- typo on doc string ([#19346](https://github.com/apache-superset/superset-ui/issues/19346)) ([2af2d00](https://github.com/apache-superset/superset-ui/commit/2af2d00e852032e1d4eaaa50fd7e8d5415a1db16))

### Features

- a simple LRUCache in frontend ([#20842](https://github.com/apache-superset/superset-ui/issues/20842)) ([55a89df](https://github.com/apache-superset/superset-ui/commit/55a89dfac93f9855dbf1beb2ee0c0f21da54095b))
- add 'dashboard.nav.right' extension to registry ([#20835](https://github.com/apache-superset/superset-ui/issues/20835)) ([226712d](https://github.com/apache-superset/superset-ui/commit/226712d831a80cc44213c5ce8ed921518ea0397c))
- Add 3 new extension points for inserting custom icons ([#22027](https://github.com/apache-superset/superset-ui/issues/22027)) ([c870fbe](https://github.com/apache-superset/superset-ui/commit/c870fbe9e290e9305e6019bb4e9932bbd736b6dc))
- add extension point for workspace home page ([#21033](https://github.com/apache-superset/superset-ui/issues/21033)) ([83dd851](https://github.com/apache-superset/superset-ui/commit/83dd85166f917a5cff8c94d2b4d2c298182494b9))
- add extension point to the right side of the menu bar ([#20514](https://github.com/apache-superset/superset-ui/issues/20514)) ([f2af81b](https://github.com/apache-superset/superset-ui/commit/f2af81b1c74a56e6854039cfe5f32e9b035ce262))
- add extension point to the top of welcome page ([#20575](https://github.com/apache-superset/superset-ui/issues/20575)) ([2389871](https://github.com/apache-superset/superset-ui/commit/2389871556cde32c61bc694f09b4e7dbc5432af5))
- add renameOperator ([#19776](https://github.com/apache-superset/superset-ui/issues/19776)) ([3c28cd4](https://github.com/apache-superset/superset-ui/commit/3c28cd4625fdeeaeeac3ed730907af1fb86bc86e))
- add support for comments in adhoc clauses ([#19248](https://github.com/apache-superset/superset-ui/issues/19248)) ([f341025](https://github.com/apache-superset/superset-ui/commit/f341025d80aacf7345e7c20f8463231b9197ea58))
- Adds drill to detail context menu for ECharts visualizations ([#20891](https://github.com/apache-superset/superset-ui/issues/20891)) ([3df8335](https://github.com/apache-superset/superset-ui/commit/3df8335f8792c85d7e2f7fefa5dd60fb2c0befaf))
- Adds support to multiple dependencies to the native filters ([#18793](https://github.com/apache-superset/superset-ui/issues/18793)) ([06e1e42](https://github.com/apache-superset/superset-ui/commit/06e1e4285ea52d27f9b7b7dfea59f9652ee0dcfe))
- Adds the CROSS_REFERENCE feature flag ([#21708](https://github.com/apache-superset/superset-ui/issues/21708)) ([1cbf066](https://github.com/apache-superset/superset-ui/commit/1cbf0664152cef5d47720e1acffb955c328e291e))
- Adds the HORIZONTAL_FILTER_BAR feature flag ([#21935](https://github.com/apache-superset/superset-ui/issues/21935)) ([779d9f7](https://github.com/apache-superset/superset-ui/commit/779d9f75336ce38ab346e27dcb6a77e5a68cf823))
- **advanced analysis:** support MultiIndex column in post processing stage ([#19116](https://github.com/apache-superset/superset-ui/issues/19116)) ([375c03e](https://github.com/apache-superset/superset-ui/commit/375c03e08407570bcf417acf5f3d25b28843329c))
- **advanced analytics:** support groupby in resample ([#18045](https://github.com/apache-superset/superset-ui/issues/18045)) ([0c7f728](https://github.com/apache-superset/superset-ui/commit/0c7f7288d8cded5dc73d49d1e0be397e748d4f10))
- apply Time Grain to X-Axis column ([#21163](https://github.com/apache-superset/superset-ui/issues/21163)) ([ce3d38d](https://github.com/apache-superset/superset-ui/commit/ce3d38d2e72a56014fa96ee3d4afe066277cc5be))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache-superset/superset-ui/issues/21993)) ([22fab5e](https://github.com/apache-superset/superset-ui/commit/22fab5e58ce574e962518067d982e3036449e580))
- **business-types:** initial implementation of SIP-78 ([#18794](https://github.com/apache-superset/superset-ui/issues/18794)) ([ddc01ea](https://github.com/apache-superset/superset-ui/commit/ddc01ea7813ef7c02cfc2aee7cbf554a45628f25))
- **chart:** add feature flag that displays the data pane closes by default ([#21649](https://github.com/apache-superset/superset-ui/issues/21649)) ([ebd7536](https://github.com/apache-superset/superset-ui/commit/ebd75366c0c7acd6d4619996c4f209b51af518e2))
- **color:** color consistency enhancements ([#21507](https://github.com/apache-superset/superset-ui/issues/21507)) ([7a7181a](https://github.com/apache-superset/superset-ui/commit/7a7181a2449598b09298f3a113849caeb3309186))
- **color:** support analogous colors to prevent color conflict ([#19325](https://github.com/apache-superset/superset-ui/issues/19325)) ([90c9dae](https://github.com/apache-superset/superset-ui/commit/90c9daea08cd59ba7261c13e1ce4e80a72f84b48))
- **dashboard:** Add Drill to Detail modal w/ chart menu + right-click support ([#20728](https://github.com/apache-superset/superset-ui/issues/20728)) ([52648ec](https://github.com/apache-superset/superset-ui/commit/52648ecd7f6158473ec198e1ade9a5a69008b752))
- **dashboard:** confirm overwrite to prevent unintended changes ([#21819](https://github.com/apache-superset/superset-ui/issues/21819)) ([ef6b9a9](https://github.com/apache-superset/superset-ui/commit/ef6b9a97d594f748ab710e27281d41ee5250d33a))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache-superset/superset-ui/issues/21351)) ([76e57ec](https://github.com/apache-superset/superset-ui/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- **dashboard:** Transition to Explore with React Router ([#20606](https://github.com/apache-superset/superset-ui/issues/20606)) ([de4f7db](https://github.com/apache-superset/superset-ui/commit/de4f7db57ec33c497be9c880fde534a1f026241f))
- Dynamic dashboard component ([#17208](https://github.com/apache-superset/superset-ui/issues/17208)) ([bcad1ac](https://github.com/apache-superset/superset-ui/commit/bcad1acec27823756dc403f6e982f5e59ec6d6cf))
- embedded dashboard core ([#17530](https://github.com/apache-superset/superset-ui/issues/17530)) ([4ad5ad0](https://github.com/apache-superset/superset-ui/commit/4ad5ad045a9adb506d14b2c02fdbefc564d25bdb)), closes [#17175](https://github.com/apache-superset/superset-ui/issues/17175) [#17450](https://github.com/apache-superset/superset-ui/issues/17450) [#17517](https://github.com/apache-superset/superset-ui/issues/17517) [#17529](https://github.com/apache-superset/superset-ui/issues/17529) [#17757](https://github.com/apache-superset/superset-ui/issues/17757) [#17836](https://github.com/apache-superset/superset-ui/issues/17836)
- explicit distribute columns on BoxPlot and apply time grain ([#21593](https://github.com/apache-superset/superset-ui/issues/21593)) ([93f08e7](https://github.com/apache-superset/superset-ui/commit/93f08e778bfd48be150749f22d0b184467da73ac))
- **explore:** add config for default time filter ([#21879](https://github.com/apache-superset/superset-ui/issues/21879)) ([9a063ab](https://github.com/apache-superset/superset-ui/commit/9a063abb3b28e32b1107950942571d564bb283f8))
- **explore:** Don't discard controls with custom sql when changing datasource ([#20934](https://github.com/apache-superset/superset-ui/issues/20934)) ([cddc361](https://github.com/apache-superset/superset-ui/commit/cddc361adc483ed605857a2eb39c5efffa089076))
- **explore:** export csv data pivoted for Pivot Table [ID-9] ([#17512](https://github.com/apache-superset/superset-ui/issues/17512)) ([07e8837](https://github.com/apache-superset/superset-ui/commit/07e8837093b79b08e18224dd6765a2fc15a0e770))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache-superset/superset-ui/issues/19855)) ([ba0c37d](https://github.com/apache-superset/superset-ui/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **explore:** Implement chart empty states ([#18678](https://github.com/apache-superset/superset-ui/issues/18678)) ([167e18e](https://github.com/apache-superset/superset-ui/commit/167e18e806799dede3aa56da98be11f4751f0272))
- generate consistent QueryObject whether GenericAxis is enabled or disabled ([#21519](https://github.com/apache-superset/superset-ui/issues/21519)) ([4d12e37](https://github.com/apache-superset/superset-ui/commit/4d12e3709eb7ab1cc4f687c15ed54a4738266482))
- improve color consistency (save all labels) ([#19038](https://github.com/apache-superset/superset-ui/issues/19038)) ([dc57508](https://github.com/apache-superset/superset-ui/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- Improves SafeMarkdown HTML sanitization ([#21895](https://github.com/apache-superset/superset-ui/issues/21895)) ([7d1df3b](https://github.com/apache-superset/superset-ui/commit/7d1df3b78d5d7147dd9d627317e3f9f10d279ae0))
- Move cross filters to Dashboard ([#22785](https://github.com/apache-superset/superset-ui/issues/22785)) ([9ed2326](https://github.com/apache-superset/superset-ui/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **native-filters:** Adjust filter components for horizontal mode ([#22273](https://github.com/apache-superset/superset-ui/issues/22273)) ([eb6045a](https://github.com/apache-superset/superset-ui/commit/eb6045adfa77e06c8aaf3de217719ca59d4328e1))
- Pass dashboard context to explore through local storage ([#20743](https://github.com/apache-superset/superset-ui/issues/20743)) ([0945d4a](https://github.com/apache-superset/superset-ui/commit/0945d4a2f46667aebb9b93d0d7685215627ad237))
- **plugin-chart-echarts:** support non-timeseries x-axis ([#17917](https://github.com/apache-superset/superset-ui/issues/17917)) ([e9651ea](https://github.com/apache-superset/superset-ui/commit/e9651ea52fdc0edb574bfb9dc1b22c225bcc068f)), closes [#18021](https://github.com/apache-superset/superset-ui/issues/18021) [#18039](https://github.com/apache-superset/superset-ui/issues/18039) [#17569](https://github.com/apache-superset/superset-ui/issues/17569) [#18037](https://github.com/apache-superset/superset-ui/issues/18037)
- Programmatically open "more filters" dropdown in Horizontal Filter Bar ([#22276](https://github.com/apache-superset/superset-ui/issues/22276)) ([df91664](https://github.com/apache-superset/superset-ui/commit/df91664217b5369d1f742ce03596a366e18cd4b9))
- Reuse Dashboard redux data in Explore ([#20668](https://github.com/apache-superset/superset-ui/issues/20668)) ([ff5b4bc](https://github.com/apache-superset/superset-ui/commit/ff5b4bc0e47f057e0660d453a9e53f939613356b))
- root context provider extension point ([#22188](https://github.com/apache-superset/superset-ui/issues/22188)) ([aa97ba4](https://github.com/apache-superset/superset-ui/commit/aa97ba4509431a82922f2fa6930928093c876d6f))
- **select:** keep options order when in single mode ([#19085](https://github.com/apache-superset/superset-ui/issues/19085)) ([ae13d83](https://github.com/apache-superset/superset-ui/commit/ae13d8313b5687374f5b24e02bccdcc717ba19eb))
- **ssh_tunnel:** SQLAlchemy Form UI ([#22513](https://github.com/apache-superset/superset-ui/issues/22513)) ([5399365](https://github.com/apache-superset/superset-ui/commit/539936522fbbda46ebb39b65ed298f6e251a548f))
- **ssh_tunnel:** SSH Tunnel Switch extension ([#22967](https://github.com/apache-superset/superset-ui/issues/22967)) ([cf395ac](https://github.com/apache-superset/superset-ui/commit/cf395ac2d8e04782cffc93e8a0a0b28678c407fe))
- **superset-ui-core:** add feature flag for the analogous colors ([#19987](https://github.com/apache-superset/superset-ui/issues/19987)) ([80b5578](https://github.com/apache-superset/superset-ui/commit/80b55786809310e28566d745308b167f0e74b144))
- SupersetClient config to override 401 behavior ([#19144](https://github.com/apache-superset/superset-ui/issues/19144)) ([96a123f](https://github.com/apache-superset/superset-ui/commit/96a123f553f80ae7454daaf139b33e1397d9e3f7))
- support mulitple temporal filters in AdhocFilter and move the Time Section away ([#21767](https://github.com/apache-superset/superset-ui/issues/21767)) ([a9b229d](https://github.com/apache-superset/superset-ui/commit/a9b229dd1dd9cb9dc8166b1392179fcccb4da138))
- UI override registry ([#19671](https://github.com/apache-superset/superset-ui/issues/19671)) ([4927685](https://github.com/apache-superset/superset-ui/commit/4927685c3059c0207713bceeea7c60f1f3b75ec3))
- Visualize SqlLab.Query model data in Explore 📈 ([#20281](https://github.com/apache-superset/superset-ui/issues/20281)) ([e5e8867](https://github.com/apache-superset/superset-ui/commit/e5e886739460c011a885a13b873665410045a19c))
- **viz-gallery:** add 'feature' tag and fuzzy search weighting ([#18662](https://github.com/apache-superset/superset-ui/issues/18662)) ([7524e1e](https://github.com/apache-superset/superset-ui/commit/7524e1e3c86f3de2b3b0343c3ec5efc0b345937a))

### Performance Improvements

- **dashboard:** Virtualization POC ([#21438](https://github.com/apache-superset/superset-ui/issues/21438)) ([406e44b](https://github.com/apache-superset/superset-ui/commit/406e44bba11f6b233c3b07d29efd158b8cfc9615))
- **plugin-chart-table:** Add memoization to avoid rerenders ([#19976](https://github.com/apache-superset/superset-ui/issues/19976)) ([0f68dee](https://github.com/apache-superset/superset-ui/commit/0f68deedf105300c8bd2536bd205d128799c0381))

### Reverts

- Revert "feat: Reuse Dashboard redux data in Explore (#20668)" (#20689) ([5317462](https://github.com/apache-superset/superset-ui/commit/5317462b49d050d93d91eee5e97ec56e15f9f298)), closes [#20668](https://github.com/apache-superset/superset-ui/issues/20668) [#20689](https://github.com/apache-superset/superset-ui/issues/20689)

# [0.19.0](https://github.com/apache-superset/superset-ui/compare/v2021.41.0...v0.19.0) (2023-04-18)

### Bug Fixes

- [sc-54864] Adds safety check to provide near term fix to save query ([#21034](https://github.com/apache-superset/superset-ui/issues/21034)) ([ab6ec89](https://github.com/apache-superset/superset-ui/commit/ab6ec89f680dbf022a39ed568c6fcdce0439b2dd))
- annotation broken ([#20651](https://github.com/apache-superset/superset-ui/issues/20651)) ([7f918a4](https://github.com/apache-superset/superset-ui/commit/7f918a4ec0e162be13bf3fc0e2f15aaaa5450cec))
- avoid while cycle in computeMaxFontSize for big Number run forever when css rule applied ([#20173](https://github.com/apache-superset/superset-ui/issues/20173)) ([365acee](https://github.com/apache-superset/superset-ui/commit/365acee663f7942ba7d8dfd0e4cf72c4cecb7a2d))
- BIGINT rendering regression in chartAction ([#21937](https://github.com/apache-superset/superset-ui/issues/21937)) ([4002406](https://github.com/apache-superset/superset-ui/commit/40024064ae35e596215a79d98ed8d0b4a90847f2))
- chart empty state & result panel when multiple queries are executed display incorrectly ([#20816](https://github.com/apache-superset/superset-ui/issues/20816)) ([279ab95](https://github.com/apache-superset/superset-ui/commit/279ab954b1977f7729442733a31c67715476a620))
- **charts:** Hide Values greater than Max Y Axis Bound on Mixed Time Series with Bar series ([#21015](https://github.com/apache-superset/superset-ui/issues/21015)) ([bdcc0a9](https://github.com/apache-superset/superset-ui/commit/bdcc0a9bcfff476bcd43edc84f08423d8f415d50))
- clean up chart metadata config ([#19143](https://github.com/apache-superset/superset-ui/issues/19143)) ([3d66912](https://github.com/apache-superset/superset-ui/commit/3d66912d89851f03c38803b29128a45d66b34cb6))
- **codecov:** improve core code coverage ([#20274](https://github.com/apache-superset/superset-ui/issues/20274)) ([5425504](https://github.com/apache-superset/superset-ui/commit/54255042310b9810c09fee25d475a4a1bc8f75de))
- core coverage and add a coverage step in workflow ([#20784](https://github.com/apache-superset/superset-ui/issues/20784)) ([9c7bcfc](https://github.com/apache-superset/superset-ui/commit/9c7bcfceadb1101899d6c09330aa8e79330d656f))
- custom SQL in the XAxis ([#21847](https://github.com/apache-superset/superset-ui/issues/21847)) ([0a4ecca](https://github.com/apache-superset/superset-ui/commit/0a4ecca9f259e2ee9cff27a879f2a889f876c7d7))
- **dashboard:** Add correct icon, label and badge to horizontal native filters dropdown button ([#22211](https://github.com/apache-superset/superset-ui/issues/22211)) ([435926b](https://github.com/apache-superset/superset-ui/commit/435926b89e08395f3017a32ea00f3de252fd4fb7))
- **dashboard:** Fix FilterWithDataMask typing and add null check ([#22260](https://github.com/apache-superset/superset-ui/issues/22260)) ([a642d12](https://github.com/apache-superset/superset-ui/commit/a642d126f8019d8f96cc206abfeda7ddc19eda7f))
- **dashboard:** Prevent XSS attack vector ([#21822](https://github.com/apache-superset/superset-ui/issues/21822)) ([ec20c01](https://github.com/apache-superset/superset-ui/commit/ec20c0104e6913cd9b2ab8bacae22eb25ae4cce1))
- Drill to detail on values with comma ([#21151](https://github.com/apache-superset/superset-ui/issues/21151)) ([0bf4e56](https://github.com/apache-superset/superset-ui/commit/0bf4e56dc3e129d2b9239f055212249ba95521e4))
- drilling on the categorical xaxis on the stacked barchart v2 ([#21844](https://github.com/apache-superset/superset-ui/issues/21844)) ([f41d0b0](https://github.com/apache-superset/superset-ui/commit/f41d0b0cbf47042bf510dc2b0b24b68e3fa11d37))
- drop the first level of MultiIndex ([#19716](https://github.com/apache-superset/superset-ui/issues/19716)) ([9425dd2](https://github.com/apache-superset/superset-ui/commit/9425dd2cac42f1a92f621848c469cadcc483e757))
- **embedded:** CSV download for chart ([#20261](https://github.com/apache-superset/superset-ui/issues/20261)) ([ab9f72f](https://github.com/apache-superset/superset-ui/commit/ab9f72f1a1359a59e64afd9e820d5823fd53b77b))
- **embedded:** Ensure guest token is passed to log endpoint ([#20647](https://github.com/apache-superset/superset-ui/issues/20647)) ([dfab521](https://github.com/apache-superset/superset-ui/commit/dfab521f50593b97fc778475498920552cad15dc))
- **embedded:** third party cookies ([#20019](https://github.com/apache-superset/superset-ui/issues/20019)) ([3e36d4a](https://github.com/apache-superset/superset-ui/commit/3e36d4a0a1d9e1a1d2d009b6b8db1042d3d37d8b))
- **explore:** Adhoc columns don't display correctly ([#20802](https://github.com/apache-superset/superset-ui/issues/20802)) ([af1bddf](https://github.com/apache-superset/superset-ui/commit/af1bddffad930efc0583b638716980db6747bfbc))
- **explore:** Filters with custom SQL disappearing ([#21114](https://github.com/apache-superset/superset-ui/issues/21114)) ([55304b0](https://github.com/apache-superset/superset-ui/commit/55304b02cd599827359cd13e3fe6ccb8581e0fd2))
- **Explore:** Pivot table V2 sort by failure with D&D enabled ([#18835](https://github.com/apache-superset/superset-ui/issues/18835)) ([eafe0cf](https://github.com/apache-superset/superset-ui/commit/eafe0cfc6f040670a9b35ebcd27f5c83eabe068e))
- Fix console errors about feature flags when running tests ([#21275](https://github.com/apache-superset/superset-ui/issues/21275)) ([742dbdd](https://github.com/apache-superset/superset-ui/commit/742dbdd0a5c0f0f75d56101b3551077ec06cd53f))
- invalid float number format by json-bigint ([#21968](https://github.com/apache-superset/superset-ui/issues/21968)) ([3bb9187](https://github.com/apache-superset/superset-ui/commit/3bb91877974650ab3fa82539a30dc0e2a7045dd7))
- invalid float number format by json-bigint ([#21996](https://github.com/apache-superset/superset-ui/issues/21996)) ([3a02339](https://github.com/apache-superset/superset-ui/commit/3a023392e6bfec9660449b7b739530574d2a8238))
- local warning in the frontend development ([#17727](https://github.com/apache-superset/superset-ui/issues/17727)) ([142b5bc](https://github.com/apache-superset/superset-ui/commit/142b5bc506c81847e503e76e498c06e8321dffb1))
- **nav:** infinite redirect and upload dataset nav permissions ([#19708](https://github.com/apache-superset/superset-ui/issues/19708)) ([32a9265](https://github.com/apache-superset/superset-ui/commit/32a9265cc0cb850910e55b6f49a73169fc7ed377))
- Only redirect to relative paths when authentication expires ([#18714](https://github.com/apache-superset/superset-ui/issues/18714)) ([8027f5f](https://github.com/apache-superset/superset-ui/commit/8027f5f0a63425c280121d671ae843e4c420793b))
- process color scheme configs correctly ([#17786](https://github.com/apache-superset/superset-ui/issues/17786)) ([de3d397](https://github.com/apache-superset/superset-ui/commit/de3d3973a249ab56b294d3f5d770a79fe8970abd))
- Redirect on 401 ([#17597](https://github.com/apache-superset/superset-ui/issues/17597)) ([46cdc77](https://github.com/apache-superset/superset-ui/commit/46cdc77ae64d0cc55a54719c748391b92a475a33))
- Redirect to full url on 401 ([#19357](https://github.com/apache-superset/superset-ui/issues/19357)) ([b8e5954](https://github.com/apache-superset/superset-ui/commit/b8e595413fa02b5f00c7b91df6283701a5f1b972))
- save dataset and repopulate state ([#20965](https://github.com/apache-superset/superset-ui/issues/20965)) ([463406f](https://github.com/apache-superset/superset-ui/commit/463406ff095375613bf0270343a4af53142c84d6))
- superset-ui/core code coverage ([#20676](https://github.com/apache-superset/superset-ui/issues/20676)) ([8d4994a](https://github.com/apache-superset/superset-ui/commit/8d4994a89900c2cf636444e4febad61ce3b69d68))
- superset-ui/core codes coverage ([#20324](https://github.com/apache-superset/superset-ui/issues/20324)) ([d04357c](https://github.com/apache-superset/superset-ui/commit/d04357c47bec7bac49c602f3d2166375892200ad))
- suppress translation warning in jest ([#20404](https://github.com/apache-superset/superset-ui/issues/20404)) ([9fad26f](https://github.com/apache-superset/superset-ui/commit/9fad26fa1919fceda4abdfce0b973d536b42b6af))
- Time Column on Generic X-axis ([#23021](https://github.com/apache-superset/superset-ui/issues/23021)) ([464ddee](https://github.com/apache-superset/superset-ui/commit/464ddee4b4164460193027645d87cb25e7b2320e))
- type of AnnotationLayer ([#21878](https://github.com/apache-superset/superset-ui/issues/21878)) ([f4a4ab4](https://github.com/apache-superset/superset-ui/commit/f4a4ab41e05be90b31ab2f9d2a0f23110bd5df21))
- Typing of labelMap ([#21181](https://github.com/apache-superset/superset-ui/issues/21181)) ([1143e17](https://github.com/apache-superset/superset-ui/commit/1143e17742d1fa4c4cbae2c86e4998f4cc7e9f88))
- typo on doc string ([#19346](https://github.com/apache-superset/superset-ui/issues/19346)) ([2af2d00](https://github.com/apache-superset/superset-ui/commit/2af2d00e852032e1d4eaaa50fd7e8d5415a1db16))

### Features

- a simple LRUCache in frontend ([#20842](https://github.com/apache-superset/superset-ui/issues/20842)) ([55a89df](https://github.com/apache-superset/superset-ui/commit/55a89dfac93f9855dbf1beb2ee0c0f21da54095b))
- add 'dashboard.nav.right' extension to registry ([#20835](https://github.com/apache-superset/superset-ui/issues/20835)) ([226712d](https://github.com/apache-superset/superset-ui/commit/226712d831a80cc44213c5ce8ed921518ea0397c))
- Add 3 new extension points for inserting custom icons ([#22027](https://github.com/apache-superset/superset-ui/issues/22027)) ([c870fbe](https://github.com/apache-superset/superset-ui/commit/c870fbe9e290e9305e6019bb4e9932bbd736b6dc))
- add extension point for workspace home page ([#21033](https://github.com/apache-superset/superset-ui/issues/21033)) ([83dd851](https://github.com/apache-superset/superset-ui/commit/83dd85166f917a5cff8c94d2b4d2c298182494b9))
- add extension point to the right side of the menu bar ([#20514](https://github.com/apache-superset/superset-ui/issues/20514)) ([f2af81b](https://github.com/apache-superset/superset-ui/commit/f2af81b1c74a56e6854039cfe5f32e9b035ce262))
- add extension point to the top of welcome page ([#20575](https://github.com/apache-superset/superset-ui/issues/20575)) ([2389871](https://github.com/apache-superset/superset-ui/commit/2389871556cde32c61bc694f09b4e7dbc5432af5))
- add renameOperator ([#19776](https://github.com/apache-superset/superset-ui/issues/19776)) ([3c28cd4](https://github.com/apache-superset/superset-ui/commit/3c28cd4625fdeeaeeac3ed730907af1fb86bc86e))
- add support for comments in adhoc clauses ([#19248](https://github.com/apache-superset/superset-ui/issues/19248)) ([f341025](https://github.com/apache-superset/superset-ui/commit/f341025d80aacf7345e7c20f8463231b9197ea58))
- Adds drill to detail context menu for ECharts visualizations ([#20891](https://github.com/apache-superset/superset-ui/issues/20891)) ([3df8335](https://github.com/apache-superset/superset-ui/commit/3df8335f8792c85d7e2f7fefa5dd60fb2c0befaf))
- Adds support to multiple dependencies to the native filters ([#18793](https://github.com/apache-superset/superset-ui/issues/18793)) ([06e1e42](https://github.com/apache-superset/superset-ui/commit/06e1e4285ea52d27f9b7b7dfea59f9652ee0dcfe))
- Adds the CROSS_REFERENCE feature flag ([#21708](https://github.com/apache-superset/superset-ui/issues/21708)) ([1cbf066](https://github.com/apache-superset/superset-ui/commit/1cbf0664152cef5d47720e1acffb955c328e291e))
- Adds the HORIZONTAL_FILTER_BAR feature flag ([#21935](https://github.com/apache-superset/superset-ui/issues/21935)) ([779d9f7](https://github.com/apache-superset/superset-ui/commit/779d9f75336ce38ab346e27dcb6a77e5a68cf823))
- **advanced analysis:** support MultiIndex column in post processing stage ([#19116](https://github.com/apache-superset/superset-ui/issues/19116)) ([375c03e](https://github.com/apache-superset/superset-ui/commit/375c03e08407570bcf417acf5f3d25b28843329c))
- **advanced analytics:** support groupby in resample ([#18045](https://github.com/apache-superset/superset-ui/issues/18045)) ([0c7f728](https://github.com/apache-superset/superset-ui/commit/0c7f7288d8cded5dc73d49d1e0be397e748d4f10))
- apply Time Grain to X-Axis column ([#21163](https://github.com/apache-superset/superset-ui/issues/21163)) ([ce3d38d](https://github.com/apache-superset/superset-ui/commit/ce3d38d2e72a56014fa96ee3d4afe066277cc5be))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache-superset/superset-ui/issues/21993)) ([22fab5e](https://github.com/apache-superset/superset-ui/commit/22fab5e58ce574e962518067d982e3036449e580))
- **business-types:** initial implementation of SIP-78 ([#18794](https://github.com/apache-superset/superset-ui/issues/18794)) ([ddc01ea](https://github.com/apache-superset/superset-ui/commit/ddc01ea7813ef7c02cfc2aee7cbf554a45628f25))
- **chart:** add feature flag that displays the data pane closes by default ([#21649](https://github.com/apache-superset/superset-ui/issues/21649)) ([ebd7536](https://github.com/apache-superset/superset-ui/commit/ebd75366c0c7acd6d4619996c4f209b51af518e2))
- **color:** color consistency enhancements ([#21507](https://github.com/apache-superset/superset-ui/issues/21507)) ([7a7181a](https://github.com/apache-superset/superset-ui/commit/7a7181a2449598b09298f3a113849caeb3309186))
- **color:** support analogous colors to prevent color conflict ([#19325](https://github.com/apache-superset/superset-ui/issues/19325)) ([90c9dae](https://github.com/apache-superset/superset-ui/commit/90c9daea08cd59ba7261c13e1ce4e80a72f84b48))
- **dashboard:** Add Drill to Detail modal w/ chart menu + right-click support ([#20728](https://github.com/apache-superset/superset-ui/issues/20728)) ([52648ec](https://github.com/apache-superset/superset-ui/commit/52648ecd7f6158473ec198e1ade9a5a69008b752))
- **dashboard:** confirm overwrite to prevent unintended changes ([#21819](https://github.com/apache-superset/superset-ui/issues/21819)) ([ef6b9a9](https://github.com/apache-superset/superset-ui/commit/ef6b9a97d594f748ab710e27281d41ee5250d33a))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache-superset/superset-ui/issues/21351)) ([76e57ec](https://github.com/apache-superset/superset-ui/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- **dashboard:** Transition to Explore with React Router ([#20606](https://github.com/apache-superset/superset-ui/issues/20606)) ([de4f7db](https://github.com/apache-superset/superset-ui/commit/de4f7db57ec33c497be9c880fde534a1f026241f))
- Dynamic dashboard component ([#17208](https://github.com/apache-superset/superset-ui/issues/17208)) ([bcad1ac](https://github.com/apache-superset/superset-ui/commit/bcad1acec27823756dc403f6e982f5e59ec6d6cf))
- embedded dashboard core ([#17530](https://github.com/apache-superset/superset-ui/issues/17530)) ([4ad5ad0](https://github.com/apache-superset/superset-ui/commit/4ad5ad045a9adb506d14b2c02fdbefc564d25bdb)), closes [#17175](https://github.com/apache-superset/superset-ui/issues/17175) [#17450](https://github.com/apache-superset/superset-ui/issues/17450) [#17517](https://github.com/apache-superset/superset-ui/issues/17517) [#17529](https://github.com/apache-superset/superset-ui/issues/17529) [#17757](https://github.com/apache-superset/superset-ui/issues/17757) [#17836](https://github.com/apache-superset/superset-ui/issues/17836)
- explicit distribute columns on BoxPlot and apply time grain ([#21593](https://github.com/apache-superset/superset-ui/issues/21593)) ([93f08e7](https://github.com/apache-superset/superset-ui/commit/93f08e778bfd48be150749f22d0b184467da73ac))
- **explore:** add config for default time filter ([#21879](https://github.com/apache-superset/superset-ui/issues/21879)) ([9a063ab](https://github.com/apache-superset/superset-ui/commit/9a063abb3b28e32b1107950942571d564bb283f8))
- **explore:** Don't discard controls with custom sql when changing datasource ([#20934](https://github.com/apache-superset/superset-ui/issues/20934)) ([cddc361](https://github.com/apache-superset/superset-ui/commit/cddc361adc483ed605857a2eb39c5efffa089076))
- **explore:** export csv data pivoted for Pivot Table [ID-9] ([#17512](https://github.com/apache-superset/superset-ui/issues/17512)) ([07e8837](https://github.com/apache-superset/superset-ui/commit/07e8837093b79b08e18224dd6765a2fc15a0e770))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache-superset/superset-ui/issues/19855)) ([ba0c37d](https://github.com/apache-superset/superset-ui/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **explore:** Implement chart empty states ([#18678](https://github.com/apache-superset/superset-ui/issues/18678)) ([167e18e](https://github.com/apache-superset/superset-ui/commit/167e18e806799dede3aa56da98be11f4751f0272))
- generate consistent QueryObject whether GenericAxis is enabled or disabled ([#21519](https://github.com/apache-superset/superset-ui/issues/21519)) ([4d12e37](https://github.com/apache-superset/superset-ui/commit/4d12e3709eb7ab1cc4f687c15ed54a4738266482))
- improve color consistency (save all labels) ([#19038](https://github.com/apache-superset/superset-ui/issues/19038)) ([dc57508](https://github.com/apache-superset/superset-ui/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- Improves SafeMarkdown HTML sanitization ([#21895](https://github.com/apache-superset/superset-ui/issues/21895)) ([7d1df3b](https://github.com/apache-superset/superset-ui/commit/7d1df3b78d5d7147dd9d627317e3f9f10d279ae0))
- Move cross filters to Dashboard ([#22785](https://github.com/apache-superset/superset-ui/issues/22785)) ([9ed2326](https://github.com/apache-superset/superset-ui/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **native-filters:** Adjust filter components for horizontal mode ([#22273](https://github.com/apache-superset/superset-ui/issues/22273)) ([eb6045a](https://github.com/apache-superset/superset-ui/commit/eb6045adfa77e06c8aaf3de217719ca59d4328e1))
- Pass dashboard context to explore through local storage ([#20743](https://github.com/apache-superset/superset-ui/issues/20743)) ([0945d4a](https://github.com/apache-superset/superset-ui/commit/0945d4a2f46667aebb9b93d0d7685215627ad237))
- **plugin-chart-echarts:** support non-timeseries x-axis ([#17917](https://github.com/apache-superset/superset-ui/issues/17917)) ([e9651ea](https://github.com/apache-superset/superset-ui/commit/e9651ea52fdc0edb574bfb9dc1b22c225bcc068f)), closes [#18021](https://github.com/apache-superset/superset-ui/issues/18021) [#18039](https://github.com/apache-superset/superset-ui/issues/18039) [#17569](https://github.com/apache-superset/superset-ui/issues/17569) [#18037](https://github.com/apache-superset/superset-ui/issues/18037)
- Programmatically open "more filters" dropdown in Horizontal Filter Bar ([#22276](https://github.com/apache-superset/superset-ui/issues/22276)) ([df91664](https://github.com/apache-superset/superset-ui/commit/df91664217b5369d1f742ce03596a366e18cd4b9))
- Reuse Dashboard redux data in Explore ([#20668](https://github.com/apache-superset/superset-ui/issues/20668)) ([ff5b4bc](https://github.com/apache-superset/superset-ui/commit/ff5b4bc0e47f057e0660d453a9e53f939613356b))
- root context provider extension point ([#22188](https://github.com/apache-superset/superset-ui/issues/22188)) ([aa97ba4](https://github.com/apache-superset/superset-ui/commit/aa97ba4509431a82922f2fa6930928093c876d6f))
- **select:** keep options order when in single mode ([#19085](https://github.com/apache-superset/superset-ui/issues/19085)) ([ae13d83](https://github.com/apache-superset/superset-ui/commit/ae13d8313b5687374f5b24e02bccdcc717ba19eb))
- **ssh_tunnel:** SQLAlchemy Form UI ([#22513](https://github.com/apache-superset/superset-ui/issues/22513)) ([5399365](https://github.com/apache-superset/superset-ui/commit/539936522fbbda46ebb39b65ed298f6e251a548f))
- **ssh_tunnel:** SSH Tunnel Switch extension ([#22967](https://github.com/apache-superset/superset-ui/issues/22967)) ([cf395ac](https://github.com/apache-superset/superset-ui/commit/cf395ac2d8e04782cffc93e8a0a0b28678c407fe))
- **superset-ui-core:** add feature flag for the analogous colors ([#19987](https://github.com/apache-superset/superset-ui/issues/19987)) ([80b5578](https://github.com/apache-superset/superset-ui/commit/80b55786809310e28566d745308b167f0e74b144))
- SupersetClient config to override 401 behavior ([#19144](https://github.com/apache-superset/superset-ui/issues/19144)) ([96a123f](https://github.com/apache-superset/superset-ui/commit/96a123f553f80ae7454daaf139b33e1397d9e3f7))
- support mulitple temporal filters in AdhocFilter and move the Time Section away ([#21767](https://github.com/apache-superset/superset-ui/issues/21767)) ([a9b229d](https://github.com/apache-superset/superset-ui/commit/a9b229dd1dd9cb9dc8166b1392179fcccb4da138))
- UI override registry ([#19671](https://github.com/apache-superset/superset-ui/issues/19671)) ([4927685](https://github.com/apache-superset/superset-ui/commit/4927685c3059c0207713bceeea7c60f1f3b75ec3))
- Visualize SqlLab.Query model data in Explore 📈 ([#20281](https://github.com/apache-superset/superset-ui/issues/20281)) ([e5e8867](https://github.com/apache-superset/superset-ui/commit/e5e886739460c011a885a13b873665410045a19c))
- **viz-gallery:** add 'feature' tag and fuzzy search weighting ([#18662](https://github.com/apache-superset/superset-ui/issues/18662)) ([7524e1e](https://github.com/apache-superset/superset-ui/commit/7524e1e3c86f3de2b3b0343c3ec5efc0b345937a))

### Performance Improvements

- **dashboard:** Virtualization POC ([#21438](https://github.com/apache-superset/superset-ui/issues/21438)) ([406e44b](https://github.com/apache-superset/superset-ui/commit/406e44bba11f6b233c3b07d29efd158b8cfc9615))
- **plugin-chart-table:** Add memoization to avoid rerenders ([#19976](https://github.com/apache-superset/superset-ui/issues/19976)) ([0f68dee](https://github.com/apache-superset/superset-ui/commit/0f68deedf105300c8bd2536bd205d128799c0381))

### Reverts

- Revert "feat: Reuse Dashboard redux data in Explore (#20668)" (#20689) ([5317462](https://github.com/apache-superset/superset-ui/commit/5317462b49d050d93d91eee5e97ec56e15f9f298)), closes [#20668](https://github.com/apache-superset/superset-ui/issues/20668) [#20689](https://github.com/apache-superset/superset-ui/issues/20689)

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

**Note:** Version bump only for package @superset-ui/core
