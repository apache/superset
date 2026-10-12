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

import { act, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/theme';
import { FeatureFlag } from '../../../utils/featureFlags';
import MatrixifyGridCell from './MatrixifyGridCell';
import { MatrixifyGridCell as MatrixifyGridCellType } from '../../types/matrixify';
import {
  FORCE_IN_VIEW_EVENT,
  RESTORE_VIRTUALIZATION_EVENT,
} from './virtualizationEvents';

// Mock StatefulChart component
jest.mock('../StatefulChart', () => {
  /* eslint-disable no-restricted-syntax, global-require, @typescript-eslint/no-var-requires */
  const React = require('react');
  /* eslint-enable no-restricted-syntax, global-require, @typescript-eslint/no-var-requires */

  return {
    __esModule: true,
    default: ({ formData, height, width }: any) =>
      React.createElement(
        'div',
        {
          'data-testid': 'superchart',
          'data-viz-type': formData.viz_type,
          style: { height, width },
        },
        'SuperChart Mock',
      ),
  };
});

// Controllable IntersectionObserver mock so lazy-loading can be driven in tests
type IntersectionCallback = (
  entries: Array<{ isIntersecting: boolean }>,
) => void;
let intersectionCallbacks: IntersectionCallback[] = [];
let disconnectCount = 0;

class MockIntersectionObserver {
  constructor(callback: IntersectionCallback) {
    intersectionCallbacks.push(callback);
  }

  observe = () => {};

  unobserve = () => {};

  disconnect = () => {
    disconnectCount += 1;
  };

  takeRecords = () => [];
}

const triggerIntersection = (isIntersecting: boolean) => {
  act(() => {
    intersectionCallbacks.forEach(cb => cb([{ isIntersecting }]));
  });
};

const enableVirtualization = () => {
  window.featureFlags = { [FeatureFlag.DashboardVirtualization]: true };
};

const setHeadlessCapture = (value: boolean) => {
  Object.defineProperty(window.navigator, 'webdriver', {
    value,
    configurable: true,
  });
};

// Dispatches FORCE_IN_VIEW_EVENT, optionally scoped to a batch of dashboard
// row ids the way src/utils/downloadUtils.ts does for large dashboards.
const dispatchForceInView = (rowIds?: string[]) => {
  act(() => {
    window.dispatchEvent(
      rowIds
        ? new CustomEvent(FORCE_IN_VIEW_EVENT, { detail: { rowIds } })
        : new Event(FORCE_IN_VIEW_EVENT),
    );
  });
};

beforeEach(() => {
  intersectionCallbacks = [];
  disconnectCount = 0;
  (window as any).IntersectionObserver = MockIntersectionObserver;
});

afterEach(() => {
  window.featureFlags = {};
  setHeadlessCapture(false);
  // Reset the module-level force-in-view state so it doesn't leak between
  // tests (it is intentionally shared module state, mirroring production).
  act(() => {
    window.dispatchEvent(new Event(RESTORE_VIRTUALIZATION_EVENT));
  });
});

const mockDatasource = {
  id: 1,
  type: 'table',
  uid: '1__table',
  datasource_name: 'test_datasource',
  table_name: 'test_table',
  database: {
    id: 1,
    name: 'test_database',
  },
};

const mockCell: MatrixifyGridCellType = {
  id: 'matrixify-0-0',
  row: 0,
  col: 0,
  rowLabel: 'Revenue',
  colLabel: 'Q1 2024',
  title: 'Revenue - Q1 2024',
  formData: {
    viz_type: 'big_number_total',
    metrics: ['revenue'],
    adhoc_filters: [],
  },
};

const defaultProps = {
  cell: mockCell,
  datasource: mockDatasource,
  rowHeight: 200,
};

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

// Renders the cell inside a stand-in for dashboard Row.tsx's DOM node, which
// carries a `data-row-id` attribute that MatrixifyGridCell walks up to via
// `closest()` to scope itself to the right FORCE_IN_VIEW_EVENT batch. A null
// rowId renders with no such ancestor, matching a Matrixify chart previewed
// in Explore (no dashboard rows at all).
const renderCellInRow = (
  rowId: string | null,
  component: React.ReactElement,
) => {
  const themed = (
    <ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>
  );
  return rowId === null
    ? render(themed)
    : render(<div data-row-id={rowId}>{themed}</div>);
};

test('should render the cell with title', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  expect(screen.getByText('Revenue - Q1 2024')).toBeInTheDocument();
});

