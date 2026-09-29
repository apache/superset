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
const NUMERIC_MANTISSA = /^(?:\d+|\d*\.\d+)$/;

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

/** Whether the grid treats a string as a JavaScript number literal. */
export function isNumericText(value: string): boolean {
  if (value === 'NaN') return true;
  const unsigned = value[0] === '-' ? value.slice(1) : value;
  if (unsigned === 'Infinity') return true;
  const parts = splitExponent(unsigned);
  return parts !== null && NUMERIC_MANTISSA.test(parts[0]);
}

export function sortResults(valueA: CellValue, valueB: CellValue): number {
  if (valueA === valueB) return 0;
  if (valueA === null) return 1;
  if (valueB === null) return -1;

  const a = decimalParts(valueA);
  const b = decimalParts(valueB);
  if (a && b) {
    if (a.sign !== b.sign) return a.sign < b.sign ? -1 : 1;
    if (a.sign === 0) return 0;
    if (a.order !== b.order) return (a.order < b.order ? -1 : 1) * a.sign;
    const width = Math.max(a.digits.length, b.digits.length);
    const left = a.digits.padEnd(width, '0');
    const right = b.digits.padEnd(width, '0');
    return left === right ? 0 : (left < right ? -1 : 1) * a.sign;
  }

  // Retain the table's existing numeric-string, text and infinity behavior.
  const numberOrText = (value: Exclude<CellValue, null>) =>
    typeof value === 'string' && isNumericText(value) ? Number(value) : value;
  const left = numberOrText(valueA);
  const right = numberOrText(valueB);
  if (
    typeof left === 'number' &&
    typeof right === 'number' &&
    !Number.isNaN(left) &&
    !Number.isNaN(right)
  ) {
    return left === right ? 0 : left < right ? -1 : 1;
  }
  // Comparing a number against text (or against NaN) with `<` yields false both
  // ways round, which makes the comparator intransitive and leaves the grid's
  // sort order dependent on the input order. Compare those as text instead.
  const leftText = String(left);
  const rightText = String(right);
  return leftText === rightText ? 0 : leftText < rightText ? -1 : 1;
}
