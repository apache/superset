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
  act,
  cleanup,
  createStore,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import * as ColorSchemeSelect from 'src/dashboard/components/ColorSchemeSelect';
import * as SupersetCore from '@superset-ui/core';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import reducerIndex from 'spec/helpers/reducerIndex';
import * as colorScheme from 'src/utils/colorScheme';
import * as limitsActions from 'src/dashboard/actions/timeRangeLimits';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import PropertiesModal from '.';

// Increase timeout for CI environment
jest.setTimeout(60000);

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
  getCategoricalSchemeRegistry: jest.fn(() => ({
    keys: () => ['supersetColors'],
    get: () => ['#FFFFFF', '#000000'],
    getDefaultKey: () => 'supersetColors',
  })),
}));

// Mock the Advanced JSON editor (Ace-based, not drivable in jsdom) with a plain
// textarea so a direct JSON edit can be simulated. Keeps the "JSON Metadata"
// label so the existing "should open advance" test still passes.
jest.mock('./sections/AdvancedSection', () => ({
  __esModule: true,
  default: ({
    jsonMetadata,
    onJsonMetadataChange,
  }: {
    jsonMetadata: string;
    onJsonMetadataChange: (value: string) => void;
  }) => (
    <div>
      <span>JSON Metadata</span>
      <textarea
        aria-label="JSON metadata editor"
        data-test="mock-json-editor"
        value={jsonMetadata}
        onChange={e => onJsonMetadataChange(e.target.value)}
      />
    </div>
  ),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const spyColorSchemeSelect = jest.spyOn(ColorSchemeSelect, 'default');
spyColorSchemeSelect.mockImplementation(() => <div>ColorSchemeSelect</div>);

const createProps = () => ({
  certified_by: 'John Doe',
  certification_details: 'Sample certification',
  dashboardId: 26,
  show: true,
  colorScheme: 'supersetColors',
  onlyApply: false,
  onHide: jest.fn(),
  onSubmit: jest.fn(),
  addSuccessToast: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

afterAll(() => {
  fetchMock.clearHistory().removeRoutes();
});

const LIMITS_URL = 'glob:*/api/v1/dashboard/26/time_range_limits/';
const DASHBOARD_URL = 'glob:*/api/v1/dashboard/26';
const SAVE_CHECK_URL = 'glob:*/api/v1/dashboard/26/time_range_limits/charts/*';
const NO_REFUSALS = {
  result: { charts: [], filters: [], unlimited: [], unchecked: [] },
};
const LOAD_ERROR =
  'Time range limits could not be loaded. Queries are paused to protect the database.';
const UNIT_GONE =
  'Configured time grain P1D is no longer available. Select a supported unit.';
const SAVE_ERROR = 'Dashboard time range limits could not be saved.';
const APPLY_NOTE = 'Saved when you apply, separately from the dashboard.';
const GRAINS = [
  { value: 'P1D', label: 'Day' },
  { value: 'P1W', label: 'Week' },
  { value: 'P1M', label: 'Month' },
  { value: 'P1Y', label: 'Year' },
];

type LimitsRule = { quantity: number; time_grain: string } | null;
type LimitsPolicy = Record<
  'max_span' | 'max_look_back' | 'max_look_forward',
  LimitsRule
>;

const weeks = (quantity: number) => ({ quantity, time_grain: 'P1W' });
const limits = (rules: Partial<LimitsPolicy> = {}): LimitsPolicy => ({
  max_span: null,
  max_look_back: null,
  max_look_forward: null,
  ...rules,
});
const storedKey = (rules: Partial<LimitsPolicy>) => ({
  schema_version: 1,
  ...limits(rules),
});

const LIMITS_DASHBOARD = {
  id: 26,
  dashboard_title: 'Limits',
  slug: 'limits',
  certified_by: '',
  certification_details: '',
  editors: [],
  viewers: [],
  css: '',
  theme: null,
  is_managed_externally: false,
};

const metadataWith = (key?: unknown) => ({
  color_scheme: 'supersetColors',
  label_colors: {},
  refresh_frequency: 0,
  ...(key === undefined ? {} : { time_range_limits: key }),
});

const limitsResponse = ({
  global = limits({ max_span: weeks(12) }),
  dashboard = limits(),
  needsReview = [] as { rule: string; reason: string }[],
  eligible = GRAINS,
  datasets = [] as { id: number; name: string; policy: LimitsPolicy }[],
} = {}) => ({
  result: {
    schema_version: 1,
    global_revision: 0,
    global,
    dashboard,
    effective: {},
    needs_review: needsReview,
    datasets,
    timezone: 'UTC',
    eligible_time_grains: eligible,
  },
});

const unavailable = (extra: Record<string, string> = {}) => ({
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

function deferred() {
  let resolve: (value: unknown) => void = () => {};
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}

type Answer = Parameters<typeof fetchMock.get>[1];

function routes({
  metadata = metadataWith(),
  get = limitsResponse() as Answer,
  put,
  dashboardPut = { result: {} } as Answer,
  check = NO_REFUSALS as Answer,
}: {
  metadata?: Record<string, unknown>;
  get?: Answer;
  put?: Answer;
  dashboardPut?: Answer;
  check?: Answer;
} = {}) {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  fetchMock.get('glob:*/api/v1/theme/*', { result: [] });
  fetchMock.get(DASHBOARD_URL, {
    result: { ...LIMITS_DASHBOARD, json_metadata: JSON.stringify(metadata) },
  });
  fetchMock.get(LIMITS_URL, get, { name: 'limits-get' });
  if (put) {
    fetchMock.put(LIMITS_URL, put, { name: 'limits-put' });
  }
  fetchMock.put(DASHBOARD_URL, dashboardPut, { name: 'dashboard-put' });
  fetchMock.get(SAVE_CHECK_URL, check, { name: 'save-check' });
}

const requests = () =>
  fetchMock.callHistory
    .calls()
    .map(
      call =>
        `${(call.options.method ?? 'get').toUpperCase()} ${new URL(call.url).pathname}`,
    )
    .filter(request => !request.includes('csrf_token'));

const bodies = (method: string, path: string) =>
  fetchMock.callHistory
    .calls()
    .filter(
      call =>
        call.options.method === method && new URL(call.url).pathname === path,
    )
    .map(call => JSON.parse(String(call.options.body)));

const limitsPuts = () =>
  bodies('put', '/api/v1/dashboard/26/time_range_limits/');
const dashboardPuts = () => bodies('put', '/api/v1/dashboard/26');
const sentKey = (index = 0) =>
  JSON.parse(dashboardPuts()[index].json_metadata).time_range_limits;
const appliedKey = (onSubmit: jest.Mock, index = 0) =>
  JSON.parse(onSubmit.mock.calls[index][0].jsonMetadata).time_range_limits;

const limitsOn = () =>
  mockedIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.TimeRangeLimits,
  );

function renderList(store = createStore({}, reducerIndex)) {
  const props = { ...createProps(), onSubmit: jest.fn(), onHide: jest.fn() };
  render(<PropertiesModal {...props} />, { store });
  return props;
}

function renderHeader(metadata: Record<string, unknown>) {
  const props = {
    ...createProps(),
    onlyApply: true,
    onSubmit: jest.fn(),
    onHide: jest.fn(),
    dashboardInfo: { ...LIMITS_DASHBOARD, metadata },
  };
  render(<PropertiesModal {...props} />, { useRedux: true });
  return props;
}

const form = () => screen.findByTestId('dashboard-edit-properties-form');
const jsonEditor = () =>
  screen.findByRole<HTMLTextAreaElement>('textbox', {
    name: 'JSON metadata editor',
  });
const saveButton = (name = 'Save') => screen.getByRole('button', { name });
const limitsRegion = () =>
  screen.findByRole('region', { name: 'Time range limits' });

async function openLimits() {
  await form();
  await userEvent.click(screen.getByText('Time range limits'));
  return limitsRegion();
}

const spanQuantity = () =>
  screen.getByRole('spinbutton', { name: 'Longest range quantity' });
const spanUnit = () =>
  screen.getByRole('combobox', { name: /^Longest range unit/ });

const rowsReady = () => waitFor(() => expect(spanQuantity()).toBeEnabled());

async function setSpan(quantity: string, unit?: string) {
  await userEvent.clear(spanQuantity());
  if (quantity) {
    await userEvent.type(spanQuantity(), quantity);
  }
  if (unit) {
    await userEvent.click(spanUnit());
    const option = await waitFor(() =>
      within(
        // eslint-disable-next-line testing-library/no-node-access
        document.querySelector('.ant-select-dropdown-list')!,
      ).getByText(unit),
    );
    await userEvent.click(option);
  }
}

async function setTitle(title: string) {
  const input = screen.getByTestId('dashboard-title-input');
  await userEvent.clear(input);
  await userEvent.type(input, title);
}

const cleanupModal = () => {
  cleanup();
  fetchMock.clearHistory();
};

const restoreClient = () =>
  (['get', 'put'] as const).forEach(method => {
    const client = SupersetCore.SupersetClient[method];
    if (jest.isMockFunction(client)) {
      client.mockRestore();
    }
  });

const FLAG_OFF_KEY = storedKey({ max_span: weeks(9) });

// The list-view PUT body without the time range limits section.
const FLAG_OFF_BODY = {
  dashboard_title: 'Limits',
  description: null,
  slug: 'limits',
  json_metadata:
    '{\n  "color_scheme": "supersetColors",\n  "label_colors": {},\n  "refresh_frequency": 0,\n  "time_range_limits": {\n    "schema_version": 1,\n    "max_span": {"quantity": 9, "time_grain": "P1W"},\n    "max_look_back": null,\n    "max_look_forward": null\n  },\n  "show_chart_timestamps": false\n}',
  editors: [],
  certified_by: null,
  certification_details: null,
  css: null,
  theme_id: null,
};

beforeEach(() => {
  restoreClient();
});

test('flag off keeps the requests and body unchanged', async () => {
  mockedIsFeatureEnabled.mockReturnValue(false);
  routes({ metadata: metadataWith(FLAG_OFF_KEY) });
  const list = renderList();
  await form();
  expect(screen.queryByText('Time range limits')).not.toBeInTheDocument();
  await userEvent.click(saveButton());
  await waitFor(() => expect(list.onSubmit).toHaveBeenCalled());

  expect(requests()).toEqual([
    'GET /api/v1/dashboard/26',
    'GET /api/v1/theme/',
    'PUT /api/v1/dashboard/26',
  ]);
  expect(dashboardPuts()).toEqual([FLAG_OFF_BODY]);

  cleanupModal();
  const header = renderHeader(metadataWith(FLAG_OFF_KEY));
  await form();
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(header.onSubmit).toHaveBeenCalled());
  expect(requests()).toEqual(['GET /api/v1/theme/']);
  expect(appliedKey(header.onSubmit)).toEqual(FLAG_OFF_KEY);

  cleanupModal();
  const edited = renderList();
  await form();
  await userEvent.click(screen.getByText('Advanced settings'));
  const { value: jsonMetadata } = await jsonEditor();
  const editedKey = storedKey({ max_span: weeks(2) });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'JSON metadata editor' }),
    {
      target: {
        value: JSON.stringify({
          ...JSON.parse(jsonMetadata),
          time_range_limits: editedKey,
        }),
      },
    },
  );
  await userEvent.click(saveButton());
  await waitFor(() => expect(edited.onSubmit).toHaveBeenCalled());
  expect(sentKey()).toEqual(editedKey);
});

test('limits GET uses 10 s and no retries', async () => {
  limitsOn();
  const response = deferred();
  routes({
    metadata: metadataWith(FLAG_OFF_KEY),
    get: () => response.promise,
  });
  const get = jest.spyOn(SupersetCore.SupersetClient, 'get');
  const props = renderList();
  await form();

  expect(
    get.mock.calls.filter(
      ([request]) =>
        request?.endpoint === '/api/v1/dashboard/26/time_range_limits/',
    ),
  ).toEqual([
    [
      {
        endpoint: '/api/v1/dashboard/26/time_range_limits/',
        timeout: 10000,
        fetchRetryOptions: { retries: 0 },
      },
    ],
  ]);

  // The section sits between Refresh settings and Certification.
  const titles = ['Refresh settings', 'Time range limits', 'Certification'].map(
    title => screen.getByText(title),
  );
  expect(
    titles[0].compareDocumentPosition(titles[1]) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    titles[1].compareDocumentPosition(titles[2]) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    screen.getByText(
      'Limit how wide a time range any chart on this dashboard can query',
    ),
  ).toBeInTheDocument();

  const region = await openLimits();
  expect(region).toHaveAttribute('aria-busy', 'true');
  expect(spanQuantity()).toBeDisabled();

  await setTitle('Pending limits');
  expect(saveButton()).toBeDisabled();
  expect(dashboardPuts()).toEqual([]);

  response.resolve(limitsResponse());
  await rowsReady();
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(dashboardPuts()[0].dashboard_title).toBe('Pending limits');
  expect(limitsPuts()).toEqual([]);
  get.mockRestore();
});

test('a late failure of a superseded limits GET leaves the newer result in place', async () => {
  limitsOn();
  const first = deferred();
  let calls = 0;
  routes({
    get: () => {
      calls += 1;
      return calls === 1 ? first.promise : limitsResponse();
    },
  });
  const props = { ...createProps(), onSubmit: jest.fn(), onHide: jest.fn() };
  const { rerender } = render(<PropertiesModal {...props} />, {
    store: createStore({}, reducerIndex),
  });
  await form();
  rerender(<PropertiesModal {...props} show={false} />);
  rerender(<PropertiesModal {...props} show />);
  await openLimits();
  await rowsReady();

  await act(async () => {
    first.resolve(unavailable());
    await new Promise(done => setTimeout(done, 0));
  });
  expect(calls).toBe(2);
  expect(screen.queryByText(LOAD_ERROR)).not.toBeInTheDocument();
  expect(spanQuantity()).toBeEnabled();
});

test('load failure shows Retry and sends one request per click', async () => {
  limitsOn();
  routes({ get: unavailable() });
  renderList();
  const region = await openLimits();
  const getCalls = () =>
    requests().filter(
      request =>
        request.includes('time_range_limits') && !request.includes('/charts/'),
    ).length;

  const firstAlert = await within(region).findByRole('alert');
  expect(firstAlert).toHaveTextContent(LOAD_ERROR);
  expect(getCalls()).toBe(1);
  expect(screen.queryAllByRole('table')).toHaveLength(0);
  expect(
    within(firstAlert).queryByRole('button', {
      name: 'Remove dashboard limits',
    }),
  ).not.toBeInTheDocument();

  fetchMock.modifyRoute('limits-get', {
    response: { status: 500, body: {} },
  });
  const firstRetry = within(firstAlert).getByRole('button', { name: /Retry/ });
  firstRetry.focus();
  await userEvent.click(firstRetry);
  await waitFor(() =>
    expect(within(region).getByRole('alert')).not.toBe(firstAlert),
  );
  expect(getCalls()).toBe(2);
  const secondRetry = within(within(region).getByRole('alert')).getByRole(
    'button',
    { name: /Retry/ },
  );
  expect(secondRetry).not.toBe(firstRetry);
  await waitFor(() => expect(secondRetry).toHaveFocus());

  fetchMock.modifyRoute('limits-get', { response: limitsResponse() });
  await userEvent.click(secondRetry);
  await rowsReady();
  expect(getCalls()).toBe(3);
});

test('a load failure with no unit value shows the generic text', async () => {
  limitsOn();
  routes({
    metadata: metadataWith(storedKey({ max_span: null })),
    get: unavailable({ source: 'dashboard', field: 'max_span.time_grain' }),
  });
  renderList();
  await openLimits();

  await screen.findByText(LOAD_ERROR);
  expect(screen.queryByText(/Configured time grain/)).not.toBeInTheDocument();
});

test('stale unit is removed in the same save', async () => {
  limitsOn();
  const badKey = storedKey({ max_span: { quantity: 3, time_grain: 'P1D' } });
  const failure = unavailable({
    source: 'dashboard',
    field: 'max_span.time_grain',
    value: 'P1D',
  });

  // List view: Save is disabled with the reason until Remove.
  routes({ metadata: metadataWith(badKey), get: failure });
  const list = renderList();
  await openLimits();
  expect(await screen.findByText(UNIT_GONE)).toBeInTheDocument();
  await waitFor(() => expect(saveButton()).toBeDisabled());
  await userEvent.hover(saveButton());
  expect(
    await screen.findByText(`Time range limits: ${UNIT_GONE}`, {
      exact: false,
    }),
  ).toBeInTheDocument();

  await userEvent.click(
    screen.getByRole('button', { name: 'Remove dashboard limits' }),
  );
  expect(
    await screen.findByText('Dashboard limits will be removed when you save.'),
  ).toBeInTheDocument();
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() => expect(list.onSubmit).toHaveBeenCalled());
  expect(limitsPuts()).toEqual([]);
  expect(sentKey()).toBeNull();
  cleanupModal();

  // A dashboard failure without a unit still blocks Save, with the load text.
  routes({
    metadata: metadataWith(storedKey({ max_span: weeks(0) })),
    get: unavailable({ source: 'dashboard', field: 'max_span.quantity' }),
  });
  renderList();
  await openLimits();
  await waitFor(() => expect(saveButton()).toBeDisabled());
  await userEvent.hover(saveButton());
  expect(
    await screen.findByText(`Time range limits: ${LOAD_ERROR}`, {
      exact: false,
    }),
  ).toBeInTheDocument();
  await userEvent.click(
    screen.getByRole('button', { name: 'Remove dashboard limits' }),
  );
  await waitFor(() => expect(saveButton()).toBeEnabled());
  cleanupModal();

  // Header: Remove goes with the header Save; Apply writes nothing.
  routes({ get: failure });
  const header = renderHeader(metadataWith(badKey));
  await openLimits();
  await userEvent.click(
    await screen.findByRole('button', { name: 'Remove dashboard limits' }),
  );
  await waitFor(() => expect(saveButton('Apply')).toBeEnabled());
  expect(screen.queryByText(APPLY_NOTE)).not.toBeInTheDocument();
  await userEvent.click(saveButton('Apply'));
  await waitFor(() => expect(header.onSubmit).toHaveBeenCalled());
  expect(appliedKey(header.onSubmit)).toBeNull();
  expect(requests().filter(request => request.startsWith('PUT'))).toEqual([]);
  cleanupModal();

  // Reopened before the header Save: the removal is still pending.
  routes({ get: failure });
  const reopened = renderHeader(metadataWith());
  await openLimits();
  expect(
    await screen.findByText('Dashboard limits will be removed when you save.'),
  ).toBeInTheDocument();
  await waitFor(() => expect(saveButton('Apply')).toBeEnabled());
  await userEvent.click(saveButton('Apply'));
  await waitFor(() => expect(reopened.onSubmit).toHaveBeenCalled());
  expect(appliedKey(reopened.onSubmit)).toBeNull();
});

test('global load failure keeps other edits', async () => {
  limitsOn();
  routes({
    metadata: metadataWith(FLAG_OFF_KEY),
    get: unavailable({
      source: 'global',
      field: 'max_span.time_grain',
      value: 'P1D',
    }),
  });
  const props = renderList();
  await openLimits();
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(UNIT_GONE);
  expect(
    within(alert)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['Retry']);

  await setTitle('Other edit');
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(dashboardPuts()[0].dashboard_title).toBe('Other edit');
  expect(sentKey()).toEqual(FLAG_OFF_KEY);
  expect(limitsPuts()).toEqual([]);
});

test('invalid section disables Save with a tooltip', async () => {
  limitsOn();
  routes({
    get: limitsResponse({ dashboard: limits({ max_span: weeks(12) }) }),
  });
  renderList();
  await openLimits();
  await rowsReady();
  const label = screen.getByTestId('time-range-limits-section');
  expect(
    within(label).getByRole('img', { name: 'check-circle' }),
  ).toBeInTheDocument();

  await setSpan('13');
  const message = await screen.findByText(
    "Can't be longer than the admin limit (12 weeks)",
  );
  expect(spanQuantity()).toHaveAttribute('aria-invalid', 'true');
  expect(spanQuantity()).toHaveAttribute('aria-describedby', message.id);
  await waitFor(() => expect(saveButton()).toBeDisabled());
  expect(
    within(label).getByRole('img', { name: 'exclamation-circle' }),
  ).toBeInTheDocument();
  await userEvent.hover(saveButton());
  expect(
    await screen.findByText(
      "Time range limits: Can't be longer than the admin limit (12 weeks)",
      { exact: false },
    ),
  ).toBeInTheDocument();

  await setSpan('11');
  await waitFor(() => expect(saveButton()).toBeEnabled());
});

test("stale value doesn't block other edits", async () => {
  limitsOn();
  const stale = limits({ max_span: { quantity: 2, time_grain: 'P1M' } });
  routes({
    metadata: metadataWith(storedKey(stale)),
    get: limitsResponse({
      global: limits({ max_span: { quantity: 30, time_grain: 'P1D' } }),
      dashboard: stale,
      needsReview: [{ rule: 'max_span', reason: 'LOOSER_THAN_GLOBAL' }],
    }),
  });
  const props = renderList();
  await openLimits();
  expect(
    await screen.findByText(
      "Your admin's limit (30 days) is stricter than 2 months, so 30 days applies.",
    ),
  ).toBeInTheDocument();

  await setTitle('Stale but fine');
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(limitsPuts()).toEqual([]);
  expect(sentKey()).toEqual(storedKey(stale));
});

test('list save sends the limits with the dashboard', async () => {
  limitsOn();
  const reload = jest
    .spyOn(limitsActions, 'refetchTimeRangeLimitsAfterSave')
    .mockReturnValue(() => Promise.resolve());
  const saved = limits({ max_span: weeks(4) });
  routes({ get: limitsResponse(), put: limitsResponse({ dashboard: saved }) });
  const props = renderList();
  await openLimits();
  await rowsReady();
  await setTitle('Renamed');
  await setSpan('4', 'Week');
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());

  expect(requests().filter(request => request.startsWith('PUT'))).toEqual([
    'PUT /api/v1/dashboard/26',
  ]);
  expect(limitsPuts()).toEqual([]);
  expect(dashboardPuts()[0].dashboard_title).toBe('Renamed');
  expect(sentKey()).toEqual(storedKey(saved));
  expect(reload).toHaveBeenCalledWith(26, saved);
  reload.mockRestore();
});

