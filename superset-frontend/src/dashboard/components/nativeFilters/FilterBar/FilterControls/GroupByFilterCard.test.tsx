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
import fetchMock from 'fetch-mock';
import { LabeledValue } from '@superset-ui/core/components';
import {
  ChartCustomization,
  ChartCustomizationType,
  DatasourceType,
  NativeFilterTarget,
} from '@superset-ui/core';
import {
  render,
  screen,
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import { addDangerToast } from 'src/components/MessageToasts/actions';
import GroupByFilterCard, {
  createLabelSortComparator,
} from './GroupByFilterCard';

jest.mock('src/dashboard/actions/chartCustomizationActions', () => ({
  ...jest.requireActual('src/dashboard/actions/chartCustomizationActions'),
  setPendingChartCustomization: jest.fn(() => ({ type: 'MOCK_SET_PENDING' })),
}));

jest.mock('src/components/MessageToasts/actions', () => ({
  ...jest.requireActual('src/components/MessageToasts/actions'),
  addDangerToast: jest.fn(() => ({ type: 'MOCK_DANGER_TOAST' })),
}));

const mockedAddDangerToast = addDangerToast as unknown as jest.Mock;

const apple: LabeledValue = { value: 'a', label: 'Apple' };
const banana: LabeledValue = { value: 'b', label: 'Banana' };

test('sorts display values A-Z when sortAscending is true', () => {
  const compare = createLabelSortComparator(true);
  expect(compare(apple, banana)).toBeLessThan(0);
  expect(compare(banana, apple)).toBeGreaterThan(0);
});

test('sorts display values Z-A when sortAscending is false', () => {
  const compare = createLabelSortComparator(false);
  expect(compare(apple, banana)).toBeGreaterThan(0);
  expect(compare(banana, apple)).toBeLessThan(0);
});

test('preserves source order when sortAscending is unset', () => {
  const compare = createLabelSortComparator(undefined);
  expect(compare(apple, banana)).toBe(0);
  expect(compare(banana, apple)).toBe(0);
});

/**
 * Characterization tests (sc-111089 T002): pin the existing regular-dataset
 * behaviour BEFORE the type-aware refactor, so FR-004's "byte-identical"
 * regression guard is falsifiable. Each test uses a distinct dataset id —
 * cachedSupersetGet holds a module-level cache keyed by endpoint.
 */

const customization = (
  targets: Partial<NativeFilterTarget>[],
): ChartCustomization => ({
  id: 'cc-1',
  type: ChartCustomizationType.ChartCustomization,
  name: 'Group by control',
  filterType: 'chart_customization_dynamic_groupby',
  targets,
  scope: { rootPath: [], excluded: [] },
  defaultDataMask: {},
  controlValues: {},
});

const initialState = {
  dataMask: {},
  nativeFilters: { filters: {} },
};

const renderCard = (targets: Partial<NativeFilterTarget>[]) =>
  render(<GroupByFilterCard customizationItem={customization(targets)} />, {
    useRedux: true,
    initialState,
  });

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  mockedAddDangerToast.mockClear();
});

test('fetches the bare dataset endpoint with no query projection', async () => {
  fetchMock.get('glob:*/api/v1/dataset/301', {
    result: { table_name: 'Vehicle Sales', columns: [] },
  });

  renderCard([{ datasetId: 301 }]);

  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/dataset/301'),
    ).toHaveLength(1),
  );
  const { url } = fetchMock.callHistory.calls('glob:*/api/v1/dataset/301')[0];
  // Characterized: the full resource, no rison ?q= column projection.
  expect(url.endsWith('/api/v1/dataset/301')).toBe(true);
});

test('maps columns to options honouring filterable and verbose_name', async () => {
  fetchMock.get('glob:*/api/v1/dataset/302', {
    result: {
      table_name: 'Vehicle Sales',
      columns: [
        { column_name: 'deal_size', verbose_name: 'Deal Size' },
        { column_name: 'internal_only', filterable: false },
        { column_name: 'city' },
      ],
    },
  });

  renderCard([{ datasetId: 302 }]);
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/dataset/302'),
    ).toHaveLength(1),
  );

  const combobox = await screen.findByRole('combobox');
  userEvent.click(combobox);

  expect(await screen.findByText('Deal Size')).toBeInTheDocument();
  expect(screen.getByText('city')).toBeInTheDocument();
  // filterable === false columns are excluded from the options.
  expect(screen.queryByText('internal_only')).not.toBeInTheDocument();
});

