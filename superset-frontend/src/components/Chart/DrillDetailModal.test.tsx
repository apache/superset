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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { getMockStoreWithNativeFilters } from 'spec/fixtures/mockStore';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import { QueryFormData } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import DrillDetailModal from './DrillDetailModal';

const chart = chartQueries[sliceId];
const setup = (overrides: Record<string, any> = {}) => {
  const store = getMockStoreWithNativeFilters();
  const props = {
    chartId: sliceId,
    initialFilters: [],
    formData: chart.form_data as unknown as QueryFormData,
    ...overrides,
  };
  return render(<DrillDetailModal {...props} />, {
    useRedux: true,
    useRouter: true,
    store,
  });
};
const waitForRender = (overrides: Record<string, any> = {}) =>
  waitFor(() => setup(overrides));

fetchMock.post(
  'end:/datasource/samples?force=false&datasource_type=table&datasource_id=7&per_page=50&page=1',
  {
    result: {
      data: [],
      colnames: [],
      coltypes: [],
    },
  },
);

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

test('should render', async () => {
  const { container } = await waitForRender();
  expect(container).toBeInTheDocument();
});

test('should render the title', async () => {
  await waitForRender();
  expect(
    screen.getByText(`Drill to detail: ${chart.form_data.slice_name}`),
  ).toBeInTheDocument();
});

test('should render the modal', async () => {
  await waitForRender();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

test('should not render the modal', async () => {
  await waitForRender({
    initialFilters: undefined,
  });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('should render the button', async () => {
  await waitForRender();
  expect(
    screen.getByRole('button', { name: 'Edit chart' }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
});

test('should close the modal', async () => {
  await waitForRender();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  userEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('should forward to Explore', async () => {
  await waitForRender();
  userEvent.click(screen.getByRole('button', { name: 'Edit chart' }));
  expect(mockHistoryPush).toHaveBeenCalledWith(
    `/explore/?dashboard_page_id=&slice_id=${sliceId}`,
  );
});
