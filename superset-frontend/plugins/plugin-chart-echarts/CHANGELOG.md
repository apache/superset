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

- adjust timeseries grid right offset to match the rest ([#20933](https://github.com/apache-superset/superset-ui/issues/20933)) ([fe581a3](https://github.com/apache-superset/superset-ui/commit/fe581a36404ec1cfe689995b61a43164cb1988df))
- Allow comma in Number Format ([#21817](https://github.com/apache-superset/superset-ui/issues/21817)) ([383dc29](https://github.com/apache-superset/superset-ui/commit/383dc29ad1fb921ee618ed80b847316d77247886))
- annotation broken ([#20651](https://github.com/apache-superset/superset-ui/issues/20651)) ([7f918a4](https://github.com/apache-superset/superset-ui/commit/7f918a4ec0e162be13bf3fc0e2f15aaaa5450cec))
- **bar-chart-v2:** remove marker from bar chart V2 ([#20409](https://github.com/apache-superset/superset-ui/issues/20409)) ([b32288f](https://github.com/apache-superset/superset-ui/commit/b32288fddfc077d941452245a4e8002335746ba4))
- big number with trendline can't calculate cumsum ([#19542](https://github.com/apache-superset/superset-ui/issues/19542)) ([2daa071](https://github.com/apache-superset/superset-ui/commit/2daa07163326b8555488dab523c5479cf92821cf))
- **big number:** time grain control is useless in BigNumber Viz ([#21372](https://github.com/apache-superset/superset-ui/issues/21372)) ([b80f659](https://github.com/apache-superset/superset-ui/commit/b80f6591018858b709194687fe7ea3d244131761))
- **big-number:** big number gets cut off on a Dashboard ([#20488](https://github.com/apache-superset/superset-ui/issues/20488)) ([24a53c3](https://github.com/apache-superset/superset-ui/commit/24a53c38c68108c47af9f7685542fcb8378915bf))
- **big-number:** Big Number with Trendline Chart is not working if Time Grain is set to Month ([#19043](https://github.com/apache-superset/superset-ui/issues/19043)) ([c32eaf4](https://github.com/apache-superset/superset-ui/commit/c32eaf47e50f5fc0cb7630cbf38819cd03b5294b))
- categorical x-axis can't apply the label of column ([#21869](https://github.com/apache-superset/superset-ui/issues/21869)) ([9aa804e](https://github.com/apache-superset/superset-ui/commit/9aa804e070d9361df5e7dcde326ef16a769ac322))
- **chart & gallery:** make to add mixed time-series into recommended charts ([#20064](https://github.com/apache-superset/superset-ui/issues/20064)) ([f43dbc0](https://github.com/apache-superset/superset-ui/commit/f43dbc0dfdbd9ee21267229b566dfab8f59cd0db))
- chart empty state & result panel when multiple queries are executed display incorrectly ([#20816](https://github.com/apache-superset/superset-ui/issues/20816)) ([279ab95](https://github.com/apache-superset/superset-ui/commit/279ab954b1977f7729442733a31c67715476a620))
- **charts:** Hide Values greater than Max Y Axis Bound on Mixed Time Series with Bar series ([#21015](https://github.com/apache-superset/superset-ui/issues/21015)) ([bdcc0a9](https://github.com/apache-superset/superset-ui/commit/bdcc0a9bcfff476bcd43edc84f08423d8f415d50))
- **chart:** Time Series set showMaxLabel as null for time xAxis ([#20627](https://github.com/apache-superset/superset-ui/issues/20627)) ([9362e27](https://github.com/apache-superset/superset-ui/commit/9362e27ce2ace1803a975ab289fe2024fd195367))
- contribution operator meets nan value ([#18782](https://github.com/apache-superset/superset-ui/issues/18782)) ([987740a](https://github.com/apache-superset/superset-ui/commit/987740aa8dfff4bf771b587a40f1e12811453660))
- custom SQL in the XAxis ([#21847](https://github.com/apache-superset/superset-ui/issues/21847)) ([0a4ecca](https://github.com/apache-superset/superset-ui/commit/0a4ecca9f259e2ee9cff27a879f2a889f876c7d7))
- Drill to detail blocked by tooltip ([#22082](https://github.com/apache-superset/superset-ui/issues/22082)) ([3bc0865](https://github.com/apache-superset/superset-ui/commit/3bc0865d9071cdf32d268ee8fee4c4ad93680429))
- Drill to detail on values with comma ([#21151](https://github.com/apache-superset/superset-ui/issues/21151)) ([0bf4e56](https://github.com/apache-superset/superset-ui/commit/0bf4e56dc3e129d2b9239f055212249ba95521e4))
- drilling on the categorical xaxis on the mixed chart ([#21845](https://github.com/apache-superset/superset-ui/issues/21845)) ([f381154](https://github.com/apache-superset/superset-ui/commit/f38115489b09cb22bb77427bf73462784650cbaa))
- drilling on the categorical xaxis on the stacked barchart v2 ([#21844](https://github.com/apache-superset/superset-ui/issues/21844)) ([f41d0b0](https://github.com/apache-superset/superset-ui/commit/f41d0b0cbf47042bf510dc2b0b24b68e3fa11d37))
- **Explore:** Force different color for same metrics in Mixed Time-Series ([#18603](https://github.com/apache-superset/superset-ui/issues/18603)) ([f565230](https://github.com/apache-superset/superset-ui/commit/f565230d8d8342f7a51b263d2a0865122c8f756e))
- **explore:** make SORT-Descending visible if Sort-by has value ([#17726](https://github.com/apache-superset/superset-ui/issues/17726)) ([d5768ab](https://github.com/apache-superset/superset-ui/commit/d5768ab649a70fd4f541ad4982498f622160b220))
- **explore:** Pie chart label formatting when series is temporal ([#18216](https://github.com/apache-superset/superset-ui/issues/18216)) ([37430d4](https://github.com/apache-superset/superset-ui/commit/37430d404436b3d3833bfd9cbae602718c26c4a8))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache-superset/superset-ui/issues/21315)) ([2285ebe](https://github.com/apache-superset/superset-ui/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- **explore:** Time column label not formatted when GENERIC_X_AXES enabled ([#21294](https://github.com/apache-superset/superset-ui/issues/21294)) ([c3a00d4](https://github.com/apache-superset/superset-ui/commit/c3a00d43d055224d4a31ea9315934a59b556eea7))
- **explore:** Time comparison in Mixed Chart in GENERIC_CHART_AXES not working ([#22945](https://github.com/apache-superset/superset-ui/issues/22945)) ([ed7b353](https://github.com/apache-superset/superset-ui/commit/ed7b3533bcc119b2240a613ebc56ace33f1e1002))
- **generic-axes:** apply contribution before flatten ([#20077](https://github.com/apache-superset/superset-ui/issues/20077)) ([d5802f7](https://github.com/apache-superset/superset-ui/commit/d5802f78964a5027184ff9e7f6b78c14b04fd988))
- **generic-chart-axes:** set x-axis if unset and ff is enabled ([#20107](https://github.com/apache-superset/superset-ui/issues/20107)) ([0b3d3dd](https://github.com/apache-superset/superset-ui/commit/0b3d3dd4caa7f4c31c1ba7229966a40ba0469e85))
- **line-chart:** Formula Annotations on Line Charts are broken ([#20687](https://github.com/apache-superset/superset-ui/issues/20687)) ([acdb271](https://github.com/apache-superset/superset-ui/commit/acdb271422b937314d7175ac85eeeac5ead3bc16))
- lost renameOperator in mixed timeseries chart ([#19802](https://github.com/apache-superset/superset-ui/issues/19802)) ([108a2a4](https://github.com/apache-superset/superset-ui/commit/108a2a4eafc3150f7b7c33ed734e843a5d5c9f62))
- **Mixed Timeseries Chart:** Custom Metric Label ([#17649](https://github.com/apache-superset/superset-ui/issues/17649)) ([89d0d38](https://github.com/apache-superset/superset-ui/commit/89d0d38ed0eb211d44de8067bd091392a0f84f85))
- Null values on Treemap right-click ([#21722](https://github.com/apache-superset/superset-ui/issues/21722)) ([0ff1e49](https://github.com/apache-superset/superset-ui/commit/0ff1e49e3c720ed229f6a08daaa70bf14a053dca))
- pie chart orientation description error ([#21514](https://github.com/apache-superset/superset-ui/issues/21514)) ([c66205f](https://github.com/apache-superset/superset-ui/commit/c66205feac118a444e30cd6b6cb48d2c2e3d6411))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache-superset/superset-ui/issues/19071)) ([0e0bece](https://github.com/apache-superset/superset-ui/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **plugin-chart-echarts:** [feature parity] annotation line chart color not working ([#19758](https://github.com/apache-superset/superset-ui/issues/19758)) ([1156297](https://github.com/apache-superset/superset-ui/commit/11562971fb95a601d11b2902f1704b72409f302d))
- **plugin-chart-echarts:** [feature-parity] apply button of annotation layer doesn't work as expected ([#19761](https://github.com/apache-superset/superset-ui/issues/19761)) ([9f02ff6](https://github.com/apache-superset/superset-ui/commit/9f02ff656d63e537c06822657dcfc2ff46f70e67))
- **plugin-chart-echarts:** bar chart overflow ([#20805](https://github.com/apache-superset/superset-ui/issues/20805)) ([9bf7ed5](https://github.com/apache-superset/superset-ui/commit/9bf7ed58cdc1d5523d0cb661f8fdbf7df9b10fe7))
- **plugin-chart-echarts:** boxplot throw error in the dashboard ([#21661](https://github.com/apache-superset/superset-ui/issues/21661)) ([61bd696](https://github.com/apache-superset/superset-ui/commit/61bd6962265d879e168f208854fc17b145b9e04d))
- **plugin-chart-echarts:** fix customize margin ([#18958](https://github.com/apache-superset/superset-ui/issues/18958)) ([c4e3c45](https://github.com/apache-superset/superset-ui/commit/c4e3c45b3c24034205a1ceeb5387d63dc666a7fe))
- **plugin-chart-echarts:** fix forecasts on verbose metrics ([#18252](https://github.com/apache-superset/superset-ui/issues/18252)) ([2929bb1](https://github.com/apache-superset/superset-ui/commit/2929bb1680d29e5fd1d3b351e3e2f86971a60b44))
- **plugin-chart-echarts:** gauge chart enhancements and fixes ([#21007](https://github.com/apache-superset/superset-ui/issues/21007)) ([b303d1e](https://github.com/apache-superset/superset-ui/commit/b303d1e156185d134927246004a4804931cd6bca))
- **plugin-chart-echarts:** invalid total label location for negative values in stacked bar chart ([#21032](https://github.com/apache-superset/superset-ui/issues/21032)) ([a8ba544](https://github.com/apache-superset/superset-ui/commit/a8ba544e609ad3af449239c1fb956bb18c7066c4))
- **plugin-chart-echarts:** layout broken when resizing ([#20783](https://github.com/apache-superset/superset-ui/issues/20783)) ([d90b973](https://github.com/apache-superset/superset-ui/commit/d90b97323584dbd1602cccaa0aea6ac25f466038))
- **plugin-chart-echarts:** make to allow the custome of x & y axis title margin i… ([#18947](https://github.com/apache-superset/superset-ui/issues/18947)) ([c79ee56](https://github.com/apache-superset/superset-ui/commit/c79ee568849761d9c5793ce88f5b7aba8d9e7ac9))
- **plugin-chart-echarts:** missing value format in mixed timeseries ([#21044](https://github.com/apache-superset/superset-ui/issues/21044)) ([2d1ba46](https://github.com/apache-superset/superset-ui/commit/2d1ba468441b113c574d6fcc5984e8e09ddbc1c6))
- **plugin-chart-echarts:** show zero value in tooltip ([#21296](https://github.com/apache-superset/superset-ui/issues/21296)) ([1aeb8fd](https://github.com/apache-superset/superset-ui/commit/1aeb8fd6b78d5b53501d277f54b46a02f7067163))
- **plugin-chart-echarts:** support adhoc x-axis ([#20055](https://github.com/apache-superset/superset-ui/issues/20055)) ([b53daa9](https://github.com/apache-superset/superset-ui/commit/b53daa91ecf0e82fe219b498e907d0c3f3ca9ccb))
- **plugin-chart-echarts:** tooltip of big number truncated at then bottom ([#20029](https://github.com/apache-superset/superset-ui/issues/20029)) ([35e6e27](https://github.com/apache-superset/superset-ui/commit/35e6e2709c9dec3d9c08280489f42b5b6a8e632e))
- **plugin-chart-echarts:** tooltip overflow bug ([#22218](https://github.com/apache-superset/superset-ui/issues/22218)) ([2e650ea](https://github.com/apache-superset/superset-ui/commit/2e650eaebebc1197549636174f4c3945c55d4d5e))
- **plugin-chart-echarts:** use verbose x-axis name when defined ([#18217](https://github.com/apache-superset/superset-ui/issues/18217)) ([cec4677](https://github.com/apache-superset/superset-ui/commit/cec467797187324269971d870520b360c56419f3))
- **plugin-chart-echarts:** xAxis scale is not correct when setting quarter time grain ([#19686](https://github.com/apache-superset/superset-ui/issues/19686)) ([059cb4e](https://github.com/apache-superset/superset-ui/commit/059cb4ec25855b844a9c35be9b6c462595e90a5c))
- revert [#21356](https://github.com/apache-superset/superset-ui/issues/21356)(able to sort bar on the bar chart V2) ([#21481](https://github.com/apache-superset/superset-ui/issues/21481)) ([1c0bff3](https://github.com/apache-superset/superset-ui/commit/1c0bff3dfb3649d219abe6a13d9018ded14f334f))
- **treemap-v2:** color scheme not work when there is only one dimension ([#20671](https://github.com/apache-superset/superset-ui/issues/20671)) ([bd6037e](https://github.com/apache-superset/superset-ui/commit/bd6037ef50a579c9e9e3a133482670f6acb5fe5f))
- Typing of labelMap ([#21181](https://github.com/apache-superset/superset-ui/issues/21181)) ([1143e17](https://github.com/apache-superset/superset-ui/commit/1143e17742d1fa4c4cbae2c86e4998f4cc7e9f88))

### Features

- add Advanced Analytics into mixed time series chart ([#19851](https://github.com/apache-superset/superset-ui/issues/19851)) ([f5e9f0e](https://github.com/apache-superset/superset-ui/commit/f5e9f0eb3b2045a9d441f59cb3a6109892e6aea9))
- add renameOperator ([#19776](https://github.com/apache-superset/superset-ui/issues/19776)) ([3c28cd4](https://github.com/apache-superset/superset-ui/commit/3c28cd4625fdeeaeeac3ed730907af1fb86bc86e))
- adding truncate metric control on timeseries charts ([#20373](https://github.com/apache-superset/superset-ui/issues/20373)) ([7c252d7](https://github.com/apache-superset/superset-ui/commit/7c252d75240559d0bba9be3be8419b65b86967df))
- adding XAxis to BigNumberTrend ([#21577](https://github.com/apache-superset/superset-ui/issues/21577)) ([f4646f8](https://github.com/apache-superset/superset-ui/commit/f4646f8edba396dba24e6ff4fbc054d073d77fd7))
- Adds drill to detail context menu for ECharts visualizations ([#20891](https://github.com/apache-superset/superset-ui/issues/20891)) ([3df8335](https://github.com/apache-superset/superset-ui/commit/3df8335f8792c85d7e2f7fefa5dd60fb2c0befaf))
- Adds drill to detail context menu to Pivot Table ([#21198](https://github.com/apache-superset/superset-ui/issues/21198)) ([859b6d2](https://github.com/apache-superset/superset-ui/commit/859b6d2d20a58f2079c43bb66645fd3b604e077e))
- Adds the ECharts Sunburst chart ([#22833](https://github.com/apache-superset/superset-ui/issues/22833)) ([30abefb](https://github.com/apache-superset/superset-ui/commit/30abefb519978e2760a492de51dc0d19803edf3a))
- **advanced analysis:** support MultiIndex column in post processing stage ([#19116](https://github.com/apache-superset/superset-ui/issues/19116)) ([375c03e](https://github.com/apache-superset/superset-ui/commit/375c03e08407570bcf417acf5f3d25b28843329c))
- apply Time Grain to X-Axis column ([#21163](https://github.com/apache-superset/superset-ui/issues/21163)) ([ce3d38d](https://github.com/apache-superset/superset-ui/commit/ce3d38d2e72a56014fa96ee3d4afe066277cc5be))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache-superset/superset-ui/issues/21993)) ([22fab5e](https://github.com/apache-superset/superset-ui/commit/22fab5e58ce574e962518067d982e3036449e580))
- **chart & legend:** make to enable show legend by default ([#19927](https://github.com/apache-superset/superset-ui/issues/19927)) ([7b3d0f0](https://github.com/apache-superset/superset-ui/commit/7b3d0f040b050905f7d0901d0227f1cd6b761b56))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache-superset/superset-ui/issues/21351)) ([76e57ec](https://github.com/apache-superset/superset-ui/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- derived metrics use different line style ([#20242](https://github.com/apache-superset/superset-ui/issues/20242)) ([7faf874](https://github.com/apache-superset/superset-ui/commit/7faf874c1b9613258606fb10f5800a185c30c81e))
- explicit distribute columns on BoxPlot and apply time grain ([#21593](https://github.com/apache-superset/superset-ui/issues/21593)) ([93f08e7](https://github.com/apache-superset/superset-ui/commit/93f08e778bfd48be150749f22d0b184467da73ac))
- **explore:** Denormalize form data in echarts, world map and nvd3 bar and line charts ([#20313](https://github.com/apache-superset/superset-ui/issues/20313)) ([354a899](https://github.com/apache-superset/superset-ui/commit/354a89950c4d001da3e107f60788cea873bd6bf6))
- **explore:** improve UI in the control panel ([#19748](https://github.com/apache-superset/superset-ui/issues/19748)) ([e3a54aa](https://github.com/apache-superset/superset-ui/commit/e3a54aa3c15bdd0c970aa73f898288a408205c97))
- generate consistent QueryObject whether GenericAxis is enabled or disabled ([#21519](https://github.com/apache-superset/superset-ui/issues/21519)) ([4d12e37](https://github.com/apache-superset/superset-ui/commit/4d12e3709eb7ab1cc4f687c15ed54a4738266482))
- improve color consistency (save all labels) ([#19038](https://github.com/apache-superset/superset-ui/issues/19038)) ([dc57508](https://github.com/apache-superset/superset-ui/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- Move cross filters to Dashboard ([#22785](https://github.com/apache-superset/superset-ui/issues/22785)) ([9ed2326](https://github.com/apache-superset/superset-ui/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **plugin-chart-echarts:** [feature-parity] support extra control for the area chart V2 ([#16493](https://github.com/apache-superset/superset-ui/issues/16493)) ([eab0009](https://github.com/apache-superset/superset-ui/commit/eab0009101a295acf4d8d31df8a57f8fe0deb517))
- **plugin-chart-echarts:** able to sort bar on the bar chart V2 ([#21356](https://github.com/apache-superset/superset-ui/issues/21356)) ([59437ea](https://github.com/apache-superset/superset-ui/commit/59437ea6e7ec02267c6e03e174be39a6cae48893))
- **plugin-chart-echarts:** add aggregate total for the Pie/Donuct chart ([#19622](https://github.com/apache-superset/superset-ui/issues/19622)) ([a6bf041](https://github.com/apache-superset/superset-ui/commit/a6bf041eddcde0247461f35c806414df00ef105e))
- **plugin-chart-echarts:** add support for generic axis to mixed chart ([#20097](https://github.com/apache-superset/superset-ui/issues/20097)) ([d5c5e58](https://github.com/apache-superset/superset-ui/commit/d5c5e58583771a35d8870ce3694b2a3f1b688159))
- **plugin-chart-echarts:** support horizontal bar chart ([#19918](https://github.com/apache-superset/superset-ui/issues/19918)) ([9854d2d](https://github.com/apache-superset/superset-ui/commit/9854d2d0e8f849366b264353819c6fdf4b0d804d))
- **plugin-chart-echarts:** support non-timeseries x-axis ([#17917](https://github.com/apache-superset/superset-ui/issues/17917)) ([e9651ea](https://github.com/apache-superset/superset-ui/commit/e9651ea52fdc0edb574bfb9dc1b22c225bcc068f)), closes [#18021](https://github.com/apache-superset/superset-ui/issues/18021) [#18039](https://github.com/apache-superset/superset-ui/issues/18039) [#17569](https://github.com/apache-superset/superset-ui/issues/17569) [#18037](https://github.com/apache-superset/superset-ui/issues/18037)
- **plugin-chart-echarts:** Support stacking negative and positive values ([#20408](https://github.com/apache-superset/superset-ui/issues/20408)) ([c959d92](https://github.com/apache-superset/superset-ui/commit/c959d92dd17499e3fb7a0f4f02f3781516f3d3e6))
- **plugin-chart-echarts:** supports sunburst chart v2 [WIP] ([#21625](https://github.com/apache-superset/superset-ui/issues/21625)) ([b53941f](https://github.com/apache-superset/superset-ui/commit/b53941fb3eef7ab3936a0a3f16e22c921d946f53))
- setting limit value when Pie chart switches ([#20392](https://github.com/apache-superset/superset-ui/issues/20392)) ([0a50a9b](https://github.com/apache-superset/superset-ui/commit/0a50a9b3804837ea7130f91bfcfcca57ab50129f))
- **standardized form data:** keep all columns and metrics ([#20377](https://github.com/apache-superset/superset-ui/issues/20377)) ([bbbe102](https://github.com/apache-superset/superset-ui/commit/bbbe102887a524b1ee0ffd4ada8481078dbe5496))
- standardized form_data ([#20010](https://github.com/apache-superset/superset-ui/issues/20010)) ([dd4b581](https://github.com/apache-superset/superset-ui/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- **timeseries-chart:** add percentage threshold input control ([#17758](https://github.com/apache-superset/superset-ui/issues/17758)) ([6bd4dd2](https://github.com/apache-superset/superset-ui/commit/6bd4dd257a6089a093bae3f251cf9f0976d353e6))

### Reverts

- Revert "feat(plugin-chart-echarts): Support stacking negative and positive values (#20408)" (#20571) ([f5f8dde](https://github.com/apache-superset/superset-ui/commit/f5f8ddec3e5c947896521003295e1acd93851674)), closes [#20408](https://github.com/apache-superset/superset-ui/issues/20408) [#20571](https://github.com/apache-superset/superset-ui/issues/20571)

# [0.19.0](https://github.com/apache-superset/superset-ui/compare/v2021.41.0...v0.19.0) (2023-04-18)

### Bug Fixes

- adjust timeseries grid right offset to match the rest ([#20933](https://github.com/apache-superset/superset-ui/issues/20933)) ([fe581a3](https://github.com/apache-superset/superset-ui/commit/fe581a36404ec1cfe689995b61a43164cb1988df))
- Allow comma in Number Format ([#21817](https://github.com/apache-superset/superset-ui/issues/21817)) ([383dc29](https://github.com/apache-superset/superset-ui/commit/383dc29ad1fb921ee618ed80b847316d77247886))
- annotation broken ([#20651](https://github.com/apache-superset/superset-ui/issues/20651)) ([7f918a4](https://github.com/apache-superset/superset-ui/commit/7f918a4ec0e162be13bf3fc0e2f15aaaa5450cec))
- **bar-chart-v2:** remove marker from bar chart V2 ([#20409](https://github.com/apache-superset/superset-ui/issues/20409)) ([b32288f](https://github.com/apache-superset/superset-ui/commit/b32288fddfc077d941452245a4e8002335746ba4))
- big number with trendline can't calculate cumsum ([#19542](https://github.com/apache-superset/superset-ui/issues/19542)) ([2daa071](https://github.com/apache-superset/superset-ui/commit/2daa07163326b8555488dab523c5479cf92821cf))
- **big number:** time grain control is useless in BigNumber Viz ([#21372](https://github.com/apache-superset/superset-ui/issues/21372)) ([b80f659](https://github.com/apache-superset/superset-ui/commit/b80f6591018858b709194687fe7ea3d244131761))
- **big-number:** big number gets cut off on a Dashboard ([#20488](https://github.com/apache-superset/superset-ui/issues/20488)) ([24a53c3](https://github.com/apache-superset/superset-ui/commit/24a53c38c68108c47af9f7685542fcb8378915bf))
- **big-number:** Big Number with Trendline Chart is not working if Time Grain is set to Month ([#19043](https://github.com/apache-superset/superset-ui/issues/19043)) ([c32eaf4](https://github.com/apache-superset/superset-ui/commit/c32eaf47e50f5fc0cb7630cbf38819cd03b5294b))
- categorical x-axis can't apply the label of column ([#21869](https://github.com/apache-superset/superset-ui/issues/21869)) ([9aa804e](https://github.com/apache-superset/superset-ui/commit/9aa804e070d9361df5e7dcde326ef16a769ac322))
- **chart & gallery:** make to add mixed time-series into recommended charts ([#20064](https://github.com/apache-superset/superset-ui/issues/20064)) ([f43dbc0](https://github.com/apache-superset/superset-ui/commit/f43dbc0dfdbd9ee21267229b566dfab8f59cd0db))
- chart empty state & result panel when multiple queries are executed display incorrectly ([#20816](https://github.com/apache-superset/superset-ui/issues/20816)) ([279ab95](https://github.com/apache-superset/superset-ui/commit/279ab954b1977f7729442733a31c67715476a620))
- **charts:** Hide Values greater than Max Y Axis Bound on Mixed Time Series with Bar series ([#21015](https://github.com/apache-superset/superset-ui/issues/21015)) ([bdcc0a9](https://github.com/apache-superset/superset-ui/commit/bdcc0a9bcfff476bcd43edc84f08423d8f415d50))
- **chart:** Time Series set showMaxLabel as null for time xAxis ([#20627](https://github.com/apache-superset/superset-ui/issues/20627)) ([9362e27](https://github.com/apache-superset/superset-ui/commit/9362e27ce2ace1803a975ab289fe2024fd195367))
- contribution operator meets nan value ([#18782](https://github.com/apache-superset/superset-ui/issues/18782)) ([987740a](https://github.com/apache-superset/superset-ui/commit/987740aa8dfff4bf771b587a40f1e12811453660))
- custom SQL in the XAxis ([#21847](https://github.com/apache-superset/superset-ui/issues/21847)) ([0a4ecca](https://github.com/apache-superset/superset-ui/commit/0a4ecca9f259e2ee9cff27a879f2a889f876c7d7))
- Drill to detail blocked by tooltip ([#22082](https://github.com/apache-superset/superset-ui/issues/22082)) ([3bc0865](https://github.com/apache-superset/superset-ui/commit/3bc0865d9071cdf32d268ee8fee4c4ad93680429))
- Drill to detail on values with comma ([#21151](https://github.com/apache-superset/superset-ui/issues/21151)) ([0bf4e56](https://github.com/apache-superset/superset-ui/commit/0bf4e56dc3e129d2b9239f055212249ba95521e4))
- drilling on the categorical xaxis on the mixed chart ([#21845](https://github.com/apache-superset/superset-ui/issues/21845)) ([f381154](https://github.com/apache-superset/superset-ui/commit/f38115489b09cb22bb77427bf73462784650cbaa))
- drilling on the categorical xaxis on the stacked barchart v2 ([#21844](https://github.com/apache-superset/superset-ui/issues/21844)) ([f41d0b0](https://github.com/apache-superset/superset-ui/commit/f41d0b0cbf47042bf510dc2b0b24b68e3fa11d37))
- **Explore:** Force different color for same metrics in Mixed Time-Series ([#18603](https://github.com/apache-superset/superset-ui/issues/18603)) ([f565230](https://github.com/apache-superset/superset-ui/commit/f565230d8d8342f7a51b263d2a0865122c8f756e))
- **explore:** make SORT-Descending visible if Sort-by has value ([#17726](https://github.com/apache-superset/superset-ui/issues/17726)) ([d5768ab](https://github.com/apache-superset/superset-ui/commit/d5768ab649a70fd4f541ad4982498f622160b220))
- **explore:** Pie chart label formatting when series is temporal ([#18216](https://github.com/apache-superset/superset-ui/issues/18216)) ([37430d4](https://github.com/apache-superset/superset-ui/commit/37430d404436b3d3833bfd9cbae602718c26c4a8))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache-superset/superset-ui/issues/21315)) ([2285ebe](https://github.com/apache-superset/superset-ui/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- **explore:** Time column label not formatted when GENERIC_X_AXES enabled ([#21294](https://github.com/apache-superset/superset-ui/issues/21294)) ([c3a00d4](https://github.com/apache-superset/superset-ui/commit/c3a00d43d055224d4a31ea9315934a59b556eea7))
- **explore:** Time comparison in Mixed Chart in GENERIC_CHART_AXES not working ([#22945](https://github.com/apache-superset/superset-ui/issues/22945)) ([ed7b353](https://github.com/apache-superset/superset-ui/commit/ed7b3533bcc119b2240a613ebc56ace33f1e1002))
- **generic-axes:** apply contribution before flatten ([#20077](https://github.com/apache-superset/superset-ui/issues/20077)) ([d5802f7](https://github.com/apache-superset/superset-ui/commit/d5802f78964a5027184ff9e7f6b78c14b04fd988))
- **generic-chart-axes:** set x-axis if unset and ff is enabled ([#20107](https://github.com/apache-superset/superset-ui/issues/20107)) ([0b3d3dd](https://github.com/apache-superset/superset-ui/commit/0b3d3dd4caa7f4c31c1ba7229966a40ba0469e85))
- **line-chart:** Formula Annotations on Line Charts are broken ([#20687](https://github.com/apache-superset/superset-ui/issues/20687)) ([acdb271](https://github.com/apache-superset/superset-ui/commit/acdb271422b937314d7175ac85eeeac5ead3bc16))
- lost renameOperator in mixed timeseries chart ([#19802](https://github.com/apache-superset/superset-ui/issues/19802)) ([108a2a4](https://github.com/apache-superset/superset-ui/commit/108a2a4eafc3150f7b7c33ed734e843a5d5c9f62))
- **Mixed Timeseries Chart:** Custom Metric Label ([#17649](https://github.com/apache-superset/superset-ui/issues/17649)) ([89d0d38](https://github.com/apache-superset/superset-ui/commit/89d0d38ed0eb211d44de8067bd091392a0f84f85))
- Null values on Treemap right-click ([#21722](https://github.com/apache-superset/superset-ui/issues/21722)) ([0ff1e49](https://github.com/apache-superset/superset-ui/commit/0ff1e49e3c720ed229f6a08daaa70bf14a053dca))
- pie chart orientation description error ([#21514](https://github.com/apache-superset/superset-ui/issues/21514)) ([c66205f](https://github.com/apache-superset/superset-ui/commit/c66205feac118a444e30cd6b6cb48d2c2e3d6411))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache-superset/superset-ui/issues/19071)) ([0e0bece](https://github.com/apache-superset/superset-ui/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **plugin-chart-echarts:** [feature parity] annotation line chart color not working ([#19758](https://github.com/apache-superset/superset-ui/issues/19758)) ([1156297](https://github.com/apache-superset/superset-ui/commit/11562971fb95a601d11b2902f1704b72409f302d))
- **plugin-chart-echarts:** [feature-parity] apply button of annotation layer doesn't work as expected ([#19761](https://github.com/apache-superset/superset-ui/issues/19761)) ([9f02ff6](https://github.com/apache-superset/superset-ui/commit/9f02ff656d63e537c06822657dcfc2ff46f70e67))
- **plugin-chart-echarts:** bar chart overflow ([#20805](https://github.com/apache-superset/superset-ui/issues/20805)) ([9bf7ed5](https://github.com/apache-superset/superset-ui/commit/9bf7ed58cdc1d5523d0cb661f8fdbf7df9b10fe7))
- **plugin-chart-echarts:** boxplot throw error in the dashboard ([#21661](https://github.com/apache-superset/superset-ui/issues/21661)) ([61bd696](https://github.com/apache-superset/superset-ui/commit/61bd6962265d879e168f208854fc17b145b9e04d))
- **plugin-chart-echarts:** fix customize margin ([#18958](https://github.com/apache-superset/superset-ui/issues/18958)) ([c4e3c45](https://github.com/apache-superset/superset-ui/commit/c4e3c45b3c24034205a1ceeb5387d63dc666a7fe))
- **plugin-chart-echarts:** fix forecasts on verbose metrics ([#18252](https://github.com/apache-superset/superset-ui/issues/18252)) ([2929bb1](https://github.com/apache-superset/superset-ui/commit/2929bb1680d29e5fd1d3b351e3e2f86971a60b44))
- **plugin-chart-echarts:** gauge chart enhancements and fixes ([#21007](https://github.com/apache-superset/superset-ui/issues/21007)) ([b303d1e](https://github.com/apache-superset/superset-ui/commit/b303d1e156185d134927246004a4804931cd6bca))
- **plugin-chart-echarts:** invalid total label location for negative values in stacked bar chart ([#21032](https://github.com/apache-superset/superset-ui/issues/21032)) ([a8ba544](https://github.com/apache-superset/superset-ui/commit/a8ba544e609ad3af449239c1fb956bb18c7066c4))
- **plugin-chart-echarts:** layout broken when resizing ([#20783](https://github.com/apache-superset/superset-ui/issues/20783)) ([d90b973](https://github.com/apache-superset/superset-ui/commit/d90b97323584dbd1602cccaa0aea6ac25f466038))
- **plugin-chart-echarts:** make to allow the custome of x & y axis title margin i… ([#18947](https://github.com/apache-superset/superset-ui/issues/18947)) ([c79ee56](https://github.com/apache-superset/superset-ui/commit/c79ee568849761d9c5793ce88f5b7aba8d9e7ac9))
- **plugin-chart-echarts:** missing value format in mixed timeseries ([#21044](https://github.com/apache-superset/superset-ui/issues/21044)) ([2d1ba46](https://github.com/apache-superset/superset-ui/commit/2d1ba468441b113c574d6fcc5984e8e09ddbc1c6))
- **plugin-chart-echarts:** show zero value in tooltip ([#21296](https://github.com/apache-superset/superset-ui/issues/21296)) ([1aeb8fd](https://github.com/apache-superset/superset-ui/commit/1aeb8fd6b78d5b53501d277f54b46a02f7067163))
- **plugin-chart-echarts:** support adhoc x-axis ([#20055](https://github.com/apache-superset/superset-ui/issues/20055)) ([b53daa9](https://github.com/apache-superset/superset-ui/commit/b53daa91ecf0e82fe219b498e907d0c3f3ca9ccb))
- **plugin-chart-echarts:** tooltip of big number truncated at then bottom ([#20029](https://github.com/apache-superset/superset-ui/issues/20029)) ([35e6e27](https://github.com/apache-superset/superset-ui/commit/35e6e2709c9dec3d9c08280489f42b5b6a8e632e))
- **plugin-chart-echarts:** tooltip overflow bug ([#22218](https://github.com/apache-superset/superset-ui/issues/22218)) ([2e650ea](https://github.com/apache-superset/superset-ui/commit/2e650eaebebc1197549636174f4c3945c55d4d5e))
- **plugin-chart-echarts:** use verbose x-axis name when defined ([#18217](https://github.com/apache-superset/superset-ui/issues/18217)) ([cec4677](https://github.com/apache-superset/superset-ui/commit/cec467797187324269971d870520b360c56419f3))
- **plugin-chart-echarts:** xAxis scale is not correct when setting quarter time grain ([#19686](https://github.com/apache-superset/superset-ui/issues/19686)) ([059cb4e](https://github.com/apache-superset/superset-ui/commit/059cb4ec25855b844a9c35be9b6c462595e90a5c))
- revert [#21356](https://github.com/apache-superset/superset-ui/issues/21356)(able to sort bar on the bar chart V2) ([#21481](https://github.com/apache-superset/superset-ui/issues/21481)) ([1c0bff3](https://github.com/apache-superset/superset-ui/commit/1c0bff3dfb3649d219abe6a13d9018ded14f334f))
- **treemap-v2:** color scheme not work when there is only one dimension ([#20671](https://github.com/apache-superset/superset-ui/issues/20671)) ([bd6037e](https://github.com/apache-superset/superset-ui/commit/bd6037ef50a579c9e9e3a133482670f6acb5fe5f))
- Typing of labelMap ([#21181](https://github.com/apache-superset/superset-ui/issues/21181)) ([1143e17](https://github.com/apache-superset/superset-ui/commit/1143e17742d1fa4c4cbae2c86e4998f4cc7e9f88))

### Features

- add Advanced Analytics into mixed time series chart ([#19851](https://github.com/apache-superset/superset-ui/issues/19851)) ([f5e9f0e](https://github.com/apache-superset/superset-ui/commit/f5e9f0eb3b2045a9d441f59cb3a6109892e6aea9))
- add renameOperator ([#19776](https://github.com/apache-superset/superset-ui/issues/19776)) ([3c28cd4](https://github.com/apache-superset/superset-ui/commit/3c28cd4625fdeeaeeac3ed730907af1fb86bc86e))
- adding truncate metric control on timeseries charts ([#20373](https://github.com/apache-superset/superset-ui/issues/20373)) ([7c252d7](https://github.com/apache-superset/superset-ui/commit/7c252d75240559d0bba9be3be8419b65b86967df))
- adding XAxis to BigNumberTrend ([#21577](https://github.com/apache-superset/superset-ui/issues/21577)) ([f4646f8](https://github.com/apache-superset/superset-ui/commit/f4646f8edba396dba24e6ff4fbc054d073d77fd7))
- Adds drill to detail context menu for ECharts visualizations ([#20891](https://github.com/apache-superset/superset-ui/issues/20891)) ([3df8335](https://github.com/apache-superset/superset-ui/commit/3df8335f8792c85d7e2f7fefa5dd60fb2c0befaf))
- Adds drill to detail context menu to Pivot Table ([#21198](https://github.com/apache-superset/superset-ui/issues/21198)) ([859b6d2](https://github.com/apache-superset/superset-ui/commit/859b6d2d20a58f2079c43bb66645fd3b604e077e))
- Adds the ECharts Sunburst chart ([#22833](https://github.com/apache-superset/superset-ui/issues/22833)) ([30abefb](https://github.com/apache-superset/superset-ui/commit/30abefb519978e2760a492de51dc0d19803edf3a))
- **advanced analysis:** support MultiIndex column in post processing stage ([#19116](https://github.com/apache-superset/superset-ui/issues/19116)) ([375c03e](https://github.com/apache-superset/superset-ui/commit/375c03e08407570bcf417acf5f3d25b28843329c))
- apply Time Grain to X-Axis column ([#21163](https://github.com/apache-superset/superset-ui/issues/21163)) ([ce3d38d](https://github.com/apache-superset/superset-ui/commit/ce3d38d2e72a56014fa96ee3d4afe066277cc5be))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache-superset/superset-ui/issues/21993)) ([22fab5e](https://github.com/apache-superset/superset-ui/commit/22fab5e58ce574e962518067d982e3036449e580))
- **chart & legend:** make to enable show legend by default ([#19927](https://github.com/apache-superset/superset-ui/issues/19927)) ([7b3d0f0](https://github.com/apache-superset/superset-ui/commit/7b3d0f040b050905f7d0901d0227f1cd6b761b56))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache-superset/superset-ui/issues/21351)) ([76e57ec](https://github.com/apache-superset/superset-ui/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- derived metrics use different line style ([#20242](https://github.com/apache-superset/superset-ui/issues/20242)) ([7faf874](https://github.com/apache-superset/superset-ui/commit/7faf874c1b9613258606fb10f5800a185c30c81e))
- explicit distribute columns on BoxPlot and apply time grain ([#21593](https://github.com/apache-superset/superset-ui/issues/21593)) ([93f08e7](https://github.com/apache-superset/superset-ui/commit/93f08e778bfd48be150749f22d0b184467da73ac))
- **explore:** Denormalize form data in echarts, world map and nvd3 bar and line charts ([#20313](https://github.com/apache-superset/superset-ui/issues/20313)) ([354a899](https://github.com/apache-superset/superset-ui/commit/354a89950c4d001da3e107f60788cea873bd6bf6))
- **explore:** improve UI in the control panel ([#19748](https://github.com/apache-superset/superset-ui/issues/19748)) ([e3a54aa](https://github.com/apache-superset/superset-ui/commit/e3a54aa3c15bdd0c970aa73f898288a408205c97))
- generate consistent QueryObject whether GenericAxis is enabled or disabled ([#21519](https://github.com/apache-superset/superset-ui/issues/21519)) ([4d12e37](https://github.com/apache-superset/superset-ui/commit/4d12e3709eb7ab1cc4f687c15ed54a4738266482))
- improve color consistency (save all labels) ([#19038](https://github.com/apache-superset/superset-ui/issues/19038)) ([dc57508](https://github.com/apache-superset/superset-ui/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- Move cross filters to Dashboard ([#22785](https://github.com/apache-superset/superset-ui/issues/22785)) ([9ed2326](https://github.com/apache-superset/superset-ui/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **plugin-chart-echarts:** [feature-parity] support extra control for the area chart V2 ([#16493](https://github.com/apache-superset/superset-ui/issues/16493)) ([eab0009](https://github.com/apache-superset/superset-ui/commit/eab0009101a295acf4d8d31df8a57f8fe0deb517))
- **plugin-chart-echarts:** able to sort bar on the bar chart V2 ([#21356](https://github.com/apache-superset/superset-ui/issues/21356)) ([59437ea](https://github.com/apache-superset/superset-ui/commit/59437ea6e7ec02267c6e03e174be39a6cae48893))
- **plugin-chart-echarts:** add aggregate total for the Pie/Donuct chart ([#19622](https://github.com/apache-superset/superset-ui/issues/19622)) ([a6bf041](https://github.com/apache-superset/superset-ui/commit/a6bf041eddcde0247461f35c806414df00ef105e))
- **plugin-chart-echarts:** add support for generic axis to mixed chart ([#20097](https://github.com/apache-superset/superset-ui/issues/20097)) ([d5c5e58](https://github.com/apache-superset/superset-ui/commit/d5c5e58583771a35d8870ce3694b2a3f1b688159))
- **plugin-chart-echarts:** support horizontal bar chart ([#19918](https://github.com/apache-superset/superset-ui/issues/19918)) ([9854d2d](https://github.com/apache-superset/superset-ui/commit/9854d2d0e8f849366b264353819c6fdf4b0d804d))
- **plugin-chart-echarts:** support non-timeseries x-axis ([#17917](https://github.com/apache-superset/superset-ui/issues/17917)) ([e9651ea](https://github.com/apache-superset/superset-ui/commit/e9651ea52fdc0edb574bfb9dc1b22c225bcc068f)), closes [#18021](https://github.com/apache-superset/superset-ui/issues/18021) [#18039](https://github.com/apache-superset/superset-ui/issues/18039) [#17569](https://github.com/apache-superset/superset-ui/issues/17569) [#18037](https://github.com/apache-superset/superset-ui/issues/18037)
- **plugin-chart-echarts:** Support stacking negative and positive values ([#20408](https://github.com/apache-superset/superset-ui/issues/20408)) ([c959d92](https://github.com/apache-superset/superset-ui/commit/c959d92dd17499e3fb7a0f4f02f3781516f3d3e6))
- **plugin-chart-echarts:** supports sunburst chart v2 [WIP] ([#21625](https://github.com/apache-superset/superset-ui/issues/21625)) ([b53941f](https://github.com/apache-superset/superset-ui/commit/b53941fb3eef7ab3936a0a3f16e22c921d946f53))
- setting limit value when Pie chart switches ([#20392](https://github.com/apache-superset/superset-ui/issues/20392)) ([0a50a9b](https://github.com/apache-superset/superset-ui/commit/0a50a9b3804837ea7130f91bfcfcca57ab50129f))
- **standardized form data:** keep all columns and metrics ([#20377](https://github.com/apache-superset/superset-ui/issues/20377)) ([bbbe102](https://github.com/apache-superset/superset-ui/commit/bbbe102887a524b1ee0ffd4ada8481078dbe5496))
- standardized form_data ([#20010](https://github.com/apache-superset/superset-ui/issues/20010)) ([dd4b581](https://github.com/apache-superset/superset-ui/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- **timeseries-chart:** add percentage threshold input control ([#17758](https://github.com/apache-superset/superset-ui/issues/17758)) ([6bd4dd2](https://github.com/apache-superset/superset-ui/commit/6bd4dd257a6089a093bae3f251cf9f0976d353e6))

### Reverts

- Revert "feat(plugin-chart-echarts): Support stacking negative and positive values (#20408)" (#20571) ([f5f8dde](https://github.com/apache-superset/superset-ui/commit/f5f8ddec3e5c947896521003295e1acd93851674)), closes [#20408](https://github.com/apache-superset/superset-ui/issues/20408) [#20571](https://github.com/apache-superset/superset-ui/issues/20571)

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

**Note:** Version bump only for package @superset-ui/plugin-chart-echarts

## [0.17.63](https://github.com/apache-superset/superset-ui/compare/v0.17.62...v0.17.63) (2021-07-02)

**Note:** Version bump only for package @superset-ui/plugin-chart-echarts

## [0.17.61](https://github.com/apache-superset/superset-ui/compare/v0.17.60...v0.17.61) (2021-07-02)

### Bug Fixes

- **plugin-chart-echarts:** enable animation to clear old nodes ([#1200](https://github.com/apache-superset/superset-ui/issues/1200)) ([1ee7f4e](https://github.com/apache-superset/superset-ui/commit/1ee7f4e36e1245917e61999f190a84425e82ea38))
- **plugin-chart-echarts:** sanitize series from html tags ([#1126](https://github.com/apache-superset/superset-ui/issues/1126)) ([fcd6fde](https://github.com/apache-superset/superset-ui/commit/fcd6fde44bb45df3aab5ac5bb990504e7dbde324))
