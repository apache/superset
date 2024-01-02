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
import { render, screen } from 'spec/helpers/testing-library';
import DatasetPanel, {
  REFRESHING,
  ALT_LOADING,
  tableColumnDefinition,
  COLUMN_TITLE,
} from 'src/features/datasets/AddDataset/DatasetPanel/DatasetPanel';
import { exampleColumns, exampleDataset } from './fixtures';
import {
  SELECT_MESSAGE,
  CREATE_MESSAGE,
  VIEW_DATASET_MESSAGE,
  SELECT_TABLE_TITLE,
  NO_COLUMNS_TITLE,
  NO_COLUMNS_DESCRIPTION,
  ERROR_TITLE,
  ERROR_DESCRIPTION,
} from './MessageContent';

jest.mock(
  'src/components/Icons/Icon',
  () =>
    ({ fileName }: { fileName: string }) =>
      <span role="img" aria-label={fileName.replace('_', '-')} />,
);

describe('DatasetPanel', () => {
  test('renders a blank state DatasetPanel', () => {
    render(<DatasetPanel hasError={false} columnList={[]} loading={false} />, {
      useRouter: true,
    });

    const blankDatasetImg = screen.getByRole('img', { name: /empty/i });
    expect(blankDatasetImg).toBeVisible();
    const blankDatasetTitle = screen.getByText(SELECT_TABLE_TITLE);
    expect(blankDatasetTitle).toBeVisible();
    const blankDatasetDescription1 = screen.getByText(SELECT_MESSAGE, {
      exact: false,
    });
    expect(blankDatasetDescription1).toBeVisible();
    const blankDatasetDescription2 = screen.getByText(VIEW_DATASET_MESSAGE, {
      exact: false,
    });
    expect(blankDatasetDescription2).toBeVisible();
    const sqlLabLink = screen.getByRole('button', {
      name: CREATE_MESSAGE,
    });
    expect(sqlLabLink).toBeVisible();
  });

  test('renders a no columns screen', () => {
    render(
      <DatasetPanel
        tableName="Name"
        hasError={false}
        columnList={[]}
        loading={false}
      />,
      {
        useRouter: true,
      },
    );

    const blankDatasetImg = screen.getByRole('img', { name: /empty/i });
    expect(blankDatasetImg).toBeVisible();
    const noColumnsTitle = screen.getByText(NO_COLUMNS_TITLE);
    expect(noColumnsTitle).toBeVisible();
    const noColumnsDescription = screen.getByText(NO_COLUMNS_DESCRIPTION);
    expect(noColumnsDescription).toBeVisible();
  });

  test('renders a loading screen', () => {
    render(
      <DatasetPanel
        tableName="Name"
        hasError={false}
        columnList={[]}
        loading
      />,
      {
        useRouter: true,
      },
    );

    const blankDatasetImg = screen.getByAltText(ALT_LOADING);
    expect(blankDatasetImg).toBeVisible();
    const blankDatasetTitle = screen.getByText(REFRESHING);
    expect(blankDatasetTitle).toBeVisible();
  });

  test('renders an error screen', () => {
    render(
      <DatasetPanel
        tableName="Name"
        hasError
        columnList={[]}
        loading={false}
      />,
      {
        useRouter: true,
      },
    );

    const errorTitle = screen.getByText(ERROR_TITLE);
    expect(errorTitle).toBeVisible();
    const errorDescription = screen.getByText(ERROR_DESCRIPTION);
    expect(errorDescription).toBeVisible();
  });

  test('renders a table with columns displayed', async () => {
    const tableName = 'example_name';
    render(
      <DatasetPanel
        tableName={tableName}
        hasError={false}
        columnList={exampleColumns}
        loading={false}
      />,
      {
        useRouter: true,
      },
    );
    expect(await screen.findByText(tableName)).toBeVisible();
    expect(screen.getByText(COLUMN_TITLE)).toBeVisible();
    expect(
      screen.getByText(tableColumnDefinition[0].title as string),
    ).toBeInTheDocument();
    expect(
      screen.getByText(tableColumnDefinition[1].title as string),
    ).toBeInTheDocument();
    exampleColumns.forEach(row => {
      expect(screen.getByText(row.name)).toBeInTheDocument();
      expect(screen.getByText(row.type)).toBeInTheDocument();
    });
  });

  test('renders an info banner if table already has a dataset', async () => {
    render(
      <DatasetPanel
        tableName="example_table"
        hasError={false}
        columnList={exampleColumns}
        loading={false}
        datasets={exampleDataset}
      />,
      {
        useRouter: true,
      },
    );

    // This is text in the info banner
    expect(
      await screen.findByText(
        /this table already has a dataset associated with it. you can only associate one dataset with a table./i,
      ),
    ).toBeVisible();
  });
});
