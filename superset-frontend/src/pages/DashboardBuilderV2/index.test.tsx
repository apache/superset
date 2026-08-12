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
import { act, fireEvent, render, screen } from 'spec/helpers/testing-library';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import DashboardBuilderV2 from '.';

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
});

const renderPage = () => render(<DashboardBuilderV2 />, { useRedux: true });

test('a blank dashboard can still be reached', async () => {
  renderPage();

  // The canvas is no longer chat-only: a palette sits beside it, so the
  // empty state names both ways in.
  expect(
    screen.getByText(
      'Drag a building block from the panel, or ask the assistant for one.',
    ),
  ).toBeInTheDocument();

  await userEvent.click(screen.getByTestId('empty-canvas'));

  expect(provider.getSelection()).toBe(provider.getRoot().id);
});

test('the canvas has no corner controls', () => {
  renderPage();

  expect(screen.queryByTestId('canvas-controls')).not.toBeInTheDocument();
  expect(screen.queryByTestId('canvas-arrange')).not.toBeInTheDocument();
  expect(screen.queryByTestId('canvas-refresh')).not.toBeInTheDocument();
});

test('the page is a header, an editor panel and a canvas', () => {
  renderPage();

  expect(screen.getByTestId('dashboard-header')).toBeInTheDocument();
  expect(screen.getByTestId('editor-panel')).toBeInTheDocument();
  expect(screen.getByTestId('canvas')).toBeInTheDocument();
});

test('placing a block from the palette puts it on the dashboard and selects it', async () => {
  renderPage();

  await userEvent.click(screen.getByTestId('palette-markdown'));

  const children = provider.getRoot().children ?? [];
  expect(children).toHaveLength(1);
  // Placing something is the moment you want to configure it, which is also
  // what brings Properties forward.
  expect(provider.getSelection()).toBe(children[0]);
});

/** A drag payload jsdom's synthetic events do not carry on their own. */
const paletteTransfer = (type: string) => {
  const data = new Map([['application/x-dashboard-building-block', type]]);
  return {
    types: [...data.keys()],
    getData: (key: string) => data.get(key) ?? '',
    setData: (key: string, value: string) => data.set(key, value),
    dropEffect: '',
    effectAllowed: '',
  };
};

/**
 * jsdom has no layout engine — `getBoundingClientRect` on any element
 * returns all zeros unless overridden, which is exactly what the preview's
 * own cursor-to-cell math (`cellAtPoint`/`resolveCellGeometry`) divides by.
 * Stubbed here to a realistic, arbitrary size so that math produces real,
 * assertable pixels instead of `NaN`/`Infinity` — the same reason
 * `RootGrid.test.tsx` mocks `gridstack` rather than asserting real pixel
 * geometry against a real DOM.
 */
function stubCanvasRect(canvas: HTMLElement, width: number, height: number) {
  canvas.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    }) as DOMRect;
}

/**
 * `fireEvent.dragOver(el, { clientX, clientY })` silently drops both —
 * jsdom's `DragEvent` doesn't carry `MouseEvent`'s init properties through
 * the way a real browser's does, so `event.clientX`/`clientY` come out
 * `undefined` in the handler regardless of what's passed here. A plain
 * `MouseEvent` (which jsdom *does* construct correctly) with `dataTransfer`
 * attached after the fact gets the real pixel values the preview's own
 * cursor-to-cell math needs, without needing an actual `DragEvent`.
 */
function dragOverAt(
  el: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
) {
  const event = new MouseEvent('dragover', {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
  });
  Object.defineProperty(event, 'dataTransfer', {
    value: paletteTransfer(type),
  });
  fireEvent(el, event);
}

test('the empty-canvas drop preview is sized like the first block, not the whole canvas', () => {
  renderPage();

  const canvas = screen.getByTestId('empty-canvas');
  stubCanvasRect(canvas, 1000, 800);
  fireEvent.dragEnter(canvas, { dataTransfer: paletteTransfer('markdown') });
  dragOverAt(canvas, 'markdown', 500, 400);

  const preview = screen.getByTestId('empty-canvas-drop-preview');
  // Regression: this used to be `width: 100%; height: 100%`, so the
  // preview always filled the entire canvas regardless of its own size —
  // reading as ignoring the drag rather than answering it.
  expect(parseFloat(preview.style.width)).toBeGreaterThan(0);
  expect(parseFloat(preview.style.width)).toBeLessThan(1000);
  expect(parseFloat(preview.style.height)).toBeGreaterThan(0);
  expect(parseFloat(preview.style.height)).toBeLessThan(800);
});

test('a drag that ends without ever dropping (cancelled, or released off-canvas) still clears the empty-canvas preview', () => {
  renderPage();

  const canvas = screen.getByTestId('empty-canvas');
  stubCanvasRect(canvas, 1000, 800);
  fireEvent.dragEnter(canvas, { dataTransfer: paletteTransfer('markdown') });
  dragOverAt(canvas, 'markdown', 500, 400);
  expect(screen.getByTestId('empty-canvas-drop-preview')).toBeInTheDocument();

  // No `dragleave`, no `drop` — just the drag concluding, the same way a
  // release past the browser window's own edge or an `Escape` would.
  fireEvent(document, new Event('dragend', { bubbles: true }));

  expect(
    screen.queryByTestId('empty-canvas-drop-preview'),
  ).not.toBeInTheDocument();
});

test('dropping a palette block on a blank dashboard places it there', () => {
  renderPage();

  // `RootGrid`'s own drop target does not exist yet on a blank dashboard —
  // this is the one that is actually on screen at that point, and it needs
  // the identical handling or the empty state's own instruction to "drag a
  // building block from the panel" is one this element cannot answer.
  fireEvent.drop(screen.getByTestId('empty-canvas'), {
    dataTransfer: paletteTransfer('markdown'),
  });

  const children = provider.getRoot().children ?? [];
  expect(children).toHaveLength(1);
  expect(provider.getNode(children[0])?.type).toBe('markdown');
});

test('a block placed while a container is selected goes inside it', async () => {
  renderPage();
  // A 'tabs' block itself is not the container to select for this — its own
  // children are always 'tab' panes, never a leaf placed directly — so this
  // selects the pane, which is exactly where a leaf placed from the palette
  // belongs.
  const tabsId = provider.addBuildingBlock(provider.getRoot().id, 0, {
    type: 'tabs',
  });
  const paneId = provider.addBuildingBlock(tabsId, 0, {
    type: 'tab',
    props: { label: 'Overview' },
  });
  act(() => provider.setSelection(paneId));

  await userEvent.click(screen.getByTestId('palette-markdown'));

  // An author who has just selected a pane and reaches for a block means to
  // put it in that pane.
  expect(provider.getNode(paneId)?.children).toEqual([provider.getSelection()]);
  expect(provider.getNode(tabsId)?.children).toEqual([paneId]);
});

test('a block placed while a leaf is selected goes beside it, not inside it', async () => {
  renderPage();
  await userEvent.click(screen.getByTestId('palette-markdown'));
  const firstId = provider.getSelection()!;

  await userEvent.click(screen.getByTestId('palette-echarts'));

  expect(provider.getRoot().children).toEqual([
    firstId,
    provider.getSelection(),
  ]);
});

test('clicking the canvas itself clears the selection', async () => {
  renderPage();
  await userEvent.click(screen.getByTestId('palette-markdown'));
  expect(provider.getSelection()).toBeDefined();

  await userEvent.click(screen.getByTestId('canvas'));

  // A click that reached the canvas passed every block on the way, so it is
  // the one gesture that unambiguously means "nothing".
  expect(provider.getSelection()).toBeUndefined();
});
