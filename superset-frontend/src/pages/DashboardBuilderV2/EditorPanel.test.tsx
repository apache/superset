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
import 'src/core/dashboard';
import EditorPanel from './EditorPanel';

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
});

const mount = () => {
  const onAdd = jest.fn();
  render(<EditorPanel onAdd={onAdd} />);
  return onAdd;
};

test('the panel offers building blocks, properties and an outline', () => {
  mount();

  expect(
    screen.getByRole('tab', { name: 'Building Blocks' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Properties' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Outline' })).toBeInTheDocument();
});

test('building blocks comes first, ahead of properties and outline', () => {
  mount();

  const labels = screen.getAllByRole('tab').map(tab => tab.textContent);
  expect(labels).toEqual(['Building Blocks', 'Properties', 'Outline']);
});

test('widgets is what you start on, and it lists what is registered', () => {
  mount();

  // The list is `views.getViews('dashboard.widgets')` — the same
  // registry WidgetView resolves a renderer through. Nothing here
  // names a widget, so registering one makes it placeable with no edit.
  expect(screen.getByTestId('palette')).toBeVisible();
  expect(screen.getByTestId('palette-markdown')).toBeVisible();
  expect(screen.getByTestId('palette-echarts')).toBeVisible();
});

test('the root grid is not offered in the palette, since nesting one is not an authored feature', () => {
  mount();

  // The root's own type is resolved directly by `WidgetView`, never
  // through the `dashboard.widgets` registry this palette lists from
  // (see `registerBuiltInWidgets`) — so there is nothing registered
  // under either name to ever show up here in the first place.
  expect(screen.queryByTestId('palette-canvas')).not.toBeInTheDocument();
  expect(screen.queryByTestId('palette-grid')).not.toBeInTheDocument();
  // The structure shelf still renders — it holds the genuine containers
  // (tabs/collapsible/carousel), which the root is not one of.
  expect(screen.getByTestId('palette-shelf-structure')).toBeInTheDocument();
});

test('clicking a widget asks the page to place it', async () => {
  const onAdd = mount();

  await userEvent.click(screen.getByTestId('palette-markdown'));

  expect(onAdd).toHaveBeenCalledWith('markdown');
});

test('searching narrows the palette to what was asked for', async () => {
  mount();

  await userEvent.type(screen.getByTestId('palette-search'), 'markdown');

  expect(screen.getByTestId('palette-markdown')).toBeVisible();
  expect(screen.queryByTestId('palette-echarts')).not.toBeInTheDocument();
});

test('with nothing selected, properties says so rather than showing a stale widget', async () => {
  mount();

  await userEvent.click(screen.getByRole('tab', { name: 'Properties' }));

  expect(screen.getByTestId('inspector-empty')).toBeVisible();
});

test('selecting something brings its properties forward', () => {
  mount();
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type: 'markdown',
  });

  act(() => provider.setSelection(id));

  // A selection is the moment you want to configure the thing selected, so
  // the panel follows rather than making the author find the tab.
  expect(screen.getByTestId('inspector-identity')).toHaveTextContent(id);
});

test('the outline lists the dashboard and selects what you click', async () => {
  mount();
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type: 'markdown',
    props: { content: 'Quarterly review' },
  });

  await userEvent.click(screen.getByRole('tab', { name: 'Outline' }));

  // Markdown is labelled by its content: five rows all reading "Markdown"
  // identify nothing.
  expect(screen.getByTestId(`outline-row-${id}`)).toHaveTextContent(
    'Quarterly review',
  );

  await userEvent.click(screen.getByTestId(`outline-row-${id}`));
  expect(provider.getSelection()).toBe(id);
});

