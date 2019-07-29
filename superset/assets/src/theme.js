/**
 * Licensed to the Apache Software Foundation (ASF) under one
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
 * under the License.
 */

import { __webpack_public_path__ } from './public-path';
__webpack_public_path__ = __webpack_public_path__;
import '../stylesheets/react-select/select.less';
import '../stylesheets/superset.less';
// fonts are compiled with webpack config public path and not updating dynamic path as per __webpack_public_path__
// , so re-defining @font-face  and using hash-value as name 
var fontStyle = document.createElement('style');
fontStyle.appendChild(document.createTextNode("\
@font-face {\
font-family: Glyphicons Halflings;\
src: url("+ __webpack_public_path__ + "f4769f9bdb7466be65088239c12046d1.eot);\
src: url("+ __webpack_public_path__ + "f4769f9bdb7466be65088239c12046d1.eot?#iefix) format('embedded-opentype'),\
url("+ __webpack_public_path__ + "448c34a56d699c29117adc64c43affeb.woff2) format('woff2'), \
url("+ __webpack_public_path__ + "fa2772327f55d8198301fdb8bcfc8158.woff) format('woff'),\
url("+ __webpack_public_path__ + "e18bbf611f2a2e43afc071aa2f4e1512.ttf) format('truetype'),\
url("+ __webpack_public_path__ + "89889688147bd7575d6327160d64e760.svg#glyphicons_halflingsregular) format('svg');\
}\
"));
document.head.appendChild(fontStyle);


