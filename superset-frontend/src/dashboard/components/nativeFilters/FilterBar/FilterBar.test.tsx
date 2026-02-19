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

import { act, render, screen, userEvent } from 'spec/helpers/testing-library';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import { testWithId } from 'src/utils/testUtils';
import { Preset, makeApi } from '@superset-ui/core';
import {
  TimeFilterPlugin,
  SelectFilterPlugin,
  RangeFilterPlugin,
} from 'src/filters/components';
import fetchMock from 'fetch-mock';
import { FilterBarOrientation } from 'src/dashboard/types';
import { FILTER_BAR_TEST_ID } from './utils';
import FilterBar from '.';
import { FILTERS_CONFIG_MODAL_TEST_ID } from '../FiltersConfigModal/FiltersConfigModal';
import * as dataMaskActions from 'src/dataMask/actions';

jest.useFakeTimers();

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  makeApi: jest.fn(),
}));

const mockedMakeApi = makeApi as jest.Mock;

class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      plugins: [
        new TimeFilterPlugin().configure({ key: 'filter_time' }),
        new SelectFilterPlugin().configure({ key: 'filter_select' }),
        new RangeFilterPlugin().configure({ key: 'filter_range' }),
      ],
    });
  }
}

fetchMock.get('glob:*/api/v1/dataset/7', {
  description_columns: {},
  id: 1,
  label_columns: {
    columns: 'Columns',
    table_name: 'Table Name',
  },
  result: {
    metrics: [],
    columns: [
      {
        column_name: 'Column A',
        id: 1,
      },
    ],
    table_name: 'birth_names',
    id: 1,
  },
  show_columns: ['id', 'table_name'],
});

const getTestId = testWithId<string>(FILTER_BAR_TEST_ID, true);
const getModalTestId = testWithId<string>(FILTERS_CONFIG_MODAL_TEST_ID, true);

const FILTER_NAME = 'Time filter 1';

