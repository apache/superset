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
import { SupersetClient } from '@superset-ui/core';
import DashboardProvider from 'src/core/dashboard/DashboardProvider';
import 'src/core/dashboard';
import Inspector from './Inspector';
import { resetSchemaControlledWidgetTypesForTests } from './schemaControlledWidgets';

const provider = DashboardProvider.getInstance();

// The Inspector derives which widget types get the schema-driven panel from
// `/api/v1/widgets/types`; these tests use markdown/tabs (not in the list), so
// they render the generic PropsForm. Stub the fetch so the decision is
// deterministic and offline.
jest.spyOn(SupersetClient, 'get').mockResolvedValue({
  json: {
    result: [
      { id: 'balloons' },
      { id: 'metric-tile' },
      { id: 'ag-grid-table' },
    ],
  },
} as never);

// A minimal backend schema for `metric-tile` (schema-controlled), so tests
// below can exercise the validated form/JSON commit path without pulling in
// the full real control model. `mockPost` routes `/control-schema` and
// `/validate` calls separately, the same split `SchemaControlPanel.test.tsx`
// uses, since both now round-trip through this panel on an edit.
const METRIC_TILE_SCHEMA = {
  type: 'object',
  properties: {
    prefix: { type: 'string', title: 'Prefix' },
  },
};

const postSpy = jest.spyOn(SupersetClient, 'post');
const mockPost = (
  controlSchemaResult: unknown = METRIC_TILE_SCHEMA,
  validateErrors: unknown[] = [],
) => {
  postSpy.mockImplementation(({ endpoint }: { endpoint: string }) => {
    if (endpoint.endsWith('/validate')) {
      return Promise.resolve({
        json: { result: { errors: validateErrors } },
      } as never);
    }
    return Promise.resolve({
      json: { result: controlSchemaResult },
    } as never);
  });
};

beforeEach(() => {
  provider.reset();
  resetSchemaControlledWidgetTypesForTests();
  postSpy.mockReset();
  mockPost();
});

/**
 * Brings the JSON half forward. The panel opens on the form, so every test
 * that reads the raw record has to say so — which is also the assertion that
 * the form is what comes first.
 */
const openJson = async () => {
  await userEvent.click(screen.getByRole('tab', { name: 'JSON' }));
  return screen.findByTestId('inspector-props');
};

const select = (type: string, props?: Record<string, unknown>) => {
  const id = provider.addWidget(provider.getRoot().id, 0, {
    type,
    ...(props ? { props } : {}),
  });
  provider.setSelection(id);
  render(<Inspector />);
  return id;
};

test('a markdown widget placed a moment ago can still be given content', async () => {
  // The widget arrives with no props at all. Waiting for a `content` key to
  // exist before offering the field is what left a fresh widget with no way
  // to be given one.
  const id = select('markdown');

  await userEvent.type(
    screen.getByTestId('inspector-content'),
    'Quarterly review',
  );
  await userEvent.tab();

  expect(provider.getNode(id)?.props?.content).toBe('Quarterly review');
});

test('content a widget already has is what the field shows', () => {
  select('markdown', { content: 'Welcome' });

  expect(screen.getByTestId('inspector-content')).toHaveValue('Welcome');
});

test('a widget with no prose field is still authorable through its properties', async () => {
  select('echarts');

  // A chart's dataBinding and echartsOptions have never had a hand-editing
  // path. They are just keys, and the general editor reaches every one.
  expect(screen.queryByTestId('inspector-content')).not.toBeInTheDocument();
  expect(await openJson()).toBeInTheDocument();
});

test('applying properties writes them to the widget', async () => {
  const id = select('echarts');
  await openJson();

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{"dataBinding":{"datasetId":3,"metrics":["count"]}}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));

  // Apply now always round-trips through `commitWidgetProps` (see the 404
  // fallback tests below), so even a widget type with no backend schema
  // commits asynchronously — this can no longer assert immediately after
  // the click.
  await waitFor(() =>
    expect(provider.getNode(id)?.props?.dataBinding).toEqual({
      datasetId: 3,
      metrics: ['count'],
    }),
  );
});

