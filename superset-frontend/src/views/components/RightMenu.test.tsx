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
import { Provider } from 'react-redux';
import fetchMock from 'fetch-mock';
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { styledMount as mount } from 'spec/helpers/theming';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import RightMenu from './RightMenu';
import { RightMenuProps } from './types';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

jest.mock('src/views/CRUD/data/database/DatabaseModal', () => () => <span />);
jest.mock('src/views/CRUD/data/dataset/AddDatasetModal.tsx', () => () => (
  <span />
));

const mockStore = configureStore([thunk]);
const store = mockStore({});

const createProps = (): RightMenuProps => ({
  align: 'flex-end',
  navbarRight: {
    show_watermark: false,
    bug_report_url: '/report/',
    documentation_url: '/docs/',
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
    show_language_picker: true,
    user_is_anonymous: true,
    user_info_url: '/users/userinfo/',
    user_logout_url: '/logout/',
    user_login_url: '/login/',
    user_profile_url: '/profile/',
    locale: 'en',
    version_string: '1.0.0',
    version_sha: 'randomSHA',
    build_number: 'randomBuildNumber',
  },
  settings: [
    {
      name: 'Security',
      icon: 'fa-cogs',
      label: 'Security',
      index: 1,
      childs: [
        {
          name: 'List Users',
          icon: 'fa-user',
          label: 'List Users',
          url: '/users/list/',
          index: 1,
        },
      ],
    },
  ],
  isFrontendRoute: () => true,
  environmentTag: {
    color: 'error.base',
    text: 'Development',
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
}));

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');
const useStateMock = jest.spyOn(React, 'useState');

let setShowDatabaseModal: any;
let setShowDatasetModal: any;
let setEngine: any;
let setAllowUploads: any;
let setNonExamplesDBConnected: any;

describe('RightMenu', () => {
  const mockedProps = createProps();

  beforeEach(async () => {
    useSelectorMock.mockReset();
    useStateMock.mockReset();
    fetchMock.get(
      'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
      { result: [], count: 0 },
    );
    fetchMock.get(
      'glob:*api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))',
      { result: [], count: 0 },
    );
    // By default we get file extensions to be uploaded
    useSelectorMock.mockReturnValue({
      CSV_EXTENSIONS: ['csv'],
      EXCEL_EXTENSIONS: ['xls', 'xlsx'],
      COLUMNAR_EXTENSIONS: ['parquet', 'zip'],
      ALLOWED_EXTENSIONS: ['parquet', 'zip', 'xls', 'xlsx', 'csv'],
    });
    setShowDatabaseModal = jest.fn();
    setShowDatasetModal = jest.fn();
    setEngine = jest.fn();
    setAllowUploads = jest.fn();
    setNonExamplesDBConnected = jest.fn();
    const mockSetStateDatabaseModal: any = (x: any) => [
      x,
      setShowDatabaseModal,
    ];
    const mockSetStateDatasetModal: any = (x: any) => [x, setShowDatasetModal];
    const mockSetStateEngine: any = (x: any) => [x, setEngine];
    const mockSetStateAllow: any = (x: any) => [x, setAllowUploads];
    const mockSetNonExamplesDBConnected: any = (x: any) => [
      x,
      setNonExamplesDBConnected,
    ];
    useStateMock.mockImplementationOnce(mockSetStateDatabaseModal);
    useStateMock.mockImplementationOnce(mockSetStateDatasetModal);
    useStateMock.mockImplementationOnce(mockSetStateEngine);
    useStateMock.mockImplementationOnce(mockSetStateAllow);
    useStateMock.mockImplementationOnce(mockSetNonExamplesDBConnected);
  });
  afterEach(fetchMock.restore);
  it('renders', async () => {
    const wrapper = mount(
      <Provider store={store}>
        <RightMenu {...mockedProps} />
      </Provider>,
    );
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(RightMenu)).toExist();
  });
  it('If user has permission to upload files AND connect DBs we query existing DBs that has allow_file_upload as True and DBs that are not examples', async () => {
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
        ],
      },
      userId: 1,
      username: 'admin',
    });
    // Second call we get the dashboardId
    useSelectorMock.mockReturnValueOnce('1');
    const wrapper = mount(
      <Provider store={store}>
        <RightMenu {...mockedProps} />
      </Provider>,
    );
    await waitForComponentToPaint(wrapper);
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(2);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))"`,
    );
    expect(callsD[1][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))"`,
    );
  });
  it('If user has permission to upload files but NOT to connect DBs we query existing DBs that has allow_file_upload as True only', async () => {
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
        ],
      },
      userId: 1,
      username: 'admin',
    });
    // Second call we get the dashboardId
    useSelectorMock.mockReturnValueOnce('1');
    const wrapper = mount(
      <Provider store={store}>
        <RightMenu {...mockedProps} />
      </Provider>,
    );
    await waitForComponentToPaint(wrapper);
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))"`,
    );
  });
  it('If user has NO permission to upload files But it DOES have to connect DBs we query DBs that are not examples only', async () => {
    useSelectorMock.mockReturnValueOnce({
      createdOn: '2021-04-27T18:12:38.952304',
      email: 'admin',
      firstName: 'admin',
      isActive: true,
      lastName: 'admin',
      permissions: {},
      roles: {
        Admin: [
          ['can_write', 'Database'], // So we can write DBs
        ],
      },
      userId: 1,
      username: 'admin',
    });
    // Second call we get the dashboardId
    useSelectorMock.mockReturnValueOnce('1');
    const wrapper = mount(
      <Provider store={store}>
        <RightMenu {...mockedProps} />
      </Provider>,
    );
    await waitForComponentToPaint(wrapper);
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/database/?q=(filters:!((col:database_name,opr:neq,value:examples)))"`,
    );
  });
  it('If only examples DB exist we must show the Connect Database option', async () => {
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
        ],
      },
      userId: 1,
      username: 'admin',
    });
    // Second call we get the dashboardId
    useSelectorMock.mockReturnValueOnce('1');
    const wrapper = mount(
      <Provider store={store}>
        <RightMenu {...mockedProps} />
      </Provider>,
    );
    await waitForComponentToPaint(wrapper);
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(2);
    expect(setAllowUploads).toHaveBeenCalledWith(true);
    expect(setNonExamplesDBConnected).toHaveBeenCalledWith(false);
  });
  it('If there is more DBs connected and not just examples we must show the Connect Dataset option', async () => {
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
        ],
      },
      userId: 1,
      username: 'admin',
    });
    // Second call we get the dashboardId
    useSelectorMock.mockReturnValueOnce('1');
    const wrapper = mount(
      <Provider store={store}>
        <RightMenu {...mockedProps} />
      </Provider>,
    );
    await waitForComponentToPaint(wrapper);
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(2);
    expect(setAllowUploads).toHaveBeenCalledWith(true);
    expect(setNonExamplesDBConnected).toHaveBeenCalledWith(true);
  });
});
