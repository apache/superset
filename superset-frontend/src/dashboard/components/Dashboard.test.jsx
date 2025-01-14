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
import { shallow } from 'enzyme';
import sinon from 'sinon';

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
    dashboardId: 123,
  };

  const ChildrenComponent = () => <div>Test</div>;

  function setup(overrideProps) {
    const wrapper = shallow(
      <Dashboard {...props} {...overrideProps}>
        <ChildrenComponent />
      </Dashboard>,
    );
    return wrapper;
  }

  // activeFilters map use id_column) as key
  const OVERRIDE_FILTERS = {
    '1_region': { values: [], scope: [1] },
    '2_country_name': { values: ['USA'], scope: [1, 2] },
    '3_region': { values: [], scope: [1] },
    '3_country_name': { values: ['USA'], scope: [] },
  };

  it('should render the children component', () => {
    const wrapper = setup();
    expect(wrapper.find(ChildrenComponent)).toExist();
  });

  describe('UNSAFE_componentWillReceiveProps', () => {
    const layoutWithExtraChart = {
      ...props.layout,
      1001: newComponentFactory(CHART_TYPE, { chartId: 1001 }),
    };

    it('should call addSliceToDashboard if a new slice is added to the layout', () => {
      const wrapper = setup();
      const spy = sinon.spy(props.actions, 'addSliceToDashboard');
      wrapper.instance().UNSAFE_componentWillReceiveProps({
        ...props,
        layout: layoutWithExtraChart,
      });
      spy.restore();
      expect(spy.callCount).toBe(1);
    });

    it('should call removeSliceFromDashboard if a slice is removed from the layout', () => {
      const wrapper = setup({ layout: layoutWithExtraChart });
      const spy = sinon.spy(props.actions, 'removeSliceFromDashboard');
      const nextLayout = { ...layoutWithExtraChart };
      delete nextLayout[1001];

      wrapper.instance().UNSAFE_componentWillReceiveProps({
        ...props,
        layout: nextLayout,
      });
      spy.restore();
      expect(spy.callCount).toBe(1);
    });
  });

  describe('componentDidUpdate', () => {
    let wrapper;
    let prevProps;
    let refreshSpy;

    beforeEach(() => {
      jest.clearAllMocks();
      getRelatedCharts.mockReset();

      // Create a deep copy of OVERRIDE_FILTERS for prevProps
      const initialFilters = JSON.parse(JSON.stringify(OVERRIDE_FILTERS));

      // Setup with required props
      wrapper = setup({
        activeFilters: initialFilters,
        editMode: false, // Ensure not in edit mode
        chartConfiguration: {}, // Ensure chartConfiguration exists
        ownDataCharts: {},
      });
      wrapper.instance().appliedFilters = initialFilters;

      // Set up prevProps with the initial filters
      prevProps = {
        ...wrapper.instance().props,
        activeFilters: initialFilters,
        editMode: false,
        chartConfiguration: {},
        ownDataCharts: {},
      };

      refreshSpy = sinon.spy(wrapper.instance(), 'refreshCharts');
    });

    afterEach(() => {
      refreshSpy.restore();
      jest.clearAllMocks();
    });

    it('should not call refresh when is editMode', () => {
      wrapper.setProps({
        dashboardState: {
          ...dashboardState,
          editMode: true,
        },
      });
      wrapper.instance().componentDidUpdate(prevProps);
      expect(refreshSpy.callCount).toBe(0);
    });

    it('should not call refresh when there is no change', () => {
      const sameFilters = JSON.parse(JSON.stringify(OVERRIDE_FILTERS));
      wrapper.setProps({
        activeFilters: sameFilters,
      });
      wrapper.instance().componentDidUpdate(prevProps);
      expect(refreshSpy.callCount).toBe(0);
      expect(wrapper.instance().appliedFilters).toEqual(sameFilters);
    });

    it('should call refresh when native filters changed', () => {
      getRelatedCharts.mockReturnValue([230]);

      const newFilters = {
        ...OVERRIDE_FILTERS,
        ...getAllActiveFilters({
          dataMask: dataMaskWith1Filter,
          nativeFilters: singleNativeFiltersState.filters,
          allSliceIds: [227, 229, 230],
        }),
      };

      wrapper.setProps({
        ...wrapper.instance().props,
        activeFilters: newFilters,
        editMode: false,
        chartConfiguration: {},
      });

      wrapper.instance().componentDidUpdate(prevProps);

      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({
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

      const newProps = {
        ...wrapper.instance().props,
        activeFilters: newFilter,
      };
      wrapper.setProps(newProps);
      wrapper.instance().componentDidUpdate(prevProps);

      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual(newFilter);
    });

    it('should call refresh if a filter is removed', () => {
      getRelatedCharts.mockReturnValue([]);

      const newProps = {
        ...wrapper.instance().props,
        activeFilters: {},
      };
      wrapper.setProps(newProps);
      wrapper.instance().componentDidUpdate(prevProps);

      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({});
    });

    it('should call refresh if a filter is changed', () => {
      getRelatedCharts.mockReturnValue([1]);

      const newFilters = {
        ...OVERRIDE_FILTERS,
        '1_region': { values: ['Canada'], scope: [1] },
      };

      const newProps = {
        ...wrapper.instance().props,
        activeFilters: newFilters,
      };
      wrapper.setProps(newProps);
      wrapper.instance().componentDidUpdate(prevProps);

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

      const newProps = {
        ...wrapper.instance().props,
        activeFilters: newFilters,
      };
      wrapper.setProps(newProps);
      wrapper.instance().componentDidUpdate(prevProps);

      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual(newFilters);
      expect(refreshSpy.getCall(0).args[0]).toEqual([1, 2]);
    });

    it('should call refresh if a filter scope is changed', () => {
      getRelatedCharts.mockReturnValue([2]);

      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['USA'], scope: [2] },
      };

      const newProps = {
        ...wrapper.instance().props,
        activeFilters: newFilters,
      };
      wrapper.setProps(newProps);
      wrapper.instance().componentDidUpdate(prevProps);

      expect(refreshSpy.callCount).toBe(1);
      expect(refreshSpy.getCall(0).args[0]).toEqual([2]);
    });

    it('should call refresh with empty [] if a filter is changed but scope is not applicable', () => {
      getRelatedCharts.mockReturnValue([]);

      const newFilters = {
        ...OVERRIDE_FILTERS,
        '3_country_name': { values: ['CHINA'], scope: [] },
      };

      const newProps = {
        ...wrapper.instance().props,
        activeFilters: newFilters,
      };
      wrapper.setProps(newProps);
      wrapper.instance().componentDidUpdate(prevProps);

      expect(refreshSpy.callCount).toBe(1);
      expect(refreshSpy.getCall(0).args[0]).toEqual([]);
    });
  });
});
