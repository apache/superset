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
import sinon from 'sinon';

import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import Divider from 'src/dashboard/components/gridComponents/Divider';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  DIVIDER_TYPE,
  DASHBOARD_GRID_TYPE,
} from 'src/dashboard/util/componentTypes';

import WithDragDropContext from 'spec/helpers/WithDragDropContext';

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
    expect(wrapper.find(DragDroppable)).toExist();
  });

  it('should render a div with class "dashboard-component-divider"', () => {
    const wrapper = setup();
    expect(wrapper.find('.dashboard-component-divider')).toExist();
  });

  it('should render a HoverMenu with DeleteComponentButton in editMode', () => {
    let wrapper = setup();
    expect(wrapper.find(HoverMenu)).not.toExist();
    expect(wrapper.find(DeleteComponentButton)).not.toExist();

    // we cannot set props on the Divider because of the WithDragDropContext wrapper
    wrapper = setup({ editMode: true });
    expect(wrapper.find(HoverMenu)).toExist();
    expect(wrapper.find(DeleteComponentButton)).toExist();
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find(DeleteComponentButton).simulate('click');
    expect(deleteComponent.callCount).toBe(1);
  });
});
