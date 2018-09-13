import React from 'react';
import { shallow, mount } from 'enzyme';
import { expect } from 'chai';
import sinon from 'sinon';

import newComponentFactory from '../../../../../src/dashboard/util/newComponentFactory';
import {
  CHART_TYPE,
  ROW_TYPE,
} from '../../../../../src/dashboard/util/componentTypes';
import { UnwrappedDragDroppable as DragDroppable } from '../../../../../src/dashboard/components/dnd/DragDroppable';

describe('DragDroppable', () => {
  const props = {
    component: newComponentFactory(CHART_TYPE),
    parentComponent: newComponentFactory(ROW_TYPE),
    editMode: false,
    depth: 1,
    index: 0,
    isDragging: false,
    isDraggingOver: false,
    isDraggingOverShallow: false,
    droppableRef() {},
    dragSourceRef() {},
    dragPreviewRef() {},
  };

  function setup(overrideProps, shouldMount = false) {
    const method = shouldMount ? mount : shallow;
    const wrapper = method(<DragDroppable {...props} {...overrideProps} />);
    return wrapper;
  }

  it('should render a div with class dragdroppable', () => {
    const wrapper = setup();
    expect(wrapper.find('.dragdroppable')).to.have.length(1);
  });

  it('should add class dragdroppable--dragging when dragging', () => {
    const wrapper = setup({ isDragging: true });
    expect(wrapper.find('.dragdroppable')).to.have.length(1);
  });

  it('should call its child function', () => {
    const childrenSpy = sinon.spy();
    setup({ children: childrenSpy });
    expect(childrenSpy.callCount).to.equal(1);
  });

  it('should call its child function with "dragSourceRef" if editMode=true', () => {
    const children = sinon.spy();
    const dragSourceRef = () => {};
    setup({ children, editMode: false, dragSourceRef });
    setup({ children, editMode: true, dragSourceRef });

    expect(children.getCall(0).args[0].dragSourceRef).to.equal(undefined);
    expect(children.getCall(1).args[0].dragSourceRef).to.equal(dragSourceRef);
  });

  it('should call its child function with "dropIndicatorProps" dependent on editMode, isDraggingOver, state.dropIndicator is set', () => {
    const children = sinon.spy();
    const wrapper = setup({ children, editMode: false, isDraggingOver: false });
    wrapper.setState({ dropIndicator: 'nonsense' });
    wrapper.setProps({ ...props, editMode: true, isDraggingOver: true });

    expect(children.callCount).to.equal(3); // initial + setState + setProps
    expect(children.getCall(0).args[0].dropIndicatorProps).to.equal(undefined);
    expect(children.getCall(2).args[0].dropIndicatorProps).to.deep.equal({
      className: 'drop-indicator',
    });
  });

  it('should call props.dragPreviewRef and props.droppableRef on mount', () => {
    const dragPreviewRef = sinon.spy();
    const droppableRef = sinon.spy();

    setup({ dragPreviewRef, droppableRef }, true);
    expect(dragPreviewRef.callCount).to.equal(1);
    expect(droppableRef.callCount).to.equal(1);
  });

  it('should set this.mounted dependent on life cycle', () => {
    const wrapper = setup({}, true);
    const instance = wrapper.instance();
    expect(instance.mounted).to.equal(true);
    wrapper.unmount();
    expect(instance.mounted).to.equal(false);
  });
});
