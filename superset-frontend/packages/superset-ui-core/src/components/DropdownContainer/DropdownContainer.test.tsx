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
import type { CSSProperties } from 'react';
import { screen, render } from '@superset-ui/core/spec';
import * as resizeDetector from 'react-resize-detector';
import { Button, DropdownContainer, Icons } from '..';

const generateItems = (n: number) =>
  Array.from({ length: n }).map((_, i) => ({
    id: `el-${i + 1}`,
    element: <Button>{`Element ${i + 1}`}</Button>,
  }));

const ITEMS = generateItems(10);

beforeEach(() => {
  // Reset any mocks
  jest.restoreAllMocks();

  // Mock ResizeObserver globally
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});

test('renders children', () => {
  render(<DropdownContainer items={generateItems(3)} />);
  expect(screen.getByText('Element 1')).toBeInTheDocument();
  expect(screen.getByText('Element 2')).toBeInTheDocument();
  expect(screen.getByText('Element 3')).toBeInTheDocument();
});

test('renders children with custom horizontal spacing', () => {
  render(<DropdownContainer items={ITEMS} style={{ gap: 20 }} />);
  expect(screen.getByTestId('container')).toHaveStyle('gap: 20px');
});

test('does not render a dropdown button when not overflowing', () => {
  render(<DropdownContainer items={generateItems(3)} />);
  expect(screen.queryByText('More')).not.toBeInTheDocument();
});

test('renders component with dropdown trigger icon prop without error', () => {
  render(
    <DropdownContainer
      items={generateItems(5)}
      dropdownTriggerIcon={<Icons.LinkOutlined />}
    />,
  );
  // Component should render without error
  expect(screen.getByText('Element 1')).toBeInTheDocument();
});

test('renders component with dropdown trigger text prop without error', () => {
  const customText = 'Custom text';
  render(
    <DropdownContainer
      items={generateItems(5)}
      dropdownTriggerText={customText}
    />,
  );
  // Component should render without error
  expect(screen.getByText('Element 1')).toBeInTheDocument();
});

test('renders component with dropdown trigger count prop without error', () => {
  const customCount = 99;
  render(
    <DropdownContainer
      items={generateItems(5)}
      dropdownTriggerCount={customCount}
    />,
  );
  // Component should render without error
  expect(screen.getByText('Element 1')).toBeInTheDocument();
});

test('renders component with dropdown style prop without error', () => {
  render(
    <DropdownContainer items={generateItems(5)} dropdownStyle={{ gap: 20 }} />,
  );
  // Component should render without error
  expect(screen.getByText('Element 1')).toBeInTheDocument();
});

test('renders component with onOverflowingStateChange prop without error', () => {
  const onOverflowingStateChange = jest.fn();
  render(
    <DropdownContainer
      items={generateItems(5)}
      onOverflowingStateChange={onOverflowingStateChange}
    />,
  );
  // Component should render without error
  expect(screen.getByText('Element 1')).toBeInTheDocument();
});

test('renders component with custom dropdown content prop without error', () => {
  const customDropdownContent = <div>Custom content</div>;
  render(
    <DropdownContainer
      items={generateItems(5)}
      dropdownContent={() => customDropdownContent}
    />,
  );
  // Component should render without error
  expect(screen.getByText('Element 1')).toBeInTheDocument();
});

test('renders component with dropdown trigger tooltip prop without error', () => {
  render(
    <DropdownContainer
      items={generateItems(5)}
      dropdownTriggerTooltip="Test tooltip"
    />,
  );
  // Component should render without error
  expect(screen.getByText('Element 1')).toBeInTheDocument();
});

// Tests that can work without complex overflow mocking
test('container has correct test id', () => {
  render(<DropdownContainer items={generateItems(3)} />);
  expect(screen.getByTestId('container')).toBeInTheDocument();
});

test('renders all provided items when not overflowing', () => {
  const items = generateItems(3);
  render(<DropdownContainer items={items} />);

  items.forEach((item, index) => {
    expect(screen.getByText(`Element ${index + 1}`)).toBeInTheDocument();
  });
});

test('accepts custom style props', () => {
  const customStyle = { backgroundColor: 'red', padding: '10px' };
  render(<DropdownContainer items={generateItems(2)} style={customStyle} />);

  const container = screen.getByTestId('container');
  expect(container).toHaveStyle('background-color: rgb(255, 0, 0)');
  expect(container).toHaveStyle('padding: 10px');
});

