import { Provider } from 'react-redux';
import React from 'react';
import { mount } from 'enzyme';
import { expect } from 'chai';
import sinon from 'sinon';

import BackgroundStyleDropdown from '../../../../../src/dashboard/components/menu/BackgroundStyleDropdown';
import DashboardComponent from '../../../../../src/dashboard/containers/DashboardComponent';
import DeleteComponentButton from '../../../../../src/dashboard/components/DeleteComponentButton';
import DragDroppable from '../../../../../src/dashboard/components/dnd/DragDroppable';
import HoverMenu from '../../../../../src/dashboard/components/menu/HoverMenu';
import IconButton from '../../../../../src/dashboard/components/IconButton';
import Row from '../../../../../src/dashboard/components/gridComponents/Row';
import WithPopoverMenu from '../../../../../src/dashboard/components/menu/WithPopoverMenu';

import { mockStore } from '../../fixtures/mockStore';
import { DASHBOARD_GRID_ID } from '../../../../../src/dashboard/util/constants';
import { dashboardLayout as mockLayout } from '../../fixtures/mockDashboardLayout';
import WithDragDropContext from '../../helpers/WithDragDropContext';

describe('Row', () => {
  const rowWithoutChildren = { ...mockLayout.present.ROW_ID, children: [] };
  const props = {
    id: 'ROW_ID',
    parentId: DASHBOARD_GRID_ID,
    component: mockLayout.present.ROW_ID,
    parentComponent: mockLayout.present[DASHBOARD_GRID_ID],
    index: 0,
    depth: 2,
    editMode: false,
    availableColumnCount: 12,
    columnWidth: 50,
    occupiedColumnCount: 6,
    onResizeStart() {},
    onResize() {},
    onResizeStop() {},
    handleComponentDrop() {},
    deleteComponent() {},
    updateComponents() {},
  };

  function setup(overrideProps) {
    // We have to wrap provide DragDropContext for the underlying DragDroppable
    // otherwise we cannot assert on DragDroppable children
    const wrapper = mount(
      <Provider store={mockStore}>
        <WithDragDropContext>
          <Row {...props} {...overrideProps} />
        </WithDragDropContext>
      </Provider>,
    );
    return wrapper;
  }

  it('should render a DragDroppable', () => {
    // don't count child DragDroppables
    const wrapper = setup({ component: rowWithoutChildren });
    expect(wrapper.find(DragDroppable)).to.have.length(1);
  });

  it('should render a WithPopoverMenu', () => {
    // don't count child DragDroppables
    const wrapper = setup({ component: rowWithoutChildren });
    expect(wrapper.find(WithPopoverMenu)).to.have.length(1);
  });

  it('should render a HoverMenu in editMode', () => {
    let wrapper = setup({ component: rowWithoutChildren });
    expect(wrapper.find(HoverMenu)).to.have.length(0);

    // we cannot set props on the Row because of the WithDragDropContext wrapper
    wrapper = setup({ component: rowWithoutChildren, editMode: true });
    expect(wrapper.find(HoverMenu)).to.have.length(1);
  });

  it('should render a DeleteComponentButton in editMode', () => {
    let wrapper = setup({ component: rowWithoutChildren });
    expect(wrapper.find(DeleteComponentButton)).to.have.length(0);

    // we cannot set props on the Row because of the WithDragDropContext wrapper
    wrapper = setup({ component: rowWithoutChildren, editMode: true });
    expect(wrapper.find(DeleteComponentButton)).to.have.length(1);
  });

  it('should render a BackgroundStyleDropdown when focused', () => {
    let wrapper = setup({ component: rowWithoutChildren });
    expect(wrapper.find(BackgroundStyleDropdown)).to.have.length(0);

    // we cannot set props on the Row because of the WithDragDropContext wrapper
    wrapper = setup({ component: rowWithoutChildren, editMode: true });
    wrapper
      .find(IconButton)
      .at(1) // first one is delete button
      .simulate('click');

    expect(wrapper.find(BackgroundStyleDropdown)).to.have.length(1);
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find(DeleteComponentButton).simulate('click');
    expect(deleteComponent.callCount).to.equal(1);
  });

  it('should pass appropriate availableColumnCount to children', () => {
    const wrapper = setup();
    const dashboardComponent = wrapper.find(DashboardComponent).first();
    expect(dashboardComponent.props().availableColumnCount).to.equal(
      props.availableColumnCount - props.occupiedColumnCount,
    );
  });

  it('should increment the depth of its children', () => {
    const wrapper = setup();
    const dashboardComponent = wrapper.find(DashboardComponent).first();
    expect(dashboardComponent.props().depth).to.equal(props.depth + 1);
  });
});
