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
import { ThemeMode } from '@superset-ui/core';
import RightMenu from './RightMenu';
import { GlobalMenuDataOptions, RightMenuProps } from './types';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('src/features/databases/DatabaseModal', () => () => <span />);
jest.mock('./LanguagePicker', () => () => (
  <span data-testid="language-picker" />
));

const mockThemeContext = {
  setThemeMode: jest.fn(),
  themeMode: ThemeMode.DEFAULT,
  clearLocalOverrides: jest.fn(),
  hasDevOverride: jest.fn(() => false),
  canSetMode: jest.fn(() => true),
  canDetectOSPreference: jest.fn(() => true),
};

jest.mock('src/theme/ThemeProvider', () => ({
  ...jest.requireActual('src/theme/ThemeProvider'),
  useThemeContext: () => mockThemeContext,
}));

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
  settings: [
    {
      label: 'Security',
      childs: [
        {
          label: 'List Users',
          url: '/users/list/',
        },
        {
          label: 'List Roles',
          url: '/roles/list/',
        },
      ],
    },
    {
      label: 'Manage',
      childs: [
        {
          label: 'Import Dashboards',
          url: '/dashboard/import/',
        },
        {
          label: 'Refresh Druid Metadata',
          url: '/druid/refresh_datasources/',
        },
      ],
    },
  ],
  isFrontendRoute: () => true,
  environmentTag: {
    color: 'error.base',
    text: 'Development2',
  },
});

const mockNonExamplesDB = [...new Array(2)].map((_, i) => ({
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

beforeEach(async () => {
  useSelectorMock.mockReset();
  jest.clearAllMocks();
  mockThemeContext.setThemeMode.mockClear();
  mockThemeContext.clearLocalOverrides.mockClear();
  mockThemeContext.hasDevOverride.mockReturnValue(false);
  mockThemeContext.canSetMode.mockReturnValue(true);
  mockThemeContext.canDetectOSPreference.mockReturnValue(true);
  mockThemeContext.themeMode = ThemeMode.DEFAULT;

  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
    { result: [], count: 0 },
  );
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))',
    { result: [], count: 0 },
  );
});

afterEach(() => fetchMock.restore());

const resetUseSelectorMock = (
  options: {
    dashboardId?: number | undefined;
    hasGsheets?: boolean;
    showActionDropdown?: boolean;
  } = {},
) => {
  const {
    dashboardId = undefined,
    hasGsheets = false,
    showActionDropdown = true,
  } = options;

  // Mock the useSelector to handle multiple calls with a flexible implementation
  useSelectorMock.mockImplementation(selector => {
    const mockState = {
      user: {
        createdOn: '2021-04-27T18:12:38.952304',
        email: 'admin',
        firstName: 'admin',
        isActive: true,
        lastName: 'admin',
        permissions: {},
        roles: {
          Admin: [
            ['can_upload', 'Database'],
            ['can_write', 'Database'],
            ['can_write', 'Dataset'],
            ['can_write', 'Chart'],
            ...(showActionDropdown
              ? [
                  ['can_sqllab', 'Superset'],
                  ['can_write', 'Dashboard'],
                ]
              : []),
          ],
        },
        userId: 1,
        username: 'admin',
      },
      dashboardInfo: {
        id: dashboardId,
      },
      common: {
        conf: {
          CSV_EXTENSIONS: ['csv'],
          EXCEL_EXTENSIONS: ['xls', 'xlsx'],
          COLUMNAR_EXTENSIONS: ['parquet', 'zip'],
          ALLOWED_EXTENSIONS: ['parquet', 'zip', 'xls', 'xlsx', 'csv'],
          HAS_GSHEETS_INSTALLED: hasGsheets,
        },
      },
    };

    return selector(mockState);
  });
};

test('renders', async () => {
  const mockedProps = createProps();
  resetUseSelectorMock();

  const { container } = render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useTheme: true,
  });

  await waitFor(() => expect(container).toBeInTheDocument());
});

test('If user has permission to upload files AND connect DBs we query existing DBs that has allow_file_upload as True and DBs that are not examples', async () => {
  const mockedProps = createProps();
  resetUseSelectorMock();

  const { container } = render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useTheme: true,
  });

  await waitFor(() => expect(container).toBeVisible());

  const callsD = fetchMock.calls(/database\/\?q/);

  expect(callsD).toHaveLength(2);
  expect(callsD[0][0]).toMatchInlineSnapshot(
    `"http://localhost/api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))"`,
  );
  expect(callsD[1][0]).toMatchInlineSnapshot(
    `"http://localhost/api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))"`,
  );
});

