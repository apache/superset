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
import { render } from 'spec/helpers/testing-library';
import { getEmptyImage } from 'react-dnd-html5-backend';

import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import {
  CHART_TYPE,
  ROW_TYPE,
  TAB_TYPE,
} from 'src/dashboard/util/componentTypes';
import { UnwrappedDragDroppable as DragDroppable } from 'src/dashboard/components/dnd/DragDroppable';

describe('DragDroppable', () => {
  const props = {
    component: newComponentFactory(CHART_TYPE),
    parentComponent: newComponentFactory(ROW_TYPE),
    editMode: false,
    depth: 1,
    index: 0,
    isDragging: false,
    isDraggingOver: false,
    isDraggingOverShallow: false,
    droppableRef() {},
    dragSourceRef() {},
    dragPreviewRef() {},
  };

  function setup(overrideProps = {}) {
    const defaultChildren = provided => (
      <div data-test="child-content" {...provided}>
        Test Content
      </div>
    );

    const utils = render(
      <DragDroppable {...props} {...overrideProps}>
        {overrideProps.children || defaultChildren}
      </DragDroppable>,
    );
    return {
      ...utils,
      children: overrideProps.children || defaultChildren,
    };
  }

  it('should call its child function', () => {
    const renderChild = jest.fn(provided => (
      <div data-test="child-content" {...provided}>
        Test Content
      </div>
    ));

    setup({ children: renderChild });
    expect(renderChild).toHaveBeenCalled();
    expect(renderChild.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        'data-test': 'dragdroppable-content',
      }),
    );
  });

  it('should call its child function with "dragSourceRef" if editMode=true', () => {
    const renderChild = jest.fn().mockImplementation(provided => (
      <div data-test="child-content" {...provided}>
        Test Content
      </div>
    ));
    const dragSourceRef = () => {};

    setup({ children: renderChild, editMode: false });
    expect(renderChild).toHaveBeenCalledWith(
      expect.objectContaining({
        'data-test': 'dragdroppable-content',
      }),
    );

    setup({ children: renderChild, editMode: true, dragSourceRef });
    expect(renderChild).toHaveBeenLastCalledWith(
      expect.objectContaining({
        'data-test': 'dragdroppable-content',
        dragSourceRef,
      }),
    );
  });

  it('should call its child function with "dropIndicatorProps" dependent on editMode and isDraggingOver', () => {
    const renderChild = jest.fn(provided => (
      <div data-test="child-content" {...provided}>
        Test Content
      </div>
    ));

    // Create a mock component with the dropIndicator state already set
    class MockDragDroppable extends DragDroppable {
      constructor(props) {
        super(props);
        this.state = { dropIndicator: true };
      }
    }

    render(
      <MockDragDroppable
        {...props}
        editMode
        isDraggingOver
        component={newComponentFactory(TAB_TYPE)}
      >
        {renderChild}
      </MockDragDroppable>,
    );

    // Verify the last render included dropIndicatorProps
    expect(
      renderChild.mock.calls[renderChild.mock.calls.length - 1][0],
    ).toMatchObject({
      'data-test': 'dragdroppable-content',
      dropIndicatorProps: { className: 'drop-indicator' },
    });
  });

  it('should call props.dragPreviewRef and props.droppableRef on mount', () => {
    const dragPreviewRef = jest.fn();
    const droppableRef = jest.fn();

    setup({ dragPreviewRef, droppableRef });
    expect(dragPreviewRef).toHaveBeenCalledTimes(1);
    expect(droppableRef).toHaveBeenCalledTimes(1);
  });

  it('should handle forbidden drops correctly', () => {
    const renderChild = jest.fn(provided => (
      <div data-test="child-content" {...provided}>
        Test Content
      </div>
    ));

    class MockDragDroppable extends DragDroppable {
      constructor(props) {
        super(props);
        this.state = { dropIndicator: 'DROP_FORBIDDEN' };
      }
    }

    render(
      <MockDragDroppable
        {...props}
        editMode
        isDraggingOver
        component={newComponentFactory(TAB_TYPE)}
      >
        {renderChild}
      </MockDragDroppable>,
    );

    expect(
      renderChild.mock.calls[renderChild.mock.calls.length - 1][0],
    ).toMatchObject({
      dropIndicatorProps: {
        className: expect.stringContaining('drop-indicator--forbidden'),
      },
    });
  });

  it('should handle orientation prop correctly', () => {
    const { container } = setup({ orientation: 'column' });
    expect(container.firstChild).toHaveClass('dragdroppable-column');

    const { container: container2 } = setup({ orientation: 'row' });
    expect(container2.firstChild).toHaveClass('dragdroppable-row');
  });

  it('should handle disabled drag and drop', () => {
    const renderChild = jest.fn(provided => (
      <div data-test="child-content" {...provided}>
        Test Content
      </div>
    ));

    class MockDragDroppable extends DragDroppable {
      constructor(props) {
        super(props);
        this.state = { dropIndicator: true };
      }
    }

    render(
      <MockDragDroppable
        {...props}
        editMode
        isDraggingOver
        disableDragDrop
        component={newComponentFactory(TAB_TYPE)}
      >
        {renderChild}
      </MockDragDroppable>,
    );

    expect(
      renderChild.mock.calls[renderChild.mock.calls.length - 1][0],
    ).toMatchObject({
      'data-test': 'dragdroppable-content',
      dropIndicatorProps: null,
    });
  });

  // Later in the file, remove the require and use the imported getEmptyImage
  it('should handle empty drag preview correctly', () => {
    const dragPreviewRef = jest.fn();

    setup({
      dragPreviewRef,
      useEmptyDragPreview: true,
    });

    expect(dragPreviewRef).toHaveBeenCalledWith(
      getEmptyImage(),
      expect.objectContaining({
        captureDraggingState: true,
      }),
    );
  });

  it('should call onDropIndicatorChange when appropriate', () => {
    const onDropIndicatorChange = jest.fn();
    const { rerender } = setup({
      component: newComponentFactory(TAB_TYPE),
      onDropIndicatorChange,
    });

    rerender(
      <DragDroppable
        {...props}
        component={newComponentFactory(TAB_TYPE)}
        onDropIndicatorChange={onDropIndicatorChange}
        isDraggingOver
        editMode
      />,
    );

    expect(onDropIndicatorChange).toHaveBeenCalledWith(
      expect.objectContaining({
        isDraggingOver: true,
      }),
    );
  });
});
