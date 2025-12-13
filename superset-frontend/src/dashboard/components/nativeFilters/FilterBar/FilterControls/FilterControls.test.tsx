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
import { render, screen } from 'spec/helpers/testing-library';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import {
  ChartCustomizationType,
  ChartCustomizationDivider,
} from '@superset-ui/core';
import { FilterBarOrientation } from 'src/dashboard/types';
import FilterControls from './FilterControls';

const mockStore = {
  ...stateWithoutNativeFilters,
  dashboardInfo: {
    ...stateWithoutNativeFilters.dashboardInfo,
    filterBarOrientation: FilterBarOrientation.Vertical,
  },
};

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(selector => selector(mockStore)),
  useDispatch: () => jest.fn(),
}));

const defaultProps = {
  dataMaskSelected: {},
  onFilterSelectionChange: jest.fn(),
  onPendingCustomizationDataMaskChange: jest.fn(),
  chartCustomizationValues: [],
};

test('renders chart customization divider in vertical mode', () => {
  const divider: ChartCustomizationDivider = {
    id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
    type: ChartCustomizationType.Divider,
    title: 'Test Divider',
    description: 'Test description',
    removed: false,
  };

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={[divider]} />,
  );

  expect(
    screen.getByRole('heading', { name: 'Test Divider' }),
  ).toBeInTheDocument();
});

test('renders multiple chart customization dividers in vertical mode', () => {
  const dividers: ChartCustomizationDivider[] = [
    {
      id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
      type: ChartCustomizationType.Divider,
      title: 'First Divider',
      description: 'First description',
      removed: false,
    },
    {
      id: 'CHART_CUSTOMIZATION_DIVIDER-xyz789',
      type: ChartCustomizationType.Divider,
      title: 'Second Divider',
      description: 'Second description',
      removed: false,
    },
  ];

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={dividers} />,
  );

  expect(
    screen.getByRole('heading', { name: 'First Divider' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('heading', { name: 'Second Divider' }),
  ).toBeInTheDocument();
});

test('renders chart customization divider in horizontal mode', () => {
  const horizontalStore = {
    ...mockStore,
    dashboardInfo: {
      ...mockStore.dashboardInfo,
      filterBarOrientation: FilterBarOrientation.Horizontal,
    },
  };

  const useSelector = jest.requireMock('react-redux').useSelector;
  useSelector.mockImplementation(
    (selector: (state: typeof horizontalStore) => unknown) =>
      selector(horizontalStore),
  );

  const divider: ChartCustomizationDivider = {
    id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
    type: ChartCustomizationType.Divider,
    title: 'Horizontal Divider',
    description: 'Horizontal description',
    removed: false,
  };

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={[divider]} />,
  );

  expect(
    screen.getByRole('heading', { name: 'Horizontal Divider' }),
  ).toBeInTheDocument();
});

test('does not render removed chart customization dividers', () => {
  const dividers: ChartCustomizationDivider[] = [
    {
      id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
      type: ChartCustomizationType.Divider,
      title: 'Visible Divider',
      description: 'Should be visible',
      removed: false,
    },
    {
      id: 'CHART_CUSTOMIZATION_DIVIDER-xyz789',
      type: ChartCustomizationType.Divider,
      title: 'Hidden Divider',
      description: 'Should not be visible',
      removed: true,
    },
  ];

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={dividers} />,
  );

  expect(
    screen.getByRole('heading', { name: 'Visible Divider' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Hidden Divider' }),
  ).not.toBeInTheDocument();
});

test('renders divider with description icon in vertical mode when description exists', () => {
  const divider: ChartCustomizationDivider = {
    id: 'CHART_CUSTOMIZATION_DIVIDER-abc123',
    type: ChartCustomizationType.Divider,
    title: 'Divider With Description',
    description: 'This is a detailed description',
    removed: false,
  };

  render(
    <FilterControls {...defaultProps} chartCustomizationValues={[divider]} />,
  );

  expect(
    screen.getByRole('heading', { name: 'Divider With Description' }),
  ).toBeInTheDocument();
  expect(screen.queryByTestId('divider-description-icon')).toBeInTheDocument();
});

test('renders empty state when no chart customizations provided', () => {
  const { container } = render(
    <FilterControls {...defaultProps} chartCustomizationValues={[]} />,
  );

  expect(
    container.querySelector('.chart-customization-item-wrapper'),
  ).not.toBeInTheDocument();
});
