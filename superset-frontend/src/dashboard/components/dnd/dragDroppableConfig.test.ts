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
import { DragSourceMonitor, DropTargetMonitor } from 'react-dnd';
import { CHART_TYPE } from '../../util/componentTypes';
import type {
  DragDroppableComponent,
  DragDroppableProps,
  DropResult,
} from './dragDroppableConfig';

jest.mock('./handleHover', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('./handleDrop', () => ({
  __esModule: true,
  default: jest.fn(),
}));

// imports follow the jest.mock calls to mirror their hoisted order
// eslint-disable-next-line import/first
import { dragConfig, dropConfig } from './dragDroppableConfig';
// eslint-disable-next-line import/first
import mockedHandleHover from './handleHover';
// eslint-disable-next-line import/first
import mockedHandleDrop from './handleDrop';

const { canDrag, beginDrag } = dragConfig[1];
const { canDrop, hover, drop } = dropConfig[1];

function makeProps(
  overrides: Partial<DragDroppableProps> = {},
): DragDroppableProps {
  return {
    component: {
      id: 'chart-1',
      type: CHART_TYPE,
      children: [],
      meta: {},
    },
    index: 0,
    depth: 1,
    disableDragDrop: false,
    ...overrides,
  } as DragDroppableProps;
}

function makeComponent(
  overrides: Partial<DragDroppableComponent> = {},
): DragDroppableComponent {
  return {
    mounted: true,
    props: makeProps(),
    setState: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('canDrag allows dragging when disableDragDrop is false', () => {
  expect(canDrag(makeProps({ disableDragDrop: false }))).toBe(true);
});

test('canDrag forbids dragging when disableDragDrop is true', () => {
  expect(canDrag(makeProps({ disableDragDrop: true }))).toBe(false);
});

test('beginDrag captures the parent id and type when a parent component is present', () => {
  const parentComponent = {
    id: 'row-1',
    type: 'ROW',
    children: [],
    meta: {},
  } as DragDroppableProps['parentComponent'];
  const props = makeProps({ parentComponent, index: 2 });

  expect(beginDrag(props)).toEqual({
    type: CHART_TYPE,
    id: 'chart-1',
    meta: {},
    index: 2,
    parentId: 'row-1',
    parentType: 'ROW',
  });
});

test('beginDrag leaves parent fields undefined when there is no parent component', () => {
  const props = makeProps({ parentComponent: undefined });

  expect(beginDrag(props)).toEqual({
    type: CHART_TYPE,
    id: 'chart-1',
    meta: {},
    index: 0,
    parentId: undefined,
    parentType: undefined,
  });
});

test('canDrop allows dropping when disableDragDrop is false', () => {
  expect(canDrop(makeProps({ disableDragDrop: false }))).toBe(true);
});

test('canDrop forbids dropping when disableDragDrop is true', () => {
  expect(canDrop(makeProps({ disableDragDrop: true }))).toBe(false);
});

test('hover delegates to handleHover when the drop target component is mounted', () => {
  const props = makeProps();
  const monitor = {} as DropTargetMonitor;
  const component = makeComponent({ mounted: true });

  hover(props, monitor, component);

  expect(mockedHandleHover).toHaveBeenCalledWith(props, monitor, component);
});

test('hover does not call handleHover when the drop target component has unmounted', () => {
  const props = makeProps();
  const monitor = {} as DropTargetMonitor;
  const component = makeComponent({ mounted: false });

  hover(props, monitor, component);

  expect(mockedHandleHover).not.toHaveBeenCalled();
});

test('drop delegates to handleDrop when no nested target already produced a result', () => {
  const props = makeProps();
  const component = makeComponent({ mounted: true });
  const expected: DropResult = {
    source: { id: 'a', type: CHART_TYPE, index: 0 },
    dragging: { id: 'b', type: CHART_TYPE, meta: {} },
  };
  (mockedHandleDrop as jest.Mock).mockReturnValueOnce(expected);
  const monitor = {
    getDropResult: jest.fn(() => null),
  } as unknown as DropTargetMonitor;

  const result = drop(props, monitor, component);

  expect(mockedHandleDrop).toHaveBeenCalledWith(props, monitor, component);
  expect(result).toBe(expected);
});

test('drop delegates to handleDrop when a nested result has no destination', () => {
  const props = makeProps();
  const component = makeComponent({ mounted: true });
  const monitor = {
    getDropResult: jest.fn(() => ({
      source: { id: 'a', type: CHART_TYPE, index: 0 },
      dragging: { id: 'b', type: CHART_TYPE, meta: {} },
    })),
  } as unknown as DropTargetMonitor;

  drop(props, monitor, component);

  expect(mockedHandleDrop).toHaveBeenCalledWith(props, monitor, component);
});

test('drop returns undefined and skips handleDrop when a nested target already produced a destination', () => {
  const props = makeProps();
  const component = makeComponent({ mounted: true });
  const monitor = {
    getDropResult: jest.fn(() => ({
      source: { id: 'a', type: CHART_TYPE, index: 0 },
      dragging: { id: 'b', type: CHART_TYPE, meta: {} },
      destination: { id: 'c', type: CHART_TYPE, index: 1 },
    })),
  } as unknown as DropTargetMonitor;

  const result = drop(props, monitor, component);

  expect(result).toBeUndefined();
  expect(mockedHandleDrop).not.toHaveBeenCalled();
});

test('drop returns undefined and skips handleDrop when the component has unmounted', () => {
  const props = makeProps();
  const component = makeComponent({ mounted: false });
  const monitor = {
    getDropResult: jest.fn(() => null),
  } as unknown as DropTargetMonitor;

  const result = drop(props, monitor, component);

  expect(result).toBeUndefined();
  expect(mockedHandleDrop).not.toHaveBeenCalled();
});

test('dragStateToProps reports isDragging and the dragged component identity from the monitor', () => {
  const dragStateToProps = dragConfig[2];
  const connect = {
    dragSource: jest.fn(() => 'drag-source-ref'),
    dragPreview: jest.fn(() => 'drag-preview-ref'),
  };
  const monitor = {
    isDragging: jest.fn(() => true),
    getItem: jest.fn(() => ({ id: 'chart-1', type: CHART_TYPE })),
  } as unknown as DragSourceMonitor;

  const result = dragStateToProps(connect, monitor);

  expect(result).toEqual({
    dragSourceRef: 'drag-source-ref',
    dragPreviewRef: 'drag-preview-ref',
    isDragging: true,
    dragComponentType: CHART_TYPE,
    dragComponentId: 'chart-1',
  });
});

test('dropStateToProps reports isDraggingOver from the monitor', () => {
  const dropStateToProps = dropConfig[2];
  const connect = {
    dropTarget: jest.fn(() => 'drop-target-ref'),
  };
  const monitor = {
    isOver: jest.fn((opts?: { shallow?: boolean }) => !opts?.shallow),
  } as unknown as DropTargetMonitor;

  const result = dropStateToProps(connect, monitor);

  expect(result).toEqual({
    droppableRef: 'drop-target-ref',
    isDraggingOver: true,
    isDraggingOverShallow: false,
  });
});

test('dragStateToProps reports no dragged component while nothing is being dragged', () => {
  const dragStateToProps = dragConfig[2];
  const connect = {
    dragSource: jest.fn(() => 'drag-source-ref'),
    dragPreview: jest.fn(() => 'drag-preview-ref'),
  };
  const monitor = {
    isDragging: jest.fn(() => false),
    getItem: jest.fn(() => null),
  } as unknown as DragSourceMonitor;

  const result = dragStateToProps(connect, monitor);

  expect(result).toMatchObject({
    isDragging: false,
    dragComponentType: undefined,
    dragComponentId: undefined,
  });
});
