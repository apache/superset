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

// Compare significands and decimal orders, never coerce exact strings to Number.
// Keeping the exponent separate also avoids allocating 10**exponent zeroes.
const DECIMAL = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/;

function decimalParts(value: Exclude<CellValue, null>) {
  const match = DECIMAL.exec(String(value));
  if (!match) return null;
  const fraction = match[3] ?? match[4] ?? '';
  const digits = `${match[2] ?? ''}${fraction}`.replace(/^0+/, '');
  return {
    sign: digits ? (match[1] === '-' ? -1 : 1) : 0,
    digits,
    order:
      BigInt(digits.length) + BigInt(match[5] ?? '0') - BigInt(fraction.length),
  };
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
    typeof value === 'string' &&
    /^(NaN|-?((\d*\.\d+|\d+)([Ee][+-]?\d+)?|Infinity))$/.test(value)
      ? Number(value)
      : value;
  const left = numberOrText(valueA);
  const right = numberOrText(valueB);
  return left === right ? 0 : left < right ? -1 : 1;
}
