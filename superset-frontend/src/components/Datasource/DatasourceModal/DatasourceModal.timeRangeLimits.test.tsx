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
import {
  render,
  screen,
  waitFor,
  fireEvent,
  cleanup,
  userEvent,
  within,
  act,
  defaultStore as store,
} from 'spec/helpers/testing-library';
import fetchMock, { type RouteResponse } from 'fetch-mock';
import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
} from '@superset-ui/core';
import { Constants } from '@superset-ui/core/components';
import mockDatasource from 'spec/fixtures/mockDatasource';
import React from 'react';
import DatasourceModalComponent from '.';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

// The "Extra" and "Description" code editors as plain text areas.
jest.mock('@superset-ui/core/components/AsyncAceEditor', () => ({
  ...jest.requireActual('@superset-ui/core/components/AsyncAceEditor'),
  TextAreaEditor: ({
    mode,
    defaultValue,
    onChange,
  }: {
    mode: string;
    defaultValue?: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label={`${mode} editor`}
      defaultValue={defaultValue}
      onChange={event => onChange(event.target.value)}
    />
  ),
}));

jest.setTimeout(180000);

// Cast to accept partial mock props in tests
const DatasourceModal = DatasourceModalComponent as unknown as React.FC<
  Record<string, any>
>;

const SAVE_DATASOURCE_ENDPOINT = 'glob:*/api/v1/dataset/7?override_columns=*';
const GET_DATASOURCE_ENDPOINT = 'glob:*/api/v1/dataset/7';
const GET_DATABASE_ENDPOINT = 'glob:*/api/v1/database/?q=*';
const CHART_ENDPOINT = 'glob:*/api/v1/chart/?q=*';

const mockedProps = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: () => {},
  onHide: () => {},
  show: true,
  onDatasourceSave: jest.fn(),
};

const routeProps = {
  history: {},
  location: {},
  match: {},
};

afterEach(() => {
  jest.mocked(isFeatureEnabled).mockReset();
});

// Runs before the unmount, so the editor's requests answer instead of being
// aborted and retried by fetch-retry after the test environment is gone.
afterEach(() => fetchMock.callHistory.flush(true));

const LIMITS_ENDPOINT = 'glob:*/api/v1/dataset/7/time_range_limits/';
const SAVE_CHECK_ENDPOINT =
  'glob:*/api/v1/dataset/7/time_range_limits/charts/*';
const NO_REFUSALS = {
  result: { charts: [], filters: [], unlimited: [], unchecked: [] },
};
const LOAD_ERROR =
  'Time range limits could not be loaded. Queries are paused to protect the database.';
const UNIT_GONE =
  'Configured time grain P1D is no longer available. Select a supported unit.';
const NO_TIME_COLUMN =
  "This dataset has no time column, so time range limits don't apply.";
const NOT_AN_OBJECT =
  'Extra must be a JSON object to keep the time range limits.';
const GRAINS = [
  { value: 'P1D', label: 'Day' },
  { value: 'P1W', label: 'Week' },
  { value: 'P1M', label: 'Month' },
  { value: 'P1Y', label: 'Year' },
];

type Rule = { quantity: number; time_grain: string } | null;
const weeks = (quantity: number): Rule => ({ quantity, time_grain: 'P1W' });
const limits = (span: Rule = null, lookBack: Rule = null) => ({
  max_span: span,
  max_look_back: lookBack,
  max_look_forward: null,
});
const key = (span: Rule, lookBack: Rule = null) => ({
  schema_version: 1,
  ...limits(span, lookBack),
});
const DEMO_GLOBAL = limits(weeks(12), { quantity: 12, time_grain: 'P1M' });

const limitsResponse = ({
  dataset = limits(),
  global = DEMO_GLOBAL,
  needsReview = [] as { rule: string; reason: string }[],
  grains = GRAINS,
  labels = undefined as Record<string, string> | undefined,
} = {}) => ({
  result: {
    schema_version: 1,
    global_revision: 0,
    global,
    dataset,
    needs_review: needsReview,
    eligible_time_grains: grains,
    time_grain_labels: labels,
  },
});

const unavailable = (extra: Record<string, unknown>) => ({
  status: 503,
  body: {
    errors: [
      {
        message: 'Time range limits could not be verified. Retry the request.',
        error_type: 'TIME_RANGE_LIMIT_ERROR',
        level: 'error',
        extra: { reason_code: 'POLICY_UNAVAILABLE', ...extra },
      },
    ],
  },
});

const deferred = () => {
  let settle: (response: RouteResponse) => void = () => {};
  const promise = new Promise<RouteResponse>(done => {
    settle = done;
  });
  return { promise, settle };
};

