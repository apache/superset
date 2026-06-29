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

import { screen, render } from 'spec/helpers/testing-library';
import { useNativeFiltersStore, type FilterEntry } from 'src/dashboard/stores';
import useFilterFocusHighlightStyles from './useFilterFocusHighlightStyles';
import { getRelatedCharts } from './getRelatedCharts';

jest.mock('./getRelatedCharts');

const TestComponent = ({ chartId }: { chartId: number }) => {
  const styles = useFilterFocusHighlightStyles(chartId);

  return <div data-test="test-component" style={styles} />;
};

const mockGetRelatedCharts = getRelatedCharts as jest.Mock;

const seedNativeFilters = (state: {
  focusedFilterId?: string;
  hoveredFilterId?: string;
  filters?: Record<string, FilterEntry>;
}) => {
  useNativeFiltersStore.setState({
    filters: {},
    focusedFilterId: undefined,
    hoveredFilterId: undefined,
    hoveredChartCustomizationId: undefined,
    ...state,
  });
};

const renderWrapper = (chartId: number) =>
  render(<TestComponent chartId={chartId} />, {
    useRouter: true,
    useDnd: true,
    useRedux: true,
  });

beforeEach(() => {
  seedNativeFilters({});
});

test('should return no style if filter not in scope', async () => {
  renderWrapper(10);

  const container = screen.getByTestId('test-component');

  const styles = getComputedStyle(container);
  expect(styles.opacity).toBeFalsy();
});

test('should return unfocused styles if chart is not in scope of focused native filter', async () => {
  mockGetRelatedCharts.mockReturnValue([]);
  seedNativeFilters({
    focusedFilterId: 'test-filter',
    filters: {
      otherId: {
        id: 'NATIVE_FILTER-otherId',
        chartsInScope: [],
      } as unknown as FilterEntry,
    },
  });
  renderWrapper(10);

  const container = screen.getByTestId('test-component');

  const styles = getComputedStyle(container);
  expect(parseFloat(styles.opacity)).toBe(0.3);
});

test('should return unfocused styles if chart is not in scope of hovered native filter', async () => {
  mockGetRelatedCharts.mockReturnValue([]);
  seedNativeFilters({
    hoveredFilterId: 'test-filter',
    filters: {
      otherId: {
        id: 'NATIVE_FILTER-otherId',
        chartsInScope: [],
      } as unknown as FilterEntry,
    },
  });
  renderWrapper(10);

  const container = screen.getByTestId('test-component');

  const styles = getComputedStyle(container);
  expect(parseFloat(styles.opacity)).toBe(0.3);
});

test('should return focused styles if chart is in scope of focused native filter', async () => {
  const chartId = 18;
  mockGetRelatedCharts.mockReturnValue([chartId]);
  seedNativeFilters({
    focusedFilterId: 'testFilter',
    filters: {
      testFilter: {
        id: 'NATIVE_FILTER-testFilter',
        chartsInScope: [chartId],
      } as unknown as FilterEntry,
    },
  });
  renderWrapper(chartId);

  const container = screen.getByTestId('test-component');

  const styles = getComputedStyle(container);
  expect(parseFloat(styles.opacity)).toBe(1);
});

test('should return focused styles if chart is in scope of hovered native filter', async () => {
  const chartId = 18;
  mockGetRelatedCharts.mockReturnValue([chartId]);
  seedNativeFilters({
    hoveredFilterId: 'testFilter',
    filters: {
      testFilter: {
        id: 'NATIVE_FILTER-testFilter',
        chartsInScope: [chartId],
      } as unknown as FilterEntry,
    },
  });
  renderWrapper(chartId);

  const container = screen.getByTestId('test-component');

  const styles = getComputedStyle(container);
  expect(parseFloat(styles.opacity)).toBe(1);
});

test('does not crash when the focused filter id is stale (filter missing)', () => {
  // A focused filter can be deleted while its id is still focused; the filter
  // entry is gone from the store. The hook must skip related-chart computation
  // rather than dereferencing the missing filter (regression: TypeError on
  // reading 'scope' of undefined, crashing the whole dashboard tree).
  mockGetRelatedCharts.mockClear();
  seedNativeFilters({
    focusedFilterId: 'deleted-filter',
    filters: {},
  });
  renderWrapper(10);

  const container = screen.getByTestId('test-component');
  expect(parseFloat(getComputedStyle(container).opacity)).toBe(0.3);
  expect(mockGetRelatedCharts).not.toHaveBeenCalled();
});
