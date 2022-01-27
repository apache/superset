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
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from './InfoTooltipWithTrigger';
import { Tooltip } from './Tooltip';import { jsx as ___EmotionJSX } from "@emotion/react";



















export default function ControlHeader({
  name,
  description,
  label,
  tooltipOnClick,
  onClick,
  warning,
  danger,
  leftNode,
  rightNode,
  validationErrors = [],
  renderTrigger = false,
  hovered = false,
  required = false })
{
  const renderOptionalIcons = () => {
    if (hovered) {
      return (
        ___EmotionJSX("span", null,
        description &&
        ___EmotionJSX("span", null,
        ___EmotionJSX(InfoTooltipWithTrigger, {
          label: t('description'),
          tooltip: description,
          placement: "top",
          onClick: tooltipOnClick }),
        ' '),


        renderTrigger &&
        ___EmotionJSX("span", null,
        ___EmotionJSX(InfoTooltipWithTrigger, {
          label: t('bolt'),
          tooltip: t('Changing this control takes effect instantly'),
          placement: "top",
          icon: "bolt" }),
        ' ')));




    }
    return null;
  };

  if (!label) {
    return null;
  }
  const labelClass = validationErrors.length > 0 ? 'text-danger' : '';
  return (
    ___EmotionJSX("div", { className: "ControlHeader", "data-test": `${name}-header` },
    ___EmotionJSX("div", { className: "pull-left" },
    ___EmotionJSX("label", { className: "control-label", htmlFor: name },
    leftNode && ___EmotionJSX("span", null, leftNode),
    ___EmotionJSX("span", {
      role: "button",
      tabIndex: 0,
      onClick: onClick,
      className: labelClass,
      style: { cursor: onClick ? 'pointer' : '' } },

    label),
    ' ',
    warning &&
    ___EmotionJSX("span", null,
    ___EmotionJSX(Tooltip, { id: "error-tooltip", placement: "top", title: warning },
    ___EmotionJSX("i", { className: "fa fa-exclamation-circle text-warning" })),
    ' '),


    danger &&
    ___EmotionJSX("span", null,
    ___EmotionJSX(Tooltip, { id: "error-tooltip", placement: "top", title: danger },
    ___EmotionJSX("i", { className: "fa fa-exclamation-circle text-danger" })),
    ' '),


    validationErrors.length > 0 &&
    ___EmotionJSX("span", null,
    ___EmotionJSX(Tooltip, {
      id: "error-tooltip",
      placement: "top",
      title: validationErrors.join(' ') },

    ___EmotionJSX("i", { className: "fa fa-exclamation-circle text-danger" })),
    ' '),


    renderOptionalIcons(),
    required &&
    ___EmotionJSX("span", { className: "text-danger m-l-4" },
    ___EmotionJSX("strong", null, "*")))),




    rightNode && ___EmotionJSX("div", { className: "pull-right" }, rightNode),
    ___EmotionJSX("div", { className: "clearfix" })));


}ControlHeader.propTypes = { name: _pt.string, label: _pt.node, description: _pt.node, validationErrors: _pt.arrayOf(_pt.string), renderTrigger: _pt.bool, rightNode: _pt.node, leftNode: _pt.node, hovered: _pt.bool, required: _pt.bool, warning: _pt.string, danger: _pt.string, onClick: _pt.func, tooltipOnClick: _pt.func };;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ControlHeader, "ControlHeader", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/ControlHeader.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();