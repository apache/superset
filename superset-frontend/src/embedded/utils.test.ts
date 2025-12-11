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
import { DataMaskStateWithId } from '@superset-ui/core';
import { cloneDeep } from 'lodash';
import { getDataMaskChangeTrigger, getChartDataPayloads } from './utils';
import { RootState } from 'src/views/store';
import * as chartStateConverter from 'src/dashboard/util/chartStateConverter';
import * as exploreUtils from 'src/explore/exploreUtils';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { getAppliedFilterValues } from 'src/dashboard/util/activeDashboardFilters';

jest.mock('src/dashboard/util/chartStateConverter');
jest.mock('src/dashboard/util/charts/getFormDataWithExtraFilters');
jest.mock('src/dashboard/util/activeDashboardFilters');
jest.mock('src/explore/exploreUtils');

const dataMask: DataMaskStateWithId = {
  '1': {
    id: '1',
    extraFormData: {},
    filterState: {},
    ownState: {},
  },
  '2': {
    id: '2',
    extraFormData: {},
    filterState: {},
    ownState: {},
  },
  'NATIVE_FILTER-1': {
    id: 'NATIVE_FILTER-1',
    extraFormData: {},
    filterState: {
      value: null,
    },
    ownState: {},
  },
  'NATIVE_FILTER-2': {
    id: 'NATIVE_FILTER-2',
    extraFormData: {},
    filterState: {},
    ownState: {},
  },
};

test('datamask didnt change - both triggers set to false', () => {
  const previousDataMask = cloneDeep(dataMask);
  expect(getDataMaskChangeTrigger(dataMask, previousDataMask)).toEqual({
    crossFiltersChanged: false,
    nativeFiltersChanged: false,
  });
});

test('a native filter changed - nativeFiltersChanged set to true', () => {
  const previousDataMask = cloneDeep(dataMask);
  previousDataMask['NATIVE_FILTER-1'].filterState!.value = 'test';
  expect(getDataMaskChangeTrigger(dataMask, previousDataMask)).toEqual({
    crossFiltersChanged: false,
    nativeFiltersChanged: true,
  });
});

test('a cross filter changed - crossFiltersChanged set to true', () => {
  const previousDataMask = cloneDeep(dataMask);
  previousDataMask['1'].filterState!.value = 'test';
  expect(getDataMaskChangeTrigger(dataMask, previousDataMask)).toEqual({
    crossFiltersChanged: true,
    nativeFiltersChanged: false,
  });
});

const mockState: Partial<RootState> = {
  charts: {
    '123': {
      id: 123,
      form_data: {
        viz_type: 'ag-grid-table',
        datasource: '1__table',
      },
    },
    '456': {
      id: 456,
      form_data: {
        viz_type: 'table',
        datasource: '2__table',
      },
    },
  },
  sliceEntities: {
    slices: {
      '123': {
        slice_id: 123,
        slice_name: 'Test Chart 1',
        viz_type: 'ag-grid-table',
      },
      '456': {
        slice_id: 456,
        slice_name: 'Test Chart 2',
        viz_type: 'table',
      },
    },
    isLoading: false,
  },
  dataMask: {
    '123': {
      id: '123',
      extraFormData: {},
      filterState: {},
      ownState: { someState: 'value' },
    },
  },
  dashboardState: {
    sliceIds: [123, 456],
    chartStates: {
      '123': {
        state: { sortModel: [{ colId: 'col1', sort: 'asc' }] },
      },
    },
    colorScheme: 'supersetColors',
    colorNamespace: 'dashboard',
    activeTabs: [],
  },
  dashboardInfo: {
    metadata: {
      chart_configuration: {},
    },
  },
  nativeFilters: {
    filters: {},
  },
} as Partial<RootState>;

beforeEach(() => {
  jest.clearAllMocks();
  (getFormDataWithExtraFilters as jest.Mock).mockImplementation(
    ({ chart }: any) => chart.form_data,
  );
  (getAppliedFilterValues as jest.Mock).mockReturnValue({});
});

