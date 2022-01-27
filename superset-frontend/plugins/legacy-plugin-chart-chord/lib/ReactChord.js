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
import Component from './Chord';import { jsx as ___EmotionJSX } from "@emotion/react";

const ReactComponent = reactify(Component);

const Chord = ({ className, ...otherProps }) =>
___EmotionJSX("div", { className: className },
___EmotionJSX(ReactComponent, otherProps));



Chord.defaultProps = {
  otherProps: {} };


Chord.propTypes = {
  className: PropTypes.string.isRequired,
  otherProps: PropTypes.objectOf(PropTypes.any) };const _default =


styled(Chord)`
  .superset-legacy-chart-chord svg #circle circle {
    fill: none;
    pointer-events: all;
  }
  .superset-legacy-chart-chord svg .group path {
    fill-opacity: 0.6;
  }
  .superset-legacy-chart-chord svg path.chord {
    stroke: #000;
    stroke-width: 0.25px;
  }
  .superset-legacy-chart-chord svg #circle:hover path.fade {
    opacity: 0.2;
  }
`;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ReactComponent, "ReactComponent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-chord/src/ReactChord.jsx");reactHotLoader.register(Chord, "Chord", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-chord/src/ReactChord.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-chord/src/ReactChord.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();