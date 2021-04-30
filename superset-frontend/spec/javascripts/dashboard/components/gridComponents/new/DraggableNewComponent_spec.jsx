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
import React from 'react';
import { mount } from 'enzyme';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import DraggableNewComponent from 'src/dashboard/components/gridComponents/new/DraggableNewComponent';
import { NEW_COMPONENTS_SOURCE_ID } from 'src/dashboard/util/constants';
import {
  NEW_COMPONENT_SOURCE_TYPE,
  CHART_TYPE,
} from 'src/dashboard/util/componentTypes';

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
      <DndProvider backend={HTML5Backend}>
        <DraggableNewComponent {...props} {...overrideProps} />
      </DndProvider>,
    );
    return wrapper;
  }

  it('should render a DragDroppable', () => {
    const wrapper = setup();
    expect(wrapper.find(DragDroppable)).toExist();
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
    expect(wrapper.find(className)).toExist();
  });
});
