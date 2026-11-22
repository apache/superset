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
import { ValueGetterParams } from '@superset-ui/core/components/ThemedAgGridReact';
import filterValueGetter from './filterValueGetter';

const makeParams = (value: unknown): ValueGetterParams =>
  ({
    data: { foo: value },
    colDef: { field: 'foo' },
  }) as unknown as ValueGetterParams;

test('filterValueGetter scales a percent value without binary noise', () => {
  expect(filterValueGetter(makeParams(0.25), true)).toBe(25);
  expect(filterValueGetter(makeParams(0.07), true)).toBe(7);
  expect(filterValueGetter(makeParams(12.345), true)).toBe(1234.5);
  expect(filterValueGetter(makeParams(1.5e-7), true)).toBe(1.5e-5);
  expect(filterValueGetter(makeParams(-0.123456789), true)).toBe(-12.3456789);
});

test('filterValueGetter returns the raw value for a non-percent format', () => {
  expect(filterValueGetter(makeParams(0.25), false)).toBe(0.25);
  expect(filterValueGetter(makeParams(1234567890123456), false)).toBe(
    1234567890123456,
  );
});

test('filterValueGetter keeps zero and numeric strings', () => {
  expect(filterValueGetter(makeParams(0), true)).toBe(0);
  expect(filterValueGetter(makeParams('0.25'), true)).toBe(25);
});

test('filterValueGetter returns null for a missing or non-numeric value', () => {
  [null, undefined, '', ' ', 'n/a', true, Infinity, NaN].forEach(value =>
    expect(filterValueGetter(makeParams(value), true)).toBeNull(),
  );
});
