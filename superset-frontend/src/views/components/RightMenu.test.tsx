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
import waitForComponentToPaint from 'spec/helpers/waitForComponentToPaint';
import { styledMount as mount } from 'spec/helpers/theming';
import RightMenu from './RightMenu';
import { RightMenuProps } from './types';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(),
}));

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

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');
const useStateMock = jest.spyOn(React, 'useState');

let setShowModal: any;
let setEngine: any;
let setAllowUploads: any;

const mockNonGSheetsDBs = [...new Array(2)].map((_, i) => ({
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

const mockGsheetsDbs = [...new Array(2)].map((_, i) => ({
  changed_by: {
    first_name: `user`,
    last_name: `${i}`,
  },
  database_name: `db ${i}`,
  backend: 'gsheets',
  allow_run_async: true,
  allow_dml: false,
  allow_file_upload: true,
  expose_in_sqllab: false,
  changed_on_delta_humanized: `${i} day(s) ago`,
  changed_on: new Date().toISOString,
  id: i,
  engine_information: {
    supports_file_upload: false,
  },
}));

describe('RightMenu', () => {
  const mockedProps = createProps();

  beforeEach(async () => {
    useSelectorMock.mockReset();
    useStateMock.mockReset();
    fetchMock.get(
      'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
      { result: [], database_count: 0 },
    );
    // By default we get file extensions to be uploaded
    useSelectorMock.mockReturnValue({
      CSV_EXTENSIONS: ['csv'],
      EXCEL_EXTENSIONS: ['xls', 'xlsx'],
      COLUMNAR_EXTENSIONS: ['parquet', 'zip'],
      ALLOWED_EXTENSIONS: ['parquet', 'zip', 'xls', 'xlsx', 'csv'],
    });
    setShowModal = jest.fn();
    setEngine = jest.fn();
    setAllowUploads = jest.fn();
    const mockSetStateModal: any = (x: any) => [x, setShowModal];
    const mockSetStateEngine: any = (x: any) => [x, setEngine];
    const mockSetStateAllow: any = (x: any) => [x, setAllowUploads];
    useStateMock.mockImplementationOnce(mockSetStateModal);
    useStateMock.mockImplementationOnce(mockSetStateEngine);
    useStateMock.mockImplementationOnce(mockSetStateAllow);
  });
  afterEach(fetchMock.restore);
  it('renders', async () => {
    const wrapper = mount(<RightMenu {...mockedProps} />);
    await waitForComponentToPaint(wrapper);
    expect(wrapper.find(RightMenu)).toExist();
  });
  it('If user has permission to upload files we query the existing DBs that has allow_file_upload as True', async () => {
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
    const wrapper = mount(<RightMenu {...mockedProps} />);
    await waitForComponentToPaint(wrapper);
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(callsD[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))"`,
    );
  });
  it('If user has no permission to upload files the query API should not be called', async () => {
    useSelectorMock.mockReturnValueOnce({
      createdOn: '2021-04-27T18:12:38.952304',
      email: 'admin',
      firstName: 'admin',
      isActive: true,
      lastName: 'admin',
      permissions: {},
      roles: {
        Admin: [['can_write', 'Chart']], // no file permissions
      },
      userId: 1,
      username: 'admin',
    });
    // Second call we get the dashboardId
    useSelectorMock.mockReturnValueOnce('1');
    const wrapper = mount(<RightMenu {...mockedProps} />);
    await waitForComponentToPaint(wrapper);
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(0);
  });
  it('If user has permission to upload files but there are only gsheets and clickhouse DBs', async () => {
    fetchMock.get(
      'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
      { result: [...mockGsheetsDbs], database_count: 2 },
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
        ],
      },
      userId: 1,
      username: 'admin',
    });
    // Second call we get the dashboardId
    useSelectorMock.mockReturnValueOnce('1');
    const wrapper = mount(<RightMenu {...mockedProps} />);
    await waitForComponentToPaint(wrapper);
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(setAllowUploads).toHaveBeenCalledWith(false);
  });
  it('If user has permission to upload files and some DBs with allow_file_upload are not gsheets nor clickhouse', async () => {
    fetchMock.get(
      'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
      { result: [...mockNonGSheetsDBs, ...mockGsheetsDbs], database_count: 2 },
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
        ],
      },
      userId: 1,
      username: 'admin',
    });
    // Second call we get the dashboardId
    useSelectorMock.mockReturnValueOnce('1');
    const wrapper = mount(<RightMenu {...mockedProps} />);
    await waitForComponentToPaint(wrapper);
    const callsD = fetchMock.calls(/database\/\?q/);
    expect(callsD).toHaveLength(1);
    expect(setAllowUploads).toHaveBeenCalledWith(true);
  });
});
