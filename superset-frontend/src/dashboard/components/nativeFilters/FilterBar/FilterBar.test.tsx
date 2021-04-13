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
import { render, screen, cleanup } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import userEvent from '@testing-library/user-event';
import FilterBar, {
  FILTER_BAR_TEST_ID,
} from 'src/dashboard/components/nativeFilters/FilterBar/FilterBar';
import { getMockStore, mockStore } from 'spec/fixtures/mockStore';
import * as mockCore from '@superset-ui/core';
import { testWithId } from 'src/utils/common';
import { FeatureFlag } from 'src/featureFlags';
import { Preset } from '@superset-ui/core';
import { TimeFilterPlugin, SelectFilterPlugin } from 'src/filters/components';
import { FILTERS_CONFIG_MODAL_TEST_ID } from '../FiltersConfigModal/FiltersConfigModal';

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

describe('FilterBar', () => {
  const getTestId = testWithId(FILTER_BAR_TEST_ID, true);
  const getModalTestId = testWithId(FILTERS_CONFIG_MODAL_TEST_ID, true);
  const toggleFiltersBar = jest.fn();
  const closedBarProps = {
    filtersOpen: false,
    toggleFiltersBar,
  };
  const openedBarProps = {
    filtersOpen: true,
    toggleFiltersBar,
  };
  const noFiltersState = {
    dashboardInfo: {
      dash_edit_perm: true,
      metadata: {
        native_filter_configuration: [],
      },
    },
    dataMask: { nativeFilters: {} },
    nativeFilters: { filters: {}, filterSets: {} },
  };

  const FILTER_NAME = 'Time filter 1';
  const FILTER_SET_NAME = 'New filter set';

  const addFilterFlow = () => {
    // open filter config modal
    userEvent.click(screen.getByTestId(getTestId('collapsable')));
    userEvent.click(screen.getByTestId(getTestId('create-filter')));
    // select filter
    userEvent.click(screen.getByText('Select filter'));
    userEvent.click(screen.getByText('Time filter'));
    userEvent.type(
      screen.getByTestId(getModalTestId('name-input')),
      FILTER_NAME,
    );
    userEvent.click(screen.getByText('Save'));
  };

  new MainPreset().register();
  beforeEach(() => {
    // @ts-ignore
    mockCore.makeApi = jest.fn(() => async data => {
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
              "defaultValue":null,
              "cascadeParentIds":[],
              "scope":{"rootPath":["ROOT_ID"],"excluded":[]},
              "isInstant":false
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
                  "defaultValue":"Last week",
                  "cascadeParentIds":[],
                  "scope":{"rootPath":["ROOT_ID"],"excluded":[]},
                  "isInstant":false
                }
              },
              "dataMask":{
                "nativeFilters":{
                  "${filterId}":{
                    "extraFormData":{"override_form_data":{"time_range":"Last week"}},
                    "currentState":{"value":"Last week"},
                    "id":"${filterId}"
                  }
                }
              }
            }]
          }`,
        },
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  const renderWrapper = (props = closedBarProps, state?: object) =>
    render(
      <Provider store={state ? getMockStore(state) : mockStore}>
        <FilterBar {...props} />
      </Provider>,
    );

  it('is a valid', () => {
    expect(React.isValidElement(<FilterBar {...closedBarProps} />)).toBe(true);
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
      ...noFiltersState,
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
    renderWrapper(openedBarProps, noFiltersState);

    expect(screen.getByTestId(getTestId('clear-button'))).toBeDisabled();
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });

  it('create filter and apply it flow', async () => {
    // @ts-ignore
    global.featureFlags = {
      [FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET]: true,
    };
    renderWrapper(openedBarProps, noFiltersState);
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();

    addFilterFlow();

    await screen.findByText('All Filters (1)');

    // apply filter
    expect(screen.getByTestId(getTestId('apply-button'))).toBeEnabled();
    userEvent.click(screen.getByTestId(getTestId('apply-button')));
    expect(screen.getByTestId(getTestId('apply-button'))).toBeDisabled();
  });

  it('add filter set', async () => {
    // @ts-ignore
    global.featureFlags = {
      [FeatureFlag.DASHBOARD_NATIVE_FILTERS_SET]: true,
    };
    renderWrapper(openedBarProps, noFiltersState);

    addFilterFlow();

    await screen.findByText('All Filters (1)');
    expect(screen.getByTestId(getTestId('apply-button'))).toBeEnabled();

    // add filter set
    userEvent.click(screen.getByText('Filter Sets (0)'));
    expect(
      screen.getByTestId(getTestId('new-filter-set-button')),
    ).toBeDisabled();

    // check description
    expect(screen.getByText('Filters (1)')).toBeInTheDocument();
    expect(screen.getByText(FILTER_NAME)).toBeInTheDocument();
    expect(screen.getAllByText('Last week').length).toBe(2);

    // apply filters
    userEvent.click(screen.getByTestId(getTestId('apply-button')));
    expect(
      screen.getByTestId(getTestId('new-filter-set-button')),
    ).toBeEnabled();

    // create filter set
    userEvent.click(screen.getByText('Create new filter set'));
    userEvent.click(screen.getByText('Create'));

    // check filter set created
    expect(
      await screen.findByRole('img', { name: 'check' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId(getTestId('filter-set-wrapper'))).toHaveAttribute(
      'data-selected',
      'true',
    );
  });
});
