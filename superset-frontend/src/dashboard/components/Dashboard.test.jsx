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
import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';

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

  function setup(overrideProps = {}) {
    const { container } = render(
      <Dashboard {...props} {...overrideProps}>
        <ChildrenComponent />
      </Dashboard>,
    );
    return container;
  }

  // activeFilters map use id_column) as key
  const OVERRIDE_FILTERS = {
    '1_region': { values: [], scope: [1] },
    '2_country_name': { values: ['USA'], scope: [1, 2] },
    '3_region': { values: [], scope: [1] },
    '3_country_name': { values: ['USA'], scope: [] },
  };

  it('should render the children component', () => {
    const container = setup();
    expect(container.querySelector('div')).toHaveTextContent('Test');
  });

  describe('UNSAFE_componentWillReceiveProps', () => {
    const layoutWithExtraChart = {
      ...props.layout,
      1001: newComponentFactory(CHART_TYPE, { chartId: 1001 }),
    };

    it('should call addSliceToDashboard if a new slice is added to the layout', () => {
      const container = setup();
      const addSliceToDashboardMock = jest.spyOn(props.actions, 'addSliceToDashboard');
      container.firstChild.UNSAFE_componentWillReceiveProps({
        ...props,
        layout: layoutWithExtraChart,
      });
      addSliceToDashboardMock.mockRestore();
      expect(addSliceToDashboardMock).toHaveBeenCalledTimes(1);
    });

    it('should call removeSliceFromDashboard if a slice is removed from the layout', () => {
      const container = setup({ layout: layoutWithExtraChart });
      const removeSliceFromDashboardMock = jest.spyOn(props.actions, 'removeSliceFromDashboard');
      const nextLayout = { ...layoutWithExtraChart };
      delete nextLayout[1001];

      container.firstChild.UNSAFE_componentWillReceiveProps({
        ...props,
        layout: nextLayout,
      });
      removeSliceFromDashboardMock.mockRestore();
      expect(removeSliceFromDashboardMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('componentDidUpdate', () => {
    let container;
    let prevProps;
    let refreshSpy;

    beforeEach(() => {
      container = setup({ activeFilters: OVERRIDE_FILTERS });
      container.firstChild.appliedFilters = OVERRIDE_FILTERS;
      prevProps = container.firstChild.props;
      refreshSpy = jest.spyOn(container.firstChild, 'refreshCharts');
    });

    afterEach(() => {
      refreshSpy.restore();
      jest.clearAllMocks();
    });

    it('should not call refresh when is editMode', () => {
      render(<Dashboard {...props} activeFilters={OVERRIDE_FILTERS} dashboardState={{ ...dashboardState, editMode: true }} />);
      container.firstChild.componentDidUpdate(prevProps);
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('should not call refresh when there is no change', () => {
      render(<Dashboard {...props} activeFilters={OVERRIDE_FILTERS} />);
      container.firstChild.componentDidUpdate(prevProps);
      expect(refreshSpy).not.toHaveBeenCalled();
      expect(container.firstChild.appliedFilters).toBe(OVERRIDE_FILTERS);
    });

    it('should call refresh when native filters changed', () => {
      getRelatedCharts.mockReturnValue([230]);
      render(<Dashboard {...props} activeFilters={{
        dashboardState: {
          ...dashboardState,
          editMode: true,
        },
      });
      container.firstChild.componentDidUpdate(prevProps);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });

    it('should not call refresh when there is no change', () => {
      render(<Dashboard {...props} activeFilters={{
        activeFilters: OVERRIDE_FILTERS,
      });
      wrapper.instance().componentDidUpdate(prevProps);
      expect(refreshSpy.callCount).toBe(0);
      expect(container.firstChild.appliedFilters).toEqual({
    });

    it('should call refresh when native filters changed', () => {
      getRelatedCharts.mockReturnValue([230]);
      render(<Dashboard {...props} activeFilters={newFilter} />);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(container.firstChild.appliedFilters).toEqual(newFilter);
    });

    it('should call refresh if a filter is removed', () => {
      getRelatedCharts.mockReturnValue([]);
      render(<Dashboard {...props} activeFilters={{}} />);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(container.firstChild.appliedFilters).toEqual({});
    });

    it('should call refresh if a filter is changed', () => {
      getRelatedCharts.mockReturnValue([1]);
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '1_region': { values: ['Canada'], scope: [1] },
      };
      render(<Dashboard {...props} activeFilters={newFilters} />);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(container.firstChild.appliedFilters).toEqual(newFilters);
      expect(refreshSpy).toHaveBeenCalledWith([1]);
    });

    it('should call refresh with multiple chart ids', () => {
      getRelatedCharts.mockReturnValue([1, 2]);
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '2_country_name': { values: ['New Country'], scope: [1, 2] },
      };
      render(<Dashboard {...props} activeFilters={newFilters} />);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(container.firstChild.appliedFilters).toEqual(newFilters);
      expect(refreshSpy).toHaveBeenCalledWith([1, 2]);
    });

    it('should call refresh if a filter scope is changed', () => {
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['USA'], scope: [2] },
      };

      render(<Dashboard {...props} activeFilters={newFilters} />);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledWith([2]);
    });

    it('should call refresh with empty [] if a filter is changed but scope is not applicable', () => {
      getRelatedCharts.mockReturnValue([]);
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['CHINA'], scope: [] },
      };

      render(<Dashboard {...props} activeFilters={newFilters} />);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(refreshSpy).toHaveBeenCalledWith([]);
    });
  });
});
        activeFilters: {
          ...OVERRIDE_FILTERS,
          ...getAllActiveFilters({
            dataMask: dataMaskWith1Filter,
            nativeFilters: singleNativeFiltersState.filters,
            allSliceIds: [227, 229, 230],
          }),
        },
      });
      wrapper.instance().componentDidUpdate(prevProps);
      expect(refreshSpy).toHaveBeenCalledTimes(1);
      expect(container.firstChild.appliedFilters).toEqual({
        ...OVERRIDE_FILTERS,
        [NATIVE_FILTER_ID]: {
          scope: [230],
          values: extraFormData,
          filterType: 'filter_select',
          targets: [
            {
              datasetId: 13,
              column: {
                name: 'ethnic_minority',
              },
            },
          ],
        },
      });
    });

    it('should call refresh if a filter is added', () => {
      getRelatedCharts.mockReturnValue([1]);
      const newFilter = {
        gender: { values: ['boy', 'girl'], scope: [1] },
      };
      wrapper.setProps({
        activeFilters: newFilter,
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual(newFilter);
    });

    it('should call refresh if a filter is removed', () => {
      getRelatedCharts.mockReturnValue([]);
      wrapper.setProps({
        activeFilters: {},
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({});
    });

    it('should call refresh if a filter is changed', () => {
      getRelatedCharts.mockReturnValue([1]);
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '1_region': { values: ['Canada'], scope: [1] },
      };
      wrapper.setProps({
        activeFilters: newFilters,
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual(newFilters);
      expect(refreshSpy.getCall(0).args[0]).toEqual([1]);
    });

    it('should call refresh with multiple chart ids', () => {
      getRelatedCharts.mockReturnValue([1, 2]);
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '2_country_name': { values: ['New Country'], scope: [1, 2] },
      };
      wrapper.setProps({
        activeFilters: newFilters,
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual(newFilters);
      expect(refreshSpy.getCall(0).args[0]).toEqual([1, 2]);
    });

    it('should call refresh if a filter scope is changed', () => {
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['USA'], scope: [2] },
      };

      wrapper.setProps({
        activeFilters: newFilters,
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(refreshSpy.getCall(0).args[0]).toEqual([2]);
    });

    it('should call refresh with empty [] if a filter is changed but scope is not applicable', () => {
      getRelatedCharts.mockReturnValue([]);
      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['CHINA'], scope: [] },
      };

      wrapper.setProps({
        activeFilters: newFilters,
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(refreshSpy.getCall(0).args[0]).toEqual([]);
    });
  });
});
