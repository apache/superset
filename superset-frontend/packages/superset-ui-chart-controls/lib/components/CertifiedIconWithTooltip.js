import _pt from "prop-types";import _kebabCase from "lodash/kebabCase";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /**
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

import { t, useTheme, styled } from '@superset-ui/core';
import Tooltip from './Tooltip';import { jsx as ___EmotionJSX } from "@emotion/react";







const StyledDiv = styled.div`
  margin-bottom: ${({ theme }) => theme.gridUnit * 2}px;
`;

function CertifiedIconWithTooltip({
  certifiedBy,
  details,
  metricName })
{
  const theme = useTheme();
  return (
    ___EmotionJSX(Tooltip, {
      id: `${_kebabCase(metricName)}-tooltip`,
      title:
      ___EmotionJSX("div", null,
      certifiedBy &&
      ___EmotionJSX(StyledDiv, null, t('Certified by %s', certifiedBy)),

      ___EmotionJSX("div", null, details)) },




    ___EmotionJSX("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      enableBackground: "new 0 0 24 24",
      height: "16",
      viewBox: "0 0 24 24",
      width: "16" },

    ___EmotionJSX("g", null,
    ___EmotionJSX("path", {
      fill: theme.colors.primary.base,
      d: "M23,12l-2.44-2.79l0.34-3.69l-3.61-0.82L15.4,1.5L12,2.96L8.6,1.5L6.71,4.69L3.1,5.5L3.44,9.2L1,12l2.44,2.79l-0.34,3.7 l3.61,0.82L8.6,22.5l3.4-1.47l3.4,1.46l1.89-3.19l3.61-0.82l-0.34-3.69L23,12z M9.38,16.01L7,13.61c-0.39-0.39-0.39-1.02,0-1.41 l0.07-0.07c0.39-0.39,1.03-0.39,1.42,0l1.61,1.62l5.15-5.16c0.39-0.39,1.03-0.39,1.42,0l0.07,0.07c0.39,0.39,0.39,1.02,0,1.41 l-5.92,5.94C10.41,16.4,9.78,16.4,9.38,16.01z" })))));





}__signature__(CertifiedIconWithTooltip, "useTheme{theme}", () => [useTheme]);CertifiedIconWithTooltip.propTypes = { certifiedBy: _pt.oneOfType([_pt.string, _pt.oneOf([null])]), details: _pt.oneOfType([_pt.string, _pt.oneOf([null])]), metricName: _pt.string.isRequired };const _default =

CertifiedIconWithTooltip;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(StyledDiv, "StyledDiv", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/CertifiedIconWithTooltip.tsx");reactHotLoader.register(CertifiedIconWithTooltip, "CertifiedIconWithTooltip", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/CertifiedIconWithTooltip.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/CertifiedIconWithTooltip.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();