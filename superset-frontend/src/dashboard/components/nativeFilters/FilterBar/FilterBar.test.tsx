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
import { TimeFilterPlugin, SelectFilterPlugin } from 'src/filters/components';
import fetchMock from 'fetch-mock';
import { FilterBarOrientation } from 'src/dashboard/types';
import { FILTER_BAR_TEST_ID } from './utils';
import FilterBar from '.';
import { FILTERS_CONFIG_MODAL_TEST_ID } from '../FiltersConfigModal/FiltersConfigModal';

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
  // open filter config modal
  userEvent.click(screen.getByTestId(getTestId('collapsable')));
  userEvent.click(screen.getByLabelText('gear'));
  userEvent.click(screen.getByText('Add or edit filters'));
  // select filter
  userEvent.click(screen.getByText('Value'));
  userEvent.click(screen.getByText('Time range'));
  userEvent.type(screen.getByTestId(getModalTestId('name-input')), FILTER_NAME);
  userEvent.click(screen.getByText('Save'));
  // TODO: fix this flaky test
  // await screen.findByText('All filters (1)');
};

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
    const json = JSON.parse(data.json_metadata);
    const filterId = json.native_filter_configuration[0].id;
    return {
      id: 1234,
      result: {
        json_metadata: `{
            "label_colors":{"Girls":"#FF69B4","Boys":"#ADD8E6","girl":"#FF69B4","boy":"#ADD8E6"},
            "native_filter_configuration":[{
              "id":"${filterId}",
              "name":"${FILTER_NAME}",
              "filterType":"filter_time",
              "targets":[{"datasetId":11,"column":{"name":"color"}}],
              "defaultDataMask":{"filterState":{"value":null}},
              "controlValues":{},
              "cascadeParentIds":[],
              "scope":{"rootPath":["ROOT_ID"],"excluded":[]}
            }],
          }`,
      },
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.get(
      'glob:*/api/v1/time_range/?q=%27No%20filter%27',
      {
        result: { since: '', until: '', timeRange: 'No filter' },
      },
      { overwriteRoutes: true },
    );
    fetchMock.get(
      'glob:*/api/v1/time_range/?q=%27Last%20day%27',
      {
        result: {
          since: '2021-04-13T00:00:00',
          until: '2021-04-14T00:00:00',
          timeRange: 'Last day',
        },
      },
      { overwriteRoutes: true },
    );
    fetchMock.get(
      'glob:*/api/v1/time_range/?q=%27Last%20week%27',
      {
        result: {
          since: '2021-04-07T00:00:00',
          until: '2021-04-14T00:00:00',
          timeRange: 'Last week',
        },
      },
      { overwriteRoutes: true },
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

  it('should render', () => {
    const { container } = renderWrapper();
    expect(container).toBeInTheDocument();
  });

  it('should render the "Filters" heading', () => {
    renderWrapper();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('should render the "Clear all" option', () => {
    renderWrapper();
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('should render the "Apply filters" option', () => {
    renderWrapper();
    expect(screen.getByText('Apply filters')).toBeInTheDocument();
  });

  it('should render the collapse icon', () => {
    renderWrapper();
    expect(screen.getByRole('img', { name: 'collapse' })).toBeInTheDocument();
  });

  it('should render the filter icon', () => {
    renderWrapper();
    expect(screen.getByRole('img', { name: 'filter' })).toBeInTheDocument();
  });

  it('should toggle', () => {
    renderWrapper();
    const collapse = screen.getByRole('img', { name: 'collapse' });
    expect(toggleFiltersBar).not.toHaveBeenCalled();
    userEvent.click(collapse);
    expect(toggleFiltersBar).toHaveBeenCalled();
  });

  it('open filter bar', () => {
    renderWrapper();
    expect(screen.getByTestId(getTestId('filter-icon'))).toBeInTheDocument();
    expect(screen.getByTestId(getTestId('expand-button'))).toBeInTheDocument();

    userEvent.click(screen.getByTestId(getTestId('collapsable')));
    expect(toggleFiltersBar).toHaveBeenCalledWith(true);
  });

  it('no edit filter button by disabled permissions', () => {
    renderWrapper(openedBarProps, {
      ...stateWithoutNativeFilters,
      dashboardInfo: { metadata: {} },
    });

    expect(
      screen.queryByTestId(getTestId('create-filter')),
    ).not.toBeInTheDocument();
  });

  it('close filter bar', () => {
    renderWrapper(openedBarProps);
    const collapseButton = screen.getByTestId(getTestId('collapse-button'));

    expect(collapseButton).toBeInTheDocument();
    userEvent.click(collapseButton);

    expect(toggleFiltersBar).toHaveBeenCalledWith(false);
  });

  it('no filters', () => {
    renderWrapper(openedBarProps, stateWithoutNativeFilters);

    expect(screen.getByTestId(getTestId('clear-button'))).toBeDisabled();
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });

  it('renders dividers', async () => {
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

  it('create filter and apply it flow', async () => {
    renderWrapper(openedBarProps, stateWithoutNativeFilters);
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();

    await addFilterFlow();

    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });
});
