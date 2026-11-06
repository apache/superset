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

import { act, renderHook, waitFor } from '@testing-library/react';
import { SupersetClient } from '../../..';
import {
  MatrixifyAllowedValuesFormData,
  useMatrixifyAllowedValues,
} from './useMatrixifyAllowedValues';

jest.mock('../../..', () => ({
  SupersetClient: { get: jest.fn() },
}));

const mockGet = SupersetClient.get as jest.Mock;

const rowDimensionFormData = (
  dimension: string,
): MatrixifyAllowedValuesFormData => ({
  datasource: '7__table',
  matrixify_enable: true,
  matrixify_mode_rows: 'dimensions',
  matrixify_dimension_rows: { dimension, values: ['US'] },
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('resolves immediately without fetching for metrics-only matrixify', () => {
  const { result } = renderHook(() =>
    useMatrixifyAllowedValues({
      datasource: '1__table',
      matrixify_enable: true,
      matrixify_mode_rows: 'metrics',
      matrixify_mode_columns: 'metrics',
    }),
  );

  expect(result.current.status).toBe('success');
  expect(result.current.allowedByColumn).toEqual({});
  expect(mockGet).not.toHaveBeenCalled();
});

test('fetches RLS-allowed values for each dimension axis', async () => {
  mockGet.mockImplementation(({ endpoint }: { endpoint: string }) => {
    if (endpoint.includes('/column/region/')) {
      return Promise.resolve({ json: { result: ['US', 'CA'] } });
    }
    return Promise.resolve({ json: { result: [2024, 2025] } });
  });

  const { result } = renderHook(() =>
    useMatrixifyAllowedValues({
      datasource: '7__table',
      matrixify_enable: true,
      matrixify_mode_rows: 'dimensions',
      matrixify_dimension_rows: { dimension: 'region', values: ['US', 'EU'] },
      matrixify_mode_columns: 'dimensions',
      matrixify_dimension_columns: { dimension: 'year', values: [2024] },
    }),
  );

  await waitFor(() => expect(result.current.status).toBe('success'));

  expect(mockGet).toHaveBeenCalledTimes(2);
  expect(result.current.allowedByColumn.region).toEqual(new Set(['US', 'CA']));
  // values are string-normalized so they can be compared regardless of type
  expect(result.current.allowedByColumn.year).toEqual(
    new Set(['2024', '2025']),
  );
});

test('fails closed when the values endpoint errors', async () => {
  mockGet.mockRejectedValue(new Error('boom'));

  const { result } = renderHook(() =>
    useMatrixifyAllowedValues(rowDimensionFormData('region')),
  );

  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(result.current.allowedByColumn).toEqual({});
});

test('fails closed when datasource is missing', async () => {
  const { result } = renderHook(() =>
    useMatrixifyAllowedValues({
      matrixify_enable: true,
      matrixify_mode_rows: 'dimensions',
      matrixify_dimension_rows: { dimension: 'region', values: ['US'] },
    }),
  );

  await waitFor(() => expect(result.current.status).toBe('error'));
  expect(mockGet).not.toHaveBeenCalled();
});

test('reports loading again as soon as the dimension column changes', async () => {
  mockGet.mockImplementation(({ endpoint }: { endpoint: string }) =>
    Promise.resolve({
      json: {
        result: endpoint.includes('/column/region/') ? ['US'] : ['red'],
      },
    }),
  );

  const { result, rerender } = renderHook(
    ({ dimension }: { dimension: string }) =>
      useMatrixifyAllowedValues(rowDimensionFormData(dimension)),
    { initialProps: { dimension: 'region' } },
  );

  await waitFor(() => expect(result.current.status).toBe('success'));

  rerender({ dimension: 'color' });

  // The first render seeing the new column must not expose the previous
  // allow-list: it holds no entry for `color`, so the grid would filter
  // nothing and render the frozen (unfiltered) values.
  expect(result.current.status).toBe('loading');
  expect(result.current.allowedByColumn).toEqual({});

  await waitFor(() => expect(result.current.status).toBe('success'));
  expect(result.current.allowedByColumn).toEqual({ color: new Set(['red']) });
});

test('discards a response that resolves after its request was superseded', async () => {
  const pending: ((value: unknown) => void)[] = [];
  mockGet.mockImplementation(
    () =>
      new Promise(resolve => {
        pending.push(resolve);
      }),
  );

  const { result, rerender } = renderHook(
    ({ dimension }: { dimension: string }) =>
      useMatrixifyAllowedValues(rowDimensionFormData(dimension)),
    { initialProps: { dimension: 'region' } },
  );

  rerender({ dimension: 'color' });

  await act(async () => {
    pending[0]({ json: { result: ['US', 'EU'] } });
  });

  expect(result.current.status).toBe('loading');
  expect(result.current.allowedByColumn).toEqual({});

  await act(async () => {
    pending[1]({ json: { result: ['red'] } });
  });

  expect(result.current.status).toBe('success');
  expect(result.current.allowedByColumn).toEqual({ color: new Set(['red']) });
});

test('a superseded request failing does not surface an error', async () => {
  const pending: ((reason: Error) => void)[] = [];
  mockGet.mockImplementation(
    () =>
      new Promise((_resolve, reject) => {
        pending.push(reject);
      }),
  );

  const { result, rerender } = renderHook(
    ({ dimension }: { dimension: string }) =>
      useMatrixifyAllowedValues(rowDimensionFormData(dimension)),
    { initialProps: { dimension: 'region' } },
  );

  rerender({ dimension: 'color' });

  await act(async () => {
    pending[0](new Error('aborted'));
  });

  expect(result.current.status).toBe('loading');
});
