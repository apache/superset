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
import { render, screen } from '@testing-library/react';

import Dashboard from 'src/dashboard/components/Dashboard';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';

// mock data
import chartQueries from 'spec/fixtures/mockChartQueries';
import datasources from 'spec/fixtures/mockDatasource';
import {
  extraFormData,
  NATIVE_FILTER_ID,
  singleNativeFiltersState,
  dataMaskWith1Filter,
} from 'spec/fixtures/mockNativeFilters';
import dashboardInfo from 'spec/fixtures/mockDashboardInfo';
import { dashboardLayout } from 'spec/fixtures/mockDashboardLayout';
import dashboardState from 'spec/fixtures/mockDashboardState';
import { sliceEntitiesForChart as sliceEntities } from 'spec/fixtures/mockSliceEntities';
import { getAllActiveFilters } from 'src/dashboard/util/activeAllDashboardFilters';
import { getRelatedCharts } from 'src/dashboard/util/getRelatedCharts';

jest.mock('src/dashboard/util/getRelatedCharts');

describe('Dashboard', () => {
  const props = {
    actions: {
      addSliceToDashboard() {},
      removeSliceFromDashboard() {},
      triggerQuery() {},
      logEvent() {},
      clearDataMaskState() {},
    },
    dashboardId: 1,
    dashboardState,
    dashboardInfo,
    charts: chartQueries,
    activeFilters: {},
    ownDataCharts: {},
    slices: sliceEntities.slices,
    datasources,
    layout: dashboardLayout.present,
    timeout: 60,
    userId: dashboardInfo.userId,
    impressionId: 'id',
    loadStats: {},
    chartConfiguration: {},
  };

  const ChildrenComponent = () => <div>Test</div>;

  const OVERRIDE_FILTERS = {
    '1_region': { values: [], scope: [1] },
    '2_country_name': { values: ['USA'], scope: [1, 2] },
    '3_region': { values: [], scope: [1] },
    '3_country_name': { values: ['USA'], scope: [] },
  };

  function renderDashboard(override = {}) {
    // Helper to render the Dashboard and return the testing utils
    return render(
      <Dashboard {...props} {...override}>
        <ChildrenComponent />
      </Dashboard>,
    );
  }

  describe('UNSAFE_componentWillReceiveProps (simulated via re-render)', () => {
    const layoutWithExtraChart = {
      ...props.layout,
      1001: newComponentFactory(CHART_TYPE, { chartId: 1001 }),
    };

    it('should call addSliceToDashboard if a new slice is added to the layout', () => {
      const addSliceToDashboardMock = jest.spyOn(
        props.actions,
        'addSliceToDashboard',
      );
      const { rerender } = renderDashboard();
      rerender(
        <Dashboard {...props} layout={layoutWithExtraChart}>
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(addSliceToDashboardMock).toHaveBeenCalledTimes(1);
      addSliceToDashboardMock.mockRestore();
    });

    it('should call removeSliceFromDashboard if a slice is removed from the layout', () => {
      const removeSliceFromDashboardMock = jest.spyOn(
        props.actions,
        'removeSliceFromDashboard',
      );
      // First, render with an extra slice
      const { rerender } = renderDashboard({ layout: layoutWithExtraChart });
      // Then re-render with that slice removed
      const nextLayout = { ...layoutWithExtraChart };
      delete nextLayout[1001];

      rerender(
        <Dashboard {...props} layout={nextLayout}>
          <ChildrenComponent />
        </Dashboard>,
      );

      expect(removeSliceFromDashboardMock).toHaveBeenCalledTimes(1);
      removeSliceFromDashboardMock.mockRestore();
    });
  });

  describe('componentDidUpdate (simulated via re-render)', () => {
    // We'll spy on Dashboard.prototype to ensure refreshCharts gets called
    let refreshSpy;
    beforeEach(() => {
      refreshSpy = jest.spyOn(Dashboard.prototype, 'refreshCharts');
    });
    afterEach(() => {
      refreshSpy.mockRestore();
      jest.clearAllMocks();
    });

    it('should not call refresh when in editMode', () => {
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });
      rerender(
        <Dashboard
          {...props}
          activeFilters={OVERRIDE_FILTERS}
          dashboardState={{ ...dashboardState, editMode: true }}
        >
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('should not call refresh when there is no change in activeFilters', () => {
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });
      // Re-render with the exact same activeFilters
      rerender(
        <Dashboard {...props} activeFilters={OVERRIDE_FILTERS}>
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('should call refresh when native filters changed (example: new filter added)', () => {
      getRelatedCharts.mockReturnValue([230]);
      const filtersWithNative = {
        ...OVERRIDE_FILTERS,
        ...getAllActiveFilters({
          dataMask: dataMaskWith1Filter,
          nativeFilters: singleNativeFiltersState.filters,
          allSliceIds: [227, 229, 230],
        }),
      };
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });
      rerender(
        <Dashboard {...props} activeFilters={filtersWithNative}>
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    it('should call refresh if a filter is added', () => {
      getRelatedCharts.mockReturnValue([1]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });
      const newFilter = {
        gender: { values: ['boy', 'girl'], scope: [1] },
      };
      rerender(
        <Dashboard {...props} activeFilters={newFilter}>
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    it('should call refresh if a filter is removed', () => {
      getRelatedCharts.mockReturnValue([]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });
      rerender(
        <Dashboard {...props} activeFilters={{}}>
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    it('should call refresh if a filter is changed', () => {
      getRelatedCharts.mockReturnValue([1]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });

      const newFilters = {
        ...OVERRIDE_FILTERS,
        '1_region': { values: ['Canada'], scope: [1] },
      };
      rerender(
        <Dashboard {...props} activeFilters={newFilters}>
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledWith([1]);
    });

    it('should call refresh with multiple chart ids', () => {
      getRelatedCharts.mockReturnValue([1, 2]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '2_country_name': { values: ['New Country'], scope: [1, 2] },
      };
      rerender(
        <Dashboard {...props} activeFilters={newFilters}>
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledWith([1, 2]);
    });

    it('should call refresh if a filter scope is changed', () => {
      getRelatedCharts.mockReturnValue([2]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['USA'], scope: [2] },
      };
      rerender(
        <Dashboard {...props} activeFilters={newFilters}>
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledWith([2]);
    });

    it('should call refresh with empty array if a filter is changed but scope is not applicable', () => {
      getRelatedCharts.mockReturnValue([]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['CHINA'], scope: [] },
      };
      rerender(
        <Dashboard {...props} activeFilters={newFilters}>
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledWith([]);
    });

    it('should call refresh when a native filter is added (more comprehensive case)', () => {
      getRelatedCharts.mockReturnValue([230]);
      const initialFilters = {
        ...OVERRIDE_FILTERS,
      };
      const { rerender } = renderDashboard({ activeFilters: initialFilters });
      rerender(
        <Dashboard
          {...props}
          activeFilters={{
            ...OVERRIDE_FILTERS,
            [NATIVE_FILTER_ID]: {
              scope: [230],
              values: extraFormData,
              filterType: 'filter_select',
              targets: [
                {
                  datasetId: 13,
                  column: { name: 'ethnic_minority' },
                },
              ],
            },
          }}
        >
          <ChildrenComponent />
        </Dashboard>,
      );
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });
  });
});
