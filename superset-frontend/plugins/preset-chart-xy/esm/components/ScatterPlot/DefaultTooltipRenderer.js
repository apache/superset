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

import React from 'react';
import { TooltipFrame, TooltipTable } from '@superset-ui/core';
import { isFieldDef } from 'encodable';import { jsx as ___EmotionJSX } from "@emotion/react";


export default function DefaultTooltipRenderer({
  datum,
  encoder })
{
  const { channels } = encoder;
  const { x, y, size, fill, stroke } = channels;

  const tooltipRows = [
  { key: 'x', keyColumn: x.getTitle(), valueColumn: x.formatDatum(datum) },
  { key: 'y', keyColumn: y.getTitle(), valueColumn: y.formatDatum(datum) }];


  if (isFieldDef(fill.definition)) {
    tooltipRows.push({
      key: 'fill',
      keyColumn: fill.getTitle(),
      valueColumn: fill.formatDatum(datum) });

  }
  if (isFieldDef(stroke.definition)) {
    tooltipRows.push({
      key: 'stroke',
      keyColumn: stroke.getTitle(),
      valueColumn: stroke.formatDatum(datum) });

  }
  if (isFieldDef(size.definition)) {
    tooltipRows.push({
      key: 'size',
      keyColumn: size.getTitle(),
      valueColumn: size.formatDatum(datum) });

  }
  channels.group.forEach((g) => {
    tooltipRows.push({
      key: `${g.name}`,
      keyColumn: g.getTitle(),
      valueColumn: g.formatDatum(datum) });

  });
  channels.tooltip.forEach((g) => {
    tooltipRows.push({
      key: `${g.name}`,
      keyColumn: g.getTitle(),
      valueColumn: g.formatDatum(datum) });

  });

  return (
    ___EmotionJSX(TooltipFrame, null,
    ___EmotionJSX(TooltipTable, { data: tooltipRows })));


};(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(DefaultTooltipRenderer, "DefaultTooltipRenderer", "/Users/evan/GitHub/superset/superset-frontend/plugins/preset-chart-xy/src/components/ScatterPlot/DefaultTooltipRenderer.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();