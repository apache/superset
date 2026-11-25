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
import fetchMock from 'fetch-mock';
import { DatasourceType, type Policy } from '@superset-ui/core';
import { Form } from '@superset-ui/core/components';
import { createWrapper } from 'spec/helpers/testing-library';
import { initialTimeRangeLimitsState } from 'src/dashboard/reducers/timeRangeLimits';
import {
  usePreFilterTimeRangeCheck,
  type useFilterLimitsStatus,
} from './useFilterTimeRangeLimits';

const NO_RULES: Policy = {
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
};

const spanDays = (quantity: number): Policy => ({
  ...NO_RULES,
  max_span: { quantity, time_grain: 'P1D' },
});

const datasetAnswer = (days: number) => ({
  result: {
    schema_version: 1,
    global_revision: 0,
    global: NO_RULES,
    dataset: spanDays(days),
  },
});

const status = {
  loadedLimits: {
    levels: [
      { source: 'global', policy: NO_RULES },
      { source: 'dashboard', policy: NO_RULES },
    ],
    dashboardId: 1,
  },
} as unknown as ReturnType<typeof useFilterLimitsStatus>;

beforeAll(() => {
  fetchMock.mockGlobal();
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test("a late answer for the previous dataset doesn't replace the selected dataset's limits", async () => {
  let answerFirst: (value: object) => void = () => undefined;
  fetchMock.get(
    'glob:*/api/v1/dataset/1/time_range_limits/',
    () =>
      new Promise<object>(resolve => {
        answerFirst = resolve;
      }),
  );
  fetchMock.get('glob:*/api/v1/dataset/2/time_range_limits/', datasetAnswer(7));
  const { result, rerender } = renderHook(
    ({ datasetId }: { datasetId: number }) => {
      const [form] = Form.useForm();
      return usePreFilterTimeRangeCheck({
        status,
        form,
        filterId: 'NATIVE_FILTER-S1',
        datasetId,
        datasourceType: DatasourceType.Table,
      });
    },
    {
      initialProps: { datasetId: 1 },
      wrapper: createWrapper({
        useRedux: true,
        initialState: {
          timeRangeLimits: {
            ...initialTimeRangeLimitsState,
            status: 'loaded',
            dashboardId: 1,
            payload: {
              schema_version: 1,
              global_revision: 0,
              global: NO_RULES,
              dashboard: NO_RULES,
              datasets: [],
              timezone: 'UTC',
            },
          },
        },
      }),
    },
  );
  const datasetSpan = () =>
    result.current.preFilterPickerLimits?.levels.find(
      level => level.source === 'dataset',
    )?.policy?.max_span?.quantity;

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/dataset/1/time_range_limits/'),
    ).toHaveLength(1),
  );
  rerender({ datasetId: 2 });
  await waitFor(() => expect(datasetSpan()).toBe(7));

  await act(async () => {
    answerFirst(datasetAnswer(90));
    await new Promise(done => setTimeout(done, 0));
  });

  expect(datasetSpan()).toBe(7);
});
