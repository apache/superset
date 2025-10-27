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
 * software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { ChartProps, getValueFormatter } from '@superset-ui/core';

export default function transformProps(chartProps: ChartProps) {
  const {
    width,
    height,
    formData,
    queriesData,
    datasource,
    hooks,
    inContextMenu,
    filterState,
    emitCrossFilters,
  } = chartProps;
  const {
    entity,
    linearColorScheme,
    numberFormat,
    currencyFormat,
    selectCountry,
    colorScheme,
    sliceId,
    metric,
  } = formData;

  const {
    currencyFormats = {},
    columnFormats = {},
    currencyCodeColumn,
  } = datasource;
  const { data, detected_currency: detectedCurrency } = queriesData[0];

  const formatter = getValueFormatter(
    metric,
    currencyFormats,
    columnFormats,
    numberFormat,
    currencyFormat,
    undefined, // key - not needed for single-metric charts
    data,
    currencyCodeColumn,
    detectedCurrency,
  );

  const { onContextMenu, setDataMask } = hooks;

  return {
    width,
    height,
    data: queriesData[0].data,
    country: selectCountry ? String(selectCountry).toLowerCase() : null,
    linearColorScheme,
    numberFormat, // left for backward compatibility
    colorScheme,
    sliceId,
    formatter,
    entity,
    onContextMenu,
    inContextMenu,
    setDataMask,
    emitCrossFilters,
    filterState,
  };
}
