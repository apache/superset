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
import * as reactRedux from 'react-redux';
import fetchMock from 'fetch-mock';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import RightMenu from './RightMenu';
import { GlobalMenuDataOptions, RightMenuProps } from './types';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('src/features/databases/DatabaseModal', () => () => <span />);

const dropdownItems = [
  {
    label: 'Data',
    icon: 'fa-database',
    childs: [
      {
        label: 'Connect database',
        name: GlobalMenuDataOptions.DB_CONNECTION,
        perm: true,
      },
      {
        label: 'Create dataset',
        name: GlobalMenuDataOptions.DATASET_CREATION,
        perm: true,
      },
      {
        label: 'Connect Google Sheet',
        name: GlobalMenuDataOptions.GOOGLE_SHEETS,
        perm: true,
      },
      {
        label: 'Upload CSV to database',
        name: 'Upload a CSV',
        url: '/csvtodatabaseview/form',
        perm: true,
      },
      {
        label: 'Upload columnar file to database',
        name: 'Upload a Columnar file',
        url: '/columnartodatabaseview/form',
        perm: true,
      },
      {
        label: 'Upload Excel file to database',
        name: 'Upload Excel',
        url: '/exceltodatabaseview/form',
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
    user_profile_url: '/profile/',
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
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
    { result: [], count: 0 },
  );
  fetchMock.get(
    'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))',
    { result: [], count: 0 },
  );
});

afterEach(fetchMock.restore);

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
        ['can_this_form_get', 'CsvToDatabaseView'], // So we can upload CSV
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
    useQueryParams: true,
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
    useQueryParams: true,
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
  // Initial Load
  resetUseSelectorMock();
  // setAllowUploads called
  resetUseSelectorMock();
  render(<RightMenu {...mockedProps} />, {
    useRedux: true,
    useQueryParams: true,
    useRouter: true,
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
  });
  const dropdown = screen.getByTestId('new-dropdown-icon');
  userEvent.hover(dropdown);
  const dataMenu = await screen.findByText(dropdownItems[0].label);
  userEvent.hover(dataMenu);
  expect(
    (await screen.findByText('Upload CSV to database')).closest('a'),
  ).toHaveAttribute('href', '/csvtodatabaseview/form');
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
  });
  const dropdown = screen.getByTestId('new-dropdown-icon');
  userEvent.hover(dropdown);
  const dataMenu = await screen.findByText(dropdownItems[0].label);
  userEvent.hover(dataMenu);
  expect(await screen.findByText('Upload CSV to database')).toBeInTheDocument();
  expect(
    (await screen.findByText('Upload CSV to database')).closest('a'),
  ).not.toBeInTheDocument();
});