test('a dashboard save that fails saves no limits', async () => {
  limitsOn();
  const saved = limits({ max_span: weeks(4) });
  routes({
    get: limitsResponse(),
    put: limitsResponse({ dashboard: saved }),
    dashboardPut: {
      status: 500,
      body: { message: 'Internal error' },
    },
  });
  const store = createStore({}, reducerIndex);
  const props = renderList(store);
  const save = () => screen.getByRole('button', { name: /Save$/ });
  await openLimits();
  await rowsReady();
  await setSpan('4', 'Week');
  await userEvent.click(save());
  await waitFor(() => expect(dashboardPuts()).toHaveLength(1));
  expect(limitsPuts()).toEqual([]);
  expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument();
  expect(
    (store.getState() as unknown as { messageToasts: { text: string }[] })
      .messageToasts.length,
  ).toBe(1);
  expect(props.onHide).not.toHaveBeenCalled();
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(spanQuantity()).toHaveValue('4');

  // 503: the save failure line alone, as a failed limits write shows it.
  fetchMock.modifyRoute('dashboard-put', { response: unavailable() });
  await userEvent.click(save());
  await waitFor(() => expect(dashboardPuts()).toHaveLength(2));
  expect(screen.getByText(SAVE_ERROR)).toBeInTheDocument();
  expect(
    (store.getState() as unknown as { messageToasts: { text: string }[] })
      .messageToasts.length,
  ).toBe(1);

  fetchMock.modifyRoute('dashboard-put', { response: { result: {} } });
  await userEvent.click(save());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(limitsPuts()).toEqual([]);
  expect(dashboardPuts()).toHaveLength(3);
  expect(sentKey(2)).toEqual(storedKey(saved));
});

