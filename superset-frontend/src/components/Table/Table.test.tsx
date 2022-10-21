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
import type { ColumnsType } from 'antd/es/table';
import { Table, TableDataType, TableSize } from './index';

interface BasicData extends TableDataType {
  columnName: string;
  columnType: string;
  dataType: string;
  actions?: string[];
}

const testData: BasicData[] = [
  {
    key: 1,
    columnName: 'Column Name 1',
    columnType: 'Physical',
    dataType: 'string',
    actions: ['Action 1', 'Action 2'],
  },
  {
    key: 2,
    columnName: 'Column Name 2',
    columnType: 'Physical',
    dataType: 'string',
    actions: ['Action 1', 'Action 2'],
  },
  {
    key: 3,
    columnName: 'Column Name 3',
    columnType: 'Virtual',
    dataType: 'string',
    actions: ['Action 1', 'Action 2'],
  },
];

const testColumns: ColumnsType<BasicData> = [
  {
    title: 'Column Name',
    dataIndex: 'columnName',
    key: 'columnName',
    width: 150,
    sorter: (a: BasicData, b: BasicData) =>
      a.columnName.localeCompare(b.columnName),
  },
  {
    title: 'Column Type',
    dataIndex: 'columnType',
    key: 'columnType',
    sorter: (a: BasicData, b: BasicData) =>
      a.columnType.localeCompare(b.columnType),
  },
  {
    title: 'Data Type',
    dataIndex: 'dataType',
    key: 'dataType',
    sorter: (a: BasicData, b: BasicData) =>
      a.dataType.localeCompare(b.dataType),
  },
  {
    title: 'actions',
    dataIndex: 'actions',
    key: 'actions',
  },
];

test('renders with default props', async () => {
  render(
    <Table size={TableSize.MIDDLE} columns={testColumns} data={testData} />,
  );
  expect(screen.getByText('Column Name')).toBeInTheDocument();
  expect(screen.getByText('Column Type')).toBeInTheDocument();
  expect(screen.getByText('Data Type')).toBeInTheDocument();
  expect(screen.getByText('actions')).toBeInTheDocument();
});
