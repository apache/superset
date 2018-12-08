import { Provider } from 'react-redux';
import React from 'react';
import { mount } from 'enzyme';
import sinon from 'sinon';
import { Tabs as BootstrapTabs, Tab as BootstrapTab } from 'react-bootstrap';

import DashboardComponent from '../../../../../src/dashboard/containers/DashboardComponent';
import DeleteComponentButton from '../../../../../src/dashboard/components/DeleteComponentButton';
import HoverMenu from '../../../../../src/dashboard/components/menu/HoverMenu';
import DragDroppable from '../../../../../src/dashboard/components/dnd/DragDroppable';
import Tabs from '../../../../../src/dashboard/components/gridComponents/Tabs';
import WithDragDropContext from '../../helpers/WithDragDropContext';
import { dashboardLayoutWithTabs } from '../../fixtures/mockDashboardLayout';
import { mockStoreWithTabs } from '../../fixtures/mockStore';
import { DASHBOARD_ROOT_ID } from '../../../../../src/dashboard/util/constants';

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
    expect(wrapper.find(DragDroppable)).toHaveLength(1);
  });

  it('should render BootstrapTabs', () => {
    const wrapper = setup();
    expect(wrapper.find(BootstrapTabs)).toHaveLength(1);
  });

  it('should set animation=true, mountOnEnter=true, and unmounOnExit=false on BootstrapTabs for perf', () => {
    const wrapper = setup();
    const tabProps = wrapper.find(BootstrapTabs).props();
    expect(tabProps.animation).toBe(true);
    expect(tabProps.mountOnEnter).toBe(true);
    expect(tabProps.unmountOnExit).toBe(false);
  });

  it('should render a BootstrapTab for each child', () => {
    const wrapper = setup();
    expect(wrapper.find(BootstrapTab)).toHaveLength(
      props.component.children.length,
    );
  });

  it('should render an extra (+) BootstrapTab in editMode', () => {
    const wrapper = setup({ editMode: true });
    expect(wrapper.find(BootstrapTab)).toHaveLength(
      props.component.children.length + 1,
    );
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
      .find('.dashboard-component-tabs .nav-tabs a')
      .last()
      .simulate('click');

    expect(createComponent.callCount).toBe(1);
  });

  it('should call onChangeTab when a tab is clicked', () => {
    const onChangeTab = sinon.spy();
    const wrapper = setup({ editMode: true, onChangeTab });
    wrapper
      .find('.dashboard-component-tabs .nav-tabs a')
      .at(1) // will not call if it is already selected
      .simulate('click');

    expect(onChangeTab.callCount).toBe(1);
  });

  it('should render a HoverMenu in editMode', () => {
    let wrapper = setup();
    expect(wrapper.find(HoverMenu)).toHaveLength(0);

    wrapper = setup({ editMode: true });
    expect(wrapper.find(HoverMenu)).toHaveLength(1);
  });

  it('should render a DeleteComponentButton in editMode', () => {
    let wrapper = setup();
    expect(wrapper.find(DeleteComponentButton)).toHaveLength(0);

    wrapper = setup({ editMode: true });
    expect(wrapper.find(DeleteComponentButton)).toHaveLength(1);
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find(DeleteComponentButton).simulate('click');

    expect(deleteComponent.callCount).toBe(1);
  });
});