const limitsOn = () =>
  jest
    .mocked(isFeatureEnabled)
    .mockImplementation(flag => flag === FeatureFlag.TimeRangeLimits);

function setup({
  extra,
  get = limitsResponse(),
  put = {},
  datasource = {},
  seeded = {},
  check = NO_REFUSALS,
}: {
  extra?: string;
  get?: RouteResponse;
  put?: RouteResponse;
  datasource?: Record<string, unknown>;
  seeded?: Record<string, unknown>;
  check?: RouteResponse;
} = {}) {
  cleanup();
  fetchMock.clearHistory().removeRoutes();
  fetchMock.put(SAVE_DATASOURCE_ENDPOINT, put, { name: 'save' });
  fetchMock.get(
    GET_DATASOURCE_ENDPOINT,
    { result: { ...mockedProps.datasource, extra, ...datasource, ...seeded } },
    { name: 'dataset' },
  );
  fetchMock.get(GET_DATABASE_ENDPOINT, { result: [] });
  fetchMock.get(CHART_ENDPOINT, { result: [], count: 0 });
  fetchMock.get(LIMITS_ENDPOINT, get, { name: 'limits' });
  fetchMock.get(SAVE_CHECK_ENDPOINT, check, { name: 'save-check' });
  const onDatasourceSave = jest.fn();
  render(
    <DatasourceModal
      {...mockedProps}
      {...routeProps}
      onDatasourceSave={onDatasourceSave}
      datasource={{ ...mockedProps.datasource, extra, ...datasource }}
    />,
    { store, useRouter: true },
  );
  return { onDatasourceSave };
}

const requests = () =>
  fetchMock.callHistory.calls().map(call => {
    const url = new URL(call.url, 'http://localhost');
    return `${(call.options.method ?? 'get').toUpperCase()} ${url.pathname}${url.search}`;
  });
const limitsGets = () =>
  requests().filter(
    request =>
      request.includes('/time_range_limits/') && !request.includes('/charts/'),
  );
const saveChecks = () => fetchMock.callHistory.calls('save-check');
const puts = () =>
  fetchMock.callHistory
    .calls()
    .filter(call => call.options.method === 'put')
    .map(call => JSON.parse(call.options.body as string));
const sentExtra = () => puts()[puts().length - 1].extra;
const saveButton = () => screen.getByTestId('datasource-modal-save');
const section = () =>
  screen.findByRole('region', { name: 'Time range limits', hidden: true });
const spanQuantity = () =>
  screen.getByRole('spinbutton', {
    name: 'Longest range quantity',
    hidden: true,
  });
const spanUnit = () =>
  screen.getByRole('combobox', { name: /^Longest range unit/, hidden: true });

async function openSettings() {
  await userEvent.click(
    await screen.findByRole('tab', { name: /settings/i, hidden: true }),
  );
}

async function rowsReady() {
  await waitFor(() => expect(spanQuantity()).toBeEnabled());
}

async function setSpan(value: string) {
  fireEvent.change(spanQuantity(), { target: { value } });
}

async function typeInto(label: string, value: string) {
  const editor = screen.getByRole('textbox', { name: label, hidden: true });
  fireEvent.change(editor, { target: { value } });
}

const confirmDialog = async () =>
  (
    await screen.findByText('Are you sure you want to save and apply changes?')
  ).closest('[role="dialog"]') as HTMLElement;

async function saveAndConfirm() {
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await userEvent.click(
    within(await confirmDialog()).getByRole('button', {
      name: 'Confirm',
      hidden: true,
    }),
  );
}

async function tooltipOf(text: string) {
  await userEvent.hover(saveButton());
  return screen.findByText(text, { exact: false });
}

