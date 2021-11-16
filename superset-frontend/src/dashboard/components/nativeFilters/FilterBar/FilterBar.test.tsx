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

import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import * as mockCore from '@superset-ui/core';
import { testWithId } from 'src/utils/testUtils';
import { FeatureFlag } from 'src/featureFlags';
import { Preset } from '@superset-ui/core';
import { TimeFilterPlugin, SelectFilterPlugin } from 'src/filters/components';
import { DATE_FILTER_CONTROL_TEST_ID } from 'src/explore/components/controls/DateFilterControl/DateFilterLabel';
import fetchMock from 'fetch-mock';
import { waitFor } from '@testing-library/react';
import FilterBar, { FILTER_BAR_TEST_ID } from '.';
import { FILTERS_CONFIG_MODAL_TEST_ID } from '../FiltersConfigModal/FiltersConfigModal';

jest.useFakeTimers();
// @ts-ignore
mockCore.makeApi = jest.fn();

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
const getDateControlTestId = testWithId<string>(
  DATE_FILTER_CONTROL_TEST_ID,
  true,
);

const FILTER_NAME = 'Time filter 1';
const FILTER_SET_NAME = 'New filter set';

const addFilterFlow = async () => {
  // open filter config modal
  userEvent.click(screen.getByTestId(getTestId('collapsable')));
  userEvent.click(screen.getByTestId(getTestId('create-filter')));
  // select filter
  userEvent.click(screen.getByText('Value'));
  userEvent.click(screen.getByText('Time range'));
  userEvent.type(screen.getByTestId(getModalTestId('name-input')), FILTER_NAME);
  userEvent.click(screen.getByText('Save'));
  await screen.findByText('All Filters (1)');
};

const addFilterSetFlow = async () => {
  // add filter set
  userEvent.click(screen.getByText('Filter Sets (0)'));

  // check description
  expect(screen.getByText('Filters (1)')).toBeInTheDocument();
  expect(screen.getByText(FILTER_NAME)).toBeInTheDocument();

  expect(screen.getAllByText('No filter').length).toBe(1);

  // apply filters
  expect(screen.getByTestId(getTestId('new-filter-set-button'))).toBeEnabled();

  // create filter set
  userEvent.click(screen.getByText('Create new filter set'));
  userEvent.click(screen.getByText('Create'));

  // check filter set created
  expect(await screen.findByRole('img', { name: 'check' })).toBeInTheDocument();
  expect(screen.getByTestId(getTestId('filter-set-wrapper'))).toHaveAttribute(
    'data-selected',
    'true',
  );
};

const changeFilterValue = async () => {
  userEvent.click(screen.getAllByText('No filter')[0]);
  userEvent.click(screen.getByDisplayValue('Last day'));
  expect(await screen.findByText(/2021-04-13/)).toBeInTheDocument();
  userEvent.click(screen.getByTestId(getDateControlTestId('apply-button')));
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
            "filter_sets_configuration":[{
              "name":"${FILTER_SET_NAME}",
              "id":"${json.filter_sets_configuration?.[0].id}",
              "nativeFilters":{
                "${filterId}":{
                  "id":"${filterId}",
                  "name":"${FILTER_NAME}",
                  "filterType":"filter_time",
                  "targets":[{}],
                  "defaultDataMask":{"filterState":{},"extraFormData":{}},
                  "controlValues":{},
                  "cascadeParentIds":[],
                  "scope":{"rootPath":["ROOT_ID"],"excluded":[]}
                }
              },
              "dataMask":{
                "${filterId}":{
                  "extraFormData":{},
                  "filterState":{},
                  "ownState":{},
                  "id":"${filterId}"
                }
              }
            }]
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

    // @ts-ignore
    mockCore.makeApi = jest.fn(() => mockApi);
  });

  const renderWrapper = (props = closedBarProps, state?: object) =>
    render(<FilterBar {...props} width={280} height={400} offset={0} />, {
      initialState: state,
      useDnd: true,
      useRedux: true,
      useRouter: true,
    });

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

  it('should render the "Apply" option', () => {
    renderWrapper();
    expect(screen.getByText('Apply')).toBeInTheDocument();
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

  it('create filter and apply it flow', async () => {
    // @ts-ignore
    global.featureFlags = {
      [FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET]: true,
      [FeatureFlag.DASHBOARD_NATIVE_FILTERS]: true,
    };
    renderWrapper(openedBarProps, stateWithoutNativeFilters);
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();

    await addFilterFlow();

    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });

  // disable due to filter sets not detecting changes in metadata properly
  it.skip('add and apply filter set', async () => {
    // @ts-ignore
    global.featureFlags = {
      [FeatureFlag.DASHBOARD_NATIVE_FILTERS]: true,
      [FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET]: true,
    };
    renderWrapper(openedBarProps, stateWithoutNativeFilters);

    await addFilterFlow();

    userEvent.click(screen.getByTestId(getTestId('apply-button')));

    await addFilterSetFlow();

    // change filter
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
    userEvent.click(await screen.findByText('All Filters (1)'));
    await changeFilterValue();
    await waitFor(() => expect(screen.getAllByText('Last day').length).toBe(2));

    // apply new filter value
    userEvent.click(screen.getByTestId(getTestId('apply-button')));
    await waitFor(() =>
      expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled(),
    );

    // applying filter set
    userEvent.click(screen.getByText('Filter Sets (1)'));
    expect(
      await screen.findByText('Create new filter set'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(getTestId('filter-set-wrapper')),
    ).not.toHaveAttribute('data-selected', 'true');
    userEvent.click(screen.getByTestId(getTestId('filter-set-wrapper')));
    userEvent.click(screen.getAllByText('Filters (1)')[1]);
    expect(await screen.findByText('No filter')).toBeInTheDocument();
    userEvent.click(screen.getByTestId(getTestId('apply-button')));
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });

  // disable due to filter sets not detecting changes in metadata properly
  it.skip('add and edit filter set', async () => {
    // @ts-ignore
    global.featureFlags = {
      [FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET]: true,
      [FeatureFlag.DASHBOARD_NATIVE_FILTERS]: true,
    };
    renderWrapper(openedBarProps, stateWithoutNativeFilters);

    await addFilterFlow();

    userEvent.click(screen.getByTestId(getTestId('apply-button')));

    await addFilterSetFlow();

    userEvent.click(screen.getByTestId(getTestId('filter-set-menu-button')));
    userEvent.click(screen.getByText('Edit'));

    await changeFilterValue();

    // apply new changes and save them
    await waitFor(() =>
      expect(
        screen.getByTestId(getTestId('filter-set-edit-save')),
      ).toBeDisabled(),
    );
    expect(screen.getByTestId(getTestId('apply-button'))).toBeEnabled();
    userEvent.click(screen.getByTestId(getTestId('apply-button')));
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();

    expect(screen.getByTestId(getTestId('filter-set-edit-save'))).toBeEnabled();
    userEvent.click(screen.getByTestId(getTestId('filter-set-edit-save')));
    expect(screen.queryByText('Save')).not.toBeInTheDocument();

    expect(
      Object.values(
        JSON.parse(mockApi.mock.calls[2][0].json_metadata)
          .filter_sets_configuration[0].dataMask as object,
      )[0]?.filterState?.value,
    ).toBe('Last day');
  });
});