test('a dashboard save refused for another field shows its toast, not the limits save failure', async () => {
  limitsOn();
  routes({
    get: limitsResponse(),
    put: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
    dashboardPut: {
      status: 422,
      body: { message: { slug: ['Must be unique'] } },
    },
  });
  const store = createStore({}, reducerIndex);
  const props = renderList(store);
  await openLimits();
  await rowsReady();
  await setSpan('4', 'Week');
  await userEvent.click(screen.getByRole('button', { name: /Save$/ }));
  await waitFor(() =>
    expect(
      (store.getState() as unknown as { messageToasts: { text: string }[] })
        .messageToasts,
    ).toHaveLength(1),
  );
  expect(screen.queryByText(SAVE_ERROR)).not.toBeInTheDocument();
  expect(limitsPuts()).toEqual([]);
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(spanQuantity()).toHaveValue('4');
});

const RETRIED_503 = { timeout: 8000 };

test('a 503 that is not a limit failure still shows its toast, a limit one does not', async () => {
  limitsOn();
  routes({
    get: limitsResponse(),
    put: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
    dashboardPut: {
      status: 503,
      body: { message: 'Upstream unavailable' },
    },
  });
  const store = createStore({}, reducerIndex);
  renderList(store);
  const save = () => screen.getByRole('button', { name: /Save$/ });
  const toasts = () =>
    (store.getState() as unknown as { messageToasts: { text: string }[] })
      .messageToasts;
  await openLimits();
  await rowsReady();
  await setSpan('4', 'Week');
  await userEvent.click(save());
  await waitFor(() => expect(toasts()).toHaveLength(1), RETRIED_503);
  expect(toasts()[0].text).toBe('Upstream unavailable');

  fetchMock.modifyRoute('dashboard-put', { response: unavailable() });
  const putsBefore = dashboardPuts().length;
  await userEvent.click(save());
  await waitFor(
    () => expect(dashboardPuts().length).toBeGreaterThan(putsBefore + 3),
    RETRIED_503,
  );
  expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument();
  expect(toasts()).toHaveLength(1);
}, 30000);

