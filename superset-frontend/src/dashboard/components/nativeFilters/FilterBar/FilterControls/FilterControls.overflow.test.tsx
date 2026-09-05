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
import { Preset } from '@superset-ui/core';
import type { DataMaskStateWithId } from '@superset-ui/core';
import type {
  DropdownContainerProps,
  DropdownItem,
} from '@superset-ui/core/components/DropdownContainer';
import { SelectFilterPlugin } from 'src/filters/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import { act, render, waitFor, within } from 'spec/helpers/testing-library';
import { createSelectNativeFilter } from 'spec/fixtures/mockNativeFilters';
import FilterControls from './FilterControls';

// Capture every props snapshot DropdownContainer receives, plus the latest
// onOverflowingStateChange callback. Tests drive overflow by invoking the
// callback and then assert against the *next* captured props snapshot —
// these are the values FilterControls itself computed (dropdownTriggerCount,
// dropdownContent, items) so assertions exercise real production logic
// rather than props the test handed in directly.
const dropdownContainerProps: DropdownContainerProps[] = [];
const callbackRef: {
  current:
    | ((s: { overflowed: string[]; notOverflowed: string[] }) => void)
    | null;
} = { current: null };

// Mock the DropdownContainer subpath rather than the barrel
// `@superset-ui/core/components` — mocking the barrel triggers a
// circular re-export chain at requireActual time
// (LabeledErrorBoundInput → ActionButton is undefined at that point).
// The barrel's `export { DropdownContainer } from './DropdownContainer'`
// resolves to this subpath, so the mock is picked up transparently.
jest.mock('@superset-ui/core/components/DropdownContainer', () => {
  const React = jest.requireActual('react');
  const MockDropdownContainer = React.forwardRef(
    (props: DropdownContainerProps, ref: React.Ref<unknown>) => {
      dropdownContainerProps.push(props);
      callbackRef.current = props.onOverflowingStateChange ?? null;
      React.useImperativeHandle(ref, () => ({
        open: jest.fn(),
        close: jest.fn(),
      }));
      return (
        <div data-test="dropdown-container-mock">
          <div data-test="dropdown-items">
            {props.items.map((item: DropdownItem) => (
              <div key={item.id} data-test="dropdown-item">
                {item.element}
              </div>
            ))}
          </div>
          <div data-test="dropdown-trigger-text">
            {props.dropdownTriggerText}
          </div>
          <div data-test="dropdown-trigger-count">
            {props.dropdownTriggerCount}
          </div>
          {props.dropdownContent && (
            <div data-test="dropdown-content-mock">
              {props.dropdownContent([])}
            </div>
          )}
        </div>
      );
    },
  );
  return { __esModule: true, DropdownContainer: MockDropdownContainer };
});

class OverflowTestPreset extends Preset {
  constructor() {
    super({
      name: 'FilterControls overflow test preset',
      plugins: [new SelectFilterPlugin().configure({ key: 'filter_select' })],
    });
  }
}
new OverflowTestPreset().register();

// Tabless dashboard layout ⇒ useSelectFiltersInScope returns all filters in
// scope without needing to model tab parentage.
const buildHorizontalState = (
  filters: ReturnType<typeof createSelectNativeFilter>[],
) => ({
  dashboardInfo: {
    id: 1,
    dash_edit_perm: true,
    filterBarOrientation: FilterBarOrientation.Horizontal,
    metadata: {
      native_filter_configuration: filters,
    },
  },
  dashboardLayout: {
    present: {
      ROOT_ID: { type: 'ROOT', id: 'ROOT_ID', children: [] },
    },
    past: [],
    future: [],
  },
  dashboardState: {
    sliceIds: [],
    activeTabs: ['ROOT_ID'],
  },
  charts: {},
  nativeFilters: {
    filters: filters.reduce(
      (acc, f) => ({ ...acc, [f.id]: f }),
      {} as Record<string, ReturnType<typeof createSelectNativeFilter>>,
    ),
    filtersState: {},
  },
  dataMask: {},
  sliceEntities: { slices: {} },
  datasources: {},
});

const buildDataMaskSelected = (
  filters: ReturnType<typeof createSelectNativeFilter>[],
  withValueIds: string[] = [],
): DataMaskStateWithId =>
  filters.reduce(
    (acc, f) => ({
      ...acc,
      [f.id]: {
        id: f.id,
        filterState: {
          value: withValueIds.includes(f.id) ? ['set'] : null,
        },
        extraFormData: {},
      },
    }),
    {} as DataMaskStateWithId,
  );

const renderHorizontal = (
  filters: ReturnType<typeof createSelectNativeFilter>[],
  dataMaskSelected: DataMaskStateWithId,
) =>
  render(
    <FilterControls
      dataMaskSelected={dataMaskSelected}
      onFilterSelectionChange={jest.fn()}
      onPendingCustomizationDataMaskChange={jest.fn()}
      chartCustomizationValues={[]}
    />,
    {
      useRedux: true,
      useRouter: true,
      initialState: buildHorizontalState(filters),
    },
  );

