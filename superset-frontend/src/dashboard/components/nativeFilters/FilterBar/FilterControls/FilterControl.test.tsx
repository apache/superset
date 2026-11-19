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
import { ReactNode } from 'react';
import { render, screen, within } from 'spec/helpers/testing-library';
import {
  ChartCustomization,
  ChartCustomizationType,
  Filter,
  NativeFilterType,
} from '@superset-ui/core';
import { ChartCustomizationPlugins } from 'src/constants';
import { FilterBarOrientation } from 'src/dashboard/types';
import FilterControl from './FilterControl';

jest.mock('src/dashboard/components/nativeFilters/state', () => ({
  ...jest.requireActual('src/dashboard/components/nativeFilters/state'),
  useIsFilterInScope: () => () => false,
}));

jest.mock('../Vertical', () => {
  const { createContext } = require('react');
  return {
    FilterBarScrollContext: createContext(false),
  };
});

jest.mock('./FilterValue', () => () => null);

jest.mock('../../FilterCard', () => ({
  FilterCard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('./GroupByFilterCard', () => () => null);

jest.mock('../utils', () => ({
  checkIsMissingRequiredValue: () => false,
}));

jest.mock('react-reverse-portal', () => ({
  createHtmlPortalNode: () => ({}),
  InPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
  OutPortal: () => null,
}));

const deckglFilter: ChartCustomization = {
  id: 'filter1',
  name: 'Layer Visibility',
  filterType: ChartCustomizationPlugins.DeckglLayerVisibility,
  type: ChartCustomizationType.ChartCustomization,
  targets: [],
  scope: { rootPath: [], excluded: [] },
  controlValues: {},
  defaultDataMask: {},
};

const nativeFilter: Filter = {
  id: 'filter2',
  name: 'Select Filter',
  filterType: 'filter_select',
  type: NativeFilterType.NativeFilter,
  targets: [],
  scope: { rootPath: [], excluded: [] },
  controlValues: {},
  defaultDataMask: {},
  cascadeParentIds: [],
  description: '',
};

test('renders DeckglLayerVisibilityTooltip for deckgl layer visibility filter type', () => {
  render(
    <FilterControl filter={deckglFilter} onFilterSelectionChange={jest.fn()} />,
  );
  expect(
    screen.getByTestId('deckgl-layer-visibility-tooltip-icon'),
  ).toBeInTheDocument();
});

test('does not render DeckglLayerVisibilityTooltip for standard filter type', () => {
  render(
    <FilterControl filter={nativeFilter} onFilterSelectionChange={jest.fn()} />,
  );
  expect(
    screen.queryByTestId('deckgl-layer-visibility-tooltip-icon'),
  ).not.toBeInTheDocument();
});

test('does not mark a defaultToFirstItem-only filter as required', () => {
  render(
    <FilterControl
      filter={{
        ...nativeFilter,
        controlValues: { defaultToFirstItem: true },
      }}
      onFilterSelectionChange={jest.fn()}
    />,
  );
  expect(screen.queryByText('*')).not.toBeInTheDocument();
});

test('marks an enableEmptyFilter filter as required', () => {
  render(
    <FilterControl
      filter={{
        ...nativeFilter,
        controlValues: { enableEmptyFilter: true },
      }}
      onFilterSelectionChange={jest.fn()}
    />,
  );
  expect(screen.getByText('*')).toBeInTheDocument();
});

test('shows a warning for a filter without a selected scope', () => {
  render(
    <FilterControl
      filter={{
        ...nativeFilter,
        chartsInScope: [],
        scope: { rootPath: [], excluded: [] },
      }}
      onFilterSelectionChange={jest.fn()}
    />,
  );

  expect(
    screen.getByTestId('out-of-scope-filter-tooltip-icon'),
  ).toBeInTheDocument();
});

test('does not show the warning before chart scope is calculated', () => {
  const { rerender } = render(
    <FilterControl
      filter={{ ...nativeFilter, chartsInScope: undefined }}
      onFilterSelectionChange={jest.fn()}
    />,
  );

  expect(
    screen.queryByTestId('out-of-scope-filter-tooltip-icon'),
  ).not.toBeInTheDocument();

  rerender(
    <FilterControl
      filter={{ ...nativeFilter, chartsInScope: [] }}
      onFilterSelectionChange={jest.fn()}
    />,
  );

  expect(
    screen.getByTestId('out-of-scope-filter-tooltip-icon'),
  ).toBeInTheDocument();
});

test('does not show a warning for a filter with charts in scope', () => {
  render(
    <FilterControl
      filter={{
        ...nativeFilter,
        chartsInScope: [123],
        tabsInScope: ['INACTIVE_TAB'],
      }}
      onFilterSelectionChange={jest.fn()}
    />,
  );

  expect(
    screen.queryByTestId('out-of-scope-filter-tooltip-icon'),
  ).not.toBeInTheDocument();
});

test('keeps the warning beside the name in the horizontal More filters layout', () => {
  const longFilterName =
    'A very long filter name that must not hide its warning';
  render(
    <FilterControl
      filter={{
        ...nativeFilter,
        name: longFilterName,
        chartsInScope: [],
        controlValues: { enableEmptyFilter: true },
        description: 'Filter description',
        scope: { rootPath: ['ROOT_ID'], excluded: [] },
      }}
      orientation={FilterBarOrientation.Horizontal}
      overflow
      onFilterSelectionChange={jest.fn()}
    />,
  );

  const titleGroup = screen.getByTestId('filter-control-title-group');
  const name = within(titleGroup).getByTestId('filter-control-name');
  const requiredIndicator = screen.getByText('*');
  const warningIcon = within(titleGroup).getByTestId(
    'out-of-scope-filter-tooltip-icon',
  );
  expect(name).toHaveTextContent(longFilterName);
  expect(name.compareDocumentPosition(requiredIndicator)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(requiredIndicator.compareDocumentPosition(warningIcon)).toBe(
    Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(screen.getAllByRole('button')).toHaveLength(2);
});
