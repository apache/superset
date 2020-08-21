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

import FilterIndicatorsContainer from 'src/dashboard/components/FilterIndicatorsContainer';
import FilterIndicator from 'src/dashboard/components/FilterIndicator';
import * as colorMap from 'src/dashboard/util/dashboardFiltersColorMap';
import { buildActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import { getDashboardFilterKey } from 'src/dashboard/util/getDashboardFilterKey';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { dashboardFilters } from '../fixtures/mockDashboardFilters';
import { sliceId as chartId } from '../fixtures/mockChartQueries';
import { filterId, column } from '../fixtures/mockSliceEntities';
import { dashboardWithFilter } from '../fixtures/mockDashboardLayout';

describe('FilterIndicatorsContainer', () => {
  const mockedProps = {
    dashboardFilters,
    chartId,
    chartStatus: 'success',
    setDirectPathToChild: () => {},
    filterFieldOnFocus: {},
  };

  colorMap.getFilterColorMap = jest.fn(() => ({
    [getDashboardFilterKey({ chartId, column })]: 'badge-1',
  }));

  buildActiveFilters({
    dashboardFilters,
    components: dashboardWithFilter,
  });

  function setup(overrideProps) {
    return shallow(
      <FilterIndicatorsContainer {...mockedProps} {...overrideProps} />,
    );
  }

  it('should not show indicator when chart is loading', () => {
    const wrapper = setup({ chartStatus: 'loading' });
    expect(wrapper.find(FilterIndicator)).not.toExist();
  });

  it('should not show indicator for filter_box itself', () => {
    const wrapper = setup({ chartId: filterId });
    expect(wrapper.find(FilterIndicator)).not.toExist();
  });

  it('should show indicator', () => {
    const wrapper = setup();
    expect(wrapper.find(FilterIndicator)).toExist();
  });

  it('should not show indicator when chart is immune', () => {
    const overwriteDashboardFilters = {
      ...dashboardFilters,
      [filterId]: {
        ...dashboardFilters[filterId],
        scopes: {
          region: {
            scope: [DASHBOARD_ROOT_ID],
            immune: [chartId],
          },
        },
      },
    };
    const wrapper = setup({ dashboardFilters: overwriteDashboardFilters });
    expect(wrapper.find(FilterIndicator)).not.toExist();
  });

  it('should show single number type value', () => {
    const overwriteDashboardFilters = {
      ...dashboardFilters,
      [filterId]: {
        ...dashboardFilters[filterId],
        columns: {
          testField: 0,
        },
      },
    };
    const wrapper = setup({ dashboardFilters: overwriteDashboardFilters });
    expect(wrapper.find(FilterIndicator)).toExist();

    const indicatorProps = wrapper.find(FilterIndicator).first().props()
      .indicator;
    expect(indicatorProps.label).toEqual('testField');
    expect(indicatorProps.values).toEqual([0]);
  });
});
