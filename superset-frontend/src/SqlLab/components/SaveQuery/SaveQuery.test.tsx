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
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import SaveQuery from 'src/SqlLab/components/SaveQuery';
import { initialState, databases } from 'src/SqlLab/fixtures';

const mockedProps = {
  queryEditorId: '123',
  animation: false,
  database: { ...databases.result[0], allows_virtual_table_explore: false },
  onUpdate: () => {},
  onSave: () => {},
  saveQueryWarning: null,
  columns: [],
};

const mockState = {
  ...initialState,
  sqlLab: {
    ...initialState.sqlLab,
    queryEditors: [
      {
        id: mockedProps.queryEditorId,
        dbId: 1,
        catalog: null,
        schema: 'main',
        sql: 'SELECT * FROM t',
      },
    ],
  },
};

const splitSaveBtnProps = {
  ...mockedProps,
  database: {
    ...mockedProps.database,
    allows_virtual_table_explore: true,
  },
};

const middlewares = [thunk];
const mockStore = configureStore(middlewares);

describe('SavedQuery', () => {
  it('doesnt render save button when allows_virtual_table_explore is undefined', async () => {
    const noRenderProps = {
      ...mockedProps,
      database: {
        ...mockedProps.database,
        allows_virtual_table_explore: undefined,
      },
    };
    render(<SaveQuery {...noRenderProps} />, {
      useRedux: true,
      store: mockStore(mockState),
    });
    expect(() => {
      screen.getByRole('button', { name: /save/i });
    }).toThrow(
      'Unable to find an accessible element with the role "button" and name `/save/i`',
    );
  });

  it('renders a non-split save button when allows_virtual_table_explore is not enabled', () => {
    render(<SaveQuery {...mockedProps} />, {
      useRedux: true,
      store: mockStore(mockState),
    });

    const saveBtn = screen.getByRole('button', { name: /save/i });

    expect(saveBtn).toBeVisible();
  });

  it('renders a save query modal when user clicks save button', () => {
    render(<SaveQuery {...mockedProps} />, {
      useRedux: true,
      store: mockStore(mockState),
    });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    userEvent.click(saveBtn);

    const saveQueryModalHeader = screen.getByRole('heading', {
      name: /save query/i,
    });

    expect(saveQueryModalHeader).toBeVisible();
  });

  it('renders the save query modal UI', () => {
    render(<SaveQuery {...mockedProps} />, {
      useRedux: true,
      store: mockStore(mockState),
    });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    userEvent.click(saveBtn);

    const closeBtn = screen.getByRole('button', { name: /close/i });
    const saveQueryModalHeader = screen.getByRole('heading', {
      name: /save query/i,
    });
    const nameLabel = screen.getByText(/name/i);
    const descriptionLabel = screen.getByText(/description/i);
    const textBoxes = screen.getAllByRole('textbox');
    const nameTextbox = textBoxes[0];
    const descriptionTextbox = textBoxes[1];
    // There are now two save buttons, the initial save button and the modal save button
    const saveBtns = screen.getAllByRole('button', { name: /save/i });
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });

    expect(closeBtn).toBeVisible();
    expect(saveQueryModalHeader).toBeVisible();
    expect(nameLabel).toBeVisible();
    expect(descriptionLabel).toBeVisible();
    expect(textBoxes.length).toBe(2);
    expect(nameTextbox).toBeVisible();
    expect(descriptionTextbox).toBeVisible();
    expect(saveBtns.length).toBe(2);
    expect(saveBtns[0]).toBeVisible();
    expect(saveBtns[1]).toBeVisible();
    expect(cancelBtn).toBeVisible();
  });

  it('renders a "save as new" and "update" button if query already exists', () => {
    render(<SaveQuery {...mockedProps} />, {
      useRedux: true,
      store: mockStore({
        ...mockState,
        sqlLab: {
          ...mockState.sqlLab,
          unsavedQueryEditor: {
            id: mockedProps.queryEditorId,
            remoteId: '42',
          },
        },
      }),
    });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    userEvent.click(saveBtn);

    const saveAsNewBtn = screen.getByRole('button', { name: /save as new/i });
    const updateBtn = screen.getByRole('button', { name: /update/i });

    expect(saveAsNewBtn).toBeVisible();
    expect(updateBtn).toBeVisible();
  });

  it('renders a split save button when allows_virtual_table_explore is enabled', async () => {
    render(<SaveQuery {...splitSaveBtnProps} />, {
      useRedux: true,
      store: mockStore(mockState),
    });

    await waitFor(() => {
      const saveBtn = screen.getByRole('button', { name: /save/i });
      const caretBtn = screen.getByRole('button', { name: /caret-down/i });

      expect(saveBtn).toBeVisible();
      expect(caretBtn).toBeVisible();
    });
  });

  it('renders a save dataset modal when user clicks "save dataset" menu item', async () => {
    render(<SaveQuery {...splitSaveBtnProps} />, {
      useRedux: true,
      store: mockStore(mockState),
    });

    await waitFor(() => {
      const caretBtn = screen.getByRole('button', { name: /caret-down/i });
      userEvent.click(caretBtn);

      const saveDatasetMenuItem = screen.getByText(/save dataset/i);
      userEvent.click(saveDatasetMenuItem);
    });

    const saveDatasetHeader = screen.getByText(/save or overwrite dataset/i);

    expect(saveDatasetHeader).toBeVisible();
  });

  it('renders the save dataset modal UI', async () => {
    render(<SaveQuery {...splitSaveBtnProps} />, {
      useRedux: true,
      store: mockStore(mockState),
    });

    await waitFor(() => {
      const caretBtn = screen.getByRole('button', { name: /caret-down/i });
      userEvent.click(caretBtn);

      const saveDatasetMenuItem = screen.getByText(/save dataset/i);
      userEvent.click(saveDatasetMenuItem);
    });

    const closeBtn = screen.getByRole('button', { name: /close/i });
    const saveDatasetHeader = screen.getByText(/save or overwrite dataset/i);
    const saveRadio = screen.getByRole('radio', {
      name: /save as new untitled/i,
    });
    const saveLabel = screen.getByText(/save as new/i);
    const saveTextbox = screen.getByRole('textbox');
    const overwriteRadio = screen.getByRole('radio', {
      name: /overwrite existing/i,
    });
    const overwriteLabel = screen.getByText(/overwrite existing/i);
    const overwriteCombobox = screen.getByRole('combobox');
    const overwritePlaceholderText = screen.getByText(
      /select or type dataset name/i,
    );

    expect(saveDatasetHeader).toBeVisible();
    expect(closeBtn).toBeVisible();
    expect(saveRadio).toBeVisible();
    expect(saveLabel).toBeVisible();
    expect(saveTextbox).toBeVisible();
    expect(overwriteRadio).toBeVisible();
    expect(overwriteLabel).toBeVisible();
    expect(overwriteCombobox).toBeVisible();
    expect(overwritePlaceholderText).toBeVisible();
  });
});
