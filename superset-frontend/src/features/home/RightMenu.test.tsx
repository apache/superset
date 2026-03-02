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
import * as reactRedux from 'react-redux';
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { isEmbedded } from 'src/dashboard/util/isEmbedded';
import RightMenu from './RightMenu';
import { GlobalMenuDataOptions, RightMenuProps } from './types';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

const mockIsFeatureEnabled = isFeatureEnabled as jest.MockedFunction<
  typeof isFeatureEnabled
>;

jest.mock('src/dashboard/util/isEmbedded', () => ({
  isEmbedded: jest.fn(() => false),
}));

const mockIsEmbedded = isEmbedded as jest.MockedFunction<typeof isEmbedded>;

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

// Mock useBreakpoint to return desktop breakpoints (prevents mobile menu rendering)
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Grid: {
    ...jest.requireActual('antd').Grid,
    useBreakpoint: () => ({ xs: true, sm: true, md: true, lg: true, xl: true }),
  },
}));

jest.mock('src/features/databases/DatabaseModal', () => {
  const DatabaseModal = () => <span />;
  DatabaseModal.displayName = 'DatabaseModal';
  return DatabaseModal;
});

const dropdownItems = [
  {
    label: 'Data',
    icon: 'fa-database',
    childs: [
      {
        label: 'Connect database',
        name: GlobalMenuDataOptions.DbConnection,
        perm: true,
      },
      {
        label: 'Create dataset',
        name: GlobalMenuDataOptions.DatasetCreation,
        perm: true,
      },
      {
        label: 'Connect Google Sheet',
        name: GlobalMenuDataOptions.GoogleSheets,
        perm: true,
      },
      {
        label: 'Upload CSV to database',
        name: 'Upload a CSV',
        url: '#',
        perm: true,
      },
      {
        label: 'Upload columnar file to database',
        name: 'Upload a Columnar file',
        url: '#',
        perm: true,
      },
    ],
  },
  {
    label: 'SQL query',
    url: '/sqllab?new=true',
    icon: 'fa-fw fa-search',
    perm: 'can_sqllab',
    view: 'Superset',
  },
  {
    label: 'Chart',
    url: '/chart/add',
    icon: 'fa-fw fa-bar-chart',
    perm: 'can_write',
    view: 'Chart',
  },
  {
    label: 'Dashboard',
    url: '/dashboard/new',
    icon: 'fa-fw fa-dashboard',
    perm: 'can_write',
    view: 'Dashboard',
  },
];

const createProps = (): RightMenuProps => ({
  align: 'flex-end',
  navbarRight: {
    show_watermark: false,
    bug_report_url: undefined,
    documentation_url: undefined,
    languages: {
      en: {
        flag: 'us',
        name: 'English',
        url: '/lang/en',
      },
      it: {
        flag: 'it',
        name: 'Italian',
        url: '/lang/it',
      },
    },
    show_language_picker: false,
    user_is_anonymous: false,
    user_info_url: '/users/userinfo/',
    user_logout_url: '/logout/',
    user_login_url: '/login/',
    locale: 'en',
    version_string: '1.0.0',
    version_sha: 'randomSHA',
    build_number: 'randomBuildNumber',
  },
  settings: [],
  isFrontendRoute: () => true,
  environmentTag: {
    color: 'error.base',
    text: 'Development2',
  },
});

const mockNonExamplesDB = Array.from({ length: 2 })
  .fill(undefined)
  .map((_, i) => ({
    changed_by: {
      first_name: `user`,
      last_name: `${i}`,
    },
    database_name: `db ${i}`,
    backend: 'postgresql',
    allow_run_async: true,
    allow_dml: false,
    allow_file_upload: true,
    expose_in_sqllab: false,
    changed_on_delta_humanized: `${i} day(s) ago`,
    changed_on: new Date().toISOString,
    id: i,
    engine_information: {
      supports_file_upload: true,
    },
  }));

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');

const getDatabaseWithFileFiterMockUrl =
  'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))';
const getDatabaseWithNameFilterMockUrl =
  'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))';

beforeEach(async () => {
  mockIsFeatureEnabled.mockReturnValue(false);
  mockIsEmbedded.mockReturnValue(false);
  useSelectorMock.mockReset();
  fetchMock.get(
    getDatabaseWithFileFiterMockUrl,
    { result: [], count: 0 },
    { name: getDatabaseWithFileFiterMockUrl },
  );
  fetchMock.get(
    getDatabaseWithNameFilterMockUrl,
    { result: [], count: 0 },
    { name: getDatabaseWithNameFilterMockUrl },
  );
});

