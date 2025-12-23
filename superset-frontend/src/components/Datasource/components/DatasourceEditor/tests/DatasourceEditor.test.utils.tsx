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
import {
  render,
  screen,
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import mockDatasource from 'spec/fixtures/mockDatasource';
import type { DatasetObject } from 'src/features/datasets/types';
import DatasourceEditor from '..';

export interface DatasourceEditorProps {
  datasource: DatasetObject;
  addSuccessToast: () => void;
  addDangerToast: () => void;
  onChange: jest.MockedFunction<
    (datasource: DatasetObject, errors?: unknown) => void
  >;
  formatQuery?: jest.Mock;
  columnLabels?: Record<string, string>;
  columnLabelTooltips?: Record<string, string>;
}

/**
 * Factory function that creates fresh props for each test.
 * Deep clones the datasource fixture to prevent test pollution from mutations.
 */
export const createProps = (): DatasourceEditorProps => ({
  datasource: JSON.parse(JSON.stringify(mockDatasource['7__table'])),
  addSuccessToast: () => {},
  addDangerToast: () => {},
  onChange: jest.fn(),
  formatQuery: jest.fn().mockResolvedValue({ json: { result: '' } }),
  columnLabels: {
    state: 'State',
  },
  columnLabelTooltips: {
    state: 'This is a tooltip for state',
  },
});

/**
 * @deprecated Use createProps() factory instead to prevent test pollution.
 * Kept for backward compatibility during migration.
 */
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
 * Fast render without waitFor wrapper.
 * Use when mount side-effects aren't being asserted.
 * After calling, use findBy* to ensure mount completion.
 */
export const fastRender = (renderProps: DatasourceEditorProps) =>
  render(<DatasourceEditor {...renderProps} {...routeProps} />, {
    useRedux: true,
    initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
    useRouter: true,
  });

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
 * Flushes microtasks and animation frames.
 * Call this in afterEach to prevent "document global is not defined" errors.
 *
 * Note: Uses real timers (not fake timers), so jest.runOnlyPendingTimers() is not used.
 */
export const cleanupAsyncOperations = async () => {
  // Flush promise microtasks first
  await Promise.resolve();

  // Wait for pending animation frames (guard for non-DOM environments)
  // Loop twice to catch chained rAFs (max 2 to stay idempotent)
  if (typeof requestAnimationFrame !== 'undefined') {
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  // Flush microtasks again after rAFs
  await Promise.resolve();

  // Final flush via setTimeout(0)
  await new Promise(resolve => setTimeout(resolve, 0));
};

/**
 * Dismiss the datasource warning modal if present.
 * Centralized helper to avoid duplication across test files.
 */
export const dismissDatasourceWarning = async () => {
  const closeButton = screen.queryByRole('button', { name: /close/i });
  if (closeButton) {
    await userEvent.click(closeButton);
  }
};

/**
 * Creates a deferred promise that can be manually resolved/rejected.
 * Useful for controlling timing in abort/unmount tests.
 */
export function createDeferredPromise<T = any>() {
  let resolve: (value: T) => void;
  let reject: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: resolve!, reject: reject! };
}
