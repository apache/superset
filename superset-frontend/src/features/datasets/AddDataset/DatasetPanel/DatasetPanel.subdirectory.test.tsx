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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';

// DatasetPanel opens the dataset via openInNewTab -> ensureAppRoot, which reads
// applicationRoot() statically. Intercept it to simulate a subdirectory deploy.
const mockApplicationRoot = jest.fn<string, []>(() => '');

jest.mock('src/utils/getBootstrapData', () => {
  const actual = jest.requireActual<
    typeof import('src/utils/getBootstrapData')
  >('src/utils/getBootstrapData');
  return {
    __esModule: true,
    default: actual.default,
    applicationRoot: () => mockApplicationRoot(),
    staticAssetsPrefix: actual.staticAssetsPrefix,
  };
});

// eslint-disable-next-line import/first
import DatasetPanel from 'src/features/datasets/AddDataset/DatasetPanel/DatasetPanel';
// eslint-disable-next-line import/first
import { exampleColumns } from './fixtures';
// eslint-disable-next-line import/first
import { DatasetObject } from 'src/features/datasets/AddDataset/types';

const APP_ROOT = '/superset';

let openSpy: jest.SpyInstance;

beforeEach(() => {
  mockApplicationRoot.mockReturnValue(APP_ROOT);
  openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
});

afterEach(() => {
  jest.restoreAllMocks();
});

const datasetWith = (exploreUrl: string): DatasetObject[] => [
  {
    db: {
      id: 1,
      database_name: 'test_database',
      editors: [1],
      backend: 'test_backend',
    },
    schema: 'test_schema',
    dataset_name: 'example_dataset',
    table_name: 'example_table',
    explore_url: exploreUrl,
  },
];

test('View Dataset opens a single-prefixed URL under a subdirectory deployment', async () => {
  // The backend emits explore_url already carrying the application root. The
  // strip must run before ensureAppRoot re-prefixes, otherwise the opened tab
  // would point at a doubled /superset/superset/... path.
  render(
    <DatasetPanel
      tableName="example_table"
      hasError={false}
      columnList={exampleColumns}
      loading={false}
      datasets={datasetWith(`${APP_ROOT}/explore/?datasource=1__table`)}
    />,
    { useRouter: true },
  );

  await userEvent.click(screen.getByText('View Dataset'));

  expect(openSpy).toHaveBeenCalledTimes(1);
  const openedUrl = openSpy.mock.calls[0][0];
  expect(openedUrl).toBe(`${APP_ROOT}/explore/?datasource=1__table`);
  expect(openedUrl).not.toContain('/superset/superset');
});

test('View Dataset passes an external explore_url through unprefixed', async () => {
  render(
    <DatasetPanel
      tableName="example_table"
      hasError={false}
      columnList={exampleColumns}
      loading={false}
      datasets={datasetWith('https://external.example.com/custom-endpoint')}
    />,
    { useRouter: true },
  );

  await userEvent.click(screen.getByText('View Dataset'));

  expect(openSpy).toHaveBeenCalledTimes(1);
  expect(openSpy.mock.calls[0][0]).toBe(
    'https://external.example.com/custom-endpoint',
  );
});
