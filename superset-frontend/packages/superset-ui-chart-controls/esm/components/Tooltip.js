import _extends from "@babel/runtime-corejs3/helpers/extends";(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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
import { useTheme, css } from '@superset-ui/core';
import { Tooltip as BaseTooltip } from 'antd';

import { Global } from '@emotion/react';import { jsx as ___EmotionJSX } from "@emotion/react";



export const Tooltip = ({ overlayStyle, color, ...props }) => {
  const theme = useTheme();
  const defaultColor = `${theme.colors.grayscale.dark2}e6`;
  return (
    ___EmotionJSX(React.Fragment, null,

    ___EmotionJSX(Global, {
      styles: css`
          .ant-tooltip-open {
            display: inline-block;
            &::after {
              content: '';
              display: block;
            }
          }
        ` }),

    ___EmotionJSX(BaseTooltip, _extends({
      overlayStyle: {
        fontSize: theme.typography.sizes.s,
        lineHeight: '1.6',
        ...overlayStyle },

      color: defaultColor || color },
    props))));



};__signature__(Tooltip, "useTheme{theme}", () => [useTheme]);const _default =

Tooltip;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(Tooltip, "Tooltip", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/Tooltip.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/packages/superset-ui-chart-controls/src/components/Tooltip.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();