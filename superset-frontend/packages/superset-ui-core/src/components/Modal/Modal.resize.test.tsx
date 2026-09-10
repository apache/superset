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
import { render, screen, act } from '@superset-ui/core/spec';
import { Modal } from './Modal';

// Track what props each mock receives
let lastDraggableProps: any = null;
let lastResizableProps: any = null;

jest.mock('react-draggable', () => {
  const MockDraggable = (props: any) => {
    lastDraggableProps = props;
    const { children, disabled, position, handle } = props;
    return (
      <div
        data-test="mock-draggable"
        data-position-x={position?.x ?? 0}
        data-position-y={position?.y ?? 0}
        data-disabled={disabled}
        data-handle={handle}
      >
        {children}
      </div>
    );
  };
  MockDraggable.displayName = 'MockDraggable';
  return { __esModule: true, default: MockDraggable };
});

jest.mock('re-resizable', () => {
  const MockResizable = (props: any) => {
    lastResizableProps = props;
    const { children, className, enable } = props;
    return (
      <div
        className={className}
        data-test="mock-resizable"
        data-enable={JSON.stringify(enable)}
      >
        {children}
      </div>
    );
  };
  MockResizable.displayName = 'MockResizable';
  return { Resizable: MockResizable };
});

beforeEach(() => {
  lastDraggableProps = null;
  lastResizableProps = null;
});

const renderModal = (props: Record<string, any> = {}) =>
  render(
    <Modal
      show
      onHide={jest.fn()}
      title="Test Modal"
      resizable
      draggable
      {...props}
    >
      <div>Modal content</div>
    </Modal>,
  );

describe('Modal resizable config', () => {
  test('preserves default enable handles when resizableConfig has no enable key', () => {
    renderModal({
      resizableConfig: {
        minHeight: 500,
        minWidth: 400,
        defaultSize: { width: 'auto', height: '75vh' },
      },
    });

    const enable = JSON.parse(
      screen.getByTestId('mock-resizable').getAttribute('data-enable') || '{}',
    );

    expect(enable).toEqual({
      bottom: true,
      bottomLeft: false,
      bottomRight: true,
      left: false,
      top: false,
      topLeft: false,
      topRight: false,
      right: true,
    });
  });

  test('uses default enable handles when no resizableConfig is provided', () => {
    renderModal();

    const enable = JSON.parse(
      screen.getByTestId('mock-resizable').getAttribute('data-enable') || '{}',
    );

    expect(enable).toEqual({
      bottom: true,
      bottomLeft: false,
      bottomRight: true,
      left: false,
      top: false,
      topLeft: false,
      topRight: false,
      right: true,
    });
  });

  test('uses caller-provided enable handles when explicitly set', () => {
    renderModal({
      resizableConfig: {
        enable: {
          bottom: true,
          bottomLeft: true,
          bottomRight: true,
          left: true,
          top: true,
          topLeft: true,
          topRight: true,
          right: true,
        },
      },
    });

    const enable = JSON.parse(
      screen.getByTestId('mock-resizable').getAttribute('data-enable') || '{}',
    );

    expect(enable.top).toBe(true);
    expect(enable.left).toBe(true);
    expect(enable.topLeft).toBe(true);
  });

  test('merges resizableConfig properties with defaults', () => {
    renderModal({
      resizableConfig: {
        minHeight: 600,
      },
    });

    const enable = JSON.parse(
      screen.getByTestId('mock-resizable').getAttribute('data-enable') || '{}',
    );

    // enable should be the defaults since caller didn't provide one
    expect(enable.bottom).toBe(true);
    expect(enable.right).toBe(true);
    expect(enable.top).toBe(false);
  });
});

