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
import { shallow } from 'enzyme';
import { supersetTheme } from '@superset-ui/core';
import { Provider } from 'react-redux';
import { Store } from 'redux';
import * as SupersetUI from '@superset-ui/core';
import { styledMount as mount } from 'spec/helpers/theming';
import {
  CHART_RENDERING_SUCCEEDED,
  CHART_UPDATE_SUCCEEDED,
} from 'src/chart/chartAction';
import { buildActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { FiltersBadge } from 'src/dashboard/components/FiltersBadge';
import {
  getMockStoreWithFilters,
  getMockStoreWithNativeFilters,
} from 'spec/fixtures/mockStore';
import { sliceId } from 'spec/fixtures/mockChartQueries';
import { dashboardFilters } from 'spec/fixtures/mockDashboardFilters';
import { dashboardWithFilter } from 'spec/fixtures/mockDashboardLayout';
import Icons from 'src/components/Icons';
import { FeatureFlag } from 'src/featureFlags';

const defaultStore = getMockStoreWithFilters();
function setup(store: Store = defaultStore) {
  return mount(
    <Provider store={store}>
      <FiltersBadge chartId={sliceId} />
    </Provider>,
  );
}

describe('FiltersBadge', () => {
  // there's this bizarre "active filters" thing
  // that doesn't actually use any kind of state management.
  // Have to set variables in there.
  buildActiveFilters({
    dashboardFilters,
    components: dashboardWithFilter,
  });

  beforeEach(() => {
    // shallow rendering in enzyme doesn't propagate contexts correctly,
    // so we have to mock the hook.
    // See https://medium.com/7shifts-engineering-blog/testing-usecontext-react-hook-with-enzyme-shallow-da062140fc83
    jest.spyOn(SupersetUI, 'useTheme').mockImplementation(() => supersetTheme);
  });

  describe('for dashboard filters', () => {
    it("doesn't show number when there are no active filters", () => {
      const store = getMockStoreWithFilters();
      // start with basic dashboard state, dispatch an event to simulate query completion
      store.dispatch({
        type: CHART_UPDATE_SUCCEEDED,
        key: sliceId,
        queriesResponse: [
          {
            status: 'success',
            applied_filters: [],
            rejected_filters: [],
          },
        ],
        dashboardFilters,
      });
      const wrapper = shallow(
        <Provider store={store}>
          <FiltersBadge chartId={sliceId} />,
        </Provider>,
      );
      expect(wrapper.find('[data-test="applied-filter-count"]')).not.toExist();
    });

    it('shows the indicator when filters have been applied', () => {
      const store = getMockStoreWithFilters();
      // start with basic dashboard state, dispatch an event to simulate query completion
      store.dispatch({
        type: CHART_UPDATE_SUCCEEDED,
        key: sliceId,
        queriesResponse: [
          {
            status: 'success',
            applied_filters: [{ column: 'region' }],
            rejected_filters: [],
          },
        ],
        dashboardFilters,
      });
      store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });
      const wrapper = setup(store);
      expect(wrapper.find('DetailsPanelPopover')).toExist();
      expect(wrapper.find('[data-test="applied-filter-count"]')).toHaveText(
        '1',
      );
      expect(wrapper.find('WarningFilled')).not.toExist();
    });

    it("shows a warning when there's a rejected filter", () => {
      const store = getMockStoreWithFilters();
      // start with basic dashboard state, dispatch an event to simulate query completion
      store.dispatch({
        type: CHART_UPDATE_SUCCEEDED,
        key: sliceId,
        queriesResponse: [
          {
            status: 'success',
            applied_filters: [],
            rejected_filters: [
              { column: 'region', reason: 'not_in_datasource' },
            ],
          },
        ],
        dashboardFilters,
      });
      store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });
      const wrapper = setup(store);
      expect(wrapper.find('DetailsPanelPopover')).toExist();
      expect(wrapper.find('[data-test="applied-filter-count"]')).toHaveText(
        '0',
      );
      expect(
        wrapper.find('[data-test="incompatible-filter-count"]'),
      ).toHaveText('1');
      // to look at the shape of the wrapper use:
      expect(wrapper.find(Icons.AlertSolid)).toExist();
    });
  });

  describe('for native filters', () => {
    it("doesn't show number when there are no active filters", () => {
      const store = getMockStoreWithNativeFilters();
      // start with basic dashboard state, dispatch an event to simulate query completion
      store.dispatch({
        type: CHART_UPDATE_SUCCEEDED,
        key: sliceId,
        queriesResponse: [
          {
            status: 'success',
            applied_filters: [],
            rejected_filters: [],
          },
        ],
      });
      store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });
      const wrapper = setup(store);
      expect(wrapper.find('[data-test="applied-filter-count"]')).not.toExist();
    });

    it('shows the indicator when filters have been applied', () => {
      // @ts-ignore
      global.featureFlags = {
        [FeatureFlag.DASHBOARD_NATIVE_FILTERS]: true,
      };
      const store = getMockStoreWithNativeFilters();
      // start with basic dashboard state, dispatch an event to simulate query completion
      store.dispatch({
        type: CHART_UPDATE_SUCCEEDED,
        key: sliceId,
        queriesResponse: [
          {
            status: 'success',
            applied_filters: [{ column: 'region' }],
            rejected_filters: [],
          },
        ],
      });
      store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });
      const wrapper = setup(store);
      expect(wrapper.find('DetailsPanelPopover')).toExist();
      expect(wrapper.find('[data-test="applied-filter-count"]')).toHaveText(
        '1',
      );
      expect(wrapper.find('WarningFilled')).not.toExist();
    });

    it("shows a warning when there's a rejected filter", () => {
      // @ts-ignore
      global.featureFlags = {
        [FeatureFlag.DASHBOARD_NATIVE_FILTERS]: true,
      };
      const store = getMockStoreWithNativeFilters();
      // start with basic dashboard state, dispatch an event to simulate query completion
      store.dispatch({
        type: CHART_UPDATE_SUCCEEDED,
        key: sliceId,
        queriesResponse: [
          {
            status: 'success',
            applied_filters: [],
            rejected_filters: [
              { column: 'region', reason: 'not_in_datasource' },
            ],
          },
        ],
      });
      store.dispatch({ type: CHART_RENDERING_SUCCEEDED, key: sliceId });
      const wrapper = setup(store);
      expect(wrapper.find('DetailsPanelPopover')).toExist();
      expect(wrapper.find('[data-test="applied-filter-count"]')).toHaveText(
        '0',
      );
      expect(
        wrapper.find('[data-test="incompatible-filter-count"]'),
      ).toHaveText('1');
      expect(wrapper.find(Icons.AlertSolid)).toExist();
    });
  });
});