test('flag off keeps the requests and body unchanged', async () => {
  const extra = JSON.stringify({ time_range_limits: key(weeks(9)) });
  const bodies: unknown[] = [];

  setup({ extra });
  await openSettings();
  expect(
    screen.queryByRole('region', {
      name: 'Time range limits',
      hidden: true,
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('textbox', { name: 'json editor', hidden: true }),
  ).toHaveValue(extra);
  expect(saveButton()).toBeEnabled();
  expect(
    [...new Set(requests().map(request => request.split('?')[0]))].sort(),
  ).toEqual([
    'GET /api/v1/chart/',
    'GET /api/v1/database/',
    'GET /api/v1/dataset/7',
  ]);
  await saveAndConfirm();
  await waitFor(() =>
    expect(requests().slice(-2)).toEqual([
      'PUT /api/v1/dataset/7?override_columns=false',
      'GET /api/v1/dataset/7',
    ]),
  );
  bodies.push(puts()[0]);
  expect(Object.keys(puts()[0])).toEqual([
    'schema',
    'description',
    'main_dttm_col',
    'currency_code_column',
    'normalize_columns',
    'always_filter_main_dttm',
    'partition_column',
    'partition_mapped_column',
    'extra',
    'is_managed_externally',
    'metrics',
    'columns',
    'editors',
  ]);
  expect(sentExtra()).toBe(extra);
  expect(limitsGets()).toEqual([]);

  // Flag on, but not a SqlaTable: the same.
  limitsOn();
  setup({ extra, datasource: { type: 'query' } });
  expect(await screen.findByTestId('datasource-editor')).toBeInTheDocument();
  await openSettings();
  expect(
    screen.queryByRole('region', {
      name: 'Time range limits',
      hidden: true,
    }),
  ).not.toBeInTheDocument();
  expect(saveButton()).toBeEnabled();
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  bodies.push(puts()[0]);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(limitsGets()).toEqual([]);
});

test('limits GET uses 10 s and no retries', async () => {
  limitsOn();
  const getSpy = jest.spyOn(SupersetClient, 'get');
  let resolve: (value: unknown) => void = () => {};
  const pending = new Promise(done => {
    resolve = done;
  });
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(9)) }),
    get: () => pending,
  });
  await openSettings();

  const region = await section();

  expect(region).toBeVisible();
  expect(region).toHaveAttribute('aria-busy', 'true');
  expect(spanQuantity()).toBeDisabled();
  expect(saveButton()).toBeDisabled();
  await userEvent.click(saveButton());
  expect(screen.queryByText('Confirm save')).not.toBeInTheDocument();
  expect(limitsGets()).toEqual(['GET /api/v1/dataset/7/time_range_limits/']);
  expect(getSpy).toHaveBeenCalledWith({
    endpoint: '/api/v1/dataset/7/time_range_limits/',
    timeout: 10000,
    fetchRetryOptions: { retries: 0 },
  });

  resolve(limitsResponse({ dataset: limits(weeks(4)) }));
  await rowsReady();
  expect(region).not.toHaveAttribute('aria-busy');
  await waitFor(() => expect(saveButton()).toBeEnabled());
  expect(limitsGets()).toHaveLength(1);
  getSpy.mockRestore();

  // The dataset list opener (datasource_type, no type) sends the same GET.
  setup({ datasource: { type: undefined, datasource_type: 'table' } });
  await openSettings();
  await section();
  expect(limitsGets()).toEqual(['GET /api/v1/dataset/7/time_range_limits/']);
});

test('load failure shows Retry', async () => {
  limitsOn();
  setup({ get: unavailable({ source: 'global', field: 'max_look_back' }) });
  await openSettings();
  const region = await section();
  expect(region).toBeVisible();
  const alert = await within(region).findByRole('alert', { hidden: true });
  expect(alert).toHaveTextContent(LOAD_ERROR);
  expect(
    within(region).queryByRole('table', { hidden: true }),
  ).not.toBeInTheDocument();
  expect(
    within(alert)
      .getAllByRole('button', { hidden: true })
      .map(button => button.textContent),
  ).toEqual(['Retry']);

  // One click is one GET; focus moves to the new Retry.
  fetchMock.removeRoute('limits');
  fetchMock.get(
    LIMITS_ENDPOINT,
    { status: 500, body: { message: 'x' } },
    { name: 'limits' },
  );
  await userEvent.click(
    within(alert).getByRole('button', { name: 'Retry', hidden: true }),
  );
  await waitFor(() => expect(limitsGets()).toHaveLength(2));
  await waitFor(() =>
    expect(
      within(region).getByRole('button', { name: 'Retry', hidden: true }),
    ).toHaveFocus(),
  );
  // A failure without a source (500) blocks Save with the load text.
  await waitFor(() => expect(saveButton()).toBeDisabled());
  expect(await tooltipOf(LOAD_ERROR)).toBeInTheDocument();

  fetchMock.removeRoute('limits');
  fetchMock.get(LIMITS_ENDPOINT, limitsResponse(), { name: 'limits' });
  await userEvent.click(
    within(region).getByRole('button', { name: 'Retry', hidden: true }),
  );
  await rowsReady();
  expect(limitsGets()).toHaveLength(3);
  await waitFor(() => expect(saveButton()).toBeEnabled());

  // A timeout is the same fail-closed state.
  const original = SupersetClient.get.bind(SupersetClient);
  const getSpy = jest.spyOn(SupersetClient, 'get').mockImplementation(request =>
    request?.endpoint?.includes('/time_range_limits/')
      ? Promise.reject({
          error: 'Request timed out',
          statusText: 'timeout',
          timeout: 10000,
        })
      : original(request),
  );
  setup({ extra: JSON.stringify({ time_range_limits: key(weeks(9)) }) });
  await openSettings();
  expect(
    await within(await section()).findByRole('alert', { hidden: true }),
  ).toHaveTextContent(LOAD_ERROR);
  await waitFor(() => expect(saveButton()).toBeDisabled());
  getSpy.mockRestore();
  await userEvent.click(
    screen.getByRole('button', { name: 'Retry', hidden: true }),
  );
  await rowsReady();
  await waitFor(() => expect(saveButton()).toBeEnabled());
});