describe('Modal controlled Draggable', () => {
  test('passes position to Draggable with initial {x:0, y:0}', () => {
    renderModal();

    expect(
      screen.getByTestId('mock-draggable').getAttribute('data-position-x'),
    ).toBe('0');
    expect(
      screen.getByTestId('mock-draggable').getAttribute('data-position-y'),
    ).toBe('0');
  });

  test('Draggable is enabled and gated on the title bar trigger', () => {
    renderModal();

    const draggable = screen.getByTestId('mock-draggable');
    expect(draggable.getAttribute('data-disabled')).toBe('false');
    expect(draggable.getAttribute('data-handle')).toBe('.draggable-trigger');
  });

  test('onResize callback is passed to Resizable', () => {
    renderModal();

    expect(lastResizableProps).not.toBeNull();
    expect(typeof lastResizableProps.onResize).toBe('function');
  });

  test('onDrag callback is passed to Draggable', () => {
    renderModal();

    expect(lastDraggableProps).not.toBeNull();
    expect(typeof lastDraggableProps.onDrag).toBe('function');
  });

  test('position prop is passed to Draggable', () => {
    renderModal();

    expect(lastDraggableProps).not.toBeNull();
    expect(lastDraggableProps.position).toEqual({ x: 0, y: 0 });
  });

  test('position resets to {0,0} after close and reopen', () => {
    const onHide = jest.fn();
    const { rerender } = render(
      <Modal show onHide={onHide} title="Test" resizable draggable>
        <div>Content</div>
      </Modal>,
    );

    // Simulate a drag by calling onDrag
    act(() => {
      lastDraggableProps.onDrag(null, { x: 100, y: 200 });
    });
    expect(lastDraggableProps.position).toEqual({ x: 100, y: 200 });

    // Close the modal
    act(() => {
      rerender(
        <Modal show={false} onHide={onHide} title="Test" resizable draggable>
          <div>Content</div>
        </Modal>,
      );
    });

    // Reopen the modal — position should have been reset
    act(() => {
      rerender(
        <Modal show onHide={onHide} title="Test" resizable draggable>
          <div>Content</div>
        </Modal>,
      );
    });

    expect(lastDraggableProps.position).toEqual({ x: 0, y: 0 });
  });

  test('shifts Draggable left when resizing from the left edge', () => {
    renderModal();

    act(() => {
      lastResizableProps.onResizeStart();
      lastResizableProps.onResize({}, 'left', {}, { width: 50, height: 0 });
    });

    // re-resizable grows the box away from its layout origin and never moves
    // it, so anchoring the right edge means moving the modal left by the
    // growth delta.
    expect(lastDraggableProps.position).toEqual({ x: -50, y: 0 });
  });

  test('shifts Draggable up when resizing from the top edge', () => {
    renderModal();

    act(() => {
      lastResizableProps.onResizeStart();
      lastResizableProps.onResize({}, 'top', {}, { width: 0, height: 40 });
    });

    expect(lastDraggableProps.position).toEqual({ x: 0, y: -40 });
  });

  test('anchors both axes when resizing from the topLeft corner', () => {
    renderModal();

    act(() => {
      lastResizableProps.onResizeStart();
      lastResizableProps.onResize({}, 'topLeft', {}, { width: 50, height: 40 });
    });

    // Corner directions are camelCase; the left/top match must be
    // case-insensitive or the x axis is never synced.
    expect(lastDraggableProps.position).toEqual({ x: -50, y: -40 });
  });

  test('handles cumulative onResize deltas idempotently', () => {
    renderModal();

    act(() => {
      lastDraggableProps.onDrag(null, { x: 20, y: 30 });
    });
    act(() => {
      lastResizableProps.onResizeStart();
      // re-resizable reports the total delta since the gesture started,
      // once per mouse-move event.
      lastResizableProps.onResize({}, 'left', {}, { width: 25, height: 0 });
      lastResizableProps.onResize({}, 'left', {}, { width: 50, height: 0 });
      lastResizableProps.onResize({}, 'left', {}, { width: 75, height: 0 });
    });

    // Position is base - delta, not an accumulation of every event.
    expect(lastDraggableProps.position).toEqual({ x: -55, y: 30 });
  });

  test('does not move Draggable when resizing from the bottom-right corner', () => {
    renderModal();

    act(() => {
      lastResizableProps.onResizeStart();
      lastResizableProps.onResize(
        {},
        'bottomRight',
        {},
        { width: 30, height: 20 },
      );
    });

    // Bottom/right handles grow away from the anchored top-left; position
    // must stay untouched (no drift).
    expect(lastDraggableProps.position).toEqual({ x: 0, y: 0 });
  });
});
