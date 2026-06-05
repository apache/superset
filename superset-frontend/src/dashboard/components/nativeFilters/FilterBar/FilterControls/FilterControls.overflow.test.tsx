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
import { NativeFilterType, Preset } from '@superset-ui/core';
import type { DataMaskStateWithId } from '@superset-ui/core';
import type {
  DropdownContainerProps,
  DropdownItem,
} from '@superset-ui/core/components/DropdownContainer';
import { SelectFilterPlugin } from 'src/filters/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import { act, render, waitFor, within } from 'spec/helpers/testing-library';
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

const createSelectFilter = (id: string, name: string) => ({
  id,
  name,
  type: NativeFilterType.NativeFilter,
  filterType: 'filter_select',
  targets: [{ datasetId: 2, column: { name: 'col' } }],
  defaultDataMask: { filterState: { value: null }, extraFormData: {} },
  controlValues: {},
  cascadeParentIds: [],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  description: '',
  chartsInScope: [],
  tabsInScope: [],
});

// Tabless dashboard layout ⇒ useSelectFiltersInScope returns all filters in
// scope without needing to model tab parentage.
const buildHorizontalState = (
  filters: ReturnType<typeof createSelectFilter>[],
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
    activeTabs: [],
  },
  charts: {},
  nativeFilters: {
    filters: filters.reduce(
      (acc, f) => ({ ...acc, [f.id]: f }),
      {} as Record<string, ReturnType<typeof createSelectFilter>>,
    ),
    filtersState: {},
  },
  dataMask: {},
  sliceEntities: { slices: {} },
  datasources: {},
});

const buildDataMaskSelected = (
  filters: ReturnType<typeof createSelectFilter>[],
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
  filters: ReturnType<typeof createSelectFilter>[],
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
    createSelectFilter('NATIVE_FILTER-1', 'country'),
    createSelectFilter('NATIVE_FILTER-2', 'region'),
    createSelectFilter('NATIVE_FILTER-3', 'city'),
    createSelectFilter('NATIVE_FILTER-4', 'zip'),
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
    createSelectFilter('NATIVE_FILTER-1', 'country'),
    createSelectFilter('NATIVE_FILTER-2', 'region'),
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
    createSelectFilter('NATIVE_FILTER-1', 'country'),
    createSelectFilter('NATIVE_FILTER-2', 'region'),
    createSelectFilter('NATIVE_FILTER-3', 'city'),
    createSelectFilter('NATIVE_FILTER-4', 'zip'),
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
    createSelectFilter('NATIVE_FILTER-1', 'country'),
    createSelectFilter('NATIVE_FILTER-2', 'region'),
    createSelectFilter('NATIVE_FILTER-3', 'city'),
  ];

  renderHorizontal(filters, buildDataMaskSelected(filters));

  await waitFor(() => expect(callbackRef.current).toBeTruthy());

  fireOverflow(['NATIVE_FILTER-2', 'NATIVE_FILTER-3'], ['NATIVE_FILTER-1']);

  await waitFor(() => {
    expect(latestProps().dropdownContent).toBeDefined();
  });
  expect(latestProps().dropdownTriggerCount).toBe(0);
});

test('all 12 overflowed filters are reachable through dropdownContent', async () => {
  // Substitutes for the disabled Cypress "scroll within overflow" assertion:
  // jsdom has no real layout/scrolling, so we instead prove every overflowed
  // filter renders inside the dropdown panel.
  const filters = Array.from({ length: 12 }, (_, i) =>
    createSelectFilter(`NATIVE_FILTER-${i + 1}`, `filter_${i + 1}`),
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
