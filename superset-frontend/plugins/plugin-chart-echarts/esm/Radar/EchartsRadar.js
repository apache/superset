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
import React, { useCallback } from 'react';

import Echart from '../components/Echart';import { jsx as ___EmotionJSX } from "@emotion/react";


export default function EchartsRadar({
  height,
  width,
  echartOptions,
  setDataMask,
  labelMap,
  groupby,
  selectedValues,
  formData })
{
  const handleChange = useCallback(
  (values) => {
    if (!formData.emitFilter) {
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
        value: groupbyValues.length ? groupbyValues : null,
        selectedValues: values.length ? values : null } });


  },
  [groupby, labelMap, setDataMask, selectedValues]);


  const eventHandlers = {
    click: (props) => {
      const { name } = props;
      const values = Object.values(selectedValues);
      if (values.includes(name)) {
        handleChange(values.filter((v) => v !== name));
      } else {
        handleChange([name]);
      }
    } };


  return (
    ___EmotionJSX(Echart, {
      height: height,
      width: width,
      echartOptions: echartOptions,
      eventHandlers: eventHandlers,
      selectedValues: selectedValues }));


}__signature__(EchartsRadar, "useCallback{handleChange}");;(function () {var reactHotLoader = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.default : undefined;if (!reactHotLoader) {return;}reactHotLoader.register(EchartsRadar, "EchartsRadar", "/Users/evan/GitHub/superset/superset-frontend/plugins/plugin-chart-echarts/src/Radar/EchartsRadar.tsx");})();;(function () {var leaveModule = typeof reactHotLoaderGlobal !== 'undefined' ? reactHotLoaderGlobal.leaveModule : undefined;leaveModule && leaveModule(module);})();