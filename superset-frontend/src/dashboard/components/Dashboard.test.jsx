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
import { render, screen } from 'spec/helpers/testing-library';
import { PluginContext } from 'src/components';

import Dashboard from 'src/dashboard/components/Dashboard';
import { CHART_TYPE } from 'src/dashboard/util/componentTypes';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';

// mock data
import chartQueries from 'spec/fixtures/mockChartQueries';
import datasources from 'spec/fixtures/mockDatasource';
import {
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

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('Dashboard', () => {
  const mockAddSlice = jest.fn();
  const mockRemoveSlice = jest.fn();
  const mockTriggerQuery = jest.fn();
  const mockLogEvent = jest.fn();
  const mockClearDataMask = jest.fn();
  const mockClearAllChartStates = jest.fn();

  const props = {
    actions: {
      addSliceToDashboard: mockAddSlice,
      removeSliceFromDashboard: mockRemoveSlice,
      triggerQuery: mockTriggerQuery,
      logEvent: mockLogEvent,
      clearDataMaskState: mockClearDataMask,
      clearAllChartStates: mockClearAllChartStates,
    },
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

  const renderDashboard = (overrideProps = {}) =>
    render(
      <PluginContext.Provider value={{ loading: false }}>
        <Dashboard {...props} {...overrideProps}>
          <ChildrenComponent />
        </Dashboard>
      </PluginContext.Provider>,
    );

  const OVERRIDE_FILTERS = {
    '1_region': { values: [], scope: [1] },
    '2_country_name': { values: ['USA'], scope: [1, 2] },
    '3_region': { values: [], scope: [1] },
    '3_country_name': { values: ['USA'], scope: [] },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render the children component', () => {
    renderDashboard();
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('layout changes', () => {
    const layoutWithExtraChart = {
      ...props.layout,
      1001: newComponentFactory(CHART_TYPE, { chartId: 1001 }),
    };

    test('should call addSliceToDashboard if a new slice is added to the layout', () => {
      const { rerender } = renderDashboard();

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard {...props} layout={layoutWithExtraChart}>
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockAddSlice).toHaveBeenCalled();
    });

    test('should call removeSliceFromDashboard if a slice is removed from the layout', () => {
      const { rerender } = renderDashboard({ layout: layoutWithExtraChart });

      const nextLayout = { ...layoutWithExtraChart };
      delete nextLayout[1001];

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard {...props} layout={nextLayout}>
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockRemoveSlice).toHaveBeenCalled();
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('filter updates', () => {
    test('should not call refresh when in editMode', () => {
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard
            {...props}
            activeFilters={OVERRIDE_FILTERS}
            dashboardState={{
              ...dashboardState,
              editMode: true,
            }}
          >
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockTriggerQuery).not.toHaveBeenCalled();
    });

    test('should not call refresh when there is no change', () => {
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard {...props} activeFilters={OVERRIDE_FILTERS}>
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockTriggerQuery).not.toHaveBeenCalled();
    });

    test('should call refresh when native filters changed', () => {
      getRelatedCharts.mockReturnValue([230]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard
            {...props}
            activeFilters={{
              ...OVERRIDE_FILTERS,
              ...getAllActiveFilters({
                dataMask: dataMaskWith1Filter,
                nativeFilters: singleNativeFiltersState.filters,
                allSliceIds: [227, 229, 230],
              }),
            }}
          >
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockTriggerQuery).toHaveBeenCalled();
    });

    test('should call refresh if a filter is added', () => {
      getRelatedCharts.mockReturnValue([1]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });

      const newFilter = {
        gender: { values: ['boy', 'girl'], scope: [1] },
      };

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard {...props} activeFilters={newFilter}>
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockTriggerQuery).toHaveBeenCalled();
    });

    test('should call refresh if a filter is removed', () => {
      getRelatedCharts.mockReturnValue([1]); // Ensure we return some charts to refresh
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard
            {...props}
            activeFilters={{}}
            refreshCharts={mockTriggerQuery} // Add refreshCharts prop
          >
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockTriggerQuery).toHaveBeenCalledWith(true, 1);
    });

    test('should call refresh if a filter is changed', () => {
      getRelatedCharts.mockReturnValue([1]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });

      const newFilters = {
        ...OVERRIDE_FILTERS,
        '1_region': { values: ['Canada'], scope: [1] },
      };

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard {...props} activeFilters={newFilters}>
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockTriggerQuery).toHaveBeenCalled();
    });

    test('should call refresh with multiple chart ids', () => {
      getRelatedCharts.mockReturnValue([1, 2]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });

      const newFilters = {
        ...OVERRIDE_FILTERS,
        '2_country_name': { values: ['New Country'], scope: [1, 2] },
      };

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard {...props} activeFilters={newFilters}>
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockTriggerQuery).toHaveBeenCalled();
    });

    test('should call refresh if a filter scope is changed', () => {
      getRelatedCharts.mockReturnValue([2]);
      const { rerender } = renderDashboard({ activeFilters: OVERRIDE_FILTERS });

      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['USA'], scope: [2] },
      };

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard {...props} activeFilters={newFilters}>
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      expect(mockTriggerQuery).toHaveBeenCalled();
    });

    test('should call refresh with empty [] if a filter is changed but scope is not applicable', () => {
      getRelatedCharts.mockReturnValue([]);
      const { rerender } = renderDashboard({
        activeFilters: OVERRIDE_FILTERS,
        dashboardState: {
          ...dashboardState,
          editMode: false,
        },
      });

      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['CHINA'], scope: [] },
      };

      rerender(
        <PluginContext.Provider value={{ loading: false }}>
          <Dashboard
            {...props}
            activeFilters={newFilters}
            dashboardState={{
              ...dashboardState,
              editMode: false,
            }}
          >
            <ChildrenComponent />
          </Dashboard>
        </PluginContext.Provider>,
      );

      // Since getRelatedCharts returns empty array, no charts should be refreshed
      expect(mockTriggerQuery).not.toHaveBeenCalled();
    });
  });

  test('should NOT call refresh when ownDataCharts content is unchanged', () => {
    // When only clientView changes, getRelevantDataMask strips it,
    // so Dashboard receives identical ownDataCharts and should not refresh
    const initialOwnDataCharts = {
      1: { pageSize: 10, currentPage: 0 },
    };

    const { rerender } = renderDashboard({
      ownDataCharts: initialOwnDataCharts,
      dashboardState: {
        ...dashboardState,
        editMode: false,
      },
    });

    // Rerender with same ownDataCharts (simulates clientView-only change after stripping)
    rerender(
      <PluginContext.Provider value={{ loading: false }}>
        <Dashboard
          {...props}
          ownDataCharts={initialOwnDataCharts}
          dashboardState={{
            ...dashboardState,
            editMode: false,
          }}
        >
          <ChildrenComponent />
        </Dashboard>
      </PluginContext.Provider>,
    );

    expect(mockTriggerQuery).not.toHaveBeenCalled();
  });

  test('should call refresh when ownDataCharts pageSize changes', () => {
    const initialOwnDataCharts = {
      1: { pageSize: 10, currentPage: 0 },
    };

    const { rerender } = renderDashboard({
      ownDataCharts: initialOwnDataCharts,
      dashboardState: {
        ...dashboardState,
        editMode: false,
      },
    });

    const updatedOwnDataCharts = {
      1: { pageSize: 20, currentPage: 0 },
    };

    rerender(
      <PluginContext.Provider value={{ loading: false }}>
        <Dashboard
          {...props}
          ownDataCharts={updatedOwnDataCharts}
          dashboardState={{
            ...dashboardState,
            editMode: false,
          }}
        >
          <ChildrenComponent />
        </Dashboard>
      </PluginContext.Provider>,
    );

    expect(mockTriggerQuery).toHaveBeenCalledWith(true, '1');
  });
});