test('stale unit is removed in the same save', async () => {
  limitsOn();
  const badKey = key({ quantity: 30, time_grain: 'P1D' });
  setup({
    extra: JSON.stringify({
      warning_markdown: 'w',
      time_range_limits: badKey,
    }),
    get: unavailable({
      source: 'dataset',
      field: 'max_span.time_grain',
      value: 'P1D',
      dataset_id: 7,
    }),
  });
  await openSettings();
  const region = await section();
  expect(region).toBeVisible();
  expect(await within(region).findByText(UNIT_GONE)).toBeInTheDocument();
  await waitFor(() => expect(saveButton()).toBeDisabled());
  expect(await tooltipOf(UNIT_GONE)).toBeInTheDocument();

  await userEvent.click(
    within(region).getByRole('button', {
      name: 'Remove dataset limits',
      hidden: true,
    }),
  );
  expect(
    await within(region).findByText(
      'Dataset limits will be removed when you save.',
    ),
  ).toBeInTheDocument();
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(sentExtra()).toBe(JSON.stringify({ warning_markdown: 'w' }));

  // Without a unit value: the load text blocks Save until Remove.
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(0)) }),
    get: unavailable({ source: 'dataset', field: 'max_span.quantity' }),
  });
  await openSettings();
  const second = await section();
  await within(second).findByRole('alert', { hidden: true });
  await waitFor(() => expect(saveButton()).toBeDisabled());
  expect(await tooltipOf(LOAD_ERROR)).toBeInTheDocument();
  await userEvent.click(
    within(second).getByRole('button', {
      name: 'Remove dataset limits',
      hidden: true,
    }),
  );
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(sentExtra()).toBe('{}');
});

test('global load failure keeps other edits', async () => {
  limitsOn();
  const asRead = key(weeks(9));
  setup({
    extra: JSON.stringify({ time_range_limits: asRead }),
    get: unavailable({
      source: 'global',
      field: 'max_span.time_grain',
      value: 'P1D',
    }),
  });
  await openSettings();
  const alert = await within(await section()).findByRole('alert', {
    hidden: true,
  });
  expect(alert).toBeVisible();
  expect(alert).toHaveTextContent(UNIT_GONE);
  expect(
    within(alert)
      .getAllByRole('button', { hidden: true })
      .map(button => button.textContent),
  ).toEqual(['Retry']);

  await typeInto('markdown editor', 'Other edit');
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(puts()[0].description).toBe('Other edit');
  expect(JSON.parse(sentExtra())).toEqual({ time_range_limits: asRead });

  // Nothing read: no key is sent.
  setup({ get: unavailable({ source: 'global', field: 'max_look_back' }) });
  await openSettings();
  await within(await section()).findByRole('alert', { hidden: true });
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(sentExtra()).toBeUndefined();
});

test('invalid section disables Save with a tooltip', async () => {
  limitsOn();
  setup({ get: limitsResponse({ dataset: limits(weeks(12)) }) });
  await openSettings();
  await rowsReady();
  expect(spanQuantity()).toBeVisible();

  await setSpan('13');
  const message = await screen.findByText(
    "Can't be longer than the admin limit (12 weeks)",
  );
  expect(spanQuantity()).toHaveAttribute('aria-invalid', 'true');
  expect(spanQuantity()).toHaveAttribute('aria-describedby', message.id);
  await waitFor(() => expect(saveButton()).toBeDisabled());
  expect(
    await tooltipOf("Can't be longer than the admin limit (12 weeks)"),
  ).toBeInTheDocument();

  await setSpan('11');
  await waitFor(() => expect(saveButton()).toBeEnabled());
});

