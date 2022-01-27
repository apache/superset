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

export const LUMINANCE_RED_WEIGHT = 0.2126;
export const LUMINANCE_GREEN_WEIGHT = 0.7152;
export const LUMINANCE_BLUE_WEIGHT = 0.0722;

export default function luminanceFromRGB(r, g, b) {
  // Formula: https://en.wikipedia.org/wiki/Relative_luminance
  return (
    LUMINANCE_RED_WEIGHT * r +
    LUMINANCE_GREEN_WEIGHT * g +
    LUMINANCE_BLUE_WEIGHT * b);

};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(LUMINANCE_RED_WEIGHT, "LUMINANCE_RED_WEIGHT", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-map-box/src/utils/luminanceFromRGB.js");reactHotLoader.register(LUMINANCE_GREEN_WEIGHT, "LUMINANCE_GREEN_WEIGHT", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-map-box/src/utils/luminanceFromRGB.js");reactHotLoader.register(LUMINANCE_BLUE_WEIGHT, "LUMINANCE_BLUE_WEIGHT", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-map-box/src/utils/luminanceFromRGB.js");reactHotLoader.register(luminanceFromRGB, "luminanceFromRGB", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-map-box/src/utils/luminanceFromRGB.js");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();