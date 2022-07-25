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
import {
  ISaveableDatasource,
  SaveDatasetModal,
} from 'src/SqlLab/components/SaveDatasetModal';
import { Select } from 'src/components';
import {
  render,
  screen,
  act,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { DatasourceType } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';

const testQuery: ISaveableDatasource = {
  name: 'unimportant',
  dbId: 1,
  sql: 'SELECT *',
  columns: [
    {
      name: 'Column 1',
      type: DatasourceType.Query,
      is_dttm: false,
    },
    {
      name: 'Column 3',
      type: DatasourceType.Query,
      is_dttm: false,
    },
    {
      name: 'Column 2',
      type: DatasourceType.Query,
      is_dttm: true,
    },
  ],
};

const mockedProps = {
  visible: true,
  onHide: () => {},
  buttonTextOnSave: 'Save',
  buttonTextOnOverwrite: 'Overwrite',
  datasource: testQuery,
};

const testDatasetList = {
  count: 25,
  description_columns: {},
  ids: [
    48, 42, 36, 47, 46, 45, 44, 43, 41, 40, 39, 38, 37, 35, 34, 33, 32, 31, 30,
    29,
  ],
  label_columns: {
    'changed_by.first_name': 'Changed By First Name',
    'changed_by.username': 'Changed By Username',
    changed_by_name: 'Changed By Name',
    changed_by_url: 'Changed By Url',
    changed_on_delta_humanized: 'Changed On Delta Humanized',
    changed_on_utc: 'Changed On Utc',
    'database.database_name': 'Database Database Name',
    'database.id': 'Database Id',
    datasource_type: 'Datasource Type',
    default_endpoint: 'Default Endpoint',
    description: 'Description',
    explore_url: 'Explore Url',
    extra: 'Extra',
    id: 'Id',
    kind: 'Kind',
    'owners.first_name': 'Owners First Name',
    'owners.id': 'Owners Id',
    'owners.last_name': 'Owners Last Name',
    'owners.username': 'Owners Username',
    schema: 'Schema',
    sql: 'Sql',
    table_name: 'Table Name',
  },
  list_columns: [
    'id',
    'database.id',
    'database.database_name',
    'changed_by_name',
    'changed_by_url',
    'changed_by.first_name',
    'changed_by.username',
    'changed_on_utc',
    'changed_on_delta_humanized',
    'default_endpoint',
    'description',
    'datasource_type',
    'explore_url',
    'extra',
    'kind',
    'owners.id',
    'owners.username',
    'owners.first_name',
    'owners.last_name',
    'schema',
    'sql',
    'table_name',
  ],
  list_title: 'List Sqla Table',
  order_columns: [
    'table_name',
    'schema',
    'changed_by.first_name',
    'changed_on_delta_humanized',
    'database.database_name',
  ],
  result: [
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '20 hours ago',
      changed_on_utc: '2022-07-12T22:41:31.297778+0000',
      database: {
        database_name: 'Google Sheets',
        id: 2,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=48',
      extra: null,
      id: 48,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: null,
      sql: 'SELECT * FROM Sheet1  ',
      table_name: 'Garfield query 07/12/2022 14:30:54',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '20 hours ago',
      changed_on_utc: '2022-07-12T22:24:58.698853+0000',
      database: {
        database_name: 'Google Sheets',
        id: 2,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=42',
      extra: null,
      id: 42,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM Sheet1  ',
      table_name: 'undefined 06/27/2022 18:24:39',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: 'a day ago',
      changed_on_utc: '2022-07-12T16:32:36.599554+0000',
      database: {
        database_name: 'Google Sheets',
        id: 2,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=36',
      extra: null,
      id: 36,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM Sheet1  ',
      table_name: 'Query 05/19/2022 18:56:50',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '8 days ago',
      changed_on_utc: '2022-07-05T17:38:12.502830+0000',
      database: {
        database_name: 'Google Sheets',
        id: 2,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=47',
      extra: null,
      id: 47,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM Sheet1',
      table_name: 'Untitled Query 1 07/05/2022 12:38:08',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '10 days ago',
      changed_on_utc: '2022-07-03T02:32:59.161912+0000',
      database: {
        database_name: 'Google Sheets',
        id: 2,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=46',
      extra: null,
      id: 46,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM Sheet1',
      table_name: 'Untitled Query 1 07/02/2022 21:28:53',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '13 days ago',
      changed_on_utc: '2022-06-30T18:43:02.757895+0000',
      database: {
        database_name: 'Google Sheets',
        id: 2,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=45',
      extra: null,
      id: 45,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: null,
      sql: 'SELECT * FROM Sheet1',
      table_name: 'Untitled 06/30/2022 13:43:00',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '13 days ago',
      changed_on_utc: '2022-06-30T17:32:38.088415+0000',
      database: {
        database_name: 'Google Sheets',
        id: 2,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=44',
      extra: null,
      id: 44,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM Sheet1',
      table_name: 'Untitled Query 1 06/30/2022 12:30:59',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '13 days ago',
      changed_on_utc: '2022-06-30T17:30:59.136026+0000',
      database: {
        database_name: 'Google Sheets',
        id: 2,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=43',
      extra: null,
      id: 43,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM Sheet1',
      table_name: 'Untitled Query 1 06/30/2022 12:30:44',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '20 days ago',
      changed_on_utc: '2022-06-22T19:53:04.308253+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=41',
      extra: null,
      id: 41,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Query 1 06/22/2022 14:46:56',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '20 days ago',
      changed_on_utc: '2022-06-22T19:46:56.758263+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=40',
      extra: null,
      id: 40,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Query 1 06/22/2022 14:46:05',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '20 days ago',
      changed_on_utc: '2022-06-22T19:13:10.106631+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=39',
      extra: null,
      id: 39,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: null,
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Dataset 06/22/2022 14:13:00',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '21 days ago',
      changed_on_utc: '2022-06-21T19:43:58.510913+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=38',
      extra: null,
      id: 38,
      kind: 'physical',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: null,
      sql: '',
      table_name: 'Untitled Dataset 06/21/2022 14:43:54',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '21 days ago',
      changed_on_utc: '2022-06-21T19:42:46.112798+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=37',
      extra: null,
      id: 37,
      kind: 'physical',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: null,
      sql: '',
      table_name: 'Untitled Dataset 06/21/2022 14:42:36',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: 'a month ago',
      changed_on_utc: '2022-05-17T14:25:41.210001+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=35',
      extra: null,
      id: 35,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Query 1 05/16/2022 16:31:04',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: 'a month ago',
      changed_on_utc: '2022-05-16T21:02:33.825514+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=34',
      extra: null,
      id: 34,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Query 1 05/16/2022 16:02:04',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: 'a month ago',
      changed_on_utc: '2022-05-16T21:02:04.789763+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=33',
      extra: null,
      id: 33,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Query 1 05/16/2022 16:02:00',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: 'a month ago',
      changed_on_utc: '2022-05-16T20:14:23.034596+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=32',
      extra: null,
      id: 32,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Query 1 05/16/2022 15:14:18',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: 'a month ago',
      changed_on_utc: '2022-05-16T18:27:26.167253+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=31',
      extra: null,
      id: 31,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Query 1 05/16/2022 13:27:20',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '2 months ago',
      changed_on_utc: '2022-05-13T17:32:43.420029+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=30',
      extra: null,
      id: 30,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Query 1 05/13/2022 12:27:46',
    },
    {
      changed_by: {
        first_name: 'Admin I.',
        username: 'admin',
      },
      changed_by_name: 'Admin I. Strator',
      changed_by_url: '/superset/profile/admin',
      changed_on_delta_humanized: '2 months ago',
      changed_on_utc: '2022-05-13T17:27:46.998589+0000',
      database: {
        database_name: 'examples',
        id: 1,
      },
      datasource_type: 'table',
      default_endpoint: null,
      description: null,
      explore_url: '/explore/?dataset_type=table&dataset_id=29',
      extra: null,
      id: 29,
      kind: 'virtual',
      owners: [
        {
          first_name: 'Admin I.',
          id: 1,
          last_name: 'Strator',
          username: 'admin',
        },
      ],
      schema: 'main',
      sql: 'SELECT * FROM "FCC 2018 Survey"',
      table_name: 'Untitled Query 1 05/13/2022 12:27:43',
    },
  ],
};

const mockDatasetNames = testDatasetList.result.map(
  dataset => dataset.table_name,
);

const getElementByClassName = (className: string) =>
  document.querySelector(className)! as HTMLElement;

const findSelectValue = () =>
  waitFor(() => getElementByClassName('.ant-select-selection-item'));
const getElementsByClassName = (className: string) =>
  document.querySelectorAll(className)! as NodeListOf<HTMLElement>;
const findAllSelectOptions = () =>
  waitFor(() => getElementsByClassName('.ant-select-item-option-content'));

describe('SaveDatasetModal', () => {
  it('renders a "Save as new" field', async () => {
    await act(async () => {
      render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });
    });

    const saveRadioBtn = screen.getByRole('radio', {
      name: /save as new unimportant/i,
    });

    const fieldLabel = screen.getByText(/save as new/i);
    const inputField = screen.getByRole('textbox');
    const inputFieldText = screen.getByDisplayValue(/unimportant/i);

    expect(saveRadioBtn).toBeVisible();
    expect(fieldLabel).toBeVisible();
    expect(inputField).toBeVisible();
    expect(inputFieldText).toBeVisible();
  });

  it('renders an "Overwrite existing" field', async () => {
    await act(async () => {
      render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });
    });

    const overwriteRadioBtn = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });
    const fieldLabel = screen.getByText(/overwrite existing/i);
    const inputField = screen.getByRole('combobox');
    const placeholderText = screen.getByText(/select or type dataset name/i);

    expect(overwriteRadioBtn).toBeVisible();
    expect(fieldLabel).toBeVisible();
    expect(inputField).toBeVisible();
    expect(placeholderText).toBeVisible();
  });

  it('renders a close button', async () => {
    await act(async () => {
      render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });
    });

    expect(screen.getByRole('button', { name: /close/i })).toBeVisible();
  });

  it('renders a save button when "Save as new" is selected', async () => {
    await act(async () => {
      render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });
    });

    // "Save as new" is selected when the modal opens by default
    expect(screen.getByRole('button', { name: /save/i })).toBeVisible();
  });

  it('renders a back and overwrite button when "Overwrite existing" is selected', async () => {
    await act(async () => {
      render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });
    });

    const overwriteRadioBtn = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });

    // Click the overwrite radio button to reveal the overwrite buttons
    userEvent.click(overwriteRadioBtn);

    expect(screen.getByRole('button', { name: /back/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /overwrite/i })).toBeVisible();
  });

  const OPTIONS = [
    { label: 'John', value: 1, gender: 'Male' },
    { label: 'Liam', value: 2, gender: 'Male' },
    { label: 'Olivia', value: 3, gender: 'Female' },
    { label: 'Emma', value: 4, gender: 'Female' },
    { label: 'Noah', value: 5, gender: 'Male' },
    { label: 'Ava', value: 6, gender: 'Female' },
    { label: 'Oliver', value: 7, gender: 'Male' },
    { label: 'ElijahH', value: 8, gender: 'Male' },
    { label: 'Charlotte', value: 9, gender: 'Female' },
    { label: 'Giovanni', value: 10, gender: 'Male' },
    { label: 'Franco', value: 11, gender: 'Male' },
    { label: 'Sandro', value: 12, gender: 'Male' },
    { label: 'Alehandro', value: 13, gender: 'Male' },
    { label: 'Johnny', value: 14, gender: 'Male' },
    { label: 'Nikole', value: 15, gender: 'Female' },
    { label: 'Igor', value: 16, gender: 'Male' },
    { label: 'Guilherme', value: 17, gender: 'Male' },
    { label: 'Irfan', value: 18, gender: 'Male' },
    { label: 'George', value: 19, gender: 'Male' },
    { label: 'Ashfaq', value: 20, gender: 'Male' },
    { label: 'Herme', value: 21, gender: 'Male' },
    { label: 'Cher', value: 22, gender: 'Female' },
    { label: 'Her', value: 23, gender: 'Male' },
  ].sort((option1, option2) => option1.label.localeCompare(option2.label));
  const defaultSelectProps = {
    allowClear: true,
    ariaLabel: 'Test',
    labelInValue: true,
    options: OPTIONS,
    pageSize: 10,
    showSearch: true,
  };

  it('renders the overwrite button as disabled until an existing dataset is selected', async () => {
    await act(async () => {
      render(
        <SaveDatasetModal {...mockedProps}>
          <Select {...defaultSelectProps} allowNewOptions />
        </SaveDatasetModal>,
        { useRedux: true },
      );
    });

    // expect.assertions(2);
    const overwriteRadioBtn = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });

    await act(async () => {
      userEvent.click(overwriteRadioBtn);
    });

    expect(screen.getByRole('button', { name: /overwrite/i })).toBeDisabled();
    expect(screen.queryByText(/no data/i)).toBe(null);

    const select = screen.getByRole('combobox', { name: /existing dataset/i });

    await act(async () => {
      userEvent.clear(select);
      userEvent.click(select);
      userEvent.type(select, 'e');
      const options = await findAllSelectOptions();
      console.log(options);
      // userEvent.click(await findAllSelectOptions()[0]);
    });
    screen.logTestingPlaygroundURL();

    // expect(screen.queryByText(/no data/i)?.innerHTML).toBe('No Data');
    // expect(screen.queryByText(/no data/i)).toBeInTheDocument();

    // await act(async () => {
    //   userEvent.click(screen.getByText(/no data/i));
    // });
    // const options = await findSelectValue();

    // screen.debug(options);
    // console.log(options);
  });
});
