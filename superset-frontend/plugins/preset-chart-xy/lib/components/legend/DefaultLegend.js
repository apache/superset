(function () {var enterModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.enterModule : undefined;enterModule && enterModule(module);})();var __signature__ = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default.signature : function (a) {return a;}; /*
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

import React, { PureComponent } from 'react';


import DefaultLegendGroup from './DefaultLegendGroup';import { jsx as ___EmotionJSX } from "@emotion/react";

const LEGEND_CONTAINER_STYLE = {
  display: 'flex',
  flexBasis: 'auto',
  flexGrow: 1,
  flexShrink: 1,
  maxHeight: 100,
  overflowY: 'auto',
  position: 'relative' };




export default class DefaultLegend extends

PureComponent {
  render() {
    const {
      groups,
      LegendGroupRenderer = DefaultLegendGroup,
      LegendItemRenderer,
      LegendItemMarkRenderer,
      LegendItemLabelRenderer,
      style } =
    this.props;

    const combinedStyle =
    typeof style === 'undefined' ?
    LEGEND_CONTAINER_STYLE :
    { ...LEGEND_CONTAINER_STYLE, ...style };

    return (
      ___EmotionJSX("div", { style: combinedStyle },
      groups.
      filter((group) => 'items' in group && group.items.length > 0).
      map((group) =>
      ___EmotionJSX(LegendGroupRenderer, {
        key: group.field,
        group: group,
        ItemRenderer: LegendItemRenderer,
        ItemMarkRenderer: LegendItemMarkRenderer,
        ItemLabelRenderer: LegendItemLabelRenderer }))));




  } // @ts-ignore
  __reactstandin__regenerateByEval(key, code) {// @ts-ignore
    this[key] = eval(code);}};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(LEGEND_CONTAINER_STYLE, "LEGEND_CONTAINER_STYLE", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/legend/DefaultLegend.tsx");reactHotLoader.register(DefaultLegend, "DefaultLegend", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/legend/DefaultLegend.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();