test('apply writes the saved policy into the metadata', async () => {
  limitsOn();
  // Analyze J2: the page holds 9 weeks, the server 4 weeks.
  routes({
    get: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
  });
  const untouched = renderHeader(
    metadataWith(storedKey({ max_span: weeks(9) })),
  );
  await openLimits();
  await rowsReady();
  await userEvent.click(saveButton('Apply'));
  await waitFor(() => expect(untouched.onSubmit).toHaveBeenCalled());
  expect(appliedKey(untouched.onSubmit)).toEqual(
    storedKey({ max_span: weeks(4) }),
  );
  expect(limitsPuts()).toEqual([]);
  cleanupModal();

  const saved = limits({ max_span: weeks(3) });
  routes({
    get: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
    put: limitsResponse({ dashboard: saved }),
  });
  const changed = renderHeader(metadataWith(storedKey({ max_span: weeks(9) })));
  await openLimits();
  await rowsReady();
  await setSpan('3');
  await userEvent.click(saveButton('Apply'));
  await waitFor(() => expect(changed.onSubmit).toHaveBeenCalled());
  expect(limitsPuts()).toEqual([{ policy: { schema_version: 1, ...saved } }]);
  expect(appliedKey(changed.onSubmit)).toEqual(storedKey(saved));
  expect(dashboardPuts()).toEqual([]);
});

