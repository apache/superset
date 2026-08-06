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
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import 'src/core/dashboard';
import Inspector from './Inspector';

const provider = DashboardProvider.getInstance();

beforeEach(() => {
  provider.reset();
});

const select = (type: string, props?: Record<string, unknown>) => {
  const id = provider.addBuildingBlock(provider.getRoot().id, 0, {
    type,
    ...(props ? { props } : {}),
  });
  provider.setSelection(id);
  render(<Inspector />);
  return id;
};

test('a markdown block placed a moment ago can still be given content', async () => {
  // The block arrives with no props at all. Waiting for a `content` key to
  // exist before offering the field is what left a fresh block with no way
  // to be given one.
  const id = select('markdown');

  await userEvent.type(
    screen.getByTestId('inspector-content'),
    'Quarterly review',
  );
  await userEvent.tab();

  expect(provider.getNode(id)?.props?.content).toBe('Quarterly review');
});

test('content a block already has is what the field shows', () => {
  select('markdown', { content: 'Welcome' });

  expect(screen.getByTestId('inspector-content')).toHaveValue('Welcome');
});

test('a block with no prose field is still authorable through its properties', () => {
  select('echarts');

  // A chart's dataBinding and echartsOptions have never had a hand-editing
  // path. They are just keys, and the general editor reaches every one.
  expect(screen.queryByTestId('inspector-content')).not.toBeInTheDocument();
  expect(screen.getByTestId('inspector-props')).toBeInTheDocument();
});

test('applying properties writes them to the block', async () => {
  const id = select('echarts');

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{"dataBinding":{"datasetId":3,"metrics":["count"]}}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));

  expect(provider.getNode(id)?.props?.dataBinding).toEqual({
    datasetId: 3,
    metrics: ['count'],
  });
});

test('a key deleted from the properties stops reaching the block', async () => {
  const id = select('echarts', { keep: 1, drop: 2 });

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{"keep":1}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));

  // `updateProps` merges, so omitting a key would silently do nothing and
  // the block would go on rendering from the value it appeared to lose.
  // Sending `undefined` is as close to a removal as a merge can express: the
  // block reads nothing there, and the key does not survive serialization
  // back into the editor.
  expect(provider.getNode(id)?.props?.drop).toBeUndefined();
  expect(provider.getNode(id)?.props?.keep).toBe(1);
  expect(screen.getByTestId('inspector-props')).toHaveValue(
    JSON.stringify({ keep: 1 }, null, 2),
  );
});

test('malformed properties cannot be applied, and stay on screen to be fixed', () => {
  const id = select('echarts', { kept: true });

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{ "broken": ' },
  });

  expect(screen.getByTestId('inspector-props-apply')).toBeDisabled();
  expect(screen.getByTestId('inspector-props-error')).toBeInTheDocument();
  // The draft is the author's; it is not reverted out from under them.
  expect(screen.getByTestId('inspector-props')).toHaveValue('{ "broken": ');
  expect(provider.getNode(id)?.props?.kept).toBe(true);
});

test('properties that are not an object are refused', () => {
  select('echarts');

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '[1, 2, 3]' },
  });

  expect(screen.getByTestId('inspector-props-apply')).toBeDisabled();
});

/** Brings the generated form forward; the panel opens on the JSON half. */
const openForm = async () => {
  await userEvent.click(screen.getByRole('tab', { name: 'Form' }));
  return screen.findByTestId('inspector-props-form');
};

