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

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { ChartCreation } from 'src/pages/ChartCreation';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';

jest.mock('src/components/DynamicPlugins', () => ({
  usePluginContext: () => ({
    mountedPluginMetadata: { table: { name: 'Table', tags: [] } },
  }),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = jest.mocked(isFeatureEnabled);

const mockDatasourceResponse = {
  result: [
    {
      id: 'table_1',
      table_name: 'table',
      datasource_type: 'table',
      database: { database_name: 'test_db' },
      schema: 'public',
    },
  ],
  count: 1,
};

const legacyDatasetFixtures = [
  {
    id: 42,
    table_name: 'shared_source',
    datasource_type: 'table',
    database: { database_name: 'examples' },
    schema: 'public',
  },
];

const combinedDatasourceFixtures = [
  {
    id: 42,
    table_name: 'shared_source',
    kind: 'physical',
    source_type: 'database',
    database: { database_name: 'examples' },
    schema: 'public',
  },
  {
    id: 42,
    table_name: 'shared_source',
    kind: 'semantic_view',
    source_type: 'semantic_layer',
    database: { database_name: 'Sales semantics' },
    schema: null,
  },
];

beforeEach(() => {
  mockIsFeatureEnabled.mockReturnValue(false);
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
    body: mockDatasourceResponse,
    status: 200,
  });
});

const mockUser: UserWithPermissionsAndRoles = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: { Admin: Array(173) },
  userId: 1,
  username: 'admin',
  isAnonymous: false,
  groups: [],
};

const mockUserWithDatasetWrite: UserWithPermissionsAndRoles = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: { Admin: [['can_write', 'Dataset']] },
  userId: 1,
  username: 'admin',
  isAnonymous: false,
  groups: [],
};

const mockHistoryPush = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

async function renderComponent(user = mockUser) {
  mockHistoryPush.mockClear();
  const rendered = render(
    <ChartCreation user={user} addSuccessToast={() => null} />,
    {
      useRedux: true,
      useRouter: true,
    },
  );
  await waitFor(() => new Promise(resolve => setTimeout(resolve, 0)));
  return rendered;
}

test('renders a select and a VizTypeGallery', async () => {
  await renderComponent();
  expect(screen.getByRole('combobox', { name: 'Dataset' })).toBeInTheDocument();
  expect(screen.getByText(/choose chart type/i)).toBeInTheDocument();
});

test('renders dataset help text when user lacks dataset write permissions', async () => {
  await renderComponent();
  expect(screen.queryByText('Add a dataset')).not.toBeInTheDocument();
  expect(screen.getByText('view instructions')).toBeInTheDocument();
});

test('renders dataset help text when user has dataset write permissions', async () => {
  await renderComponent(mockUserWithDatasetWrite);
  expect(screen.getByText('Add a dataset')).toBeInTheDocument();
  expect(screen.queryByText('view instructions')).toBeInTheDocument();
});

test('renders create chart button', async () => {
  await renderComponent();
  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeInTheDocument();
});

test('renders a disabled button if no datasource is selected', async () => {
  await renderComponent();
  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeDisabled();
});

test('renders an enabled button if datasource and viz type are selected', async () => {
  await renderComponent();

  const datasourceSelect = screen.getByRole('combobox', { name: 'Dataset' });
  userEvent.click(datasourceSelect);
  userEvent.click(await screen.findByText(/test_db/i));

  userEvent.click(
    screen.getByRole('tab', {
      name: /All charts/i,
    }),
  );
  userEvent.click(await screen.findByText('Table'));

  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeEnabled();
});

test('double-click viz type does nothing if no datasource is selected', async () => {
  await renderComponent();

  userEvent.click(
    screen.getByRole('tab', {
      name: /All charts/i,
    }),
  );
  userEvent.dblClick(await screen.findByText('Table'));

  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeDisabled();
  expect(mockHistoryPush).not.toHaveBeenCalled();
});

