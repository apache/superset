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
import fetchMock from 'fetch-mock';
import { render, screen } from 'spec/helpers/testing-library';
import ToastContainer from 'src/components/MessageToasts/ToastContainer';
import DatasetUsage from '.';

const datasetId = '1';
const emptyChartResponse = { count: 0, result: [] };

const mockChartsFetch = (response: any) => {
  fetchMock.reset();
  fetchMock.get('glob:*/api/v1/chart/_info?*', {
    permissions: ['can_export', 'can_read', 'can_write'],
  });

  fetchMock.get('glob:*/api/v1/chart/?*', response);
};

const renderDatasetUsage = () =>
  render(
    <>
      <DatasetUsage datasetId={datasetId} />
      <ToastContainer />
    </>,
    { useRedux: true },
  );

test('shows loading state', () => {
  mockChartsFetch(
    new Promise(resolve => setTimeout(() => resolve(emptyChartResponse), 250)),
  );
  renderDatasetUsage();

  const loadingIndicator = screen.getByRole('status', {
    name: /loading/i,
  });

  expect(loadingIndicator).toBeVisible();
});

test('shows error state', async () => {
  mockChartsFetch(500);
  renderDatasetUsage();

  const errorMessage = await screen.findByText(
    /an error occurred while fetching charts/i,
  );

  expect(errorMessage).toBeInTheDocument();
});

test('shows empty state', async () => {
  mockChartsFetch(emptyChartResponse);
  renderDatasetUsage();

  const noChartsTitle = await screen.findByText(/no charts/i);
  const noChartsDescription = screen.getByText(
    /this dataset is not used to power any charts\./i,
  );

  expect(noChartsTitle).toBeVisible();
  expect(noChartsDescription).toBeVisible();
});

test.todo('shows and sorts single-page results');
test.todo('shows and sorts multi-page results and paginates');