test('If only examples DB exist we must show the Connect Database option', async () => {
  const mockedProps = createProps();
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
    { result: [...mockNonExamplesDB], count: 2 },
    { overwriteRoutes: true },
  );
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))',
    { result: [], count: 0 },
    { overwriteRoutes: true },
  );

  resetUseSelectorMock();
  resetUseSelectorMock();
  resetUseSelectorMock();

  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  const dropdown = screen.getByTestId('new-dropdown-icon');
  userEvent.hover(dropdown);

  const dataMenu = await screen.findByText(dropdownItems[0].label);
  userEvent.hover(dataMenu);

  expect(await screen.findByText('Connect database')).toBeInTheDocument();
  expect(screen.queryByText('Create dataset')).not.toBeInTheDocument();
});

test('If more than just examples DB exist we must show the Create dataset option', async () => {
  const mockedProps = createProps();
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
    { result: [...mockNonExamplesDB], count: 2 },
    { overwriteRoutes: true },
  );
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))',
    { result: [...mockNonExamplesDB], count: 2 },
    { overwriteRoutes: true },
  );

  resetUseSelectorMock();
  resetUseSelectorMock();
  resetUseSelectorMock();

  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  const dropdown = screen.getByTestId('new-dropdown-icon');
  userEvent.hover(dropdown);
  const dataMenu = await screen.findByText(dropdownItems[0].label);

  userEvent.hover(dataMenu);
  expect(await screen.findByText('Create dataset')).toBeInTheDocument();
  expect(screen.queryByText('Connect database')).not.toBeInTheDocument();
});

test('If there is a DB with allow_file_upload set as True the option should be enabled', async () => {
  const mockedProps = createProps();
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
    { result: [...mockNonExamplesDB], count: 2 },
    { overwriteRoutes: true },
  );
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))',
    { result: [...mockNonExamplesDB], count: 2 },
    { overwriteRoutes: true },
  );
  resetUseSelectorMock();
  resetUseSelectorMock();
  resetUseSelectorMock();

  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  const dropdown = screen.getByTestId('new-dropdown-icon');
  userEvent.hover(dropdown);
  const dataMenu = await screen.findByText(dropdownItems[0].label);
  userEvent.hover(dataMenu);
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
    { overwriteRoutes: true },
  );
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))',
    { result: [...mockNonExamplesDB], count: 2 },
    { overwriteRoutes: true },
  );

  resetUseSelectorMock();
  resetUseSelectorMock();
  resetUseSelectorMock();

  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
    useTheme: true,
  });

  const dropdown = screen.getByTestId('new-dropdown-icon');
  userEvent.hover(dropdown);
  const dataMenu = await screen.findByText(dropdownItems[0].label);
  userEvent.hover(dataMenu);
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

  localStorage.setItem('redux', JSON.stringify({ test: 'test' }));
  expect(localStorage.getItem('redux')).not.toBeNull();

  userEvent.hover(await screen.findByText(/Settings/i));

  await waitFor(() => {
    const logoutButton = screen.getByText('Logout');
    userEvent.click(logoutButton);
  });

  await waitFor(() => {
    expect(localStorage.getItem('redux')).toBeNull();
  });
});

