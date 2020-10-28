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
import { mount } from 'enzyme';
import sinon from 'sinon';
import { supersetTheme, ThemeProvider } from '@superset-ui/core';

import BackgroundStyleDropdown from 'src/dashboard/components/menu/BackgroundStyleDropdown';
import Column from 'src/dashboard/components/gridComponents/Column';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import HoverMenu from 'src/dashboard/components/menu/HoverMenu';
import IconButton from 'src/dashboard/components/IconButton';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';

import { mockStore } from '../../fixtures/mockStore';
import { dashboardLayout as mockLayout } from '../../fixtures/mockDashboardLayout';
import WithDragDropContext from '../../helpers/WithDragDropContext';

describe('Column', () => {
  const columnWithoutChildren = {
    ...mockLayout.present.COLUMN_ID,
    children: [],
  };
  const props = {
    id: 'COLUMN_ID',
    parentId: 'ROW_ID',
    component: mockLayout.present.COLUMN_ID,
    parentComponent: mockLayout.present.ROW_ID,
    index: 0,
    depth: 2,
    editMode: false,
    availableColumnCount: 12,
    minColumnWidth: 2,
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
          <Column {...props} {...overrideProps} />
        </WithDragDropContext>
      </Provider>,
      {
        wrappingComponent: ThemeProvider,
        wrappingComponentProps: { theme: supersetTheme },
      },
    );
    return wrapper;
  }

  it('should render a DragDroppable', () => {
    // don't count child DragDroppables
    const wrapper = setup({ component: columnWithoutChildren });
    expect(wrapper.find(DragDroppable)).toExist();
  });

  it('should render a WithPopoverMenu', () => {
    // don't count child DragDroppables
    const wrapper = setup({ component: columnWithoutChildren });
    expect(wrapper.find(WithPopoverMenu)).toExist();
  });

  it('should render a ResizableContainer', () => {
    // don't count child DragDroppables
    const wrapper = setup({ component: columnWithoutChildren });
    expect(wrapper.find(ResizableContainer)).toExist();
  });

  it('should render a HoverMenu in editMode', () => {
    let wrapper = setup({ component: columnWithoutChildren });
    expect(wrapper.find(HoverMenu)).not.toExist();

    // we cannot set props on the Row because of the WithDragDropContext wrapper
    wrapper = setup({ component: columnWithoutChildren, editMode: true });
    expect(wrapper.find(HoverMenu)).toExist();
  });

  it('should render a DeleteComponentButton in editMode', () => {
    let wrapper = setup({ component: columnWithoutChildren });
    expect(wrapper.find(DeleteComponentButton)).not.toExist();

    // we cannot set props on the Row because of the WithDragDropContext wrapper
    wrapper = setup({ component: columnWithoutChildren, editMode: true });
    expect(wrapper.find(DeleteComponentButton)).toExist();
  });

  it('should render a BackgroundStyleDropdown when focused', () => {
    let wrapper = setup({ component: columnWithoutChildren });
    expect(wrapper.find(BackgroundStyleDropdown)).not.toExist();

    // we cannot set props on the Row because of the WithDragDropContext wrapper
    wrapper = setup({ component: columnWithoutChildren, editMode: true });
    wrapper
      .find(IconButton)
      .at(1) // first one is delete button
      .simulate('click');

    expect(wrapper.find(BackgroundStyleDropdown)).toExist();
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find(DeleteComponentButton).simulate('click');
    expect(deleteComponent.callCount).toBe(1);
  });

  it('should pass its own width as availableColumnCount to children', () => {
    const wrapper = setup();
    const dashboardComponent = wrapper.find(DashboardComponent).first();
    expect(dashboardComponent.props().availableColumnCount).toBe(
      props.component.meta.width,
    );
  });

  it('should pass appropriate dimensions to ResizableContainer', () => {
    const wrapper = setup({ component: columnWithoutChildren });
    const columnWidth = columnWithoutChildren.meta.width;
    const resizableProps = wrapper.find(ResizableContainer).props();
    expect(resizableProps.adjustableWidth).toBe(true);
    expect(resizableProps.adjustableHeight).toBe(false);
    expect(resizableProps.widthStep).toBe(props.columnWidth);
    expect(resizableProps.widthMultiple).toBe(columnWidth);
    expect(resizableProps.minWidthMultiple).toBe(props.minColumnWidth);
    expect(resizableProps.maxWidthMultiple).toBe(
      props.availableColumnCount + columnWidth,
    );
  });

  it('should increment the depth of its children', () => {
    const wrapper = setup();
    const dashboardComponent = wrapper.find(DashboardComponent);
    expect(dashboardComponent.props().depth).toBe(props.depth + 1);
  });
});
