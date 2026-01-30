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
import { ChartProps, TimeseriesDataRecord } from '@superset-ui/core';
import { calculateParetoData } from '../utils/paretoCalculations';

export default function transformProps(chartProps: ChartProps) {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your ParetoChartPlugin.tsx file, but
   * doing supplying custom props here is often handy for integrating third
   * party libraries that rely on specific props.
   *
   * A description of properties in `chartProps`:
   * - `height`, `width`: the height/width of the DOM element in which
   *   the chart is located
   * - `formData`: the chart data request payload that was sent to the
   *   backend.
   * - `queriesData`: the chart data response payload that was received
   *   from the backend. Some notable properties of `queriesData`:
   *   - `data`: an array with data, each row with an object mapping
   *     the column/alias to its value. Example:
   *     `[{ col1: 'abc', metric1: 10 }, { col1: 'xyz', metric1: 20 }]`
   *   - `rowcount`: the number of rows in `data`
   *   - `query`: the query that was issued.
   *
   * Please note: the transformProps function gets cached when the
   * application loads. When making changes to the `transformProps`
   * function during development with hot reloading, changes won't
   * be seen until restarting the development server.
   */
  const { width, height, formData, queriesData } = chartProps;
  const {
    boldText,
    headerFontSize,
    headerText,
    barColor = '#1f77b4',
    lineColor = '#ff7f0e',
    showThresholdLine = true,
    thresholdValue = 80,
    showCumulativeLine = true,
    showValues = false,
    xAxisLabel = '',
    yAxisLabel = '',
    y2AxisLabel = 'Cumulative %',
    yAxisFormat = '',
  } = formData;

  const data = queriesData[0].data as TimeseriesDataRecord[];

  // Extract category and value keys from the query result
  // Typically, the first column is the dimension/category and the first metric is the value
  const colnames = (queriesData[0].colnames ?? []) as string[];
  const categoryKey: string = colnames[0] ?? Object.keys(data[0] ?? {})[0] ?? 'category';
  const valueKey: string = colnames[1] ?? Object.keys(data[0] ?? {})[1] ?? 'value';

  // Calculate Pareto data (sorted with cumulative percentages)
  const paretoData = calculateParetoData(data, categoryKey, valueKey);

  return {
    width,
    height,
    data,
    paretoData,
    categoryKey,
    valueKey,
    // and now your control data, manipulated as needed, and passed through as props!
    boldText: Boolean(boldText),
    headerFontSize: String(headerFontSize),
    headerText: String(headerText),
    barColor: String(barColor),
    lineColor: String(lineColor),
    showThresholdLine: Boolean(showThresholdLine),
    thresholdValue: Number(thresholdValue),
    showCumulativeLine: Boolean(showCumulativeLine),
    showValues: Boolean(showValues),
    xAxisLabel: String(xAxisLabel),
    yAxisLabel: String(yAxisLabel),
    y2AxisLabel: String(y2AxisLabel),
    yAxisFormat: String(yAxisFormat),
  };
}
