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
import chartQueries from '../fixtures/mockChartQueries';
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
    activeFilters: {},
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

  // activeFilters map use id_column) as key
  const OVERRIDE_FILTERS = {
    '1_region': [],
    '2_country_name': ['USA'],
    '3_region': [],
    '3_country_name': ['USA'],
  };

  it('should render a DashboardBuilder', () => {
    const wrapper = setup();
    expect(wrapper.find(DashboardBuilder)).toHaveLength(1);
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
    let refreshSpy;

    beforeEach(() => {
      wrapper = setup({ activeFilters: OVERRIDE_FILTERS });
      wrapper.instance().appliedFilters = OVERRIDE_FILTERS;
      prevProps = wrapper.instance().props;
      refreshSpy = sinon.spy(wrapper.instance(), 'refreshCharts');
    });

    afterEach(() => {
      refreshSpy.restore();
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
      wrapper.setProps({
        activeFilters: OVERRIDE_FILTERS,
      });
      wrapper.instance().componentDidUpdate(prevProps);
      expect(refreshSpy.callCount).toBe(0);
      expect(wrapper.instance().appliedFilters).toBe(OVERRIDE_FILTERS);
    });

    it('should call refresh if a filter is added', () => {
      const newFilter = {
        gender: ['boy', 'girl'],
      };
      wrapper.setProps({
        activeFilters: {
          ...OVERRIDE_FILTERS,
          ...newFilter,
        },
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({
        ...OVERRIDE_FILTERS,
        ...newFilter,
      });
    });

    it('should call refresh if a filter is removed', () => {
      wrapper.setProps({
        activeFilters: {},
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({});
    });

    it('should call refresh if a filter is changed', () => {
      wrapper.setProps({
        activeFilters: {
          ...OVERRIDE_FILTERS,
          '1_region': ['Canada'],
        },
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({
        ...OVERRIDE_FILTERS,
        '1_region': ['Canada'],
      });
    });
  });
});
