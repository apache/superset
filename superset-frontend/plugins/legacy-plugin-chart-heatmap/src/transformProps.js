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
  GenericDataType,
  getTimeFormatter,
  getValueFormatter,
} from '@superset-ui/core';

export default function transformProps(chartProps) {
  const { width, height, formData, queriesData, datasource } = chartProps;
  const {
    bottomMargin,
    canvasImageRendering,
    allColumnsX,
    allColumnsY,
    linearColorScheme,
    leftMargin,
    metric,
    normalized,
    showLegend,
    showPerc,
    showValues,
    sortXAxis,
    sortYAxis,
    xscaleInterval,
    yscaleInterval,
    yAxisBounds,
    yAxisFormat,
    timeFormat,
    currencyFormat,
  } = formData;
  const { data = [], coltypes = [] } = queriesData[0];
  const { columnFormats = {}, currencyFormats = {} } = datasource;
  const valueFormatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
  );
  const xAxisFormatter =
    coltypes[0] === GenericDataType.Temporal
      ? getTimeFormatter(timeFormat)
      : coltypes[0] === GenericDataType.Numeric
        ? Number
        : String;
  const yAxisFormatter =
    coltypes[1] === GenericDataType.Temporal
      ? getTimeFormatter(timeFormat)
      : coltypes[1] === GenericDataType.Numeric
        ? Number
        : String;
  return {
    width,
    height,
    data,
    bottomMargin,
    canvasImageRendering,
    colorScheme: linearColorScheme,
    columnX: allColumnsX,
    columnY: allColumnsY,
    leftMargin,
    metric,
    normalized,
    showLegend,
    showPercentage: showPerc,
    showValues,
    sortXAxis,
    sortYAxis,
    xScaleInterval: parseInt(xscaleInterval, 10),
    yScaleInterval: parseInt(yscaleInterval, 10),
    yAxisBounds,
    valueFormatter,
    xAxisFormatter,
    yAxisFormatter,
  };
}
