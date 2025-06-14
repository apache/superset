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
    },
    { column_name: 'name' },
  ],
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
    column: { column_name: 'name' },
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
    column: { column_name: 'name' },
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
