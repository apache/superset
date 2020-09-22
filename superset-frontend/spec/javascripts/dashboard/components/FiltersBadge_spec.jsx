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
import * as SupersetUI from '@superset-ui/core';
import { CHART_UPDATE_SUCCEEDED } from 'src/chart/chartAction';
import { buildActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import FiltersBadge from 'src/dashboard/components/FiltersBadge';
import { getMockStoreWithFilters } from '../fixtures/mockStore';
import { sliceId } from '../fixtures/mockChartQueries';
import { dashboardFilters } from '../fixtures/mockDashboardFilters';
import { dashboardWithFilter } from '../fixtures/mockDashboardLayout';

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
    jest.spyOn(SupersetUI, 'useTheme').mockImplementation(() => supersetTheme);
  });

  it("Doesn't appear when there are no indicators to show", () => {
    const store = getMockStoreWithFilters();
    // start with basic dashboard state, dispatch an event to simulate query completion
    store.dispatch({
      type: CHART_UPDATE_SUCCEEDED,
      key: sliceId,
      queryResponse: {
        status: 'success',
        applied_filters: [],
        rejected_filters: [],
      },
      dashboardFilters,
    });
    const wrapper = shallow(<FiltersBadge store={store} chartId={sliceId} />);
    expect(wrapper.dive().type()).toEqual(null);
  });

  it('shows the indicator when filters have been applied', () => {
    const store = getMockStoreWithFilters();
    // start with basic dashboard state, dispatch an event to simulate query completion
    store.dispatch({
      type: CHART_UPDATE_SUCCEEDED,
      key: sliceId,
      queryResponse: {
        status: 'success',
        applied_filters: [{ column: 'region' }],
        rejected_filters: [],
      },
      dashboardFilters,
    });
    const wrapper = shallow(<FiltersBadge store={store} chartId={sliceId} />);
    expect(wrapper.dive().find('Popover')).toExist();
    expect(wrapper.dive().find('.indicator-count')).toHaveText('1');
    expect(wrapper.dive().find('WarningFilled')).not.toExist();
  });

  it("shows a warning when there's a rejected filter", () => {
    const store = getMockStoreWithFilters();
    // start with basic dashboard state, dispatch an event to simulate query completion
    store.dispatch({
      type: CHART_UPDATE_SUCCEEDED,
      key: sliceId,
      queryResponse: {
        status: 'success',
        applied_filters: [],
        rejected_filters: [{ column: 'region', reason: 'not_in_datasource' }],
      },
      dashboardFilters,
    });
    const wrapper = shallow(<FiltersBadge store={store} chartId={sliceId} />);
    expect(wrapper.dive().find('Popover')).toExist();
    expect(wrapper.dive().find('.indicator-count')).toHaveText('1');
    // antd components are often wrapped in ForwardRef which means we can't
    // just select "WarningFilled", we have to include the ForwardRef.
    // to look at the shape of the wrapper use:
    // console.log(wrapper.debug())
    expect(wrapper.dive().find('ForwardRef(WarningFilled)')).toExist();
  });
});
