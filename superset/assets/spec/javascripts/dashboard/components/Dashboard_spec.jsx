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
import sinon from 'sinon';

import Dashboard from '../../../../src/dashboard/components/Dashboard';
import DashboardBuilder from '../../../../src/dashboard/containers/DashboardBuilder';

// mock data
import chartQueries, { sliceId as chartId } from '../fixtures/mockChartQueries';
import datasources from '../../../fixtures/mockDatasource';
import dashboardInfo from '../fixtures/mockDashboardInfo';
import { dashboardLayout } from '../fixtures/mockDashboardLayout';
import dashboardState from '../fixtures/mockDashboardState';
import { sliceEntitiesForChart as sliceEntities } from '../fixtures/mockSliceEntities';

import { CHART_TYPE } from '../../../../src/dashboard/util/componentTypes';
import newComponentFactory from '../../../../src/dashboard/util/newComponentFactory';

describe('Dashboard', () => {
  const props = {
    actions: {
      addSliceToDashboard() {},
      removeSliceFromDashboard() {},
      triggerQuery() {},
      logEvent() {},
    },
    initMessages: [],
    dashboardState,
    dashboardInfo,
    charts: chartQueries,
    filters: {},
    slices: sliceEntities.slices,
    datasources,
    layout: dashboardLayout.present,
    timeout: 60,
    userId: dashboardInfo.userId,
    impressionId: 'id',
    loadStats: {},
  };

  function setup(overrideProps) {
    const wrapper = shallow(<Dashboard {...props} {...overrideProps} />);
    return wrapper;
  }

  const OVERRIDE_FILTERS = {
    1: { region: [] },
    2: { country_name: ['USA'] },
    3: { region: [], country_name: ['USA'] },
  };

  it('should render a DashboardBuilder', () => {
    const wrapper = setup();
    expect(wrapper.find(DashboardBuilder)).toHaveLength(1);
  });

  describe('refreshExcept', () => {
    const overrideDashboardInfo = {
      ...dashboardInfo,
      metadata: {
        ...dashboardInfo.metadata,
        filterImmuneSliceFields: { [chartQueries[chartId].id]: ['region'] },
      },
    };

    const overrideCharts = {
      ...chartQueries,
      1001: {
        ...chartQueries[chartId],
        id: 1001,
      },
    };

    const overrideSlices = {
      ...props.slices,
      1001: {
        ...props.slices[chartId],
        slice_id: 1001,
      },
    };

    it('should call triggerQuery for all non-exempt slices', () => {
      const wrapper = setup({ charts: overrideCharts, slices: overrideSlices });
      const spy = sinon.spy(props.actions, 'triggerQuery');
      wrapper.instance().refreshExcept('1001');
      spy.restore();
      expect(spy.callCount).toBe(Object.keys(overrideCharts).length - 1);
    });

    it('should not call triggerQuery for filterImmuneSlices', () => {
      const wrapper = setup({
        charts: overrideCharts,
        dashboardInfo: {
          ...dashboardInfo,
          metadata: {
            ...dashboardInfo.metadata,
            filterImmuneSlices: Object.keys(overrideCharts).map(id =>
              Number(id),
            ),
          },
        },
      });
      const spy = sinon.spy(props.actions, 'triggerQuery');
      wrapper.instance().refreshExcept();
      spy.restore();
      expect(spy.callCount).toBe(0);
    });

    it('should not call triggerQuery for filterImmuneSliceFields', () => {
      const wrapper = setup({
        filters: OVERRIDE_FILTERS,
        dashboardInfo: overrideDashboardInfo,
      });
      const spy = sinon.spy(props.actions, 'triggerQuery');
      wrapper.instance().refreshExcept('1');
      expect(spy.callCount).toBe(0);
      spy.restore();
    });

    it('should call triggerQuery if filter has more filter-able fields', () => {
      const wrapper = setup({
        filters: OVERRIDE_FILTERS,
        dashboardInfo: overrideDashboardInfo,
      });
      const spy = sinon.spy(props.actions, 'triggerQuery');

      // if filter have additional fields besides immune ones,
      // should apply filter.
      wrapper.instance().refreshExcept('3');
      expect(spy.callCount).toBe(1);

      spy.restore();
    });
  });

  describe('componentWillReceiveProps', () => {
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
    let refreshExceptSpy;

    beforeEach(() => {
      wrapper = setup({ filters: OVERRIDE_FILTERS });
      wrapper.instance().appliedFilters = OVERRIDE_FILTERS;
      prevProps = wrapper.instance().props;
      refreshExceptSpy = sinon.spy(wrapper.instance(), 'refreshExcept');
    });

    afterEach(() => {
      refreshExceptSpy.restore();
    });

    it('should not call refresh when is editMode', () => {
      wrapper.setProps({
        dashboardState: {
          ...dashboardState,
          editMode: true,
        },
      });
      wrapper.instance().componentDidUpdate(prevProps);
      expect(refreshExceptSpy.callCount).toBe(0);
    });

    it('should not call refresh when there is no change', () => {
      wrapper.setProps({
        filters: OVERRIDE_FILTERS,
      });
      wrapper.instance().componentDidUpdate(prevProps);
      expect(refreshExceptSpy.callCount).toBe(0);
      expect(wrapper.instance().appliedFilters).toBe(OVERRIDE_FILTERS);
    });

    it('should call refresh if a filter is added', () => {
      const newFilter = {
        gender: ['boy', 'girl'],
      };
      wrapper.setProps({
        filters: {
          ...OVERRIDE_FILTERS,
          ...newFilter,
        },
      });
      expect(refreshExceptSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({
        ...OVERRIDE_FILTERS,
        ...newFilter,
      });
    });

    it('should call refresh if a filter is removed', () => {
      wrapper.setProps({
        filters: {},
      });
      expect(refreshExceptSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({});
    });

    it('should call refresh if a filter is changed', () => {
      wrapper.setProps({
        filters: {
          ...OVERRIDE_FILTERS,
          region: ['Canada'],
        },
      });
      expect(refreshExceptSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({
        ...OVERRIDE_FILTERS,
        region: ['Canada'],
      });
    });
  });
});
