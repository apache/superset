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
import { shallow, mount } from 'enzyme';
import sinon from 'sinon';

import { ParentSize } from '@vx/responsive';
import { Sticky, StickyContainer } from 'react-sticky';
import { TabContainer, TabContent, TabPane } from 'react-bootstrap';

import BuilderComponentPane from '../../../../src/dashboard/components/BuilderComponentPane';
import DashboardBuilder from '../../../../src/dashboard/components/DashboardBuilder';
import DashboardComponent from '../../../../src/dashboard/containers/DashboardComponent';
import DashboardHeader from '../../../../src/dashboard/containers/DashboardHeader';
import DashboardGrid from '../../../../src/dashboard/containers/DashboardGrid';
import * as dashboardStateActions from '../../../../src/dashboard/actions/dashboardState';
import { BUILDER_PANE_TYPE } from '../../../../src/dashboard/util/constants';

import WithDragDropContext from '../helpers/WithDragDropContext';
import {
  dashboardLayout as undoableDashboardLayout,
  dashboardLayoutWithTabs as undoableDashboardLayoutWithTabs,
} from '../fixtures/mockDashboardLayout';

import { mockStore, mockStoreWithTabs } from '../fixtures/mockStore';

const dashboardLayout = undoableDashboardLayout.present;
const layoutWithTabs = undoableDashboardLayoutWithTabs.present;

describe('DashboardBuilder', () => {
  let favStarStub;

  beforeAll(() => {
    // this is invoked on mount, so we stub it instead of making a request
    favStarStub = sinon
      .stub(dashboardStateActions, 'fetchFaveStar')
      .returns({ type: 'mock-action' });
  });

  afterAll(() => {
    favStarStub.restore();
  });

  const props = {
    dashboardLayout,
    deleteTopLevelTabs() {},
    editMode: false,
    showBuilderPane() {},
    builderPaneType: BUILDER_PANE_TYPE.NONE,
    setColorSchemeAndUnsavedChanges() {},
    colorScheme: undefined,
    handleComponentDrop() {},
    toggleBuilderPane() {},
  };

  function setup(overrideProps, useProvider = false, store = mockStore) {
    const builder = <DashboardBuilder {...props} {...overrideProps} />;
    return useProvider
      ? mount(
          <Provider store={store}>
            <WithDragDropContext>{builder}</WithDragDropContext>
          </Provider>,
        )
      : shallow(builder);
  }

  it('should render a StickyContainer with class "dashboard"', () => {
    const wrapper = setup();
    const stickyContainer = wrapper.find(StickyContainer);
    expect(stickyContainer).toHaveLength(1);
    expect(stickyContainer.prop('className')).toBe('dashboard');
  });

  it('should add the "dashboard--editing" class if editMode=true', () => {
    const wrapper = setup({ editMode: true });
    const stickyContainer = wrapper.find(StickyContainer);
    expect(stickyContainer.prop('className')).toBe(
      'dashboard dashboard--editing',
    );
  });

  it('should render a DragDroppable DashboardHeader', () => {
    const wrapper = setup(null, true);
    expect(wrapper.find(DashboardHeader)).toHaveLength(1);
  });

  it('should render a Sticky top-level Tabs if the dashboard has tabs', () => {
    const wrapper = setup(
      { dashboardLayout: layoutWithTabs },
      true,
      mockStoreWithTabs,
    );
    const sticky = wrapper.find(Sticky);
    const dashboardComponent = sticky.find(DashboardComponent);

    const tabChildren = layoutWithTabs.TABS_ID.children;
    expect(sticky).toHaveLength(1);
    expect(dashboardComponent).toHaveLength(1 + tabChildren.length); // tab + tabs
    expect(dashboardComponent.at(0).prop('id')).toBe('TABS_ID');
    tabChildren.forEach((tabId, i) => {
      expect(dashboardComponent.at(i + 1).prop('id')).toBe(tabId);
    });
  });

  it('should render a TabContainer and TabContent', () => {
    const wrapper = setup({ dashboardLayout: layoutWithTabs });
    const parentSize = wrapper.find(ParentSize).dive();
    expect(parentSize.find(TabContainer)).toHaveLength(1);
    expect(parentSize.find(TabContent)).toHaveLength(1);
  });

  it('should set animation=true, mountOnEnter=true, and unmounOnExit=false on TabContainer for perf', () => {
    const wrapper = setup({ dashboardLayout: layoutWithTabs });
    const tabProps = wrapper
      .find(ParentSize)
      .dive()
      .find(TabContainer)
      .props();
    expect(tabProps.animation).toBe(true);
    expect(tabProps.mountOnEnter).toBe(true);
    expect(tabProps.unmountOnExit).toBe(false);
  });

  it('should render a TabPane and DashboardGrid for each Tab', () => {
    const wrapper = setup({ dashboardLayout: layoutWithTabs });
    const parentSize = wrapper.find(ParentSize).dive();

    const expectedCount = layoutWithTabs.TABS_ID.children.length;
    expect(parentSize.find(TabPane)).toHaveLength(expectedCount);
    expect(parentSize.find(DashboardGrid)).toHaveLength(expectedCount);
  });

  it('should render a BuilderComponentPane if editMode=true and user selects "Insert Components" pane', () => {
    const wrapper = setup();
    expect(wrapper.find(BuilderComponentPane)).toHaveLength(0);

    wrapper.setProps({
      ...props,
      editMode: true,
      builderPaneType: BUILDER_PANE_TYPE.ADD_COMPONENTS,
    });
    expect(wrapper.find(BuilderComponentPane)).toHaveLength(1);
  });

  it('should render a BuilderComponentPane if editMode=true and user selects "Colors" pane', () => {
    const wrapper = setup();
    expect(wrapper.find(BuilderComponentPane)).toHaveLength(0);

    wrapper.setProps({
      ...props,
      editMode: true,
      builderPaneType: BUILDER_PANE_TYPE.COLORS,
    });
    expect(wrapper.find(BuilderComponentPane)).toHaveLength(1);
  });

  it('should change tabs if a top-level Tab is clicked', () => {
    const wrapper = setup(
      { dashboardLayout: layoutWithTabs },
      true,
      mockStoreWithTabs,
    );

    expect(wrapper.find(TabContainer).prop('activeKey')).toBe(0);

    wrapper
      .find('.dashboard-component-tabs .nav-tabs a')
      .at(1)
      .simulate('click');

    expect(wrapper.find(TabContainer).prop('activeKey')).toBe(1);
  });
});
