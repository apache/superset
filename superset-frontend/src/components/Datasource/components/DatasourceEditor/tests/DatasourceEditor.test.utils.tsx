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
import fetchMock from 'fetch-mock';
import { render, waitFor } from 'spec/helpers/testing-library';
import mockDatasource from 'spec/fixtures/mockDatasource';
import type { DatasetObject } from 'src/features/datasets/types';
import DatasourceEditor from '..';

export interface DatasourceEditorProps {
  datasource: DatasetObject;
  addSuccessToast: () => void;
  addDangerToast: () => void;
  onChange: jest.Mock;
  columnLabels?: Record<string, string>;
  columnLabelTooltips?: Record<string, string>;
}

// Common setup for tests
export const props: DatasourceEditorProps = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: jest.fn(),
  columnLabels: {
    state: 'State',
  },
  columnLabelTooltips: {
    state: 'This is a tooltip for state',
  },
};

export const DATASOURCE_ENDPOINT =
  'glob:*/datasource/external_metadata_by_name/*';

const routeProps = {
  history: {},
  location: {},
  match: {},
};

export const asyncRender = (renderProps: DatasourceEditorProps) =>
  waitFor(() =>
    render(<DatasourceEditor {...renderProps} {...routeProps} />, {
      useRedux: true,
      initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
      useRouter: true,
    }),
  );

/**
 * Setup common API mocks for DatasourceEditor tests.
 * Mocks the 3 endpoints called on component mount to prevent test hangs and async warnings.
 */
export const setupDatasourceEditorMocks = () => {
  fetchMock.get(
    url => url.includes('/api/v1/chart/'),
    { result: [], count: 0, ids: [] },
    { overwriteRoutes: true },
  );
  fetchMock.get(
    url => url.includes('/api/v1/database/'),
    { result: [], count: 0, ids: [] },
    { overwriteRoutes: true },
  );
  fetchMock.get(
    url => url.includes('/api/v1/dataset/related/owners'),
    { result: [], count: 0 },
    { overwriteRoutes: true },
  );
};

/**
 * Cleanup async operations to prevent test pollution.
 * Waits for pending animation frames and microtasks to complete.
 * Call this in afterEach to prevent "document global is not defined" errors.
 */
export const cleanupAsyncOperations = async () => {
  // Wait for pending animation frames
  await new Promise(resolve => requestAnimationFrame(resolve));
  // Flush remaining microtasks
  await new Promise(resolve => setTimeout(resolve, 0));
};
