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
import React, { useEffect, useRef } from 'react';
import { styled } from '@superset-ui/core';
import { ECharts, init } from 'echarts';
import {
  SupersetPluginChartDualYAxisProps,
  SupersetPluginChartDualYAxisStylesProps,
} from './types';

// The following Styles component is a <div> element, which has been styled using Emotion
// For docs, visit https://emotion.sh/docs/styled

// Theming variables are provided for your use via a ThemeProvider
// imported from @superset-ui/core. For variables available, please visit
// https://github.com/apache-superset/superset-ui/blob/master/packages/superset-ui-core/src/style/index.ts

const Styles = styled.div<SupersetPluginChartDualYAxisStylesProps>`
  height: ${({ height }) => height}px;
  width: ${({ width }) => width}px;
`;

/**
 * ******************* WHAT YOU CAN BUILD HERE *******************
 *  In essence, a chart is given a few key ingredients to work with:
 *  * Data: provided via `props.data`
 *  * A DOM element
 *  * FormData (your controls!) provided as props by transformProps.ts
 */

function SupersetPluginChartDualYAxis(
  props: SupersetPluginChartDualYAxisProps,
) {
  // height and width are the height and width of the DOM element as it exists in the dashboard.
  // There is also a `data` prop, which is, of course, your DATA 🎉
  const { data, height, width, formData } = props;

  let rootElem = useRef<HTMLDivElement>();
  const chartRef = useRef<ECharts>();
  let chartData: [] = [];
  let chartCols: [] = [];

  const colors = ['#5470C6', '#91CC75', '#EE6666'];

  const barChartConfig = (name, color) => ({
    type: 'value',
    name: name,
    position: 'right',
    alignTicks: true,
    axisLine: {
      show: true,
      lineStyle: {
        color: color,
      },
    },
  });

  const lineChartConfig = (name, color) => ({
    type: 'value',
    name: name,
    position: 'left',
    alignTicks: true,
    axisLine: {
      show: true,
      lineStyle: {
        color: color,
      },
    },
  });

  const xAxisConfig = axisData => ({
    type: 'category',
    axisTick: {
      alignWithLabel: true,
    },
    data: axisData,
  });

  const seriesBarData = (name, data) => ({
    name: name,
    type: 'bar',
    data: data,
  });

  const seriesLineData = (name, data) => ({
    name: name,
    type: 'line',
    data: data,
  });

  const options = {
    color: colors,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
      },
    },
    grid: {
      right: '20%',
    },
    toolbox: {
      feature: {
        dataView: { show: true, readOnly: false },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    legend: {
      data: [...formData.cols, ...formData.metrics],
    },
    xAxis: [],
    yAxis: [],
    series: [],
  };

  // Often, you just want to get a hold of the DOM and go nuts.
  // Here, you can do that with createRef, and the useEffect hook.
  useEffect(() => {
    if (!rootElem.current) return;
    if (!chartRef.current) {
      chartRef.current = init(rootElem.current);
    }
    chartCols = formData.cols;
    if (formData.cols.length > 1) {
      chartCols = formData.cols.filter(
        colName => colName !== formData.xValues[0],
      );
      chartCols.map((colData, index) => {
        data.map(colValue => {
          chartData.push(colValue[colData]);
        });
        if (index + 1 !== chartCols.length) {
          options.yAxis.push(barChartConfig(colData, colors[index]));
          options.series.push(seriesBarData(colData, chartData));
        } else {
          options.yAxis.push(lineChartConfig(colData, colors[index]));
          options.series.push(seriesLineData(colData, chartData));
        }
        chartData = [];
      });
    }
    if (formData.xValues.length) {
      data.map(colValue => {
        chartData.push(colValue[formData.xValues[0]]);
      });
      options.xAxis.push(xAxisConfig(chartData));
      chartData = [];
    }
    options.series[1].yAxisIndex = 1;
    chartRef.current.setOption(options, true);
  }, []);

  console.log('Plugin props', formData, data, height, width);

  return <Styles id="main" ref={rootElem} height={height} width={width} />;
}

export default SupersetPluginChartDualYAxis;
