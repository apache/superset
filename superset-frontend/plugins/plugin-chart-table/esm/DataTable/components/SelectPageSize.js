import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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
import { formatSelectOptions } from '@superset-ui/chart-controls';import { jsx as ___EmotionJSX } from "@emotion/react";









function DefaultSelectRenderer({
  current,
  options,
  onChange })
{
  return (
    ___EmotionJSX("span", { className: "dt-select-page-size form-inline" }, "Show",
    ' ',
    ___EmotionJSX("select", {
      className: "form-control input-sm",
      value: current,
      onBlur: () => {},
      onChange: (e) => {
        onChange(Number(e.target.value));
      } },

    options.map((option) => {
      const [size, text] = Array.isArray(option) ?
      option :
      [option, option];
      return (
        ___EmotionJSX("option", { key: size, value: size },
        text));


    })),
    ' ', "entries"));



}DefaultSelectRenderer.propTypes = { current: _pt.number.isRequired, options: _pt.array.isRequired, onChange: _pt.func.isRequired };







function getOptionValue(x) {
  return Array.isArray(x) ? x[0] : x;
}const _default = /*#__PURE__*/

React.memo(function SelectPageSize({
  total,
  options: sizeOptions,
  current: currentSize,
  selectRenderer,
  onChange })
{
  const sizeOptionValues = sizeOptions.map(getOptionValue);
  let options = [...sizeOptions];
  // insert current size to list
  if (
  currentSize !== undefined && (
  currentSize !== total || !sizeOptionValues.includes(0)) &&
  !sizeOptionValues.includes(currentSize))
  {
    options = [...sizeOptions];
    options.splice(
    sizeOptionValues.findIndex((x) => x > currentSize),
    0,
    formatSelectOptions([currentSize])[0]);

  }
  const current = currentSize === undefined ? sizeOptionValues[0] : currentSize;
  const SelectRenderer = selectRenderer || DefaultSelectRenderer;
  return (
    ___EmotionJSX(SelectRenderer, { current: current, options: options, onChange: onChange }));

});export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DefaultSelectRenderer, "DefaultSelectRenderer", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/components/SelectPageSize.tsx");reactHotLoader.register(getOptionValue, "getOptionValue", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/components/SelectPageSize.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/components/SelectPageSize.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();