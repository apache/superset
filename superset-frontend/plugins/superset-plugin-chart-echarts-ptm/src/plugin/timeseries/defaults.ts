/**
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
import {
  PTM_NEUTRAL,
  PTM_TYPOGRAPHY,
  PTM_TEXT_COLOR_LIGHT,
  PTM_ECHART_BASE,
  PTM_ECHART_GRID,
  PTM_ECHART_X_AXIS,
  PTM_ECHART_Y_AXIS,
  PTM_ECHART_TOOLTIP,
  PTM_ECHART_LEGEND,
  PTM_THEME,
} from '../../shared/ptmTheme';

export const TIMESERIES_PTM_DEFAULTS = {
  ...PTM_ECHART_BASE,
  textStyle: {
    fontFamily: PTM_TYPOGRAPHY.fontFamily.body,
    color: PTM_TEXT_COLOR_LIGHT,
  },
  xAxis: PTM_ECHART_X_AXIS,
  yAxis: PTM_ECHART_Y_AXIS,
  tooltip: {
    ...PTM_ECHART_TOOLTIP,
    trigger: 'axis' as const,
    axisPointer: {
      type: 'cross' as const,
      crossStyle: { color: PTM_NEUTRAL[400] },
      lineStyle: { color: PTM_NEUTRAL[300] },
    },
  },
  legend: PTM_ECHART_LEGEND,
  grid: PTM_ECHART_GRID,
  // Note: dataZoom default is only used if transforms.dataZoom is disabled
  // If transforms.dataZoom is enabled, user-controlled zoom from formData takes precedence
  dataZoom: (() => {
    const zoom = PTM_THEME.echarts.dataZoom.create();
    return [zoom.slider, zoom.inside];
  })(),
  series: [
    {
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      showSymbol: false,
      lineStyle: {
        width: 2,
      },
      areaStyle: {
        opacity: 0.15,
      },
      emphasis: {
        focus: 'series',
        itemStyle: {
          shadowBlur: 10,
          shadowColor: 'rgba(44, 159, 229, 0.3)',
        },
      },
    },
  ],
};

export default TIMESERIES_PTM_DEFAULTS;