const latestProps = () =>
  dropdownContainerProps[dropdownContainerProps.length - 1];

const fireOverflow = (overflowed: string[], notOverflowed: string[]) => {
  if (!callbackRef.current) {
    throw new Error('onOverflowingStateChange callback not captured');
  }
  act(() => {
    callbackRef.current!({ overflowed, notOverflowed });
  });
};

beforeEach(() => {
  dropdownContainerProps.length = 0;
  callbackRef.current = null;
});

test('horizontal FilterControls hands every filter to DropdownContainer as an item', async () => {
  const filters = [
    createSelectNativeFilter('NATIVE_FILTER-1', 'country'),
    createSelectNativeFilter('NATIVE_FILTER-2', 'region'),
    createSelectNativeFilter('NATIVE_FILTER-3', 'city'),
    createSelectNativeFilter('NATIVE_FILTER-4', 'zip'),
  ];

  renderHorizontal(filters, buildDataMaskSelected(filters));

  await waitFor(() => expect(latestProps()).toBeTruthy());

  expect(latestProps().items.map((i: DropdownItem) => i.id)).toEqual([
    'NATIVE_FILTER-1',
    'NATIVE_FILTER-2',
    'NATIVE_FILTER-3',
    'NATIVE_FILTER-4',
  ]);
  // dropdownTriggerText is the production string FilterControls passes in.
  expect(latestProps().dropdownTriggerText).toBe('More filters');
});

test('with no overflow callback fired, dropdown trigger count is 0 and content is empty', async () => {
  const filters = [
    createSelectNativeFilter('NATIVE_FILTER-1', 'country'),
    createSelectNativeFilter('NATIVE_FILTER-2', 'region'),
  ];

  renderHorizontal(
    filters,
    buildDataMaskSelected(filters, ['NATIVE_FILTER-1']),
  );

  await waitFor(() => expect(latestProps()).toBeTruthy());

  expect(latestProps().dropdownTriggerCount).toBe(0);
  // FilterControls only supplies dropdownContent when something overflowed.
  expect(latestProps().dropdownContent).toBeUndefined();
});

test('firing overflow with two filters that have values increments the trigger count to 2', async () => {
  const filters = [
    createSelectNativeFilter('NATIVE_FILTER-1', 'country'),
    createSelectNativeFilter('NATIVE_FILTER-2', 'region'),
    createSelectNativeFilter('NATIVE_FILTER-3', 'city'),
    createSelectNativeFilter('NATIVE_FILTER-4', 'zip'),
  ];

  renderHorizontal(
    filters,
    // Mark the two we plan to overflow as having values; the production
    // selector activeOverflowedFiltersInScope filters on dataMask.filterState.value.
    buildDataMaskSelected(filters, ['NATIVE_FILTER-3', 'NATIVE_FILTER-4']),
  );

  await waitFor(() => expect(callbackRef.current).toBeTruthy());

  fireOverflow(
    ['NATIVE_FILTER-3', 'NATIVE_FILTER-4'],
    ['NATIVE_FILTER-1', 'NATIVE_FILTER-2'],
  );

  await waitFor(() => {
    expect(latestProps().dropdownTriggerCount).toBe(2);
  });
});

test('firing overflow with no active values keeps trigger count at 0 but supplies dropdownContent', async () => {
  // Reinforces the activeOverflowedFiltersInScope branch in
  // FilterControls.tsx: count is the *active* (value-bearing) subset of
  // overflowed filters, not the raw overflowed count. If the production
  // memo regressed to use overflowedFiltersInScope.length, this fails.
  const filters = [
    createSelectNativeFilter('NATIVE_FILTER-1', 'country'),
    createSelectNativeFilter('NATIVE_FILTER-2', 'region'),
    createSelectNativeFilter('NATIVE_FILTER-3', 'city'),
  ];

  renderHorizontal(filters, buildDataMaskSelected(filters));

  await waitFor(() => expect(callbackRef.current).toBeTruthy());

  fireOverflow(['NATIVE_FILTER-2', 'NATIVE_FILTER-3'], ['NATIVE_FILTER-1']);

  await waitFor(() => {
    expect(latestProps().dropdownContent).toBeInstanceOf(Function);
  });
  expect(latestProps().dropdownTriggerCount).toBe(0);
});

// Cross-filter chips are keyed by `${name}${emitterId}` (see FilterControls.tsx's
// `items` memo) and sourced from `crossFiltersSelector`, which reads
// `dashboardState.sliceIds` + `dashboardLayout.present` (for the chart's name) +
// `dataMask` (for the emitted filter's column/value) — independent of the native
// filter config used by `buildHorizontalState` above.
const CROSS_FILTER_CHART_ID = 85;
const CROSS_FILTER_CHART_NAME = 'Products Sold By Product Line';
const CROSS_FILTER_ITEM_ID = `${CROSS_FILTER_CHART_NAME}${CROSS_FILTER_CHART_ID}`;

