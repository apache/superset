(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();import "core-js/modules/es.string.replace.js";var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import { format as d3Format } from 'd3-format';
import NumberFormatter from '../NumberFormatter';
import NumberFormats from '../NumberFormats';

const siFormatter = d3Format(`.3~s`);
const float2PointFormatter = d3Format(`.2~f`);
const float4PointFormatter = d3Format(`.4~f`);

function formatValue(value) {
  if (value === 0) {
    return '0';
  }
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1000) {
    // Normal human being are more familiar
    // with billion (B) that giga (G)
    return siFormatter(value).replace('G', 'B');
  }
  if (absoluteValue >= 1) {
    return float2PointFormatter(value);
  }
  if (absoluteValue >= 0.001) {
    return float4PointFormatter(value);
  }
  if (absoluteValue > 0.000001) {
    return `${siFormatter(value * 1000000)}µ`;
  }
  return siFormatter(value);
}

export default function createSmartNumberFormatter(
config =




{})
{
  const { description, signed = false, id, label } = config;
  const getSign = signed ? (value) => value > 0 ? '+' : '' : () => '';

  return new NumberFormatter({
    description,
    formatFunc: (value) => `${getSign(value)}${formatValue(value)}`,
    id:
    id || signed ?
    NumberFormats.SMART_NUMBER_SIGNED :
    NumberFormats.SMART_NUMBER,
    label: label != null ? label : 'Adaptive formatter' });

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(siFormatter, "siFormatter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/factories/createSmartNumberFormatter.ts");reactHotLoader.register(float2PointFormatter, "float2PointFormatter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/factories/createSmartNumberFormatter.ts");reactHotLoader.register(float4PointFormatter, "float4PointFormatter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/factories/createSmartNumberFormatter.ts");reactHotLoader.register(formatValue, "formatValue", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/factories/createSmartNumberFormatter.ts");reactHotLoader.register(createSmartNumberFormatter, "createSmartNumberFormatter", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/number-format/factories/createSmartNumberFormatter.ts");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();