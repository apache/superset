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
import { render, screen } from 'spec/helpers/testing-library';
import { ThemeProvider, supersetTheme } from '@superset-ui/core';

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
    const utils = render(
      <ThemeProvider theme={supersetTheme}>
        <DragDroppable {...props} {...overrideProps}>
          {provided => (
            <div data-test="child-content" {...provided}>
              Test Content
            </div>
          )}
        </DragDroppable>
      </ThemeProvider>,
    );
    return {
      ...utils,
      children: overrideProps.children,
    };
  }

  it('should render a div with class dragdroppable', () => {
    setup();
    expect(screen.getByTestId('dragdroppable-object')).toHaveClass(
      'dragdroppable',
    );
  });

  it('should add class dragdroppable--dragging when dragging', () => {
    setup({ isDragging: true });
    expect(screen.getByTestId('dragdroppable-object')).toHaveClass(
      'dragdroppable--dragging',
    );
  });

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

  it('should call onDropIndicatorChange when isDraggingOver changes', () => {
    const onDropIndicatorChange = jest.fn();
    const { rerender } = setup({
      onDropIndicatorChange,
      component: newComponentFactory(TAB_TYPE),
    });

    rerender(
      <ThemeProvider theme={supersetTheme}>
        <DragDroppable
          {...props}
          onDropIndicatorChange={onDropIndicatorChange}
          component={newComponentFactory(TAB_TYPE)}
          isDraggingOver
        >
          {provided => (
            <div data-testid="child-content" {...provided}>
              Test Content
            </div>
          )}
        </DragDroppable>
      </ThemeProvider>,
    );

    expect(onDropIndicatorChange).toHaveBeenCalledTimes(1);
  });

  it('should call its child function with "dragSourceRef" if editMode=true', () => {
    const renderChild = jest.fn(provided => (
      <div data-test="child-content" {...provided}>
        Test Content
      </div>
    ));
    const dragSourceRef = () => {};

    setup({ children: renderChild, editMode: false });
    expect(renderChild.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        'data-test': 'dragdroppable-content',
      }),
    );

    setup({ children: renderChild, editMode: true, dragSourceRef });
    expect(renderChild.mock.calls[1][0]).toEqual(
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
    const { rerender } = setup({ children: renderChild });

    expect(renderChild.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        'data-test': 'dragdroppable-content',
      }),
    );

    rerender(
      <ThemeProvider theme={supersetTheme}>
        <DragDroppable {...props} editMode isDraggingOver>
          {renderChild}
        </DragDroppable>
      </ThemeProvider>,
    );

    expect(renderChild.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        'data-test': 'dragdroppable-content',
        dropIndicatorProps: { className: 'drop-indicator' },
      }),
    );
  });

  it('should call props.dragPreviewRef and props.droppableRef on mount', () => {
    const dragPreviewRef = jest.fn();
    const droppableRef = jest.fn();

    setup({ dragPreviewRef, droppableRef });
    expect(dragPreviewRef).toHaveBeenCalledTimes(1);
    expect(droppableRef).toHaveBeenCalledTimes(1);
  });
});
