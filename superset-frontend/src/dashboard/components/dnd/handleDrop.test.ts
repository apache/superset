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
import { DropTargetMonitor } from 'react-dnd';
import handleDrop from './handleDrop';
import getDropPosition, {
  clearDropCache,
  DROP_FORBIDDEN,
  DROP_TOP,
} from '../../util/getDropPosition';
import { CHART_TYPE, MARKDOWN_TYPE, ROW_TYPE } from '../../util/componentTypes';
import type { DragDroppableComponent, DragItem } from './dragDroppableConfig';
import type { LayoutItem } from '../../types';

jest.mock('../../util/getDropPosition', () => ({
  ...jest.requireActual('../../util/getDropPosition'),
  __esModule: true,
  default: jest.fn(),
  clearDropCache: jest.fn(),
}));

const mockGetDropPosition = jest.mocked(getDropPosition);
const mockClearDropCache = jest.mocked(clearDropCache);

function makeComponent(overrides: Partial<LayoutItem> = {}): LayoutItem {
  return {
    id: 'chart-1',
    type: CHART_TYPE,
    children: [],
    parents: [],
    meta: {},
    ...overrides,
  };
}

function makeDragItem(overrides: Partial<DragItem> = {}): DragItem {
  return {
    id: 'dragged-1',
    type: CHART_TYPE,
    meta: {},
    index: 0,
    ...overrides,
  };
}

function makeMonitor(draggingItem: DragItem): DropTargetMonitor {
  return {
    getItem: jest.fn(() => draggingItem),
  } as unknown as DropTargetMonitor;
}

