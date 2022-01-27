(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import makeSingleton from '../utils/makeSingleton';
import ColorSchemeRegistry from './ColorSchemeRegistry';

import schemes from './colorSchemes/sequential/d3';

class SequentialSchemeRegistry extends ColorSchemeRegistry {
  constructor() {
    super();

    this.registerValue('SUPERSET_DEFAULT', schemes[0]);
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}
const getInstance = makeSingleton(SequentialSchemeRegistry);const _default =

getInstance;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(SequentialSchemeRegistry, "SequentialSchemeRegistry", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/SequentialSchemeRegistrySingleton.ts");reactHotLoader.register(getInstance, "getInstance", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/SequentialSchemeRegistrySingleton.ts");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/SequentialSchemeRegistrySingleton.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();