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

import { useState } from 'react';
import fetchMock from 'fetch-mock';
import { omit, omitBy } from 'lodash';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import mockState from 'spec/fixtures/mockState';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import DrillByModal, { DrillByModalProps } from './DrillByModal';

// Mock the isEmbedded function
jest.mock('src/dashboard/util/isEmbedded', () => ({
  isEmbedded: jest.fn(() => false),
}));

const CHART_DATA_ENDPOINT = 'glob:*/api/v1/chart/data*';
const FORM_DATA_KEY_ENDPOINT = 'glob:*/api/v1/explore/form_data';

const { form_data: formData } = chartQueries[sliceId];
const { slice_name: chartName } = formData;
const drillByModalState = {
  ...mockState,
  dashboardLayout: {
    past: [],
    present: {
      CHART_ID: {
        id: 'CHART_ID',
        meta: {
          chartId: formData.slice_id,
          sliceName: chartName,
        },
      },
    },
    future: [],
  },
};
const dataset = {
  changed_on_humanized: '01-01-2001',
  created_on_humanized: '01-01-2001',
  description: 'desc',
  table_name: 'my_dataset',
  owners: [
    {
      first_name: 'Sarah',
      last_name: 'Connor',
    },
  ],
  columns: [
    {
      column_name: 'gender',
      verbose_name: null,
    },
    {
      column_name: 'name',
      verbose_name: null,
    },
  ],
  verbose_map: {},
};

const renderModal = async (
  modalProps: Partial<DrillByModalProps> = {},
  overrideState: Record<string, any> = {},
) => {
  const DrillByModalWrapper = () => {
    const [showModal, setShowModal] = useState(false);

    return (
      <DashboardPageIdContext.Provider value="1">
        <button type="button" onClick={() => setShowModal(true)}>
          Show modal
        </button>
        {showModal && (
          <DrillByModal
            formData={formData}
            onHideModal={() => setShowModal(false)}
            dataset={dataset}
            drillByConfig={{ groupbyFieldName: 'groupby', filters: [] }}
            canDownload
            {...modalProps}
          />
        )}
      </DashboardPageIdContext.Provider>
    );
  };
  render(<DrillByModalWrapper />, {
    useDnd: true,
    useRedux: true,
    useRouter: true,
    initialState: {
      ...drillByModalState,
      ...overrideState,
    },
  });

  userEvent.click(screen.getByRole('button', { name: 'Show modal' }));
  await screen.findByRole('dialog', { name: `Drill by: ${chartName}` });
};

beforeEach(() => {
  fetchMock
    .post(CHART_DATA_ENDPOINT, { body: {} }, {})
    .post(FORM_DATA_KEY_ENDPOINT, { key: '123' });
});
afterEach(() => fetchMock.restore());

test('should render the title', async () => {
  await renderModal();
  expect(screen.getByText(`Drill by: ${chartName}`)).toBeInTheDocument();
});

