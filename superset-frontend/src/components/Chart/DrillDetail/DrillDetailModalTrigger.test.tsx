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
import { QueryObjectFilterClause, SqlaFormData } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { getMockStoreWithNativeFilters } from 'spec/fixtures/mockStore';
import chartQueries, { sliceId } from 'spec/fixtures/mockChartQueries';
import DrillDetailModalTrigger from './DrillDetailModalTrigger';

jest.mock('./DrillDetailPane', () => () => null);
const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

const { id: chartId, form_data: chartFormData } = chartQueries[sliceId];
const { slice_name: chartName } = chartFormData;
const openModal = async (
  formData?: SqlaFormData,
  filters?: QueryObjectFilterClause[],
) => {
  const store = getMockStoreWithNativeFilters();
  render(
    <DrillDetailModalTrigger
      chartId={chartId}
      formData={formData || chartFormData}
      filters={filters}
    >
      Open modal
    </DrillDetailModalTrigger>,
    { useRouter: true, useRedux: true, store },
  );

  const button = screen.getByRole('button', { name: 'Open modal' });
  userEvent.click(button);
  await screen.findByRole('dialog', { name: `Drill to detail: ${chartName}` });
};

test('should render the title', async () => {
  await openModal();
  expect(screen.getByText(`Drill to detail: ${chartName}`)).toBeInTheDocument();
});

test('should render the button', async () => {
  await openModal();
  expect(
    screen.getByRole('button', { name: 'Edit chart' }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
});

test('should close the modal', async () => {
  await openModal();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  userEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('should forward to Explore', async () => {
  await openModal();
  userEvent.click(screen.getByRole('button', { name: 'Edit chart' }));
  expect(mockHistoryPush).toHaveBeenCalledWith(
    `/explore/?dashboard_page_id=&slice_id=${sliceId}`,
  );
});
