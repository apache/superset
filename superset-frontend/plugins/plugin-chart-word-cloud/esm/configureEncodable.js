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

import {
Encodable,



defaultColorSchemeResolver,
addPrefix } from
'encodable';
import {
CategoricalColorNamespace,
getCategoricalSchemeRegistry,
getSequentialSchemeRegistry,
getNumberFormatter,
getTimeFormatter,
LOCAL_PREFIX,
getTimeFormatterRegistry } from
'@superset-ui/core';

const timeFormat = ({
  format,
  formatInLocalTime = false } =
{}) => {
  const formatString = formatInLocalTime ?
  addPrefix(
  LOCAL_PREFIX,
  format != null ? format : getTimeFormatterRegistry().getDefaultKey()) :

  format;

  return getTimeFormatter(formatString);
};

const colorSchemeResolver = ({
  name,
  type = 'categorical' } =
{}) => {
  if (type === 'sequential') {
    const scheme = getSequentialSchemeRegistry().get(name);

    return typeof scheme === 'undefined' ?
    scheme :
    { type: 'sequential', ...scheme };
  }
  if (type === 'categorical') {
    const scheme = getCategoricalSchemeRegistry().get(name);

    return typeof scheme === 'undefined' ?
    scheme :
    { type: 'categorical', ...scheme };
  }
  return defaultColorSchemeResolver({ name, type });
};

const colorScaleResolver = ({
  name,
  namespace } =
{}) => CategoricalColorNamespace.getScale(name, namespace);

export default function configureEncodable() {
  Encodable.setNumberFormatResolver(getNumberFormatter).
  setTimeFormatResolver(timeFormat).
  setColorSchemeResolver(colorSchemeResolver).
  setCategoricalColorScaleResolver(colorScaleResolver);
};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(timeFormat, "timeFormat", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/configureEncodable.ts");reactHotLoader.register(colorSchemeResolver, "colorSchemeResolver", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/configureEncodable.ts");reactHotLoader.register(colorScaleResolver, "colorScaleResolver", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/configureEncodable.ts");reactHotLoader.register(configureEncodable, "configureEncodable", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-word-cloud/src/configureEncodable.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();