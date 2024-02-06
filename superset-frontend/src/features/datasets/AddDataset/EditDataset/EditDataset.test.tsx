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
import EditDataset from './index';

const DATASET_ENDPOINT = 'glob:*api/v1/dataset/1/related_objects';

const mockedProps = {
  id: '1',
};

fetchMock.get(DATASET_ENDPOINT, { charts: { results: [], count: 2 } });

test('should render edit dataset view with tabs', async () => {
  render(<EditDataset {...mockedProps} />);

  const columnTab = await screen.findByRole('tab', { name: /columns/i });
  const metricsTab = screen.getByRole('tab', { name: /metrics/i });
  const usageTab = screen.getByRole('tab', { name: /usage/i });

  expect(fetchMock.calls(DATASET_ENDPOINT)).toBeTruthy();
  expect(columnTab).toBeInTheDocument();
  expect(metricsTab).toBeInTheDocument();
  expect(usageTab).toBeInTheDocument();
});
