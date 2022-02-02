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
import { DataRecord, DTTM_ALIAS, NumberFormatter } from '@superset-ui/core';
import { CallbackDataParams, OptionName } from 'echarts/types/src/util/types';
import { TooltipMarker } from 'echarts/types/src/util/format';
import {
  ForecastSeriesContext,
  ForecastSeriesEnum,
  ForecastValue,
} from '../types';
import { sanitizeHtml } from './series';

const seriesTypeRegex = new RegExp(
  `(.+)(${ForecastSeriesEnum.ForecastLower}|${ForecastSeriesEnum.ForecastTrend}|${ForecastSeriesEnum.ForecastUpper})$`,
);
export const extractForecastSeriesContext = (
  seriesName: OptionName,
): ForecastSeriesContext => {
  const name = seriesName as string;
  const regexMatch = seriesTypeRegex.exec(name);
  if (!regexMatch) return { name, type: ForecastSeriesEnum.Observation };
  return {
    name: regexMatch[1],
    type: regexMatch[2] as ForecastSeriesEnum,
  };
};

export const extractForecastSeriesContexts = (
  seriesNames: string[],
): { [key: string]: ForecastSeriesEnum[] } =>
  seriesNames.reduce((agg, name) => {
    const context = extractForecastSeriesContext(name);
    const currentContexts = agg[context.name] || [];
    currentContexts.push(context.type);
    return { ...agg, [context.name]: currentContexts };
  }, {} as { [key: string]: ForecastSeriesEnum[] });

export const extractForecastValuesFromTooltipParams = (
  params: (CallbackDataParams & { seriesId: string })[],
): Record<string, ForecastValue> => {
  const values: Record<string, ForecastValue> = {};
  params.forEach(param => {
    const { marker, seriesId, value } = param;
    const context = extractForecastSeriesContext(seriesId);
    const numericValue = (value as [Date, number])[1];
    if (numericValue) {
      if (!(context.name in values))
        values[context.name] = {
          marker: marker || '',
        };
      const forecastValues = values[context.name];
      if (context.type === ForecastSeriesEnum.Observation)
        forecastValues.observation = numericValue;
      if (context.type === ForecastSeriesEnum.ForecastTrend)
        forecastValues.forecastTrend = numericValue;
      if (context.type === ForecastSeriesEnum.ForecastLower)
        forecastValues.forecastLower = numericValue;
      if (context.type === ForecastSeriesEnum.ForecastUpper)
        forecastValues.forecastUpper = numericValue;
    }
  });
  return values;
};

export const formatForecastTooltipSeries = ({
  seriesName,
  observation,
  forecastTrend,
  forecastLower,
  forecastUpper,
  marker,
  formatter,
}: ForecastValue & {
  seriesName: string;
  marker: TooltipMarker;
  formatter: NumberFormatter;
}): string => {
  let row = `${marker}${sanitizeHtml(seriesName)}: `;
  let isObservation = false;
  if (observation) {
    isObservation = true;
    row += `${formatter(observation)}`;
  }
  if (forecastTrend) {
    if (isObservation) row += ', ';
    row += `ŷ = ${formatter(forecastTrend)}`;
  }
  if (forecastLower && forecastUpper)
    // the lower bound needs to be added to the upper bound
    row = `${row.trim()} (${formatter(forecastLower)}, ${formatter(
      forecastLower + forecastUpper,
    )})`;
  return `${row.trim()}`;
};

export function rebaseForecastDatum(
  data: DataRecord[],
  verboseMap: Record<string, string> = {},
) {
  const keys = data.length ? Object.keys(data[0]) : [];

  return data.map(row => {
    const newRow: DataRecord = {};
    keys.forEach(key => {
      const forecastContext = extractForecastSeriesContext(key);
      const verboseKey =
        key !== DTTM_ALIAS && verboseMap[forecastContext.name]
          ? `${verboseMap[forecastContext.name]}${forecastContext.type}`
          : key;

      // check if key is equal to lower confidence level. If so, extract it
      // from the upper bound
      const lowerForecastKey = `${forecastContext.name}${ForecastSeriesEnum.ForecastLower}`;
      let value = row[key] as number | null;
      if (
        forecastContext.type === ForecastSeriesEnum.ForecastUpper &&
        keys.includes(lowerForecastKey) &&
        value !== null &&
        row[lowerForecastKey] !== null
      ) {
        value -= row[lowerForecastKey] as number;
      }
      newRow[verboseKey] = value;
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return newRow;
  });
}
