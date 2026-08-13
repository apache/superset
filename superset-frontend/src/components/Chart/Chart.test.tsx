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
import { render, screen, fireEvent } from 'spec/helpers/testing-library';
import '@testing-library/jest-dom';
import type { JsonObject } from '@superset-ui/core';
import { PLACEHOLDER_DATASOURCE } from 'src/dashboard/constants';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import type { ChartStatus } from 'src/explore/types';
import {
  CHART_STATUS_ATTR,
  CHART_STATUS_ATTR_VALUES,
} from 'src/utils/screenshotContract';
import Chart from './Chart';
import type { Actions } from './Chart';

// The success/rendered/pending branches render down through ChartRenderer
// into SuperChart, which needs a registered viz plugin. Mock it the same way
// ChartRenderer.test.tsx does, so these tests can exercise the beacon
// attribute on Chart's own root node without depending on the chart plugin
// registry.
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SuperChart: (props: JsonObject) => (
    <div data-test="mock-super-chart">{JSON.stringify(props.formData)}</div>
  ),
}));

jest.mock(
  'src/components/Chart/ChartContextMenu/ChartContextMenu',
  () => () => <div data-test="mock-chart-context-menu" />,
);

const mockActions: Actions = {
  logEvent: jest.fn() as unknown as Actions['logEvent'],
  chartRenderingFailed: jest.fn() as unknown as Actions['chartRenderingFailed'],
  chartRenderingSucceeded:
    jest.fn() as unknown as Actions['chartRenderingSucceeded'],
  postChartFormData: jest.fn() as unknown as Actions['postChartFormData'],
};

const baseProps = {
  chartId: 1,
  width: 800,
  height: 600,
  actions: mockActions,
  formData: { datasource: '1__table', viz_type: 'table' },
  vizType: 'table',
  setControlValue: jest.fn(),
};

// Finds the root DOM node carrying the data-chart-status beacon attribute,
// regardless of which Chart.tsx render branch produced it.
const getStatusNode = (container: HTMLElement) =>
  container.querySelector(`[${CHART_STATUS_ATTR}]`);

// dashboardId is intentionally varied across these cases (rather than only
// tested once via statusCases below) because it changes which sub-tree
// actually renders for "failed" (spinner size, ChartSource passed into
// ChartErrorMessage) and for "stopped" (EmptyState sizing) — the published
// beacon value must stay identical across both render paths regardless.
const failedBackendErrorProps = {
  chartStatus: 'failed' as const,
  chartAlert: 'Your default credentials were not found.',
  datasource: PLACEHOLDER_DATASOURCE,
  datasetsStatus: ResourceStatus.Loading,
  queriesResponse: [
    {
      errors: [
        {
          error_type: 'GENERIC_BACKEND_ERROR',
          message: 'Your default credentials were not found.',
          extra: {
            issue_codes: [{ code: 1011, message: 'Issue 1011' }],
          },
          level: 'error',
        },
      ],
    },
  ],
};

test('shows backend error instead of loading spinner when datasource is still a placeholder (standalone)', () => {
  const { container } = render(
    <Chart {...baseProps} {...failedBackendErrorProps} />,
  );

  expect(
    screen.getByText(/Your default credentials were not found/),
  ).toBeInTheDocument();
  // A real backend error is a terminal failure, so the beacon must say
  // "failed", not "loading" — even though the datasource is still a
  // placeholder, the errors array takes precedence.
  expect(getStatusNode(container)).toHaveAttribute(
    CHART_STATUS_ATTR,
    CHART_STATUS_ATTR_VALUES.FAILED,
  );
});

test('shows backend error instead of loading spinner when datasource is still a placeholder (dashboard)', () => {
  const { container } = render(
    <Chart {...baseProps} {...failedBackendErrorProps} dashboardId={7} />,
  );

  expect(
    screen.getByText(/Your default credentials were not found/),
  ).toBeInTheDocument();
  expect(getStatusNode(container)).toHaveAttribute(
    CHART_STATUS_ATTR,
    CHART_STATUS_ATTR_VALUES.FAILED,
  );
});

const failedDatasourceLoadingProps = {
  chartStatus: 'failed' as const,
  chartAlert: 'Some client-side error',
  datasource: PLACEHOLDER_DATASOURCE,
  datasetsStatus: ResourceStatus.Loading,
  queriesResponse: [{}],
};

test('shows loading spinner for client-side errors without errors array when datasource is still a placeholder (standalone)', () => {
  const { container } = render(
    <Chart {...baseProps} {...failedDatasourceLoadingProps} />,
  );

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText(/Some client-side error/)).not.toBeInTheDocument();
  // Datasource-still-loading sub-case of the failed branch: publishing the
  // terminal "failed" value here would lie to beacon consumers about a
  // spinner state that is still in progress.
  expect(getStatusNode(container)).toHaveAttribute(
    CHART_STATUS_ATTR,
    CHART_STATUS_ATTR_VALUES.LOADING,
  );
});

test('shows loading spinner for client-side errors without errors array when datasource is still a placeholder (dashboard)', () => {
  const { container } = render(
    <Chart {...baseProps} {...failedDatasourceLoadingProps} dashboardId={7} />,
  );

  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByText(/Some client-side error/)).not.toBeInTheDocument();
  expect(getStatusNode(container)).toHaveAttribute(
    CHART_STATUS_ATTR,
    CHART_STATUS_ATTR_VALUES.LOADING,
  );
});

