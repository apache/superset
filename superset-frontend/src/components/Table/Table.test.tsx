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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import type { ColumnsType } from 'antd/es/table';
import { Table, TableSize } from './index';

interface BasicData {
  columnName: string;
  columnType: string;
  dataType: string;
}

const testData: BasicData[] = [
  {
    columnName: 'Number',
    columnType: 'Numerical',
    dataType: 'number',
  },
  {
    columnName: 'String',
    columnType: 'Physical',
    dataType: 'string',
  },
  {
    columnName: 'Date',
    columnType: 'Virtual',
    dataType: 'date',
  },
];

const testColumns: ColumnsType<BasicData> = [
  {
    title: 'Column Name',
    dataIndex: 'columnName',
    key: 'columnName',
  },
  {
    title: 'Column Type',
    dataIndex: 'columnType',
    key: 'columnType',
  },
  {
    title: 'Data Type',
    dataIndex: 'dataType',
    key: 'dataType',
  },
];

test('renders with default props', async () => {
  render(
    <Table size={TableSize.Middle} columns={testColumns} data={testData} />,
  );
  await waitFor(() =>
    testColumns.forEach(column =>
      expect(screen.getByText(column.title as string)).toBeInTheDocument(),
    ),
  );
  testData.forEach(row => {
    expect(screen.getByText(row.columnName)).toBeInTheDocument();
    expect(screen.getByText(row.columnType)).toBeInTheDocument();
    expect(screen.getByText(row.dataType)).toBeInTheDocument();
  });
});