test.each([
  {
    name: 'edited to 4 weeks, the other "Extra" keys stay',
    extra: JSON.stringify({
      warning_markdown: 'hi',
      time_range_limits: key(weeks(9)),
    }),
    get: limitsResponse({ dataset: limits(weeks(9)) }),
    span: '4',
    sent: { warning_markdown: 'hi', time_range_limits: key(weeks(4)) },
  },
  {
    name: 'the GET has no limit (removed elsewhere), the key is deleted',
    extra: JSON.stringify({
      warning_markdown: 'hi',
      time_range_limits: key(weeks(9)),
    }),
    get: limitsResponse(),
    sent: { warning_markdown: 'hi' },
  },
  {
    name: "untouched, the GET's 4 weeks, not the opener's 9 weeks",
    extra: JSON.stringify({ time_range_limits: key(weeks(9)) }),
    get: limitsResponse({ dataset: limits(weeks(4)) }),
    sent: { time_range_limits: key(weeks(4)) },
  },
])(
  'save carries the current key: $name',
  async ({ extra, get, span, sent }) => {
    limitsOn();
    setup({ extra, get });
    await openSettings();
    expect(await section()).toBeVisible();
    await rowsReady();
    if (span) {
      await setSpan(span);
    }
    await saveAndConfirm();
    await waitFor(() => expect(puts()).toHaveLength(1));
    expect(JSON.parse(sentExtra())).toEqual(sent);
  },
);

test('save carries the current key: pending, failed and untouched text', async () => {
  limitsOn();
  // Explore opener while the GET is pending: no Save, no PUT.
  const pending = deferred();
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(9)) }),
    get: () => pending.promise,
  });
  await openSettings();
  await section();
  expect(saveButton()).toBeDisabled();
  await userEvent.click(saveButton());
  expect(puts()).toEqual([]);
  pending.settle(limitsResponse());
  await fetchMock.callHistory.flush(true);

  // A global failure: the key as read.
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(9)) }),
    get: unavailable({ source: 'global', field: 'max_look_back' }),
  });
  await openSettings();
  await within(await section()).findByRole('alert', { hidden: true });
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra())).toEqual({
    time_range_limits: key(weeks(9)),
  });

  // No key and none read: the text byte for byte.
  const text = '{ "warning_markdown":  "hi" }';
  setup({ extra: text });
  await openSettings();
  await rowsReady();
  expect(spanQuantity()).toBeVisible();
  expect(
    screen.getByRole('textbox', { name: 'json editor', hidden: true }),
  ).toHaveValue(text);
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(sentExtra()).toBe(text);
});

test('extra text omits the limits key', async () => {
  limitsOn();
  setup({
    extra: JSON.stringify({
      warning_markdown: 'w',
      time_range_limits: key(weeks(9)),
    }),
    get: limitsResponse({ dataset: limits(weeks(4)) }),
  });
  await openSettings();
  await rowsReady();
  expect(spanQuantity()).toBeVisible();
  expect(
    screen.getByRole('textbox', { name: 'json editor', hidden: true }),
  ).toHaveValue(JSON.stringify({ warning_markdown: 'w' }));

  await typeInto('json editor', '{"warning_markdown": "hi"}');
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra())).toEqual({
    warning_markdown: 'hi',
    time_range_limits: key(weeks(4)),
  });

  // Not a JSON object with a key to carry: Save is blocked.
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(9)) }),
    get: limitsResponse({ dataset: limits(weeks(4)) }),
  });
  await openSettings();
  await rowsReady();
  await typeInto('json editor', 'not json');
  await waitFor(() => expect(saveButton()).toBeDisabled());
  expect(await tooltipOf(NOT_AN_OBJECT)).toBeInTheDocument();
  await typeInto('json editor', '');
  await waitFor(() => expect(saveButton()).toBeEnabled());

  // Nothing to carry: the text is sent as typed.
  setup();
  await openSettings();
  await rowsReady();
  await typeInto('json editor', 'not json');
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(sentExtra()).toBe('not json');
});

test('clearing the number of a stored rule is no error and saves no key', async () => {
  limitsOn();
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(4)) }),
    get: limitsResponse({ dataset: limits(weeks(4)) }),
  });
  await openSettings();
  await rowsReady();
  await setSpan('');

  expect(screen.queryByText('Enter a number.')).not.toBeInTheDocument();
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra()).time_range_limits ?? null).toBeNull();
});

test('a unit-only edit on an empty rule keeps the stored key', async () => {
  limitsOn();
  setup({
    extra: JSON.stringify({ time_range_limits: key(null, weeks(2)) }),
    get: limitsResponse({ dataset: limits(null, weeks(2)) }),
  });
  await openSettings();
  await rowsReady();
  await userEvent.click(spanUnit());
  const option = await waitFor(() =>
    within(
      // eslint-disable-next-line testing-library/no-node-access
      document.querySelector('.ant-select-dropdown-list')!,
    ).getByText('Week'),
  );
  await userEvent.click(option);

  expect(screen.queryByText('Enter a number.')).not.toBeInTheDocument();
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra()).time_range_limits).toEqual(
    key(null, weeks(2)),
  );
});