afterEach(() => fetchMock.clearHistory().removeRoutes());

const resetUseSelectorMock = () => {
  useSelectorMock.mockReturnValueOnce({
    createdOn: '2021-04-27T18:12:38.952304',
    email: 'admin',
    firstName: 'admin',
    isActive: true,
    lastName: 'admin',
    permissions: {},
    roles: {
      Admin: [
        ['can_upload', 'Database'], // So we can upload data (CSV, Excel, Columnar)
        ['can_write', 'Database'], // So we can write DBs
        ['can_write', 'Dataset'], // So we can write Datasets
        ['can_write', 'Chart'], // So we can write Datasets
      ],
    },
    userId: 1,
    username: 'admin',
  });

  // By default we get file extensions to be uploaded
  useSelectorMock.mockReturnValueOnce('1');
  // By default we get file extensions to be uploaded
  useSelectorMock.mockReturnValueOnce({
    CSV_EXTENSIONS: ['csv'],
    EXCEL_EXTENSIONS: ['xls', 'xlsx'],
    COLUMNAR_EXTENSIONS: ['parquet', 'zip'],
    ALLOWED_EXTENSIONS: ['parquet', 'zip', 'xls', 'xlsx', 'csv'],
  });
};

test('renders', async () => {
  const mockedProps = createProps();
  // Initial Load
  resetUseSelectorMock();
  const { container } = render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useRouter: true,
    useQueryParams: true,
    useTheme: true,
  });
  // expect(await screen.findByText(/Settings/i)).toBeInTheDocument();
  await waitFor(() => expect(container).toBeInTheDocument());
});

test('If user has permission to upload files AND connect DBs we query existing DBs that has allow_file_upload as True and DBs that are not examples', async () => {
  const mockedProps = createProps();
  // Initial Load
  resetUseSelectorMock();
  const { container } = render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useRouter: true,
    useQueryParams: true,
    useTheme: true,
  });
  await waitFor(() => expect(container).toBeVisible());
  const callsD = fetchMock.callHistory.calls(/database\/\?q/);
  expect(callsD).toHaveLength(2);
  expect(callsD[0].url).toMatchInlineSnapshot(
    `"http://localhost/api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))"`,
  );
  expect(callsD[1].url).toMatchInlineSnapshot(
    `"http://localhost/api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))"`,
  );
});

test('If only examples DB exist we must show the Connect Database option', async () => {
  const mockedProps = createProps();
  fetchMock.modifyRoute(getDatabaseWithFileFiterMockUrl, {
    response: { result: [...mockNonExamplesDB], count: 2 },
  });
  fetchMock.modifyRoute(getDatabaseWithNameFilterMockUrl, {
    response: { result: [], count: 0 },
  });
  // Initial Load
  resetUseSelectorMock();
  // setAllowUploads called
  resetUseSelectorMock();
  // setNonExamplesDBConnected called
  resetUseSelectorMock();
  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });
  const dropdown = screen.getByTestId('new-dropdown-icon');
  await userEvent.hover(dropdown);
  const dataMenu = await screen.findByText(dropdownItems[0].label);
  await userEvent.hover(dataMenu);
  expect(await screen.findByText('Connect database')).toBeInTheDocument();
  expect(screen.queryByText('Create dataset')).not.toBeInTheDocument();
});

test('If more than just examples DB exist we must show the Create dataset option', async () => {
  const mockedProps = createProps();
  fetchMock.modifyRoute(getDatabaseWithFileFiterMockUrl, {
    response: { result: [...mockNonExamplesDB], count: 2 },
  });
  fetchMock.modifyRoute(getDatabaseWithNameFilterMockUrl, {
    response: { result: [...mockNonExamplesDB], count: 2 },
  });
  // Initial Load
  resetUseSelectorMock();
  // setAllowUploads called
  resetUseSelectorMock();
  // setNonExamplesDBConnected called
  resetUseSelectorMock();
  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });
  const dropdown = screen.getByTestId('new-dropdown-icon');
  await userEvent.hover(dropdown);
  const dataMenu = await screen.findByText(dropdownItems[0].label);
  await userEvent.hover(dataMenu);
  expect(await screen.findByText('Create dataset')).toBeInTheDocument();
  expect(screen.queryByText('Connect database')).not.toBeInTheDocument();
});

