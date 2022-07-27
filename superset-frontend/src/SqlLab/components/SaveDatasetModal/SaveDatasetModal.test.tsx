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
import {
  ISaveableDatasource,
  SaveDatasetModal,
} from 'src/SqlLab/components/SaveDatasetModal';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { DatasourceType } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';

const user = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: {
    Admin: [
      ['can_sqllab', 'Superset'],
      ['can_write', 'Dashboard'],
      ['can_write', 'Chart'],
    ],
  },
  userId: 1,
  username: 'admin',
};

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

const mockdatasets = [...new Array(3)].map((_, i) => ({
  changed_by_name: 'user',
  kind: i === 0 ? 'virtual' : 'physical', // ensure there is 1 virtual
  changed_by_url: 'changed_by_url',
  changed_by: 'user',
  changed_on: new Date().toISOString(),
  database_name: `db ${i}`,
  explore_url: `/explore/?dataset_type=table&dataset_id=${i}`,
  id: i,
  schema: `schema ${i}`,
  table_name: `coolest table ${i}`,
  owners: [{ username: 'admin', userId: 1 }],
}));

const mockedProps = {
  visible: true,
  onHide: () => {},
  buttonTextOnSave: 'Save',
  buttonTextOnOverwrite: 'Overwrite',
  datasource: testQuery,
};

fetchMock.get('glob:*/api/v1/dataset?*', {
  result: mockdatasets,
  dataset_count: 3,
});

// Mock the user
const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');
beforeEach(() => useSelectorMock.mockClear());

describe('SaveDatasetModal', () => {
  it('renders a "Save as new" field', async () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

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
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

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
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    expect(screen.getByRole('button', { name: /close/i })).toBeVisible();
  });

  it('renders a save button when "Save as new" is selected', async () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    // "Save as new" is selected when the modal opens by default
    expect(screen.getByRole('button', { name: /save/i })).toBeVisible();
  });

  it('renders a back and overwrite button when "Overwrite existing" is selected', async () => {
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    // Click the overwrite radio button to reveal the overwrite confirmation and back buttons
    const overwriteRadioBtn = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });
    userEvent.click(overwriteRadioBtn);

    expect(screen.getByRole('button', { name: /back/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /overwrite/i })).toBeVisible();
  });

  it('renders the overwrite button as disabled until an existing dataset is selected', async () => {
    useSelectorMock.mockReturnValue({ ...user });
    render(<SaveDatasetModal {...mockedProps} />, { useRedux: true });

    // Click the overwrite radio button
    const overwriteRadioBtn = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });
    await waitFor(async () => {
      userEvent.click(overwriteRadioBtn);
    });

    // Overwrite confirmation button should be disabled at this point
    const overwriteConfirmationBtn = screen.getByRole('button', {
      name: /overwrite/i,
    });
    expect(overwriteConfirmationBtn).toBeDisabled();

    // Click the select component
    const select = screen.getByRole('combobox', { name: /existing dataset/i });
    await waitFor(async () => userEvent.click(select));

    // Select the first "existing dataset" from the listbox
    await waitFor(async () => {
      const listbox = screen.getByRole('listbox');
      userEvent.selectOptions(listbox, 'coolest table 0');
    });

    // Overwrite button should now be enabled
    expect(overwriteConfirmationBtn).toBeEnabled();
  });
});