test('fetch failure fires the danger toast and leaves options empty', async () => {
  fetchMock.get('glob:*/api/v1/dataset/303', 500);

  renderCard([{ datasetId: 303 }]);

  await waitFor(() => expect(mockedAddDangerToast).toHaveBeenCalled());
  // Characterized copy: dataset-flavoured noun + raw numeric id.
  expect(String(mockedAddDangerToast.mock.calls[0][0])).toMatch(/303/);

  const combobox = await screen.findByRole('combobox');
  userEvent.click(combobox);
  expect(screen.queryByText('Deal Size')).not.toBeInTheDocument();
});

test('normalizes legacy datasetId shapes: plain number, string, and {value} object', async () => {
  fetchMock.get('glob:*/api/v1/dataset/304', {
    result: { table_name: 'A', columns: [] },
  });
  fetchMock.get('glob:*/api/v1/dataset/305', {
    result: { table_name: 'B', columns: [] },
  });

  // string-shaped id
  renderCard([{ datasetId: '304' as unknown as number }]);
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/dataset/304'),
    ).toHaveLength(1),
  );

  // legacy {value} object shape
  renderCard([{ datasetId: { value: 305 } as unknown as number }]);
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls('glob:*/api/v1/dataset/305'),
    ).toHaveLength(1),
  );
});

/**
 * sc-111089 T010: wiring-altitude tests for the type-aware card. The hook's
 * branch matrix is proven in useDisplayControlDatasource.test.ts — these
 * cover the card's wiring: collision rendering, target persistence through
 * user interactions, and the error affordance.
 */

const { setPendingChartCustomization } = jest.requireMock(
  'src/dashboard/actions/chartCustomizationActions',
);

test('semantic-view target lists only the view dimensions under an id collision', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/306/structure', {
    result: {
      name: 'orders',
      dimensions: [{ name: 'Orders Status', type: 'VARCHAR' }],
    },
  });
  fetchMock.get('glob:*/api/v1/dataset/306', {
    result: {
      table_name: 'Vehicle Sales',
      columns: [{ column_name: 'address_line1' }],
    },
  });

  renderCard([{ datasetId: 306, datasourceType: DatasourceType.SemanticView }]);

  const combobox = await screen.findByRole('combobox');
  userEvent.click(combobox);

  expect(await screen.findByText('Orders Status')).toBeInTheDocument();
  expect(screen.queryByText('address_line1')).not.toBeInTheDocument();
  // The colliding dataset endpoint is never touched.
  expect(fetchMock.callHistory.calls('glob:*/api/v1/dataset/306')).toHaveLength(
    0,
  );
});

test('selecting a dimension persists a target that still carries datasourceType', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/307/structure', {
    result: {
      name: 'orders',
      dimensions: [{ name: 'Orders Users City', type: 'VARCHAR' }],
    },
  });
  fetchMock.get('glob:*/api/v1/dataset/307', { result: {} });

  renderCard([{ datasetId: 307, datasourceType: DatasourceType.SemanticView }]);

  const combobox = await screen.findByRole('combobox');
  userEvent.click(combobox);
  userEvent.click(await screen.findByText('Orders Users City'));

  await waitFor(() => expect(setPendingChartCustomization).toHaveBeenCalled());
  const persisted =
    setPendingChartCustomization.mock.calls[
      setPendingChartCustomization.mock.calls.length - 1
    ][0];
  expect(persisted.targets[0]).toMatchObject({
    datasetId: 307,
    datasourceType: DatasourceType.SemanticView,
  });
  // No refetch of the colliding dataset endpoint after the interaction.
  expect(fetchMock.callHistory.calls('glob:*/api/v1/dataset/307')).toHaveLength(
    0,
  );
});