test('clearing the number of a stored rule is no error and saves no policy', async () => {
  limitsOn();
  routes({
    get: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
    put: limitsResponse({ dashboard: limits() }),
  });
  const props = renderHeader(metadataWith(storedKey({ max_span: weeks(4) })));
  await openLimits();
  await rowsReady();
  await setSpan('');

  expect(screen.queryByText('Enter a number.')).not.toBeInTheDocument();
  expect(saveButton('Apply')).toBeEnabled();
  await userEvent.click(saveButton('Apply'));
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(limitsPuts()).toEqual([{ policy: null }]);
});

test('picking only a unit on an empty rule sends no policy PUT', async () => {
  limitsOn();
  routes({ get: limitsResponse() });
  const props = renderHeader(metadataWith());
  await openLimits();
  await rowsReady();
  await setSpan('', 'Week');

  expect(screen.queryByText('Enter a number.')).not.toBeInTheDocument();
  await userEvent.click(saveButton('Apply'));
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(limitsPuts()).toEqual([]);
});

test('a saved policy PUT reloads the dashboard limits', async () => {
  limitsOn();
  const reload = jest
    .spyOn(limitsActions, 'refetchTimeRangeLimitsAfterSave')
    .mockReturnValue(() => Promise.resolve());
  const saved = limits({ max_span: weeks(3) });
  routes({ get: limitsResponse(), put: limitsResponse({ dashboard: saved }) });
  const props = renderHeader(metadataWith());
  await openLimits();
  await rowsReady();
  await setSpan('3', 'Week');
  await userEvent.click(saveButton('Apply'));
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());

  expect(reload).toHaveBeenCalledWith(26, saved);
  reload.mockRestore();
});

test('untouched section keeps the current key', async () => {
  limitsOn();
  const nineWeeks = storedKey({ max_span: weeks(9) });

  routes({
    metadata: metadataWith(nineWeeks),
    get: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
  });
  let props = renderList();
  await openLimits();
  await rowsReady();
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(sentKey()).toEqual(storedKey({ max_span: weeks(4) }));
  cleanupModal();

  routes({ metadata: metadataWith(nineWeeks), get: limitsResponse() });
  props = renderList();
  await openLimits();
  await rowsReady();
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(sentKey()).toBeNull();
  cleanupModal();

  routes({ get: limitsResponse() });
  const header = renderHeader(metadataWith(nineWeeks));
  await openLimits();
  await rowsReady();
  await userEvent.click(saveButton('Apply'));
  await waitFor(() => expect(header.onSubmit).toHaveBeenCalled());
  expect(appliedKey(header.onSubmit)).toBeNull();
  cleanupModal();

  const pending = deferred();
  routes({ metadata: metadataWith(nineWeeks), get: () => pending.promise });
  props = renderList();
  await openLimits();
  expect(saveButton()).toBeDisabled();
  pending.resolve(
    limitsResponse({ dashboard: limits({ max_span: weeks(9) }) }),
  );
  await rowsReady();
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(sentKey()).toEqual(nineWeeks);
  cleanupModal();

  const absent = deferred();
  routes({ get: () => absent.promise });
  props = renderList();
  await openLimits();
  expect(saveButton()).toBeDisabled();
  absent.resolve(limitsResponse());
  await rowsReady();
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(sentKey()).toBeNull();
});

