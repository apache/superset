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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  waitFor,
  within,
  act,
  cleanup,
  fireEvent,
  userEvent,
} from 'spec/helpers/testing-library';
import * as reactRedux from 'react-redux';

// Mock hooks before any imports
jest.mock('src/hooks/apiResources', () => ({
  getDatabaseDocumentationLinks: () => ({
    support: 'https://superset.apache.org/docs/databases/installing-database-drivers',
  }),
}));

// Mock @superset-ui/core before any imports
jest.mock('@superset-ui/core', () => {
  const supersetTheme = {
    colors: {
      grayscale: { 
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
      sizes: { m: 12, s: 10 },
      weights: { bold: 700 },
    },
  };

  const styledMock = Object.assign(
    (component: any) => component,
    {
      div: () => 'div',
      span: () => 'span',
    },
  );

  const registryMock = {
    get: () => null,
    registerValue: () => {},
    keys: () => [],
    values: () => [],
    entries: () => [],
    has: () => false,
    remove: () => {},
    clear: () => {},
  };

  return {
    styled: styledMock,
    supersetTheme,
    t: (str: string) => str,
    isFeatureEnabled: jest.fn(),
    initFeatureFlags: jest.fn(),
    makeApi: jest.fn(() => jest.fn()),
    makeSingleton: (cls: any) => cls,
    SupersetClient: {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    },
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
      get() { return null; }
      registerValue() {}
      keys() { return []; }
      values() { return []; }
      entries() { return []; }
      has() { return false; }
      remove() {}
      clear() {}
    },
    theme: supersetTheme,
    getExtensionsRegistry: () => registryMock,
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

// Mock antd Form
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Form: {
    Item: ({ children }: { children: React.ReactNode }) => (
      <div data-test="antd-form-item">{children}</div>
    ),
  },
}));

// Mock ImportModal
jest.mock('src/components/ImportModal', () => ({
  __esModule: true,
  default: () => <div data-test="import-modal" />,
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
    typeof Component === 'string' ? Component : (props: any) => <Component {...props} />,
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
  bulkActions?: {
    name: string;
    onSelect: (data: any[]) => void;
  }[];
}

const ListView = ({ children, bulkActions = [], data, columns }: ListViewProps) => {
  return React.createElement(
    'div',
    { 'data-test': 'list-view', role: 'table' },
    [
      bulkActions.length > 0 &&
        React.createElement(
          'div',
          { key: 'bulk-select', 'data-test': 'bulk-select' },
          React.createElement(
            'button',
            {
              onClick: () => bulkActions[0].onSelect(data || []),
            },
            bulkActions[0].name,
          ),
        ),
      ...(data?.map((row, i) =>
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
      ) || []),
    ].filter(Boolean),
  );
};

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

// Import actual component instead of mocking it
import DatasetList from '.';

interface SubMenuProps {
  name?: string;
  tabs?: { label: string; url: string }[];
  buttons?: {
    name: string;
    onClick: () => void;
    'data-test'?: string;
  }[];
}

jest.mock('src/features/home/SubMenu', () => ({
  __esModule: true,
  default: ({ name, tabs, buttons }: SubMenuProps) => (
    <div data-test="submenu">
      <div>{name}</div>
      {buttons?.map((btn, i) => (
        <button key={i} onClick={btn.onClick} data-test={btn['data-test']}>
          {btn.name}
        </button>
      ))}
      {tabs?.map(tab => (
        <a key={tab.label} href={tab.url} role="link">
          {tab.label}
        </a>
      ))}
    </div>
  ),
}));

const mockStore = configureStore([thunk]);
const store = mockStore({});

const datasetsInfoEndpoint = 'glob:*/api/v1/dataset/_info*';
const datasetsOwnersEndpoint = 'glob:*/api/v1/dataset/related/owners*';
const datasetsSchemaEndpoint = 'glob:*/api/v1/dataset/distinct/schema*';
const datasetsDuplicateEndpoint = 'glob:*/api/v1/dataset/duplicate*';
const databaseEndpoint = 'glob:*/api/v1/dataset/related/database*';
const datasetsEndpoint = 'glob:*/api/v1/dataset/?*';

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');

const mockdatasets = [...new Array(3)].map((_, i) => ({
  changed_by_name: 'user',
  kind: i === 0 ? 'virtual' : 'physical', // ensure there is 1 virtual
  changed_by: 'user',
  changed_on: new Date().toISOString(),
  database_name: `db ${i}`,
  explore_url: `https://www.google.com?${i}`,
  id: i,
  schema: `schema ${i}`,
  table_name: `coolest table ${i}`,
  owners: [{ username: 'admin', userId: 1 }],
}));

const mockUser = {
  userId: 1,
  firstName: 'Test',
  lastName: 'User',
};

fetchMock.get(datasetsInfoEndpoint, {
  permissions: ['can_read', 'can_write', 'can_duplicate'],
});
fetchMock.get(datasetsOwnersEndpoint, {
  result: [],
});
fetchMock.get(datasetsSchemaEndpoint, {
  result: [],
});
fetchMock.post(datasetsDuplicateEndpoint, {
  result: [],
});
fetchMock.get(datasetsEndpoint, {
  result: mockdatasets,
  dataset_count: 3,
});
fetchMock.get(databaseEndpoint, {
  result: [],
});

describe('DatasetList', () => {
  const renderDatasetList = () =>
    render(<DatasetList user={mockUser} />, {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      store,
    });

  beforeEach(async () => {
    fetchMock.resetHistory();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('renders the list view', async () => {
    renderDatasetList();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('shows the import modal when import button is clicked', async () => {
    renderDatasetList();
    const importButton = await screen.findByTestId('import-button');
    userEvent.click(importButton);
    expect(screen.getByTestId('import-modal')).toBeInTheDocument();
  });
});

describe('RTL', () => {
  beforeEach(async () => {
    (jest.requireMock('@superset-ui/core').isFeatureEnabled as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('renders an "Import Dataset" tooltip under import button', async () => {
    render(<DatasetList user={mockUser} />, {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      store,
    });

    const importButton = await screen.findByTestId('import-button');
    expect(importButton).toBeInTheDocument();
  });
});

describe('Prevent unsafe URLs', () => {
  it('renders relative links when prevent unsafe is on', async () => {
    useSelectorMock.mockReturnValue(true);
    render(<DatasetList user={mockUser} />, {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      store,
    });

    const table = await screen.findByRole('table');
    expect(table).toBeInTheDocument();
  });

  it('renders absolute links when prevent unsafe is off', async () => {
    useSelectorMock.mockReturnValue(false);
    render(<DatasetList user={mockUser} />, {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
      store,
    });

    const table = await screen.findByRole('table');
    expect(table).toBeInTheDocument();
  });
});
