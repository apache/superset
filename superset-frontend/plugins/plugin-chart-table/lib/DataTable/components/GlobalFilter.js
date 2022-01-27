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

import useAsyncState from '../utils/useAsyncState';import { jsx as ___EmotionJSX } from "@emotion/react";
















function DefaultSearchInput({ count, value, onChange }) {
  return (
    ___EmotionJSX("span", { className: "dt-global-filter" }, "Search",
    ' ',
    ___EmotionJSX("input", {
      className: "form-control input-sm",
      placeholder: `${count} records...`,
      value: value,
      onChange: onChange })));



}DefaultSearchInput.propTypes = { count: _pt.number.isRequired, value: _pt.string.isRequired, onChange: _pt.func.isRequired };const _default =

React.memo(__signature__(function GlobalFilter(

{
  preGlobalFilteredRows,
  filterValue = '',
  searchInput,
  setGlobalFilter })
{
  const count = preGlobalFilteredRows.length;
  const [value, setValue] = useAsyncState(
  filterValue,
  (newValue) => {
    setGlobalFilter(newValue || undefined);
  },
  200);


  const SearchInput = searchInput || DefaultSearchInput;

  return (
    ___EmotionJSX(SearchInput, {
      count: count,
      value: value,
      onChange: (e) => {
        const target = e.target;
        e.preventDefault();
        setValue(target.value);
      } }));


}, "useAsyncState{[value, setValue]}", () => [useAsyncState]));export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DefaultSearchInput, "DefaultSearchInput", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/components/GlobalFilter.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-table/src/DataTable/components/GlobalFilter.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();