test('failed limits save keeps values', async () => {
  limitsOn();
  const applyColors = jest.spyOn(colorScheme, 'applyColors');
  routes({
    get: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
    dashboardPut: {
      status: 422,
      body: {
        message: {
          'json_metadata.time_range_limits.max_span.quantity': [
            'Dashboard maximum span must be 12 weeks or less.',
          ],
        },
      },
    },
  });
  const store = createStore({}, reducerIndex);
  const props = renderList(store);
  await openLimits();
  await rowsReady();
  await setSpan('5');
  await userEvent.click(saveButton());
  const message = await screen.findByText(
    'Dashboard maximum span must be 12 weeks or less.',
  );
  expect(spanQuantity()).toHaveAttribute('aria-describedby', message.id);
  expect(spanQuantity()).toHaveValue('5');
  expect(dashboardPuts()).toHaveLength(1);
  expect(limitsPuts()).toEqual([]);
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(props.onHide).not.toHaveBeenCalled();
  expect(
    (store.getState() as unknown as { messageToasts: { text: string }[] })
      .messageToasts,
  ).toEqual([]);

  // The server message goes when its row changes.
  await setSpan('6');
  await waitFor(() =>
    expect(
      screen.queryByText('Dashboard maximum span must be 12 weeks or less.'),
    ).not.toBeInTheDocument(),
  );

  // 500: the save failure line with Retry, values kept; Retry submits again.
  fetchMock.modifyRoute('dashboard-put', {
    response: { status: 500, body: {} },
  });
  await userEvent.click(saveButton());
  expect(await screen.findByText(SAVE_ERROR)).toBeInTheDocument();
  expect(spanQuantity()).toHaveValue('6');
  expect(dashboardPuts()).toHaveLength(2);
  const failedAlert = screen.getByText(SAVE_ERROR).closest('[role="alert"]')!;
  await userEvent.click(
    within(failedAlert as HTMLElement).getByRole('button', { name: 'Retry' }),
  );
  await waitFor(() => expect(dashboardPuts()).toHaveLength(3));
  expect(limitsPuts()).toEqual([]);
  expect(props.onSubmit).not.toHaveBeenCalled();
  applyColors.mockRestore();
});

test('failed limits save keeps values: one PUT per double click, null when blank', async () => {
  limitsOn();
  const first = deferred();
  routes({
    get: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
    dashboardPut: () => first.promise,
  });
  const twice = renderList();
  await openLimits();
  await rowsReady();
  await setSpan('');
  await userEvent.click(spanUnit());
  await userEvent.click(
    // eslint-disable-next-line testing-library/no-node-access
    spanUnit().closest('.ant-select')!.querySelector('.ant-select-clear')!,
  );
  await waitFor(() => expect(saveButton()).toBeEnabled());
  const save = () => screen.getByRole('button', { name: /Save$/ });
  const pause = () =>
    act(async () => {
      await new Promise(done => setTimeout(done, 100));
    });

  await userEvent.click(save());
  await waitFor(() => expect(dashboardPuts()).toHaveLength(1));
  expect(save()).toHaveClass('ant-btn-loading');
  await userEvent.click(save());
  await pause();
  expect(dashboardPuts()).toHaveLength(1);
  expect(limitsPuts()).toEqual([]);
  expect(save()).toHaveClass('ant-btn-loading');

  // Retry stays clickable while its PUT is pending.
  const second = deferred();
  fetchMock.modifyRoute('dashboard-put', { response: () => second.promise });
  await act(async () => {
    first.resolve({ status: 500, body: {} });
  });
  const retry = () =>
    within(
      screen.getByText(SAVE_ERROR).closest('[role="alert"]') as HTMLElement,
    ).getByRole('button', { name: 'Retry' });
  await userEvent.click(retry());
  await waitFor(() => expect(dashboardPuts()).toHaveLength(2));
  await userEvent.click(retry());
  await pause();
  expect(dashboardPuts()).toHaveLength(2);
  expect(limitsPuts()).toEqual([]);

  await act(async () => {
    second.resolve({ result: {} });
  });
  await waitFor(() => expect(twice.onSubmit).toHaveBeenCalledTimes(1));
  expect(limitsPuts()).toEqual([]);
  expect(dashboardPuts()).toHaveLength(2);
  expect(sentKey(0)).toBeNull();
  expect(sentKey(1)).toBeNull();
});

test('failed limits save keeps values: invalid json saves no limits', async () => {
  limitsOn();
  routes({ get: limitsResponse(), put: limitsResponse() });
  const store = createStore({}, reducerIndex);
  const invalid = renderList(store);
  await openLimits();
  await rowsReady();
  await setSpan('2', 'Week');
  await userEvent.click(screen.getByText('Advanced settings'));
  fireEvent.change(await jsonEditor(), { target: { value: '[]' } });
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() =>
    expect(
      (
        store.getState() as unknown as { messageToasts: { text: string }[] }
      ).messageToasts.map(toast => toast.text),
    ).toContain('JSON metadata is invalid!'),
  );
  expect(limitsPuts()).toEqual([]);
  expect(invalid.onSubmit).not.toHaveBeenCalled();
});

test('advanced json omits the limits key', async () => {
  limitsOn();
  const nineWeeks = storedKey({ max_span: weeks(9) });
  routes({
    metadata: metadataWith(nineWeeks),
    get: limitsResponse({ dashboard: limits({ max_span: weeks(9) }) }),
  });
  const props = renderList();
  await openLimits();
  await rowsReady();
  await userEvent.click(screen.getByText('Advanced settings'));
  const { value: jsonMetadata } = await jsonEditor();
  expect(JSON.parse(jsonMetadata)).not.toHaveProperty('time_range_limits');
  expect(JSON.parse(jsonMetadata)).toHaveProperty('color_scheme');

  fireEvent.change(
    screen.getByRole('textbox', { name: 'JSON metadata editor' }),
    {
      target: {
        value: JSON.stringify({
          ...JSON.parse(jsonMetadata),
          time_range_limits: storedKey({ max_span: weeks(1) }),
        }),
      },
    },
  );
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(sentKey()).toEqual(nineWeeks);
});

test('apply note in the header only', async () => {
  limitsOn();
  routes();
  renderHeader(metadataWith());
  await openLimits();
  expect(await screen.findByText(APPLY_NOTE)).toBeInTheDocument();
  cleanupModal();

  routes();
  renderList();
  await openLimits();
  await rowsReady();
  expect(screen.queryByText(APPLY_NOTE)).not.toBeInTheDocument();
});

test('a dashboard PUT error on the limits key shows on its field', async () => {
  limitsOn();
  const message = 'Dashboard maximum span must be 12 weeks or less.';
  routes({
    metadata: metadataWith(storedKey({ max_span: weeks(4) })),
    get: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
    dashboardPut: {
      status: 422,
      body: {
        message: {
          'json_metadata.time_range_limits.max_span.quantity': [message],
        },
      },
    },
  });
  const props = renderList();
  await openLimits();
  await rowsReady();
  await userEvent.click(saveButton());
  const error = await screen.findByText(message);
  expect(spanQuantity()).toHaveAttribute('aria-describedby', error.id);
  expect(props.onSubmit).not.toHaveBeenCalled();
});