test('choosing a row in the outline leaves you in the outline', async () => {
  mount();
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type: 'markdown',
  });
  await userEvent.click(screen.getByRole('tab', { name: 'Outline' }));

  await userEvent.click(screen.getByTestId(`outline-row-${id}`));

  // Reading a structure means going through it. A tab that ejected to
  // Properties on the first row would hide the very row it just marked as
  // selected.
  expect(screen.getByTestId(`outline-row-${id}`)).toBeVisible();
  expect(screen.getByRole('tab', { name: 'Outline' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the list of tabs says what it is a list of', () => {
  mount();

  expect(
    screen.getByRole('tablist', { name: 'Editor panel views' }),
  ).toBeInTheDocument();
});

/**
 * The panel's width belongs to whoever is authoring. A property form is the
 * widest thing here, and only the author knows how much canvas they are
 * willing to spend on it.
 */
const widthOf = () =>
  Number.parseInt(screen.getByTestId('editor-panel').style.width, 10);

test('the panel opens wide enough to edit a widget in', () => {
  mount();

  expect(widthOf()).toBe(400);
});

test('the handle resizes from the keyboard, so a drag is not the only way', () => {
  mount();
  const handle = screen.getByTestId('panel-resize');
  handle.focus();

  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(widthOf()).toBe(416);

  fireEvent.keyDown(handle, { key: 'End' });
  expect(widthOf()).toBe(800);

  fireEvent.keyDown(handle, { key: 'Home' });
  expect(widthOf()).toBe(320);
});

test('a wide control in a tab scrolls the page, not the rail sideways', () => {
  mount();

  // `allowOverflow={false}` asks the tab body to scroll vertically; left at
  // Tabs's own default it scrolls both axes, and a control sized for the
  // wider modal it was written for (see DashboardProperties) would then hand
  // the whole rail a sideways scrollbar too.
  const body = document.querySelector('.ant-tabs-body-holder') as HTMLElement;
  expect(body).toHaveStyle({ overflowX: 'hidden' });
});

test('the handle reports the width it actually has', () => {
  mount();

  // What a screen reader announces has to be the width on screen, or the
  // control is lying about the only thing it does.
  expect(screen.getByTestId('panel-resize')).toHaveAttribute(
    'aria-valuenow',
    '400',
  );
});

test('the search field is set in from the panel edge and down from the tabs', () => {
  mount();

  // Flush against both, it reads as chrome around the list rather than the
  // way into it.
  expect(screen.getByTestId('palette')).toHaveStyle('padding-top: 12px');
});

test('a palette row can actually be dragged, as its grip promises', () => {
  mount();
  const row = screen.getByTestId('palette-markdown');
  const setData = jest.fn();

  // The grip beside the label promised a drag the row did not carry.
  expect(row).toHaveAttribute('draggable', 'true');
  row.dispatchEvent(
    Object.assign(new Event('dragstart', { bubbles: true }), {
      dataTransfer: { setData, effectAllowed: '' },
    }),
  );

  expect(setData).toHaveBeenCalledWith(
    'application/x-dashboard-widget',
    'markdown',
  );
});

test('the panel can be got out of the way, and brought back', async () => {
  mount();

  // The canvas is the work; this rail is how you act on it, and an author
  // reading a dashboard at full width wants it gone without losing where
  // they were in it.
  await userEvent.click(screen.getByTestId('panel-collapse'));

  expect(screen.queryByRole('tab', { name: 'Building Blocks' })).toBeNull();
  expect(screen.getByTestId('panel-expand')).toBeInTheDocument();

  await userEvent.click(screen.getByTestId('panel-expand'));

  expect(
    screen.getByRole('tab', { name: 'Building Blocks' }),
  ).toBeInTheDocument();
});

test('a closed panel keeps the width it was opened at', async () => {
  mount();
  const grip = screen.getByTestId('panel-resize');
  grip.focus();
  fireEvent.keyDown(grip, { key: 'End' });

  await userEvent.click(screen.getByTestId('panel-collapse'));
  await userEvent.click(screen.getByTestId('panel-expand'));

  // Closing is not resizing. A panel that reopened at the default would
  // silently discard a width the author had already chosen.
  expect(screen.getByTestId('editor-panel')).toHaveStyle('width: 800px');
});

test('a closed panel offers no edge to drag', async () => {
  mount();

  await userEvent.click(screen.getByTestId('panel-collapse'));

  // There is nothing to size: the strip is exactly as wide as the one
  // control on it, and dragging it wider would be a third state.
  expect(screen.queryByTestId('panel-resize')).toBeNull();
});