test('double-click viz type submits with formatted URL if datasource is selected', async () => {
  await renderComponent();

  const datasourceSelect = screen.getByRole('combobox', { name: 'Dataset' });

  userEvent.click(datasourceSelect);
  userEvent.click(await screen.findByText(/test_db/i));

  userEvent.click(
    screen.getByRole('tab', {
      name: /All charts/i,
    }),
  );
  userEvent.dblClick(await screen.findByText('Table'));

  expect(
    screen.getByRole('button', { name: 'Create new chart' }),
  ).toBeEnabled();
  const formattedUrl = '/explore/?viz_type=table&datasource=table_1__table';
  expect(mockHistoryPush).toHaveBeenCalledWith(formattedUrl);
});

test('dropdown displays matching datasets when user types a search term', async () => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
    body: {
      result: [
        {
          id: 'flights_1',
          table_name: 'flights',
          datasource_type: 'table',
          database: { database_name: 'examples' },
          schema: 'public',
        },
        {
          id: 'flights_delayed_2',
          table_name: 'flights_delayed',
          datasource_type: 'table',
          database: { database_name: 'examples' },
          schema: 'public',
        },
      ],
      count: 2,
    },
    status: 200,
  });

  await renderComponent();

  const datasourceSelect = await screen.findByRole('combobox', {
    name: 'Dataset',
  });
  userEvent.click(datasourceSelect);
  userEvent.type(datasourceSelect, 'flight');

  await screen.findByText('flights');
  expect(screen.getByText('flights_delayed')).toBeInTheDocument();
});

test('handles special characters in dataset name from URL parameter', async () => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
    body: {
      result: [
        {
          id: 'special_1',
          table_name: 'flightsÆ test',
          datasource_type: 'table',
          database: { database_name: 'test_db' },
          schema: 'public',
        },
      ],
      count: 1,
    },
    status: 200,
  });

  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?dataset=flights%C3%86%20test',
  } as Location);

  await renderComponent();

  expect(await screen.findByText('flightsÆ test')).toBeInTheDocument();

  locationSpy.mockRestore();
});

test('pre-selects the dataset from URL parameter and shows it in dropdown', async () => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
    body: {
      result: [
        {
          id: 'flights_123',
          table_name: 'flights',
          datasource_type: 'table',
          database: { database_name: 'examples' },
          schema: 'public',
        },
      ],
      count: 1,
    },
    status: 200,
  });

  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?dataset=flights',
  } as Location);

  await renderComponent();

  expect(await screen.findByText('flights')).toBeInTheDocument();

  locationSpy.mockRestore();
});

test('shows loading spinner when dataset parameter is present in URL', async () => {
  fetchMock.clearHistory().removeRoutes();
  let resolveRequest: (value: unknown) => void;
  const requestPromise = new Promise(resolve => {
    resolveRequest = resolve;
  });

  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, () =>
    requestPromise.then(() => ({
      body: {
        result: [
          {
            id: 'flights_1',
            table_name: 'flights',
            datasource_type: 'table',
            database: { database_name: 'examples' },
            schema: 'public',
          },
        ],
        count: 1,
      },
      status: 200,
    })),
  );

  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?dataset=flights',
  } as Location);

  render(<ChartCreation user={mockUser} addSuccessToast={() => null} />, {
    useRedux: true,
    useRouter: true,
  });

  expect(screen.getByRole('status')).toBeInTheDocument();

  resolveRequest!(null);

  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  locationSpy.mockRestore();
});