test('a key deleted from the properties stops reaching the widget', async () => {
  const id = select('echarts', { keep: 1, drop: 2 });
  await openJson();

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{"keep":1}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));

  // `updateProps` merges, so omitting a key would silently do nothing and
  // the widget would go on rendering from the value it appeared to lose.
  // Sending `undefined` is as close to a removal as a merge can express: the
  // widget reads nothing there, and the key does not survive serialization
  // back into the editor. Apply is asynchronous (see the comment on the
  // previous test), so this waits for the commit to actually land.
  await waitFor(() =>
    expect(provider.getNode(id)?.props?.drop).toBeUndefined(),
  );
  expect(provider.getNode(id)?.props?.keep).toBe(1);
  expect(screen.getByTestId('inspector-props')).toHaveValue(
    JSON.stringify({ keep: 1 }, null, 2),
  );
});

test('malformed properties cannot be applied, and stay on screen to be fixed', async () => {
  const id = select('echarts', { kept: true });
  await openJson();

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{ "broken": ' },
  });

  expect(screen.getByTestId('inspector-props-apply')).toBeDisabled();
  expect(screen.getByTestId('inspector-props-error')).toBeInTheDocument();
  // The draft is the author's; it is not reverted out from under them.
  expect(screen.getByTestId('inspector-props')).toHaveValue('{ "broken": ');
  expect(provider.getNode(id)?.props?.kept).toBe(true);
});

test('properties that are not an object are refused', async () => {
  select('echarts');
  await openJson();

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '[1, 2, 3]' },
  });

  expect(screen.getByTestId('inspector-props-apply')).toBeDisabled();
});

/** The form is what the panel opens on, so this only has to find it. */
const openForm = async () => screen.findByTestId('inspector-props-form');

