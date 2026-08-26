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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import DashboardProvider from './DashboardProvider';
import { registerBuiltInWidgets } from './registerBuiltInWidgets';
import WidgetView from './WidgetView';

const provider = DashboardProvider.getInstance();

beforeAll(() => {
  registerBuiltInWidgets();
});

beforeEach(() => {
  provider.reset();
});

const withBlock = () => {
  const rootId = provider.getRoot().id;
  const id = provider.addWidget(rootId, 0, {
    type: 'metric-tile',
    props: { label: 'Quarterly notes' },
  });
  render(<WidgetView nodeId={id} />);
  return { rootId, id };
};

test('a widget says which one it is', () => {
  const { id } = withBlock();

  // Named by the same call the Outline names its rows by, so a widget is not
  // "Quarterly notes" in one place and "Metric Tile" in the other.
  expect(screen.getByTestId(`widget-title-${id}`)).toHaveTextContent(
    'Quarterly notes',
  );
});

test('the delete control does not have to be found first', () => {
  const { id } = withBlock();

  // It used to appear only on hover, which is a control you have to already
  // know is there. `toBeVisible` fails on the opacity that hid it.
  expect(screen.getByTestId(`widget-remove-${id}`)).toBeVisible();
});

test('removing a widget is offered as a bin, not as a cross', () => {
  const { id } = withBlock();

  // A cross on a card is the gesture for dismissing the card — closing it,
  // putting it away, getting it off screen. This takes the widget off the
  // dashboard, and the bin is what says that everywhere else in the app.
  expect(
    screen.getByTestId(`widget-remove-${id}`).querySelector('.anticon-delete'),
  ).toBeInTheDocument();
});

test('the root carries no header of its own', () => {
  const rootId = provider.getRoot().id;
  render(<WidgetView nodeId={rootId} />);

  // The root is the dashboard rather than something on it: a header there
  // would label it "Canvas" and offer a delete the provider refuses.
  expect(
    screen.queryByTestId(`widget-header-${rootId}`),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId(`widget-remove-${rootId}`),
  ).not.toBeInTheDocument();
});

test('the overflow menu sits to the right of the bin', () => {
  const { id } = withBlock();

  const bin = screen.getByTestId(`widget-remove-${id}`);
  const menu = screen.getByTestId(`widget-menu-${id}`);
  expect(
    bin.compareDocumentPosition(menu) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('the overflow menu offers the same Remove the bin does', async () => {
  const { id } = withBlock();

  await userEvent.click(screen.getByTestId(`widget-menu-${id}`));
  await userEvent.click(await screen.findByText('Remove widget'));

  expect(provider.getNode(id)).toBeUndefined();
});

test("a widget's name reads as its title, not as a caption on it", () => {
  const { id } = withBlock();

  // Set in the secondary colour at the small size, it read as an annotation
  // hanging above the widget rather than as the name of the thing below it —
  // which is what it is, and the first thing anyone scanning the canvas uses
  // to tell one widget from the next.
  const title = screen.getByTestId(`widget-title-${id}`);

  expect(title).toHaveStyle({ color: 'rgba(0, 0, 0, 0.88)' });
  // Compared rather than pinned: `fontWeightStrong` is a theme token, and it
  // does not resolve to the same number here as it does in the app. Asserting
  // the literal would be asserting the test theme's value, which is not the
  // one that ships.
  expect(Number(getComputedStyle(title).fontWeight)).toBeGreaterThan(400);
});

/** The element a node draws itself as — the card, for a widget that has one. */
const frameOf = (id: string) =>
  document.querySelector(`[data-node-id="${id}"]`) as HTMLElement;

test('a widget hides what it is drawn over, name and all', () => {
  const { rootId, id } = withBlock();

  // A free canvas lets widgets overlap, and only the leaf's own box was ever
  // opaque — so a widget raised to the front still showed whatever sat behind
  // it through the strip carrying its name, and two overlapping widgets
  // rendered their names on top of each other.
  expect(frameOf(id)).toHaveStyle({ backgroundColor: '#FFFFFF' });
  // The root is the canvas everything is arranged on, not a card on it.
  render(<WidgetView nodeId={rootId} />);
  expect(frameOf(rootId)).not.toHaveStyle({ backgroundColor: '#FFFFFF' });
});

test('a widget is one card, with its name inside the frame rather than above it', () => {
  const { id } = withBlock();

  // The frame was drawn by the leaf, which begins below the header — so a
  // card's top edge ran between a widget's name and its contents, and the name
  // read as a caption floating over a separate box rather than as the head of
  // the card it belongs to. Drawn once, around both, it is one card.
  const frame = frameOf(id);
  expect(frame.style.border).toMatch(/^1px solid /);
  expect(frame.style.borderRadius).not.toBe('');
  // Nothing can spill past the corners the frame rounds.
  expect(frame).toHaveStyle({ overflow: 'hidden' });

  // And the band no longer paints a surface of its own over the one it is on:
  // two backgrounds meeting at the header's edge is the seam this removes.
  expect(screen.getByTestId(`widget-header-${id}`).style.backgroundColor).toBe(
    '',
  );
});

test('a leaf widget no longer frames itself, so there is one border and not two', () => {
  const { id } = withBlock();

  const leaf = screen.getByTestId(`widget-content-${id}`)
    .firstElementChild as HTMLElement;
  expect(leaf.style.border).toBe('');
  expect(leaf.style.borderRadius).toBe('');
  expect(leaf.style.backgroundColor).toBe('');
});

test('the header takes its height out of the widget, not out of the canvas', () => {
  const { rootId, id } = withBlock();

  // A leaf widget resolves `height: 100%` against this box — a chart measures
  // the result to size its canvas — so the band above it has to come out of
  // the height rather than be added to it, or every widget overflows its cell
  // by exactly the header.
  expect(screen.getByTestId(`widget-content-${id}`).style.height).toMatch(
    /^calc\(100% - \d+px\)$/,
  );
  // The root has no header to subtract.
  render(<WidgetView nodeId={rootId} />);
  expect(screen.getByTestId(`widget-content-${rootId}`)).toHaveStyle({
    height: '100%',
  });
});