test('no eligible units: no limits PUT, the save carries the GET value', async () => {
  limitsOn();
  routes({
    metadata: metadataWith(storedKey({ max_span: weeks(9) })),
    get: limitsResponse({ global: limits(), eligible: [] }),
  });
  const props = renderList();
  await openLimits();
  expect(
    await screen.findByText('No eligible time grains configured'),
  ).toBeInTheDocument();
  expect(spanQuantity()).toBeDisabled();
  await setTitle('No units');
  await waitFor(() => expect(saveButton()).toBeEnabled());
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(limitsPuts()).toEqual([]);
  expect(sentKey()).toBeNull();
});

const saveChecks = () =>
  fetchMock.callHistory
    .calls('save-check')
    .map(call => decodeURIComponent(new URL(call.url).search));
const pastTheDelay = () => new Promise(done => setTimeout(done, 800));
const WARNING_HEADING =
  'These charts use their own time range, which this dashboard\'s limits don\'t allow. Viewers see "Waiting for a valid time range" on them until you change it.';
const CHECK_FAILED = 'Charts could not be checked against these limits.';
const REFUSED = {
  result: {
    charts: [
      {
        id: 7,
        slice_name: 'Calls by queue',
        url: '/explore/?slice_id=7',
        range: 'Last year',
        time_offset: null,
        reason_code: 'MAX_LOOK_BACK_EXCEEDED',
        rule: 'max_look_back',
        source: 'global',
        message: "Start can't be earlier than 1 year ago.",
      },
    ],
    filters: [],
    unlimited: [],
    unchecked: [],
  },
};

function renderListWithRouter() {
  const props = { ...createProps(), onSubmit: jest.fn(), onHide: jest.fn() };
  render(<PropertiesModal {...props} />, {
    store: createStore({}, reducerIndex),
    useRouter: true,
  });
  return props;
}

test('no limits no save check', async () => {
  limitsOn();
  routes({ get: limitsResponse({ global: limits() }) });
  renderList();
  const region = await openLimits();
  await rowsReady();
  await pastTheDelay();
  expect(saveChecks()).toEqual([]);
  expect(within(region).queryAllByRole('alert')).toHaveLength(0);
  expect(within(region).queryByText(CHECK_FAILED)).not.toBeInTheDocument();
});

test('dataset rule alone sends the check', async () => {
  limitsOn();
  routes({
    get: limitsResponse({
      global: limits(),
      datasets: [
        { id: 3, name: 'Calls', policy: limits({ max_span: weeks(4) }) },
      ],
    }),
  });
  renderList();
  await openLimits();
  await rowsReady();
  await waitFor(() => expect(saveChecks()).toEqual(['?q=(policy:!n)']), {
    timeout: 3000,
  });
});

test('no save check until loaded', async () => {
  limitsOn();
  const response = deferred();
  routes({ get: () => response.promise });
  renderList();
  await openLimits();
  await pastTheDelay();
  expect(saveChecks()).toEqual([]);

  // A dashboard with no own limit under a global: only `enabled` turns on.
  response.resolve(limitsResponse());
  await rowsReady();
  await waitFor(() => expect(saveChecks()).toEqual(['?q=(policy:!n)']), {
    timeout: 3000,
  });
  await setSpan('4', 'Week');
  await waitFor(() => expect(saveChecks()).toHaveLength(2), { timeout: 3000 });
  expect(saveChecks()[1]).toBe(
    '?q=(policy:(max_look_back:!n,max_look_forward:!n,max_span:(quantity:4,time_grain:P1W),schema_version:1))',
  );
});

