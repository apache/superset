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
import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react-hooks';
import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/core';

import { useExecuteReportSchedule } from './useExecuteReportSchedule';

const mockExecuteResponse = {
  execution_id: 'test-uuid-123',
  message: 'Report schedule execution started successfully',
};

beforeAll(() => {
  SupersetClient.configure().init();
});

afterEach(() => {
  fetchMock.reset();
});

test('successfully executes a report', async () => {
  const reportId = 123;
  fetchMock.post(
    `glob:*/api/v1/report/${reportId}/execute`,
    mockExecuteResponse,
  );

  const { result } = renderHook(() => useExecuteReportSchedule());

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(null);

  let executeResult: any;
  await act(async () => {
    executeResult = await result.current.executeReport(reportId);
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(null);
  expect(executeResult).toEqual(mockExecuteResponse);
  expect(fetchMock.calls()).toHaveLength(1);
});

test('handles execution errors', async () => {
  const reportId = 123;
  const errorMessage = 'Report not found';
  fetchMock.post(`glob:*/api/v1/report/${reportId}/execute`, {
    status: 404,
    body: { message: errorMessage },
  });

  const { result } = renderHook(() => useExecuteReportSchedule());

  await act(async () => {
    try {
      await result.current.executeReport(reportId);
    } catch (error) {
      // Expected to throw
    }
  });

  expect(result.current.loading).toBe(false);
  expect(result.current.error).toBe(errorMessage);
});

test('calls success callback on successful execution', async () => {
  const reportId = 123;
  const onSuccess = jest.fn();
  fetchMock.post(
    `glob:*/api/v1/report/${reportId}/execute`,
    mockExecuteResponse,
  );

  const { result } = renderHook(() => useExecuteReportSchedule());

  await act(async () => {
    await result.current.executeReport(reportId, onSuccess);
  });

  expect(onSuccess).toHaveBeenCalledWith(mockExecuteResponse);
});

test('calls error callback on failed execution', async () => {
  const reportId = 123;
  const onError = jest.fn();
  const errorMessage = 'Execution failed';
  fetchMock.post(`glob:*/api/v1/report/${reportId}/execute`, {
    status: 500,
    body: { message: errorMessage },
  });

  const { result } = renderHook(() => useExecuteReportSchedule());

  await act(async () => {
    try {
      await result.current.executeReport(reportId, undefined, onError);
    } catch (error) {
      // Expected to throw
    }
  });

  expect(onError).toHaveBeenCalledWith(errorMessage);
});
