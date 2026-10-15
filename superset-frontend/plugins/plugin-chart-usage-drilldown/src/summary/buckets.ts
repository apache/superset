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
import type { DataRecord } from '@superset-ui/core';

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/** Ranges up to this long get one bar per hour instead of per day. */
export const MAX_HOURLY_RANGE = 2 * DAY_MS;

export interface Slot {
  /**
   * Start of the slot, epoch ms: the time filter's start plus whole steps,
   * or the start of the UTC hour or day without a filter.
   */
  start: number;
  value: number;
}

export interface Bucket {
  start: number;
  /** Exclusive end, epoch ms. */
  end: number;
  value: number;
}

const floorTo = (time: number, step: number) => Math.floor(time / step) * step;

function validTimes(data: DataRecord[], timeKey: string): number[] {
  return data
    .filter(record => record[timeKey] !== null)
    .map(record => Number(record[timeKey]))
    .filter(Number.isFinite);
}

/**
 * Hourly when the range (the time filter's, else the data's) is at most
 * MAX_HOURLY_RANGE long, daily otherwise.
 */
export function pickStep(
  data: DataRecord[],
  timeKey: string,
  from?: number | null,
  to?: number | null,
): number {
  const times = validTimes(data, timeKey);
  const first = from ?? (times.length ? Math.min(...times) : undefined);
  const end = to ?? (times.length ? Math.max(...times) + HOUR_MS : undefined);
  if (first === undefined || end === undefined) return DAY_MS;
  return end - first <= MAX_HOURLY_RANGE ? HOUR_MS : DAY_MS;
}

/**
 * One slot per `step` starting exactly at `from`, so a rolling "Last 7 days"
 * (e.g. 05:41 to 05:41) gives 7 bars rather than touching 8 calendar days.
 * Rows are hourly; each goes to the slot holding the middle of the part of
 * its hour that falls inside the range.
 */
function anchoredSeries(
  data: DataRecord[],
  timeKey: string,
  metricKey: string,
  step: number,
  from: number,
  to: number,
): Slot[] {
  // Tolerate rounding so an exact 7-day range never gets an 8th sliver.
  const count = Math.max(1, Math.ceil((to - from) / step - 1e-6));
  const slots: Slot[] = Array.from({ length: count }, (_, i) => ({
    start: from + i * step,
    value: 0,
  }));
  data.forEach(record => {
    const time = Number(record[timeKey]);
    if (record[timeKey] === null || !Number.isFinite(time)) return;
    const middle = (Math.max(time, from) + Math.min(time + HOUR_MS, to)) / 2;
    const index = Math.min(
      count - 1,
      Math.max(0, Math.floor((middle - from) / step)),
    );
    slots[index].value += Number(record[metricKey]) || 0;
  });
  return slots;
}

/**
 * Totals per `step` (hour or day) from `from` up to `to` (exclusive); without
 * a time filter, per UTC hour or day over the data's own range. Slots without
 * rows are included with a value of 0 so they still show up as (empty) bars.
 */
export function series(
  data: DataRecord[],
  timeKey: string,
  metricKey: string,
  step: number,
  from?: number | null,
  to?: number | null,
): Slot[] {
  if (from != null && to != null && to > from) {
    return anchoredSeries(data, timeKey, metricKey, step, from, to);
  }
  const totals = new Map<number, number>();
  data.forEach(record => {
    const time = Number(record[timeKey]);
    if (record[timeKey] === null || !Number.isFinite(time)) return;
    const slot = floorTo(time, step);
    totals.set(
      slot,
      (totals.get(slot) ?? 0) + (Number(record[metricKey]) || 0),
    );
  });

  const known = [...totals.keys()];
  const first = from ?? (known.length ? Math.min(...known) : undefined);
  const end = to ?? (known.length ? Math.max(...known) + step : undefined);
  if (first === undefined || end === undefined) return [];

  const slots: Slot[] = [];
  for (let slot = floorTo(first, step); slot < end; slot += step) {
    slots.push({ start: slot, value: totals.get(slot) ?? 0 });
  }
  return slots;
}

/** Groups consecutive slots into buckets of `size` slots; the last may be shorter. */
export function groupSlots(
  slots: Slot[],
  size: number,
  step: number,
): Bucket[] {
  const buckets: Bucket[] = [];
  for (let i = 0; i < slots.length; i += size) {
    const chunk = slots.slice(i, i + size);
    buckets.push({
      start: chunk[0].start,
      end: chunk[chunk.length - 1].start + step,
      value: chunk.reduce((sum, slot) => sum + slot.value, 0),
    });
  }
  return buckets;
}

/** Most bars the chart starts with before switching to a larger bucket. */
export const MAX_BARS = 60;

/**
 * Smallest bucket size that keeps the chart at MAX_BARS bars or fewer, so a
 * long range opens with e.g. 7-day bars; the largest size if none does.
 */
export function autoBucketSize(dayCount: number, sizes: number[]): number {
  const sorted = [...sizes].sort((a, b) => a - b);
  return (
    sorted.find(size => Math.ceil(dayCount / size) <= MAX_BARS) ??
    sorted[sorted.length - 1]
  );
}

/** "1, 3" -> [1, 3]; ignores anything that is not a positive whole number. */
export function parseBucketSizes(text?: string): number[] {
  const sizes = (text ?? '')
    .split(',')
    .map(part => Number(part.trim()))
    .filter(size => Number.isInteger(size) && size > 0);
  return sizes.length ? [...new Set(sizes)] : [1];
}
