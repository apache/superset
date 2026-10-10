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
import { useContext } from 'react';
import type { DragStartEvent } from '@dnd-kit/core';
import { act, fireEvent, render } from 'spec/helpers/testing-library';

import ExploreContainer, { DraggingContext, DropzoneContext } from '.';

// @dnd-kit's PointerSensor only reacts to real pointer events, which jsdom
// cannot dispatch. To exercise the drag-start gating we capture the
// `onDragStart` handler the provider registers on DndContext and invoke it
// directly with a synthetic event.
let capturedOnDragStart: ((event: DragStartEvent) => void) | undefined;

jest.mock('@dnd-kit/core', () => {
  const actual = jest.requireActual('@dnd-kit/core');
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
    }: {
      children: React.ReactNode;
      onDragStart?: (event: DragStartEvent) => void;
    }) => {
      capturedOnDragStart = onDragStart;
      return children;
    },
  };
});

beforeEach(() => {
  capturedOnDragStart = undefined;
});

const MockChildren = () => {
  const dragging = useContext(DraggingContext);
  return (
    <div data-test="mock-children" className={dragging ? 'dragging' : ''}>
      {dragging ? 'dragging' : 'not dragging'}
    </div>
  );
};

const MockChildren2 = () => {
  const [zones, dispatch] = useContext(DropzoneContext);
  return (
    <>
      <div data-test="mock-children">{Object.keys(zones).join(':')}</div>
      <button
        type="button"
        onClick={() => dispatch({ key: 'test_item_1', canDrop: () => true })}
      >
        Add
      </button>
      <button type="button" onClick={() => dispatch({ key: 'test_item_1' })}>
        Remove
      </button>
    </>
  );
};

test('should render children', () => {
  const { getByTestId, getByText } = render(
    <ExploreContainer>
      <MockChildren />
    </ExploreContainer>,
    { useRedux: true },
  );
  expect(getByTestId('mock-children')).toBeInTheDocument();
  expect(getByText('not dragging')).toBeInTheDocument();
});

test('should initially have dragging set to false', () => {
  const { container, getByText } = render(
    <ExploreContainer>
      <MockChildren />
    </ExploreContainer>,
    { useRedux: true },
  );
  expect(container.getElementsByClassName('dragging')).toHaveLength(0);
  expect(getByText('not dragging')).toBeInTheDocument();
});

test('propagates dragging state when dragging a panel option', () => {
  const { container } = render(
    <ExploreContainer>
      <MockChildren />
    </ExploreContainer>,
    { useRedux: true },
  );

  expect(container.getElementsByClassName('dragging')).toHaveLength(0);

  // Dragging a DatasourcePanel option (no `dragIndex`) sets the dragging state.
  act(() => {
    capturedOnDragStart?.({
      active: { id: 'panel', data: { current: { type: 'metric' } } },
    } as unknown as DragStartEvent);
  });
  expect(container.getElementsByClassName('dragging')).toHaveLength(1);
});

test('does not propagate dragging state for an in-list reorder', () => {
  const { container } = render(
    <ExploreContainer>
      <MockChildren />
    </ExploreContainer>,
    { useRedux: true },
  );

  expect(container.getElementsByClassName('dragging')).toHaveLength(0);

  // An in-list sortable reorder carries a `dragIndex` and must NOT set the
  // dragging state (it would otherwise surface drop targets during a reorder).
  act(() => {
    capturedOnDragStart?.({
      active: {
        id: 'sortable',
        data: { current: { type: 'metric', dragIndex: 0 } },
      },
    } as unknown as DragStartEvent);
  });
  expect(container.getElementsByClassName('dragging')).toHaveLength(0);
});

test('should manage the dropValidators', () => {
  const { queryByText, getByText } = render(
    <ExploreContainer>
      <MockChildren2 />
    </ExploreContainer>,
    { useRedux: true },
  );

  expect(queryByText('test_item_1')).not.toBeInTheDocument();
  const addDropValidatorButton = getByText('Add');
  fireEvent.click(addDropValidatorButton);
  expect(getByText('test_item_1')).toBeInTheDocument();
  const removeDropValidatorButton = getByText('Remove');
  fireEvent.click(removeDropValidatorButton);
  expect(queryByText('test_item_1')).not.toBeInTheDocument();
});
