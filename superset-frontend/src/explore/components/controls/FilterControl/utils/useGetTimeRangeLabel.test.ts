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
import { NO_TIME_RANGE } from '@superset-ui/core';
import * as uiCore from '@superset-ui/core';
import { Operators } from 'src/explore/constants';
import { useGetTimeRangeLabel } from './useGetTimeRangeLabel';
import AdhocFilter from '../AdhocFilter';
import { Clauses, ExpressionTypes } from '../types';

test('should return empty object if operator is not TEMPORAL_RANGE', () => {
  const adhocFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'value',
    operator: '>',
    comparator: '10',
    clause: Clauses.Where,
  });
  const { result } = renderHook(() => useGetTimeRangeLabel(adhocFilter));
  expect(result.current).toEqual({});
});

test('should return empty object if expressionType is SQL', () => {
  const adhocFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Sql,
    subject: 'temporal column',
    operator: Operators.TemporalRange,
    comparator: 'Last week',
    clause: Clauses.Where,
  });
  const { result } = renderHook(() => useGetTimeRangeLabel(adhocFilter));
  expect(result.current).toEqual({});
});

test('should get "No filter" label', () => {
  const adhocFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'temporal column',
    operator: Operators.TemporalRange,
    comparator: NO_TIME_RANGE,
    clause: Clauses.Where,
  });
  const { result } = renderHook(() => useGetTimeRangeLabel(adhocFilter));
  expect(result.current).toEqual({
    actualTimeRange: 'temporal column (No filter)',
    title: 'No filter',
  });
});

test('should get actualTimeRange and title', async () => {
  jest
    .spyOn(uiCore, 'fetchTimeRange')
    .mockResolvedValue({ value: 'MOCK TIME' });

  const adhocFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'temporal column',
    operator: Operators.TemporalRange,
    comparator: 'Last week',
    clause: Clauses.Where,
  });

  const { result } = await renderHook(() => useGetTimeRangeLabel(adhocFilter));
  expect(result.current).toEqual({
    actualTimeRange: 'MOCK TIME',
    title: 'Last week',
  });
});

test('should get actualTimeRange and title when gets an error', async () => {
  jest
    .spyOn(uiCore, 'fetchTimeRange')
    .mockResolvedValue({ error: 'MOCK ERROR' });

  const adhocFilter = new AdhocFilter({
    expressionType: ExpressionTypes.Simple,
    subject: 'temporal column',
    operator: Operators.TemporalRange,
    comparator: 'Last week',
    clause: Clauses.Where,
  });

  const { result } = await renderHook(() => useGetTimeRangeLabel(adhocFilter));
  expect(result.current).toEqual({
    actualTimeRange: 'temporal column (Last week)',
    title: 'MOCK ERROR',
  });
});
