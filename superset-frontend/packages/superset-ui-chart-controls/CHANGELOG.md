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

- Adaptive formatting spelling ([#19359](https://github.com/apache-superset/superset-ui/issues/19359)) ([dc769a9](https://github.com/apache-superset/superset-ui/commit/dc769a9a34e9b6417447ee490ecd203ace0941d9))
- Address regression in main_dttm_col for non-dnd ([#20712](https://github.com/apache-superset/superset-ui/issues/20712)) ([a6abcd9](https://github.com/apache-superset/superset-ui/commit/a6abcd9ea8fac4a477b824adb367b4b5206a5d27))
- Alpha should not be able to edit datasets that they don't own ([#19854](https://github.com/apache-superset/superset-ui/issues/19854)) ([8b15b68](https://github.com/apache-superset/superset-ui/commit/8b15b68979bf033979fe7014ef2730095ae85120))
- annotation broken ([#20651](https://github.com/apache-superset/superset-ui/issues/20651)) ([7f918a4](https://github.com/apache-superset/superset-ui/commit/7f918a4ec0e162be13bf3fc0e2f15aaaa5450cec))
- BigQuery cannot accept Time Grain ([#21489](https://github.com/apache-superset/superset-ui/issues/21489)) ([33509ab](https://github.com/apache-superset/superset-ui/commit/33509ab7da384144d42d67dd8c6233b1be9c9fa0))
- Cannot re-order metrics by drag and drop ([#19876](https://github.com/apache-superset/superset-ui/issues/19876)) ([e4fca89](https://github.com/apache-superset/superset-ui/commit/e4fca89217fc52a31053470f1b4c91a56ed3f4e9))
- custom SQL in the XAxis ([#21847](https://github.com/apache-superset/superset-ui/issues/21847)) ([0a4ecca](https://github.com/apache-superset/superset-ui/commit/0a4ecca9f259e2ee9cff27a879f2a889f876c7d7))
- drop the first level of MultiIndex ([#19716](https://github.com/apache-superset/superset-ui/issues/19716)) ([9425dd2](https://github.com/apache-superset/superset-ui/commit/9425dd2cac42f1a92f621848c469cadcc483e757))
- **explore comma:** make that the comma can be added by removing it from token separators… ([#18926](https://github.com/apache-superset/superset-ui/issues/18926)) ([e7355b9](https://github.com/apache-superset/superset-ui/commit/e7355b9610d1371d1d3fca51c17d1999ca3ecef3))
- **explore:** Adhoc columns don't display correctly ([#20802](https://github.com/apache-superset/superset-ui/issues/20802)) ([af1bddf](https://github.com/apache-superset/superset-ui/commit/af1bddffad930efc0583b638716980db6747bfbc))
- **explore:** Change copy of cross filters checkbox ([#19646](https://github.com/apache-superset/superset-ui/issues/19646)) ([4a5dddf](https://github.com/apache-superset/superset-ui/commit/4a5dddf52d8191b002fa11add6baaee26bc3b1a7))
- **explore:** clean data when hidding control ([#19039](https://github.com/apache-superset/superset-ui/issues/19039)) ([0e29871](https://github.com/apache-superset/superset-ui/commit/0e29871493171b6a70f974d26f41b6797e5b5d5c))
- **explore:** Fix generic X-axis time grain disappearing ([#21484](https://github.com/apache-superset/superset-ui/issues/21484)) ([324e997](https://github.com/apache-superset/superset-ui/commit/324e9979fa968b07d0be2628cac9119c492dc9b6))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache-superset/superset-ui/issues/21315)) ([2285ebe](https://github.com/apache-superset/superset-ui/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- **explore:** support saving undefined time grain ([#22565](https://github.com/apache-superset/superset-ui/issues/22565)) ([a7a4561](https://github.com/apache-superset/superset-ui/commit/a7a4561550e06bad11ef6d5a50af1ae1af173790))
- hide time_grain when x_axis value is undefined ([#21464](https://github.com/apache-superset/superset-ui/issues/21464)) ([ae6d2cf](https://github.com/apache-superset/superset-ui/commit/ae6d2cf18dbf0fec78e577b0cad1881940796b50))
- local warning in the frontend development ([#17727](https://github.com/apache-superset/superset-ui/issues/17727)) ([142b5bc](https://github.com/apache-superset/superset-ui/commit/142b5bc506c81847e503e76e498c06e8321dffb1))
- number format should editable when AA in time comparison ([#19351](https://github.com/apache-superset/superset-ui/issues/19351)) ([e15573d](https://github.com/apache-superset/superset-ui/commit/e15573d4453f8432e2da1db86f2e9417666fb8b5))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache-superset/superset-ui/issues/19071)) ([0e0bece](https://github.com/apache-superset/superset-ui/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **plugin-chart-echarts:** [feature-parity] apply button of annotation layer doesn't work as expected ([#19761](https://github.com/apache-superset/superset-ui/issues/19761)) ([9f02ff6](https://github.com/apache-superset/superset-ui/commit/9f02ff656d63e537c06822657dcfc2ff46f70e67))
- **plugin-chart-echarts:** Apply temporary filters to Query B in explore ([#18998](https://github.com/apache-superset/superset-ui/issues/18998)) ([9f834e8](https://github.com/apache-superset/superset-ui/commit/9f834e8317dca7c71470c89e2c86bb35ca7ca39f))
- **plugin-chart-echarts:** boxplot throw error in the dashboard ([#21661](https://github.com/apache-superset/superset-ui/issues/21661)) ([61bd696](https://github.com/apache-superset/superset-ui/commit/61bd6962265d879e168f208854fc17b145b9e04d))
- **plugin-chart-echarts:** fix forecasts on verbose metrics ([#18252](https://github.com/apache-superset/superset-ui/issues/18252)) ([2929bb1](https://github.com/apache-superset/superset-ui/commit/2929bb1680d29e5fd1d3b351e3e2f86971a60b44))
- **plugin-chart-echarts:** support adhoc x-axis ([#20055](https://github.com/apache-superset/superset-ui/issues/20055)) ([b53daa9](https://github.com/apache-superset/superset-ui/commit/b53daa91ecf0e82fe219b498e907d0c3f3ca9ccb))
- **plugin-chart-pivot-table:** color weight of Conditional formatting metrics not work ([#20396](https://github.com/apache-superset/superset-ui/issues/20396)) ([1665403](https://github.com/apache-superset/superset-ui/commit/16654034849505109b638fd2a784dfb377238a0e))
- resample method shouldn't be freeform ([#21135](https://github.com/apache-superset/superset-ui/issues/21135)) ([fea68ef](https://github.com/apache-superset/superset-ui/commit/fea68ef23cd19853f6ceee42802ac3b4b1b05da0))
- Respecting max/min opacities, and adding tests. ([#20555](https://github.com/apache-superset/superset-ui/issues/20555)) ([ac8e502](https://github.com/apache-superset/superset-ui/commit/ac8e502228d1b247c1b56ee692c2cefade1bf1a9))
- revert [#21356](https://github.com/apache-superset/superset-ui/issues/21356)(able to sort bar on the bar chart V2) ([#21481](https://github.com/apache-superset/superset-ui/issues/21481)) ([1c0bff3](https://github.com/apache-superset/superset-ui/commit/1c0bff3dfb3649d219abe6a13d9018ded14f334f))
- Revert shared controls typing change. ([#22014](https://github.com/apache-superset/superset-ui/issues/22014)) ([4cbd70d](https://github.com/apache-superset/superset-ui/commit/4cbd70db34b140a026ef1a86a8ef0ba3355a350e))
- Reverts [#20749](https://github.com/apache-superset/superset-ui/issues/20749) and [#20645](https://github.com/apache-superset/superset-ui/issues/20645) ([#20796](https://github.com/apache-superset/superset-ui/issues/20796)) ([3311128](https://github.com/apache-superset/superset-ui/commit/3311128c5e6c5de2ea5d6a2dfeb01ea3179e9af8))
- **select:** make to consider the case sensitive in case of d3 format selector ([#19159](https://github.com/apache-superset/superset-ui/issues/19159)) ([d099f5e](https://github.com/apache-superset/superset-ui/commit/d099f5ed4ad6f5b553c7e3eedbc34cf5ad55eae7))
- **select:** select component sort functionality on certain options ([#17638](https://github.com/apache-superset/superset-ui/issues/17638)) ([f476ba2](https://github.com/apache-superset/superset-ui/commit/f476ba23a279cb87a94ad3075e035cad0ae264b6))
- should be able to remove selection from X-AXIS control ([#21371](https://github.com/apache-superset/superset-ui/issues/21371)) ([eb4ba5b](https://github.com/apache-superset/superset-ui/commit/eb4ba5b08975df2124057c25d3732ef68a0e880a))
- superset-ui/core codes coverage ([#20324](https://github.com/apache-superset/superset-ui/issues/20324)) ([d04357c](https://github.com/apache-superset/superset-ui/commit/d04357c47bec7bac49c602f3d2166375892200ad))
- time grain can't be removed in explore ([#21644](https://github.com/apache-superset/superset-ui/issues/21644)) ([4c17f0e](https://github.com/apache-superset/superset-ui/commit/4c17f0e71e05caa55410edb2317e084c52a25440))
- X Axis should be called Y Axis when using the Bar Chart V2 on Horizontal mode ([#20659](https://github.com/apache-superset/superset-ui/issues/20659)) ([c29261b](https://github.com/apache-superset/superset-ui/commit/c29261b63dee723f108b3404e29a498ecf8421f8))

### Features

- add Advanced Analytics into mixed time series chart ([#19851](https://github.com/apache-superset/superset-ui/issues/19851)) ([f5e9f0e](https://github.com/apache-superset/superset-ui/commit/f5e9f0eb3b2045a9d441f59cb3a6109892e6aea9))
- add renameOperator ([#19776](https://github.com/apache-superset/superset-ui/issues/19776)) ([3c28cd4](https://github.com/apache-superset/superset-ui/commit/3c28cd4625fdeeaeeac3ed730907af1fb86bc86e))
- adding truncate metric control on timeseries charts ([#20373](https://github.com/apache-superset/superset-ui/issues/20373)) ([7c252d7](https://github.com/apache-superset/superset-ui/commit/7c252d75240559d0bba9be3be8419b65b86967df))
- adding XAxis to BigNumberTrend ([#21577](https://github.com/apache-superset/superset-ui/issues/21577)) ([f4646f8](https://github.com/apache-superset/superset-ui/commit/f4646f8edba396dba24e6ff4fbc054d073d77fd7))
- **advanced analysis:** support MultiIndex column in post processing stage ([#19116](https://github.com/apache-superset/superset-ui/issues/19116)) ([375c03e](https://github.com/apache-superset/superset-ui/commit/375c03e08407570bcf417acf5f3d25b28843329c))
- **advanced analytics:** support groupby in resample ([#18045](https://github.com/apache-superset/superset-ui/issues/18045)) ([0c7f728](https://github.com/apache-superset/superset-ui/commit/0c7f7288d8cded5dc73d49d1e0be397e748d4f10))
- apply Time Grain to X-Axis column ([#21163](https://github.com/apache-superset/superset-ui/issues/21163)) ([ce3d38d](https://github.com/apache-superset/superset-ui/commit/ce3d38d2e72a56014fa96ee3d4afe066277cc5be))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache-superset/superset-ui/issues/21993)) ([22fab5e](https://github.com/apache-superset/superset-ui/commit/22fab5e58ce574e962518067d982e3036449e580))
- derived metrics use different line style ([#20242](https://github.com/apache-superset/superset-ui/issues/20242)) ([7faf874](https://github.com/apache-superset/superset-ui/commit/7faf874c1b9613258606fb10f5800a185c30c81e))
- drop missing columns control ([#20586](https://github.com/apache-superset/superset-ui/issues/20586)) ([309327d](https://github.com/apache-superset/superset-ui/commit/309327dcbdec954283ef6cd03fccf264a830e4a5))
- explicit distribute columns on BoxPlot and apply time grain ([#21593](https://github.com/apache-superset/superset-ui/issues/21593)) ([93f08e7](https://github.com/apache-superset/superset-ui/commit/93f08e778bfd48be150749f22d0b184467da73ac))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache-superset/superset-ui/issues/20524)) ([e12ee59](https://github.com/apache-superset/superset-ui/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- **explore:** Dataset panel option tooltips ([#19259](https://github.com/apache-superset/superset-ui/issues/19259)) ([45c28c8](https://github.com/apache-superset/superset-ui/commit/45c28c8046c56d4ebe1dfaf0235783fe864ae75f))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache-superset/superset-ui/issues/19855)) ([ba0c37d](https://github.com/apache-superset/superset-ui/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **explore:** Implement metrics and columns popovers empty states ([#18681](https://github.com/apache-superset/superset-ui/issues/18681)) ([c1205b5](https://github.com/apache-superset/superset-ui/commit/c1205b5279e891af8c3276ee2dd7343623e8cbb3))
- **explore:** improve UI in the control panel ([#19748](https://github.com/apache-superset/superset-ui/issues/19748)) ([e3a54aa](https://github.com/apache-superset/superset-ui/commit/e3a54aa3c15bdd0c970aa73f898288a408205c97))
- **explore:** SQL popover in datasource panel ([#19308](https://github.com/apache-superset/superset-ui/issues/19308)) ([60dcd65](https://github.com/apache-superset/superset-ui/commit/60dcd651f44b7e1aa1b030e0cd5c64334a346e60))
- **explore:** UI changes in dataset panel on Explore page ([#19394](https://github.com/apache-superset/superset-ui/issues/19394)) ([a076ae6](https://github.com/apache-superset/superset-ui/commit/a076ae6d9913a62d353d1cc2d4ed09e27ce9f6e2))
- **explore:** UX changes in fast viz switcher ([#20848](https://github.com/apache-superset/superset-ui/issues/20848)) ([5c2c2e8](https://github.com/apache-superset/superset-ui/commit/5c2c2e804064ba674ae18abe5aec495454b7ff21))
- generate consistent QueryObject whether GenericAxis is enabled or disabled ([#21519](https://github.com/apache-superset/superset-ui/issues/21519)) ([4d12e37](https://github.com/apache-superset/superset-ui/commit/4d12e3709eb7ab1cc4f687c15ed54a4738266482))
- improve color consistency (save all labels) ([#19038](https://github.com/apache-superset/superset-ui/issues/19038)) ([dc57508](https://github.com/apache-superset/superset-ui/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- **legacy-preset-chart-deckgl:** Add ,.1f and ,.2f value formats to deckgl charts ([#18945](https://github.com/apache-superset/superset-ui/issues/18945)) ([c56dc8e](https://github.com/apache-superset/superset-ui/commit/c56dc8eace6a71b45240d1bb6768d75661052a2e))
- linear imputation in Resample ([#19393](https://github.com/apache-superset/superset-ui/issues/19393)) ([a39dd44](https://github.com/apache-superset/superset-ui/commit/a39dd4493e8b40cc142451bc71e4d1d4f2705d3f))
- Move cross filters to Dashboard ([#22785](https://github.com/apache-superset/superset-ui/issues/22785)) ([9ed2326](https://github.com/apache-superset/superset-ui/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **plugin-chart-echarts:** [feature-parity] support extra control for the area chart V2 ([#16493](https://github.com/apache-superset/superset-ui/issues/16493)) ([eab0009](https://github.com/apache-superset/superset-ui/commit/eab0009101a295acf4d8d31df8a57f8fe0deb517))
- **plugin-chart-echarts:** able to sort bar on the bar chart V2 ([#21356](https://github.com/apache-superset/superset-ui/issues/21356)) ([59437ea](https://github.com/apache-superset/superset-ui/commit/59437ea6e7ec02267c6e03e174be39a6cae48893))
- **plugin-chart-echarts:** add support for generic axis to mixed chart ([#20097](https://github.com/apache-superset/superset-ui/issues/20097)) ([d5c5e58](https://github.com/apache-superset/superset-ui/commit/d5c5e58583771a35d8870ce3694b2a3f1b688159))
- **plugin-chart-echarts:** support horizontal bar chart ([#19918](https://github.com/apache-superset/superset-ui/issues/19918)) ([9854d2d](https://github.com/apache-superset/superset-ui/commit/9854d2d0e8f849366b264353819c6fdf4b0d804d))
- **plugin-chart-echarts:** support non-timeseries x-axis ([#17917](https://github.com/apache-superset/superset-ui/issues/17917)) ([e9651ea](https://github.com/apache-superset/superset-ui/commit/e9651ea52fdc0edb574bfb9dc1b22c225bcc068f)), closes [#18021](https://github.com/apache-superset/superset-ui/issues/18021) [#18039](https://github.com/apache-superset/superset-ui/issues/18039) [#17569](https://github.com/apache-superset/superset-ui/issues/17569) [#18037](https://github.com/apache-superset/superset-ui/issues/18037)
- **select:** keep options order when in single mode ([#19085](https://github.com/apache-superset/superset-ui/issues/19085)) ([ae13d83](https://github.com/apache-superset/superset-ui/commit/ae13d8313b5687374f5b24e02bccdcc717ba19eb))
- smart tooltip in datasourcepanel ([#18080](https://github.com/apache-superset/superset-ui/issues/18080)) ([aa21a96](https://github.com/apache-superset/superset-ui/commit/aa21a963a6137a1d29ad422c6d7bf79839bc7078))
- **standardized form data:** keep all columns and metrics ([#20377](https://github.com/apache-superset/superset-ui/issues/20377)) ([bbbe102](https://github.com/apache-superset/superset-ui/commit/bbbe102887a524b1ee0ffd4ada8481078dbe5496))
- standardized form_data ([#20010](https://github.com/apache-superset/superset-ui/issues/20010)) ([dd4b581](https://github.com/apache-superset/superset-ui/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- support mulitple temporal filters in AdhocFilter and move the Time Section away ([#21767](https://github.com/apache-superset/superset-ui/issues/21767)) ([a9b229d](https://github.com/apache-superset/superset-ui/commit/a9b229dd1dd9cb9dc8166b1392179fcccb4da138))
- support multiple time columns with time grain in Pivot Table v2 ([#21537](https://github.com/apache-superset/superset-ui/issues/21537)) ([e671d80](https://github.com/apache-superset/superset-ui/commit/e671d8020982111e117e7415dee41672cc32d780))
- truncate long values in table viz, a per-column setting ([#19383](https://github.com/apache-superset/superset-ui/issues/19383)) ([7e504ff](https://github.com/apache-superset/superset-ui/commit/7e504ff680698106cf9008b4c2814b01fcac90bb))
- update time comparison choices (again) ([#17968](https://github.com/apache-superset/superset-ui/issues/17968)) ([05d9cde](https://github.com/apache-superset/superset-ui/commit/05d9cde203b99f8c63106446f0be58668cc9f0c9))
- update time comparison choices (again) ([#22458](https://github.com/apache-superset/superset-ui/issues/22458)) ([9e81c3a](https://github.com/apache-superset/superset-ui/commit/9e81c3a1192a18226d505178d16e1e395917a719))
- **world-map:** support color by metric or country column ([#19881](https://github.com/apache-superset/superset-ui/issues/19881)) ([766f737](https://github.com/apache-superset/superset-ui/commit/766f737728c273d39a35dfa281e874a0efeabec3))

### Performance Improvements

- **plugin-chart-table:** Add memoization to avoid rerenders ([#19976](https://github.com/apache-superset/superset-ui/issues/19976)) ([0f68dee](https://github.com/apache-superset/superset-ui/commit/0f68deedf105300c8bd2536bd205d128799c0381))

# [0.19.0](https://github.com/apache-superset/superset-ui/compare/v2021.41.0...v0.19.0) (2023-04-18)

### Bug Fixes

- Adaptive formatting spelling ([#19359](https://github.com/apache-superset/superset-ui/issues/19359)) ([dc769a9](https://github.com/apache-superset/superset-ui/commit/dc769a9a34e9b6417447ee490ecd203ace0941d9))
- Address regression in main_dttm_col for non-dnd ([#20712](https://github.com/apache-superset/superset-ui/issues/20712)) ([a6abcd9](https://github.com/apache-superset/superset-ui/commit/a6abcd9ea8fac4a477b824adb367b4b5206a5d27))
- Alpha should not be able to edit datasets that they don't own ([#19854](https://github.com/apache-superset/superset-ui/issues/19854)) ([8b15b68](https://github.com/apache-superset/superset-ui/commit/8b15b68979bf033979fe7014ef2730095ae85120))
- annotation broken ([#20651](https://github.com/apache-superset/superset-ui/issues/20651)) ([7f918a4](https://github.com/apache-superset/superset-ui/commit/7f918a4ec0e162be13bf3fc0e2f15aaaa5450cec))
- BigQuery cannot accept Time Grain ([#21489](https://github.com/apache-superset/superset-ui/issues/21489)) ([33509ab](https://github.com/apache-superset/superset-ui/commit/33509ab7da384144d42d67dd8c6233b1be9c9fa0))
- Cannot re-order metrics by drag and drop ([#19876](https://github.com/apache-superset/superset-ui/issues/19876)) ([e4fca89](https://github.com/apache-superset/superset-ui/commit/e4fca89217fc52a31053470f1b4c91a56ed3f4e9))
- custom SQL in the XAxis ([#21847](https://github.com/apache-superset/superset-ui/issues/21847)) ([0a4ecca](https://github.com/apache-superset/superset-ui/commit/0a4ecca9f259e2ee9cff27a879f2a889f876c7d7))
- drop the first level of MultiIndex ([#19716](https://github.com/apache-superset/superset-ui/issues/19716)) ([9425dd2](https://github.com/apache-superset/superset-ui/commit/9425dd2cac42f1a92f621848c469cadcc483e757))
- **explore comma:** make that the comma can be added by removing it from token separators… ([#18926](https://github.com/apache-superset/superset-ui/issues/18926)) ([e7355b9](https://github.com/apache-superset/superset-ui/commit/e7355b9610d1371d1d3fca51c17d1999ca3ecef3))
- **explore:** Adhoc columns don't display correctly ([#20802](https://github.com/apache-superset/superset-ui/issues/20802)) ([af1bddf](https://github.com/apache-superset/superset-ui/commit/af1bddffad930efc0583b638716980db6747bfbc))
- **explore:** Change copy of cross filters checkbox ([#19646](https://github.com/apache-superset/superset-ui/issues/19646)) ([4a5dddf](https://github.com/apache-superset/superset-ui/commit/4a5dddf52d8191b002fa11add6baaee26bc3b1a7))
- **explore:** clean data when hidding control ([#19039](https://github.com/apache-superset/superset-ui/issues/19039)) ([0e29871](https://github.com/apache-superset/superset-ui/commit/0e29871493171b6a70f974d26f41b6797e5b5d5c))
- **explore:** Fix generic X-axis time grain disappearing ([#21484](https://github.com/apache-superset/superset-ui/issues/21484)) ([324e997](https://github.com/apache-superset/superset-ui/commit/324e9979fa968b07d0be2628cac9119c492dc9b6))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache-superset/superset-ui/issues/21315)) ([2285ebe](https://github.com/apache-superset/superset-ui/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- **explore:** support saving undefined time grain ([#22565](https://github.com/apache-superset/superset-ui/issues/22565)) ([a7a4561](https://github.com/apache-superset/superset-ui/commit/a7a4561550e06bad11ef6d5a50af1ae1af173790))
- hide time_grain when x_axis value is undefined ([#21464](https://github.com/apache-superset/superset-ui/issues/21464)) ([ae6d2cf](https://github.com/apache-superset/superset-ui/commit/ae6d2cf18dbf0fec78e577b0cad1881940796b50))
- local warning in the frontend development ([#17727](https://github.com/apache-superset/superset-ui/issues/17727)) ([142b5bc](https://github.com/apache-superset/superset-ui/commit/142b5bc506c81847e503e76e498c06e8321dffb1))
- number format should editable when AA in time comparison ([#19351](https://github.com/apache-superset/superset-ui/issues/19351)) ([e15573d](https://github.com/apache-superset/superset-ui/commit/e15573d4453f8432e2da1db86f2e9417666fb8b5))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache-superset/superset-ui/issues/19071)) ([0e0bece](https://github.com/apache-superset/superset-ui/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **plugin-chart-echarts:** [feature-parity] apply button of annotation layer doesn't work as expected ([#19761](https://github.com/apache-superset/superset-ui/issues/19761)) ([9f02ff6](https://github.com/apache-superset/superset-ui/commit/9f02ff656d63e537c06822657dcfc2ff46f70e67))
- **plugin-chart-echarts:** Apply temporary filters to Query B in explore ([#18998](https://github.com/apache-superset/superset-ui/issues/18998)) ([9f834e8](https://github.com/apache-superset/superset-ui/commit/9f834e8317dca7c71470c89e2c86bb35ca7ca39f))
- **plugin-chart-echarts:** boxplot throw error in the dashboard ([#21661](https://github.com/apache-superset/superset-ui/issues/21661)) ([61bd696](https://github.com/apache-superset/superset-ui/commit/61bd6962265d879e168f208854fc17b145b9e04d))
- **plugin-chart-echarts:** fix forecasts on verbose metrics ([#18252](https://github.com/apache-superset/superset-ui/issues/18252)) ([2929bb1](https://github.com/apache-superset/superset-ui/commit/2929bb1680d29e5fd1d3b351e3e2f86971a60b44))
- **plugin-chart-echarts:** support adhoc x-axis ([#20055](https://github.com/apache-superset/superset-ui/issues/20055)) ([b53daa9](https://github.com/apache-superset/superset-ui/commit/b53daa91ecf0e82fe219b498e907d0c3f3ca9ccb))
- **plugin-chart-pivot-table:** color weight of Conditional formatting metrics not work ([#20396](https://github.com/apache-superset/superset-ui/issues/20396)) ([1665403](https://github.com/apache-superset/superset-ui/commit/16654034849505109b638fd2a784dfb377238a0e))
- resample method shouldn't be freeform ([#21135](https://github.com/apache-superset/superset-ui/issues/21135)) ([fea68ef](https://github.com/apache-superset/superset-ui/commit/fea68ef23cd19853f6ceee42802ac3b4b1b05da0))
- Respecting max/min opacities, and adding tests. ([#20555](https://github.com/apache-superset/superset-ui/issues/20555)) ([ac8e502](https://github.com/apache-superset/superset-ui/commit/ac8e502228d1b247c1b56ee692c2cefade1bf1a9))
- revert [#21356](https://github.com/apache-superset/superset-ui/issues/21356)(able to sort bar on the bar chart V2) ([#21481](https://github.com/apache-superset/superset-ui/issues/21481)) ([1c0bff3](https://github.com/apache-superset/superset-ui/commit/1c0bff3dfb3649d219abe6a13d9018ded14f334f))
- Revert shared controls typing change. ([#22014](https://github.com/apache-superset/superset-ui/issues/22014)) ([4cbd70d](https://github.com/apache-superset/superset-ui/commit/4cbd70db34b140a026ef1a86a8ef0ba3355a350e))
- Reverts [#20749](https://github.com/apache-superset/superset-ui/issues/20749) and [#20645](https://github.com/apache-superset/superset-ui/issues/20645) ([#20796](https://github.com/apache-superset/superset-ui/issues/20796)) ([3311128](https://github.com/apache-superset/superset-ui/commit/3311128c5e6c5de2ea5d6a2dfeb01ea3179e9af8))
- **select:** make to consider the case sensitive in case of d3 format selector ([#19159](https://github.com/apache-superset/superset-ui/issues/19159)) ([d099f5e](https://github.com/apache-superset/superset-ui/commit/d099f5ed4ad6f5b553c7e3eedbc34cf5ad55eae7))
- **select:** select component sort functionality on certain options ([#17638](https://github.com/apache-superset/superset-ui/issues/17638)) ([f476ba2](https://github.com/apache-superset/superset-ui/commit/f476ba23a279cb87a94ad3075e035cad0ae264b6))
- should be able to remove selection from X-AXIS control ([#21371](https://github.com/apache-superset/superset-ui/issues/21371)) ([eb4ba5b](https://github.com/apache-superset/superset-ui/commit/eb4ba5b08975df2124057c25d3732ef68a0e880a))
- superset-ui/core codes coverage ([#20324](https://github.com/apache-superset/superset-ui/issues/20324)) ([d04357c](https://github.com/apache-superset/superset-ui/commit/d04357c47bec7bac49c602f3d2166375892200ad))
- time grain can't be removed in explore ([#21644](https://github.com/apache-superset/superset-ui/issues/21644)) ([4c17f0e](https://github.com/apache-superset/superset-ui/commit/4c17f0e71e05caa55410edb2317e084c52a25440))
- X Axis should be called Y Axis when using the Bar Chart V2 on Horizontal mode ([#20659](https://github.com/apache-superset/superset-ui/issues/20659)) ([c29261b](https://github.com/apache-superset/superset-ui/commit/c29261b63dee723f108b3404e29a498ecf8421f8))

### Features

- add Advanced Analytics into mixed time series chart ([#19851](https://github.com/apache-superset/superset-ui/issues/19851)) ([f5e9f0e](https://github.com/apache-superset/superset-ui/commit/f5e9f0eb3b2045a9d441f59cb3a6109892e6aea9))
- add renameOperator ([#19776](https://github.com/apache-superset/superset-ui/issues/19776)) ([3c28cd4](https://github.com/apache-superset/superset-ui/commit/3c28cd4625fdeeaeeac3ed730907af1fb86bc86e))
- adding truncate metric control on timeseries charts ([#20373](https://github.com/apache-superset/superset-ui/issues/20373)) ([7c252d7](https://github.com/apache-superset/superset-ui/commit/7c252d75240559d0bba9be3be8419b65b86967df))
- adding XAxis to BigNumberTrend ([#21577](https://github.com/apache-superset/superset-ui/issues/21577)) ([f4646f8](https://github.com/apache-superset/superset-ui/commit/f4646f8edba396dba24e6ff4fbc054d073d77fd7))
- **advanced analysis:** support MultiIndex column in post processing stage ([#19116](https://github.com/apache-superset/superset-ui/issues/19116)) ([375c03e](https://github.com/apache-superset/superset-ui/commit/375c03e08407570bcf417acf5f3d25b28843329c))
- **advanced analytics:** support groupby in resample ([#18045](https://github.com/apache-superset/superset-ui/issues/18045)) ([0c7f728](https://github.com/apache-superset/superset-ui/commit/0c7f7288d8cded5dc73d49d1e0be397e748d4f10))
- apply Time Grain to X-Axis column ([#21163](https://github.com/apache-superset/superset-ui/issues/21163)) ([ce3d38d](https://github.com/apache-superset/superset-ui/commit/ce3d38d2e72a56014fa96ee3d4afe066277cc5be))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache-superset/superset-ui/issues/21993)) ([22fab5e](https://github.com/apache-superset/superset-ui/commit/22fab5e58ce574e962518067d982e3036449e580))
- derived metrics use different line style ([#20242](https://github.com/apache-superset/superset-ui/issues/20242)) ([7faf874](https://github.com/apache-superset/superset-ui/commit/7faf874c1b9613258606fb10f5800a185c30c81e))
- drop missing columns control ([#20586](https://github.com/apache-superset/superset-ui/issues/20586)) ([309327d](https://github.com/apache-superset/superset-ui/commit/309327dcbdec954283ef6cd03fccf264a830e4a5))
- explicit distribute columns on BoxPlot and apply time grain ([#21593](https://github.com/apache-superset/superset-ui/issues/21593)) ([93f08e7](https://github.com/apache-superset/superset-ui/commit/93f08e778bfd48be150749f22d0b184467da73ac))
- **explore:** Apply denormalization to tier 2 charts form data ([#20524](https://github.com/apache-superset/superset-ui/issues/20524)) ([e12ee59](https://github.com/apache-superset/superset-ui/commit/e12ee59b13822241dca8d8015f1222c477edd4f3))
- **explore:** Dataset panel option tooltips ([#19259](https://github.com/apache-superset/superset-ui/issues/19259)) ([45c28c8](https://github.com/apache-superset/superset-ui/commit/45c28c8046c56d4ebe1dfaf0235783fe864ae75f))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache-superset/superset-ui/issues/19855)) ([ba0c37d](https://github.com/apache-superset/superset-ui/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **explore:** Implement metrics and columns popovers empty states ([#18681](https://github.com/apache-superset/superset-ui/issues/18681)) ([c1205b5](https://github.com/apache-superset/superset-ui/commit/c1205b5279e891af8c3276ee2dd7343623e8cbb3))
- **explore:** improve UI in the control panel ([#19748](https://github.com/apache-superset/superset-ui/issues/19748)) ([e3a54aa](https://github.com/apache-superset/superset-ui/commit/e3a54aa3c15bdd0c970aa73f898288a408205c97))
- **explore:** SQL popover in datasource panel ([#19308](https://github.com/apache-superset/superset-ui/issues/19308)) ([60dcd65](https://github.com/apache-superset/superset-ui/commit/60dcd651f44b7e1aa1b030e0cd5c64334a346e60))
- **explore:** UI changes in dataset panel on Explore page ([#19394](https://github.com/apache-superset/superset-ui/issues/19394)) ([a076ae6](https://github.com/apache-superset/superset-ui/commit/a076ae6d9913a62d353d1cc2d4ed09e27ce9f6e2))
- **explore:** UX changes in fast viz switcher ([#20848](https://github.com/apache-superset/superset-ui/issues/20848)) ([5c2c2e8](https://github.com/apache-superset/superset-ui/commit/5c2c2e804064ba674ae18abe5aec495454b7ff21))
- generate consistent QueryObject whether GenericAxis is enabled or disabled ([#21519](https://github.com/apache-superset/superset-ui/issues/21519)) ([4d12e37](https://github.com/apache-superset/superset-ui/commit/4d12e3709eb7ab1cc4f687c15ed54a4738266482))
- improve color consistency (save all labels) ([#19038](https://github.com/apache-superset/superset-ui/issues/19038)) ([dc57508](https://github.com/apache-superset/superset-ui/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- **legacy-preset-chart-deckgl:** Add ,.1f and ,.2f value formats to deckgl charts ([#18945](https://github.com/apache-superset/superset-ui/issues/18945)) ([c56dc8e](https://github.com/apache-superset/superset-ui/commit/c56dc8eace6a71b45240d1bb6768d75661052a2e))
- linear imputation in Resample ([#19393](https://github.com/apache-superset/superset-ui/issues/19393)) ([a39dd44](https://github.com/apache-superset/superset-ui/commit/a39dd4493e8b40cc142451bc71e4d1d4f2705d3f))
- Move cross filters to Dashboard ([#22785](https://github.com/apache-superset/superset-ui/issues/22785)) ([9ed2326](https://github.com/apache-superset/superset-ui/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **plugin-chart-echarts:** [feature-parity] support extra control for the area chart V2 ([#16493](https://github.com/apache-superset/superset-ui/issues/16493)) ([eab0009](https://github.com/apache-superset/superset-ui/commit/eab0009101a295acf4d8d31df8a57f8fe0deb517))
- **plugin-chart-echarts:** able to sort bar on the bar chart V2 ([#21356](https://github.com/apache-superset/superset-ui/issues/21356)) ([59437ea](https://github.com/apache-superset/superset-ui/commit/59437ea6e7ec02267c6e03e174be39a6cae48893))
- **plugin-chart-echarts:** add support for generic axis to mixed chart ([#20097](https://github.com/apache-superset/superset-ui/issues/20097)) ([d5c5e58](https://github.com/apache-superset/superset-ui/commit/d5c5e58583771a35d8870ce3694b2a3f1b688159))
- **plugin-chart-echarts:** support horizontal bar chart ([#19918](https://github.com/apache-superset/superset-ui/issues/19918)) ([9854d2d](https://github.com/apache-superset/superset-ui/commit/9854d2d0e8f849366b264353819c6fdf4b0d804d))
- **plugin-chart-echarts:** support non-timeseries x-axis ([#17917](https://github.com/apache-superset/superset-ui/issues/17917)) ([e9651ea](https://github.com/apache-superset/superset-ui/commit/e9651ea52fdc0edb574bfb9dc1b22c225bcc068f)), closes [#18021](https://github.com/apache-superset/superset-ui/issues/18021) [#18039](https://github.com/apache-superset/superset-ui/issues/18039) [#17569](https://github.com/apache-superset/superset-ui/issues/17569) [#18037](https://github.com/apache-superset/superset-ui/issues/18037)
- **select:** keep options order when in single mode ([#19085](https://github.com/apache-superset/superset-ui/issues/19085)) ([ae13d83](https://github.com/apache-superset/superset-ui/commit/ae13d8313b5687374f5b24e02bccdcc717ba19eb))
- smart tooltip in datasourcepanel ([#18080](https://github.com/apache-superset/superset-ui/issues/18080)) ([aa21a96](https://github.com/apache-superset/superset-ui/commit/aa21a963a6137a1d29ad422c6d7bf79839bc7078))
- **standardized form data:** keep all columns and metrics ([#20377](https://github.com/apache-superset/superset-ui/issues/20377)) ([bbbe102](https://github.com/apache-superset/superset-ui/commit/bbbe102887a524b1ee0ffd4ada8481078dbe5496))
- standardized form_data ([#20010](https://github.com/apache-superset/superset-ui/issues/20010)) ([dd4b581](https://github.com/apache-superset/superset-ui/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- support mulitple temporal filters in AdhocFilter and move the Time Section away ([#21767](https://github.com/apache-superset/superset-ui/issues/21767)) ([a9b229d](https://github.com/apache-superset/superset-ui/commit/a9b229dd1dd9cb9dc8166b1392179fcccb4da138))
- support multiple time columns with time grain in Pivot Table v2 ([#21537](https://github.com/apache-superset/superset-ui/issues/21537)) ([e671d80](https://github.com/apache-superset/superset-ui/commit/e671d8020982111e117e7415dee41672cc32d780))
- truncate long values in table viz, a per-column setting ([#19383](https://github.com/apache-superset/superset-ui/issues/19383)) ([7e504ff](https://github.com/apache-superset/superset-ui/commit/7e504ff680698106cf9008b4c2814b01fcac90bb))
- update time comparison choices (again) ([#17968](https://github.com/apache-superset/superset-ui/issues/17968)) ([05d9cde](https://github.com/apache-superset/superset-ui/commit/05d9cde203b99f8c63106446f0be58668cc9f0c9))
- update time comparison choices (again) ([#22458](https://github.com/apache-superset/superset-ui/issues/22458)) ([9e81c3a](https://github.com/apache-superset/superset-ui/commit/9e81c3a1192a18226d505178d16e1e395917a719))
- **world-map:** support color by metric or country column ([#19881](https://github.com/apache-superset/superset-ui/issues/19881)) ([766f737](https://github.com/apache-superset/superset-ui/commit/766f737728c273d39a35dfa281e874a0efeabec3))

### Performance Improvements

- **plugin-chart-table:** Add memoization to avoid rerenders ([#19976](https://github.com/apache-superset/superset-ui/issues/19976)) ([0f68dee](https://github.com/apache-superset/superset-ui/commit/0f68deedf105300c8bd2536bd205d128799c0381))

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

### Features

- add certified icon to columoption ([#1330](https://github.com/apache-superset/superset-ui/issues/1330)) ([a415c41](https://github.com/apache-superset/superset-ui/commit/a415c413954bc9c093ab5dfde62d458cf3224073))
