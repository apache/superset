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

import React, { useState } from 'react';
import fetchMock from 'fetch-mock';
import { omit, isUndefined, omitBy } from 'lodash';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';
import { render, screen } from 'spec/helpers/testing-library';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import mockState from 'spec/fixtures/mockState';
import { DashboardPageIdContext } from 'src/dashboard/containers/DashboardPage';
import DrillByModal from './DrillByModal';

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
};

const renderModal = async () => {
  const DrillByModalWrapper = () => {
    const [showModal, setShowModal] = useState(false);

    return (
      <DashboardPageIdContext.Provider value="1">
        <button type="button" onClick={() => setShowModal(true)}>
          Show modal
        </button>
        <DrillByModal
          formData={formData}
          showModal={showModal}
          onHideModal={() => setShowModal(false)}
          dataset={dataset}
        />
      </DashboardPageIdContext.Provider>
    );
  };
  render(<DrillByModalWrapper />, {
    useDnd: true,
    useRedux: true,
    useRouter: true,
    initialState: drillByModalState,
  });

  userEvent.click(screen.getByRole('button', { name: 'Show modal' }));
  await screen.findByRole('dialog', { name: `Drill by: ${chartName}` });
};

beforeEach(() => {
  fetchMock
    .post(CHART_DATA_ENDPOINT, { body: {} }, {})
    .post(FORM_DATA_KEY_ENDPOINT, { key: '123' });
});
afterEach(fetchMock.restore);

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

test('should generate Explore url', async () => {
  await renderModal();
  await waitFor(() => fetchMock.called(FORM_DATA_KEY_ENDPOINT));
  const expectedRequestPayload = {
    form_data: {
      ...omitBy(
        omit(formData, ['slice_id', 'slice_name', 'dashboards']),
        isUndefined,
      ),
      slice_id: 0,
    },
    datasource_id: Number(formData.datasource.split('__')[0]),
    datasource_type: formData.datasource.split('__')[1],
  };

  const parsedRequestPayload = JSON.parse(
    fetchMock.lastCall()?.[1]?.body as string,
  );
  parsedRequestPayload.form_data = JSON.parse(parsedRequestPayload.form_data);

  expect(parsedRequestPayload).toEqual(expectedRequestPayload);

  expect(
    await screen.findByRole('link', { name: 'Edit chart' }),
  ).toHaveAttribute('href', '/explore/?form_data_key=123&dashboard_page_id=1');
});