test('shows the stop message and a re-run affordance when the query was stopped (standalone)', () => {
  const onQuery = jest.fn();
  const { container } = render(
    <Chart
      {...baseProps}
      chartStatus="stopped"
      chartAlert="Updating chart was stopped"
      onQuery={onQuery}
    />,
  );

  expect(screen.getByText('Updating chart was stopped')).toBeInTheDocument();

  const rerun = screen.getByText('click here');
  expect(rerun.tagName).toBe('BUTTON');
  fireEvent.click(rerun);
  expect(onQuery).toHaveBeenCalledTimes(1);
  expect(getStatusNode(container)).toHaveAttribute(
    CHART_STATUS_ATTR,
    CHART_STATUS_ATTR_VALUES.STOPPED,
  );
});

test('shows the stop message and a re-run affordance when the query was stopped (dashboard)', () => {
  const onQuery = jest.fn();
  const { container } = render(
    <Chart
      {...baseProps}
      dashboardId={7}
      chartStatus="stopped"
      chartAlert="Updating chart was stopped"
      onQuery={onQuery}
    />,
  );

  expect(screen.getByText('Updating chart was stopped')).toBeInTheDocument();

  const rerun = screen.getByText('click here');
  expect(rerun.tagName).toBe('BUTTON');
  fireEvent.click(rerun);
  expect(onQuery).toHaveBeenCalledTimes(1);
  expect(getStatusNode(container)).toHaveAttribute(
    CHART_STATUS_ATTR,
    CHART_STATUS_ATTR_VALUES.STOPPED,
  );
});

// Every reducer-set chartStatus value, plus the pre-fetch `null` that Redux
// starts with, mapped to the beacon value Chart.tsx must publish on its
// shared Styles root — for both the standalone (Explore) and dashboard
// render paths, since dashboardId changes which sub-tree renders (spinner
// size, muted styling) but must never change the published status.
const statusCases: Array<{
  chartStatus: ChartStatus | '' | null | undefined;
  expected: string;
  label: string;
}> = [
  {
    chartStatus: null,
    expected: CHART_STATUS_ATTR_VALUES.PENDING,
    label: 'null',
  },
  {
    chartStatus: '',
    expected: CHART_STATUS_ATTR_VALUES.PENDING,
    label: '"" (datasource-retry reset)',
  },
  {
    chartStatus: 'loading',
    expected: CHART_STATUS_ATTR_VALUES.LOADING,
    label: '"loading"',
  },
  {
    chartStatus: 'success',
    expected: CHART_STATUS_ATTR_VALUES.LOADING,
    label: '"success" (pre-paint, non-terminal)',
  },
  {
    chartStatus: 'rendered',
    expected: CHART_STATUS_ATTR_VALUES.RENDERED,
    label: '"rendered"',
  },
];

statusCases.forEach(({ chartStatus, expected, label }) => {
  test(`publishes data-chart-status="${expected}" for chartStatus ${label} (standalone)`, () => {
    const { container } = render(
      <Chart
        {...baseProps}
        chartStatus={chartStatus as ChartStatus}
        queriesResponse={[]}
      />,
    );
    expect(screen.getByTestId('chart-container')).toHaveAttribute(
      CHART_STATUS_ATTR,
      expected,
    );
    expect(getStatusNode(container)).toBe(
      screen.getByTestId('chart-container'),
    );
  });

  test(`publishes data-chart-status="${expected}" for chartStatus ${label} (dashboard)`, () => {
    const { container } = render(
      <Chart
        {...baseProps}
        dashboardId={7}
        chartStatus={chartStatus as ChartStatus}
        queriesResponse={[]}
      />,
    );
    expect(screen.getByTestId('chart-container')).toHaveAttribute(
      CHART_STATUS_ATTR,
      expected,
    );
    expect(getStatusNode(container)).toBe(
      screen.getByTestId('chart-container'),
    );
  });
});

test('falls back to data-chart-status="pending" for an unrecognized/future chartStatus value', () => {
  const { container } = render(
    <Chart
      {...baseProps}
      chartStatus={'not-a-real-status' as unknown as ChartStatus}
      queriesResponse={[]}
    />,
  );
  expect(getStatusNode(container)).toHaveAttribute(
    CHART_STATUS_ATTR,
    CHART_STATUS_ATTR_VALUES.PENDING,
  );
});

test('publishes data-chart-status="stopped" for the missing-controls EmptyState (Explore preview, not a chartStatus)', () => {
  const { container } = render(
    <Chart {...baseProps} errorMessage="Add required control values" />,
  );
  expect(
    screen.getByText('Add required control values to preview chart'),
  ).toBeInTheDocument();
  expect(getStatusNode(container)).toHaveAttribute(
    CHART_STATUS_ATTR,
    CHART_STATUS_ATTR_VALUES.STOPPED,
  );
});

test('publishes data-chart-status="stopped" for the "ready to go" EmptyState (Explore preview, not a chartStatus)', () => {
  const { container } = render(
    <Chart {...baseProps} chartIsStale queriesResponse={[]} />,
  );
  expect(screen.getByText('Your chart is ready to go!')).toBeInTheDocument();
  expect(getStatusNode(container)).toHaveAttribute(
    CHART_STATUS_ATTR,
    CHART_STATUS_ATTR_VALUES.STOPPED,
  );
});

test('screenshotContract exports no CSS class name strings', () => {
  // Guard against scope creep: this contract is attribute-only, and must
  // never grow a styling hook such as a CSS class name.
  expect(CHART_STATUS_ATTR).toBe('data-chart-status');
  Object.values(CHART_STATUS_ATTR_VALUES).forEach(value => {
    expect(typeof value).toBe('string');
    expect(value).not.toMatch(/[.#]/); // no CSS selector punctuation
    expect(value.toLowerCase()).not.toContain('chart-container');
    expect(value.toLowerCase()).not.toContain('class');
  });
});
