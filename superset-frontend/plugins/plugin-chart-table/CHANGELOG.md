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

- **chart & table:** make to allow highlight in case of numeric column ([#19938](https://github.com/apache-superset/superset-ui/issues/19938)) ([902ac05](https://github.com/apache-superset/superset-ui/commit/902ac053722ada89f817156a0af38ec03f27376c))
- **chart & table:** make to prevent dates from wrapping ([#20384](https://github.com/apache-superset/superset-ui/issues/20384)) ([1ae9353](https://github.com/apache-superset/superset-ui/commit/1ae935379fa8f1f5043205f218d7c1af93fae053))
- **chart-table:** Scrollbar causing header + footer overflow ([#21064](https://github.com/apache-superset/superset-ui/issues/21064)) ([2679ee2](https://github.com/apache-superset/superset-ui/commit/2679ee2e46edf53ab07c19e1186ce2877e159303))
- Dates alignment in Table viz ([#19668](https://github.com/apache-superset/superset-ui/issues/19668)) ([ed1309e](https://github.com/apache-superset/superset-ui/commit/ed1309e6bd9e8c0365794cf12bf4a272e540bbbd))
- Drill to detail formatted val on TableChart ([#21719](https://github.com/apache-superset/superset-ui/issues/21719)) ([eb2a134](https://github.com/apache-superset/superset-ui/commit/eb2a1345a87dae968d1357279e6056a76988bd01))
- explore warnings cleanup ([#20864](https://github.com/apache-superset/superset-ui/issues/20864)) ([5d107b8](https://github.com/apache-superset/superset-ui/commit/5d107b86abd1712571861e92f922ace57fb622ba))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache-superset/superset-ui/issues/21315)) ([2285ebe](https://github.com/apache-superset/superset-ui/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- issue with sorting by multiple columns in a table ([#19920](https://github.com/apache-superset/superset-ui/issues/19920)) ([a45d011](https://github.com/apache-superset/superset-ui/commit/a45d011e74be7a52fee9b0e580187dd6f25509db))
- null dates in table chart ([#17974](https://github.com/apache-superset/superset-ui/issues/17974)) ([1e544ce](https://github.com/apache-superset/superset-ui/commit/1e544ce5316fad4b2c65127426c8aaffaf71fad3))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache-superset/superset-ui/issues/19071)) ([0e0bece](https://github.com/apache-superset/superset-ui/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **plugin-chart-table:** Resetting controls when switching query mode ([#19792](https://github.com/apache-superset/superset-ui/issues/19792)) ([fcc8080](https://github.com/apache-superset/superset-ui/commit/fcc8080ff3b99e2f5f5cdbd48335d7ab83aba16a))
- **plugin-chart-table:** sort alphanumeric columns case insensitive ([#17765](https://github.com/apache-superset/superset-ui/issues/17765)) ([82b47ca](https://github.com/apache-superset/superset-ui/commit/82b47cacba9653c7837c361be65e10520e9068b3))
- Position of arrows in Table chart ([#18739](https://github.com/apache-superset/superset-ui/issues/18739)) ([a9a8929](https://github.com/apache-superset/superset-ui/commit/a9a892945e6058c92c6e4f63255d799790a9bfa8))
- **select:** select component sort functionality on certain options ([#17638](https://github.com/apache-superset/superset-ui/issues/17638)) ([f476ba2](https://github.com/apache-superset/superset-ui/commit/f476ba23a279cb87a94ad3075e035cad0ae264b6))
- Show Totals error with sort and group by together ([#19072](https://github.com/apache-superset/superset-ui/issues/19072)) ([bc6aad0](https://github.com/apache-superset/superset-ui/commit/bc6aad0a88bbbbfd6c592f8813d1b72471788897))
- Table Autosizing Has Unnecessary Scroll Bars ([#19628](https://github.com/apache-superset/superset-ui/issues/19628)) ([9554135](https://github.com/apache-superset/superset-ui/commit/955413539b3edd892efd6bc069240efb5f5a29ac))
- table viz sort icon bottom aligned ([#20447](https://github.com/apache-superset/superset-ui/issues/20447)) ([93774d1](https://github.com/apache-superset/superset-ui/commit/93774d1860fd40dfee1f18e2787d9d0b79b551e2))
- **table-chart:** don't color empty cells in table chart with color formatters ([#21501](https://github.com/apache-superset/superset-ui/issues/21501)) ([60bab42](https://github.com/apache-superset/superset-ui/commit/60bab4269f1a0ebd42c85aab1ecd8c34ae1b9448))

### Features

- add drag and drop column rearrangement for table viz ([#19381](https://github.com/apache-superset/superset-ui/issues/19381)) ([7e9b85f](https://github.com/apache-superset/superset-ui/commit/7e9b85f76ca8cae38c38e11f857634216b1cd71c))
- Adds drill to detail context menu to Table ([#21168](https://github.com/apache-superset/superset-ui/issues/21168)) ([68fa4d2](https://github.com/apache-superset/superset-ui/commit/68fa4d2665cc0742b2194533271ce562a3ebbf14))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache-superset/superset-ui/issues/21993)) ([22fab5e](https://github.com/apache-superset/superset-ui/commit/22fab5e58ce574e962518067d982e3036449e580))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache-superset/superset-ui/issues/21351)) ([76e57ec](https://github.com/apache-superset/superset-ui/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache-superset/superset-ui/issues/19855)) ([ba0c37d](https://github.com/apache-superset/superset-ui/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- Making bar graphs in Table viz from fixed-size divs instead of calculated gradients ([#21482](https://github.com/apache-superset/superset-ui/issues/21482)) ([135909f](https://github.com/apache-superset/superset-ui/commit/135909f814e989c2314ddbb5da90e5364cd36d17))
- Move cross filters to Dashboard ([#22785](https://github.com/apache-superset/superset-ui/issues/22785)) ([9ed2326](https://github.com/apache-superset/superset-ui/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **select:** keep options order when in single mode ([#19085](https://github.com/apache-superset/superset-ui/issues/19085)) ([ae13d83](https://github.com/apache-superset/superset-ui/commit/ae13d8313b5687374f5b24e02bccdcc717ba19eb))
- standardized form_data ([#20010](https://github.com/apache-superset/superset-ui/issues/20010)) ([dd4b581](https://github.com/apache-superset/superset-ui/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- support multiple columns with time grain in Table Chart ([#21547](https://github.com/apache-superset/superset-ui/issues/21547)) ([d67b046](https://github.com/apache-superset/superset-ui/commit/d67b04683c5e671a8e0278994fb36b23978c1ff4))
- truncate long values in table viz, a per-column setting ([#19383](https://github.com/apache-superset/superset-ui/issues/19383)) ([7e504ff](https://github.com/apache-superset/superset-ui/commit/7e504ff680698106cf9008b4c2814b01fcac90bb))

### Performance Improvements

- **plugin-chart-table:** Add memoization to avoid rerenders ([#19976](https://github.com/apache-superset/superset-ui/issues/19976)) ([0f68dee](https://github.com/apache-superset/superset-ui/commit/0f68deedf105300c8bd2536bd205d128799c0381))

# [0.19.0](https://github.com/apache-superset/superset-ui/compare/v2021.41.0...v0.19.0) (2023-04-18)

### Bug Fixes

- **chart & table:** make to allow highlight in case of numeric column ([#19938](https://github.com/apache-superset/superset-ui/issues/19938)) ([902ac05](https://github.com/apache-superset/superset-ui/commit/902ac053722ada89f817156a0af38ec03f27376c))
- **chart & table:** make to prevent dates from wrapping ([#20384](https://github.com/apache-superset/superset-ui/issues/20384)) ([1ae9353](https://github.com/apache-superset/superset-ui/commit/1ae935379fa8f1f5043205f218d7c1af93fae053))
- **chart-table:** Scrollbar causing header + footer overflow ([#21064](https://github.com/apache-superset/superset-ui/issues/21064)) ([2679ee2](https://github.com/apache-superset/superset-ui/commit/2679ee2e46edf53ab07c19e1186ce2877e159303))
- Dates alignment in Table viz ([#19668](https://github.com/apache-superset/superset-ui/issues/19668)) ([ed1309e](https://github.com/apache-superset/superset-ui/commit/ed1309e6bd9e8c0365794cf12bf4a272e540bbbd))
- Drill to detail formatted val on TableChart ([#21719](https://github.com/apache-superset/superset-ui/issues/21719)) ([eb2a134](https://github.com/apache-superset/superset-ui/commit/eb2a1345a87dae968d1357279e6056a76988bd01))
- explore warnings cleanup ([#20864](https://github.com/apache-superset/superset-ui/issues/20864)) ([5d107b8](https://github.com/apache-superset/superset-ui/commit/5d107b86abd1712571861e92f922ace57fb622ba))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache-superset/superset-ui/issues/21315)) ([2285ebe](https://github.com/apache-superset/superset-ui/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- issue with sorting by multiple columns in a table ([#19920](https://github.com/apache-superset/superset-ui/issues/19920)) ([a45d011](https://github.com/apache-superset/superset-ui/commit/a45d011e74be7a52fee9b0e580187dd6f25509db))
- null dates in table chart ([#17974](https://github.com/apache-superset/superset-ui/issues/17974)) ([1e544ce](https://github.com/apache-superset/superset-ui/commit/1e544ce5316fad4b2c65127426c8aaffaf71fad3))
- Pivot Table Conditional Formatting Doesn't Show All Options ([#19071](https://github.com/apache-superset/superset-ui/issues/19071)) ([0e0bece](https://github.com/apache-superset/superset-ui/commit/0e0beceac173f765d8f9a0887732029b78603f6d))
- **plugin-chart-table:** Resetting controls when switching query mode ([#19792](https://github.com/apache-superset/superset-ui/issues/19792)) ([fcc8080](https://github.com/apache-superset/superset-ui/commit/fcc8080ff3b99e2f5f5cdbd48335d7ab83aba16a))
- **plugin-chart-table:** sort alphanumeric columns case insensitive ([#17765](https://github.com/apache-superset/superset-ui/issues/17765)) ([82b47ca](https://github.com/apache-superset/superset-ui/commit/82b47cacba9653c7837c361be65e10520e9068b3))
- Position of arrows in Table chart ([#18739](https://github.com/apache-superset/superset-ui/issues/18739)) ([a9a8929](https://github.com/apache-superset/superset-ui/commit/a9a892945e6058c92c6e4f63255d799790a9bfa8))
- **select:** select component sort functionality on certain options ([#17638](https://github.com/apache-superset/superset-ui/issues/17638)) ([f476ba2](https://github.com/apache-superset/superset-ui/commit/f476ba23a279cb87a94ad3075e035cad0ae264b6))
- Show Totals error with sort and group by together ([#19072](https://github.com/apache-superset/superset-ui/issues/19072)) ([bc6aad0](https://github.com/apache-superset/superset-ui/commit/bc6aad0a88bbbbfd6c592f8813d1b72471788897))
- Table Autosizing Has Unnecessary Scroll Bars ([#19628](https://github.com/apache-superset/superset-ui/issues/19628)) ([9554135](https://github.com/apache-superset/superset-ui/commit/955413539b3edd892efd6bc069240efb5f5a29ac))
- table viz sort icon bottom aligned ([#20447](https://github.com/apache-superset/superset-ui/issues/20447)) ([93774d1](https://github.com/apache-superset/superset-ui/commit/93774d1860fd40dfee1f18e2787d9d0b79b551e2))
- **table-chart:** don't color empty cells in table chart with color formatters ([#21501](https://github.com/apache-superset/superset-ui/issues/21501)) ([60bab42](https://github.com/apache-superset/superset-ui/commit/60bab4269f1a0ebd42c85aab1ecd8c34ae1b9448))

### Features

- add drag and drop column rearrangement for table viz ([#19381](https://github.com/apache-superset/superset-ui/issues/19381)) ([7e9b85f](https://github.com/apache-superset/superset-ui/commit/7e9b85f76ca8cae38c38e11f857634216b1cd71c))
- Adds drill to detail context menu to Table ([#21168](https://github.com/apache-superset/superset-ui/issues/21168)) ([68fa4d2](https://github.com/apache-superset/superset-ui/commit/68fa4d2665cc0742b2194533271ce562a3ebbf14))
- Axis sort in the Bar Chart V2 ([#21993](https://github.com/apache-superset/superset-ui/issues/21993)) ([22fab5e](https://github.com/apache-superset/superset-ui/commit/22fab5e58ce574e962518067d982e3036449e580))
- **dashboard:** menu improvements, fallback support for Drill to Detail ([#21351](https://github.com/apache-superset/superset-ui/issues/21351)) ([76e57ec](https://github.com/apache-superset/superset-ui/commit/76e57ec651bbfaf4f76031eeeca66f6a1fa81bc2))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache-superset/superset-ui/issues/19855)) ([ba0c37d](https://github.com/apache-superset/superset-ui/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- Making bar graphs in Table viz from fixed-size divs instead of calculated gradients ([#21482](https://github.com/apache-superset/superset-ui/issues/21482)) ([135909f](https://github.com/apache-superset/superset-ui/commit/135909f814e989c2314ddbb5da90e5364cd36d17))
- Move cross filters to Dashboard ([#22785](https://github.com/apache-superset/superset-ui/issues/22785)) ([9ed2326](https://github.com/apache-superset/superset-ui/commit/9ed2326a20329d41abc8e0995b0ba6110379088f))
- **select:** keep options order when in single mode ([#19085](https://github.com/apache-superset/superset-ui/issues/19085)) ([ae13d83](https://github.com/apache-superset/superset-ui/commit/ae13d8313b5687374f5b24e02bccdcc717ba19eb))
- standardized form_data ([#20010](https://github.com/apache-superset/superset-ui/issues/20010)) ([dd4b581](https://github.com/apache-superset/superset-ui/commit/dd4b581fb55d920fc3b709fc044cea5339802ee2))
- support multiple columns with time grain in Table Chart ([#21547](https://github.com/apache-superset/superset-ui/issues/21547)) ([d67b046](https://github.com/apache-superset/superset-ui/commit/d67b04683c5e671a8e0278994fb36b23978c1ff4))
- truncate long values in table viz, a per-column setting ([#19383](https://github.com/apache-superset/superset-ui/issues/19383)) ([7e504ff](https://github.com/apache-superset/superset-ui/commit/7e504ff680698106cf9008b4c2814b01fcac90bb))

### Performance Improvements

- **plugin-chart-table:** Add memoization to avoid rerenders ([#19976](https://github.com/apache-superset/superset-ui/issues/19976)) ([0f68dee](https://github.com/apache-superset/superset-ui/commit/0f68deedf105300c8bd2536bd205d128799c0381))

# [0.18.0](https://github.com/apache-superset/superset-ui/compare/v0.17.87...v0.18.0) (2021-08-30)

**Note:** Version bump only for package @superset-ui/plugin-chart-table

## [0.17.61](https://github.com/apache-superset/superset-ui/compare/v0.17.60...v0.17.61) (2021-07-02)

**Note:** Version bump only for package @superset-ui/plugin-chart-table
