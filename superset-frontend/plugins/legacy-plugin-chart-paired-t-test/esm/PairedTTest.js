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
/* eslint-disable react/no-array-index-key */
import PropTypes from 'prop-types';
import React from 'react';
import TTestTable, { dataPropType } from './TTestTable';
import './PairedTTest.css';import { jsx as ___EmotionJSX } from "@emotion/react";

const propTypes = {
  alpha: PropTypes.number,
  className: PropTypes.string,
  data: PropTypes.objectOf(dataPropType).isRequired,
  groups: PropTypes.arrayOf(PropTypes.string).isRequired,
  liftValPrec: PropTypes.number,
  metrics: PropTypes.arrayOf(PropTypes.string).isRequired,
  pValPrec: PropTypes.number };


const defaultProps = {
  alpha: 0.05,
  className: '',
  liftValPrec: 4,
  pValPrec: 6 };


class PairedTTest extends React.PureComponent {
  render() {
    const { className, metrics, groups, data, alpha, pValPrec, liftValPrec } =
    this.props;

    return (
      ___EmotionJSX("div", { className: `superset-legacy-chart-paired-t-test ${className}` },
      ___EmotionJSX("div", { className: "paired-ttest-table" },
      ___EmotionJSX("div", { className: "scrollbar-content" },
      metrics.map((metric, i) =>
      ___EmotionJSX(TTestTable, {
        key: i,
        metric: metric,
        groups: groups,
        data: data[metric],
        alpha: alpha,
        pValPrec: Math.min(pValPrec, 32),
        liftValPrec: Math.min(liftValPrec, 32) }))))));






  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}
PairedTTest.propTypes = propTypes;
PairedTTest.defaultProps = defaultProps;const _default =

PairedTTest;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(propTypes, "propTypes", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-paired-t-test/src/PairedTTest.jsx");reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-paired-t-test/src/PairedTTest.jsx");reactHotLoader.register(PairedTTest, "PairedTTest", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-paired-t-test/src/PairedTTest.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-paired-t-test/src/PairedTTest.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();