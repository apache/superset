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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import type { DatabaseSelectorProps } from 'src/components/DatabaseSelector/types';
import type { TableBrowserProps } from 'src/SqlLab/components/TableExploreTree';
import LeftPanel from '.';
import { DatasetActionType } from '../types';

jest.mock('src/components/DatabaseSelector', () => ({
  DatabaseSelectorPopover: ({
    onDbChange,
    onSchemaChange,
    schema,
  }: DatabaseSelectorProps) => (
    <>
      <button
        type="button"
        onClick={() => onDbChange?.({ id: 2, database_name: 'other' })}
      >
        Change connection
      </button>
      <span>Selected schema: {schema}</span>
      <button type="button" onClick={() => onSchemaChange?.('sales')}>
        Change schema
      </button>
    </>
  ),
}));
jest.mock('src/SqlLab/components/TableExploreTree', () => ({
  TableBrowser: ({ dbId, catalog, onPreviewTable }: TableBrowserProps) => (
    <>
      <span>{`Browser ${dbId}:${catalog ?? ''}`}</span>
      <button
        type="button"
        onClick={() =>
          onPreviewTable?.({ schema: 'public', table_name: 'orders' })
        }
      >
        Preview orders
      </button>
    </>
  ),
}));

const props = {
  setDataset: jest.fn(),
  onPreviewTable: jest.fn(),
  dataset: {
    db: { id: 1, database_name: 'examples' },
    catalog: 'main',
    schema: 'public',
  },
};
afterEach(() => jest.clearAllMocks());

test('supplies the selected connection to the browser', () => {
  render(<LeftPanel {...props} />, { useRedux: true });
  expect(screen.getByText('Browser 1:main')).toBeVisible();
  expect(screen.getByText('Selected schema: public')).toBeVisible();
});

test('notifies the dataset page of the selected table and schema', async () => {
  render(<LeftPanel {...props} />, { useRedux: true });
  await userEvent.click(screen.getByText('Preview orders'));
  expect(props.onPreviewTable).toHaveBeenCalledWith({
    schema: 'public',
    table_name: 'orders',
  });
});

test('changing the connection dispatches the existing source-reset action', async () => {
  render(<LeftPanel {...props} />, { useRedux: true });
  await userEvent.click(screen.getByText('Change connection'));
  expect(props.setDataset).toHaveBeenCalledWith({
    type: DatasetActionType.SelectDatabase,
    payload: { db: { id: 2, database_name: 'other' } },
  });
});

test('changing the schema dispatches the existing table-reset action', async () => {
  render(<LeftPanel {...props} />, { useRedux: true });
  await userEvent.click(screen.getByText('Change schema'));
  expect(props.setDataset).toHaveBeenCalledWith({
    type: DatasetActionType.SelectSchema,
    payload: { name: 'schema', value: 'sales' },
  });
});
