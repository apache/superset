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
import { reactify, styled } from '@superset-ui/core';
import PropTypes from 'prop-types';
import Component from './ForceDirected';import { jsx as ___EmotionJSX } from "@emotion/react";

const ReactComponent = reactify(Component);

const ForceDirected = ({ className, ...otherProps }) =>
___EmotionJSX("div", { className: className },
___EmotionJSX(ReactComponent, otherProps));



ForceDirected.propTypes = {
  className: PropTypes.string.isRequired };const _default =


styled(ForceDirected)`
  .superset-legacy-chart-force-directed {
    path.link {
      fill: none;
      stroke: #000;
      stroke-width: 1.5px;
    }
    circle {
      fill: #ccc;
      stroke: #000;
      stroke-width: 1.5px;
      stroke-opacity: 1;
      opacity: 0.75;
    }
    text {
      fill: #000;
      font: 10px sans-serif;
      pointer-events: none;
    }
  }
`;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ReactComponent, "ReactComponent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-force-directed/src/ReactForceDirected.jsx");reactHotLoader.register(ForceDirected, "ForceDirected", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-force-directed/src/ReactForceDirected.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-force-directed/src/ReactForceDirected.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();