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
import { shallow } from 'enzyme';
import sinon from 'sinon';
import { LineEditableTabs } from 'src/common/components/Tabs';
import { Modal } from 'src/common/components';

import { styledMount as mount } from 'spec/helpers/theming';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import Tabs from 'src/dashboard/components/gridComponents/Tabs';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import WithDragDropContext from 'spec/helpers/WithDragDropContext';
import { dashboardLayoutWithTabs } from 'spec/fixtures/mockDashboardLayout';
import { mockStoreWithTabs } from 'spec/fixtures/mockStore';

describe('Tabs', () => {
  const props = {
    id: 'TABS_ID',
    parentId: DASHBOARD_ROOT_ID,
    component: dashboardLayoutWithTabs.present.TABS_ID,
    parentComponent: dashboardLayoutWithTabs.present[DASHBOARD_ROOT_ID],
    index: 0,
    depth: 1,
    renderTabContent: true,
    editMode: false,
    availableColumnCount: 12,
    columnWidth: 50,
    onResizeStart() {},
    onResize() {},
    onResizeStop() {},
    createComponent() {},
    handleComponentDrop() {},
    onChangeTab() {},
    deleteComponent() {},
    updateComponents() {},
    logEvent() {},
  };

  function setup(overrideProps) {
    // We have to wrap provide DragDropContext for the underlying DragDroppable
    // otherwise we cannot assert on DragDroppable children
    const wrapper = mount(
      <Provider store={mockStoreWithTabs}>
        <WithDragDropContext>
          <Tabs {...props} {...overrideProps} />
        </WithDragDropContext>
      </Provider>,
    );
    return wrapper;
  }

  it('should render a DragDroppable', () => {
    // test just Tabs with no children DragDroppables
    const wrapper = setup({ component: { ...props.component, children: [] } });
    expect(wrapper.find(DragDroppable)).toExist();
  });

  it('should render non-editable tabs', () => {
    const wrapper = setup();
    expect(wrapper.find(LineEditableTabs)).toExist();
    expect(wrapper.find('.ant-tabs-nav-add').exists()).toBeFalsy();
  });

  it('should render a tab pane for each child', () => {
    const wrapper = setup();
    expect(wrapper.find(LineEditableTabs.TabPane)).toHaveLength(
      props.component.children.length,
    );
  });

  it('should render editable tabs in editMode', () => {
    const wrapper = setup({ editMode: true });
    expect(wrapper.find(LineEditableTabs)).toExist();
    expect(wrapper.find('.ant-tabs-nav-add')).toExist();
  });

  it('should render a DashboardComponent for each child', () => {
    // note: this does not test Tab content
    const wrapper = setup({ renderTabContent: false });
    expect(wrapper.find(DashboardComponent)).toHaveLength(
      props.component.children.length,
    );
  });

  it('should call createComponent if the (+) tab is clicked', () => {
    const createComponent = sinon.spy();
    const wrapper = setup({ editMode: true, createComponent });
    wrapper
      .find('[data-test="dashboard-component-tabs"] .ant-tabs-nav-add')
      .last()
      .simulate('click');

    expect(createComponent.callCount).toBe(1);
  });

  it('should call onChangeTab when a tab is clicked', () => {
    const onChangeTab = sinon.spy();
    const wrapper = setup({ editMode: true, onChangeTab });
    wrapper
      .find('[data-test="dashboard-component-tabs"] .ant-tabs-tab')
      .at(1) // will not call if it is already selected
      .simulate('click');

    expect(onChangeTab.callCount).toBe(1);
  });

  it('should not call onChangeTab when anchor link is clicked', () => {
    const onChangeTab = sinon.spy();
    const wrapper = setup({ editMode: true, onChangeTab });
    wrapper
      .find(
        '[data-test="dashboard-component-tabs"] .ant-tabs-tab [data-test="short-link-button"]',
      )
      .at(1) // will not call if it is already selected
      .simulate('click');

    expect(onChangeTab.callCount).toBe(0);
  });

  it('should render a HoverMenu in editMode', () => {
    let wrapper = setup();
    expect(wrapper.find(HoverMenu)).not.toExist();

    wrapper = setup({ editMode: true });
    expect(wrapper.find(HoverMenu)).toExist();
  });

  it('should render a DeleteComponentButton in editMode', () => {
    let wrapper = setup();
    expect(wrapper.find(DeleteComponentButton)).not.toExist();

    wrapper = setup({ editMode: true });
    expect(wrapper.find(DeleteComponentButton)).toExist();
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find(DeleteComponentButton).simulate('click');

    expect(deleteComponent.callCount).toBe(1);
  });

  it('should direct display direct-link tab', () => {
    let wrapper = shallow(<Tabs {...props} />);
    // default show first tab child
    expect(wrapper.state('tabIndex')).toBe(0);

    // display child in directPathToChild list
    const directPathToChild = dashboardLayoutWithTabs.present.ROW_ID2.parents.slice();
    const directLinkProps = {
      ...props,
      directPathToChild,
    };

    wrapper = shallow(<Tabs {...directLinkProps} />);
    expect(wrapper.state('tabIndex')).toBe(1);
  });

  it('should render Modal when clicked remove tab button', () => {
    const deleteComponent = sinon.spy();
    const modalMock = jest.spyOn(Modal, 'confirm');
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find('.ant-tabs-tab-remove').at(0).simulate('click');
    expect(modalMock.mock.calls).toHaveLength(1);
    expect(deleteComponent.callCount).toBe(0);
  });
});
