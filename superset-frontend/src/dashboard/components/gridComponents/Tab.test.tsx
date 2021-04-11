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

import userEvent from '@testing-library/user-event';
import React from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import EditableTitle from 'src/components/EditableTitle';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';

import Tab from './Tab';

jest.mock('src/dashboard/containers/DashboardComponent', () =>
  jest.fn(() => <div data-test="DashboardComponent" />),
);
jest.mock('src/components/EditableTitle', () =>
  jest.fn(props => (
    <button type="button" data-test="EditableTitle" onClick={props.onSaveTitle}>
      {props.title}
    </button>
  )),
);
jest.mock('src/dashboard/components/dnd/DragDroppable', () =>
  jest.fn(props => {
    const childProps = props.editMode
      ? {
          dragSourceRef: props.dragSourceRef,
          dropIndicatorProps: props.dropIndicatorProps,
        }
      : {};
    return (
      <div>
        <button type="button" data-test="DragDroppable" onClick={props.onDrop}>
          DragDroppable
        </button>
        {props.children(childProps)}
      </div>
    );
  }),
);

const creteProps = () => ({
  id: 'TAB-YT6eNksV-',
  parentId: 'TABS-L-d9eyOE-b',
  depth: 2,
  index: 1,
  renderType: 'RENDER_TAB_CONTENT',
  availableColumnCount: 12,
  columnWidth: 120,
  isFocused: false,
  component: {
    children: ['ROW-DR80aHJA2c', 'ROW--BIzjz9F0'],
    id: 'TAB-YT6eNksV-',
    meta: { text: '🚀 Aspiring Developers' },
    parents: ['ROOT_ID', 'GRID_ID', 'TABS-L-d9eyOE-b'],
    type: 'TAB',
  },
  parentComponent: {
    children: ['TAB-AsMaxdYL_t', 'TAB-YT6eNksV-', 'TAB-l_9I0aNYZ'],
    id: 'TABS-L-d9eyOE-b',
    meta: {},
    parents: ['ROOT_ID', 'GRID_ID'],
    type: 'TABS',
  },
  editMode: false,
  undoLength: 0,
  redoLength: 0,
  filters: {},
  directPathToChild: ['ROOT_ID', 'GRID_ID', 'TABS-L-d9eyOE-b', 'TAB-YT6eNksV-'],
  directPathLastUpdated: 1617374760080,
  dashboardId: 23,
  focusedFilterScope: null,
  isComponentVisible: true,
  onDropOnTab: jest.fn(),
  handleComponentDrop: jest.fn(),
  updateComponents: jest.fn(),
  setDirectPathToChild: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('Render tab (no content)', () => {
  const props = creteProps();
  props.renderType = 'RENDER_TAB';
  render(<Tab {...props} />, { useRedux: true, useDnd: true });
  expect(screen.getByText('🚀 Aspiring Developers')).toBeInTheDocument();
  expect(EditableTitle).toBeCalledTimes(1);
  expect(DragDroppable).toBeCalledTimes(1);
});

test('Render tab (no content) editMode:true', () => {
  const props = creteProps();
  props.editMode = true;
  props.renderType = 'RENDER_TAB';
  render(<Tab {...props} />, { useRedux: true, useDnd: true });
  expect(screen.getByText('🚀 Aspiring Developers')).toBeInTheDocument();
  expect(EditableTitle).toBeCalledTimes(1);
  expect(DragDroppable).toBeCalledTimes(1);
});

test('Edit table title', () => {
  const props = creteProps();
  props.editMode = true;
  props.renderType = 'RENDER_TAB';
  render(<Tab {...props} />, { useRedux: true, useDnd: true });

  expect(EditableTitle).toBeCalledTimes(1);
  expect(DragDroppable).toBeCalledTimes(1);

  expect(props.updateComponents).not.toBeCalled();
  userEvent.click(screen.getByText('🚀 Aspiring Developers'));
  expect(props.updateComponents).toBeCalled();
});

test('Render tab (with content)', () => {
  const props = creteProps();
  props.isFocused = true;
  render(<Tab {...props} />, { useRedux: true, useDnd: true });
  expect(DashboardComponent).toBeCalledTimes(2);
  expect(DashboardComponent).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      availableColumnCount: 12,
      columnWidth: 120,
      depth: 2,
      id: 'ROW-DR80aHJA2c',
      index: 0,
      isComponentVisible: true,
      onChangeTab: expect.any(Function),
      onDrop: expect.any(Function),
      onResize: expect.any(Function),
      onResizeStart: expect.any(Function),
      onResizeStop: expect.any(Function),
      parentId: 'TAB-YT6eNksV-',
    }),
    {},
  );
  expect(DashboardComponent).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      availableColumnCount: 12,
      columnWidth: 120,
      depth: 2,
      id: 'ROW--BIzjz9F0',
      index: 1,
      isComponentVisible: true,
      onChangeTab: expect.any(Function),
      onDrop: expect.any(Function),
      onResize: expect.any(Function),
      onResizeStart: expect.any(Function),
      onResizeStop: expect.any(Function),
      parentId: 'TAB-YT6eNksV-',
    }),
    {},
  );
  expect(DragDroppable).toBeCalledTimes(0);
});

test('Render tab (with content) editMode:true', () => {
  const props = creteProps();
  props.isFocused = true;
  props.editMode = true;
  render(<Tab {...props} />, { useRedux: true, useDnd: true });
  expect(DashboardComponent).toBeCalledTimes(2);
  expect(DashboardComponent).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({
      availableColumnCount: 12,
      columnWidth: 120,
      depth: 2,
      id: 'ROW-DR80aHJA2c',
      index: 0,
      isComponentVisible: true,
      onChangeTab: expect.any(Function),
      onDrop: expect.any(Function),
      onResize: expect.any(Function),
      onResizeStart: expect.any(Function),
      onResizeStop: expect.any(Function),
      parentId: 'TAB-YT6eNksV-',
    }),
    {},
  );
  expect(DashboardComponent).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      availableColumnCount: 12,
      columnWidth: 120,
      depth: 2,
      id: 'ROW--BIzjz9F0',
      index: 1,
      isComponentVisible: true,
      onChangeTab: expect.any(Function),
      onDrop: expect.any(Function),
      onResize: expect.any(Function),
      onResizeStart: expect.any(Function),
      onResizeStop: expect.any(Function),
      parentId: 'TAB-YT6eNksV-',
    }),
    {},
  );
  expect(DragDroppable).toBeCalledTimes(2);
});

test('Should call "handleDrop" and "handleTopDropTargetDrop"', () => {
  const props = creteProps();
  props.isFocused = true;
  props.editMode = true;
  render(<Tab {...props} />, { useRedux: true, useDnd: true });

  expect(props.handleComponentDrop).not.toBeCalled();
  userEvent.click(screen.getAllByRole('button')[0]);
  expect(props.handleComponentDrop).toBeCalledTimes(1);
  expect(props.onDropOnTab).not.toBeCalled();
  userEvent.click(screen.getAllByRole('button')[1]);
  expect(props.onDropOnTab).toBeCalledTimes(1);
  expect(props.handleComponentDrop).toBeCalledTimes(2);
});