test('dataset dropdown sorts options alphabetically by table name regardless of id order', async () => {
  fetchMock.clearHistory().removeRoutes();
  // Mixed-case names are required: code-point comparison would place every
  // uppercase name before every lowercase one (Mango, Zebra, apple), while
  // localeCompare produces the correct case-insensitive order (apple, Mango, Zebra).
  // IDs are also out of alphabetical order to rule out ID-based sorting.
  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
    body: {
      result: [
        {
          id: 2,
          table_name: 'Zebra_table',
          datasource_type: 'table',
          database: { database_name: 'test_db' },
          schema: 'public',
        },
        {
          id: 3,
          table_name: 'apple_table',
          datasource_type: 'table',
          database: { database_name: 'test_db' },
          schema: 'public',
        },
        {
          id: 1,
          table_name: 'Mango_table',
          datasource_type: 'table',
          database: { database_name: 'test_db' },
          schema: 'public',
        },
      ],
      count: 3,
    },
    status: 200,
  });

  await renderComponent();

  const datasourceSelect = screen.getByRole('combobox', { name: 'Dataset' });
  userEvent.click(datasourceSelect);

  // Wait for all three to appear
  await screen.findByText('apple_table');
  expect(screen.getByText('Mango_table')).toBeInTheDocument();
  expect(screen.getByText('Zebra_table')).toBeInTheDocument();

  const apple = screen.getByText('apple_table');
  const mango = screen.getByText('Mango_table');
  const zebra = screen.getByText('Zebra_table');

  // Verify case-insensitive order: apple < Mango < Zebra
  expect(
    apple.compareDocumentPosition(mango) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    mango.compareDocumentPosition(zebra) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('shows only exact match when loading dataset from URL, not partial matches', async () => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, ({ url }) => {
    if (url.includes('opr:eq')) {
      return {
        body: {
          result: [
            {
              id: 'flights_1',
              table_name: 'flights',
              datasource_type: 'table',
              database: { database_name: 'examples' },
              schema: 'public',
            },
          ],
          count: 1,
        },
        status: 200,
      };
    }
    return {
      body: {
        result: [
          {
            id: 'flights_1',
            table_name: 'flights',
            datasource_type: 'table',
            database: { database_name: 'examples' },
            schema: 'public',
          },
          {
            id: 'flights_delayed_2',
            table_name: 'flights_delayed',
            datasource_type: 'table',
            database: { database_name: 'examples' },
            schema: 'public',
          },
        ],
        count: 2,
      },
      status: 200,
    };
  });

  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?dataset=flights',
  } as Location);

  await renderComponent();

  await screen.findByText('flights');
  expect(screen.queryByText('flights_delayed')).not.toBeInTheDocument();

  locationSpy.mockRestore();
});

test('loads and labels mixed datasource results across pages', async () => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.SemanticLayers,
  );
  fetchMock.get(/\/api\/v1\/datasource\/\?q=.*/, ({ url }) => {
    const isSecondPage = url.includes('page:1');
    return {
      body: {
        result: isSecondPage
          ? [
              {
                id: 43,
                table_name: 'second_page_view',
                kind: 'semantic_view',
                source_type: 'semantic_layer',
                database: { database_name: 'Sales semantics' },
                schema: null,
              },
            ]
          : combinedDatasourceFixtures,
        count: 101,
      },
      status: 200,
    };
  });

  await renderComponent();
  const datasourceSelect = screen.getByRole('combobox', {
    name: 'Datasource',
  });
  userEvent.click(datasourceSelect);

  expect(await screen.findAllByText('shared_source')).toHaveLength(2);
  const datasetTypeLabel = screen.getByText('Dataset');
  const semanticViewTypeLabel = screen.getByText('Semantic View');
  expect(datasetTypeLabel).toBeInTheDocument();
  expect(datasetTypeLabel).not.toHaveAttribute('aria-hidden', 'true');
  expect(semanticViewTypeLabel).toBeInTheDocument();
  expect(semanticViewTypeLabel).not.toHaveAttribute('aria-hidden', 'true');
  await waitFor(() =>
    expect(document.querySelector('.ant-select-suffix .ant-spin')).toBeNull(),
  );

  const scrollContainer = document.querySelector(
    '.ant-select-dropdown-list-holder',
  );
  expect(scrollContainer).not.toBeNull();
  if (!scrollContainer) {
    throw new Error('Expected datasource options to have a scroll container');
  }
  Object.defineProperty(scrollContainer, 'scrollHeight', {
    configurable: true,
    get: () => 1000,
  });
  Object.defineProperty(scrollContainer, 'offsetHeight', {
    configurable: true,
    get: () => 100,
  });
  Object.defineProperty(scrollContainer, 'clientHeight', {
    configurable: true,
    get: () => 100,
  });
  Object.defineProperty(scrollContainer, 'scrollTop', {
    configurable: true,
    get: () => 900,
    set: () => {},
  });
  fireEvent.scroll(scrollContainer);

  expect(await screen.findByText('second_page_view')).toBeInTheDocument();
  expect(
    fetchMock.callHistory.calls().some(call => call.url.includes('page:1')),
  ).toBe(true);
});

