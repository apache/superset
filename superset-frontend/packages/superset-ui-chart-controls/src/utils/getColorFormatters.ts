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
import memoizeOne from 'memoize-one';
import { isString, isBoolean } from 'lodash';
import { isBlank } from '@apache-superset/core';
import { addAlpha, DataRecord } from '@superset-ui/core';
import {
  ColorFormatters,
  Comparator,
  ConditionalFormattingConfig,
  MultipleValueComparators,
} from '../types';

export const round = (num: number, precision = 0) =>
  Number(`${Math.round(Number(`${num}e+${precision}`))}e-${precision}`);

const MIN_OPACITY_BOUNDED = 0.05;
const MIN_OPACITY_UNBOUNDED = 0;
const MAX_OPACITY = 1;
export const getOpacity = (
  value: number | string | boolean | null,
  cutoffPoint: number | string,
  extremeValue: number | string,
  minOpacity = MIN_OPACITY_BOUNDED,
  maxOpacity = MAX_OPACITY,
) => {
  if (extremeValue === cutoffPoint || typeof value !== 'number') {
    return maxOpacity;
  }
  const numCutoffPoint =
    typeof cutoffPoint === 'string' ? parseFloat(cutoffPoint) : cutoffPoint;
  const numExtremeValue =
    typeof extremeValue === 'string' ? parseFloat(extremeValue) : extremeValue;

  if (isNaN(numCutoffPoint) || isNaN(numExtremeValue)) {
    return maxOpacity;
  }

  return Math.min(
    maxOpacity,
    round(
      Math.abs(
        ((maxOpacity - minOpacity) / (numExtremeValue - numCutoffPoint)) *
          (value - numCutoffPoint),
      ) + minOpacity,
      2,
    ),
  );
};

