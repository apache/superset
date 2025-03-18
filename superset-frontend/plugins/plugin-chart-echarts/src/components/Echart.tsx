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
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useCallback,
  Ref,
} from 'react';
import merge from 'lodash/merge';

import * as echarts from 'echarts';

import { styled, themeObject } from '@superset-ui/core';
import { use, init, EChartsType } from 'echarts/core';
import {
  SankeyChart,
  PieChart,
  BarChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  LineChart,
  ScatterChart,
  RadarChart,
  BoxplotChart,
  TreeChart,
  TreemapChart,
  HeatmapChart,
  SunburstChart,
} from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import {
  TooltipComponent,
  GridComponent,
  VisualMapComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  GraphicComponent,
  AriaComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from 'echarts/components';
import { LabelLayout } from 'echarts/features';
import { EchartsHandler, EchartsProps, EchartsStylesProps } from '../types';

const Styles = styled.div<EchartsStylesProps>`
  height: ${({ height }) => height};
  width: ${({ width }) => width};
`;

use([
  CanvasRenderer,
  BarChart,
  BoxplotChart,
  FunnelChart,
  GaugeChart,
  GraphChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  SankeyChart,
  ScatterChart,
  SunburstChart,
  TreeChart,
  TreemapChart,
  AriaComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
  LabelLayout,
]);

const getTheme = options => {
  const token = themeObject.theme;
  const theme = {
    textStyle: {
      color: token.colorText,
      fontFamily: token.fontFamily,
    },
    title: {
      textStyle: { color: token.colorText },
    },
    legend: {
      textStyle: { color: token.colorTextSecondary },
    },
    tooltip: {
      backgroundColor: token.colorBgContainer,
      borderColor: token.colorSplit,
      textStyle: { color: token.colorText },
    },
    axisPointer: {
      lineStyle: { color: token.colorPrimary },
      label: { color: token.colorText },
    },
    xAxis: {
      axisLine: { lineStyle: { color: token.colorSplit } },
      axisLabel: { color: token.colorTextSecondary },
      splitLine: { lineStyle: { color: token.colorSplit } },
    },
    yAxis: {
      axisLine: { lineStyle: { color: token.colorSplit } },
      axisLabel: { color: token.colorTextSecondary },
      splitLine: { lineStyle: { color: token.colorSplit } },
    },
  };
  /*
  if (options?.xAxis) {
    theme.xAxis = {
      axisLine: { lineStyle: { color: token.colorSplit } },
      axisLabel: { color: token.colorTextSecondary },
      splitLine: { lineStyle: { color: token.colorSplit } },
    };
  }
  if (options?.yAxis) {
    theme.yAxis = {
      axisLine: { lineStyle: { color: token.colorSplit } },
      axisLabel: { color: token.colorTextSecondary },
      splitLine: { lineStyle: { color: token.colorSplit } },
    };
} */
  return theme;
};

function Echart(
  {
    width,
    height,
    echartOptions,
    eventHandlers,
    zrEventHandlers,
    selectedValues = {},
    refs,
  }: EchartsProps,
  ref: Ref<EchartsHandler>,
) {
  const divRef = useRef<HTMLDivElement>(null);
  if (refs) {
    // eslint-disable-next-line no-param-reassign
    refs.divRef = divRef;
  }
  const chartRef = useRef<EChartsType>();
  const currentSelection = useMemo(
    () => Object.keys(selectedValues) || [],
    [selectedValues],
  );
  const previousSelection = useRef<string[]>([]);

  useImperativeHandle(ref, () => ({
    getEchartInstance: () => chartRef.current,
  }));

  useEffect(() => {
    if (!divRef.current) return;
    if (!chartRef.current) {
      chartRef.current = init(divRef.current);
    }

    Object.entries(eventHandlers || {}).forEach(([name, handler]) => {
      chartRef.current?.off(name);
      chartRef.current?.on(name, handler);
    });

    Object.entries(zrEventHandlers || {}).forEach(([name, handler]) => {
      chartRef.current?.getZr().off(name);
      chartRef.current?.getZr().on(name, handler);
    });
    /*
    const themedEchartOptions = merge({}, getTheme(echartOptions), echartOptions);
    */
    chartRef.current.setTheme(getTheme(echartOptions));
    chartRef.current.setOption(echartOptions, true);
    chartRef.current.setTheme(getTheme(echartOptions));
  }, [echartOptions, eventHandlers, zrEventHandlers]);

  // highlighting
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.dispatchAction({
      type: 'downplay',
      dataIndex: previousSelection.current.filter(
        value => !currentSelection.includes(value),
      ),
    });
    if (currentSelection.length) {
      chartRef.current.dispatchAction({
        type: 'highlight',
        dataIndex: currentSelection,
      });
    }
    previousSelection.current = currentSelection;
  }, [currentSelection]);

  const handleSizeChange = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      if (chartRef.current) {
        chartRef.current.resize({ width, height });
      }
    },
    [],
  );

  // did mount
  useEffect(() => {
    handleSizeChange({ width, height });
    return () => chartRef.current?.dispose();
  }, []);

  useLayoutEffect(() => {
    handleSizeChange({ width, height });
  }, [width, height, handleSizeChange]);

  return <Styles ref={divRef} height={height} width={width} />;
}

export default forwardRef(Echart);
