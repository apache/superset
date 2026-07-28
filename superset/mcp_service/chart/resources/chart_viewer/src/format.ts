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
import { format as d3Format } from 'd3-format';
import { timeFormat } from 'd3-time-format';
import type { DataColumn } from './types';

const compact = d3Format('.3~s'); // e.g. 1.2M, 3.4k
const fixed2 = d3Format(',.2~f');
const pct = d3Format('.1~%');
const int = d3Format(',d');

/** Compact, human-friendly number: 1.2M / 3.4k / 987. */
export function formatNumber(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return String(value ?? '');
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1_000_000 || abs < 0.001)) return compact(n).replace('G', 'B');
  if (Number.isInteger(n) && abs < 1_000_000) return int(n);
  if (abs >= 1000) return compact(n).replace('G', 'B');
  return fixed2(n);
}

/** Full-precision, grouped number for tooltips and table cells. */
export function formatFull(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return String(value ?? '');
  return Number.isInteger(n) ? int(n) : fixed2(n);
}

/** Percentage for semantic percentage columns (input is a ratio, e.g. 0.42). */
export function formatPercent(value: unknown): string {
  const n = toNumber(value);
  if (n === null) return String(value ?? '');
  return pct(n);
}

/** Format a value using a column's semantic type when known. */
export function formatByColumn(value: unknown, column?: DataColumn): string {
  if (value === null || value === undefined) return '—';
  if (column?.semantic_type === 'percentage') return formatPercent(value);
  if (column?.data_type === 'temporal') return formatDate(value);
  if (column?.data_type === 'numeric') return formatFull(value);
  return String(value);
}

const fmtDate = timeFormat('%b %-d, %Y');
const fmtDateTime = timeFormat('%b %-d, %Y %H:%M');
const fmtMonth = timeFormat('%b %Y');

/** Locale-aware date formatting that adapts granularity to the value. */
export function formatDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return String(value ?? '');
  const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
  if (hasTime) return fmtDateTime(d);
  return fmtDate(d);
}

/** Compact axis-label date formatting. */
export function formatAxisDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return String(value ?? '');
  return fmtMonth(d);
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    // Heuristic: treat large integers as epoch millis, else epoch seconds.
    const ms = value > 1e11 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
