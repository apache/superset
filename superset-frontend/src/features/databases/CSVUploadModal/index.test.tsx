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

// TODO: These tests should be made atomic in separate files

import React from 'react';
import fetchMock from 'fetch-mock';
import CSVUploadModal from 'src/features/databases/CSVUploadModal';
import { act, cleanup, render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';

const DATABASE_FETCH_ENDPOINT = 'glob:*/api/v1/database/10';

fetchMock.get(DATABASE_FETCH_ENDPOINT, {
  result: {
    id: 10,
    database_name: 'my database',
    expose_in_sqllab: false,
    allow_ctas: false,
    allow_cvas: false,
    configuration_method: 'sqlalchemy_form',
  },
});

const csvProps = {
  show: true,
  onHide: () => {},
};

describe('CSVUploadModal', () => {
  const renderAndWait = async () => {
    const mounted = act(async () => {
      render(<CSVUploadModal {...csvProps} />, {
        useRedux: true,
      });
    });

    return mounted;
  };

  beforeEach(async () => {
    await renderAndWait();
  });

  afterEach(cleanup);

  test('renders the general information elements correctly', () => {
    const cancelButton = screen.getByRole('button', {
      name: 'Cancel',
    });
    const uploadButton = screen.getByRole('button', {
      name: 'Upload',
    });
    const selectButton = screen.getByRole('button', {
      name: 'Select',
    });

    const title = screen.getByRole('heading', {
      name: /csv upload/i,
    });
    const panel1 = screen.getByRole('heading', {
      name: /General information/i,
    });
    const panel2 = screen.getByRole('heading', {
      name: /file settings/i,
    });
    const panel3 = screen.getByRole('heading', {
      name: /columns/i,
    });
    const panel4 = screen.getByRole('heading', {
      name: /rows/i,
    });
    const selectDatabase = screen.getByRole('combobox', {
      name: /select a database/i,
    });
    const selectDelimiter = screen.getByRole('combobox', {
      name: /choose a delimiter/i,
    });

    const inputTableName = screen.getByRole('textbox', {
      name: /table name/i,
    });
    const inputSchema = screen.getByRole('textbox', {
      name: /schema/i,
    });

    const visibleComponents = [
      cancelButton,
      uploadButton,
      selectButton,
      title,
      panel1,
      panel2,
      panel3,
      panel4,
      selectDatabase,
      selectDelimiter,
      inputTableName,
      inputSchema,
    ];
    visibleComponents.forEach(component => {
      expect(component).toBeVisible();
    });
  });

  test('renders the file settings elements correctly', async () => {
    expect(
      screen.queryByText('If Table Already Exists'),
    ).not.toBeInTheDocument();
    const panelHeader = screen.getByRole('heading', {
      name: /file settings/i,
    });
    userEvent.click(panelHeader);
    const selectTableAlreadyExists = screen.getByRole('combobox', {
      name: /choose already exists/i,
    });
    const switchSkipInitialSpace = screen.getByTestId('skipInitialSpace');
    const switchSkipBlankLines = screen.getByTestId('skipBlankLines');
    const switchDayFirst = screen.getByTestId('dayFirst');
    const inputDecimalCharacter = screen.getByRole('textbox', {
      name: /decimal character/i,
    });
    const selectColumnsDates = screen.getByRole('combobox', {
      name: /choose columns to be parsed as dates/i,
    });
    const selectNullValues = screen.getByRole('combobox', {
      name: /null values/i,
    });
    userEvent.click(selectColumnsDates);
    userEvent.click(selectNullValues);
    const visibleComponents = [
      selectTableAlreadyExists,
      switchSkipInitialSpace,
      switchDayFirst,
      switchSkipBlankLines,
      inputDecimalCharacter,
      selectNullValues,
    ];
    visibleComponents.forEach(component => {
      expect(component).toBeVisible();
    });
  });

  test('renders the columns elements correctly', async () => {
    const panelHeader = screen.getByRole('heading', {
      name: /columns/i,
    });
    userEvent.click(panelHeader);
    const selectIndexColumn = screen.getByRole('combobox', {
      name: /Choose index column/i,
    });
    const switchDataFrameIndex = screen.getByTestId('dataFrameIndex');
    const inputColumnLabels = screen.getByRole('textbox', {
      name: /Column labels/i,
    });
    const selectColumnsToRead = screen.getByRole('combobox', {
      name: /Choose columns to read/i,
    });
    const switchOverwriteDuplicates = screen.getByTestId('overwriteDuplicates');
    const inputColumnDataTypes = screen.getByRole('textbox', {
      name: /Column data types/i,
    });
    userEvent.click(selectColumnsToRead);

    const visibleComponents = [
      selectIndexColumn,
      switchDataFrameIndex,
      inputColumnLabels,
      selectColumnsToRead,
      switchOverwriteDuplicates,
      inputColumnDataTypes,
    ];
    visibleComponents.forEach(component => {
      expect(component).toBeVisible();
    });

    test('renders the rows elements correctly', async () => {
      const panelHeader = screen.getByRole('heading', {
        name: /rows/i,
      });
      userEvent.click(panelHeader);
      const inputHeaderRow = screen.getByRole('textbox', {
        name: /header row/i,
      });
      const inputRowsToRead = screen.getByRole('textbox', {
        name: /rows to read/i,
      });
      const inputSkipRows = screen.getByRole('textbox', {
        name: /skip rows/i,
      });

      const visibleComponents = [
        inputHeaderRow,
        inputRowsToRead,
        inputSkipRows,
      ];
      visibleComponents.forEach(component => {
        expect(component).toBeVisible();
      });
    });
  });
});
