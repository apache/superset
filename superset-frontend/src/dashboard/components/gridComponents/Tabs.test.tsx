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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import getLeafComponentIdFromPath from 'src/dashboard/util/getLeafComponentIdFromPath';

import Tabs from './Tabs';

jest.mock('src/dashboard/containers/DashboardComponent', () =>
  jest.fn(props => (
    <button
      type="button"
      onClick={() =>
        props.onDropOnTab({ destination: { id: 'TAB-YT6eNksV-' } })
      }
      data-test="DashboardComponent"
    >
      DashboardComponent
    </button>
  )),
);

jest.mock('src/dashboard/components/DeleteComponentButton', () =>
  jest.fn(props => (
    <button
      type="button"
      data-test="DeleteComponentButton"
      onClick={props.onDelete}
    >
      DeleteComponentButton
    </button>
  )),
);
jest.mock('src/dashboard/util/getLeafComponentIdFromPath', () => jest.fn());

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

const createProps = () => ({
  id: 'TABS-L-d9eyOE-b',
  parentId: 'GRID_ID',
  depth: 2,
  index: 0,
  availableColumnCount: 12,
  columnWidth: 120,
  isComponentVisible: true,
  component: {
    children: ['TAB-AsMaxdYL_t', 'TAB-YT6eNksV-', 'TAB-l_9I0aNYZ'],
    id: 'TABS-L-d9eyOE-b',
    meta: {},
    parents: ['ROOT_ID', 'GRID_ID'],
    type: 'TABS',
  },
  parentComponent: {
    children: ['TABS-L-d9eyOE-b'],
    id: 'GRID_ID',
    parents: ['ROOT_ID'],
    type: 'GRID',
  },
  editMode: true,
  undoLength: 0,
  redoLength: 0,
  filters: {},
  directPathToChild: [],
  directPathLastUpdated: 1617395480760,
  dashboardId: 23,
  focusedFilterScope: null,
  renderTabContent: true,
  renderHoverMenu: true,
  logEvent: jest.fn(),
  createComponent: jest.fn(),
  handleComponentDrop: jest.fn(),
  onChangeTab: jest.fn(),
  deleteComponent: jest.fn(),
  updateComponents: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

test('Should render editMode:true', () => {
  const props = createProps();
  render(<Tabs {...props} />, { useRedux: true, useDnd: true });
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(DragDroppable).toBeCalledTimes(1);
  expect(DashboardComponent).toBeCalledTimes(4);
  expect(DeleteComponentButton).toBeCalledTimes(1);
  expect(screen.getAllByRole('button', { name: 'remove' })).toHaveLength(3);
  expect(screen.getAllByRole('button', { name: 'Add tab' })).toHaveLength(2);
});

test('Should render editMode:false', () => {
  const props = createProps();
  props.editMode = false;
  render(<Tabs {...props} />, { useRedux: true, useDnd: true });
  expect(screen.getAllByRole('tab')).toHaveLength(3);
  expect(DragDroppable).toBeCalledTimes(1);
  expect(DashboardComponent).toBeCalledTimes(4);
  expect(DeleteComponentButton).not.toBeCalled();
  expect(
    screen.queryByRole('button', { name: 'remove' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Add tab' }),
  ).not.toBeInTheDocument();
});

test('Update component props', () => {
  const props = createProps();
  (getLeafComponentIdFromPath as jest.Mock).mockResolvedValueOnce('none');
  props.editMode = false;
  const { rerender } = render(<Tabs {...props} />, {
    useRedux: true,
    useDnd: true,
  });
  expect(DeleteComponentButton).not.toBeCalled();

  props.editMode = true;
  rerender(<Tabs {...props} />);
  expect(DeleteComponentButton).toBeCalledTimes(1);
});

test('Clicking on "DeleteComponentButton"', () => {
  const props = createProps();
  render(<Tabs {...props} />, {
    useRedux: true,
    useDnd: true,
  });

  expect(props.deleteComponent).not.toBeCalled();
  userEvent.click(screen.getByTestId('DeleteComponentButton'));
  expect(props.deleteComponent).toBeCalledWith('TABS-L-d9eyOE-b', 'GRID_ID');
});

test('Add new tab', () => {
  const props = createProps();
  render(<Tabs {...props} />, {
    useRedux: true,
    useDnd: true,
  });

  expect(props.createComponent).not.toBeCalled();
  userEvent.click(screen.getAllByRole('button', { name: 'Add tab' })[0]);
  expect(props.createComponent).toBeCalled();
});

test('Removing a tab', async () => {
  const props = createProps();
  render(<Tabs {...props} />, {
    useRedux: true,
    useDnd: true,
  });

  expect(props.deleteComponent).not.toBeCalled();
  expect(screen.queryByText('Delete dashboard tab?')).not.toBeInTheDocument();
  userEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);
  expect(props.deleteComponent).not.toBeCalled();

  expect(await screen.findByText('Delete dashboard tab?')).toBeInTheDocument();

  expect(props.deleteComponent).not.toBeCalled();
  userEvent.click(screen.getByRole('button', { name: 'DELETE' }));
  expect(props.deleteComponent).toBeCalled();
});

test('Switching tabs', () => {
  const props = createProps();
  render(<Tabs {...props} />, {
    useRedux: true,
    useDnd: true,
  });

  expect(props.logEvent).not.toBeCalled();
  expect(props.onChangeTab).not.toBeCalled();
  userEvent.click(screen.getAllByRole('tab')[2]);
  expect(props.logEvent).toBeCalled();
  expect(props.onChangeTab).toBeCalled();
});

test('Call "DashboardComponent.onDropOnTab"', async () => {
  const props = createProps();
  render(<Tabs {...props} />, {
    useRedux: true,
    useDnd: true,
  });

  expect(props.logEvent).not.toBeCalled();
  expect(props.onChangeTab).not.toBeCalled();
  userEvent.click(screen.getAllByText('DashboardComponent')[0]);

  await waitFor(() => {
    expect(props.logEvent).toBeCalled();
    expect(props.onChangeTab).toBeCalled();
  });
});