test('preserves unified server ordering without datasource type priority', async () => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.SemanticLayers,
  );
  fetchMock.get(/\/api\/v1\/datasource\/\?q=.*/, {
    body: {
      result: [
        {
          id: 7,
          table_name: 'alpha_semantic_view',
          kind: 'semantic_view',
          source_type: 'semantic_layer',
          database: { database_name: 'Sales semantics' },
          schema: null,
        },
        {
          id: 8,
          table_name: 'beta_dataset',
          kind: 'physical',
          source_type: 'database',
          database: { database_name: 'examples' },
          schema: 'public',
        },
      ],
      count: 2,
    },
    status: 200,
  });

  await renderComponent();
  userEvent.click(screen.getByRole('combobox', { name: 'Datasource' }));

  const semanticView = await screen.findByText('alpha_semantic_view');
  const dataset = screen.getByText('beta_dataset');
  expect(
    semanticView.compareDocumentPosition(dataset) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    fetchMock.callHistory.calls().some(call => {
      const decodedUrl = decodeURIComponent(call.url);
      return (
        decodedUrl.includes('order_column:table_name') &&
        decodedUrl.includes('order_direction:asc')
      );
    }),
  ).toBe(true);
});

test('searches semantic views and rejects unknown datasource kinds', async () => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.SemanticLayers,
  );
  fetchMock.get(/\/api\/v1\/datasource\/\?q=.*/, {
    body: {
      result: [
        combinedDatasourceFixtures[1],
        {
          id: 99,
          table_name: 'unsupported_source',
          kind: 'future_kind',
          source_type: 'future_source',
          database: null,
          schema: null,
        },
      ],
      count: 2,
    },
    status: 200,
  });

  await renderComponent();
  const datasourceSelect = screen.getByRole('combobox', {
    name: 'Datasource',
  });
  userEvent.click(datasourceSelect);
  userEvent.type(datasourceSelect, 'shared');

  expect(await screen.findByText('shared_source')).toBeInTheDocument();
  expect(screen.queryByText('unsupported_source')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(
      fetchMock.callHistory.calls().some(call => {
        const decodedUrl = decodeURIComponent(call.url);
        return (
          decodedUrl.includes('/api/v1/datasource/') &&
          decodedUrl.includes('col:table_name') &&
          decodedUrl.includes('opr:ct') &&
          decodedUrl.includes('shared')
        );
      }),
    ).toBe(true),
  );
});

test('navigates to Explore with the semantic view composite identity', async () => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.SemanticLayers,
  );
  fetchMock.get(/\/api\/v1\/datasource\/\?q=.*/, {
    body: { result: [combinedDatasourceFixtures[1]], count: 1 },
    status: 200,
  });

  await renderComponent();
  userEvent.click(screen.getByRole('combobox', { name: 'Datasource' }));
  userEvent.click(await screen.findByText('shared_source'));
  userEvent.click(screen.getByRole('tab', { name: /All charts/i }));
  userEvent.dblClick(await screen.findByText('Table'));

  expect(mockHistoryPush).toHaveBeenCalledWith(
    '/explore/?viz_type=table&datasource=42__semantic_view',
  );
});

