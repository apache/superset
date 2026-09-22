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
import { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { NativeFilterType } from '@superset-ui/core';
import { FILTER_TYPE } from 'src/dashboard/util/componentTypes';
import { useFilterControlFactory } from './useFilterControlFactory';

const mockStore = configureStore([thunk]);

test('renders dividers and filters not bound to canvas, but excludes canvas-bound filters from FilterBar rendering', () => {
  const store = mockStore({
    dashboardInfo: {
      metadata: {
        native_filter_configuration: [
          {
            id: 'DIVIDER-1',
            type: NativeFilterType.Divider,
            title: 'Section Divider',
            description: '',
          },
          {
            id: 'NATIVE_FILTER-canvas',
            name: 'Canvas Filter',
            type: NativeFilterType.NativeFilter,
            targets: [{}],
            defaultDataMask: {},
            controlValues: {},
          },
          {
            id: 'NATIVE_FILTER-bar',
            name: 'Bar Filter',
            type: NativeFilterType.NativeFilter,
            targets: [{}],
            defaultDataMask: {},
            controlValues: {},
          },
        ],
      },
    },
    dashboardState: {
      preselectNativeFilters: {},
    },
    dashboardLayout: {
      present: {
        'FILTER_CARD-1': {
          id: 'FILTER_CARD-1',
          type: FILTER_TYPE,
          meta: {
            filterId: 'NATIVE_FILTER-canvas',
          },
        },
      },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  const { result } = renderHook(() => useFilterControlFactory({}, jest.fn()), {
    wrapper,
  });

  const renderedIds = result.current.filtersWithValues.map(item => item.id);

  // Divider must NOT be dropped!
  expect(renderedIds).toContain('DIVIDER-1');

  // Filter bound to canvas must be excluded from FilterBar rendering
  expect(renderedIds).not.toContain('NATIVE_FILTER-canvas');

  // Filter not on canvas must remain in FilterBar rendering
  expect(renderedIds).toContain('NATIVE_FILTER-bar');
});

test('keeps uninitialized requiredFirst canvas filters mounted until initialized, then excludes them', () => {
  const store = mockStore({
    dashboardInfo: {
      metadata: {
        native_filter_configuration: [
          {
            id: 'NATIVE_FILTER-required-canvas',
            name: 'Required Canvas Filter',
            type: NativeFilterType.NativeFilter,
            requiredFirst: true,
            targets: [{}],
            defaultDataMask: {},
            controlValues: {},
          },
        ],
      },
    },
    dashboardState: {
      preselectNativeFilters: {},
    },
    dashboardLayout: {
      present: {
        'FILTER_CARD-1': {
          id: 'FILTER_CARD-1',
          type: FILTER_TYPE,
          meta: {
            filterId: 'NATIVE_FILTER-required-canvas',
          },
        },
      },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  // When uninitialized (no dataMask), requiredFirst filter stays mounted so it can initialize
  const { result, rerender } = renderHook(
    ({ dataMask }: { dataMask: any }) =>
      useFilterControlFactory(dataMask, jest.fn()),
    {
      wrapper,
      initialProps: { dataMask: {} },
    },
  );

  expect(
    result.current.filtersWithValues.map(item => item.id),
  ).toContain('NATIVE_FILTER-required-canvas');

  // Once initialized with a value, it is excluded from FilterBar rendering
  rerender({
    dataMask: {
      'NATIVE_FILTER-required-canvas': {
        filterState: { value: 'selected-val' },
      },
    },
  });

  expect(
    result.current.filtersWithValues.map(item => item.id),
  ).not.toContain('NATIVE_FILTER-required-canvas');
});