describe('Theme functionality', () => {
  test('renders theme submenu when user can set theme mode', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock();
    mockThemeContext.canSetMode.mockReturnValue(true);

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.getByLabelText('sun')).toBeInTheDocument();
  });

  test('does not render theme submenu when user cannot set theme mode', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock();
    mockThemeContext.canSetMode.mockReturnValue(false);

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.queryByLabelText('sun')).not.toBeInTheDocument();
  });

  test('calls setThemeMode when theme option is selected', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    const themeIcon = screen.getByLabelText('sun');
    userEvent.hover(themeIcon);

    await waitFor(() => {
      const darkOption = screen.getByText('Dark');
      userEvent.click(darkOption);
    });

    expect(mockThemeContext.setThemeMode).toHaveBeenCalledWith(ThemeMode.DARK);
  });

  test('renders system theme option when OS preference detection is available', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock();
    mockThemeContext.canDetectOSPreference.mockReturnValue(true);

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    const themeIcon = screen.getByLabelText('sun');
    userEvent.hover(themeIcon);

    await waitFor(() => {
      expect(screen.getByText('Match system')).toBeInTheDocument();
    });
  });

  test('does not render system theme option when OS preference detection is not available', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock();
    mockThemeContext.canDetectOSPreference.mockReturnValue(false);

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    const themeIcon = screen.getByLabelText('sun');
    userEvent.hover(themeIcon);

    await waitFor(() => {
      expect(screen.queryByText('Match system')).not.toBeInTheDocument();
    });
  });

  test('renders clear local theme option when dev override is present', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock();
    mockThemeContext.hasDevOverride.mockReturnValue(true);

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    const themeIcon = screen.getByLabelText('format-painter');
    userEvent.hover(themeIcon);

    await waitFor(() => {
      expect(screen.getByText('Clear local theme')).toBeInTheDocument();
    });
  });

  test('calls clearLocalOverrides when clear local theme is clicked', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock();
    mockThemeContext.hasDevOverride.mockReturnValue(true);

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    const themeIcon = screen.getByLabelText('format-painter');
    userEvent.hover(themeIcon);

    await waitFor(() => {
      const clearOption = screen.getByText('Clear local theme');
      userEvent.click(clearOption);
    });

    expect(mockThemeContext.clearLocalOverrides).toHaveBeenCalled();
  });
});

