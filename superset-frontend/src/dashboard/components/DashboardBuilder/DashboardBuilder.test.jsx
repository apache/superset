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
import { Provider } from 'react-redux';
import React from 'react';
import { mount } from 'enzyme';
import sinon from 'sinon';
import fetchMock from 'fetch-mock';
import { ParentSize } from '@vx/responsive';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';
import Tabs from 'src/components/Tabs';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import BuilderComponentPane from 'src/dashboard/components/BuilderComponentPane';
import DashboardBuilder from 'src/dashboard/components/DashboardBuilder/DashboardBuilder';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DashboardHeader from 'src/dashboard/containers/DashboardHeader';
import DashboardGrid from 'src/dashboard/containers/DashboardGrid';
import * as dashboardStateActions from 'src/dashboard/actions/dashboardState';
import {
  dashboardLayout as undoableDashboardLayout,
  dashboardLayoutWithTabs as undoableDashboardLayoutWithTabs,
} from 'spec/fixtures/mockDashboardLayout';
import { mockStoreWithTabs, storeWithState } from 'spec/fixtures/mockStore';
import mockState from 'spec/fixtures/mockState';
import {
  DASHBOARD_ROOT_ID,
  DASHBOARD_GRID_ID,
} from 'src/dashboard/util/constants';

fetchMock.get('glob:*/csstemplateasyncmodelview/api/read', {});

jest.mock('src/dashboard/actions/dashboardState');

describe('DashboardBuilder', () => {
  let favStarStub;
  let activeTabsStub;

  beforeAll(() => {
    // this is invoked on mount, so we stub it instead of making a request
    favStarStub = sinon
      .stub(dashboardStateActions, 'fetchFaveStar')
      .returns({ type: 'mock-action' });
    activeTabsStub = sinon
      .stub(dashboardStateActions, 'setActiveTabs')
      .returns({ type: 'mock-action' });
  });

  afterAll(() => {
    favStarStub.restore();
    activeTabsStub.restore();
  });

  function setup(overrideState = {}, overrideStore) {
    const store =
      overrideStore ??
      storeWithState({
        ...mockState,
        dashboardLayout: undoableDashboardLayout,
        ...overrideState,
      });
    return mount(
      <Provider store={store}>
        <DndProvider backend={HTML5Backend}>
          <DashboardBuilder />
        </DndProvider>
      </Provider>,
      {
        wrappingComponent: ThemeProvider,
        wrappingComponentProps: { theme: supersetTheme },
      },
    );
  }

  it('should render a StickyContainer with class "dashboard"', () => {
    const wrapper = setup();
    const stickyContainer = wrapper.find('[data-test="dashboard-content"]');
    expect(stickyContainer).toHaveLength(1);
    expect(stickyContainer.prop('className')).toBe('dashboard');
  });

  it('should add the "dashboard--editing" class if editMode=true', () => {
    const wrapper = setup({ dashboardState: { editMode: true } });
    const stickyContainer = wrapper.find('[data-test="dashboard-content"]');
    expect(stickyContainer.prop('className')).toBe(
      'dashboard dashboard--editing',
    );
  });

  it('should render a DragDroppable DashboardHeader', () => {
    const wrapper = setup();
    expect(wrapper.find(DashboardHeader)).toExist();
  });

  it('should render a Sticky top-level Tabs if the dashboard has tabs', () => {
    const wrapper = setup(
      { dashboardLayout: undoableDashboardLayoutWithTabs },
      mockStoreWithTabs,
    );

    const sticky = wrapper.find('[data-test="top-level-tabs"]');
    const dashboardComponent = sticky.find(DashboardComponent);

    const tabChildren =
      undoableDashboardLayoutWithTabs.present.TABS_ID.children;
    expect(dashboardComponent).toHaveLength(1 + tabChildren.length); // tab + tabs
    expect(dashboardComponent.at(0).prop('id')).toBe('TABS_ID');
    tabChildren.forEach((tabId, i) => {
      expect(dashboardComponent.at(i + 1).prop('id')).toBe(tabId);
    });
  });

  it('should render one Tabs and two TabPane', () => {
    const wrapper = setup({ dashboardLayout: undoableDashboardLayoutWithTabs });
    const parentSize = wrapper.find(ParentSize);
    expect(parentSize.find(Tabs)).toHaveLength(1);
    expect(parentSize.find(Tabs.TabPane)).toHaveLength(2);
  });

  it('should render a TabPane and DashboardGrid for first Tab', () => {
    const wrapper = setup({ dashboardLayout: undoableDashboardLayoutWithTabs });
    const parentSize = wrapper.find(ParentSize);
    const expectedCount =
      undoableDashboardLayoutWithTabs.present.TABS_ID.children.length;
    expect(parentSize.find(Tabs.TabPane)).toHaveLength(expectedCount);
    expect(
      parentSize.find(Tabs.TabPane).first().find(DashboardGrid),
    ).toHaveLength(1);
  });

  it('should render a TabPane and DashboardGrid for second Tab', () => {
    const wrapper = setup({
      dashboardLayout: undoableDashboardLayoutWithTabs,
      dashboardState: {
        ...mockState,
        directPathToChild: [DASHBOARD_ROOT_ID, 'TABS_ID', 'TAB_ID2'],
      },
    });
    const parentSize = wrapper.find(ParentSize);
    const expectedCount =
      undoableDashboardLayoutWithTabs.present.TABS_ID.children.length;
    expect(parentSize.find(Tabs.TabPane)).toHaveLength(expectedCount);
    expect(
      parentSize.find(Tabs.TabPane).at(1).find(DashboardGrid),
    ).toHaveLength(1);
  });

  it('should render a BuilderComponentPane if editMode=false and user selects "Insert Components" pane', () => {
    const wrapper = setup();
    expect(wrapper.find(BuilderComponentPane)).not.toExist();
  });

  it('should render a BuilderComponentPane if editMode=true and user selects "Insert Components" pane', () => {
    const wrapper = setup({ dashboardState: { editMode: true } });
    expect(wrapper.find(BuilderComponentPane)).toExist();
  });

  it('should change redux state if a top-level Tab is clicked', () => {
    dashboardStateActions.setDirectPathToChild = jest.fn(arg0 => ({
      type: 'type',
      arg0,
    }));
    const wrapper = setup({
      ...mockStoreWithTabs,
      dashboardLayout: undoableDashboardLayoutWithTabs,
    });

    expect(wrapper.find(Tabs).at(1).prop('activeKey')).toBe(DASHBOARD_GRID_ID);

    wrapper
      .find('.dashboard-component-tabs .ant-tabs .ant-tabs-tab')
      .at(1)
      .simulate('click');

    expect(dashboardStateActions.setDirectPathToChild).toHaveBeenCalledWith([
      'ROOT_ID',
      'TABS_ID',
      'TAB_ID2',
    ]);
  });
});
