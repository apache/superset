import React from 'react';
import { mount } from 'enzyme';
import sinon from 'sinon';

import DeleteComponentButton from '../../../../../src/dashboard/components/DeleteComponentButton';
import HoverMenu from '../../../../../src/dashboard/components/menu/HoverMenu';
import DragDroppable from '../../../../../src/dashboard/components/dnd/DragDroppable';
import Divider from '../../../../../src/dashboard/components/gridComponents/Divider';
import newComponentFactory from '../../../../../src/dashboard/util/newComponentFactory';
import {
  DIVIDER_TYPE,
  DASHBOARD_GRID_TYPE,
} from '../../../../../src/dashboard/util/componentTypes';

import WithDragDropContext from '../../helpers/WithDragDropContext';

describe('Divider', () => {
  const props = {
    id: 'id',
    parentId: 'parentId',
    component: newComponentFactory(DIVIDER_TYPE),
    depth: 1,
    parentComponent: newComponentFactory(DASHBOARD_GRID_TYPE),
    index: 0,
    editMode: false,
    handleComponentDrop() {},
    deleteComponent() {},
  };

  function setup(overrideProps) {
    // We have to wrap provide DragDropContext for the underlying DragDroppable
    // otherwise we cannot assert on DragDroppable children
    const wrapper = mount(
      <WithDragDropContext>
        <Divider {...props} {...overrideProps} />
      </WithDragDropContext>,
    );
    return wrapper;
  }

  it('should render a DragDroppable', () => {
    const wrapper = setup();
    expect(wrapper.find(DragDroppable)).toHaveLength(1);
  });

  it('should render a div with class "dashboard-component-divider"', () => {
    const wrapper = setup();
    expect(wrapper.find('.dashboard-component-divider')).toHaveLength(1);
  });

  it('should render a HoverMenu with DeleteComponentButton in editMode', () => {
    let wrapper = setup();
    expect(wrapper.find(HoverMenu)).toHaveLength(0);
    expect(wrapper.find(DeleteComponentButton)).toHaveLength(0);

    // we cannot set props on the Divider because of the WithDragDropContext wrapper
    wrapper = setup({ editMode: true });
    expect(wrapper.find(HoverMenu)).toHaveLength(1);
    expect(wrapper.find(DeleteComponentButton)).toHaveLength(1);
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find(DeleteComponentButton).simulate('click');
    expect(deleteComponent.callCount).toBe(1);
  });
});