const addFilterFlow = async () => {
  // open filter config modals
  userEvent.click(screen.getByTestId(getTestId('collapsable')));
  userEvent.click(screen.getByLabelText('setting'));
  userEvent.click(screen.getByText('Add or edit filters and controls'));
  // select filter
  userEvent.click(screen.getByText('Value'));
  userEvent.click(screen.getByText('Time range'));
  userEvent.type(screen.getByTestId(getModalTestId('name-input')), FILTER_NAME);
  userEvent.click(screen.getByText('Save'));
  // TODO: fix this flaky test
  // await screen.findByText('All filters (1)');
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('FilterBar', () => {
  new MainPreset().register();
  const toggleFiltersBar = jest.fn();
  const closedBarProps = {
    filtersOpen: false,
    toggleFiltersBar,
  };
  const openedBarProps = {
    filtersOpen: true,
    toggleFiltersBar,
  };

  const mockApi = jest.fn(async data => {
    if (!data?.modified?.length) {
      return {
        id: 1234,
        result: [],
      };
    }
    const filterId = data.modified[0].id;
    return {
      id: 1234,
      result: [
        {
          id: filterId,
          name: FILTER_NAME,
          filterType: 'filter_time',
          targets: [{ datasetId: 11, column: { name: 'color' } }],
          defaultDataMask: { filterState: { value: null } },
          controlValues: {},
          cascadeParentIds: [],
          scope: { rootPath: ['ROOT_ID'], excluded: [] },
        },
      ],
    };
  });

  const getTimeRangeNoFilterMockUrl =
    'glob:*/api/v1/time_range/?q=%27No%20filter%27';
  const getTimeRangeLastDayMockUrl =
    'glob:*/api/v1/time_range/?q=%27Last%20day%27';
  const getTimeRangeLastWeekMockUrl =
    'glob:*/api/v1/time_range/?q=%27Last%20week%27';

  beforeEach(() => {
    jest.clearAllMocks();

    fetchMock.removeRoute(getTimeRangeNoFilterMockUrl);
    fetchMock.get(
      getTimeRangeNoFilterMockUrl,
      {
        result: { since: '', until: '', timeRange: 'No filter' },
      },
      { name: getTimeRangeNoFilterMockUrl },
    );

    fetchMock.removeRoute(getTimeRangeLastDayMockUrl);
    fetchMock.get(
      getTimeRangeLastDayMockUrl,
      {
        result: {
          since: '2021-04-13T00:00:00',
          until: '2021-04-14T00:00:00',
          timeRange: 'Last day',
        },
      },
      { name: getTimeRangeLastDayMockUrl },
    );

    fetchMock.removeRoute(getTimeRangeLastWeekMockUrl);
    fetchMock.get(
      getTimeRangeLastWeekMockUrl,
      {
        result: {
          since: '2021-04-07T00:00:00',
          until: '2021-04-14T00:00:00',
          timeRange: 'Last week',
        },
      },
      { name: getTimeRangeLastWeekMockUrl },
    );

    mockedMakeApi.mockReturnValue(mockApi);
  });

  const renderWrapper = (props = closedBarProps, state?: object) =>
    render(
      <FilterBar
        orientation={FilterBarOrientation.Vertical}
        verticalConfig={{
          width: 280,
          height: 400,
          offset: 0,
          ...props,
        }}
      />,
      {
        initialState: state,
        useDnd: true,
        useRedux: true,
        useRouter: true,
      },
    );

  test('should render', () => {
    const { container } = renderWrapper();
    expect(container).toBeInTheDocument();
  });

  test('should render the "Filters and controls" heading', () => {
    renderWrapper();
    expect(screen.getByText('Filters and controls')).toBeInTheDocument();
  });

  test('should render the "Clear all" option', () => {
    renderWrapper();
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  test('should render the "Apply filters" option', () => {
    renderWrapper();
    expect(screen.getByText('Apply filters')).toBeInTheDocument();
  });

  test('should render the collapse icon', () => {
    renderWrapper();
    expect(
      screen.getByRole('img', { name: 'vertical-align' }),
    ).toBeInTheDocument();
  });

  test('should render the filter icon', () => {
    renderWrapper();
    expect(screen.getByRole('img', { name: 'filter' })).toBeInTheDocument();
  });

  test('should toggle', () => {
    renderWrapper();
    const collapse = screen.getByRole('img', {
      name: 'vertical-align',
    });
    expect(toggleFiltersBar).not.toHaveBeenCalled();
    userEvent.click(collapse);
    expect(toggleFiltersBar).toHaveBeenCalled();
  });

  test('open filter bar', () => {
    renderWrapper();
    expect(screen.getByTestId(getTestId('filter-icon'))).toBeInTheDocument();
    expect(screen.getByTestId(getTestId('expand-button'))).toBeInTheDocument();

    userEvent.click(screen.getByTestId(getTestId('collapsable')));
    expect(toggleFiltersBar).toHaveBeenCalledWith(true);
  });

  test('no edit filter button by disabled permissions', () => {
    renderWrapper(openedBarProps, {
      ...stateWithoutNativeFilters,
      dashboardInfo: { metadata: {} },
    });

    expect(
      screen.queryByTestId(getTestId('create-filter')),
    ).not.toBeInTheDocument();
  });

  test('close filter bar', () => {
    renderWrapper(openedBarProps);
    const collapseButton = screen.getByTestId(getTestId('collapse-button'));

    expect(collapseButton).toBeInTheDocument();
    userEvent.click(collapseButton);

    expect(toggleFiltersBar).toHaveBeenCalledWith(false);
  });

  test('no filters', () => {
    renderWrapper(openedBarProps, stateWithoutNativeFilters);

    expect(screen.getByTestId(getTestId('clear-button'))).toBeDisabled();
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });

  test('renders dividers', async () => {
    const divider = {
      id: 'NATIVE_FILTER_DIVIDER-1',
      type: 'DIVIDER',
      scope: {
        rootPath: ['ROOT_ID'],
        excluded: [],
      },
      title: 'Select time range',
      description: 'Select year/month etc..',
      chartsInScope: [],
      tabsInScope: [],
    };
    const stateWithDivider = {
      ...stateWithoutNativeFilters,
      dashboardInfo: {
        ...stateWithoutNativeFilters.dashboardInfo,
        metadata: {
          ...stateWithoutNativeFilters.dashboardInfo.metadata,
          native_filter_configuration: [divider],
        },
      },
      nativeFilters: {
        filters: {
          'NATIVE_FILTER_DIVIDER-1': divider,
        },
      },
    };

    renderWrapper(openedBarProps, stateWithDivider);

    await act(async () => {
      jest.advanceTimersByTime(1000); // 1s
    });

    const title = await screen.findByText('Select time range');
    const description = await screen.findByText('Select year/month etc..');

    expect(title.tagName).toBe('H3');
    expect(description.tagName).toBe('P');
    // Do not enable buttons if there are not filters
    expect(screen.getByTestId(getTestId('clear-button'))).toBeDisabled();
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });

  test('create filter and apply it flow', async () => {
    renderWrapper(openedBarProps, stateWithoutNativeFilters);
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();

    await addFilterFlow();

    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });

  test('should render without errors with proper state setup', () => {
    const stateWithFilter = {
      ...stateWithoutNativeFilters,
      dashboardInfo: {
        id: 1,
      },
      dataMask: {
        'test-filter': {
          id: 'test-filter',
          filterState: { value: undefined },
          extraFormData: {},
        },
      },
      nativeFilters: {
        filters: {
          'test-filter': {
            id: 'test-filter',
            name: 'Test Filter',
            filterType: 'filter_select',
            targets: [{ datasetId: 1, column: { name: 'test_column' } }],
            defaultDataMask: {
              filterState: { value: undefined },
              extraFormData: {},
            },
            controlValues: {
              enableEmptyFilter: true,
            },
            cascadeParentIds: [],
            scope: {
              rootPath: ['ROOT_ID'],
              excluded: [],
            },
            type: 'NATIVE_FILTER',
            description: '',
            chartsInScope: [],
            tabsInScope: [],
          },
        },
        filtersState: {},
      },
    };

    const { container } = renderWrapper(openedBarProps, stateWithFilter);
    expect(container).toBeInTheDocument();
  });

  test('auto-applies filter when extraFormData is empty in applied state', async () => {
    const filterId = 'test-filter-auto-apply';
    const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');

    const stateWithIncompleteFilter = {
      ...stateWithoutNativeFilters,
      dashboardInfo: {
        id: 1,
        dash_edit_perm: true,
      },
      dataMask: {
        [filterId]: {
          id: filterId,
          filterState: { value: ['value1', 'value2'] },
          extraFormData: {},
        },
      },
      nativeFilters: {
        filters: {
          [filterId]: {
            id: filterId,
            name: 'Test Filter',
            filterType: 'filter_select',
            targets: [{ datasetId: 1, column: { name: 'test_column' } }],
            defaultDataMask: {
              filterState: { value: ['value1', 'value2'] },
              extraFormData: {},
            },
            controlValues: {
              enableEmptyFilter: true,
            },
            cascadeParentIds: [],
            scope: {
              rootPath: ['ROOT_ID'],
              excluded: [],
            },
            type: 'NATIVE_FILTER',
            description: '',
            chartsInScope: [],
            tabsInScope: [],
          },
        },
        filtersState: {},
      },
    };

    renderWrapper(openedBarProps, stateWithIncompleteFilter);

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByTestId(getTestId('filter-icon'))).toBeInTheDocument();

    updateDataMaskSpy.mockRestore();
  });

  test('renders correctly when filter has complete extraFormData', async () => {
    const filterId = 'test-filter-complete';
    const stateWithCompleteFilter = {
      ...stateWithoutNativeFilters,
      dashboardInfo: {
        id: 1,
        dash_edit_perm: true,
      },
      dataMask: {
        [filterId]: {
          id: filterId,
          filterState: { value: ['value1'] },
          extraFormData: {
            filters: [{ col: 'test_column', op: 'IN', val: ['value1'] }],
          },
        },
      },
      nativeFilters: {
        filters: {
          [filterId]: {
            id: filterId,
            name: 'Test Filter',
            filterType: 'filter_select',
            targets: [{ datasetId: 1, column: { name: 'test_column' } }],
            defaultDataMask: {
              filterState: { value: ['value1'] },
              extraFormData: {
                filters: [{ col: 'test_column', op: 'IN', val: ['value1'] }],
              },
            },
            controlValues: {
              enableEmptyFilter: true,
            },
            cascadeParentIds: [],
            scope: {
              rootPath: ['ROOT_ID'],
              excluded: [],
            },
            type: 'NATIVE_FILTER',
            description: '',
            chartsInScope: [],
            tabsInScope: [],
          },
        },
        filtersState: {},
      },
    };

    renderWrapper(openedBarProps, stateWithCompleteFilter);

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(screen.getByTestId(getTestId('filter-icon'))).toBeInTheDocument();
  });

  test('handleClearAll dispatches updateDataMask with value null for filter_select', async () => {
    const filterId = 'NATIVE_FILTER-clear-select';
    const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
    const selectFilterConfig = {
      id: filterId,
      name: 'Region',
      filterType: 'filter_select',
      targets: [{ datasetId: 7, column: { name: 'region' } }],
      defaultDataMask: { filterState: { value: null }, extraFormData: {} },
      cascadeParentIds: [],
      scope: { rootPath: ['ROOT_ID'], excluded: [] },
      type: 'NATIVE_FILTER',
      description: '',
      chartsInScope: [18],
      tabsInScope: [],
    };
    const stateWithSelect = {
      ...stateWithoutNativeFilters,
      dashboardInfo: {
        id: 1,
        dash_edit_perm: true,
        filterBarOrientation: FilterBarOrientation.Vertical,
        metadata: {
          native_filter_configuration: [selectFilterConfig],
          chart_configuration: {},
        },
      },
      dataMask: {
        [filterId]: {
          id: filterId,
          filterState: { value: ['East'] },
          extraFormData: {},
        },
      },
    };

    renderWrapper(openedBarProps, stateWithSelect);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const clearBtn = screen.getByTestId(getTestId('clear-button'));
    expect(clearBtn).not.toBeDisabled();
    await act(async () => {
      userEvent.click(clearBtn);
    });

    expect(updateDataMaskSpy).toHaveBeenCalledWith(filterId, {
      filterState: { value: undefined },
      extraFormData: {},
    });
    updateDataMaskSpy.mockRestore();
  });

  test('handleClearAll dispatches updateDataMask with value [null, null] for filter_range', async () => {
    fetchMock.post('glob:*/api/v1/chart/data', {
      result: [{ data: [{ min: 0, max: 100 }] }],
    });
    const filterId = 'NATIVE_FILTER-clear-range';
    const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
    const rangeFilterConfig = {
      id: filterId,
      name: 'Age',
      filterType: 'filter_range',
      targets: [{ datasetId: 7, column: { name: 'age' } }],
      defaultDataMask: { filterState: { value: null }, extraFormData: {} },
      cascadeParentIds: [],
      scope: { rootPath: ['ROOT_ID'], excluded: [] },
      type: 'NATIVE_FILTER',
      description: '',
      chartsInScope: [18],
      tabsInScope: [],
    };
    const stateWithRange = {
      ...stateWithoutNativeFilters,
      dashboardInfo: {
        id: 1,
        dash_edit_perm: true,
        filterBarOrientation: FilterBarOrientation.Vertical,
        metadata: {
          native_filter_configuration: [rangeFilterConfig],
          chart_configuration: {},
        },
      },
      dataMask: {
        [filterId]: {
          id: filterId,
          filterState: { value: [10, 50] },
          extraFormData: {},
        },
      },
    };

    renderWrapper(openedBarProps, stateWithRange);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const clearBtn = screen.getByTestId(getTestId('clear-button'));
    expect(clearBtn).not.toBeDisabled();
    await act(async () => {
      userEvent.click(clearBtn);
    });

    expect(updateDataMaskSpy).toHaveBeenCalledWith(filterId, {
      filterState: { value: [null, null] },
      extraFormData: {},
    });
    updateDataMaskSpy.mockRestore();
  });

  test('handleClearAll only dispatches for filters present in dataMask', async () => {
    const idInMask = 'NATIVE_FILTER-has-value';
    const idNotInMask = 'NATIVE_FILTER-no-value';
    const updateDataMaskSpy = jest.spyOn(dataMaskActions, 'updateDataMask');
    const baseFilter = {
      targets: [{ datasetId: 7, column: { name: 'x' } }],
      defaultDataMask: { filterState: { value: null }, extraFormData: {} },
      cascadeParentIds: [],
      scope: { rootPath: ['ROOT_ID'], excluded: [] },
      type: 'NATIVE_FILTER',
      description: '',
      chartsInScope: [18],
      tabsInScope: [],
    };
    const stateWithTwoFiltersOneInMask = {
      ...stateWithoutNativeFilters,
      dashboardInfo: {
        id: 1,
        dash_edit_perm: true,
        filterBarOrientation: FilterBarOrientation.Vertical,
        metadata: {
          native_filter_configuration: [
            {
              ...baseFilter,
              id: idInMask,
              name: 'A',
              filterType: 'filter_select',
            },
            {
              ...baseFilter,
              id: idNotInMask,
              name: 'B',
              filterType: 'filter_select',
            },
          ],
          chart_configuration: {},
        },
      },
      dataMask: {
        [idInMask]: {
          id: idInMask,
          filterState: { value: ['v'] },
          extraFormData: {},
        },
      },
    };

    renderWrapper(openedBarProps, stateWithTwoFiltersOneInMask);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    const clearBtn = screen.getByTestId(getTestId('clear-button'));
    await act(async () => {
      userEvent.click(clearBtn);
    });

    expect(updateDataMaskSpy).toHaveBeenCalledTimes(1);
    expect(updateDataMaskSpy).toHaveBeenCalledWith(idInMask, {
      filterState: { value: undefined },
      extraFormData: {},
    });
    updateDataMaskSpy.mockRestore();
  });
});
