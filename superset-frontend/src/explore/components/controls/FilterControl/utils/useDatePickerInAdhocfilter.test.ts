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
import { createElement, ReactElement, ReactNode } from 'react';
import { Provider } from 'react-redux';
import { renderHook, cleanup } from '@testing-library/react';
import { TestDataset } from '@superset-ui/chart-controls';
import type { TimeRangeLimits } from '@superset-ui/core';
import { createStore } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { ExploreTimeRangeLimitsContext } from 'src/explore/components/controls/DateFilterControl/ExploreTimeRangeLimitsContext';
import { useDatePickerInAdhocFilter } from './useDatePickerInAdhocFilter';

// Add cleanup after each test
afterEach(async () => {
  cleanup();
  // Wait for any pending effects to complete
  await new Promise(resolve => setTimeout(resolve, 0));
});

test('should return undefined if column is not temporal', async () => {
  const { result, unmount } = renderHook(() =>
    useDatePickerInAdhocFilter({
      columnName: 'gender',
      datasource: TestDataset,
      onChange: jest.fn(),
    }),
  );
  expect(result.current).toBeUndefined();
  unmount();
});

test('should return JSX', async () => {
  const { result, unmount } = renderHook(() =>
    useDatePickerInAdhocFilter({
      columnName: 'ds',
      datasource: TestDataset,
      onChange: jest.fn(),
    }),
  );
  expect(result.current).not.toBeUndefined();
  unmount();
});

const LIMITS: TimeRangeLimits = {
  levels: [
    {
      source: 'global',
      policy: {
        max_span: { quantity: 30, time_grain: 'P1D' },
        max_look_back: null,
        max_look_forward: null,
      },
    },
  ],
  timezone: 'UTC',
};

const pickerProps = (element: ReactElement | undefined) =>
  (element!.props.children as ReactElement[])[1].props;

const renderPicker = (
  wrapper?: (props: { children?: ReactNode }) => ReactElement,
) =>
  renderHook(
    () =>
      useDatePickerInAdhocFilter({
        columnName: 'ds',
        datasource: TestDataset,
        onChange: jest.fn(),
      }),
    { wrapper },
  );

test('in Explore the picker gets the page limits, without a dashboard id', async () => {
  const { result, unmount } = renderPicker(({ children }) =>
    createElement(
      ExploreTimeRangeLimitsContext.Provider,
      { value: LIMITS },
      children,
    ),
  );
  expect(pickerProps(result.current).timeRangeLimits).toEqual(LIMITS);
  expect(pickerProps(result.current).timeRangeLimits).not.toHaveProperty(
    'dashboardId',
  );
  unmount();
});

// Guard test: passes on the base too.
test('outside Explore, from a store that visited Explore, the picker gets no limits', async () => {
  const store = createStore(
    {
      explore: {
        controls: {},
        form_data: {},
        timeRangeLimits: {
          status: 'loaded',
          levels: LIMITS.levels,
          timezone: 'UTC',
          datasetId: 1,
        },
      },
    },
    reducerIndex,
  );
  const { result, unmount } = renderPicker(({ children }) =>
    createElement(Provider, { store }, children),
  );
  expect(pickerProps(result.current)).not.toHaveProperty('timeRangeLimits');
  unmount();
});

// Guard test: passes on the base too.
test('without limits the picker gets no prop', async () => {
  const { result, unmount } = renderPicker();
  expect(pickerProps(result.current)).not.toHaveProperty('timeRangeLimits');
  unmount();
});
