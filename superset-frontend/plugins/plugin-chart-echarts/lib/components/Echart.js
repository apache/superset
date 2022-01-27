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
import React, {
useRef,
useEffect,
useMemo,
forwardRef,
useImperativeHandle } from
'react';
import { styled } from '@superset-ui/core';
import { init } from 'echarts';import { jsx as ___EmotionJSX } from "@emotion/react";


const Styles = styled.div`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

function Echart(
{
  width,
  height,
  echartOptions,
  eventHandlers,
  zrEventHandlers,
  selectedValues = {} },

ref)
{
  const divRef = useRef(null);
  const chartRef = useRef();
  const currentSelection = useMemo(
  () => Object.keys(selectedValues) || [],
  [selectedValues]);

  const previousSelection = useRef([]);

  useImperativeHandle(ref, () => ({
    getEchartInstance: () => chartRef.current }));


  useEffect(() => {
    if (!divRef.current) return;
    if (!chartRef.current) {
      chartRef.current = init(divRef.current);
    }

    Object.entries(eventHandlers || {}).forEach(([name, handler]) => {var _chartRef$current, _chartRef$current2;
      (_chartRef$current = chartRef.current) == null ? void 0 : _chartRef$current.off(name);
      (_chartRef$current2 = chartRef.current) == null ? void 0 : _chartRef$current2.on(name, handler);
    });

    Object.entries(zrEventHandlers || {}).forEach(([name, handler]) => {var _chartRef$current3, _chartRef$current4;
      (_chartRef$current3 = chartRef.current) == null ? void 0 : _chartRef$current3.getZr().off(name);
      (_chartRef$current4 = chartRef.current) == null ? void 0 : _chartRef$current4.getZr().on(name, handler);
    });

    chartRef.current.setOption(echartOptions, true);
  }, [echartOptions, eventHandlers, zrEventHandlers]);

  // highlighting
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.dispatchAction({
      type: 'downplay',
      dataIndex: previousSelection.current.filter(
      (value) => !currentSelection.includes(value)) });


    if (currentSelection.length) {
      chartRef.current.dispatchAction({
        type: 'highlight',
        dataIndex: currentSelection });

    }
    previousSelection.current = currentSelection;
  }, [currentSelection]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.resize({ width, height });
    }
  }, [width, height]);

  return ___EmotionJSX(Styles, { ref: divRef, height: height, width: width });
}__signature__(Echart, "useRef{divRef}\nuseRef{chartRef}\nuseMemo{currentSelection}\nuseRef{previousSelection}\nuseImperativeHandle{}\nuseEffect{}\nuseEffect{}\nuseEffect{}", () => [useImperativeHandle]);const _default = /*#__PURE__*/

forwardRef(Echart);export default _default;;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(Styles, "Styles", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.tsx");reactHotLoader.register(Echart, "Echart", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.tsx");reactHotLoader.register(_default, "default", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/components/Echart.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();