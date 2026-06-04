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

- **accessibility:** Enable tabbing on sort header of table chart ([#26326](https://github.com/apache/superset/issues/26326)) ([b6d433d](https://github.com/apache/superset/commit/b6d433de32cad21c0866ee98fd5ae85b4459c23b))
- **chart & table:** make to allow highlight in case of numeric column ([#19938](https://github.com/apache/superset/issues/19938)) ([902ac05](https://github.com/apache/superset/commit/902ac053722ada89f817156a0af38ec03f27376c))
- **chart & table:** make to prevent dates from wrapping ([#20384](https://github.com/apache/superset/issues/20384)) ([1ae9353](https://github.com/apache/superset/commit/1ae935379fa8f1f5043205f218d7c1af93fae053))
- **chart table in dashboard:** improve screen reading of table ([#26453](https://github.com/apache/superset/issues/26453)) ([71a950f](https://github.com/apache/superset/commit/71a950fc803898393fbe1c0b370aaca438eeb38b))
- **chart-table:** Scrollbar causing header + footer overflow ([#21064](https://github.com/apache/superset/issues/21064)) ([2679ee2](https://github.com/apache/superset/commit/2679ee2e46edf53ab07c19e1186ce2877e159303))
- **conditional formatting:** controls looses on save ([#23137](https://github.com/apache/superset/issues/23137)) ([ce3ba67](https://github.com/apache/superset/commit/ce3ba67cf63e90059d94e2aa956982ad4ea44d1e))
- Currency formatting in Table raw mode ([#25248](https://github.com/apache/superset/issues/25248)) ([ea21e80](https://github.com/apache/superset/commit/ea21e800a799e7da0817f67cdae893be701569f5))
- Dashboard time grain in Table ([#24746](https://github.com/apache/superset/issues/24746)) ([317aa98](https://github.com/apache/superset/commit/317aa989c233160fcf4fe9ce3e5c1953634c5524))
- **Dashboard:** Add aria-label to filters and search forms ([#27968](https://github.com/apache/superset/issues/27968)) ([4202fba](https://github.com/apache/superset/commit/4202fba0f1da1d4f785c479c5972ee4dc4846e3d))
- **dashboard:** Allow selecting text in cells in Table and PivotTable without triggering cross filters ([#23283](https://github.com/apache/superset/issues/23283)) ([d16512b](https://github.com/apache/superset/commit/d16512b7758e36a1263fc63bd7d9d1f93060dc93))
- Dates alignment in Table viz ([#19668](https://github.com/apache/superset/issues/19668)) ([ed1309e](https://github.com/apache/superset/commit/ed1309e6bd9e8c0365794cf12bf4a272e540bbbd))
- Drill to detail formatted val on TableChart ([#21719](https://github.com/apache/superset/issues/21719)) ([eb2a134](https://github.com/apache/superset/commit/eb2a1345a87dae968d1357279e6056a76988bd01))
- explore warnings cleanup ([#20864](https://github.com/apache/superset/issues/20864)) ([5d107b8](https://github.com/apache/superset/commit/5d107b86abd1712571861e92f922ace57fb622ba))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- issue with sorting by multiple columns in a table ([#19920](https://github.com/apache/superset/issues/19920)) ([a45d011](https://github.com/apache/superset/commit/a45d011e74be7a52fee9b0e580187dd6f25509db))
- null dates in table chart ([#17974](https://github.com/apache/superset/issues/17974)) ([1e544ce](https://github.com/apache/superset/commit/1e544ce5316fad4b2c65127426c8aaffaf71fad3))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache/superset/issues/19071)) ([0e0bece](https://github.com/apache/superset/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **plugin-chart-table): Revert "fix(chart table in dashboard:** improve screen reading of table ([#26453](https://github.com/apache/superset/issues/26453))" ([#26963](https://github.com/apache/superset/issues/26963)) ([e4eae9a](https://github.com/apache/superset/commit/e4eae9a70c3f5b7c3fae984a017e72e912fbad93))
- **plugin-chart-table:** Include time control ([#23533](https://github.com/apache/superset/issues/23533)) ([13ffb4b](https://github.com/apache/superset/commit/13ffb4b7c203cfa8ebec602fc7c25103eebc019f))
- **plugin-chart-table:** Invalid d3Formatter on String column ([#23515](https://github.com/apache/superset/issues/23515)) ([5d910aa](https://github.com/apache/superset/commit/5d910aa2e248edcee055f715def9b02bc2c1d62b))
- **plugin-chart-table:** Prevent misalignment of totals and headers when scrollbar is visible ([#26964](https://github.com/apache/superset/issues/26964)) ([e6d2fb6](https://github.com/apache/superset/commit/e6d2fb6fdfa4d741de16b322bdc4bd01fb559413))
- **plugin-chart-table:** Resetting controls when switching query mode ([#19792](https://github.com/apache/superset/issues/19792)) ([fcc8080](https://github.com/apache/superset/commit/fcc8080ff3b99e2f5f5cdbd48335d7ab83aba16a))
- **plugin-chart-table:** sort alphanumeric columns case insensitive ([#17765](https://github.com/apache/superset/issues/17765)) ([82b47ca](https://github.com/apache/superset/commit/82b47cacba9653c7837c361be65e10520e9068b3))
- **plugins:** Fix dashboard filter for Table and Big Number with Time Comparison ([#29517](https://github.com/apache/superset/issues/29517)) ([9052f9f](https://github.com/apache/superset/commit/9052f9fbb4a17c8dc1e951a8d1b13bf92b29c8a8))
- **plugins:** missing currency on small number format in table chart ([#27041](https://github.com/apache/superset/issues/27041)) ([6f40299](https://github.com/apache/superset/commit/6f402991e54ae6ab0c6c98613d7e831c7f847f54))
- Position of arrows in Table chart ([#18739](https://github.com/apache/superset/issues/18739)) ([a9a8929](https://github.com/apache/superset/commit/a9a892945e6058c92c6e4f63255d799790a9bfa8))
- removing problematic "formattable" tag ([#24207](https://github.com/apache/superset/issues/24207)) ([cc68d62](https://github.com/apache/superset/commit/cc68d626bce46d1dcb8e8ee97f19919774c1ab86))
- row limits & row count labels are confusing ([#27700](https://github.com/apache/superset/issues/27700)) ([12fe292](https://github.com/apache/superset/commit/12fe2929a4a4b5627d9cff701a1e73644e78ac47))
- **select:** select component sort functionality on certain options ([#17638](https://github.com/apache/superset/issues/17638)) ([f476ba2](https://github.com/apache/superset/commit/f476ba23a279cb87a94ad3075e035cad0ae264b6))
- Show Totals error with sort and group by together ([#19072](https://github.com/apache/superset/issues/19072)) ([bc6aad0](https://github.com/apache/superset/commit/bc6aad0a88bbbbfd6c592f8813d1b72471788897))
- Table Autosizing Has Unnecessary Scroll Bars ([#19628](https://github.com/apache/superset/issues/19628)) ([9554135](https://github.com/apache/superset/commit/955413539b3edd892efd6bc069240efb5f5a29ac))
- **table chart:** Show Cell Bars correctly [#25625](https://github.com/apache/superset/issues/25625) ([#25707](https://github.com/apache/superset/issues/25707)) ([916f7bc](https://github.com/apache/superset/commit/916f7bcbbae6786bc6320f31b8e5af49ad119ac9))
- Table sorting reset ([#23318](https://github.com/apache/superset/issues/23318)) ([da3791a](https://github.com/apache/superset/commit/da3791ad3daa209631a588394600d1a8b635e814))
- table viz sort icon bottom aligned ([#20447](https://github.com/apache/superset/issues/20447)) ([93774d1](https://github.com/apache/superset/commit/93774d1860fd40dfee1f18e2787d9d0b79b551e2))
- **table-chart:** don't color empty cells in table chart with color formatters ([#21501](https://github.com/apache/superset/issues/21501)) ([60bab42](https://github.com/apache/superset/commit/60bab4269f1a0ebd42c85aab1ecd8c34ae1b9448))
- **table:** condition formatting can't formate 0 values ([#24008](https://github.com/apache/superset/issues/24008)) ([0d5be8e](https://github.com/apache/superset/commit/0d5be8e3f6c0b1ca62bf52fe933bc516d2f509e0))
- **table:** Double percenting ad-hoc percentage metrics ([#25857](https://github.com/apache/superset/issues/25857)) ([784a478](https://github.com/apache/superset/commit/784a478268fd89e6e58077e99bb2010987d6b07c))
- **table:** percentage metric should use verbose map ([#24158](https://github.com/apache/superset/issues/24158)) ([febc07a](https://github.com/apache/superset/commit/febc07aec361d80056195c001d26084e3a0b9363))
- **trino:** normalize non-iso timestamps ([#23339](https://github.com/apache/superset/issues/23339)) ([a591130](https://github.com/apache/superset/commit/a591130e0bd3c817af9ad937f63f1af1fce90740))

### Features

- Add currencies controls in control panels ([#24718](https://github.com/apache/superset/issues/24718)) ([f7e76d0](https://github.com/apache/superset/commit/f7e76d02b7cbe4940946673590bb979984ace9f5))
- add drag and drop column rearrangement for table viz ([#19381](https://github.com/apache/superset/issues/19381)) ([7e9b85f](https://github.com/apache/superset/commit/7e9b85f76ca8cae38c38e11f857634216b1cd71c))
- add option to disable rendering of html in sql lab and table chart ([#27969](https://github.com/apache/superset/issues/27969)) ([4f363e1](https://github.com/apache/superset/commit/4f363e11801572e7737b9c475bba58bd0a5dbca8))
- Adds drill to detail context menu to Table ([#21168](https://github.com/apache/superset/issues/21168)) ([68fa4d2](https://github.com/apache/superset/commit/68fa4d2665cc0742b2194533271ce562a3ebbf14))
- Adds the Featured Charts dashboard ([#28789](https://github.com/apache/superset/issues/28789)) ([95706d9](https://github.com/apache/superset/commit/95706d9be2b5414ed496ad762ba1996041429e01))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache/superset/issues/21993)) ([22fab5e](https://github.com/apache/superset/commit/22fab5e58ce574e962518067d982e3036449e580))
- **dashboard:** Add cross filter from context menu ([#23141](https://github.com/apache/superset/issues/23141)) ([ee1952e](https://github.com/apache/superset/commit/ee1952e488f2cd0913fe6f35ffe551d18ee3d143))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache/superset/issues/21351)) ([76e57ec](https://github.com/apache/superset/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache/superset/issues/19855)) ([ba0c37d](https://github.com/apache/superset/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **explorer:** Add configs and formatting to discrete comparison columns ([#29553](https://github.com/apache/superset/issues/29553)) ([dac69e2](https://github.com/apache/superset/commit/dac69e20922ac06b21267502fc9cf18b61de15cc))
- **formatters:** Add custom d3-time-format locale ([#24263](https://github.com/apache/superset/issues/24263)) ([024cfd8](https://github.com/apache/superset/commit/024cfd86e408ec5f7ddf49a9e90908e2fb2e6b70))
- Implement context menu for drill by ([#23454](https://github.com/apache/superset/issues/23454)) ([9fbfd1c](https://github.com/apache/superset/commit/9fbfd1c1d883f983ef96b8812297721e2a1a9695))
- Implement currencies formatter for saved metrics ([#24517](https://github.com/apache/superset/issues/24517)) ([83ff4cd](https://github.com/apache/superset/commit/83ff4cd86a4931fc8eda83aeb3d8d3c92d773202))
- make data tables support html ([#24368](https://github.com/apache/superset/issues/24368)) ([d2b0b8e](https://github.com/apache/superset/commit/d2b0b8eac52ad8b68639c6581a1ed174a593f564))
- Making bar graphs in Table viz from fixed-size divs instead of calculated gradients ([#21482](https://github.com/apache/superset/issues/21482)) ([135909f](https://github.com/apache/superset/commit/135909f814e989c2314ddbb5da90e5364cd36d17))
- Move cross filters to Dashboard ([#22785](https://github.com/apache/superset/issues/22785)) ([9ed2326](https://github.com/apache/superset/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **select:** keep options order when in single mode ([#19085](https://github.com/apache/superset/issues/19085)) ([ae13d83](https://github.com/apache/superset/commit/ae13d8313b5687374f5b24e02bccdcc717ba19eb))
- standardized form_data ([#20010](https://github.com/apache/superset/issues/20010)) ([dd4b581](https://github.com/apache/superset/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- **storybook:** Co-habitating/Upgrading Storybooks to v7 (dependency madness ensues) ([#26907](https://github.com/apache/superset/issues/26907)) ([753ef69](https://github.com/apache/superset/commit/753ef695294ce26238b68ff41ba0a9af6aea74de))
- support multiple columns with time grain in Table Chart ([#21547](https://github.com/apache/superset/issues/21547)) ([d67b046](https://github.com/apache/superset/commit/d67b04683c5e671a8e0278994fb36b23978c1ff4))
- **table:** Table with Time Comparison ([#28057](https://github.com/apache/superset/issues/28057)) ([7ddea62](https://github.com/apache/superset/commit/7ddea62331617dad1b8ade1abe7dd8c11a1ba20d))
- **time_comparison:** Support all date formats when computing custom and inherit offsets ([#30002](https://github.com/apache/superset/issues/30002)) ([bc6d2db](https://github.com/apache/superset/commit/bc6d2dba373e59a498d942909ab6631e5c8521e9))
- truncate long values in table viz, a per-column setting ([#19383](https://github.com/apache/superset/issues/19383)) ([7e504ff](https://github.com/apache/superset/commit/7e504ff680698106cf9008b4c2814b01fcac90bb))
- **viz picker:** Remove some tags, refactor Recommended section ([#27708](https://github.com/apache/superset/issues/27708)) ([c314999](https://github.com/apache/superset/commit/c3149994ac0d4392e0462421b62cd0c034142082))

### Performance Improvements

- **plugin-chart-table:** Add memoization to avoid rerenders ([#19976](https://github.com/apache/superset/issues/19976)) ([0f68dee](https://github.com/apache/superset/commit/0f68deedf105300c8bd2536bd205d128799c0381))
- Remove antd-with-locales import ([#29788](https://github.com/apache/superset/issues/29788)) ([f1136b5](https://github.com/apache/superset/commit/f1136b57dd6b4cbcb7628dcbf6b1ac46e2a8301b))

# [0.19.0](https://github.com/apache/superset/compare/v2021.41.0...v0.19.0) (2024-09-07)

### Bug Fixes

- **accessibility:** Enable tabbing on sort header of table chart ([#26326](https://github.com/apache/superset/issues/26326)) ([b6d433d](https://github.com/apache/superset/commit/b6d433de32cad21c0866ee98fd5ae85b4459c23b))
- **chart & table:** make to allow highlight in case of numeric column ([#19938](https://github.com/apache/superset/issues/19938)) ([902ac05](https://github.com/apache/superset/commit/902ac053722ada89f817156a0af38ec03f27376c))
- **chart & table:** make to prevent dates from wrapping ([#20384](https://github.com/apache/superset/issues/20384)) ([1ae9353](https://github.com/apache/superset/commit/1ae935379fa8f1f5043205f218d7c1af93fae053))
- **chart table in dashboard:** improve screen reading of table ([#26453](https://github.com/apache/superset/issues/26453)) ([71a950f](https://github.com/apache/superset/commit/71a950fc803898393fbe1c0b370aaca438eeb38b))
- **chart-table:** Scrollbar causing header + footer overflow ([#21064](https://github.com/apache/superset/issues/21064)) ([2679ee2](https://github.com/apache/superset/commit/2679ee2e46edf53ab07c19e1186ce2877e159303))
- **conditional formatting:** controls looses on save ([#23137](https://github.com/apache/superset/issues/23137)) ([ce3ba67](https://github.com/apache/superset/commit/ce3ba67cf63e90059d94e2aa956982ad4ea44d1e))
- Currency formatting in Table raw mode ([#25248](https://github.com/apache/superset/issues/25248)) ([ea21e80](https://github.com/apache/superset/commit/ea21e800a799e7da0817f67cdae893be701569f5))
- Dashboard time grain in Table ([#24746](https://github.com/apache/superset/issues/24746)) ([317aa98](https://github.com/apache/superset/commit/317aa989c233160fcf4fe9ce3e5c1953634c5524))
- **Dashboard:** Add aria-label to filters and search forms ([#27968](https://github.com/apache/superset/issues/27968)) ([4202fba](https://github.com/apache/superset/commit/4202fba0f1da1d4f785c479c5972ee4dc4846e3d))
- **dashboard:** Allow selecting text in cells in Table and PivotTable without triggering cross filters ([#23283](https://github.com/apache/superset/issues/23283)) ([d16512b](https://github.com/apache/superset/commit/d16512b7758e36a1263fc63bd7d9d1f93060dc93))
- Dates alignment in Table viz ([#19668](https://github.com/apache/superset/issues/19668)) ([ed1309e](https://github.com/apache/superset/commit/ed1309e6bd9e8c0365794cf12bf4a272e540bbbd))
- Drill to detail formatted val on TableChart ([#21719](https://github.com/apache/superset/issues/21719)) ([eb2a134](https://github.com/apache/superset/commit/eb2a1345a87dae968d1357279e6056a76988bd01))
- explore warnings cleanup ([#20864](https://github.com/apache/superset/issues/20864)) ([5d107b8](https://github.com/apache/superset/commit/5d107b86abd1712571861e92f922ace57fb622ba))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- issue with sorting by multiple columns in a table ([#19920](https://github.com/apache/superset/issues/19920)) ([a45d011](https://github.com/apache/superset/commit/a45d011e74be7a52fee9b0e580187dd6f25509db))
- null dates in table chart ([#17974](https://github.com/apache/superset/issues/17974)) ([1e544ce](https://github.com/apache/superset/commit/1e544ce5316fad4b2c65127426c8aaffaf71fad3))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache/superset/issues/19071)) ([0e0bece](https://github.com/apache/superset/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **plugin-chart-table): Revert "fix(chart table in dashboard:** improve screen reading of table ([#26453](https://github.com/apache/superset/issues/26453))" ([#26963](https://github.com/apache/superset/issues/26963)) ([e4eae9a](https://github.com/apache/superset/commit/e4eae9a70c3f5b7c3fae984a017e72e912fbad93))
- **plugin-chart-table:** Include time control ([#23533](https://github.com/apache/superset/issues/23533)) ([13ffb4b](https://github.com/apache/superset/commit/13ffb4b7c203cfa8ebec602fc7c25103eebc019f))
- **plugin-chart-table:** Invalid d3Formatter on String column ([#23515](https://github.com/apache/superset/issues/23515)) ([5d910aa](https://github.com/apache/superset/commit/5d910aa2e248edcee055f715def9b02bc2c1d62b))
- **plugin-chart-table:** Prevent misalignment of totals and headers when scrollbar is visible ([#26964](https://github.com/apache/superset/issues/26964)) ([e6d2fb6](https://github.com/apache/superset/commit/e6d2fb6fdfa4d741de16b322bdc4bd01fb559413))
- **plugin-chart-table:** Resetting controls when switching query mode ([#19792](https://github.com/apache/superset/issues/19792)) ([fcc8080](https://github.com/apache/superset/commit/fcc8080ff3b99e2f5f5cdbd48335d7ab83aba16a))
- **plugin-chart-table:** sort alphanumeric columns case insensitive ([#17765](https://github.com/apache/superset/issues/17765)) ([82b47ca](https://github.com/apache/superset/commit/82b47cacba9653c7837c361be65e10520e9068b3))
- **plugins:** Fix dashboard filter for Table and Big Number with Time Comparison ([#29517](https://github.com/apache/superset/issues/29517)) ([9052f9f](https://github.com/apache/superset/commit/9052f9fbb4a17c8dc1e951a8d1b13bf92b29c8a8))
- **plugins:** missing currency on small number format in table chart ([#27041](https://github.com/apache/superset/issues/27041)) ([6f40299](https://github.com/apache/superset/commit/6f402991e54ae6ab0c6c98613d7e831c7f847f54))
- Position of arrows in Table chart ([#18739](https://github.com/apache/superset/issues/18739)) ([a9a8929](https://github.com/apache/superset/commit/a9a892945e6058c92c6e4f63255d799790a9bfa8))
- removing problematic "formattable" tag ([#24207](https://github.com/apache/superset/issues/24207)) ([cc68d62](https://github.com/apache/superset/commit/cc68d626bce46d1dcb8e8ee97f19919774c1ab86))
- row limits & row count labels are confusing ([#27700](https://github.com/apache/superset/issues/27700)) ([12fe292](https://github.com/apache/superset/commit/12fe2929a4a4b5627d9cff701a1e73644e78ac47))
- **select:** select component sort functionality on certain options ([#17638](https://github.com/apache/superset/issues/17638)) ([f476ba2](https://github.com/apache/superset/commit/f476ba23a279cb87a94ad3075e035cad0ae264b6))
- Show Totals error with sort and group by together ([#19072](https://github.com/apache/superset/issues/19072)) ([bc6aad0](https://github.com/apache/superset/commit/bc6aad0a88bbbbfd6c592f8813d1b72471788897))
- Table Autosizing Has Unnecessary Scroll Bars ([#19628](https://github.com/apache/superset/issues/19628)) ([9554135](https://github.com/apache/superset/commit/955413539b3edd892efd6bc069240efb5f5a29ac))
- **table chart:** Show Cell Bars correctly [#25625](https://github.com/apache/superset/issues/25625) ([#25707](https://github.com/apache/superset/issues/25707)) ([916f7bc](https://github.com/apache/superset/commit/916f7bcbbae6786bc6320f31b8e5af49ad119ac9))
- Table sorting reset ([#23318](https://github.com/apache/superset/issues/23318)) ([da3791a](https://github.com/apache/superset/commit/da3791ad3daa209631a588394600d1a8b635e814))
- table viz sort icon bottom aligned ([#20447](https://github.com/apache/superset/issues/20447)) ([93774d1](https://github.com/apache/superset/commit/93774d1860fd40dfee1f18e2787d9d0b79b551e2))
- **table-chart:** don't color empty cells in table chart with color formatters ([#21501](https://github.com/apache/superset/issues/21501)) ([60bab42](https://github.com/apache/superset/commit/60bab4269f1a0ebd42c85aab1ecd8c34ae1b9448))
- **table:** condition formatting can't formate 0 values ([#24008](https://github.com/apache/superset/issues/24008)) ([0d5be8e](https://github.com/apache/superset/commit/0d5be8e3f6c0b1ca62bf52fe933bc516d2f509e0))
- **table:** Double percenting ad-hoc percentage metrics ([#25857](https://github.com/apache/superset/issues/25857)) ([784a478](https://github.com/apache/superset/commit/784a478268fd89e6e58077e99bb2010987d6b07c))
- **table:** percentage metric should use verbose map ([#24158](https://github.com/apache/superset/issues/24158)) ([febc07a](https://github.com/apache/superset/commit/febc07aec361d80056195c001d26084e3a0b9363))
- **trino:** normalize non-iso timestamps ([#23339](https://github.com/apache/superset/issues/23339)) ([a591130](https://github.com/apache/superset/commit/a591130e0bd3c817af9ad937f63f1af1fce90740))

### Features

- Add currencies controls in control panels ([#24718](https://github.com/apache/superset/issues/24718)) ([f7e76d0](https://github.com/apache/superset/commit/f7e76d02b7cbe4940946673590bb979984ace9f5))
- add drag and drop column rearrangement for table viz ([#19381](https://github.com/apache/superset/issues/19381)) ([7e9b85f](https://github.com/apache/superset/commit/7e9b85f76ca8cae38c38e11f857634216b1cd71c))
- add option to disable rendering of html in sql lab and table chart ([#27969](https://github.com/apache/superset/issues/27969)) ([4f363e1](https://github.com/apache/superset/commit/4f363e11801572e7737b9c475bba58bd0a5dbca8))
- Adds drill to detail context menu to Table ([#21168](https://github.com/apache/superset/issues/21168)) ([68fa4d2](https://github.com/apache/superset/commit/68fa4d2665cc0742b2194533271ce562a3ebbf14))
- Adds the Featured Charts dashboard ([#28789](https://github.com/apache/superset/issues/28789)) ([95706d9](https://github.com/apache/superset/commit/95706d9be2b5414ed496ad762ba1996041429e01))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache/superset/issues/21993)) ([22fab5e](https://github.com/apache/superset/commit/22fab5e58ce574e962518067d982e3036449e580))
- **dashboard:** Add cross filter from context menu ([#23141](https://github.com/apache/superset/issues/23141)) ([ee1952e](https://github.com/apache/superset/commit/ee1952e488f2cd0913fe6f35ffe551d18ee3d143))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache/superset/issues/21351)) ([76e57ec](https://github.com/apache/superset/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache/superset/issues/19855)) ([ba0c37d](https://github.com/apache/superset/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- **explorer:** Add configs and formatting to discrete comparison columns ([#29553](https://github.com/apache/superset/issues/29553)) ([dac69e2](https://github.com/apache/superset/commit/dac69e20922ac06b21267502fc9cf18b61de15cc))
- **formatters:** Add custom d3-time-format locale ([#24263](https://github.com/apache/superset/issues/24263)) ([024cfd8](https://github.com/apache/superset/commit/024cfd86e408ec5f7ddf49a9e90908e2fb2e6b70))
- Implement context menu for drill by ([#23454](https://github.com/apache/superset/issues/23454)) ([9fbfd1c](https://github.com/apache/superset/commit/9fbfd1c1d883f983ef96b8812297721e2a1a9695))
- Implement currencies formatter for saved metrics ([#24517](https://github.com/apache/superset/issues/24517)) ([83ff4cd](https://github.com/apache/superset/commit/83ff4cd86a4931fc8eda83aeb3d8d3c92d773202))
- make data tables support html ([#24368](https://github.com/apache/superset/issues/24368)) ([d2b0b8e](https://github.com/apache/superset/commit/d2b0b8eac52ad8b68639c6581a1ed174a593f564))
- Making bar graphs in Table viz from fixed-size divs instead of calculated gradients ([#21482](https://github.com/apache/superset/issues/21482)) ([135909f](https://github.com/apache/superset/commit/135909f814e989c2314ddbb5da90e5364cd36d17))
- Move cross filters to Dashboard ([#22785](https://github.com/apache/superset/issues/22785)) ([9ed2326](https://github.com/apache/superset/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **select:** keep options order when in single mode ([#19085](https://github.com/apache/superset/issues/19085)) ([ae13d83](https://github.com/apache/superset/commit/ae13d8313b5687374f5b24e02bccdcc717ba19eb))
- standardized form_data ([#20010](https://github.com/apache/superset/issues/20010)) ([dd4b581](https://github.com/apache/superset/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- **storybook:** Co-habitating/Upgrading Storybooks to v7 (dependency madness ensues) ([#26907](https://github.com/apache/superset/issues/26907)) ([753ef69](https://github.com/apache/superset/commit/753ef695294ce26238b68ff41ba0a9af6aea74de))
- support multiple columns with time grain in Table Chart ([#21547](https://github.com/apache/superset/issues/21547)) ([d67b046](https://github.com/apache/superset/commit/d67b04683c5e671a8e0278994fb36b23978c1ff4))
- **table:** Table with Time Comparison ([#28057](https://github.com/apache/superset/issues/28057)) ([7ddea62](https://github.com/apache/superset/commit/7ddea62331617dad1b8ade1abe7dd8c11a1ba20d))
- **time_comparison:** Support all date formats when computing custom and inherit offsets ([#30002](https://github.com/apache/superset/issues/30002)) ([bc6d2db](https://github.com/apache/superset/commit/bc6d2dba373e59a498d942909ab6631e5c8521e9))
- truncate long values in table viz, a per-column setting ([#19383](https://github.com/apache/superset/issues/19383)) ([7e504ff](https://github.com/apache/superset/commit/7e504ff680698106cf9008b4c2814b01fcac90bb))
- **viz picker:** Remove some tags, refactor Recommended section ([#27708](https://github.com/apache/superset/issues/27708)) ([c314999](https://github.com/apache/superset/commit/c3149994ac0d4392e0462421b62cd0c034142082))

### Performance Improvements

- **plugin-chart-table:** Add memoization to avoid rerenders ([#19976](https://github.com/apache/superset/issues/19976)) ([0f68dee](https://github.com/apache/superset/commit/0f68deedf105300c8bd2536bd205d128799c0381))
- Remove antd-with-locales import ([#29788](https://github.com/apache/superset/issues/29788)) ([f1136b5](https://github.com/apache/superset/commit/f1136b57dd6b4cbcb7628dcbf6b1ac46e2a8301b))

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

**Note:** Version bump only for package @superset-ui/plugin-chart-table

## [0.17.61](https://github.com/apache-superset/superset-ui/compare/v0.17.60...v0.17.61) (2021-07-02)

**Note:** Version bump only for package @superset-ui/plugin-chart-table
