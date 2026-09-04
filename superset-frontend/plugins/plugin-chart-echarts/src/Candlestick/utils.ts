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
import { ensureIsArray } from '@superset-ui/core';

export const MOVING_AVERAGE_PERIODS = [5, 10, 15, 20, 30, 60];
export const MA_LINE_OPACITY = 0.5;

export function movingAverageName(period: number, seriesName?: string): string {
  const label = `MA${period}`;
  return seriesName ? `${seriesName} ${label}` : label;
}

function parseMovingAveragePeriod(item: unknown): number | null {
  if (typeof item === 'number') {
    return Number.isInteger(item) && item > 1 ? item : null;
  }
  const match = String(item)
    .trim()
    .match(/^(?:MA)?(\d+)$/i);
  if (!match) {
    return null;
  }
  const period = Number(match[1]);
  return Number.isInteger(period) && period > 1 ? period : null;
}

export function parseMovingAveragePeriods(value: unknown): number[] {
  const periods = ensureIsArray(value)
    .map(parseMovingAveragePeriod)
    .filter((period): period is number => period !== null);
  return [...new Set(periods)].sort((left, right) => left - right);
}

/**
 * Simple moving average of close prices: the first `period - 1` points
 * are omitted, then each value is the mean of the current close and the
 * previous `period - 1` closes.
 */
export function calculateMA(
  closes: Array<number | null>,
  period: number,
): Array<number | '-'> {
  const result: Array<number | '-'> = [];
  for (let i = 0; i < closes.length; i += 1) {
    if (i < period - 1) {
      result.push('-');
      continue;
    }
    let sum = 0;
    let valid = true;
    for (let j = 0; j < period; j += 1) {
      const close = closes[i - j];
      if (close === null) {
        valid = false;
        break;
      }
      sum += close;
    }
    result.push(valid ? sum / period : '-');
  }
  return result;
}
