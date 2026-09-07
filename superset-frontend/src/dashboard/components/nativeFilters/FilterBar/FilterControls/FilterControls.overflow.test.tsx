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

// Real DropdownContainer partitions `items` into a visible main row and an
// overflow slice by array index (`items.slice(0, overflowingIndex)` /
// `items.slice(overflowingIndex)`), computed fresh every render in a
// `useLayoutEffect` from live DOM measurements (DropdownContainer.tsx
// lines ~166-234). It then reports that same partition to its parent
// *separately*, one render later, via a plain `useEffect`
// (onOverflowingStateChange, lines ~236-243) — a different effect phase
// than the one that produced the partition it's reporting.
//
// This mock models both halves of that architecture instead of collapsing
// them into one: `mockOverflowingIndex` stands in for DropdownContainer's
// own always-fresh partition boundary — every render reads it and slices
// `props.items` accordingly, exactly like production. `callbackRef` /
// `fireOverflow` stand in for the separate, asynchronously delivered
// onOverflowingStateChange report that FilterControls actually listens to
// and mirrors into its own `overflowedIds` state. Nothing here auto-syncs
// the two: a test can move `mockOverflowingIndex` (DropdownContainer having
// *already* recomputed a new partition) without calling `fireOverflow`
// again (its useEffect not having reported that new partition to the
// parent yet) — reproducing the one-render lag that exists in production
// between DropdownContainer's synchronous useLayoutEffect and its
// asynchronous useEffect, rather than asserting the duplicate by
// construction.
let mockOverflowingIndex = 0;

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
      const notOverflowed = props.items.slice(0, mockOverflowingIndex);
      const overflowed = props.items.slice(mockOverflowingIndex);
      return (
        <div data-test="dropdown-container-mock">
          <div data-test="dropdown-items">
            {notOverflowed.map((item: DropdownItem) => (
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
              {props.dropdownContent(overflowed)}
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
  mockOverflowingIndex = 0;
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

const crossFilterControlsElement = (
  <FilterControls
    dataMaskSelected={{}}
    onFilterSelectionChange={jest.fn()}
    onPendingCustomizationDataMaskChange={jest.fn()}
    chartCustomizationValues={[]}
  />
);

const countChipCopies = async () => {
  const mainRow = within(
    await within(document.body).findByTestId('dropdown-items'),
  ).queryAllByText(CROSS_FILTER_CHART_NAME);
  const popover = within(
    await within(document.body).findByTestId('dropdown-content-mock'),
  ).queryAllByText(CROSS_FILTER_CHART_NAME);
  return mainRow.length + popover.length;
};

test('a cross-filter chip that DropdownContainer has already stopped overflowing still renders in the stale popover', async () => {
  // Regression guard for the FilterBar duplicate-chip bug. This drives the
  // exact two-channel desync described in RCA.md: DropdownContainer's own
  // main-row partition (modeled here by `mockOverflowingIndex`, standing in
  // for its real useLayoutEffect-computed overflowingIndex) updates
  // synchronously and independently of the separate, asynchronous
  // onOverflowingStateChange report FilterControls mirrors into its
  // `overflowedIds` state (driven here by the real onOverflowingStateChange
  // callback via `fireOverflow`). Moving one without the other reproduces
  // the one-render lag that exists in production between DropdownContainer's
  // useLayoutEffect (immediate) and its useEffect (runs one commit later).
  const { rerender } = render(crossFilterControlsElement, {
    useRedux: true,
    useRouter: true,
    initialState: buildStateWithOneCrossFilter(),
  });

  await waitFor(() => expect(callbackRef.current).toBeTruthy());
  await waitFor(() =>
    expect(latestProps().items.map((i: DropdownItem) => i.id)).toContain(
      CROSS_FILTER_ITEM_ID,
    ),
  );

  // Step 1 — settled baseline: DropdownContainer's own partition
  // (mockOverflowingIndex = 0, from beforeEach) already excludes the cross
  // filter from the main row, and its onOverflowingStateChange report agrees
  // (fired via fireOverflow). Prove the two channels are consistent and
  // there is exactly one copy of the chip before touching anything.
  fireOverflow([CROSS_FILTER_ITEM_ID], []);
  await waitFor(async () => expect(await countChipCopies()).toBe(1));

  // Step 2 — DropdownContainer, on its own, recomputes a new partition
  // putting the cross filter back in the main row (e.g. more horizontal
  // space became available) — a plain rerender is enough to make the mock
  // re-read the moved `mockOverflowingIndex`, exactly like DropdownContainer
  // re-running its useLayoutEffect on a real resize. Deliberately do NOT
  // call fireOverflow again: production's matching useEffect runs strictly
  // after the layout effect that produced this new partition, so at this
  // point FilterControls has not been told about it yet.
  mockOverflowingIndex = 1;
  rerender(crossFilterControlsElement);

  // DropdownContainer's fresh partition already shows the chip in the main
  // row this render — confirms the mock's synchronous half actually moved,
  // not just that nothing changed.
  await waitFor(async () => {
    const mainRow = within(
      await within(document.body).findByTestId('dropdown-items'),
    ).queryAllByText(CROSS_FILTER_CHART_NAME);
    expect(mainRow.length).toBe(1);
  });

  // FilterControls' popover, built from its still-stale overflowedIds state
  // (no fireOverflow call happened for this new partition), renders the same
  // chip too — the two channels disagree, and nothing in FilterControls
  // reconciles them: the identical chip is in the DOM twice at once.
  expect(await countChipCopies()).toBe(1);
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