test('should render the cell without title when not provided', () => {
  const cellWithoutTitle = {
    ...mockCell,
    title: undefined,
  };

  renderWithTheme(
    <MatrixifyGridCell {...defaultProps} cell={cellWithoutTitle} />,
  );

  expect(screen.queryByText('Revenue - Q1 2024')).not.toBeInTheDocument();
});

test('should render SuperChart with correct props', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  const superChart = screen.getByText('SuperChart Mock');
  expect(superChart).toBeInTheDocument();
  expect(superChart).toHaveAttribute('data-viz-type', 'big_number_total');
  expect(superChart).toHaveStyle({ height: '100%', width: '100%' });
});

test('should calculate chart height correctly with title', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  const superChart = screen.getByText('SuperChart Mock');
  // StatefulChart uses 100% height within the chart wrapper
  expect(superChart).toHaveStyle({ height: '100%' });
});

test('should calculate chart height correctly without title', () => {
  const cellWithoutTitle = {
    ...mockCell,
    title: undefined,
  };

  renderWithTheme(
    <MatrixifyGridCell {...defaultProps} cell={cellWithoutTitle} />,
  );

  const superChart = screen.getByText('SuperChart Mock');
  // StatefulChart uses 100% height within the chart wrapper
  expect(superChart).toHaveStyle({ height: '100%' });
});

test('should apply correct styling to container', () => {
  const { container } = renderWithTheme(
    <MatrixifyGridCell {...defaultProps} />,
  );

  const cellContainer = container.firstChild as HTMLElement;
  expect(cellContainer).toHaveStyle({
    height: '100%',
    display: 'flex',
  });
});

test('should apply correct styling to title', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  const title = screen.getByText('Revenue - Q1 2024');
  expect(title).toHaveStyle({
    overflow: 'hidden',
  });
});

test('should handle different viz types', () => {
  const cellWithLineChart = {
    ...mockCell,
    formData: {
      ...mockCell.formData,
      viz_type: 'line',
    },
  };

  renderWithTheme(
    <MatrixifyGridCell {...defaultProps} cell={cellWithLineChart} />,
  );

  const superChart = screen.getByText('SuperChart Mock');
  expect(superChart).toHaveAttribute('data-viz-type', 'line');
});

test('should pass through additional formData properties', () => {
  const cellWithExtraProps = {
    ...mockCell,
    formData: {
      ...mockCell.formData,
      time_range: 'Last month',
      row_limit: 100,
    },
  };

  renderWithTheme(
    <MatrixifyGridCell {...defaultProps} cell={cellWithExtraProps} />,
  );

  // The SuperChart mock would receive these props
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
});

test('should handle small cell dimensions', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} rowHeight={80} />);

  const superChart = screen.getByText('SuperChart Mock');
  const cellContainer = superChart.parentElement?.parentElement;
  expect(cellContainer).toHaveStyle({ height: '100%' });

  // StatefulChart uses 100% dimensions within its wrapper
  expect(superChart).toHaveStyle({ height: '100%', width: '100%' });
});

test('should handle empty cell data gracefully', () => {
  const emptyCell = {
    ...mockCell,
    rowLabel: '',
    colLabel: '',
    title: '',
  };

  renderWithTheme(<MatrixifyGridCell {...defaultProps} cell={emptyCell} />);

  // Should still render but with empty title
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
});

test('renders chart eagerly when virtualization is disabled', () => {
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
  expect(
    screen.queryByTestId('matrixify-cell-placeholder'),
  ).not.toBeInTheDocument();
});

test('defers chart mount until the cell scrolls into view when virtualization is enabled', () => {
  enableVirtualization();

  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  // Before intersecting, only a placeholder is rendered - no query fires
  expect(screen.queryByText('SuperChart Mock')).not.toBeInTheDocument();
  expect(screen.getByTestId('matrixify-cell-placeholder')).toBeInTheDocument();

  // Once the cell enters the viewport the chart mounts
  triggerIntersection(true);

  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
  expect(
    screen.queryByTestId('matrixify-cell-placeholder'),
  ).not.toBeInTheDocument();
});

test('keeps the chart mounted after it has entered view (latch)', () => {
  enableVirtualization();

  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  triggerIntersection(true);
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
  // Observer is disconnected after the first intersection
  expect(disconnectCount).toBeGreaterThan(0);

  // Scrolling back out of view must not unmount / refetch the chart
  triggerIntersection(false);
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
});

test('renders eagerly when the browser has no IntersectionObserver support', () => {
  enableVirtualization();
  delete (window as any).IntersectionObserver;

  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  // No way to detect visibility - fall back to rendering immediately rather
  // than leaving the cell stuck on its placeholder forever.
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
  expect(
    screen.queryByTestId('matrixify-cell-placeholder'),
  ).not.toBeInTheDocument();
});

