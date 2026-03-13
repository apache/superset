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
import { DataRecord, DTTM_ALIAS, ValueFormatter } from '@superset-ui/core';
import type { OptionName, SeriesOption } from 'echarts/types/src/util/types';
import type { TooltipMarker } from 'echarts/types/src/util/format';
import {
  ForecastSeriesContext,
  ForecastSeriesEnum,
  ForecastValue,
} from '../types';
import { sanitizeHtml } from './series';

/**
 * Escapes RegExp metacharacters in a string so it can be safely used in a
 * dynamically created regular expression.
 *
 * @param value - The raw string to escape
 * @returns The escaped string safe for use in `new RegExp(...)`
 */
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replaces a label inside a compound key only if it appears as a complete
 * word/token and contains at least one alphabetic character.
 *
 * @param key - The source string (typically a compound field name)
 * @param label - The label to search for as a standalone token
 * @param replacement - The human-readable value to replace the label with
 * @returns The transformed key if a valid match exists, otherwise the original key
 */
const replaceLabelIfExists = (
  key: string,
  label: string,
  replacement: string,
) => {
  /**
   * Logic:
   *
   * This function is intentionally stricter than a simple substring replace:
   * - The label must NOT be part of a larger word (e.g. "account" will NOT match
   *   "testing_account").
   * - Underscores (`_`) are treated as part of the word.
   * - Numeric-only matches are ignored (e.g. "12" will NOT match "123").
   *
   * If the label is found, only the matched portion is replaced; otherwise,
   * the original key is returned unchanged.
   *
   * Examples:
   * - replaceLabelIfExists("testing_account 123", "testing_account", "Account")
   *   → "Account 123"
   * - replaceLabelIfExists("testing_account 123", "account", "Account")
   *   → "testing_account 123"
   * - replaceLabelIfExists("123", "12", "X")
   *   → "123"
   */

  if (key === label) {
    return replacement;
  }

  const escapedLabel = escapeRegex(label);
  const regex = new RegExp(`(?<!\\w)${escapedLabel}(?!\\w)`, 'g');
  return regex.test(key) ? key.replace(regex, replacement) : key;
};

/**
 * Enriches the verbose map by creating human-readable versions of compound field names.
 *
 * @param label_map — a mapping of compound keys to arrays of component labels (e.g., { "revenue_total_usd": ["revenue", "total", "usd"] })
 * @param verboseMap — the existing mapping of field names to their display labels
 * @returns an updated verbose map that includes human-readable versions of the compound keys
 */
export const addLabelMapToVerboseMap = (
  label_map: Record<string, string[]>,
  verboseMap: Record<string, string> = {},
): Record<string, string> => {
  /**
   * Logic:
   *
   * This function takes a mapping of compound field names to their component labels
   * and replaces those labels with their corresponding human-readable values from
   * `verboseMap`, producing display-friendly versions of the compound keys.
   *
   * Replacement behavior:
   * - Each compound key is processed word-by-word (split on spaces).
   * - Only labels that exist in `verboseMap` are considered.
   * - Each word is replaced at most once, using `replaceLabelIfExists`, which:
   *   - Matches only full tokens (no partial matches).
   *   - Treats underscores (`_`) as part of a token.
   *   - Is case-sensitive.
   * - Labels not found in `verboseMap` are left unchanged.
   *
   * The original `verboseMap` is preserved and extended with the newly generated
   * human-readable entries.
   *
   * Example:
   * ```ts
   * label_map = {
   *   "testing_count, 1 week ago": ["testing_count", "1 week ago"]
   * }
   *
   * verboseMap = {
   *   testing_count: "Testing Count"
   * }
   *
   * Result:
   * {
   *   testing_count: "Testing Count",
   *   "testing_count, 1 week ago": "Testing Count, 1 week ago"
   * }
   * ```
   */
  const newVerboseMap: Record<string, string> = {};

  Object.entries(label_map).forEach(([key, labels]) => {
    if (labels) {
      const newLabelMap: Record<string, string> = labels
        .filter(l => verboseMap[l])
        .reduce(
          (acc, label) => ({
            ...acc,
            [label]: verboseMap[label],
          }),
          {},
        );

      const newKey = key
        .split(' ')
        .map(word => {
          for (const label of Object.keys(newLabelMap)) {
            const newWord = replaceLabelIfExists(
              word,
              label,
              newLabelMap[label],
            );

            if (newWord !== word) {
              return newWord;
            }
          }

          return word;
        })
        .join(' ');

      newVerboseMap[key] = newKey;
    }
  });

  return { ...verboseMap, ...newVerboseMap };
};

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
  seriesNames.reduce(
    (agg, name) => {
      const context = extractForecastSeriesContext(name);
      const currentContexts = agg[context.name] || [];
      currentContexts.push(context.type);
      return { ...agg, [context.name]: currentContexts };
    },
    {} as { [key: string]: ForecastSeriesEnum[] },
  );

export const extractForecastValuesFromTooltipParams = (
  params: any[],
  isHorizontal = false,
): Record<string, ForecastValue> => {
  const values: Record<string, ForecastValue> = {};
  params.forEach(param => {
    const { marker, seriesId, value } = param;
    const context = extractForecastSeriesContext(seriesId);
    const numericValue = isHorizontal ? value[0] : value[1];
    if (typeof numericValue === 'number') {
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
  formatter: ValueFormatter;
}): string[] => {
  const name = `${marker}${sanitizeHtml(seriesName)}`;
  let value = typeof observation === 'number' ? formatter(observation) : '';
  if (forecastTrend || forecastLower || forecastUpper) {
    // forecast values take the form of "20, y = 30 (10, 40)"
    // where the first part is the observation, the second part is the forecast trend
    // and the third part is the lower and upper bounds
    if (forecastTrend) {
      if (value) value += ', ';
      value += `ŷ = ${formatter(forecastTrend)}`;
    }
    if (forecastLower && forecastUpper) {
      if (value) value += ' ';
      // the lower bound needs to be added to the upper bound
      value += `(${formatter(forecastLower)}, ${formatter(
        forecastLower + forecastUpper,
      )})`;
    }
  }
  return [name, value];
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

// For Confidence Bands, forecast series on mixed charts require the series sent in the following sortOrder:
export function reorderForecastSeries(row: SeriesOption[]): SeriesOption[] {
  const sortOrder = {
    [ForecastSeriesEnum.ForecastLower]: 1,
    [ForecastSeriesEnum.ForecastUpper]: 2,
    [ForecastSeriesEnum.ForecastTrend]: 3,
    [ForecastSeriesEnum.Observation]: 4,
  };

  // Check if any item needs reordering
  if (
    !row.some(
      item =>
        item.id &&
        sortOrder.hasOwnProperty(extractForecastSeriesContext(item.id).type),
    )
  ) {
    return row;
  }

  return row.sort((a, b) => {
    const aOrder =
      sortOrder[extractForecastSeriesContext(a.id ?? '').type] ??
      Number.MAX_SAFE_INTEGER;
    const bOrder =
      sortOrder[extractForecastSeriesContext(b.id ?? '').type] ??
      Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
}
