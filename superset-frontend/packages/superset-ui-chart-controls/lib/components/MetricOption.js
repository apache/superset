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
import { styled, SafeMarkdown } from '@superset-ui/core';
import InfoTooltipWithTrigger from './InfoTooltipWithTrigger';
import { ColumnTypeLabel } from './ColumnTypeLabel';
import CertifiedIconWithTooltip from './CertifiedIconWithTooltip';
import Tooltip from './Tooltip';import { jsx as ___EmotionJSX } from "@emotion/react";

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;

  > svg {
    margin-right: ${({ theme }) => theme.gridUnit}px;
  }
`;











export function MetricOption({
  metric,
  labelRef,
  openInNewWindow = false,
  showFormula = true,
  showType = false,
  showTooltip = true,
  url = '' })
{
  const verbose = metric.verbose_name || metric.metric_name || metric.label;
  const link = url ?
  ___EmotionJSX("a", { href: url, target: openInNewWindow ? '_blank' : '', rel: "noreferrer" },
  verbose) :


  verbose;


  const warningMarkdown = metric.warning_markdown || metric.warning_text;

  return (
    ___EmotionJSX(FlexRowContainer, { className: "metric-option" },
    showType && ___EmotionJSX(ColumnTypeLabel, { type: "expression" }),
    metric.is_certified &&
    ___EmotionJSX(CertifiedIconWithTooltip, {
      metricName: metric.metric_name,
      certifiedBy: metric.certified_by,
      details: metric.certification_details }),


    showTooltip ?
    ___EmotionJSX(Tooltip, {
      id: "metric-name-tooltip",
      title: verbose,
      trigger: ['hover'],
      placement: "top" },

    ___EmotionJSX("span", { className: "option-label metric-option-label", ref: labelRef },
    link)) :



    ___EmotionJSX("span", { className: "option-label metric-option-label", ref: labelRef },
    link),


    metric.description &&
    ___EmotionJSX(InfoTooltipWithTrigger, {
      className: "text-muted",
      icon: "info",
      tooltip: metric.description,
      label: `descr-${metric.metric_name}` }),


    showFormula &&
    ___EmotionJSX(InfoTooltipWithTrigger, {
      className: "text-muted",
      icon: "question-circle-o",
      tooltip: metric.expression,
      label: `expr-${metric.metric_name}` }),


    warningMarkdown &&
    ___EmotionJSX(InfoTooltipWithTrigger, {
      className: "text-warning",
      icon: "warning",
      tooltip: ___EmotionJSX(SafeMarkdown, { source: warningMarkdown }),
      label: `warn-${metric.metric_name}` })));




}MetricOption.propTypes = { openInNewWindow: _pt.bool, showFormula: _pt.bool, showType: _pt.bool, showTooltip: _pt.bool, url: _pt.string };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(FlexRowContainer, "FlexRowContainer", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/MetricOption.tsx");reactHotLoader.register(MetricOption, "MetricOption", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/MetricOption.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();