function makeMountedComponent(
  props: DragDroppableComponent['props'],
): DragDroppableComponent {
  return {
    mounted: true,
    props,
    setState: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('returns undefined without invoking onDrop when the component has unmounted', () => {
  mockGetDropPosition.mockReturnValue(DROP_TOP);
  const onDrop = jest.fn();
  const draggingItem = makeDragItem();
  const monitor = makeMonitor(draggingItem);
  const Component: DragDroppableComponent = {
    mounted: false,
    props: {
      component: makeComponent(),
      index: 0,
      onDrop,
    } as unknown as DragDroppableComponent['props'],
    setState: jest.fn(),
  };

  const result = handleDrop(Component.props, monitor, Component);

  expect(result).toBeUndefined();
  expect(onDrop).not.toHaveBeenCalled();
});

test('rejects a forbidden drop position without invoking onDrop', () => {
  mockGetDropPosition.mockReturnValue(DROP_FORBIDDEN);
  const onDrop = jest.fn();
  const draggingItem = makeDragItem();
  const monitor = makeMonitor(draggingItem);
  const Component = makeMountedComponent({
    component: makeComponent(),
    index: 0,
    onDrop,
  } as unknown as DragDroppableComponent['props']);

  const result = handleDrop(Component.props, monitor, Component);

  expect(result).toBeUndefined();
  expect(onDrop).not.toHaveBeenCalled();
  expect(mockClearDropCache).not.toHaveBeenCalled();
  // the drop indicator is cleared even though the drop is rejected
  const setState = Component.setState as jest.Mock;
  expect(setState).toHaveBeenCalledTimes(1);
  expect(setState.mock.calls[0][0]()).toEqual({ dropIndicator: null });
});

test('rejects a null drop position without invoking onDrop', () => {
  mockGetDropPosition.mockReturnValue(null);
  const onDrop = jest.fn();
  const draggingItem = makeDragItem();
  const monitor = makeMonitor(draggingItem);
  const Component = makeMountedComponent({
    component: makeComponent(),
    index: 0,
    onDrop,
  } as unknown as DragDroppableComponent['props']);

  const result = handleDrop(Component.props, monitor, Component);

  expect(result).toBeUndefined();
  expect(onDrop).not.toHaveBeenCalled();
  expect(mockClearDropCache).not.toHaveBeenCalled();
});

test('shifts the destination index down when moving later within the same parent', () => {
  mockGetDropPosition.mockReturnValue(DROP_TOP);
  const onDrop = jest.fn();
  const parentComponent = makeComponent({ id: 'row-1', type: ROW_TYPE });
  // dragging item started at index 1 in row-1, dropping onto the component
  // currently sitting at index 3 of the same parent and of a different type
  const draggingItem = makeDragItem({
    id: 'dragged-1',
    type: CHART_TYPE,
    index: 1,
    parentId: 'row-1',
    parentType: ROW_TYPE,
  });
  const monitor = makeMonitor(draggingItem);
  const Component = makeMountedComponent({
    component: makeComponent({ id: 'target-1', type: MARKDOWN_TYPE }),
    parentComponent,
    index: 3,
    onDrop,
  } as unknown as DragDroppableComponent['props']);

  const result = handleDrop(Component.props, monitor, Component);

  expect(result?.destination).toEqual({
    id: 'row-1',
    type: ROW_TYPE,
    index: 2,
  });
  expect(onDrop).toHaveBeenCalledWith(result);
});

test('does not shift the destination index when the dragged item is the same type as the target', () => {
  mockGetDropPosition.mockReturnValue(DROP_TOP);
  const parentComponent = makeComponent({ id: 'row-1', type: ROW_TYPE });
  const draggingItem = makeDragItem({
    id: 'dragged-1',
    type: CHART_TYPE,
    index: 1,
    parentId: 'row-1',
    parentType: ROW_TYPE,
  });
  const monitor = makeMonitor(draggingItem);
  const Component = makeMountedComponent({
    component: makeComponent({ id: 'target-1', type: CHART_TYPE }),
    parentComponent,
    index: 3,
    onDrop: jest.fn(),
  } as unknown as DragDroppableComponent['props']);

  const result = handleDrop(Component.props, monitor, Component);

  expect(result?.destination).toEqual({
    id: 'row-1',
    type: ROW_TYPE,
    index: 3,
  });
});

test.each([
  {
    case: 'the dragged item comes from a different parent',
    parentId: 'row-2',
    index: 1,
  },
  {
    case: 'the dragged item starts at a later index in the same parent',
    parentId: 'row-1',
    index: 5,
  },
])('does not shift the destination index when $case', ({ parentId, index }) => {
  mockGetDropPosition.mockReturnValue(DROP_TOP);
  const parentComponent = makeComponent({ id: 'row-1', type: ROW_TYPE });
  const draggingItem = makeDragItem({
    type: CHART_TYPE,
    index,
    parentId,
    parentType: ROW_TYPE,
  });
  const monitor = makeMonitor(draggingItem);
  const Component = makeMountedComponent({
    component: makeComponent({ id: 'target-1', type: MARKDOWN_TYPE }),
    parentComponent,
    index: 3,
    onDrop: jest.fn(),
  } as unknown as DragDroppableComponent['props']);

  const result = handleDrop(Component.props, monitor, Component);

  expect(result?.destination).toEqual({
    id: 'row-1',
    type: ROW_TYPE,
    index: 3,
  });
});

test('drops next to the target in its parent when dropToChild resolves false via a function', () => {
  mockGetDropPosition.mockReturnValue(DROP_TOP);
  const draggingItem = makeDragItem();
  const monitor = makeMonitor(draggingItem);
  const parentComponent = makeComponent({ id: 'row-1', type: ROW_TYPE });
  const dropToChild = jest.fn(() => false);
  const Component = makeMountedComponent({
    component: makeComponent({ id: 'tab-1', children: ['chart-a'] }),
    parentComponent,
    index: 4,
    dropToChild,
    onDrop: jest.fn(),
  } as unknown as DragDroppableComponent['props']);

  const result = handleDrop(Component.props, monitor, Component);

  expect(dropToChild).toHaveBeenCalledWith(draggingItem);
  expect(result?.destination).toEqual({
    id: 'row-1',
    type: ROW_TYPE,
    index: 4,
  });
});

test('appends to the end of the target component children when dropToChild is true', () => {
  mockGetDropPosition.mockReturnValue(DROP_TOP);
  const draggingItem = makeDragItem();
  const monitor = makeMonitor(draggingItem);
  const component = makeComponent({
    id: 'tabs-1',
    children: ['tab-a', 'tab-b'],
  });
  const Component = makeMountedComponent({
    component,
    index: 0,
    dropToChild: true,
    onDrop: jest.fn(),
  } as unknown as DragDroppableComponent['props']);

  const result = handleDrop(Component.props, monitor, Component);

  expect(result?.destination).toEqual({
    id: 'tabs-1',
    type: CHART_TYPE,
    index: 2,
  });
});

test('appends into an empty container when dropToChild resolves true via a function', () => {
  mockGetDropPosition.mockReturnValue(DROP_TOP);
  const draggingItem = makeDragItem();
  const monitor = makeMonitor(draggingItem);
  const component = makeComponent({ id: 'empty-tabs', children: [] });
  // with a parentComponent and a non-zero component index, the sibling-drop
  // fallback would target row-1 at index 4, so an empty-tabs destination at
  // index 0 can only come from the append branch
  const parentComponent = makeComponent({ id: 'row-1', type: ROW_TYPE });
  const dropToChild = jest.fn(() => true);
  const Component = makeMountedComponent({
    component,
    parentComponent,
    index: 4,
    dropToChild,
    onDrop: jest.fn(),
  } as unknown as DragDroppableComponent['props']);

  const result = handleDrop(Component.props, monitor, Component);

  expect(dropToChild).toHaveBeenCalledWith(draggingItem);
  expect(result?.destination).toEqual({
    id: 'empty-tabs',
    type: CHART_TYPE,
    index: 0,
  });
});

test('drops at the component index when there is no parent component', () => {
  mockGetDropPosition.mockReturnValue(DROP_TOP);
  const draggingItem = makeDragItem();
  const monitor = makeMonitor(draggingItem);
  const component = makeComponent({ id: 'root-child' });
  const Component = makeMountedComponent({
    component,
    index: 5,
    onDrop: jest.fn(),
  } as unknown as DragDroppableComponent['props']);

  const result = handleDrop(Component.props, monitor, Component);

  expect(result?.destination).toEqual({
    id: 'root-child',
    type: CHART_TYPE,
    index: 5,
  });
});

test('clears the drop cache after building a successful drop result', () => {
  mockGetDropPosition.mockReturnValue(DROP_TOP);
  const draggingItem = makeDragItem();
  const monitor = makeMonitor(draggingItem);
  const Component = makeMountedComponent({
    component: makeComponent(),
    index: 0,
    onDrop: jest.fn(),
  } as unknown as DragDroppableComponent['props']);

  handleDrop(Component.props, monitor, Component);

  expect(mockClearDropCache).toHaveBeenCalledTimes(1);
});
