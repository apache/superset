import { Provider } from 'react-redux';
import React from 'react';
import { shallow, mount } from 'enzyme';
import { expect } from 'chai';

import ParentSize from '@vx/responsive/build/components/ParentSize';
import { Sticky, StickyContainer } from 'react-sticky';
import { TabContainer, TabContent, TabPane } from 'react-bootstrap';

import BuilderComponentPane from '../../../../src/dashboard/components/BuilderComponentPane';
import DashboardBuilder from '../../../../src/dashboard/components/DashboardBuilder';
import DashboardComponent from '../../../../src/dashboard/containers/DashboardComponent';
import DashboardHeader from '../../../../src/dashboard/containers/DashboardHeader';
import DashboardGrid from '../../../../src/dashboard/containers/DashboardGrid';
import WithDragDropContext from '../helpers/WithDragDropContext';
import {
  dashboardLayout as undoableDashboardLayout,
  dashboardLayoutWithTabs as undoableDashboardLayoutWithTabs,
} from '../fixtures/mockDashboardLayout';

import { mockStore, mockStoreWithTabs } from '../fixtures/mockStore';

const dashboardLayout = undoableDashboardLayout.present;
const layoutWithTabs = undoableDashboardLayoutWithTabs.present;

describe('DashboardBuilder', () => {
  const props = {
    dashboardLayout,
    deleteTopLevelTabs() {},
    editMode: false,
    showBuilderPane: false,
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
    expect(stickyContainer).to.have.length(1);
    expect(stickyContainer.prop('className')).to.equal('dashboard');
  });

  it('should add the "dashboard--editing" class if editMode=true', () => {
    const wrapper = setup({ editMode: true });
    const stickyContainer = wrapper.find(StickyContainer);
    expect(stickyContainer.prop('className')).to.equal(
      'dashboard dashboard--editing',
    );
  });

  it('should render a DragDroppable DashboardHeader', () => {
    const wrapper = setup(null, true);
    expect(wrapper.find(DashboardHeader)).to.have.length(1);
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
    expect(sticky).to.have.length(1);
    expect(dashboardComponent).to.have.length(1 + tabChildren.length); // tab + tabs
    expect(dashboardComponent.at(0).prop('id')).to.equal('TABS_ID');
    tabChildren.forEach((tabId, i) => {
      expect(dashboardComponent.at(i + 1).prop('id')).to.equal(tabId);
    });
  });

  it('should render a TabContainer and TabContent', () => {
    const wrapper = setup({ dashboardLayout: layoutWithTabs });
    const parentSize = wrapper.find(ParentSize).dive();
    expect(parentSize.find(TabContainer)).to.have.length(1);
    expect(parentSize.find(TabContent)).to.have.length(1);
  });

  it('should set animation=true, mountOnEnter=true, and unmounOnExit=false on TabContainer for perf', () => {
    const wrapper = setup({ dashboardLayout: layoutWithTabs });
    const tabProps = wrapper
      .find(ParentSize)
      .dive()
      .find(TabContainer)
      .props();
    expect(tabProps.animation).to.equal(true);
    expect(tabProps.mountOnEnter).to.equal(true);
    expect(tabProps.unmountOnExit).to.equal(false);
  });

  it('should render a TabPane and DashboardGrid for each Tab', () => {
    const wrapper = setup({ dashboardLayout: layoutWithTabs });
    const parentSize = wrapper.find(ParentSize).dive();

    const expectedCount = layoutWithTabs.TABS_ID.children.length;
    expect(parentSize.find(TabPane)).to.have.length(expectedCount);
    expect(parentSize.find(DashboardGrid)).to.have.length(expectedCount);
  });

  it('should render a BuilderComponentPane if editMode=showBuilderPane=true', () => {
    const wrapper = setup();
    expect(wrapper.find(BuilderComponentPane)).to.have.length(0);

    wrapper.setProps({ ...props, editMode: true, showBuilderPane: true });
    expect(wrapper.find(BuilderComponentPane)).to.have.length(1);
  });

  it('should change tabs if a top-level Tab is clicked', () => {
    const wrapper = setup(
      { dashboardLayout: layoutWithTabs },
      true,
      mockStoreWithTabs,
    );

    expect(wrapper.find(TabContainer).prop('activeKey')).to.equal(0);

    wrapper
      .find('.dashboard-component-tabs .nav-tabs a')
      .at(1)
      .simulate('click');

    expect(wrapper.find(TabContainer).prop('activeKey')).to.equal(1);
  });
});