test('If there is a DB with allow_file_upload set as True the option should be enabled', async () => {
  const mockedProps = createProps();
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
    { result: [...mockNonExamplesDB], count: 2 },
  );
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))',
    { result: [...mockNonExamplesDB], count: 2 },
  );
  // Initial load
  resetUseSelectorMock();
  // setAllowUploads called
  resetUseSelectorMock();
  // setNonExamplesDBConnected called
  resetUseSelectorMock();
  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });
  const dropdown = screen.getByTestId('new-dropdown-icon');
  await userEvent.hover(dropdown);
  const dataMenu = await screen.findByText(dropdownItems[0].label);
  await userEvent.hover(dataMenu);
  const csvMenu = await screen.findByText('Upload CSV to database');
  expect(csvMenu).toBeInTheDocument();
  expect(
    await screen.findByText('Upload Excel to database'),
  ).toBeInTheDocument();

  expect(csvMenu).not.toHaveAttribute('aria-disabled', 'true');
});

test('If there is NOT a DB with allow_file_upload set as True the option should be disabled', async () => {
  const mockedProps = createProps();
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
    { result: [], count: 0 },
  );
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))',
    { result: [...mockNonExamplesDB], count: 2 },
  );
  // Initial load
  resetUseSelectorMock();
  // setAllowUploads called
  resetUseSelectorMock();
  // setNonExamplesDBConnected called
  resetUseSelectorMock();
  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });
  const dropdown = screen.getByTestId('new-dropdown-icon');
  await userEvent.hover(dropdown);
  const dataMenu = await screen.findByText(dropdownItems[0].label);
  await userEvent.hover(dataMenu);
  const csvMenu = await screen.findByRole('menuitem', {
    name: 'Upload CSV to database',
  });
  expect(csvMenu).toBeInTheDocument();
  expect(csvMenu).toHaveAttribute('aria-disabled', 'true');
});

test('Logs out and clears local storage item redux', async () => {
  const mockedProps = createProps();
  resetUseSelectorMock();
  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  // Set items in local and session storage to test if they get cleared
  localStorage.setItem('redux', JSON.stringify({ test: 'test' }));
  sessionStorage.setItem('login_attempted', 'true');
  expect(localStorage.getItem('redux')).not.toBeNull();
  expect(sessionStorage.getItem('login_attempted')).not.toBeNull();

  await userEvent.hover(await screen.findByText(/Settings/i));

  // Simulate user clicking the logout button
  const logoutButton = await screen.findByText('Logout');
  await userEvent.click(logoutButton);

  // Wait for local and session storage to be cleared
  await waitFor(() => {
    expect(localStorage.getItem('redux')).toBeNull();
    expect(sessionStorage.getItem('login_attempted')).toBeNull();
  });
});

test('shows logout button when not embedded', async () => {
  mockIsEmbedded.mockReturnValue(false);
  mockIsFeatureEnabled.mockReturnValue(false);
  resetUseSelectorMock();
  render(<RightMenu {...createProps()} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));
  expect(await screen.findByText('Logout')).toBeInTheDocument();
});

test('shows logout button when embedded but flag is disabled', async () => {
  mockIsEmbedded.mockReturnValue(true);
  mockIsFeatureEnabled.mockReturnValue(false);
  resetUseSelectorMock();
  render(<RightMenu {...createProps()} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));
  expect(await screen.findByText('Logout')).toBeInTheDocument();
});

test('shows logout button when not embedded even if flag is enabled', async () => {
  mockIsEmbedded.mockReturnValue(false);
  mockIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.DisableEmbeddedSupersetLogout,
  );
  resetUseSelectorMock();
  render(<RightMenu {...createProps()} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));
  expect(await screen.findByText('Logout')).toBeInTheDocument();
});

test('hides logout button when embedded and flag is enabled', async () => {
  mockIsEmbedded.mockReturnValue(true);
  mockIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.DisableEmbeddedSupersetLogout,
  );
  resetUseSelectorMock();
  render(<RightMenu {...createProps()} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  userEvent.hover(await screen.findByText(/Settings/i));
  expect(screen.queryByText('Logout')).not.toBeInTheDocument();
});