test('should render the button', async () => {
  await renderModal();
  expect(
    screen.getByRole('button', { name: 'Edit chart' }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
});

test('should close the modal', async () => {
  await renderModal();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  userEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('should render loading indicator', async () => {
  fetchMock.post(
    CHART_DATA_ENDPOINT,
    { body: {} },
    // delay is missing in fetch-mock types
    // @ts-ignore
    { overwriteRoutes: true, delay: 1000 },
  );
  await renderModal();
  expect(screen.getByLabelText('Loading')).toBeInTheDocument();
});

test('should render alert banner when results fail to load', async () => {
  await renderModal();
  expect(
    await screen.findByText('There was an error loading the chart data'),
  ).toBeInTheDocument();
});

test('should generate Explore url', async () => {
  await renderModal({
    column: { column_name: 'name', verbose_name: null },
    drillByConfig: {
      filters: [{ col: 'gender', op: '==', val: 'boy' }],
      groupbyFieldName: 'groupby',
    },
  });
  await waitFor(() => fetchMock.called(CHART_DATA_ENDPOINT));
  const expectedRequestPayload = {
    form_data: {
      ...omitBy(
        omit(formData, ['slice_id', 'slice_name', 'dashboards']),
        i => i === undefined,
      ),
      groupby: ['name'],
      adhoc_filters: [
        ...formData.adhoc_filters,
        {
          clause: 'WHERE',
          comparator: 'boy',
          expressionType: 'SIMPLE',
          operator: '==',
          operatorId: 'EQUALS',
          subject: 'gender',
        },
      ],
      slice_id: 0,
      result_format: 'json',
      result_type: 'full',
      force: false,
    },
    datasource_id: Number(formData.datasource.split('__')[0]),
    datasource_type: formData.datasource.split('__')[1],
  };

  const parsedRequestPayload = JSON.parse(
    fetchMock.lastCall()?.[1]?.body as string,
  );

  expect(parsedRequestPayload.form_data).toEqual(
    expectedRequestPayload.form_data,
  );

  expect(
    await screen.findByRole('link', { name: 'Edit chart' }),
  ).toHaveAttribute('href', '/explore/?form_data_key=123&dashboard_page_id=1');
});

test('should render radio buttons', async () => {
  await renderModal();
  const chartRadio = screen.getByRole('radio', { name: /chart/i });
  const tableRadio = screen.getByRole('radio', { name: /table/i });

  expect(chartRadio).toBeInTheDocument();
  expect(tableRadio).toBeInTheDocument();
  expect(chartRadio).toBeChecked();
  expect(tableRadio).not.toBeChecked();
  userEvent.click(tableRadio);
  expect(chartRadio).not.toBeChecked();
  expect(tableRadio).toBeChecked();
});

test('render breadcrumbs', async () => {
  await renderModal({
    column: { column_name: 'name', verbose_name: null },
    drillByConfig: {
      filters: [{ col: 'gender', op: '==', val: 'boy' }],
      groupbyFieldName: 'groupby',
    },
  });

  const breadcrumbItems = screen.getAllByTestId('drill-by-breadcrumb-item');
  expect(breadcrumbItems).toHaveLength(2);
  expect(
    within(breadcrumbItems[0]).getByText('gender (boy)'),
  ).toBeInTheDocument();
  expect(within(breadcrumbItems[1]).getByText('name')).toBeInTheDocument();

  userEvent.click(screen.getByText('gender (boy)'));

  const newBreadcrumbItems = screen.getAllByTestId('drill-by-breadcrumb-item');
  // we need to assert that there is only 1 element now
  // eslint-disable-next-line jest-dom/prefer-in-document
  expect(newBreadcrumbItems).toHaveLength(1);
  expect(within(breadcrumbItems[0]).getByText('gender')).toBeInTheDocument();
});

test('should render "Edit chart" as disabled without can_explore permission', async () => {
  await renderModal(
    {},
    {
      user: {
        ...drillByModalState.user,
        roles: { Admin: [['invalid_permission', 'Superset']] },
      },
    },
  );
  expect(screen.getByRole('button', { name: 'Edit chart' })).toBeDisabled();
});

test('should render "Edit chart" enabled with can_explore permission', async () => {
  await renderModal(
    {},
    {
      user: {
        ...drillByModalState.user,
        roles: { Admin: [['can_explore', 'Superset']] },
      },
    },
  );
  expect(screen.getByRole('button', { name: 'Edit chart' })).toBeEnabled();
});

describe('Embedded mode behavior', () => {
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const { isEmbedded } = require('src/dashboard/util/isEmbedded');

  beforeEach(() => {
    (isEmbedded as jest.Mock).mockClear();
  });

  afterEach(() => {
    (isEmbedded as jest.Mock).mockReturnValue(false);
  });

  test('should not render "Edit chart" button in embedded mode', async () => {
    (isEmbedded as jest.Mock).mockReturnValue(true);

    await renderModal();

    expect(
      screen.queryByRole('button', { name: 'Edit chart' }),
    ).not.toBeInTheDocument();
    const footerCloseButton = screen.getByTestId('close-drill-by-modal');
    expect(footerCloseButton).toHaveTextContent('Close');
  });

  test('should not call postFormData API in embedded mode', async () => {
    (isEmbedded as jest.Mock).mockReturnValue(true);

    await renderModal({
      column: { column_name: 'name', verbose_name: null },
      drillByConfig: {
        filters: [{ col: 'gender', op: '==', val: 'boy' }],
        groupbyFieldName: 'groupby',
      },
    });

    await waitFor(() => fetchMock.called(CHART_DATA_ENDPOINT));

    expect(fetchMock.called(FORM_DATA_KEY_ENDPOINT)).toBe(false);
  });

  test('should render "Edit chart" button in non-embedded mode', async () => {
    (isEmbedded as jest.Mock).mockReturnValue(false);

    await renderModal();

    expect(
      screen.getByRole('button', { name: 'Edit chart' }),
    ).toBeInTheDocument();
  });

  test('should call postFormData API in non-embedded mode', async () => {
    (isEmbedded as jest.Mock).mockReturnValue(false);

    await renderModal({
      column: { column_name: 'name', verbose_name: null },
      drillByConfig: {
        filters: [{ col: 'gender', op: '==', val: 'boy' }],
        groupbyFieldName: 'groupby',
      },
    });

    await waitFor(() => fetchMock.called(CHART_DATA_ENDPOINT));

    await waitFor(() => {
      expect(fetchMock.called(FORM_DATA_KEY_ENDPOINT)).toBe(true);
    });

    expect(
      await screen.findByRole('link', { name: 'Edit chart' }),
    ).toHaveAttribute(
      'href',
      '/explore/?form_data_key=123&dashboard_page_id=1',
    );
  });
});

describe('Table view with pagination', () => {
  beforeEach(() => {
    // Mock a large dataset response for pagination testing
    const mockLargeDataset = {
      result: [
        {
          data: Array.from({ length: 100 }, (_, i) => ({
            state: `State${i}`,
            sum__num: 1000 + i,
          })),
          colnames: ['state', 'sum__num'],
          coltypes: [1, 0],
        },
      ],
    };

    fetchMock.post(CHART_DATA_ENDPOINT, mockLargeDataset, {
      overwriteRoutes: true,
    });
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test('should render table view when Table radio is selected', async () => {
    await renderModal({
      column: { column_name: 'state', verbose_name: null },
      drillByConfig: {
        filters: [{ col: 'gender', op: '==', val: 'boy' }],
        groupbyFieldName: 'groupby',
      },
    });

    // Switch to table view
    const tableRadio = await screen.findByRole('radio', { name: /table/i });
    userEvent.click(tableRadio);

    // Wait for table to render
    await waitFor(() => {
      expect(screen.getByTestId('drill-by-results-table')).toBeInTheDocument();
    });

    // Check that pagination is rendered (there's also a breadcrumb list)
    const lists = screen.getAllByRole('list');
    const paginationList = lists.find(list =>
      list.className?.includes('pagination'),
    );
    expect(paginationList).toBeInTheDocument();
  });

  test('should handle pagination in table view', async () => {
    await renderModal({
      column: { column_name: 'state', verbose_name: null },
      drillByConfig: {
        filters: [{ col: 'gender', op: '==', val: 'boy' }],
        groupbyFieldName: 'groupby',
      },
    });

    // Switch to table view
    const tableRadio = await screen.findByRole('radio', { name: /table/i });
    userEvent.click(tableRadio);

    await waitFor(() => {
      expect(screen.getByTestId('drill-by-results-table')).toBeInTheDocument();
    });

    // Check that first page data is shown
    expect(screen.getByText('State0')).toBeInTheDocument();

    // Check pagination controls exist
    const nextPageButton = screen.getByTitle('Next Page');
    expect(nextPageButton).toBeInTheDocument();

    // Click next page
    userEvent.click(nextPageButton);

    // Verify page changed (State0 should not be visible on page 2)
    await waitFor(() => {
      expect(screen.queryByText('State0')).not.toBeInTheDocument();
    });
  });

  test('should maintain table state when switching between Chart and Table views', async () => {
    await renderModal({
      column: { column_name: 'state', verbose_name: null },
      drillByConfig: {
        filters: [{ col: 'gender', op: '==', val: 'boy' }],
        groupbyFieldName: 'groupby',
      },
    });

    const chartRadio = screen.getByRole('radio', { name: /chart/i });
    const tableRadio = screen.getByRole('radio', { name: /table/i });

    // Switch to table view
    userEvent.click(tableRadio);
    await waitFor(() => {
      expect(screen.getByTestId('drill-by-results-table')).toBeInTheDocument();
    });

    // Switch back to chart view
    userEvent.click(chartRadio);
    await waitFor(() => {
      expect(screen.getByTestId('drill-by-chart')).toBeInTheDocument();
    });

    // Switch back to table view - should maintain state
    userEvent.click(tableRadio);
    await waitFor(() => {
      expect(screen.getByTestId('drill-by-results-table')).toBeInTheDocument();
    });
  });

  test('should not cause infinite re-renders with pagination', async () => {
    // Mock console.error to catch potential infinite loop warnings
    const originalError = console.error;
    const consoleErrorSpy = jest.fn();
    console.error = consoleErrorSpy;

    await renderModal({
      column: { column_name: 'state', verbose_name: null },
      drillByConfig: {
        filters: [{ col: 'gender', op: '==', val: 'boy' }],
        groupbyFieldName: 'groupby',
      },
    });

    // Switch to table view
    const tableRadio = await screen.findByRole('radio', { name: /table/i });
    userEvent.click(tableRadio);

    await waitFor(() => {
      expect(screen.getByTestId('drill-by-results-table')).toBeInTheDocument();
    });

    // Check that no infinite loop errors were logged
    expect(consoleErrorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Maximum update depth exceeded'),
    );

    console.error = originalError;
  });

  test('should handle empty results in table view', async () => {
    // Mock empty dataset response
    fetchMock.post(
      CHART_DATA_ENDPOINT,
      {
        result: [
          {
            data: [],
            colnames: ['state', 'sum__num'],
            coltypes: [1, 0],
          },
        ],
      },
      { overwriteRoutes: true },
    );

    await renderModal({
      column: { column_name: 'state', verbose_name: null },
      drillByConfig: {
        filters: [{ col: 'gender', op: '==', val: 'boy' }],
        groupbyFieldName: 'groupby',
      },
    });

    // Switch to table view
    const tableRadio = await screen.findByRole('radio', { name: /table/i });
    userEvent.click(tableRadio);

    await waitFor(() => {
      expect(screen.getByTestId('drill-by-results-table')).toBeInTheDocument();
    });

    // Should show empty state
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  test('should handle sorting in table view', async () => {
    await renderModal({
      column: { column_name: 'state', verbose_name: null },
      drillByConfig: {
        filters: [{ col: 'gender', op: '==', val: 'boy' }],
        groupbyFieldName: 'groupby',
      },
    });

    // Switch to table view
    const tableRadio = await screen.findByRole('radio', { name: /table/i });
    userEvent.click(tableRadio);

    await waitFor(() => {
      expect(screen.getByTestId('drill-by-results-table')).toBeInTheDocument();
    });

    // Find sortable column header
    const sortableHeaders = screen.getAllByTestId('sort-header');
    expect(sortableHeaders.length).toBeGreaterThan(0);

    // Click to sort
    userEvent.click(sortableHeaders[0]);

    // Table should still be rendered without crashes
    await waitFor(() => {
      expect(screen.getByTestId('drill-by-results-table')).toBeInTheDocument();
    });
  });
});