test('save check failure never blocks', async () => {
  limitsOn();
  routes({
    get: limitsResponse({ dashboard: limits({ max_span: weeks(4) }) }),
    check: unavailable(),
  });
  const props = renderList();
  const region = await openLimits();
  expect(
    await within(region).findByText(CHECK_FAILED, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(
    within(region).queryByRole('button', { name: /Retry/ }),
  ).not.toBeInTheDocument();
  expect(saveButton()).toBeEnabled();
  await userEvent.click(saveButton());
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalled());
  expect(props.onHide).toHaveBeenCalled();
});

test('warning never blocks save', async () => {
  limitsOn();
  const saved = limits({ max_span: weeks(4) });
  const saveWith = async (check: Answer, warned: boolean) => {
    cleanupModal();
    routes({
      get: limitsResponse({ dashboard: limits({ max_span: weeks(6) }) }),
      put: limitsResponse({ dashboard: saved }),
      check,
    });
    const props = renderListWithRouter();
    const region = await openLimits();
    await rowsReady();
    await setSpan('4');
    await waitFor(
      () => expect(saveChecks().at(-1)).toContain('quantity:4,time_grain:P1W'),
      { timeout: 3000 },
    );
    await waitFor(
      () =>
        expect(within(region).queryAllByText(WARNING_HEADING)).toHaveLength(
          warned ? 1 : 0,
        ),
      { timeout: 3000 },
    );
    const label = screen.getByTestId('time-range-limits-section');
    expect(
      within(label).getByTestId(warned ? 'warning' : 'check-circle'),
    ).toBeInTheDocument();
    await waitFor(() => expect(saveButton()).toBeEnabled());
    expect(within(region).queryByText(WARNING_HEADING) !== null).toBe(warned);
    await userEvent.click(saveButton());
    await waitFor(() => expect(props.onHide).toHaveBeenCalled());
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
    return {
      requests: requests().filter(request => !request.includes('/charts/')),
      limitsPuts: limitsPuts(),
      dashboardPuts: dashboardPuts(),
    };
  };

  const withWarning = await saveWith(REFUSED, true);
  const without = await saveWith(NO_REFUSALS, false);
  expect(withWarning).toEqual(without);
  expect(withWarning.limitsPuts).toEqual([]);
  expect(
    JSON.parse(withWarning.dashboardPuts[0].json_metadata).time_range_limits,
  ).toEqual(storedKey(saved));

  // The header opener: Apply too.
  cleanupModal();
  routes({
    get: limitsResponse({ dashboard: limits({ max_span: weeks(6) }) }),
    check: REFUSED,
  });
  const header = {
    ...createProps(),
    onlyApply: true,
    onSubmit: jest.fn(),
    onHide: jest.fn(),
    dashboardInfo: {
      ...LIMITS_DASHBOARD,
      metadata: metadataWith(storedKey({ max_span: weeks(6) })),
    },
  };
  render(<PropertiesModal {...header} />, { useRedux: true, useRouter: true });
  const region = await openLimits();
  expect(
    await within(region).findByText(WARNING_HEADING, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(saveButton('Apply')).toBeEnabled();
  await userEvent.click(saveButton('Apply'));
  await waitFor(() => expect(header.onSubmit).toHaveBeenCalled());
  expect(header.onHide).toHaveBeenCalled();
  expect(appliedKey(header.onSubmit)).toEqual(
    storedKey({ max_span: weeks(6) }),
  );
});

test('section header: warning icon with the save check warning, error icon with a field error, check otherwise', async () => {
  limitsOn();
  routes({
    get: limitsResponse({
      global: limits({ max_span: weeks(12) }),
      dashboard: limits({ max_span: weeks(6) }),
    }),
    check: REFUSED,
  });
  renderListWithRouter();
  const region = await openLimits();
  await rowsReady();
  const label = screen.getByTestId('time-range-limits-section');
  expect(
    await within(region).findByText(WARNING_HEADING, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  const warningIcon = within(label).getByTestId('warning');
  expect(warningIcon).toHaveAttribute('aria-hidden', 'true');
  expect(within(label).getByText('Time range limits')).toContainElement(
    warningIcon,
  );
  expect(
    within(label).queryByRole('img', { name: 'check-circle' }),
  ).not.toBeInTheDocument();

  await setSpan('13');
  await screen.findByText("Can't be longer than the admin limit (12 weeks)");
  await waitFor(() =>
    expect(
      within(label).getByRole('img', { name: 'exclamation-circle' }),
    ).toBeInTheDocument(),
  );
  expect(within(label).queryByTestId('warning')).not.toBeInTheDocument();

  fetchMock.modifyRoute('save-check', { response: NO_REFUSALS });
  await setSpan('5');
  await waitFor(
    () =>
      expect(
        within(label).getByRole('img', { name: 'check-circle' }),
      ).toBeInTheDocument(),
    { timeout: 3000 },
  );
  expect(within(label).queryByTestId('warning')).not.toBeInTheDocument();
});

const sectionIcon = (name: string) =>
  within(screen.getByTestId('time-range-limits-section')).queryByRole('img', {
    name,
  });

test('no header icon while the limits load', async () => {
  limitsOn();
  const held = deferred();
  routes({ get: () => held.promise });
  renderList();
  await openLimits();
  expect(sectionIcon('check-circle')).not.toBeInTheDocument();
  expect(sectionIcon('exclamation-circle')).not.toBeInTheDocument();

  await act(async () => {
    held.resolve(limitsResponse());
  });
  await rowsReady();
  expect(sectionIcon('check-circle')).toBeInTheDocument();
});

test('no header icon after a global load failure, Apply stays enabled', async () => {
  limitsOn();
  routes({
    get: unavailable({
      source: 'global',
      field: 'max_span.time_grain',
      value: 'P1D',
    }),
  });
  renderList();
  await openLimits();
  await screen.findByText(LOAD_ERROR);
  expect(sectionIcon('check-circle')).not.toBeInTheDocument();
  expect(sectionIcon('exclamation-circle')).not.toBeInTheDocument();
  await setTitle('Other edit');
  await waitFor(() => expect(saveButton()).toBeEnabled());
});

test('no header icon without eligible units', async () => {
  limitsOn();
  routes({ get: limitsResponse({ global: limits(), eligible: [] }) });
  renderList();
  await openLimits();
  expect(
    await screen.findByText('No eligible time grains configured'),
  ).toBeInTheDocument();
  expect(sectionIcon('check-circle')).not.toBeInTheDocument();
  expect(sectionIcon('exclamation-circle')).not.toBeInTheDocument();
});

test('red header icon after a dashboard load failure', async () => {
  limitsOn();
  routes({
    metadata: metadataWith(storedKey({ max_span: weeks(0) })),
    get: unavailable({ source: 'dashboard', field: 'max_span.quantity' }),
  });
  renderList();
  await openLimits();
  await waitFor(() => expect(saveButton()).toBeDisabled());
  expect(sectionIcon('exclamation-circle')).toBeInTheDocument();
  expect(sectionIcon('check-circle')).not.toBeInTheDocument();
});

test('a second Retry while the retry PUT runs keeps Apply loading', async () => {
  limitsOn();
  const second = deferred();
  routes({ get: limitsResponse(), dashboardPut: { status: 500, body: {} } });
  const props = renderList();
  const save = () => screen.getByRole('button', { name: /Save$/ });
  await openLimits();
  await rowsReady();
  await setSpan('2', 'Week');
  await waitFor(() => expect(save()).toBeEnabled());
  await userEvent.click(save());
  const retry = () =>
    within(
      screen.getByText(SAVE_ERROR).closest('[role="alert"]') as HTMLElement,
    ).getByRole('button', { name: 'Retry' });
  await waitFor(() => expect(retry()).toBeEnabled());
  expect(dashboardPuts()).toHaveLength(1);

  fetchMock.modifyRoute('dashboard-put', { response: () => second.promise });
  await userEvent.click(retry());
  await waitFor(() => expect(dashboardPuts()).toHaveLength(2));
  expect(save()).toHaveClass('ant-btn-loading');
  await userEvent.click(retry());
  await act(async () => {
    await new Promise(done => setTimeout(done, 0));
  });
  expect(save()).toHaveClass('ant-btn-loading');
  expect(dashboardPuts()).toHaveLength(2);

  await act(async () => {
    second.resolve({ result: {} });
  });
  await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
  expect(dashboardPuts()).toHaveLength(2);
  expect(limitsPuts()).toEqual([]);
});

test('on a dashboard page the save-check links carry the page id', async () => {
  limitsOn();
  routes({
    get: limitsResponse({ dashboard: limits({ max_span: weeks(6) }) }),
    check: REFUSED,
  });
  const header = {
    ...createProps(),
    onlyApply: true,
    onSubmit: jest.fn(),
    onHide: jest.fn(),
    dashboardInfo: {
      ...LIMITS_DASHBOARD,
      metadata: metadataWith(storedKey({ max_span: weeks(6) })),
    },
  };
  render(
    <DashboardPageIdContext.Provider value="PAGE-1">
      <PropertiesModal {...header} />
    </DashboardPageIdContext.Provider>,
    { useRedux: true, useRouter: true },
  );
  const region = await openLimits();
  const link = await within(region).findByRole(
    'link',
    { name: 'Calls by queue' },
    { timeout: 3000 },
  );
  expect(link).toHaveAttribute(
    'href',
    '/explore/?dashboard_page_id=PAGE-1&slice_id=7',
  );
});