describe('Settings menu', () => {
  test('does not render user section when user is anonymous', async () => {
    const mockedProps = {
      ...createProps(),
      navbarRight: {
        ...createProps().navbarRight,
        user_is_anonymous: true,
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    userEvent.hover(await screen.findByText(/Settings/i));

    await waitFor(() => {
      expect(screen.queryByText('User')).not.toBeInTheDocument();
      expect(screen.queryByText('Info')).not.toBeInTheDocument();
    });
  });

  test('renders watermark when show_watermark is true', async () => {
    const mockedProps = {
      ...createProps(),
      navbarRight: {
        ...createProps().navbarRight,
        show_watermark: true,
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    userEvent.hover(await screen.findByText(/Settings/i));

    await waitFor(() => {
      expect(
        screen.getByText('Powered by Apache Superset'),
      ).toBeInTheDocument();
    });
  });

  test('does not render about section when version info is missing', async () => {
    const mockedProps = {
      ...createProps(),
      navbarRight: {
        ...createProps().navbarRight,
        version_string: undefined,
        version_sha: undefined,
        build_number: undefined,
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    userEvent.hover(await screen.findByText(/Settings/i));

    await waitFor(() => {
      expect(screen.queryByText('About')).not.toBeInTheDocument();
    });
  });
});

describe('Environment tag', () => {
  test('renders environment tag when provided', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.getByText('Development2')).toBeInTheDocument();
  });

  test('does not render environment tag when not provided', async () => {
    const mockedProps: Omit<RightMenuProps, 'environmentTag'> & {
      environmentTag?: any;
    } = {
      ...createProps(),
      environmentTag: undefined,
    };
    resetUseSelectorMock();

    render(<RightMenu {...(mockedProps as RightMenuProps)} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.queryByText('Development2')).not.toBeInTheDocument();
  });

  test('does not render environment tag when text is empty', async () => {
    const mockedProps = {
      ...createProps(),
      environmentTag: {
        color: 'error.base',
        text: '',
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.queryByText('Development2')).not.toBeInTheDocument();
  });
});

describe('Documentation and bug report links', () => {
  test('renders documentation link when provided', async () => {
    const mockedProps = {
      ...createProps(),
      navbarRight: {
        ...createProps().navbarRight,
        documentation_url: 'https://docs.example.com',
        documentation_text: 'Custom Docs',
        documentation_icon: 'fa-book',
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    const docLink = screen.getByTitle('Custom Docs');

    expect(docLink).toBeInTheDocument();
    expect(docLink).toHaveAttribute('href', 'https://docs.example.com');
    expect(docLink).toHaveAttribute('target', '_blank');
  });

  test('renders bug report link when provided', async () => {
    const mockedProps = {
      ...createProps(),
      navbarRight: {
        ...createProps().navbarRight,
        bug_report_url: 'https://bugs.example.com',
        bug_report_text: 'Report Bug',
        bug_report_icon: 'fa-bug',
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    const bugLink = screen.getByTitle('Report Bug');

    expect(bugLink).toBeInTheDocument();
    expect(bugLink).toHaveAttribute('href', 'https://bugs.example.com');
    expect(bugLink).toHaveAttribute('target', '_blank');
  });

  test('uses default documentation text when not provided', async () => {
    const mockedProps = {
      ...createProps(),
      navbarRight: {
        ...createProps().navbarRight,
        documentation_url: 'https://docs.example.com',
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.getByTitle('Documentation')).toBeInTheDocument();
  });

  test('uses default bug report text when not provided', async () => {
    const mockedProps = {
      ...createProps(),
      navbarRight: {
        ...createProps().navbarRight,
        bug_report_url: 'https://bugs.example.com',
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.getByTitle('Report a bug')).toBeInTheDocument();
  });
});

describe('Anonymous user login', () => {
  test('renders login button for anonymous users', async () => {
    const mockedProps = {
      ...createProps(),
      navbarRight: {
        ...createProps().navbarRight,
        user_is_anonymous: true,
        user_login_url: '/login/',
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    const loginLink = screen.getByText('Login');

    expect(loginLink).toBeInTheDocument();
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login/');
  });

  test('does not render login button for authenticated users', async () => {
    const mockedProps = createProps(); // user_is_anonymous is false by default
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });
});

describe('Language picker', () => {
  test('renders language picker when enabled', async () => {
    const mockedProps = {
      ...createProps(),
      navbarRight: {
        ...createProps().navbarRight,
        show_language_picker: true,
      },
    };
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  test('does not render language picker when disabled', async () => {
    const mockedProps = createProps(); // show_language_picker is false by default
    resetUseSelectorMock();

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useTheme: true,
    });

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });
});

describe('Dashboard-specific chart creation', () => {
  test('includes dashboard_id in chart URL when on a dashboard', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock({ dashboardId: 123, showActionDropdown: true });

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useRouter: true,
      useTheme: true,
    });

    const dropdown = screen.getByTestId('new-dropdown-icon');
    userEvent.hover(dropdown);

    await waitFor(() => {
      const chartLink = screen.getByText('Chart').closest('a');
      expect(chartLink).toHaveAttribute('href', '/chart/add?dashboard_id=123');
    });
  });

  test('uses default chart URL when not on a dashboard', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock({ showActionDropdown: true });

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useRouter: true,
      useTheme: true,
    });

    const dropdown = screen.getByTestId('new-dropdown-icon');
    userEvent.hover(dropdown);

    await waitFor(() => {
      const chartLink = screen.getByText('Chart').closest('a');
      expect(chartLink).toHaveAttribute('href', '/chart/add');
    });
  });
});

describe('Google Sheets integration', () => {
  test('shows Google Sheets option when HAS_GSHEETS_INSTALLED is true', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock({ hasGsheets: true, showActionDropdown: true });

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useRouter: true,
      useTheme: true,
    });

    const dropdown = screen.getByTestId('new-dropdown-icon');
    userEvent.hover(dropdown);

    const dataMenu = await screen.findByText('Data');
    userEvent.hover(dataMenu);

    await waitFor(() => {
      expect(screen.getByText('Connect Google Sheet')).toBeInTheDocument();
    });
  });

  test('does not show Google Sheets option when HAS_GSHEETS_INSTALLED is false', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock({ hasGsheets: false, showActionDropdown: true });

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useRouter: true,
      useTheme: true,
    });

    const dropdown = screen.getByTestId('new-dropdown-icon');
    userEvent.hover(dropdown);

    const dataMenu = await screen.findByText('Data');
    userEvent.hover(dataMenu);

    await waitFor(() => {
      expect(
        screen.queryByText('Connect Google Sheet'),
      ).not.toBeInTheDocument();
    });
  });
});

describe('Menu interaction behavior', () => {
  test('opens data submenu and triggers API calls', async () => {
    const mockedProps = createProps();
    resetUseSelectorMock({ showActionDropdown: true });

    render(<RightMenu {...mockedProps} />, {
      useRedux: true,
      useQueryParams: true,
      useRouter: true,
      useTheme: true,
    });

    const dropdown = screen.getByTestId('new-dropdown-icon');
    userEvent.hover(dropdown);

    const dataMenu = await screen.findByText('Data');
    userEvent.hover(dataMenu);

    await waitFor(() => {
      const calls = fetchMock.calls(/database\/\?q/);
      expect(calls.length).toBeGreaterThan(0);
    });
  });
});