// Integration test that doesn't rely on specific overflow behavior
test('component renders and functions without throwing errors', () => {
  const onOverflowingStateChange = jest.fn();

  expect(() => {
    render(
      <DropdownContainer
        items={generateItems(10)}
        onOverflowingStateChange={onOverflowingStateChange}
        dropdownTriggerText="More items"
        dropdownTriggerTooltip="Click to see more"
        style={{ gap: 10 }}
        dropdownStyle={{ gap: 5 }}
      />,
    );
  }).not.toThrow();

  // Basic functionality test
  expect(screen.getByText('Element 1')).toBeInTheDocument();
});

const WRAPPER_WIDTH = 300;
const ITEM_WIDTH = 100;
/* Width the flex layout leaves the row once the trigger button is laid out. */
const ROW_WIDTH = 250;

/**
 * Lays items out at ITEM_WIDTH each and reports the item row as bounded only
 * by its own content, which is the frame Edge can paint before the flex layout
 * bounds the row. An inline `max-width` in pixels is the only bound left, so
 * the mock honors it and `onRowMeasure` receives the row, and the right edge
 * the overflow calculation sees, while the row holds every item.
 */
const mockBoundingRects = (
  onRowMeasure: (row: HTMLElement, right: number) => void,
) => {
  const getBoundingClientRect: (this: HTMLElement) => DOMRect = function () {
    let right: number;
    if (this.dataset.test === 'container') {
      const clamp = /^(\d+(?:\.\d+)?)px$/.exec(this.style.maxWidth);
      right = Math.min(
        this.children.length * ITEM_WIDTH,
        clamp ? Number(clamp[1]) : ROW_WIDTH,
      );
      if (this.children.length === 4) {
        onRowMeasure(this, right);
      }
    } else {
      const itemNumber = Number(this.textContent?.match(/Element (\d+)/)?.[1]);
      right = itemNumber ? itemNumber * ITEM_WIDTH : ROW_WIDTH;
    }
    return {
      bottom: 0,
      height: 0,
      left: right - ITEM_WIDTH,
      right,
      top: 0,
      width: ITEM_WIDTH,
      x: right - ITEM_WIDTH,
      y: 0,
      toJSON: () => ({}),
    };
  };
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(getBoundingClientRect);
};

const mockWrapperWidth = (width: number) =>
  jest.spyOn(resizeDetector, 'useResizeDetector').mockReturnValue({
    ref: { current: null as HTMLDivElement | null },
    width,
  });

/* Grows an overflowing row by one item, which mounts every item for a frame
 * while the new overflow index is calculated. */
const remeasureWithExtraItem = (style?: CSSProperties) => {
  const { rerender } = render(<DropdownContainer items={generateItems(3)} />);
  rerender(<DropdownContainer items={generateItems(3)} />);
  expect(screen.getByTestId('dropdown-container-btn')).toBeInTheDocument();
  rerender(<DropdownContainer items={generateItems(4)} style={style} />);
};

test('clamps the item row to the wrapper width while remeasuring', () => {
  mockWrapperWidth(WRAPPER_WIDTH);
  let clampedRowRight: number | undefined;
  mockBoundingRects((row, right) => {
    expect(row).toHaveStyle({
      maxWidth: `${WRAPPER_WIDTH}px`,
      overflow: 'hidden',
    });
    clampedRowRight = right;
  });

  remeasureWithExtraItem({ maxWidth: 'none', overflow: 'visible' });

  /* The all-items row holds 400px of items, so the overflow index is computed
   * against the 300px clamp and not against the row's own content edge. The
   * clamp holds even though the consumer asked for `max-width: none`. */
  expect(clampedRowRight).toBe(WRAPPER_WIDTH);
});

test('does not clamp the item row before the wrapper is measured', () => {
  mockWrapperWidth(0);
  let clampedMaxWidth: string | undefined;
  mockBoundingRects(row => {
    clampedMaxWidth = row.style.maxWidth;
  });

  remeasureWithExtraItem({ maxWidth: 'none' });

  /* A zero width means the resize callback hasn't fired yet. Clamping to it
   * would hide every item instead of only the overflowing ones. */
  expect(clampedMaxWidth).toBe('none');
});
