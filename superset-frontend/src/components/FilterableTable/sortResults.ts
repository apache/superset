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
type CellValue = string | number | null;

// Every pattern below is a single flat run of digits, so matching stays linear
// in the input length; the optional parts are split off by hand instead of
// nesting quantified groups, which could backtrack catastrophically.
const DIGITS = /^\d*$/;
const EXPONENT = /^[+-]?\d+$/;

/** Split `text` at its first `e`/`E`; `null` when the exponent is malformed. */
function splitExponent(text: string): [string, string | undefined] | null {
  const at = text.search(/[eE]/);
  if (at === -1) return [text, undefined];
  const exponent = text.slice(at + 1);
  return EXPONENT.test(exponent) ? [text.slice(0, at), exponent] : null;
}

// Compare significands and decimal orders, never coerce exact strings to Number.
// Keeping the exponent separate also avoids allocating 10**exponent zeroes.
export function decimalParts(value: Exclude<CellValue, null>) {
  const text = String(value);
  const signed = text[0] === '+' || text[0] === '-';
  const parts = splitExponent(signed ? text.slice(1) : text);
  if (!parts) return null;
  const [mantissa, exponent] = parts;
  const dot = mantissa.indexOf('.');
  const integer = dot === -1 ? mantissa : mantissa.slice(0, dot);
  const fraction = dot === -1 ? '' : mantissa.slice(dot + 1);
  if (
    !(integer || fraction) ||
    !DIGITS.test(integer) ||
    !DIGITS.test(fraction)
  ) {
    return null;
  }
  const digits = `${integer}${fraction}`.replace(/^0+/, '');
  return {
    sign: digits ? (text[0] === '-' ? -1 : 1) : 0,
    digits,
    order:
      BigInt(digits.length) + BigInt(exponent ?? '0') - BigInt(fraction.length),
  };
}

// Values sort by type first, so mixed columns stay transitive: numbers (exact
// decimal strings and infinities included) before text, and NaN after both.
const NUMERIC_RANK = 0;
const TEXT_RANK = 1;
const NAN_RANK = 2;

type SortKey =
  | {
      rank: typeof NUMERIC_RANK;
      // -1 or 1 for an infinity, 0 for a finite value.
      infinity: number;
      sign: number;
      digits: string;
      order: bigint;
    }
  | { rank: typeof TEXT_RANK; text: string }
  | { rank: typeof NAN_RANK };

function toSortKey(value: Exclude<CellValue, null>): SortKey {
  if (typeof value === 'number' ? Number.isNaN(value) : value === 'NaN') {
    return { rank: NAN_RANK };
  }
  if (value === Infinity || value === 'Infinity') {
    return {
      rank: NUMERIC_RANK,
      infinity: 1,
      sign: 1,
      digits: '',
      order: BigInt(0),
    };
  }
  if (value === -Infinity || value === '-Infinity') {
    return {
      rank: NUMERIC_RANK,
      infinity: -1,
      sign: -1,
      digits: '',
      order: BigInt(0),
    };
  }
  const parts = decimalParts(value);
  return parts
    ? { rank: NUMERIC_RANK, infinity: 0, ...parts }
    : { rank: TEXT_RANK, text: String(value) };
}

// Parsing dominates the cost of sorting decimal strings, and a sort compares
// each cell O(log n) times. Weak row-array keys let cached values be collected
// with their result set instead of retaining them for the life of the page.
const SORT_KEY_CACHE_LIMIT = 250_000;
const sortKeyCaches = new WeakMap<
  readonly unknown[],
  Map<Exclude<CellValue, null>, SortKey>
>();

/** @internal Inspect cache reuse without coupling tests to parser details. */
export function getCachedSortKey(
  value: Exclude<CellValue, null>,
  rows: readonly unknown[],
): SortKey | undefined {
  return sortKeyCaches.get(rows)?.get(value);
}

function sortKey(
  value: Exclude<CellValue, null>,
  rows?: readonly unknown[],
): SortKey {
  if (!rows) return toSortKey(value);
  let sortKeyCache = sortKeyCaches.get(rows);
  if (!sortKeyCache) {
    sortKeyCache = new Map();
    sortKeyCaches.set(rows, sortKeyCache);
  }
  let key = sortKeyCache.get(value);
  if (key === undefined) {
    if (sortKeyCache.size >= SORT_KEY_CACHE_LIMIT) sortKeyCache.clear();
    key = toSortKey(value);
    sortKeyCache.set(value, key);
  }
  return key;
}

function compareKeys(a: SortKey, b: SortKey): number {
  if (a.rank !== b.rank) return a.rank < b.rank ? -1 : 1;
  if (a.rank === TEXT_RANK && b.rank === TEXT_RANK) {
    return a.text === b.text ? 0 : a.text < b.text ? -1 : 1;
  }
  if (a.rank !== NUMERIC_RANK || b.rank !== NUMERIC_RANK) return 0;
  if (a.infinity !== b.infinity) return a.infinity < b.infinity ? -1 : 1;
  if (a.infinity !== 0) return 0;
  if (a.sign !== b.sign) return a.sign < b.sign ? -1 : 1;
  if (a.sign === 0) return 0;
  if (a.order !== b.order) return (a.order < b.order ? -1 : 1) * a.sign;
  const width = Math.max(a.digits.length, b.digits.length);
  const left = a.digits.padEnd(width, '0');
  const right = b.digits.padEnd(width, '0');
  return left === right ? 0 : (left < right ? -1 : 1) * a.sign;
}

export function sortResults(
  valueA: CellValue,
  valueB: CellValue,
  rows?: readonly unknown[],
): number {
  // Plain JavaScript numbers need no parsing; their order agrees with the
  // exact decimal order of their shortest representations.
  if (
    typeof valueA === 'number' &&
    typeof valueB === 'number' &&
    !Number.isNaN(valueA) &&
    !Number.isNaN(valueB)
  ) {
    return valueA === valueB ? 0 : valueA < valueB ? -1 : 1;
  }
  if (valueA === valueB) return 0;
  if (valueA === null) return 1;
  if (valueB === null) return -1;
  return compareKeys(sortKey(valueA, rows), sortKey(valueB, rows));
}
