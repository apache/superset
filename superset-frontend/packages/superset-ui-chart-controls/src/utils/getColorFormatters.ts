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
  value: number | string,
  cutoffPoint: number | string,
  extremeValue: number | string,
  minOpacity = MIN_OPACITY_BOUNDED,
  maxOpacity = MAX_OPACITY,
) => {
  if (
    extremeValue === cutoffPoint ||
    typeof cutoffPoint !== 'number' ||
    typeof extremeValue !== 'number' ||
    typeof value !== 'number'
  ) {
    return maxOpacity;
  }
  return Math.min(
    maxOpacity,
    round(
      Math.abs(
        ((maxOpacity - minOpacity) / (extremeValue - cutoffPoint)) *
          (value - cutoffPoint),
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
  }: ConditionalFormattingConfig,
  columnValues: number[] | string[],
  alpha?: boolean,
) => {
  let minOpacity = MIN_OPACITY_BOUNDED;
  const maxOpacity = MAX_OPACITY;

  let comparatorFunction: (
    value: number | string,
    allValues: number[] | string[],
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
    default:
      comparatorFunction = () => false;
      break;
  }

  return (value: number | string) => {
    const compareResult = comparatorFunction(value, columnValues);
    if (compareResult === false) return undefined;
    const { cutoffValue, extremeValue } = compareResult;
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
    alpha?: boolean,
  ) =>
    columnConfig?.reduce(
      (acc: ColorFormatters, config: ConditionalFormattingConfig) => {
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
            getColorFromValue: getColorFunction(
              config,
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

function isString(value: unknown) {
  return typeof value === 'string';
}