export const getColorFunction = (
  {
    operator,
    targetValue,
    targetValueLeft,
    targetValueRight,
    colorScheme,
    useGradient,
  }: ConditionalFormattingConfig,
  columnValues: number[] | string[] | (boolean | null)[],
  alpha?: boolean,
) => {
  let minOpacity = MIN_OPACITY_BOUNDED;
  const maxOpacity = MAX_OPACITY;

  let comparatorFunction: (
    value: number | string | boolean | null,
    allValues: number[] | string[] | (boolean | null)[],
  ) => false | { cutoffValue: number | string; extremeValue: number | string };
  if (operator === undefined || colorScheme === undefined) {
    return () => undefined;
  }
  if (
    MultipleValueComparators.includes(operator) &&
    (targetValueLeft === undefined || targetValueRight === undefined)
  ) {
    return () => undefined;
  }
  if (
    operator !== Comparator.None &&
    !MultipleValueComparators.includes(operator) &&
    targetValue === undefined
  ) {
    return () => undefined;
  }
  switch (operator) {
    case Comparator.None:
      minOpacity = MIN_OPACITY_UNBOUNDED;
      comparatorFunction = (value: number | string, allValues: number[]) => {
        if (typeof value !== 'number') {
          return { cutoffValue: value!, extremeValue: value! };
        }
        const cutoffValue = Math.min(...allValues);
        const extremeValue = Math.max(...allValues);
        return value >= cutoffValue && value <= extremeValue
          ? { cutoffValue, extremeValue }
          : false;
      };
      break;
    case Comparator.GreaterThan:
      comparatorFunction = (value: number, allValues: number[]) =>
        typeof targetValue === 'number' && value > targetValue!
          ? {
              cutoffValue: targetValue!,
              extremeValue: Math.max(...allValues),
            }
          : false;
      break;
    case Comparator.LessThan:
      comparatorFunction = (value: number, allValues: number[]) =>
        typeof targetValue === 'number' && value < targetValue!
          ? {
              cutoffValue: targetValue!,
              extremeValue: Math.min(...allValues),
            }
          : false;
      break;
    case Comparator.GreaterOrEqual:
      comparatorFunction = (value: number, allValues: number[]) =>
        typeof targetValue === 'number' && value >= targetValue!
          ? {
              cutoffValue: targetValue!,
              extremeValue: Math.max(...allValues),
            }
          : false;
      break;
    case Comparator.LessOrEqual:
      comparatorFunction = (value: number, allValues: number[]) =>
        typeof targetValue === 'number' && value <= targetValue!
          ? {
              cutoffValue: targetValue!,
              extremeValue: Math.min(...allValues),
            }
          : false;
      break;
    case Comparator.Equal:
      comparatorFunction = (value: number | string) =>
        value === targetValue!
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.NotEqual:
      comparatorFunction = (value: number, allValues: number[]) => {
        if (typeof targetValue === 'number') {
          if (value === targetValue!) {
            return false;
          }
          const max = Math.max(...allValues);
          const min = Math.min(...allValues);
          return {
            cutoffValue: targetValue!,
            extremeValue:
              Math.abs(targetValue! - min) > Math.abs(max - targetValue!)
                ? min
                : max,
          };
        }
        return false;
      };

      break;
    case Comparator.Between:
      comparatorFunction = (value: number) =>
        value > targetValueLeft! && value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrEqual:
      comparatorFunction = (value: number) =>
        value >= targetValueLeft! && value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrLeftEqual:
      comparatorFunction = (value: number) =>
        value >= targetValueLeft! && value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BetweenOrRightEqual:
      comparatorFunction = (value: number) =>
        value > targetValueLeft! && value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case Comparator.BeginsWith:
      comparatorFunction = (value: string) =>
        isString(value) && value?.startsWith(targetValue as string)
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.EndsWith:
      comparatorFunction = (value: string) =>
        isString(value) && value?.endsWith(targetValue as string)
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.Containing:
      comparatorFunction = (value: string) =>
        isString(value) &&
        value?.toLowerCase().includes((targetValue as string).toLowerCase())
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.NotContaining:
      comparatorFunction = (value: string) =>
        isString(value) &&
        !value?.toLowerCase().includes((targetValue as string).toLowerCase())
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;

      break;
    case Comparator.IsTrue:
      comparatorFunction = (value: boolean | null) =>
        isBoolean(value) && value
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.IsFalse:
      comparatorFunction = (value: boolean | null) =>
        isBoolean(value) && !value
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.IsNull:
      comparatorFunction = (value: boolean | null) =>
        value === null
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case Comparator.IsNotNull:
      comparatorFunction = (value: boolean | null) =>
        isBoolean(value) && value !== null
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    default:
      comparatorFunction = () => false;
      break;
  }

  return (value: number | string | boolean | null) => {
    if (isBlank(value) && operator !== Comparator.IsNull) {
      return undefined;
    }
    const compareResult = comparatorFunction(value, columnValues);
    if (compareResult === false) return undefined;
    const { cutoffValue, extremeValue } = compareResult;

    // If useGradient is explicitly false, return solid color
    if (useGradient === false) {
      return colorScheme;
    }

    // Otherwise apply gradient (default behavior for backward compatibility)
    if (alpha === undefined || alpha) {
      return addAlpha(
        colorScheme,
        getOpacity(value, cutoffValue, extremeValue, minOpacity, maxOpacity),
      );
    }
    return colorScheme;
  };
};

export const getColorFormatters = memoizeOne(
  (
    columnConfig: ConditionalFormattingConfig[] | undefined,
    data: DataRecord[],
    theme?: Record<string, any>,
    alpha?: boolean,
  ) =>
    columnConfig?.reduce(
      (acc: ColorFormatters, config: ConditionalFormattingConfig) => {
        let resolvedColorScheme = config.colorScheme;
        if (
          theme &&
          typeof config.colorScheme === 'string' &&
          config.colorScheme.startsWith('color') &&
          theme[config.colorScheme]
        ) {
          resolvedColorScheme = theme[config.colorScheme] as string;
        }

        if (
          config?.column !== undefined &&
          (config?.operator === Comparator.None ||
            (config?.operator !== undefined &&
              (MultipleValueComparators.includes(config?.operator)
                ? config?.targetValueLeft !== undefined &&
                  config?.targetValueRight !== undefined
                : config?.targetValue !== undefined)))
        ) {
          acc.push({
            column: config?.column,
            toAllRow: config?.toAllRow,
            toTextColor: config?.toTextColor,
            columnFormatting: config?.columnFormatting,
            objectFormatting: config?.objectFormatting,
            getColorFromValue: getColorFunction(
              { ...config, colorScheme: resolvedColorScheme },
              data.map(row => row[config.column!] as number),
              alpha,
            ),
          });
        }
        return acc;
      },
      [],
    ) ?? [],
);
