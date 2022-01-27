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

import CategoricalColorScale from './CategoricalColorScale';

import getCategoricalSchemeRegistry from './CategoricalSchemeRegistrySingleton';
import stringifyAndTrim from './stringifyAndTrim';

export default class CategoricalColorNamespace {








  constructor(name) {this.name = void 0;this.forcedItems = void 0;this.scales = void 0;
    this.name = name;
    this.scales = {};
    this.forcedItems = {};
  }

  getScale(schemeId) {var _ref, _scheme$colors;
    const id = (_ref = schemeId != null ? schemeId : getCategoricalSchemeRegistry().getDefaultKey()) != null ? _ref : '';
    const scheme = getCategoricalSchemeRegistry().get(id);
    return new CategoricalColorScale((_scheme$colors = scheme == null ? void 0 : scheme.colors) != null ? _scheme$colors : [], this.forcedItems);
  }

  /**
   * Enforce specific color for given value
   * This will apply across all color scales
   * in this namespace.
   * @param {*} value value
   * @param {*} forcedColor color
   */
  setColor(value, forcedColor) {
    this.forcedItems[stringifyAndTrim(value)] = forcedColor;

    return this;
  }

  resetColors() {
    this.forcedItems = {};
  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}
const namespaces =

{};

export const DEFAULT_NAMESPACE = 'GLOBAL';

export function getNamespace(name = DEFAULT_NAMESPACE) {
  const instance = namespaces[name];
  if (instance) {
    return instance;
  }
  const newInstance = new CategoricalColorNamespace(name);
  namespaces[name] = newInstance;

  return newInstance;
}

export function getColor(
value,
schemeId,
namespace)
{
  return getNamespace(namespace).getScale(schemeId).getColor(value);
}

/*
  Returns a new scale instance within the same namespace.
  Especially useful when a chart is booting for the first time
*/
export function getScale(scheme, namespace) {
  return getNamespace(namespace).getScale(scheme);
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(CategoricalColorNamespace, "CategoricalColorNamespace", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/CategoricalColorNamespace.ts");reactHotLoader.register(namespaces, "namespaces", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/CategoricalColorNamespace.ts");reactHotLoader.register(DEFAULT_NAMESPACE, "DEFAULT_NAMESPACE", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/CategoricalColorNamespace.ts");reactHotLoader.register(getNamespace, "getNamespace", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/CategoricalColorNamespace.ts");reactHotLoader.register(getColor, "getColor", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/CategoricalColorNamespace.ts");reactHotLoader.register(getScale, "getScale", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/color/CategoricalColorNamespace.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();