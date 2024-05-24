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
import 'jest-canvas-mock';

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
import { Logger, LOG_ACTIONS_HIDE_BROWSER_TAB } from '../../logger/LogUtils';

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

    it('should call refresh when native filters changed', () => {
      wrapper.setProps({
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
      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({
        ...OVERRIDE_FILTERS,
        [NATIVE_FILTER_ID]: {
          scope: [230],
          values: extraFormData,
        },
      });
    });

    it('should call refresh if a filter is added', () => {
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
      wrapper.setProps({
        activeFilters: {},
      });
      expect(refreshSpy.callCount).toBe(1);
      expect(wrapper.instance().appliedFilters).toEqual({});
    });

    it('should call refresh if a filter is changed', () => {
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

    // The canvas is cleared using the clearRect method.
    it('should clear the canvas using clearRect method', () => {
      // Arrange
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const imageBitmap = new ImageBitmap(100, 100);

      // Act
      wrapper.instance().repaintCanvas(canvas, ctx, imageBitmap);

      // Assert
      expect(ctx.clearRect).toHaveBeenCalledWith(
        0,
        0,
        canvas.width,
        canvas.height,
      );
    });

    // The canvas width and height are 0.
    it('should recreate the canvas with the same dimensions', () => {
      // Arrange
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const imageBitmap = new ImageBitmap(100, 100);

      // Act
      wrapper.instance().repaintCanvas(canvas, ctx, imageBitmap);

      // Assert
      const { width, height } = ctx.canvas;
      expect(canvas.width).toBe(width);
      expect(canvas.height).toBe(height);
    });

    // When the document visibility state changes to 'hidden', the method sets the 'visibilityEventData' object with a 'start_offset' and 'ts' properties, and queries all canvas elements on the page and stores them in the 'canvases' property.
    it('should set visibilityEventData and canvases when document visibility state changes to "hidden"', () => {
      // Initialize the class object with props
      const props = {
        activeFilters: {},
        ownDataCharts: {},
        actions: {
          logEvent: jest.fn(),
        },
        layout: {},
        dashboardInfo: {},
        dashboardState: {
          editMode: false,
          isPublished: false,
          hasUnsavedChanges: false,
        },
        chartConfiguration: {},
      };

      const DATE_TO_USE = new Date('2020');
      const OrigDate = Date;
      global.Date = jest.fn(() => DATE_TO_USE);
      global.Date.UTC = OrigDate.UTC;
      global.Date.parse = OrigDate.parse;
      global.Date.now = OrigDate.now;

      // Your test code here

      const dashboard = new Dashboard(props);

      // Mock the return value of document.visibilityState
      jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      // mock Logger.getTimestamp() to return a fixed value
      jest.spyOn(Logger, 'getTimestamp').mockReturnValue(1234567890);

      // Invoke the method
      dashboard.onVisibilityChange();

      // Assert that visibilityEventData is set correctly
      expect(dashboard.visibilityEventData).toEqual({
        start_offset: 1234567890,
        ts: DATE_TO_USE.getTime(),
      });

      // Assert that canvases are queried correctly
      expect(dashboard.canvases).toEqual(expect.any(NodeList));

      // Restore the original implementation of document.visibilityState
      jest.restoreAllMocks();
      // After your test
      global.Date = OrigDate;
    });

    // When the document visibility state changes to 'visible', the method logs an event and calls the 'handleVisibilityChange' method.
    it('should log an event and call handleVisibilityChange when document visibility state changes to "visible"', () => {
      // Initialize the class object
      const dashboard = new Dashboard({ activeFilters: {} });

      // Mock the props and actions
      dashboard.props = {
        actions: {
          logEvent: jest.fn(),
        },
      };

      // Mock the visibilityEventData
      dashboard.visibilityEventData = {
        start_offset: 123,
        ts: 456,
      };

      // Mock the handleVisibilityChange method
      dashboard.handleVisibilityChange = jest.fn();

      // Mock the document.visibilityState property
      jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

      // Invoke the method
      dashboard.onVisibilityChange();

      // Assert that logEvent is called with the correct arguments
      expect(dashboard.props.actions.logEvent).toHaveBeenCalledWith(
        LOG_ACTIONS_HIDE_BROWSER_TAB,
        {
          ...dashboard.visibilityEventData,
          duration: expect.any(Number),
        },
      );

      // Assert that handleVisibilityChange is called
      expect(dashboard.handleVisibilityChange).toHaveBeenCalled();

      // Restore the original implementation of document.visibilityState
      jest.restoreAllMocks();
    });
  });
});
