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

import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  userEvent,
} from 'spec/helpers/testing-library';

// Import QueryList after mocking dependencies
import QueryList from '.';

// Mock syntax highlighter before any imports
jest.mock('react-syntax-highlighter/dist/cjs/light', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <button type="button" data-test="sql-preview">
      {children}
    </button>
  ),
}));

jest.mock('react-syntax-highlighter/dist/cjs/languages/hljs/sql', () => ({
  __esModule: true,
  default: {},
}));

// Mock hooks before any imports
jest.mock('src/hooks/apiResources', () => ({
  getDatabaseDocumentationLinks: () => ({
    support:
      'https://superset.apache.org/docs/databases/installing-database-drivers',
  }),
}));

// Define QueryState before mocking
const QueryState = {
  PENDING: 'pending',
  RUNNING: 'running',
  SCHEDULED: 'scheduled',
  FAILED: 'failed',
  SUCCESS: 'success',
  TIMED_OUT: 'timed_out',
  STOPPED: 'stopped',
};

// Mock @superset-ui/core before any imports
jest.mock('@superset-ui/core', () => {
  const supersetTheme = {
    colors: {
      grayscale: {
        base: '#000',
        light1: '#ccc',
        dark1: '#1b1b1b',
        dark2: '#444444',
      },
      primary: { base: '#000' },
      success: { base: '#000' },
      error: { base: '#000' },
    },
    gridUnit: 4,
    typography: {
      families: { monospace: 'Courier' },
    },
  };

  const styledMock = Object.assign((component: any) => component, {
    div: () => 'div',
    span: () => 'span',
  });
  return {
    styled: styledMock,
    supersetTheme,
    t: (str: string) => str,
    QueryState,
    initFeatureFlags: jest.fn(),
    makeApi: jest.fn(() => jest.fn()),
    makeSingleton: (cls: any) => cls,
    getTimeFormatter: () => (value: any) => value,
    TimeFormats: {
      DATABASE_DATETIME: 'database_datetime',
    },
    FeatureFlag: {
      GlobalAsyncQueries: 'GLOBAL_ASYNC_QUERIES',
    },
    DatasourceType: {
      Table: 'table',
      Query: 'query',
    },
    getCategoricalSchemeRegistry: () => ({
      get: () => ({
        colors: ['#000000'],
      }),
    }),
    Registry: class {
      get() {
        return null;
      }

      registerValue() {}

      keys() {
        return [];
      }

      values() {
        return [];
      }

      entries() {
        return [];
      }

      has() {
        return false;
      }

      remove() {}

      clear() {}
    },
    theme: supersetTheme,
  };
});

// Mock Form
jest.mock('src/components/Form', () => ({
  __esModule: true,
  FormItem: ({ children }: { children: React.ReactNode }) => (
    <div data-test="form-item">{children}</div>
  ),
  Form: ({ children }: { children: React.ReactNode }) => (
    <form data-test="form">{children}</form>
  ),
}));

// Mock dashboard constants
jest.mock('src/dashboard/constants', () => ({
  ...jest.requireActual('src/dashboard/constants'),
  PLACEHOLDER_DATASOURCE: {
    id: 0,
    type: 'table',
    uid: '_placeholder_',
    datasource_name: '',
    table_name: '',
    schema: '',
    database: { id: 0, database_name: '' },
  },
}));

// Mock middleware/asyncEvent
jest.mock('src/middleware/asyncEvent', () => ({
  init: jest.fn(),
  fetchEvents: jest.fn(),
}));

// Mock utils/hostNamesConfig
jest.mock('src/utils/hostNamesConfig', () => ({
  getDomainsConfig: jest.fn(() => ({ domains: [] })),
}));

// Mock common utils
jest.mock('src/utils/common', () => ({
  ...jest.requireActual('src/utils/common'),
  getTimeFormatter: () => (value: any) => value,
}));

// Mock styled-components
jest.mock('@emotion/styled', () => ({
  default: (Component: any) =>
    typeof Component === 'string'
      ? Component
      : (props: any) => <Component {...props} />,
}));

// Mock components that use styled-components
jest.mock('src/components/Loading', () => ({
  __esModule: true,
  default: () => <div data-test="loading" />,
}));

jest.mock('src/components/Pagination', () => ({
  __esModule: true,
  default: () => <div data-test="pagination" />,
}));

jest.mock('src/components/TableView', () => ({
  __esModule: true,
  default: () => <div data-test="table-view" />,
}));

jest.mock('src/components/FacePile', () => ({
  __esModule: true,
  default: () => <div data-test="face-pile" />,
}));

interface Column {
  accessor?: string;
  Cell?: ({ row }: { row: { original: any; id: number } }) => React.ReactNode;
}

interface ListViewProps {
  children?: React.ReactNode;
  data?: Record<string, any>[];
  columns?: Column[];
}

const ListView = ({ children, data, columns }: ListViewProps) =>
  React.createElement(
    'div',
    { 'data-test': 'list-view', role: 'table' },
    data?.map((row, i) =>
      React.createElement(
        'div',
        { key: i, role: 'row' },
        columns?.map((col, j) =>
          React.createElement(
            'div',
            { key: j, role: 'cell' },
            col.Cell
              ? col.Cell({ row: { original: row, id: i } })
              : col.accessor && row[col.accessor],
          ),
        ),
      ),
    ),
  );

jest.mock('src/components/ListView', () => ({
  __esModule: true,
  default: ListView,
}));