test('a stored unit that is not eligible shows its label', async () => {
  limitsOn();
  setup({
    extra: JSON.stringify({
      time_range_limits: key({ quantity: 120, time_grain: 'P1D' }),
    }),
    get: limitsResponse({
      dataset: limits({ quantity: 120, time_grain: 'P1D' }),
      global: limits(),
      grains: [{ value: 'P1W', label: 'Week' }],
      labels: { P1D: 'Day', P1W: 'Week' },
    }),
  });
  await openSettings();
  await rowsReady();

  expect(
    // eslint-disable-next-line testing-library/no-node-access
    within(spanUnit().closest('.ant-select')!).getByText('Day'),
  ).toBeInTheDocument();
  expect(screen.queryByText('P1D')).not.toBeInTheDocument();
});

test('server errors reach the field', async () => {
  limitsOn();
  setup({
    get: limitsResponse({ dataset: limits(weeks(9)) }),
    put: {
      status: 422,
      body: {
        message: {
          'extra.time_range_limits.max_span.quantity': [
            'Dataset maximum span must be 12 weeks or less.',
          ],
        },
      },
    },
  });
  await openSettings();
  await rowsReady();
  await setSpan('10');
  await saveAndConfirm();
  expect(
    (await screen.findAllByText('Error saving dataset')).length,
  ).toBeGreaterThan(0);
  const region = await section();
  expect(region).toBeVisible();
  expect(
    await within(region).findByText(
      'Dataset maximum span must be 12 weeks or less.',
    ),
  ).toBeInTheDocument();
  expect(spanQuantity()).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByText('Edit Dataset')).toBeInTheDocument();
  await setSpan('11');
  await waitFor(() =>
    expect(
      within(region).queryByText(
        'Dataset maximum span must be 12 weeks or less.',
      ),
    ).not.toBeInTheDocument(),
  );

  // 500: the section's failure line and Retry; values kept.
  setup({
    get: limitsResponse({ dataset: limits(weeks(9)) }),
    put: { status: 500, body: { message: 'boom' } },
  });
  await openSettings();
  await rowsReady();
  await setSpan('4');
  await saveAndConfirm();
  const failed = await within(await section()).findByText(
    'Dataset time range limits could not be saved.',
  );
  expect(failed).toBeInTheDocument();
  expect(spanQuantity()).toHaveValue('4');
  expect(puts()).toHaveLength(1);

  // Retry reopens the confirm dialog; its Confirm sends one PUT.
  await userEvent.click(
    within(await confirmDialog()).getByRole('button', {
      name: 'Cancel',
      hidden: true,
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByText('Are you sure you want to save and apply changes?'),
    ).not.toBeVisible(),
  );
  fetchMock.removeRoute('save');
  fetchMock.put(SAVE_DATASOURCE_ENDPOINT, {}, { name: 'save' });
  const alert = failed.closest('[role="alert"]') as HTMLElement;
  await userEvent.click(
    within(alert).getByRole('button', { name: 'Retry', hidden: true }),
  );
  const confirm = await confirmDialog();
  expect(puts()).toHaveLength(1);
  await userEvent.click(
    within(confirm).getByRole('button', { name: 'Confirm', hidden: true }),
  );
  await waitFor(() => expect(puts()).toHaveLength(2));
  expect(JSON.parse(sentExtra())).toEqual({
    time_range_limits: key(weeks(4)),
  });
});

test("stale value doesn't block other edits", async () => {
  limitsOn();
  const stale = key({ quantity: 2, time_grain: 'P1M' });
  setup({
    extra: JSON.stringify({ time_range_limits: stale }),
    get: limitsResponse({
      global: limits({ quantity: 30, time_grain: 'P1D' }),
      dataset: limits({ quantity: 2, time_grain: 'P1M' }),
      needsReview: [{ rule: 'max_span', reason: 'LOOSER_THAN_GLOBAL' }],
    }),
  });
  await openSettings();
  await rowsReady();
  expect(spanQuantity()).toBeVisible();
  expect(
    screen.getByText(
      "Your admin's limit (30 days) is stricter than 2 months, so 30 days applies.",
    ),
  ).toBeInTheDocument();
  await typeInto('markdown editor', 'Other edit');
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(puts()[0].description).toBe('Other edit');
  expect(JSON.parse(sentExtra())).toEqual({ time_range_limits: stale });
});

