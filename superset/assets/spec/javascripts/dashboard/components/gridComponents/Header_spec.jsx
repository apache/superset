import React from 'react';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import DeleteComponentButton from '../../../../../src/dashboard/components/DeleteComponentButton';
import EditableTitle from '../../../../../src/components/EditableTitle';
import HoverMenu from '../../../../../src/dashboard/components/menu/HoverMenu';
import WithPopoverMenu from '../../../../../src/dashboard/components/menu/WithPopoverMenu';
import DragDroppable from '../../../../../src/dashboard/components/dnd/DragDroppable';
import Header from '../../../../../src/dashboard/components/gridComponents/Header';
import newComponentFactory from '../../../../../src/dashboard/util/newComponentFactory';
import {
  HEADER_TYPE,
  DASHBOARD_GRID_TYPE,
} from '../../../../../src/dashboard/util/componentTypes';

import WithDragDropContext from '../../helpers/WithDragDropContext';

describe('Header', () => {
  const props = {
    id: 'id',
    parentId: 'parentId',
    component: newComponentFactory(HEADER_TYPE),
    depth: 1,
    parentComponent: newComponentFactory(DASHBOARD_GRID_TYPE),
    index: 0,
    editMode: false,
    handleComponentDrop() {},
    deleteComponent() {},
    updateComponents() {},
  };

  function setup(overrideProps) {
    // We have to wrap provide DragDropContext for the underlying DragDroppable
    // otherwise we cannot assert on DragDroppable children
    const wrapper = mount(
      <WithDragDropContext>
        <Header {...props} {...overrideProps} />
      </WithDragDropContext>,
    );
    return wrapper;
  }

  it('should render a DragDroppable', () => {
    const wrapper = setup();
    expect(wrapper.find(DragDroppable)).to.have.length(1);
  });

  it('should render a WithPopoverMenu', () => {
    const wrapper = setup();
    expect(wrapper.find(WithPopoverMenu)).to.have.length(1);
  });

  it('should render a HoverMenu in editMode', () => {
    let wrapper = setup();
    expect(wrapper.find(HoverMenu)).to.have.length(0);

    // we cannot set props on the Header because of the WithDragDropContext wrapper
    wrapper = setup({ editMode: true });
    expect(wrapper.find(HoverMenu)).to.have.length(1);
  });

  it('should render an EditableTitle with meta.text', () => {
    const wrapper = setup();
    expect(wrapper.find(EditableTitle)).to.have.length(1);
    expect(wrapper.find('input').prop('value')).to.equal(
      props.component.meta.text,
    );
  });

  it('should call updateComponents when EditableTitle changes', () => {
    const updateComponents = sinon.spy();
    const wrapper = setup({ editMode: true, updateComponents });
    wrapper.find(EditableTitle).prop('onSaveTitle')('New title');

    const headerId = props.component.id;
    expect(updateComponents.callCount).to.equal(1);
    expect(updateComponents.getCall(0).args[0][headerId].meta.text).to.equal(
      'New title',
    );
  });

  it('should render a DeleteComponentButton when focused in editMode', () => {
    const wrapper = setup({ editMode: true });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus

    expect(wrapper.find(DeleteComponentButton)).to.have.length(1);
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus
    wrapper.find(DeleteComponentButton).simulate('click');

    expect(deleteComponent.callCount).to.equal(1);
  });
});