test('properties can be edited as a form or as JSON, whichever suits', async () => {
  select('echarts', { title: 'Revenue' });

  // Two views of one set of values, not two places a value can live. JSON is
  // where the shape is changed — a key added or dropped — and the form is
  // where the values in that shape are filled in. JSON is what it opens on:
  // a block placed a moment ago has no properties, and so no fields.
  expect(screen.getByRole('tab', { name: 'JSON' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  expect(screen.getByTestId('inspector-props')).toBeInTheDocument();

  await openForm();

  expect(screen.getByRole('tab', { name: 'Form' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('the form is built from the properties the block is actually holding', async () => {
  select('echarts', { title: 'Revenue', limit: 10 });

  const form = await openForm();

  // No block type is named anywhere in this panel, so a contributed block
  // gets a form on the same terms a built-in one does.
  expect(form).toHaveTextContent('Title');
  expect(form).toHaveTextContent('Limit');
  expect(screen.getByDisplayValue('Revenue')).toBeInTheDocument();
});

test('a value typed into the form reaches the block', async () => {
  const id = select('echarts', { title: 'Revenue' });
  await openForm();

  await userEvent.clear(screen.getByDisplayValue('Revenue'));
  await userEvent.type(screen.getByRole('textbox'), 'Quarterly revenue');

  // Awaited because JsonForms debounces what it reports by 10ms — which is
  // also why this writes on change rather than on blur: a commit on blur
  // fires before that debounce lands and would save the value as it stood a
  // keystroke earlier.
  await waitFor(() =>
    expect(provider.getNode(id)?.props?.title).toBe('Quarterly revenue'),
  );
});

test('each half of the properties editor is set down from the tabs above it', async () => {
  select('echarts', { title: 'Revenue' });

  // Flush against the tab bar, whichever label comes first reads as a caption
  // on the tabs rather than as the head of the field under it — the same set
  // down the panel and the palette already take from theirs.
  expect(screen.getByTestId('inspector-props-json')).toHaveStyle(
    'padding-top: 12px',
  );
  expect((await openForm()).parentElement).toHaveStyle('padding-top: 12px');
});

test('a block with no properties yet says where they are added', async () => {
  select('echarts');

  // A form generated from values cannot offer a field for a key nothing has
  // written. Rendering nothing at all would read as a broken tab.
  const form = await openForm();

  expect(form).toHaveTextContent('JSON');
});

test('reverting restores what the block still has', async () => {
  select('echarts', { kept: true });

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-revert'));

  expect(screen.getByTestId('inspector-props')).toHaveValue(
    JSON.stringify({ kept: true }, null, 2),
  );
});

test('the panel is set down from the tabs above it', () => {
  select('markdown');

  // Flush against the tab bar, the first line reads as a caption belonging
  // to the tabs rather than to the block it names.
  expect(screen.getByTestId('inspector')).toHaveStyle('padding-top: 12px');
});

test('the empty state is set down too', () => {
  render(<Inspector />);

  expect(screen.getByTestId('inspector-empty')).toHaveStyle(
    'padding-top: 12px',
  );
});

/**
 * Places two blocks in a free canvas and selects the one drawn underneath.
 *
 * A free canvas paints its children in the order it holds them, so the first
 * child is the one nothing can be put in front of by any other means.
 */
const selectInFreeCanvas = (which: 'first' | 'second') => {
  const rootId = provider.getRoot().id;
  provider.updateLayout(rootId, { mode: 'free' });
  const first = provider.addBuildingBlock(rootId, 0, { type: 'markdown' });
  const second = provider.addBuildingBlock(rootId, 1, { type: 'markdown' });
  provider.setSelection(which === 'first' ? first : second);
  render(<Inspector />);
  return { rootId, first, second };
};

test('a block under another in a free canvas can be brought to the front', async () => {
  const { first, second } = selectInFreeCanvas('first');

  await userEvent.click(screen.getByTestId('inspector-bring-to-front'));

  expect(provider.getRoot().children).toEqual([second, first]);
});

test('bringing a block to the front leaves it where the author put it', async () => {
  const { first } = selectInFreeCanvas('first');
  provider.updateLayout(first, { col: 5, row: 4 });

  await userEvent.click(screen.getByTestId('inspector-bring-to-front'));

  expect(provider.getNode(first)?.layout).toMatchObject({ col: 5, row: 4 });
});

test('a block over another in a free canvas can be sent to the back', async () => {
  const { first, second } = selectInFreeCanvas('second');

  await userEvent.click(screen.getByTestId('inspector-send-to-back'));

  expect(provider.getRoot().children).toEqual([second, first]);
});

const selectRoot = () => {
  const rootId = provider.getRoot().id;
  provider.setSelection(rootId);
  render(<Inspector />);
  return rootId;
};

test('the root is where the dashboard is arranged, now that the header does not ask', () => {
  selectRoot();

  expect(screen.getByTestId('layout-mode-switcher')).toBeInTheDocument();
});

test('selecting the dashboard offers the properties the dashboard has', () => {
  selectRoot();

  // The six the saved dashboard's own properties modal asks for, reused
  // whole — this panel and that modal are two ways into one set of fields.
  expect(screen.getByTestId('dashboard-properties')).toBeInTheDocument();
  [
    'General information',
    'Access & ownership',
    'Styling',
    'Refresh settings',
    'Certification',
    'Advanced settings',
  ].forEach(section => expect(screen.getByText(section)).toBeInTheDocument());
});

test('the dashboard is not a block, so it is not placed and cannot be deleted', () => {
  selectRoot();

  // `removeBuildingBlock` refuses the root outright, so a Delete there is a
  // control that only ever raises; and the root is placed by nothing, so it
  // has no column or row of its own to start at.
  expect(screen.queryByTestId('inspector-delete')).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('inspector-section-placement'),
  ).not.toBeInTheDocument();
  expect(screen.queryByTestId('inspector-identity')).not.toBeInTheDocument();
});

test('the panel counts what is on the dashboard', () => {
  const rootId = provider.getRoot().id;
  const section = provider.addBuildingBlock(rootId, 0, { type: 'canvas' });
  provider.addBuildingBlock(section, 0, { type: 'markdown' });
  provider.addBuildingBlock(rootId, 1, { type: 'markdown' });
  selectRoot();

  // Every block, at any depth — a section and what is inside it are both
  // things on the dashboard.
  expect(screen.getByTestId('dashboard-properties-counts')).toHaveTextContent(
    '3 blocks, 0 filters',
  );
});

test('stacking is not offered in a grid canvas, where nothing overlaps', () => {
  const rootId = provider.getRoot().id;
  provider.addBuildingBlock(rootId, 0, { type: 'markdown' });
  const second = provider.addBuildingBlock(rootId, 1, { type: 'markdown' });
  provider.setSelection(second);
  render(<Inspector />);

  expect(
    screen.queryByTestId('inspector-bring-to-front'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('inspector-send-to-back'),
  ).not.toBeInTheDocument();
});

/** Places a child inside a canvas laid out in `mode`, and selects one of them. */
const selectChildOfCanvasIn = (mode: 'grid' | 'flex') => {
  const rootId = provider.getRoot().id;
  provider.updateLayout(rootId, { mode });
  const childId = provider.addBuildingBlock(rootId, 0, { type: 'markdown' });
  provider.setSelection(childId);
  render(<Inspector />);
  return childId;
};

test('a flex child is not asked where it starts, because a flex line has no cells', () => {
  selectChildOfCanvasIn('flex');

  // `col`/`row` are grid coordinates. A flex container lays its children out
  // in `children` order and reads neither, so offering them is offering a
  // field that silently does nothing.
  expect(screen.queryByTestId('inspector-col')).not.toBeInTheDocument();
  expect(screen.queryByTestId('inspector-row')).not.toBeInTheDocument();

  // Its share of the line and its height are read in every mode.
  expect(screen.getByTestId('inspector-colSpan')).toBeInTheDocument();
  expect(screen.getByTestId('inspector-rowSpan')).toBeInTheDocument();
});

test('a grid child is still asked where it starts', () => {
  selectChildOfCanvasIn('grid');

  expect(screen.getByTestId('inspector-col')).toBeInTheDocument();
  expect(screen.getByTestId('inspector-row')).toBeInTheDocument();
});

test('a flex container is asked the things only a flex line has', () => {
  const rootId = provider.getRoot().id;
  provider.updateLayout(rootId, { mode: 'flex' });
  provider.setSelection(rootId);
  render(<Inspector />);

  // Documented on LayoutProps as "flex only. Ignored in every other mode" —
  // and until now unreachable from the panel at all, so a flex canvas could
  // be chosen and then not actually arranged.
  ['direction', 'wrap', 'justify', 'align'].forEach(key =>
    expect(screen.getByTestId(`inspector-${key}`)).toBeInTheDocument(),
  );
});

test('a grid container is not asked about flow, which it does not read', () => {
  const rootId = provider.getRoot().id;
  provider.setSelection(rootId);
  render(<Inspector />);

  ['direction', 'wrap', 'justify', 'align'].forEach(key =>
    expect(screen.queryByTestId(`inspector-${key}`)).not.toBeInTheDocument(),
  );
  // What every mode does read stays put.
  ['columns', 'gap', 'rowUnit'].forEach(key =>
    expect(screen.getByTestId(`inspector-${key}`)).toBeInTheDocument(),
  );
});
