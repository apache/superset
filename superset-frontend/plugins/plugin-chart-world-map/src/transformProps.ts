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
import tinycolor from 'tinycolor2';
import {
  ChartProps,
  getColumnLabel,
  getMetricLabel,
  getValueFormatter,
} from '@superset-ui/core';
import transformData from './transformData';

export default function transformProps(chartProps: ChartProps) {
  const {
    width,
    height,
    formData,
    queriesData,
    hooks,
    inContextMenu,
    filterState,
    emitCrossFilters,
    datasource,
  } = chartProps;
  const { onContextMenu, setDataMask } = hooks;
  const {
    countryFieldtype,
    entity,
    maxBubbleSize,
    showBubbles,
    linearColorScheme,
    colorPicker,
    colorBy,
    colorScheme,
    sliceId,
    metric,
    secondaryMetric,
    yAxisFormat,
    currencyFormat,
  } = formData;
  const { r, g, b } = colorPicker;
  const {
    currencyFormats = {},
    columnFormats = {},
    currencyCodeColumn,
  } = datasource;
  const { data: rawData, detected_currency: detectedCurrency } = queriesData[0];

  // The legacy explore_json endpoint joined country metadata server-side;
  // rows carrying both the entity and metric labels are v1 records that
  // still need that join, anything else is a pre-shaped legacy payload.
  const entityLabel = getColumnLabel(entity);
  const metricLabel = getMetricLabel(metric);
  const data =
    Array.isArray(rawData) &&
    rawData.length > 0 &&
    entityLabel in rawData[0] &&
    metricLabel in rawData[0]
      ? transformData(rawData, {
          entity,
          metric,
          secondaryMetric,
          countryFieldtype,
        })
      : rawData;

  const formatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    yAxisFormat,
    currencyFormat,
    undefined, // key - not needed for single-metric charts
    data,
    currencyCodeColumn,
    detectedCurrency,
  );

  return {
    countryFieldtype,
    entity,
    data,
    width,
    height,
    maxBubbleSize: parseInt(maxBubbleSize, 10),
    showBubbles,
    linearColorScheme,
    color: tinycolor({ r, g, b }).toHexString(),
    colorBy,
    colorScheme,
    sliceId,
    onContextMenu,
    setDataMask,
    inContextMenu,
    filterState,
    emitCrossFilters,
    formatter,
  };
}
