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
    screen.getByRole('tab', { name: 'Building blocks' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Properties' })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Outline' })).toBeInTheDocument();
});

test('building blocks is what you start on, and it lists what is registered', () => {
  mount();

  // The list is `views.getViews('dashboard.buildingBlocks')` — the same
  // registry BuildingBlockView resolves a renderer through. Nothing here
  // names a block, so registering one makes it placeable with no edit.
  expect(screen.getByTestId('palette')).toBeVisible();
  expect(screen.getByTestId('palette-markdown')).toBeVisible();
  expect(screen.getByTestId('palette-echarts')).toBeVisible();
});

test('a canvas is shelved as structure and everything else as content', () => {
  mount();

  // The one distinction this fork records: whether placing the type produces
  // something other blocks can go inside.
  expect(screen.getByTestId('palette-shelf-structure')).toContainElement(
    screen.getByTestId('palette-canvas'),
  );
  expect(screen.getByTestId('palette-shelf-content')).toContainElement(
    screen.getByTestId('palette-markdown'),
  );
});

test('clicking a block asks the page to place it', async () => {
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

test('with nothing selected, properties says so rather than showing a stale block', async () => {
  mount();

  await userEvent.click(screen.getByRole('tab', { name: 'Properties' }));

  expect(screen.getByTestId('inspector-empty')).toBeVisible();
});

test('selecting something brings its properties forward', () => {
  mount();
  const id = provider.addBuildingBlock(provider.getRoot().id, 0, {
    type: 'markdown',
  });

  act(() => provider.setSelection(id));

  // A selection is the moment you want to configure the thing selected, so
  // the panel follows rather than making the author find the tab.
  expect(screen.getByTestId('inspector-identity')).toHaveTextContent(id);
});

test('the outline lists the dashboard and selects what you click', async () => {
  mount();
  const id = provider.addBuildingBlock(provider.getRoot().id, 0, {
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
  const id = provider.addBuildingBlock(provider.getRoot().id, 0, {
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

test('the panel opens wide enough to edit a block in', () => {
  mount();

  expect(widthOf()).toBe(500);
});

test('the handle resizes from the keyboard, so a drag is not the only way', () => {
  mount();
  const handle = screen.getByTestId('panel-resize');
  handle.focus();

  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(widthOf()).toBe(516);

  fireEvent.keyDown(handle, { key: 'End' });
  expect(widthOf()).toBe(800);

  fireEvent.keyDown(handle, { key: 'Home' });
  expect(widthOf()).toBe(280);
});

test('the handle reports the width it actually has', () => {
  mount();

  // What a screen reader announces has to be the width on screen, or the
  // control is lying about the only thing it does.
  expect(screen.getByTestId('panel-resize')).toHaveAttribute(
    'aria-valuenow',
    '500',
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
    'application/x-dashboard-building-block',
    'markdown',
  );
});
