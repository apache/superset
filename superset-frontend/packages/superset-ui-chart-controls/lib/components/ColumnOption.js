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
import { styled } from '@superset-ui/core';
import { Tooltip } from './Tooltip';
import { ColumnTypeLabel } from './ColumnTypeLabel';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';
import CertifiedIconWithTooltip from './CertifiedIconWithTooltip';import { jsx as ___EmotionJSX } from "@emotion/react";









const StyleOverrides = styled.span`
  svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;

export function ColumnOption({
  column,
  labelRef,
  showType = false,
  showTooltip = true })
{
  const { expression, column_name, type_generic } = column;
  const hasExpression = expression && expression !== column_name;
  const type = hasExpression ? 'expression' : type_generic;

  return (
    ___EmotionJSX(StyleOverrides, null,
    showType && type !== undefined && ___EmotionJSX(ColumnTypeLabel, { type: type }),
    column.is_certified &&
    ___EmotionJSX(CertifiedIconWithTooltip, {
      metricName: column.metric_name,
      certifiedBy: column.certified_by,
      details: column.certification_details }),


    showTooltip ?
    ___EmotionJSX(Tooltip, {
      id: "metric-name-tooltip",
      title: column.verbose_name || column.column_name,
      trigger: ['hover'],
      placement: "top" },

    ___EmotionJSX("span", {
      className: "m-r-5 option-label column-option-label",
      ref: labelRef },

    column.verbose_name || column.column_name)) :



    ___EmotionJSX("span", { className: "m-r-5 option-label column-option-label", ref: labelRef },
    column.verbose_name || column.column_name),


    column.description &&
    ___EmotionJSX(InfoTooltipWithTrigger, {
      className: "m-r-5 text-muted",
      icon: "info",
      tooltip: column.description,
      label: `descr-${column.column_name}`,
      placement: "top" }),


    hasExpression &&
    ___EmotionJSX(InfoTooltipWithTrigger, {
      className: "m-r-5 text-muted",
      icon: "question-circle-o",
      tooltip: column.expression,
      label: `expr-${column.column_name}`,
      placement: "top" })));




}ColumnOption.propTypes = { showType: _pt.bool, showTooltip: _pt.bool };const _default =

ColumnOption;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(StyleOverrides, "StyleOverrides", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ColumnOption.tsx");reactHotLoader.register(ColumnOption, "ColumnOption", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ColumnOption.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ColumnOption.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();