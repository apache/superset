import _pt from "prop-types";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /* eslint-disable no-nested-ternary */
/**
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
import { GenericDataType } from '@superset-ui/core';
import React from 'react';import { jsx as ___EmotionJSX } from "@emotion/react";









export function ColumnTypeLabel({ type }) {
  let stringIcon = '?';

  if (type === '' || type === 'expression') {
    stringIcon = 'ƒ';
  } else if (type === 'aggregate') {
    stringIcon = 'AGG';
  } else if (type === GenericDataType.STRING) {
    stringIcon = 'ABC';
  } else if (type === GenericDataType.NUMERIC) {
    stringIcon = '#';
  } else if (type === GenericDataType.BOOLEAN) {
    stringIcon = 'T/F';
  } else if (type === GenericDataType.TEMPORAL) {
    stringIcon = 'time';
  }

  const typeIcon =
  stringIcon === 'time' ?
  ___EmotionJSX("i", { className: "fa fa-clock-o type-label" }) :

  ___EmotionJSX("div", { className: "type-label" }, stringIcon);


  return ___EmotionJSX("span", null, typeIcon);
}const _default =

ColumnTypeLabel;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ColumnTypeLabel, "ColumnTypeLabel", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ColumnTypeLabel.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ColumnTypeLabel.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();