// Mock explore components
jest.mock('src/explore/components/optionRenderers', () => ({
  __esModule: true,
  default: () => <div />,
}));

jest.mock('src/explore/store', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('src/explore/controls', () => ({
  __esModule: true,
  default: {},
}));

// Mock chart controls package
jest.mock('@superset-ui/chart-controls', () => ({
  __esModule: true,
  default: {},
}));

interface SubMenuProps {
  name?: string;
  tabs?: { label: string; url: string }[];
}

jest.mock('src/features/home/SubMenu', () => ({
  __esModule: true,
  default: ({ name, tabs }: SubMenuProps) => (
    <div data-test="submenu">
      <div>{name}</div>
      {tabs?.map(tab => (
        <a key={tab.label} href={tab.url}>
          {tab.label}
        </a>
      ))}
    </div>
  ),
}));

interface QueryPreviewModalProps {
  query: {
    sql: string;
  };
}

jest.mock('src/features/queries/QueryPreviewModal', () => ({
  __esModule: true,
  default: ({ query }: QueryPreviewModalProps) => (
    <div role="dialog">
      <code>{query.sql}</code>
    </div>
  ),
}));

const mockStore = configureStore([thunk]);
const store = mockStore({});

const queriesEndpoint = 'glob:*/api/v1/query/?*';

const mockQueries = [...new Array(3)].map((_, i) => ({
  changed_on: new Date().toISOString(),
  id: i,
  slice_name: `cool chart ${i}`,
  database: {
    database_name: 'main db',
  },
  schema: 'public',
  sql: `SELECT ${i} FROM table`,
  executed_sql: `SELECT ${i} FROM table`,
  sql_tables: [
    { schema: 'foo', table: 'table' },
    { schema: 'bar', table: 'table_2' },
  ],
  status: QueryState.SUCCESS,
  tab_name: 'Main Tab',
  user: {
    first_name: 'cool',
    last_name: 'dude',
    id: 2,
    username: 'cooldude',
  },
  start_time: new Date().valueOf(),
  end_time: new Date().valueOf(),
  rows: 200,
  tmp_table_name: '',
  tracking_url: '',
}));

fetchMock.get(queriesEndpoint, {
  result: mockQueries,
  chart_count: 3,
});

fetchMock.get('glob:*/api/v1/query/related/user*', {
  result: [],
  count: 0,
});
fetchMock.get('glob:*/api/v1/query/related/database*', {
  result: [],
  count: 0,
});
fetchMock.get('glob:*/api/v1/query/disting/status*', {
  result: [],
  count: 0,
});

describe('QueryList', () => {
  const renderQueryList = () =>
    render(<QueryList />, {
      useRedux: true,
      useRouter: true,
      store,
    });

  beforeEach(() => {
    fetchMock.resetHistory();
  });

  it('renders the list view', async () => {
    renderQueryList();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('fetches data', async () => {
    renderQueryList();
    await waitFor(() => {
      const calls = fetchMock.calls(/query\/\?q/);
      expect(calls).toHaveLength(1);
    });
    const calls = fetchMock.calls(/query\/\?q/);
    expect(calls[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/query/?q=(order_column:start_time,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('renders syntax highlighted SQL', async () => {
    renderQueryList();
    const codeBlocks = await screen.findAllByTestId('sql-preview');
    expect(codeBlocks).toHaveLength(mockQueries.length);

    // Each SQL preview should contain the correct query
    codeBlocks.forEach((block, index) => {
      expect(block).toHaveTextContent(new RegExp(`SELECT ${index} FROM table`));
    });
  });

  it('opens a query preview modal when clicking SQL', async () => {
    renderQueryList();
    const sqlPreviewButtons = await screen.findAllByTestId('sql-preview');

    userEvent.click(sqlPreviewButtons[0]);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/SELECT 0 FROM table/)).toBeInTheDocument();
  });

  it('allows searching queries', async () => {
    renderQueryList();

    // Wait for the search input to be available
    const searchInput = await screen.findByPlaceholderText(/Search/i);

    // Type search term and submit
    fireEvent.change(searchInput, { target: { value: 'fooo' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(fetchMock.lastCall()).toBeTruthy();
    });
    const lastCall = fetchMock.lastCall();
    expect(lastCall?.[0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/query/?q=(filters:!((col:sql,opr:ct,value:fooo)),order_column:start_time,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('renders the correct SubMenu tabs', async () => {
    renderQueryList();

    // Check for expected tabs
    expect(
      await screen.findByRole('link', { name: /Saved queries/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Query history/i }),
    ).toBeInTheDocument();

    // Check that database/dataset tabs are not present
    expect(
      screen.queryByRole('link', { name: /Databases/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Datasets/i }),
    ).not.toBeInTheDocument();
  });

  it('shows query status indicators', async () => {
    renderQueryList();

    // Wait for status icons to be rendered
    await screen.findAllByRole('img', { hidden: true });

    // Each query should have a success icon (based on mock data)
    const successIcons = await screen.findAllByTitle('Success');
    expect(successIcons).toHaveLength(mockQueries.length);
  });

  it('displays query duration in correct format', async () => {
    renderQueryList();

    // Wait for timer elements
    const timerElements = await screen.findAllByRole('timer');
    expect(timerElements).toHaveLength(mockQueries.length);

    // Check timer format (00:00:00.000)
    timerElements.forEach(timer => {
      expect(timer).toHaveTextContent(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    });
  });
});
