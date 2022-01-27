import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import React, { PureComponent } from 'react';import { jsx as ___EmotionJSX } from "@emotion/react";









const defaultProps = {
  className: '',
  data: [] };







const VALUE_CELL_STYLE = { paddingLeft: 8, textAlign: 'right' };

export default class TooltipTable extends PureComponent {


  render() {
    const { className, data } = this.props;

    return (
      ___EmotionJSX("table", { className: className },
      ___EmotionJSX("tbody", null,
      data.map(({ key, keyColumn, keyStyle, valueColumn, valueStyle }) =>
      ___EmotionJSX("tr", { key: key },
      ___EmotionJSX("td", { style: keyStyle }, keyColumn != null ? keyColumn : key),
      ___EmotionJSX("td", {
        style:
        valueStyle ?
        { ...VALUE_CELL_STYLE, ...valueStyle } :
        VALUE_CELL_STYLE },


      valueColumn))))));






  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}}TooltipTable.propTypes = { className: _pt.string, data: _pt.arrayOf(_pt.shape({ key: _pt.oneOfType([_pt.string, _pt.number]).isRequired, keyColumn: _pt.node, valueColumn: _pt.node.isRequired })).isRequired };TooltipTable.defaultProps = defaultProps;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(defaultProps, "defaultProps", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/tooltip/TooltipTable.tsx");reactHotLoader.register(VALUE_CELL_STYLE, "VALUE_CELL_STYLE", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/tooltip/TooltipTable.tsx");reactHotLoader.register(TooltipTable, "TooltipTable", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-core/src/chart-composition/tooltip/TooltipTable.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();