test('no time column disables the section', async () => {
  limitsOn();
  const noTemporal = mockedProps.datasource.columns.map(column => ({
    ...column,
    is_dttm: false,
  }));
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(4)) }),
    get: limitsResponse({ dataset: limits(weeks(4)) }),
    datasource: { columns: noTemporal, main_dttm_col: null },
  });
  await openSettings();
  const region = await section();
  expect(region).toBeVisible();
  expect(await within(region).findByText(NO_TIME_COLUMN)).toBeInTheDocument();
  await waitFor(() => expect(saveButton()).toBeEnabled());
  expect(spanQuantity()).toBeDisabled();
  expect(spanQuantity()).toHaveValue('4');
  await new Promise(done => setTimeout(done, 800));
  expect(saveChecks()).toHaveLength(0);
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra())).toEqual({
    time_range_limits: key(weeks(4)),
  });

  // Unchecking the last "Is temporal" flips it live; the draft isn't sent.
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(4)) }),
    get: limitsResponse({ dataset: limits(weeks(4)) }),
    datasource: { main_dttm_col: null },
  });
  await openSettings();
  await rowsReady();
  expect(screen.queryByText(NO_TIME_COLUMN)).not.toBeInTheDocument();
  await setSpan('6');
  await userEvent.click(
    screen.getByRole('tab', { name: /^columns/i, hidden: true }),
  );
  const dsRow = (await screen.findAllByText('ds'))
    .map(cell => cell.closest('tr'))
    .find(
      row =>
        row && within(row).queryAllByRole('checkbox', { hidden: true }).length,
    )!;
  const [temporal] = within(dsRow).getAllByRole('checkbox', { hidden: true });
  expect(temporal).toBeChecked();
  await userEvent.click(temporal);
  await openSettings();
  expect(await screen.findByText(NO_TIME_COLUMN)).toBeInTheDocument();
  expect(spanQuantity()).toHaveValue('4');
  expect(spanQuantity()).toBeDisabled();
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra())).toEqual({
    time_range_limits: key(weeks(4)),
  });

  // After a global failure the key as read is kept; while loading, no Save.
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(9)) }),
    get: unavailable({ source: 'global', field: 'max_look_back' }),
    datasource: { columns: noTemporal, main_dttm_col: null },
  });
  await openSettings();
  const failed = await section();
  expect(
    await within(failed).findByRole('alert', { hidden: true }),
  ).toHaveTextContent(LOAD_ERROR);
  expect(within(failed).queryByText(NO_TIME_COLUMN)).not.toBeInTheDocument();
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra())).toEqual({
    time_range_limits: key(weeks(9)),
  });

  const pending = deferred();
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(9)) }),
    get: () => pending.promise,
    datasource: { columns: noTemporal, main_dttm_col: null },
  });
  await openSettings();
  await section();
  expect(saveButton()).toBeDisabled();
  pending.settle(limitsResponse());
  await fetchMock.callHistory.flush(true);
});

test('main time column alone keeps the section on', async () => {
  limitsOn();
  setup({
    get: limitsResponse({ dataset: limits(weeks(4)) }),
    datasource: {
      columns: mockedProps.datasource.columns.map(column => ({
        ...column,
        is_dttm: false,
      })),
      main_dttm_col: 'ds',
    },
  });
  await openSettings();
  await section();
  await rowsReady();
  expect(spanQuantity()).toBeVisible();
  expect(spanQuantity()).toHaveValue('4');
  expect(screen.queryByText(NO_TIME_COLUMN)).not.toBeInTheDocument();
});

test('no eligible units keeps the stored key', async () => {
  limitsOn();
  setup({
    extra: JSON.stringify({ time_range_limits: key(weeks(9)) }),
    get: limitsResponse({ dataset: limits(weeks(4)), grains: [] }),
  });
  await openSettings();
  const region = await section();
  expect(region).toBeVisible();
  expect(
    await within(region).findByText('No eligible time grains configured'),
  ).toBeInTheDocument();
  expect(spanQuantity()).toBeDisabled();
  expect(spanQuantity()).toHaveValue('4');
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra())).toEqual({
    time_range_limits: key(weeks(4)),
  });
});