test('recovers from a failed mixed datasource load without replacing selection', async () => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.SemanticLayers,
  );
  let requestCount = 0;
  fetchMock.get(/\/api\/v1\/datasource\/\?q=.*/, () => {
    requestCount += 1;
    if (requestCount === 2) {
      return { throws: new Error('datasource load failed') };
    }
    return {
      body: { result: [combinedDatasourceFixtures[1]], count: 26 },
      status: 200,
    };
  });

  await renderComponent();
  const datasourceSelect = screen.getByRole('combobox', {
    name: 'Datasource',
  });
  userEvent.click(datasourceSelect);
  userEvent.click(await screen.findByText('shared_source'));
  userEvent.click(datasourceSelect);
  userEvent.type(datasourceSelect, 'fail');

  await waitFor(() => expect(requestCount).toBe(2), { timeout: 3000 });
  expect(screen.getByText('shared_source')).toBeInTheDocument();

  userEvent.clear(datasourceSelect);
  userEvent.type(datasourceSelect, 'retry');
  await waitFor(() => expect(requestCount).toBe(3), { timeout: 3000 });
  expect(await screen.findByText('shared_source')).toBeInTheDocument();
});

test('uses generic picker terminology without changing the dataset action', async () => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.SemanticLayers,
  );
  fetchMock.get(/\/api\/v1\/datasource\/\?q=.*/, {
    body: { result: combinedDatasourceFixtures, count: 2 },
    status: 200,
  });

  await renderComponent(mockUserWithDatasetWrite);

  expect(
    screen.getByRole('combobox', { name: 'Datasource' }),
  ).toBeInTheDocument();
  expect(screen.getAllByText('Choose a datasource')).toHaveLength(2);
  const addDatasetLink = screen.getByRole('link', { name: 'Add a dataset' });
  expect(addDatasetLink).toHaveAttribute('href', '/dataset/add/');
});

test('keeps the legacy dataset-only picker when semantic layers are disabled', async () => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
    body: { result: legacyDatasetFixtures, count: 1 },
    status: 200,
  });

  await renderComponent();
  const datasourceSelect = screen.getByRole('combobox', { name: 'Dataset' });
  userEvent.click(datasourceSelect);
  userEvent.click(await screen.findByText('shared_source'));

  expect(screen.queryByText('Semantic View')).not.toBeInTheDocument();
  expect(screen.queryByText('Dataset', { selector: '.ant-tag' })).toBeNull();
  expect(
    fetchMock.callHistory
      .calls()
      .some(call => call.url.includes('/api/v1/datasource/')),
  ).toBe(false);

  userEvent.click(screen.getByRole('tab', { name: /All charts/i }));
  userEvent.dblClick(await screen.findByText('Table'));
  expect(mockHistoryPush).toHaveBeenCalledWith(
    '/explore/?viz_type=table&datasource=42__table',
  );
});

test('keeps the legacy no-options state when semantic layers are disabled', async () => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
    body: { result: [], count: 0 },
    status: 200,
  });

  await renderComponent();
  userEvent.click(screen.getByRole('combobox', { name: 'Dataset' }));

  expect(
    await screen.findByText('No data', { selector: '.ant-empty-description' }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Semantic View')).not.toBeInTheDocument();
});

test('uses the exact dataset endpoint for URL preload with semantic layers enabled', async () => {
  mockIsFeatureEnabled.mockImplementation(
    flag => flag === FeatureFlag.SemanticLayers,
  );
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(/\/api\/v1\/dataset\/\?q=.*/, {
    body: { result: legacyDatasetFixtures, count: 1 },
    status: 200,
  });

  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?dataset=shared_source',
  } as Location);

  await renderComponent();

  expect(await screen.findByText('shared_source')).toBeInTheDocument();
  expect(
    fetchMock.callHistory.calls().some(call => {
      const decodedUrl = decodeURIComponent(call.url);
      return (
        decodedUrl.includes('/api/v1/dataset/') &&
        decodedUrl.includes('opr:eq') &&
        decodedUrl.includes('shared_source')
      );
    }),
  ).toBe(true);
  expect(
    fetchMock.callHistory
      .calls()
      .some(call => call.url.includes('/api/v1/datasource/')),
  ).toBe(false);

  locationSpy.mockRestore();
});
