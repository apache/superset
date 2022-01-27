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
import React, { useCallback, useRef } from 'react';




import Echart from '../components/Echart';

import { currentSeries } from '../utils/series';import { jsx as ___EmotionJSX } from "@emotion/react";

const TIMER_DURATION = 300;
// @ts-ignore
export default function EchartsTimeseries({
  formData,
  height,
  width,
  echartOptions,
  groupby,
  labelMap,
  selectedValues,
  setDataMask,
  legendData = [] })
{
  const { emitFilter, stack } = formData;
  const echartRef = useRef(null);
  const lastTimeRef = useRef(Date.now());
  const lastSelectedLegend = useRef('');
  const clickTimer = useRef();

  const handleDoubleClickChange = useCallback(
  (name) => {var _echartRef$current;
    const echartInstance = (_echartRef$current = echartRef.current) == null ? void 0 : _echartRef$current.getEchartInstance();
    if (!name) {
      currentSeries.legend = '';
      echartInstance == null ? void 0 : echartInstance.dispatchAction({
        type: 'legendAllSelect' });

    } else {
      legendData.forEach((datum) => {
        if (datum === name) {
          currentSeries.legend = datum;
          echartInstance == null ? void 0 : echartInstance.dispatchAction({
            type: 'legendSelect',
            name: datum });

        } else {
          echartInstance == null ? void 0 : echartInstance.dispatchAction({
            type: 'legendUnSelect',
            name: datum });

        }
      });
    }
  },
  [legendData]);


  const getModelInfo = (target, globalModel) => {
    let el = target;
    let model = null;
    while (el) {
      // eslint-disable-next-line no-underscore-dangle
      const modelInfo = el.__ecComponentInfo;
      if (modelInfo != null) {
        model = globalModel.getComponent(modelInfo.mainType, modelInfo.index);
        break;
      }
      el = el.parent;
    }
    return model;
  };

  const handleChange = useCallback(
  (values) => {
    if (!emitFilter) {
      return;
    }
    const groupbyValues = values.map((value) => labelMap[value]);

    setDataMask({
      extraFormData: {
        filters:
        values.length === 0 ?
        [] :
        groupby.map((col, idx) => {
          const val = groupbyValues.map((v) => v[idx]);
          if (val === null || val === undefined)
          return {
            col,
            op: 'IS NULL' };

          return {
            col,
            op: 'IN',
            val: val };

        }) },

      filterState: {
        label: groupbyValues.length ? groupbyValues : undefined,
        value: groupbyValues.length ? groupbyValues : null,
        selectedValues: values.length ? values : null } });


  },
  [groupby, labelMap, setDataMask]);


  const eventHandlers = {
    click: (props) => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      // Ensure that double-click events do not trigger single click event. So we put it in the timer.
      clickTimer.current = setTimeout(() => {
        const { seriesName: name } = props;
        const values = Object.values(selectedValues);
        if (values.includes(name)) {
          handleChange(values.filter((v) => v !== name));
        } else {
          handleChange([name]);
        }
      }, TIMER_DURATION);
    },
    mouseout: () => {
      currentSeries.name = '';
    },
    mouseover: (params) => {
      currentSeries.name = params.seriesName;
    },
    legendselectchanged: (payload) => {
      const currentTime = Date.now();
      // TIMER_DURATION is the interval between two legendselectchanged event
      if (
      currentTime - lastTimeRef.current < TIMER_DURATION &&
      lastSelectedLegend.current === payload.name)
      {
        // execute dbclick
        handleDoubleClickChange(payload.name);
      } else {
        lastTimeRef.current = currentTime;
        // remember last selected legend
        lastSelectedLegend.current = payload.name;
      }
      // if all legend is unselected, we keep all selected
      if (Object.values(payload.selected).every((i) => !i)) {
        handleDoubleClickChange();
      }
    } };


  const zrEventHandlers = {
    dblclick: (params) => {var _echartRef$current2;
      // clear single click timer
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      const pointInPixel = [params.offsetX, params.offsetY];
      const echartInstance = (_echartRef$current2 = echartRef.current) == null ? void 0 : _echartRef$current2.getEchartInstance();
      if (echartInstance != null && echartInstance.containPixel('grid', pointInPixel)) {var _params$target;
        // do not trigger if click unstacked chart's blank area
        if (!stack && ((_params$target = params.target) == null ? void 0 : _params$target.type) === 'ec-polygon') return;
        // @ts-ignore
        const globalModel = echartInstance.getModel();
        const model = getModelInfo(params.target, globalModel);
        const seriesCount = globalModel.getSeriesCount();
        const currentSeriesIndices = globalModel.getCurrentSeriesIndices();
        if (model) {
          const { name } = model;
          if (seriesCount !== currentSeriesIndices.length) {
            handleDoubleClickChange();
          } else {
            handleDoubleClickChange(name);
          }
        }
      }
    } };


  return (
    ___EmotionJSX(Echart, {
      ref: echartRef,
      height: height,
      width: width,
      echartOptions: echartOptions,
      eventHandlers: eventHandlers,
      zrEventHandlers: zrEventHandlers,
      selectedValues: selectedValues }));


}__signature__(EchartsTimeseries, "useRef{echartRef}\nuseRef{lastTimeRef}\nuseRef{lastSelectedLegend}\nuseRef{clickTimer}\nuseCallback{handleDoubleClickChange}\nuseCallback{handleChange}");;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(TIMER_DURATION, "TIMER_DURATION", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/EchartsTimeseries.tsx");reactHotLoader.register(EchartsTimeseries, "EchartsTimeseries", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Timeseries/EchartsTimeseries.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();