test('renders every cell eagerly during headless capture even with virtualization on', () => {
  enableVirtualization();
  setHeadlessCapture(true);

  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  // Screenshot/PDF/report workers must capture all cells regardless of scroll
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
  expect(
    screen.queryByTestId('matrixify-cell-placeholder'),
  ).not.toBeInTheDocument();
});

test('mounts an off-screen cell when an unscoped FORCE_IN_VIEW_EVENT fires (client-side download as image/PDF)', () => {
  enableVirtualization();

  // No ancestor row - e.g. a small dashboard, where downloadUtils.ts has
  // nothing to batch and dispatches a single unscoped event instead.
  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  expect(screen.queryByText('SuperChart Mock')).not.toBeInTheDocument();
  expect(screen.getByTestId('matrixify-cell-placeholder')).toBeInTheDocument();

  dispatchForceInView();

  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
  expect(
    screen.queryByTestId('matrixify-cell-placeholder'),
  ).not.toBeInTheDocument();
});

test('mounts when FORCE_IN_VIEW_EVENT is scoped to its own dashboard row', () => {
  enableVirtualization();

  renderCellInRow('row-1', <MatrixifyGridCell {...defaultProps} />);

  expect(screen.getByTestId('matrixify-cell-placeholder')).toBeInTheDocument();

  // downloadUtils.ts batches large dashboards by row and scopes each
  // dispatch's detail.rowIds to just that batch.
  dispatchForceInView(['row-1', 'row-2']);

  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
});

test('does not mount when FORCE_IN_VIEW_EVENT is scoped to a different dashboard row', () => {
  enableVirtualization();

  renderCellInRow('row-3', <MatrixifyGridCell {...defaultProps} />);

  // A batch targeting other rows must not force this cell's queries to fire;
  // otherwise a Matrixify chart would defeat downloadUtils.ts's row batching
  // by dumping every deferred cell's query into whichever batch fires first.
  dispatchForceInView(['row-1', 'row-2']);

  expect(screen.queryByText('SuperChart Mock')).not.toBeInTheDocument();
  expect(screen.getByTestId('matrixify-cell-placeholder')).toBeInTheDocument();

  // It still mounts once its own row's batch is dispatched.
  dispatchForceInView(['row-3']);

  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
});

test('renders immediately when first mounted while its own row is already forced into view', () => {
  // Simulates a matrix whose parent dashboard Row is below the fold: with
  // DASHBOARD_VIRTUALIZATION on, the Row (and everything inside it,
  // including this cell) is unmounted until FORCE_IN_VIEW_EVENT causes the
  // Row to mount it - which happens *after* that batch's event has already
  // been dispatched, so the cell only exists once it mounts.
  enableVirtualization();

  dispatchForceInView(['row-1', 'row-2']);

  renderCellInRow('row-1', <MatrixifyGridCell {...defaultProps} />);

  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
  expect(
    screen.queryByTestId('matrixify-cell-placeholder'),
  ).not.toBeInTheDocument();
});

test('does not render immediately when first mounted while a different row is being forced into view', () => {
  enableVirtualization();

  dispatchForceInView(['row-1', 'row-2']);

  // This cell's own row (row-3) was not part of that batch, so it must stay
  // lazy until its own batch is dispatched (or it scrolls into view).
  renderCellInRow('row-3', <MatrixifyGridCell {...defaultProps} />);

  expect(screen.queryByText('SuperChart Mock')).not.toBeInTheDocument();
  expect(screen.getByTestId('matrixify-cell-placeholder')).toBeInTheDocument();
});

test('re-arms lazy loading for newly-mounted cells after RESTORE_VIRTUALIZATION_EVENT', () => {
  enableVirtualization();

  dispatchForceInView();
  act(() => {
    window.dispatchEvent(new Event(RESTORE_VIRTUALIZATION_EVENT));
  });

  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  // A cell mounting after virtualization has been restored should go back
  // to lazy-loading behavior rather than staying permanently forced on.
  expect(screen.queryByText('SuperChart Mock')).not.toBeInTheDocument();
  expect(screen.getByTestId('matrixify-cell-placeholder')).toBeInTheDocument();
});

test('does not unmount after RESTORE_VIRTUALIZATION_EVENT once forced into view (latch)', () => {
  enableVirtualization();

  renderWithTheme(<MatrixifyGridCell {...defaultProps} />);

  dispatchForceInView();
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();

  act(() => {
    window.dispatchEvent(new Event(RESTORE_VIRTUALIZATION_EVENT));
  });
  expect(screen.getByText('SuperChart Mock')).toBeInTheDocument();
});
