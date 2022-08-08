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
import { DataRecord } from '@superset-ui/core';
import {
  ColorFormatters,
  COMPARATOR,
  ConditionalFormattingConfig,
  MULTIPLE_VALUE_COMPARATORS,
} from '../types';

export const round = (num: number, precision = 0) =>
  Number(`${Math.round(Number(`${num}e+${precision}`))}e-${precision}`);

export const rgbToRgba = (rgb: string, alpha: number) =>
  rgb.replace(/rgb/i, 'rgba').replace(/\)/i, `,${alpha})`);

const MIN_OPACITY_BOUNDED = 0.05;
const MIN_OPACITY_UNBOUNDED = 0;
const MAX_OPACITY = 1;
export const getOpacity = (
  value: number,
  cutoffPoint: number,
  extremeValue: number,
  minOpacity = MIN_OPACITY_BOUNDED,
  maxOpacity = MAX_OPACITY,
) =>
  extremeValue === cutoffPoint
    ? maxOpacity
    : round(
        Math.abs(
          ((maxOpacity - minOpacity) / (extremeValue - cutoffPoint)) *
            (value - cutoffPoint),
        ) + minOpacity,
        2,
      );

export const getColorFunction = (
  {
    operator,
    targetValue,
    targetValueLeft,
    targetValueRight,
    colorScheme,
  }: ConditionalFormattingConfig,
  columnValues: number[],
) => {
  let minOpacity = MIN_OPACITY_BOUNDED;
  const maxOpacity = MAX_OPACITY;

  let comparatorFunction: (
    value: number,
    allValues: number[],
  ) => false | { cutoffValue: number; extremeValue: number };
  if (operator === undefined || colorScheme === undefined) {
    return () => undefined;
  }
  if (
    MULTIPLE_VALUE_COMPARATORS.includes(operator) &&
    (targetValueLeft === undefined || targetValueRight === undefined)
  ) {
    return () => undefined;
  }
  if (
    operator !== COMPARATOR.NONE &&
    !MULTIPLE_VALUE_COMPARATORS.includes(operator) &&
    targetValue === undefined
  ) {
    return () => undefined;
  }
  switch (operator) {
    case COMPARATOR.NONE:
      minOpacity = MIN_OPACITY_UNBOUNDED;
      comparatorFunction = (value: number, allValues: number[]) => {
        const cutoffValue = Math.min(...allValues);
        const extremeValue = Math.max(...allValues);
        return value >= cutoffValue && value <= extremeValue
          ? { cutoffValue, extremeValue }
          : false;
      };
      break;
    case COMPARATOR.GREATER_THAN:
      comparatorFunction = (value: number, allValues: number[]) =>
        value > targetValue!
          ? { cutoffValue: targetValue!, extremeValue: Math.max(...allValues) }
          : false;
      break;
    case COMPARATOR.LESS_THAN:
      comparatorFunction = (value: number, allValues: number[]) =>
        value < targetValue!
          ? { cutoffValue: targetValue!, extremeValue: Math.min(...allValues) }
          : false;
      break;
    case COMPARATOR.GREATER_OR_EQUAL:
      comparatorFunction = (value: number, allValues: number[]) =>
        value >= targetValue!
          ? { cutoffValue: targetValue!, extremeValue: Math.max(...allValues) }
          : false;
      break;
    case COMPARATOR.LESS_OR_EQUAL:
      comparatorFunction = (value: number, allValues: number[]) =>
        value <= targetValue!
          ? { cutoffValue: targetValue!, extremeValue: Math.min(...allValues) }
          : false;
      break;
    case COMPARATOR.EQUAL:
      comparatorFunction = (value: number) =>
        value === targetValue!
          ? { cutoffValue: targetValue!, extremeValue: targetValue! }
          : false;
      break;
    case COMPARATOR.NOT_EQUAL:
      comparatorFunction = (value: number, allValues: number[]) => {
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
      };
      break;
    case COMPARATOR.BETWEEN:
      comparatorFunction = (value: number) =>
        value > targetValueLeft! && value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case COMPARATOR.BETWEEN_OR_EQUAL:
      comparatorFunction = (value: number) =>
        value >= targetValueLeft! && value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case COMPARATOR.BETWEEN_OR_LEFT_EQUAL:
      comparatorFunction = (value: number) =>
        value >= targetValueLeft! && value < targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    case COMPARATOR.BETWEEN_OR_RIGHT_EQUAL:
      comparatorFunction = (value: number) =>
        value > targetValueLeft! && value <= targetValueRight!
          ? { cutoffValue: targetValueLeft!, extremeValue: targetValueRight! }
          : false;
      break;
    default:
      comparatorFunction = () => false;
      break;
  }

  return (value: number) => {
    const compareResult = comparatorFunction(value, columnValues);
    if (compareResult === false) return undefined;
    const { cutoffValue, extremeValue } = compareResult;
    return rgbToRgba(
      colorScheme,
      getOpacity(value, cutoffValue, extremeValue, minOpacity, maxOpacity),
    );
  };
};

export const getColorFormatters = (
  columnConfig: ConditionalFormattingConfig[] | undefined,
  data: DataRecord[],
) =>
  columnConfig?.reduce(
    (acc: ColorFormatters, config: ConditionalFormattingConfig) => {
      if (
        config?.column !== undefined &&
        (config?.operator === COMPARATOR.NONE ||
          (config?.operator !== undefined &&
            (MULTIPLE_VALUE_COMPARATORS.includes(config?.operator)
              ? config?.targetValueLeft !== undefined &&
                config?.targetValueRight !== undefined
              : config?.targetValue !== undefined)))
      ) {
        acc.push({
          column: config?.column,
          getColorFromValue: getColorFunction(
            config,
            data.map(row => row[config.column!] as number),
          ),
        });
      }
      return acc;
    },
    [],
  ) ?? [];