test('warning never blocks save', async () => {
  limitsOn();
  const heading =
    "These charts on this dataset use their own time range, which these limits don't allow. Their queries stop until you change it.";
  const refused = {
    result: {
      charts: [
        {
          id: 3,
          slice_name: 'Calls by queue',
          url: '/explore/?slice_id=3',
          range: 'Last year',
          time_offset: null,
          reason_code: 'MAX_SPAN_EXCEEDED',
          rule: 'max_span',
          source: 'dataset',
          message: "Range can't be longer than 3 weeks. This one is 53 weeks.",
        },
      ],
      filters: [],
      unlimited: [],
      unchecked: [],
    },
  };
  const saveWith = async (check: RouteResponse, warned: boolean) => {
    const { onDatasourceSave } = setup({
      extra: JSON.stringify({ time_range_limits: key(weeks(9)) }),
      get: limitsResponse({ dataset: limits(weeks(9)) }),
      check,
    });
    await openSettings();
    const region = await section();
    expect(region).toBeVisible();
    await rowsReady();
    await setSpan('3');
    await waitFor(
      () =>
        expect(decodeURIComponent(saveChecks().at(-1)?.url ?? '')).toContain(
          'quantity:3,time_grain:P1W',
        ),
      { timeout: 3000 },
    );
    await waitFor(
      () =>
        expect(within(region).queryAllByText(heading)).toHaveLength(
          warned ? 1 : 0,
        ),
      { timeout: 3000 },
    );
    expect(
      within(region)
        .queryAllByRole('link', { name: 'Calls by queue', hidden: true })
        .map(link => link.getAttribute('href')),
    ).toEqual(warned ? ['/explore/?slice_id=3'] : []);
    await saveAndConfirm();
    await waitFor(() => expect(onDatasourceSave).toHaveBeenCalled());
    return { puts: puts(), sent: JSON.parse(sentExtra()) };
  };

  const withWarning = await saveWith(refused, true);
  const without = await saveWith(NO_REFUSALS, false);
  expect(withWarning).toEqual(without);
  expect(withWarning.sent).toEqual({ time_range_limits: key(weeks(3)) });
});

test('without an etag the form edits the dataset it read, with the key split off', async () => {
  limitsOn();
  const opener = key(weeks(9));
  const read = key(weeks(4));
  setup({
    extra: JSON.stringify({ time_range_limits: opener }),
    seeded: {
      extra: JSON.stringify({
        warning_markdown: 'w',
        time_range_limits: read,
      }),
    },
    get: unavailable({ source: 'global', field: 'max_look_back' }),
  });
  await openSettings();
  await within(await section()).findByRole('alert', { hidden: true });
  expect(
    screen.getByRole('textbox', { name: 'json editor', hidden: true }),
  ).toHaveValue(JSON.stringify({ warning_markdown: 'w' }));

  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra())).toEqual({
    warning_markdown: 'w',
    time_range_limits: read,
  });
});

test('without an etag the save writes the section value into the extra it read', async () => {
  limitsOn();
  setup({
    seeded: {
      extra: JSON.stringify({
        warning_markdown: 'w',
        time_range_limits: key(weeks(9)),
      }),
    },
    get: limitsResponse({ dataset: limits(weeks(9)) }),
  });
  await openSettings();
  await rowsReady();
  expect(
    screen.getByRole('textbox', { name: 'json editor', hidden: true }),
  ).toHaveValue(JSON.stringify({ warning_markdown: 'w' }));

  await setSpan('3');
  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra())).toEqual({
    warning_markdown: 'w',
    time_range_limits: key(weeks(3)),
  });
});

test('certification and time range limits change in one save', async () => {
  limitsOn();
  setup({
    extra: JSON.stringify({
      custom_key: { enabled: true },
      time_range_limits: key(weeks(9)),
    }),
    get: limitsResponse({ dataset: limits(weeks(9)) }),
  });
  await openSettings();
  await rowsReady();

  const certifiedBy = await screen.findByPlaceholderText('Certified by');
  const details = screen.getByPlaceholderText('Certification details');
  jest.useFakeTimers();
  fireEvent.change(certifiedBy, { target: { value: 'Data Team' } });
  fireEvent.change(details, { target: { value: 'Reviewed' } });
  act(() => {
    jest.advanceTimersByTime(Constants.FAST_DEBOUNCE);
  });
  jest.useRealTimers();
  await setSpan('2');

  await saveAndConfirm();
  await waitFor(() => expect(puts()).toHaveLength(1));
  expect(JSON.parse(sentExtra())).toEqual({
    custom_key: { enabled: true },
    certification: { certified_by: 'Data Team', details: 'Reviewed' },
    time_range_limits: key(weeks(2)),
  });
});

test('a 412 on save shows the changed-dataset dialog, not the limits save error', async () => {
  limitsOn();
  setup({
    get: limitsResponse({ dataset: limits(weeks(9)) }),
    put: { status: 412, body: { message: 'Precondition failed' } },
  });
  await openSettings();
  await rowsReady();
  await setSpan('3');

  await saveAndConfirm();
  expect(
    (await screen.findAllByText('Dataset changed since you opened it')).length,
  ).toBeGreaterThan(0);
  expect(
    screen.queryByText('Dataset time range limits could not be saved.'),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Error saving dataset')).not.toBeInTheDocument();
});
