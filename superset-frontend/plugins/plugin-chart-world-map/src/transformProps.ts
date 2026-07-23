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
  DataRecord,
  getMetricLabel,
  getValueFormatter,
} from '@superset-ui/core';
import getCountry, { CountryFieldType } from './countries';

/**
 * The v1 chart data endpoint returns generic rows keyed by the entity column
 * name and the metric labels. Rebuild the country/code/name/latitude/longitude
 * /m1/m2 row shape the renderer consumes — the enrichment the legacy
 * WorldMapViz.get_data (superset/viz.py) performed server-side via
 * superset/examples/countries.py.
 */
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

  const metricLabel = getMetricLabel(metric);
  const secondaryMetricLabel = secondaryMetric
    ? getMetricLabel(secondaryMetric)
    : undefined;
  const fieldtype = (countryFieldtype || 'cca2') as CountryFieldType;
  const data = ((rawData || []) as DataRecord[]).map(row => {
    const entityValue = row[entity];
    const country =
      typeof entityValue === 'string'
        ? getCountry(fieldtype, entityValue)
        : undefined;
    const m1 = row[metricLabel] as number;
    // No distinct secondary metric means the bubble size follows the metric,
    // matching the legacy server-side behavior.
    const m2 =
      secondaryMetricLabel !== undefined && secondaryMetricLabel !== metricLabel
        ? (row[secondaryMetricLabel] as number)
        : m1;
    if (!country) {
      // Legacy sentinel for unmappable values; the renderer filters these out.
      return { country: 'XXX', code: entityValue, name: entityValue, m1, m2 };
    }
    return {
      country: country.cca3,
      code: country[fieldtype],
      name: country.name,
      latitude: country.lat,
      longitude: country.lng,
      m1,
      m2,
    };
  });

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
