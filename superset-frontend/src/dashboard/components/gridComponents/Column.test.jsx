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
import { fireEvent, render } from 'spec/helpers/testing-library';

import BackgroundStyleDropdown from 'src/dashboard/components/menu/BackgroundStyleDropdown';
import Column from 'src/dashboard/components/gridComponents/Column';
import IconButton from 'src/dashboard/components/IconButton';

import { getMockStore } from 'spec/fixtures/mockStore';
import { dashboardLayout as mockLayout } from 'spec/fixtures/mockDashboardLayout';
import { initialState } from 'src/SqlLab/fixtures';

jest.mock('src/dashboard/components/dnd/DragDroppable', () => ({
  Draggable: ({ children }) => (
    <div data-test="mock-draggable">{children({})}</div>
  ),
  Droppable: ({ children, depth }) => (
    <div data-test="mock-droppable" depth={depth}>
      {children({})}
    </div>
  ),
}));
jest.mock(
  'src/dashboard/containers/DashboardComponent',
  () =>
    ({ availableColumnCount, depth }) => (
      <div data-test="mock-dashboard-component" depth={depth}>
        {availableColumnCount}
      </div>
    ),
);
jest.mock(
  'src/dashboard/components/menu/WithPopoverMenu',
  () =>
    ({ children }) => <div data-test="mock-with-popover-menu">{children}</div>,
);
jest.mock(
  'src/dashboard/components/DeleteComponentButton',
  () =>
    ({ onDelete }) => (
      <button
        type="button"
        data-test="mock-delete-component-button"
        onClick={onDelete}
      >
        Delete
      </button>
    ),
);

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
  const mockStore = getMockStore({
    ...initialState,
  });
  return render(<Column {...props} {...overrideProps} />, {
    store: mockStore,
    useDnd: true,
    useRouter: true,
  });
}

test('should render a Draggable', () => {
  const { getByTestId, queryByTestId } = setup({
    component: columnWithoutChildren,
  });
  expect(getByTestId('mock-draggable')).toBeInTheDocument();
  expect(queryByTestId('mock-droppable')).not.toBeInTheDocument();
});

test('should skip rendering HoverMenu and DeleteComponentButton when not in editMode', () => {
  const { container, queryByTestId } = setup({
    component: columnWithoutChildren,
  });
  expect(container.querySelector('.hover-menu')).not.toBeInTheDocument();
  expect(queryByTestId('mock-delete-component-button')).not.toBeInTheDocument();
});

test('should render a WithPopoverMenu', () => {
  // don't count child DragDroppables
  const { getByTestId } = setup({ component: columnWithoutChildren });
  expect(getByTestId('mock-with-popover-menu')).toBeInTheDocument();
});

test('should render a ResizableContainer', () => {
  // don't count child DragDroppables
  const { container } = setup({ component: columnWithoutChildren });
  expect(container.querySelector('.resizable-container')).toBeInTheDocument();
});

test('should render a HoverMenu in editMode', () => {
  // we cannot set props on the Row because of the WithDragDropContext wrapper
  const { container, getAllByTestId, getByTestId } = setup({
    component: columnWithoutChildren,
    editMode: true,
  });
  expect(container.querySelector('.hover-menu')).toBeInTheDocument();

  // Droppable area enabled in editMode
  expect(getAllByTestId('mock-droppable').length).toBe(1);

  // pass the same depth of its droppable area
  expect(getByTestId('mock-droppable')).toHaveAttribute(
    'depth',
    `${props.depth}`,
  );
});

test('should render a DeleteComponentButton in editMode', () => {
  // we cannot set props on the Row because of the WithDragDropContext wrapper
  const { getByTestId } = setup({
    component: columnWithoutChildren,
    editMode: true,
  });
  expect(getByTestId('mock-delete-component-button')).toBeInTheDocument();
});

test.skip('should render a BackgroundStyleDropdown when focused', () => {
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

test('should call deleteComponent when deleted', () => {
  const deleteComponent = jest.fn();
  const { getByTestId } = setup({ editMode: true, deleteComponent });
  fireEvent.click(getByTestId('mock-delete-component-button'));
  expect(deleteComponent).toHaveBeenCalledTimes(1);
});

test('should pass its own width as availableColumnCount to children', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-dashboard-component')).toHaveTextContent(
    props.component.meta.width,
  );
});

test.skip('should pass appropriate dimensions to ResizableContainer', () => {
  const { container } = setup({ component: columnWithoutChildren });
  const columnWidth = columnWithoutChildren.meta.width;

  expect(container.querySelector('.resizable-container')).toEqual({
    columnWidth,
  });
  // const resizableProps = wrapper.find(ResizableContainer).props();
  // expect(resizableProps.adjustableWidth).toBe(true);
  // expect(resizableProps.adjustableHeight).toBe(false);
  // expect(resizableProps.widthStep).toBe(props.columnWidth);
  // expect(resizableProps.widthMultiple).toBe(columnWidth);
  // expect(resizableProps.minWidthMultiple).toBe(props.minColumnWidth);
  // expect(resizableProps.maxWidthMultiple).toBe(
  //   props.availableColumnCount + columnWidth,
  // );
});

test('should increment the depth of its children', () => {
  const { getByTestId } = setup();
  expect(getByTestId('mock-dashboard-component')).toHaveAttribute(
    'depth',
    `${props.depth + 1}`,
  );
});