const buildStateWithOneCrossFilter = () => ({
  ...buildHorizontalState([]),
  dashboardState: {
    sliceIds: [CROSS_FILTER_CHART_ID],
    activeTabs: ['ROOT_ID'],
  },
  dashboardLayout: {
    present: {
      ROOT_ID: {
        type: 'ROOT',
        id: 'ROOT_ID',
        children: [`CHART-${CROSS_FILTER_CHART_ID}`],
      },
      [`CHART-${CROSS_FILTER_CHART_ID}`]: {
        type: 'CHART',
        id: `CHART-${CROSS_FILTER_CHART_ID}`,
        parents: ['ROOT_ID'],
        meta: {
          chartId: CROSS_FILTER_CHART_ID,
          sliceName: CROSS_FILTER_CHART_NAME,
        },
      },
    },
    past: [],
    future: [],
  },
  dataMask: {
    [CROSS_FILTER_CHART_ID]: {
      id: CROSS_FILTER_CHART_ID,
      filterState: {
        value: 'Classic Cars',
        filters: { product_line: 'Classic Cars' },
      },
      extraFormData: {},
    },
  },
});

test('an overflowed cross-filter chip stays in the items array handed to DropdownContainer', async () => {
  // Regression guard for the FilterBar duplicate-chip bug: FilterControls
  // reports which items overflowed (via onOverflowingStateChange -> the
  // `overflowedCrossFilters` used to build `dropdownContent`'s popover), but
  // the `items` memo that DropdownContainer renders the main row from is never
  // filtered against that overflow state. Production DropdownContainer decides
  // the main-row/popover split by array index, computed fresh each render,
  // while FilterControls' popover content is built from a *stale*, one-render-
  // late copy of "which ids are overflowed" (received asynchronously via
  // onOverflowingStateChange). Nothing in FilterControls ever removes an
  // overflowed cross-filter from `items`, so the identical chip can be handed
  // to DropdownContainer as both "eligible for the main row" (via `items`) and
  // "already overflowed" (via `dropdownContent`) at the same time — which is
  // what makes the same cross-filter chip render twice in the real FilterBar.
  render(
    <FilterControls
      dataMaskSelected={{}}
      onFilterSelectionChange={jest.fn()}
      onPendingCustomizationDataMaskChange={jest.fn()}
      chartCustomizationValues={[]}
    />,
    {
      useRedux: true,
      useRouter: true,
      initialState: buildStateWithOneCrossFilter(),
    },
  );

  await waitFor(() => expect(callbackRef.current).toBeTruthy());
  await waitFor(() =>
    expect(latestProps().items.map((i: DropdownItem) => i.id)).toContain(
      CROSS_FILTER_ITEM_ID,
    ),
  );

  fireOverflow([CROSS_FILTER_ITEM_ID], []);

  // Wait for the popover slot to actually pick up the overflowed cross-filter
  // (ground truth: the rendered DOM, not an intermediate props snapshot).
  await within(document.body).findByTestId('dropdown-content-mock');

  // The cross-filter is now reported as overflowed (so FilterControls' own
  // dropdownContent/popover renders it) — it must therefore be absent from
  // `items`, or DropdownContainer's main row renders it too, producing two
  // copies of the identical chip in the DOM at once.
  const mainRowCopies = within(
    await within(document.body).findByTestId('dropdown-items'),
  ).queryAllByText(CROSS_FILTER_CHART_NAME);
  const popoverCopies = within(
    await within(document.body).findByTestId('dropdown-content-mock'),
  ).queryAllByText(CROSS_FILTER_CHART_NAME);
  expect(mainRowCopies.length + popoverCopies.length).toBe(1);
});

test('all 12 overflowed filters are reachable through dropdownContent', async () => {
  // Substitutes for the disabled Cypress "scroll within overflow" assertion:
  // jsdom has no real layout/scrolling, so we instead prove every overflowed
  // filter renders inside the dropdown panel.
  const filters = Array.from({ length: 12 }, (_, i) =>
    createSelectNativeFilter(`NATIVE_FILTER-${i + 1}`, `filter_${i + 1}`),
  );

  renderHorizontal(filters, buildDataMaskSelected(filters));

  await waitFor(() => expect(callbackRef.current).toBeTruthy());

  fireOverflow(
    filters.map(f => f.id),
    [],
  );

  // dropdownContent renders FiltersDropdownContent, which renders each
  // overflowed filter through the renderer prop. Asserting on identity
  // (not just count) catches a regression that rendered the wrong subset
  // of filters in the dropdown — e.g. all `filtersInScope` instead of
  // the overflowed slice.
  const { findByTestId } = within(document.body);
  const contentSlot = await findByTestId('dropdown-content-mock');
  await waitFor(() => {
    const names = within(contentSlot).getAllByTestId('filter-control-name');
    expect(names.map(n => n.textContent)).toEqual(filters.map(f => f.name));
  });
});
