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
import { TableView, TableViewProps, EmptyWrapperType } from '.';

export default {
  title: 'Components/TableView',
  component: TableView,
  parameters: {
    docs: {
      description: {
        component:
          'A data table component with sorting, pagination, text wrapping, and empty state support. Built on react-table.',
      },
    },
  },
};

export const InteractiveTableView = (args: TableViewProps) => (
  <TableView {...args} />
);

InteractiveTableView.args = {
  columns: [
    {
      accessor: 'id',
      Header: 'ID',
      sortable: true,
      id: 'id',
    },
    {
      accessor: 'age',
      Header: 'Age',
      id: 'age',
    },
    {
      accessor: 'name',
      Header: 'Name',
      id: 'name',
    },
    {
      accessor: 'summary',
      Header: 'Summary',
      id: 'summary',
    },
  ],
  data: [
    {
      id: 123,
      age: 27,
      name: 'Emily',
      summary:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam id porta neque, a vehicula orci. Maecenas rhoncus elit sit amet purus convallis placerat in at nunc. Nulla nec viverra augue.',
    },
    {
      id: 321,
      age: 10,
      name: 'Kate',
      summary:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam id porta neque, a vehicula orci. Maecenas rhoncus elit sit amet purus convallis placerat in at nunc. Nulla nec viverra augue.',
    },
    {
      id: 456,
      age: 10,
      name: 'John Smith',
      summary:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam id porta neque, a vehicula orci. Maecenas rhoncus elit sit amet purus convallis placerat in at nunc. Nulla nec viverra augue.',
    },
  ],
  initialSortBy: [{ id: 'name', desc: true }],
  noDataText: 'No data here',
  pageSize: 2,
  showRowCount: true,
  withPagination: true,
  columnsForWrapText: ['Summary'],
  scrollTopOnPagination: false,
};

InteractiveTableView.argTypes = {
  pageSize: {
    control: { type: 'number', min: 1 },
    description: 'Number of rows displayed per page.',
  },
  withPagination: {
    control: 'boolean',
    description: 'Whether to show pagination controls below the table.',
  },
  showRowCount: {
    control: 'boolean',
    description: 'Whether to display the total row count alongside pagination.',
  },
  noDataText: {
    control: 'text',
    description: 'Text displayed when the table has no data.',
  },
  scrollTopOnPagination: {
    control: 'boolean',
    description: 'Whether to scroll to the top of the table when changing pages.',
  },
  emptyWrapperType: {
    control: { type: 'select' },
    options: [EmptyWrapperType.Default, EmptyWrapperType.Small],
    description: 'Style of the empty state wrapper.',
  },
  initialPageIndex: {
    control: { type: 'number', min: 0 },
    description: 'Initial page to display (zero-based).',
  },
};

InteractiveTableView.parameters = {
  docs: {
    staticProps: {
      columns: [
        { accessor: 'id', Header: 'ID', sortable: true, id: 'id' },
        { accessor: 'age', Header: 'Age', id: 'age' },
        { accessor: 'name', Header: 'Name', id: 'name' },
        { accessor: 'summary', Header: 'Summary', id: 'summary' },
      ],
      data: [
        { id: 123, age: 27, name: 'Emily', summary: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
        { id: 321, age: 10, name: 'Kate', summary: 'Nam id porta neque, a vehicula orci.' },
        { id: 456, age: 10, name: 'John Smith', summary: 'Maecenas rhoncus elit sit amet purus convallis placerat.' },
      ],
    },
    liveExample: `function Demo() {
  return (
    <TableView
      columns={[
        { accessor: 'id', Header: 'ID', sortable: true, id: 'id' },
        { accessor: 'age', Header: 'Age', id: 'age' },
        { accessor: 'name', Header: 'Name', id: 'name' },
        { accessor: 'summary', Header: 'Summary', id: 'summary' },
      ]}
      data={[
        { id: 123, age: 27, name: 'Emily', summary: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' },
        { id: 321, age: 10, name: 'Kate', summary: 'Nam id porta neque, a vehicula orci.' },
        { id: 456, age: 10, name: 'John Smith', summary: 'Maecenas rhoncus elit sit amet purus convallis placerat.' },
      ]}
      initialSortBy={[{ id: 'name', desc: true }]}
      pageSize={2}
      withPagination
      showRowCount
    />
  );
}`,
    examples: [
      {
        title: 'Without Pagination',
        code: `function NoPaginationDemo() {
  return (
    <TableView
      columns={[
        { accessor: 'name', Header: 'Name', id: 'name' },
        { accessor: 'email', Header: 'Email', id: 'email' },
        { accessor: 'status', Header: 'Status', id: 'status' },
      ]}
      data={[
        { name: 'Alice', email: 'alice@example.com', status: 'Active' },
        { name: 'Bob', email: 'bob@example.com', status: 'Inactive' },
        { name: 'Charlie', email: 'charlie@example.com', status: 'Active' },
      ]}
      withPagination={false}
    />
  );
}`,
      },
      {
        title: 'Empty State',
        code: `function EmptyDemo() {
  return (
    <TableView
      columns={[
        { accessor: 'name', Header: 'Name', id: 'name' },
        { accessor: 'value', Header: 'Value', id: 'value' },
      ]}
      data={[]}
      noDataText="No results found"
    />
  );
}`,
      },
      {
        title: 'With Sorting',
        code: `function SortingDemo() {
  return (
    <TableView
      columns={[
        { accessor: 'id', Header: 'ID', id: 'id', sortable: true },
        { accessor: 'name', Header: 'Name', id: 'name', sortable: true },
        { accessor: 'score', Header: 'Score', id: 'score', sortable: true },
      ]}
      data={[
        { id: 1, name: 'Dashboard A', score: 95 },
        { id: 2, name: 'Dashboard B', score: 72 },
        { id: 3, name: 'Dashboard C', score: 88 },
        { id: 4, name: 'Dashboard D', score: 64 },
      ]}
      initialSortBy={[{ id: 'score', desc: true }]}
      withPagination={false}
    />
  );
}`,
      },
    ],
  },
};