test('properties can be edited as a form or as JSON, whichever suits', async () => {
  select('echarts', { title: 'Revenue' });

  // Two views of one set of values, not two places a value can live. The
  // form is where the values are filled in and is what the panel opens on;
  // JSON is where the shape is changed, since it alone can add or drop a key.
  expect(screen.getByRole('tab', { name: 'Form' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await openForm();

  expect(await openJson()).toBeInTheDocument();
});

test('the form is built from the properties the widget is actually holding', async () => {
  select('echarts', { title: 'Revenue', limit: 10 });

  const form = await openForm();

  // No widget type is named anywhere in this panel, so a contributed widget
  // gets a form on the same terms a built-in one does.
  expect(form).toHaveTextContent('Title');
  expect(form).toHaveTextContent('Limit');
  expect(screen.getByDisplayValue('Revenue')).toBeInTheDocument();
});

test('a value typed into the form reaches the widget', async () => {
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
  expect((await openForm()).parentElement).toHaveStyle('padding-top: 12px');
  await openJson();
  expect(screen.getByTestId('inspector-props-json')).toHaveStyle(
    'padding-top: 12px',
  );
});

test('the properties on screen can be taken away as JSON', async () => {
  const writeText = jest.fn();
  const original = global.navigator.clipboard;
  // @ts-expect-error jsdom ships no clipboard to spy on
  global.navigator.clipboard = { write: writeText, writeText };
  select('echarts', { title: 'Revenue' });
  await openJson();

  // What is copied is what is on screen, not what the widget holds — an edit
  // typed but not applied yet is the state most worth being able to take
  // somewhere else.
  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{"title":"Quarterly"}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-copy'));

  expect(writeText).toHaveBeenCalledWith('{"title":"Quarterly"}');
  // @ts-expect-error restoring what jsdom did not have
  global.navigator.clipboard = original;
});

test("the dashboard-wide properties are the dashboard's alone", async () => {
  select('echarts', { title: 'Revenue' });

  // What a dashboard is called, who may see it and how often it refreshes are
  // properties of the dashboard, not of anything placed on it — a widget asked
  // for a URL slug would be asking for something it has no such thing as.
  expect(screen.queryByTestId('dashboard-properties')).not.toBeInTheDocument();
  [
    'General information',
    'Access & ownership',
    'Styling',
    'Refresh settings',
    'Certification',
    'Advanced settings',
  ].forEach(section =>
    expect(screen.queryByText(section)).not.toBeInTheDocument(),
  );
  // And what a widget does have stays where it is.
  expect(await openForm()).toBeInTheDocument();
});

test('a widget with no properties yet says where they are added', async () => {
  select('echarts');

  // A form generated from values cannot offer a field for a key nothing has
  // written. Rendering nothing at all would read as a broken tab.
  const form = await openForm();

  expect(form).toHaveTextContent('JSON');
});

test('the Text editor owns content, so the form does not repeat it', async () => {
  select('markdown', { content: 'Welcome' });

  // The dedicated Text editor shows the prose.
  expect(screen.getByTestId('inspector-content')).toHaveValue('Welcome');
  // The generic form must not offer `content` again as a single-line input
  // mirroring that textarea — with content its only prop, it has nothing left.
  const form = await openForm();
  expect(form).toHaveTextContent('no properties yet');
  // The JSON tab still shows the whole record, content included.
  expect(await openJson()).toHaveValue(
    JSON.stringify({ content: 'Welcome' }, null, 2),
  );
});

test('reverting restores what the widget still has', async () => {
  select('echarts', { kept: true });
  await openJson();

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
  // to the tabs rather than to the widget it names.
  expect(screen.getByTestId('inspector')).toHaveStyle('padding-top: 12px');
});

test('the empty state is set down too', () => {
  render(<Inspector />);

  expect(screen.getByTestId('inspector-empty')).toHaveStyle(
    'padding-top: 12px',
  );
});

const selectRoot = () => {
  const rootId = provider.getRoot().id;
  provider.setSelection(rootId);
  render(<Inspector />);
  return rootId;
};

test('the root does not offer a layout mode switch from the panel', () => {
  selectRoot();

  expect(screen.queryByTestId('layout-mode-switcher')).not.toBeInTheDocument();
  expect(
    screen.queryByTestId('inspector-section-arrangement'),
  ).not.toBeInTheDocument();
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

test('the dashboard is not a widget, so it has no identity of its own', () => {
  selectRoot();

  expect(screen.queryByTestId('inspector-identity')).not.toBeInTheDocument();
});

test('the panel counts what is on the dashboard', () => {
  const rootId = provider.getRoot().id;
  const section = provider.addWidget(rootId, 0, { type: 'tabs' });
  provider.addWidget(section, 0, { type: 'markdown' });
  provider.addWidget(rootId, 1, { type: 'markdown' });
  selectRoot();

  // Every widget, at any depth — a section and what is inside it are both
  // things on the dashboard.
  expect(screen.getByTestId('dashboard-properties-counts')).toHaveTextContent(
    '3 widgets, 0 filters',
  );
});

test('a container is not offered any arrangement fields from the panel', () => {
  selectRoot();

  [
    'direction',
    'wrap',
    'justify',
    'align',
    'columns',
    'gap',
    'rowUnit',
  ].forEach(key =>
    expect(screen.queryByTestId(`inspector-${key}`)).not.toBeInTheDocument(),
  );
});

// A schema-controlled widget type (`metric-tile`) round-trips every edit —
// form or JSON — through the backend `/validate` endpoint before committing
// (see `controlValueValidation.ts`). These tests exercise that path
// end-to-end through the Inspector, the way `SchemaControlPanel.test.tsx`
// exercises the Form tab alone.
test('a form edit updates both node.props and the JSON representation', async () => {
  const id = select('metric-tile', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    prefix: '',
  });

  await userEvent.type(await screen.findByRole('textbox'), '$');
  await waitFor(() => expect(provider.getNode(id)?.props?.prefix).toBe('$'));

  const jsonTextarea = (await openJson()) as HTMLTextAreaElement;
  expect(JSON.parse(jsonTextarea.value)).toEqual({
    dataBinding: { datasetId: 1, metrics: ['count'] },
    prefix: '$',
  });
});

test('a valid JSON edit updates node.props and the form controls', async () => {
  const id = select('metric-tile', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    prefix: '',
  });
  await openJson();

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: {
      value: JSON.stringify({
        dataBinding: { datasetId: 1, metrics: ['count'] },
        prefix: '€',
      }),
    },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));
  await waitFor(() => expect(provider.getNode(id)?.props?.prefix).toBe('€'));

  await userEvent.click(screen.getByRole('tab', { name: 'Form' }));
  expect(await screen.findByRole('textbox')).toHaveValue('€');
});

test('malformed JSON on a schema-controlled widget cannot be applied and leaves node.props untouched', async () => {
  const id = select('metric-tile', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    prefix: 'kept',
  });
  await openJson();

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{ "broken": ' },
  });

  expect(screen.getByTestId('inspector-props-apply')).toBeDisabled();
  expect(provider.getNode(id)?.props?.prefix).toBe('kept');
});

