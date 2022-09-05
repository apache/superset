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

import React from 'react';
import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import mockState from 'spec/fixtures/mockState';
import reducerIndex from 'spec/helpers/reducerIndex';
import { screen, render } from 'spec/helpers/testing-library';
import { initialState } from 'src/SqlLab/fixtures';
import { dashboardFilters } from 'spec/fixtures/mockDashboardFilters';
import { dashboardWithFilter } from 'spec/fixtures/mockDashboardLayout';
import { buildActiveFilters } from './activeDashboardFilters';
import useFilterFocusHighlightStyles from './useFilterFocusHighlightStyles';

const TestComponent = ({ chartId }: { chartId: number }) => {
  const styles = useFilterFocusHighlightStyles(chartId);

  return <div data-test="test-component" style={styles} />;
};

describe('useFilterFocusHighlightStyles', () => {
  const createMockStore = (customState: any = {}) =>
    createStore(
      combineReducers(reducerIndex),
      { ...mockState, ...(initialState as any), ...customState },
      compose(applyMiddleware(thunk)),
    );

  const renderWrapper = (chartId: number, store = createMockStore()) =>
    render(<TestComponent chartId={chartId} />, {
      useRouter: true,
      useDnd: true,
      useRedux: true,
      store,
    });

  it('should return no style if filter not in scope', async () => {
    renderWrapper(10);

    const container = screen.getByTestId('test-component');

    const styles = getComputedStyle(container);
    expect(styles.opacity).toBeFalsy();
  });

  it('should return unfocused styles if chart is not in scope of focused native filter', async () => {
    const store = createMockStore({
      nativeFilters: {
        focusedFilterId: 'test-filter',
        filters: {
          otherId: {
            chartsInScope: [],
          },
        },
      },
    });
    renderWrapper(10, store);

    const container = screen.getByTestId('test-component');

    const styles = getComputedStyle(container);
    expect(parseFloat(styles.opacity)).toBe(0.3);
  });

  it('should return focused styles if chart is in scope of focused native filter', async () => {
    const chartId = 18;
    const store = createMockStore({
      nativeFilters: {
        focusedFilterId: 'testFilter',
        filters: {
          testFilter: {
            chartsInScope: [chartId],
          },
        },
      },
    });
    renderWrapper(chartId, store);

    const container = screen.getByTestId('test-component');

    const styles = getComputedStyle(container);
    expect(parseFloat(styles.opacity)).toBe(1);
  });

  it('should return unfocused styles if focusedFilterField is targeting a different chart', async () => {
    const chartId = 18;
    const store = createMockStore({
      dashboardState: {
        focusedFilterField: {
          chartId: 10,
          column: 'test',
        },
      },
      dashboardFilters: {
        10: {
          scopes: {},
        },
      },
    });
    renderWrapper(chartId, store);

    const container = screen.getByTestId('test-component');

    const styles = getComputedStyle(container);
    expect(parseFloat(styles.opacity)).toBe(0.3);
  });

  it('should return focused styles if focusedFilterField chart equals our own', async () => {
    const chartId = 18;
    const store = createMockStore({
      dashboardState: {
        focusedFilterField: {
          chartId,
          column: 'test',
        },
      },
      dashboardFilters: {
        [chartId]: {
          scopes: {
            otherColumn: {},
          },
        },
      },
    });
    renderWrapper(chartId, store);

    const container = screen.getByTestId('test-component');

    const styles = getComputedStyle(container);
    expect(parseFloat(styles.opacity)).toBe(1);
  });

  it('should return unfocused styles if chart is not inside filter box scope', async () => {
    buildActiveFilters({
      dashboardFilters,
      components: dashboardWithFilter,
    });

    const chartId = 18;
    const store = createMockStore({
      dashboardState: {
        focusedFilterField: {
          chartId,
          column: 'test',
        },
      },
      dashboardFilters: {
        [chartId]: {
          scopes: {
            column: {},
          },
        },
      },
    });
    renderWrapper(20, store);

    const container = screen.getByTestId('test-component');

    const styles = getComputedStyle(container);
    expect(parseFloat(styles.opacity)).toBe(0.3);
  });

  it('should return focused styles if chart is inside filter box scope', async () => {
    buildActiveFilters({
      dashboardFilters,
      components: dashboardWithFilter,
    });

    const chartId = 18;
    const store = createMockStore({
      dashboardState: {
        focusedFilterField: {
          chartId,
          column: 'test',
        },
      },
      dashboardFilters: {
        [chartId]: {
          scopes: {
            column: {},
          },
        },
      },
    });
    renderWrapper(chartId, store);

    const container = screen.getByTestId('test-component');

    const styles = getComputedStyle(container);
    expect(parseFloat(styles.opacity)).toBe(1);
  });
});