test('getChartDataPayloads returns empty object when charts with state converters are not found', async () => {
  const mockHasChartStateConverter = jest
    .spyOn(chartStateConverter, 'hasChartStateConverter')
    .mockReturnValue(false);

  const result = await getChartDataPayloads(mockState as RootState);

  expect(result).toEqual({});
  expect(mockHasChartStateConverter).toHaveBeenCalledWith('ag-grid-table');
  expect(mockHasChartStateConverter).toHaveBeenCalledWith('table');
});

test('getChartDataPayloads generates payloads for charts with state converters', async () => {
  const mockPayload = {
    queries: [{ some: 'query' }],
  };

  jest
    .spyOn(chartStateConverter, 'hasChartStateConverter')
    .mockImplementation((vizType: string) => vizType === 'ag-grid-table');

  jest
    .spyOn(chartStateConverter, 'convertChartStateToOwnState')
    .mockReturnValue({ converted: 'state' });

  jest
    .spyOn(exploreUtils, 'buildV1ChartDataPayload')
    .mockResolvedValue(mockPayload);

  const result = await getChartDataPayloads(mockState as RootState);

  expect(result).toEqual({
    '123': mockPayload,
  });
  expect(chartStateConverter.convertChartStateToOwnState).toHaveBeenCalledWith(
    'ag-grid-table',
    {
      sortModel: [{ colId: 'col1', sort: 'asc' }],
    },
  );
});

test('getChartDataPayloads filters by specific chartId when provided', async () => {
  const mockPayload = {
    queries: [{ some: 'query' }],
  };

  jest
    .spyOn(chartStateConverter, 'hasChartStateConverter')
    .mockReturnValue(true);

  jest
    .spyOn(chartStateConverter, 'convertChartStateToOwnState')
    .mockReturnValue({ converted: 'state' });

  jest
    .spyOn(exploreUtils, 'buildV1ChartDataPayload')
    .mockResolvedValue(mockPayload);

  const result = await getChartDataPayloads(mockState as RootState, {
    chartId: 123,
  });

  expect(result).toEqual({
    '123': mockPayload,
  });
});

test('getChartDataPayloads returns error object for specific chartId not found', async () => {
  jest
    .spyOn(chartStateConverter, 'hasChartStateConverter')
    .mockReturnValue(false);

  const result = await getChartDataPayloads(mockState as RootState, {
    chartId: 999,
  });

  expect(result).toEqual({
    '999': {
      error: true,
      message: 'Chart 999 not found or is not a stateful chart',
    },
  });
});

test('getChartDataPayloads handles errors during payload generation gracefully', async () => {
  const mockPayload = {
    queries: [{ some: 'query' }],
  };

  jest
    .spyOn(chartStateConverter, 'hasChartStateConverter')
    .mockReturnValue(true);

  jest
    .spyOn(chartStateConverter, 'convertChartStateToOwnState')
    .mockReturnValue({ converted: 'state' });

  jest
    .spyOn(exploreUtils, 'buildV1ChartDataPayload')
    .mockImplementation((params: any) => {
      if (params.formData.viz_type === 'ag-grid-table') {
        return Promise.reject(new Error('Failed to build payload'));
      }
      return Promise.resolve(mockPayload);
    });

  const result = await getChartDataPayloads(mockState as RootState);

  expect(result).toEqual({
    '123': {
      error: true,
      message: 'Failed to build payload',
    },
    '456': mockPayload,
  });
});

test('getChartDataPayloads merges baseOwnState with converted chart state', async () => {
  const mockPayload = {
    queries: [{ some: 'query' }],
  };

  jest
    .spyOn(chartStateConverter, 'hasChartStateConverter')
    .mockReturnValue(true);

  jest
    .spyOn(chartStateConverter, 'convertChartStateToOwnState')
    .mockReturnValue({ converted: 'state' });

  const mockBuildPayload = jest
    .spyOn(exploreUtils, 'buildV1ChartDataPayload')
    .mockResolvedValue(mockPayload);

  await getChartDataPayloads(mockState as RootState, { chartId: 123 });

  expect(mockBuildPayload).toHaveBeenCalledWith(
    expect.objectContaining({
      ownState: {
        someState: 'value',
        converted: 'state',
      },
    }),
  );
});