test('clearing the selection keeps the datasource binding intact', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/308/structure', {
    result: {
      name: 'orders',
      dimensions: [{ name: 'Orders State', type: 'VARCHAR' }],
    },
  });

  renderCard([{ datasetId: 308, datasourceType: DatasourceType.SemanticView }]);

  const combobox = await screen.findByRole('combobox');
  userEvent.click(combobox);
  userEvent.click(await screen.findByText('Orders State'));
  await waitFor(() => expect(setPendingChartCustomization).toHaveBeenCalled());
  setPendingChartCustomization.mockClear();

  // Deselect (multi-select toggle) — the cleared target must keep the
  // datasource binding rather than collapsing to an empty object. After
  // selection the label exists twice (selection tag + dropdown option);
  // toggle via the option role.
  userEvent.click(combobox);
  userEvent.click(await screen.findByRole('option', { name: 'Orders State' }));
  await waitFor(() => expect(setPendingChartCustomization).toHaveBeenCalled());
  const cleared =
    setPendingChartCustomization.mock.calls[
      setPendingChartCustomization.mock.calls.length - 1
    ][0];
  expect(cleared.targets[0]).toMatchObject({
    datasetId: 308,
    datasourceType: DatasourceType.SemanticView,
  });
});

test('semantic structure failure renders empty options and toasts exactly once with view wording', async () => {
  fetchMock.get('glob:*/api/v1/semantic_view/309/structure', 500);
  fetchMock.get('glob:*/api/v1/dataset/*', { result: {} });

  const { rerender } = renderCard([
    { datasetId: 309, datasourceType: DatasourceType.SemanticView },
  ]);

  await waitFor(() => expect(mockedAddDangerToast).toHaveBeenCalledTimes(1));
  expect(String(mockedAddDangerToast.mock.calls[0][0])).toMatch(
    /semantic view 309/,
  );
  // Re-render (StrictMode-style double pass) must not re-toast the same binding.
  rerender(
    <GroupByFilterCard
      customizationItem={customization([
        { datasetId: 309, datasourceType: DatasourceType.SemanticView },
      ])}
    />,
  );
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(mockedAddDangerToast).toHaveBeenCalledTimes(1);

  const combobox = await screen.findByRole('combobox');
  userEvent.click(combobox);
  expect(screen.queryByText('Orders Status')).not.toBeInTheDocument();
  // Never a cross-type fallback.
  expect(fetchMock.callHistory.calls('glob:*/api/v1/dataset/*')).toHaveLength(
    0,
  );
});

test('switching from a failed binding to a healthy one never toasts the healthy datasource', async () => {
  // Regression for the toast/binding mismatch: the hook clears its error one
  // render after a binding change, so the render right after the switch pairs
  // the PREVIOUS binding's error with the NEW binding's id. Un-guarded, that
  // fires a danger toast naming the healthy datasource (sc-111089 review).
  fetchMock.get('glob:*/api/v1/dataset/310', 500);
  fetchMock.get('glob:*/api/v1/dataset/311', {
    result: { table_name: 'Healthy', columns: [{ column_name: 'city' }] },
  });

  const { rerender } = renderCard([{ datasetId: 310 }]);

  await waitFor(() => expect(mockedAddDangerToast).toHaveBeenCalledTimes(1));
  expect(String(mockedAddDangerToast.mock.calls[0][0])).toMatch(/310/);

  // Rebind to the healthy datasource.
  rerender(
    <GroupByFilterCard
      customizationItem={customization([{ datasetId: 311 }])}
    />,
  );

  // The healthy binding resolves and renders its columns — this render is
  // strictly after the switch, so any spurious toast would already have fired
  // and been counted by the time it settles (no wall-clock sleep needed).
  const combobox = await screen.findByRole('combobox');
  userEvent.click(combobox);
  expect(await screen.findByText('city')).toBeInTheDocument();

  // No toast ever names the healthy datasource 311.
  expect(mockedAddDangerToast).toHaveBeenCalledTimes(1);
  expect(String(mockedAddDangerToast.mock.calls[0][0])).not.toMatch(/311/);
});

/**
 * Upstream #42879 muted the column-loading spinner. Re-expressed here in this
 * suite's fetchMock idiom: a never-resolving dataset route pins the card in
 * its loading state without a module-level cachedSupersetGet mock, which
 * would freeze every other test in this file.
 */
test('renders the column-loading spinner small and muted', async () => {
  fetchMock.get('glob:*/api/v1/dataset/399', new Promise(() => {}));

  renderCard([{ datasetId: 399 }]);

  const spinner = await screen.findByTestId('loading-indicator');
  expect(spinner).toHaveClass('inline');
  expect(spinner).toHaveStyle({ opacity: 0.25, width: '40px' });
});
