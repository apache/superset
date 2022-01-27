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
import React from 'react';
import { reactify, styled } from '@superset-ui/core';
import PropTypes from 'prop-types';
import SanKey from './Sankey';import { jsx as ___EmotionJSX } from "@emotion/react";

const ReactSanKey = reactify(SanKey);

const SankeyComponent = ({ className, ...otherProps }) =>
___EmotionJSX("div", { className: className },
___EmotionJSX(ReactSanKey, otherProps));



SankeyComponent.propTypes = {
  className: PropTypes.string.isRequired };const _default =


styled(SankeyComponent)`
  .superset-legacy-chart-sankey {
    .node {
      rect {
        cursor: move;
        fill-opacity: 0.9;
        shape-rendering: crispEdges;
      }
      text {
        pointer-events: none;
        text-shadow: 0 1px 0 #fff;
        font-size: ${({ fontSize }) => fontSize}em;
      }
    }
    .link {
      fill: none;
      stroke: #000;
      stroke-opacity: 0.2;
      &:hover {
        stroke-opacity: 0.5;
      }
    }
    .opacity-0 {
      opacity: 0;
    }
  }
  .sankey-tooltip {
    position: absolute;
    width: auto;
    background: #ddd;
    padding: 10px;
    font-size: ${({ fontSize }) => fontSize}em;
    font-weight: ${({ theme }) => theme.typography.weights.light};
    color: #000;
    border: 1px solid #fff;
    text-align: center;
    pointer-events: none;
  }
`;export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(ReactSanKey, "ReactSanKey", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-sankey/src/ReactSankey.jsx");reactHotLoader.register(SankeyComponent, "SankeyComponent", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-sankey/src/ReactSankey.jsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/legacy-plugin-chart-sankey/src/ReactSankey.jsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();