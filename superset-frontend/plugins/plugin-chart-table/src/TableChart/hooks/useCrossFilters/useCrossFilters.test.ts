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
import { renderHook } from '@testing-library/react-hooks';
import { useCrossFilters } from './index';

const mockTimestampFormatter = (value: any) => `formatted_${value}`;

test('isActiveFilterValue returns true when filter is active', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: { country: ['USA', 'Canada'] },
      timestampFormatter: mockTimestampFormatter,
    }),
  );

  expect(result.current.isActiveFilterValue('country', 'USA')).toBe(true);
});

test('isActiveFilterValue returns false when filter is not active', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: { country: ['USA', 'Canada'] },
      timestampFormatter: mockTimestampFormatter,
    }),
  );

  expect(result.current.isActiveFilterValue('country', 'Mexico')).toBe(false);
});

test('isActiveFilterValue returns false when no filters exist', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: undefined,
      timestampFormatter: mockTimestampFormatter,
    }),
  );

  expect(result.current.isActiveFilterValue('country', 'USA')).toBe(false);
});

test('getCrossFilterDataMask creates filter for new value', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: undefined,
      timestampFormatter: mockTimestampFormatter,
    }),
  );

  const dataMask = result.current.getCrossFilterDataMask('country', 'USA');

  expect(dataMask.dataMask.extraFormData.filters).toHaveLength(1);
  expect(dataMask.dataMask.extraFormData.filters[0]).toMatchObject({
    col: 'country',
    op: 'IN',
    val: ['USA'],
  });
  expect(dataMask.isCurrentValueSelected).toBe(false);
});

test('getCrossFilterDataMask clears filters when clicking active value', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: { country: ['USA'] },
      timestampFormatter: mockTimestampFormatter,
    }),
  );

  const dataMask = result.current.getCrossFilterDataMask('country', 'USA');

  expect(dataMask.dataMask.extraFormData.filters).toHaveLength(0);
  expect(dataMask.isCurrentValueSelected).toBe(true);
});

test('getCrossFilterDataMask replaces existing filters with new value', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: { country: ['USA'] },
      timestampFormatter: mockTimestampFormatter,
    }),
  );

  const dataMask = result.current.getCrossFilterDataMask('country', 'Canada');

  expect(dataMask.dataMask.extraFormData.filters).toHaveLength(1);
  expect(dataMask.dataMask.extraFormData.filters[0]).toMatchObject({
    col: 'country',
    op: 'IN',
    val: ['Canada'],
  });
  expect(dataMask.isCurrentValueSelected).toBe(false);
});

test('getCrossFilterDataMask formats timestamp values', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: undefined,
      timestampFormatter: mockTimestampFormatter,
      timeGrain: 'P1D',
    }),
  );

  const dataMask = result.current.getCrossFilterDataMask(
    '__timestamp',
    '2023-01-01',
  );

  expect(dataMask.dataMask.filterState.label).toBe('formatted_2023-01-01');
});

test('getCrossFilterDataMask includes time grain for timestamp filters', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: undefined,
      timestampFormatter: mockTimestampFormatter,
      timeGrain: 'P1D',
    }),
  );

  const dataMask = result.current.getCrossFilterDataMask(
    '__timestamp',
    '2023-01-01',
  );

  expect(dataMask.dataMask.extraFormData.filters[0].grain).toBe('P1D');
});

test('getCrossFilterDataMask does not include grain for non-timestamp filters', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: undefined,
      timestampFormatter: mockTimestampFormatter,
      timeGrain: 'P1D',
    }),
  );

  const dataMask = result.current.getCrossFilterDataMask('country', 'USA');

  expect(dataMask.dataMask.extraFormData.filters[0].grain).toBeUndefined();
});

test('toggleFilter calls setDataMask with correct data mask', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: undefined,
      timestampFormatter: mockTimestampFormatter,
    }),
  );

  const setDataMask = jest.fn();
  result.current.toggleFilter('country', 'USA', setDataMask);

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: expect.objectContaining({
        filters: expect.arrayContaining([
          expect.objectContaining({
            col: 'country',
            op: 'IN',
            val: ['USA'],
          }),
        ]),
      }),
    }),
  );
});

test('toggleFilter turns off active filter', () => {
  const { result } = renderHook(() =>
    useCrossFilters({
      filters: { country: ['USA'] },
      timestampFormatter: mockTimestampFormatter,
    }),
  );

  const setDataMask = jest.fn();
  result.current.toggleFilter('country', 'USA', setDataMask);

  expect(setDataMask).toHaveBeenCalledWith(
    expect.objectContaining({
      extraFormData: {
        filters: [],
      },
    }),
  );
});
