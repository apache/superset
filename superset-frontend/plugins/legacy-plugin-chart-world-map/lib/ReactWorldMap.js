(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import React from 'react';
import PropTypes from 'prop-types';
import { styled, reactify } from '@superset-ui/core';
import WorldMap from './WorldMap';import { jsx as ___EmotionJSX } from "@emotion/react";

const ReactWorldMap = reactify(WorldMap);

const WorldMapComponent = ({ className, ...otherProps }) =>
___EmotionJSX("div", { className: className },
___EmotionJSX(ReactWorldMap, otherProps));



WorldMapComponent.propTypes = {
  className: PropTypes.string.isRequired };const _default =


styled(WorldMapComponent)`
  .superset-legacy-chart-world-map {
    position: relative;
    svg {
      background-color: #feffff;
    }
  }
`;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ReactWorldMap, "ReactWorldMap", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-world-map/src/ReactWorldMap.jsx");reactHotLoader.register(WorldMapComponent, "WorldMapComponent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-world-map/src/ReactWorldMap.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-world-map/src/ReactWorldMap.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();