import React from 'react';
import { mount } from 'enzyme';

import DragDroppable from '../../../../../../src/dashboard/components/dnd/DragDroppable';
import DraggableNewComponent from '../../../../../../src/dashboard/components/gridComponents/new/DraggableNewComponent';
import WithDragDropContext from '../../../helpers/WithDragDropContext';

import { NEW_COMPONENTS_SOURCE_ID } from '../../../../../../src/dashboard/util/constants';
import {
  NEW_COMPONENT_SOURCE_TYPE,
  CHART_TYPE,
} from '../../../../../../src/dashboard/util/componentTypes';

describe('DraggableNewComponent', () => {
  const props = {
    id: 'id',
    type: CHART_TYPE,
    label: 'label!',
    className: 'a_class',
  };

  function setup(overrideProps) {
    // We have to wrap provide DragDropContext for the underlying DragDroppable
    // otherwise we cannot assert on DragDroppable children
    const wrapper = mount(
      <WithDragDropContext>
        <DraggableNewComponent {...props} {...overrideProps} />
      </WithDragDropContext>,
    );
    return wrapper;
  }

  it('should render a DragDroppable', () => {
    const wrapper = setup();
    expect(wrapper.find(DragDroppable)).toHaveLength(1);
  });

  it('should pass component={ type, id } to DragDroppable', () => {
    const wrapper = setup();
    const dragdroppable = wrapper.find(DragDroppable);
    expect(dragdroppable.prop('component')).toEqual({
      id: props.id,
      type: props.type,
    });
  });

  it('should pass appropriate parent source and id to DragDroppable', () => {
    const wrapper = setup();
    const dragdroppable = wrapper.find(DragDroppable);
    expect(dragdroppable.prop('parentComponent')).toEqual({
      id: NEW_COMPONENTS_SOURCE_ID,
      type: NEW_COMPONENT_SOURCE_TYPE,
    });
  });

  it('should render the passed label', () => {
    const wrapper = setup();
    expect(wrapper.find('.new-component').text()).toBe(props.label);
  });

  it('should add the passed className', () => {
    const wrapper = setup();
    const className = `.new-component-placeholder.${props.className}`;
    expect(wrapper.find(className)).toHaveLength(1);
  });
});
