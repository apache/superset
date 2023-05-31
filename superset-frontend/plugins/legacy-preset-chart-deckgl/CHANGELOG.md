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

# [2.1.0](https://github.com/apache/superset/compare/v2021.41.0...v2.1.0) (2023-04-18)

### Bug Fixes

- deck.gl GeoJsonLayer Autozoom & fill/stroke options ([#19778](https://github.com/apache/superset/issues/19778)) ([d65b77e](https://github.com/apache/superset/commit/d65b77ec7dac4c2368fcaa1fe6e98db102966198))
- **deck.gl:** multiple layers map size is shrunk ([#18939](https://github.com/apache/superset/issues/18939)) ([2cb3635](https://github.com/apache/superset/commit/2cb3635256ee8e91f0bac2f3091684673c04ff2b))
- **deck.gl:** update view state on property changes ([#17720](https://github.com/apache/superset/issues/17720)) ([#17826](https://github.com/apache/superset/issues/17826)) ([97d918b](https://github.com/apache/superset/commit/97d918b6927f572dca3b33c61b89c8b3ebdc4376))
- **deckgl:** deckgl unable to load map ([#17851](https://github.com/apache/superset/issues/17851)) ([52f5dcb](https://github.com/apache/superset/commit/52f5dcb58eec7b188f4387b8781dcda4252a5680))
- **explore:** Fix chart standalone URL for report/thumbnail generation ([#20673](https://github.com/apache/superset/issues/20673)) ([84d4302](https://github.com/apache/superset/commit/84d4302628d18aa19c13cc5322e68abbc690ea4d))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- weight tooltip issue ([#19397](https://github.com/apache/superset/issues/19397)) ([f6d550b](https://github.com/apache/superset/commit/f6d550b7fc3643350483850064e65dbd3d026dc4))

### Features

- apply standardized form data to deckgl ([#20579](https://github.com/apache/superset/issues/20579)) ([290b89c](https://github.com/apache/superset/commit/290b89c7b4ae702c55f611bfac9cedb245ea8bd8))
- **deck.gl:** add color range for deck.gl 3D ([#19520](https://github.com/apache/superset/issues/19520)) ([c0a00fd](https://github.com/apache/superset/commit/c0a00fd302ec66fbe0ca766cf73978c99ba00d82))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache/superset/issues/19855)) ([ba0c37d](https://github.com/apache/superset/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- improve color consistency (save all labels) ([#19038](https://github.com/apache/superset/issues/19038)) ([dc57508](https://github.com/apache/superset/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- **legacy-preset-chart-deckgl:** Add ,.1f and ,.2f value formats to deckgl charts ([#18945](https://github.com/apache/superset/issues/18945)) ([c56dc8e](https://github.com/apache/superset/commit/c56dc8eace6a71b45240d1bb6768d75661052a2e))

# [0.19.0](https://github.com/apache/superset/compare/v2021.41.0...v0.19.0) (2023-04-18)

### Bug Fixes

- deck.gl GeoJsonLayer Autozoom & fill/stroke options ([#19778](https://github.com/apache/superset/issues/19778)) ([d65b77e](https://github.com/apache/superset/commit/d65b77ec7dac4c2368fcaa1fe6e98db102966198))
- **deck.gl:** multiple layers map size is shrunk ([#18939](https://github.com/apache/superset/issues/18939)) ([2cb3635](https://github.com/apache/superset/commit/2cb3635256ee8e91f0bac2f3091684673c04ff2b))
- **deck.gl:** update view state on property changes ([#17720](https://github.com/apache/superset/issues/17720)) ([#17826](https://github.com/apache/superset/issues/17826)) ([97d918b](https://github.com/apache/superset/commit/97d918b6927f572dca3b33c61b89c8b3ebdc4376))
- **deckgl:** deckgl unable to load map ([#17851](https://github.com/apache/superset/issues/17851)) ([52f5dcb](https://github.com/apache/superset/commit/52f5dcb58eec7b188f4387b8781dcda4252a5680))
- **explore:** Fix chart standalone URL for report/thumbnail generation ([#20673](https://github.com/apache/superset/issues/20673)) ([84d4302](https://github.com/apache/superset/commit/84d4302628d18aa19c13cc5322e68abbc690ea4d))
- **explore:** Prevent shared controls from checking feature flags outside React render ([#21315](https://github.com/apache/superset/issues/21315)) ([2285ebe](https://github.com/apache/superset/commit/2285ebe72ec4edded6d195052740b7f9f13d1f1b))
- weight tooltip issue ([#19397](https://github.com/apache/superset/issues/19397)) ([f6d550b](https://github.com/apache/superset/commit/f6d550b7fc3643350483850064e65dbd3d026dc4))

### Features

- apply standardized form data to deckgl ([#20579](https://github.com/apache/superset/issues/20579)) ([290b89c](https://github.com/apache/superset/commit/290b89c7b4ae702c55f611bfac9cedb245ea8bd8))
- **deck.gl:** add color range for deck.gl 3D ([#19520](https://github.com/apache/superset/issues/19520)) ([c0a00fd](https://github.com/apache/superset/commit/c0a00fd302ec66fbe0ca766cf73978c99ba00d82))
- **explore:** Frontend implementation of dataset creation from infobox ([#19855](https://github.com/apache/superset/issues/19855)) ([ba0c37d](https://github.com/apache/superset/commit/ba0c37d3df85b1af39404af1d578daeb0ff2d278))
- improve color consistency (save all labels) ([#19038](https://github.com/apache/superset/issues/19038)) ([dc57508](https://github.com/apache/superset/commit/dc575080d7e43d40b1734bb8f44fdc291cb95b11))
- **legacy-preset-chart-deckgl:** Add ,.1f and ,.2f value formats to deckgl charts ([#18945](https://github.com/apache/superset/issues/18945)) ([c56dc8e](https://github.com/apache/superset/commit/c56dc8eace6a71b45240d1bb6768d75661052a2e))