test('a JSON edit rejected by backend validation leaves node.props unchanged and surfaces the error', async () => {
  const id = select('metric-tile', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    prefix: 'kept',
  });
  await openJson();
  mockPost(METRIC_TILE_SCHEMA, [{ loc: ['prefix'], message: 'Too long' }]);

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: {
      value: JSON.stringify({
        dataBinding: { datasetId: 1, metrics: ['count'] },
        prefix: 'way too long',
      }),
    },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));

  expect(
    await screen.findByTestId('inspector-props-validation-error'),
  ).toHaveTextContent('Too long');
  // Rejected atomically: the stored node — and the draft, which was never
  // reverted — are exactly what they were before Apply.
  expect(provider.getNode(id)?.props?.prefix).toBe('kept');
});

test('switching between Form and JSON tabs does not reset already-accepted values', async () => {
  const id = select('metric-tile', {
    dataBinding: { datasetId: 1, metrics: ['count'] },
    prefix: 'kept',
  });

  await openJson();
  await userEvent.click(screen.getByRole('tab', { name: 'Form' }));

  expect(await screen.findByRole('textbox')).toHaveValue('kept');
  expect(provider.getNode(id)?.props?.prefix).toBe('kept');
});

test('a widget type the backend confirms has no schema (a 404 from /validate) keeps committing JSON edits without a validation gate', async () => {
  // The JSON editor always attempts `/validate` first — the Inspector's own
  // `useSchemaControlledWidgetTypes` cache is `null` while loading and empty
  // on a fetch failure, so gating on it (rather than on the backend's own
  // 404) would silently skip validation for a widget that does have a
  // schema, for as long as that list hasn't resolved.
  const id = select('echarts', { title: 'Revenue' });
  await openJson();
  postSpy.mockImplementation(({ endpoint }: { endpoint: string }) =>
    endpoint.endsWith('/validate')
      ? Promise.reject(new Response(null, { status: 404 }))
      : Promise.resolve({ json: { result: METRIC_TILE_SCHEMA } } as never),
  );

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{"title":"Quarterly"}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));

  await waitFor(() =>
    expect(provider.getNode(id)?.props?.title).toBe('Quarterly'),
  );
  expect(postSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      endpoint: expect.stringContaining('/validate'),
    }),
  );
});

test('a non-404 failure from /validate leaves node.props unchanged and surfaces the error, even for a widget type the cached list has not resolved for', async () => {
  const id = select('echarts', { title: 'Revenue' });
  await openJson();
  postSpy.mockImplementation(({ endpoint }: { endpoint: string }) =>
    endpoint.endsWith('/validate')
      ? Promise.reject(new Error('network error'))
      : Promise.resolve({ json: { result: METRIC_TILE_SCHEMA } } as never),
  );

  fireEvent.change(screen.getByTestId('inspector-props'), {
    target: { value: '{"title":"Quarterly"}' },
  });
  await userEvent.click(screen.getByTestId('inspector-props-apply'));

  expect(
    await screen.findByTestId('inspector-props-validation-error'),
  ).toHaveTextContent('network error');
  expect(provider.getNode(id)?.props?.title).toBe('Revenue');
});
