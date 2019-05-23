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

  it('should render a DashboardBuilder', () => {
    const wrapper = setup();
    expect(wrapper.find(DashboardBuilder)).toHaveLength(1);
  });

  describe('refreshExcept', () => {
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

    it('should not call triggerQuery for filter_immune_slices', () => {
      const wrapper = setup({
        charts: overrideCharts,
        dashboardInfo: {
          ...dashboardInfo,
          metadata: {
            ...dashboardInfo.metadata,
            filter_immune_slices: Object.keys(overrideCharts).map(id =>
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
  });

  describe('componentWillReceiveProps', () => {
    const layoutWithExtraChart = {
      ...props.layout,
      1001: newComponentFactory(CHART_TYPE, { chartId: 1001 }),
    };

    it('should call addSliceToDashboard if a new slice is added to the layout', () => {
      const wrapper = setup();
      const spy = sinon.spy(props.actions, 'addSliceToDashboard');
      wrapper.instance().componentWillReceiveProps({
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

      wrapper.instance().componentWillReceiveProps({
        ...props,
        layout: nextLayout,
      });
      spy.restore();
      expect(spy.callCount).toBe(1);
    });
  });

  describe('componentDidUpdate', () => {
    const overrideDashboardState = {
      ...dashboardState,
      filters: {
        1: { region: [] },
        2: { country_name: ['USA'] },
      },
      refresh: true,
    };

    it('should not call refresh when there is no change', () => {
      const wrapper = setup({ dashboardState: overrideDashboardState });
      const refreshExceptSpy = sinon.spy(wrapper.instance(), 'refreshExcept');
      const prevProps = wrapper.instance().props;
      wrapper.setProps({
        dashboardState: {
          ...overrideDashboardState,
        },
      });
      wrapper.instance().componentDidUpdate(prevProps);
      refreshExceptSpy.restore();
      expect(refreshExceptSpy.callCount).toBe(0);
    });

    it('should call refresh if a filter is added', () => {
      const wrapper = setup({ dashboardState: overrideDashboardState });
      const refreshExceptSpy = sinon.spy(wrapper.instance(), 'refreshExcept');
      wrapper.setProps({
        dashboardState: {
          ...overrideDashboardState,
          filters: {
            ...overrideDashboardState.filters,
            3: { another_filter: ['please'] },
          },
        },
      });
      refreshExceptSpy.restore();
      expect(refreshExceptSpy.callCount).toBe(1);
    });

    it('should call refresh if a filter is removed', () => {
      const wrapper = setup({ dashboardState: overrideDashboardState });
      const refreshExceptSpy = sinon.spy(wrapper.instance(), 'refreshExcept');
      wrapper.setProps({
        dashboardState: {
          ...overrideDashboardState,
          filters: {},
        },
      });
      refreshExceptSpy.restore();
      expect(refreshExceptSpy.callCount).toBe(1);
    });

    it('should call refresh if a filter is changed', () => {
      const wrapper = setup({ dashboardState: overrideDashboardState });
      const refreshExceptSpy = sinon.spy(wrapper.instance(), 'refreshExcept');
      wrapper.setProps({
        dashboardState: {
          ...overrideDashboardState,
          filters: {
            ...overrideDashboardState.filters,
            2: { country_name: ['Canada'] },
          },
        },
      });
      refreshExceptSpy.restore();
      expect(refreshExceptSpy.callCount).toBe(1);
    });

    it('should not call refresh if filters change and refresh is false', () => {
      const wrapper = setup({ dashboardState: overrideDashboardState });
      const refreshExceptSpy = sinon.spy(wrapper.instance(), 'refreshExcept');
      wrapper.setProps({
        dashboardState: {
          ...overrideDashboardState,
          filters: {
            ...overrideDashboardState.filters,
            2: { country_name: ['Canada'] },
          },
          refresh: false,
        },
      });
      refreshExceptSpy.restore();
      expect(refreshExceptSpy.callCount).toBe(0);
    });

    it('should not refresh filter_immune_slices', () => {
      const wrapper = setup({
        dashboardState: overrideDashboardState,
        dashboardInfo: {
          ...dashboardInfo,
          metadata: {
            ...dashboardInfo.metadata,
            filter_immune_slices: [chartId],
          },
        },
      });
      const refreshExceptSpy = sinon.spy(wrapper.instance(), 'refreshExcept');
      const prevProps = wrapper.instance().props;
      wrapper.setProps({
        dashboardState: {
          ...overrideDashboardState,
          filters: {
            ...overrideDashboardState.filters,
            2: { country_name: ['Canada'] },
          },
          refresh: false,
        },
      });
      wrapper.instance().componentDidUpdate(prevProps);
      refreshExceptSpy.restore();
      expect(refreshExceptSpy.callCount).toBe(0);
    });
  });
});
