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
import { Provider } from 'react-redux';
import configureMockStore from 'redux-mock-store';
import { useDashboardFormData } from './useDashboardFormData';

const mockStore = configureMockStore([]);

const createMockState = (overrides = {}) => ({
  dashboardInfo: {
    id: 123,
    metadata: {
      chart_configuration: {},
    },
  },
  dashboardState: {
    sliceIds: [1, 2, 3],
  },
  nativeFilters: {
    filters: {},
  },
  dataMask: {},
  ...overrides,
});

const renderUseDashboardFormData = (
  chartId: number | null | undefined,
  state = {},
) => {
  const store = mockStore(createMockState(state));
  return renderHook(() => useDashboardFormData(chartId), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });
};

test('returns base dashboard context when chartId is null', () => {
  const { result } = renderUseDashboardFormData(null);

  expect(result.current).toEqual({ dashboardId: 123 });
});

test('returns base dashboard context when chartId is undefined', () => {
  const { result } = renderUseDashboardFormData(undefined);

  expect(result.current).toEqual({ dashboardId: 123 });
});

test('returns base dashboard context when required state is missing', () => {
  const { result } = renderUseDashboardFormData(1, {
    nativeFilters: null,
  });

  expect(result.current).toEqual({ dashboardId: 123 });
});

test('returns base dashboard context when no filters apply to chart', () => {
  const { result } = renderUseDashboardFormData(1, {
    nativeFilters: {
      filters: {
        'filter-1': {
          scope: [2, 3], // Doesn't include chartId 1
        },
      },
    },
    dashboardInfo: {
      id: 123,
      metadata: {
        chart_configuration: {
          'filter-1': {
            id: 'filter-1',
            scope: [2, 3],
          },
        },
      },
    },
  });

  expect(result.current).toEqual({ dashboardId: 123 });
});

test('returns dashboard context with extra form data when filters apply', () => {
  const mockState = {
    nativeFilters: {
      filters: {
        'filter-1': {
          scope: [1, 2, 3], // Includes chartId 1
        },
      },
    },
    dashboardInfo: {
      id: 123,
      metadata: {
        chart_configuration: {
          'filter-1': {
            id: 'filter-1',
            scope: [1, 2, 3],
          },
        },
      },
    },
    dataMask: {
      'filter-1': {
        extraFormData: {
          filters: [
            {
              col: 'country',
              op: 'IN',
              val: ['USA', 'Canada'],
            },
          ],
        },
      },
    },
  };

  // Mock the external utility functions
  jest.mock('../util/activeAllDashboardFilters', () => ({
    getAllActiveFilters: () => ({
      'filter-1': {
        scope: [1, 2, 3],
      },
    }),
  }));

  jest.mock('../components/nativeFilters/utils', () => ({
    getExtraFormData: () => ({
      filters: [
        {
          col: 'country',
          op: 'IN',
          val: ['USA', 'Canada'],
        },
      ],
    }),
  }));

  const { result } = renderUseDashboardFormData(1, mockState);

  expect(result.current.dashboardId).toBe(123);
  expect(result.current.extra_form_data).toBeDefined();
});

test('handles different dashboard IDs correctly', () => {
  const { result } = renderUseDashboardFormData(1, {
    dashboardInfo: {
      id: 456,
      metadata: {
        chart_configuration: {},
      },
    },
  });

  expect(result.current).toEqual({ dashboardId: 456 });
});
