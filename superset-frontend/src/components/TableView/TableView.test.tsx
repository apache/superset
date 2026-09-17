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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import TableView, { TableViewProps } from '.';

const mockedProps: TableViewProps = {
  columns: [
    {
      accessor: 'id',
      Header: 'ID',
      sortable: true,
    },
    {
      accessor: 'age',
      Header: 'Age',
    },
    {
      accessor: 'name',
      Header: 'Name',
    },
  ],
  data: [
    { id: 123, age: 27, name: 'Emily' },
    { id: 321, age: 10, name: 'Kate' },
  ],
  pageSize: 1,
};

test('should render', () => {
  const { container } = render(<TableView {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render a table', () => {
  render(<TableView {...mockedProps} />);
  expect(screen.getByRole('table')).toBeInTheDocument();
});

test('should render the headers', () => {
  render(<TableView {...mockedProps} />);
  expect(screen.getAllByRole('columnheader')).toHaveLength(3);
  expect(screen.getByText('ID')).toBeInTheDocument();
  expect(screen.getByText('Age')).toBeInTheDocument();
  expect(screen.getByText('Name')).toBeInTheDocument();
});

test('should render the rows', () => {
  render(<TableView {...mockedProps} />);
  expect(screen.getAllByRole('row')).toHaveLength(2);
});

test('should render the cells', () => {
  render(<TableView {...mockedProps} />);
  expect(screen.getAllByRole('cell')).toHaveLength(3);
  expect(screen.getByText('123')).toBeInTheDocument();
  expect(screen.getByText('27')).toBeInTheDocument();
  expect(screen.getByText('Emily')).toBeInTheDocument();
});

test('should render the pagination', () => {
  render(<TableView {...mockedProps} />);
  expect(screen.getByRole('navigation')).toBeInTheDocument();
  expect(screen.getAllByRole('button')).toHaveLength(4);
  expect(screen.getByText('«')).toBeInTheDocument();
  expect(screen.getByText('»')).toBeInTheDocument();
});

test('should show the row count by default', () => {
  render(<TableView {...mockedProps} />);
  expect(screen.getByText('1-1 of 2')).toBeInTheDocument();
});

test('should NOT show the row count', () => {
  const noRowCountProps = {
    ...mockedProps,
    showRowCount: false,
  };
  render(<TableView {...noRowCountProps} />);
  expect(screen.queryByText('1-1 of 2')).not.toBeInTheDocument();
});

test('should NOT render the pagination when disabled', () => {
  const withoutPaginationProps = {
    ...mockedProps,
    withPagination: false,
  };
  render(<TableView {...withoutPaginationProps} />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('should NOT render the pagination when fewer rows than page size', () => {
  const withoutPaginationProps = {
    ...mockedProps,
    pageSize: 3,
  };
  render(<TableView {...withoutPaginationProps} />);
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});

test('should change page when « and » buttons are clicked', () => {
  render(<TableView {...mockedProps} />);
  const nextBtn = screen.getByText('»');
  const prevBtn = screen.getByText('«');

  userEvent.click(nextBtn);
  expect(screen.getAllByRole('cell')).toHaveLength(3);
  expect(screen.getByText('321')).toBeInTheDocument();
  expect(screen.getByText('10')).toBeInTheDocument();
  expect(screen.getByText('Kate')).toBeInTheDocument();
  expect(screen.queryByText('Emily')).not.toBeInTheDocument();

  userEvent.click(prevBtn);
  expect(screen.getAllByRole('cell')).toHaveLength(3);
  expect(screen.getByText('123')).toBeInTheDocument();
  expect(screen.getByText('27')).toBeInTheDocument();
  expect(screen.getByText('Emily')).toBeInTheDocument();
  expect(screen.queryByText('Kate')).not.toBeInTheDocument();
});

test('should sort by age', () => {
  render(<TableView {...mockedProps} />);
  const ageSort = screen.getAllByRole('columnheader')[1];

  userEvent.click(ageSort);
  expect(screen.getAllByRole('cell')[1]).toHaveTextContent('10');

  userEvent.click(ageSort);
  expect(screen.getAllByRole('cell')[1]).toHaveTextContent('27');
});

test('should sort by initialSortBy DESC', () => {
  const initialSortByDescProps = {
    ...mockedProps,
    initialSortBy: [{ id: 'name', desc: true }],
  };
  render(<TableView {...initialSortByDescProps} />);

  expect(screen.getByText('Kate')).toBeInTheDocument();
  expect(screen.queryByText('Emily')).not.toBeInTheDocument();
});

test('should sort by initialSortBy ASC', () => {
  const initialSortByAscProps = {
    ...mockedProps,
    initialSortBy: [{ id: 'name', desc: false }],
  };
  render(<TableView {...initialSortByAscProps} />);

  expect(screen.getByText('Emily')).toBeInTheDocument();
  expect(screen.queryByText('Kate')).not.toBeInTheDocument();
});

test('should show empty', () => {
  const noDataProps = {
    ...mockedProps,
    data: [],
    noDataText: 'No data here',
  };
  render(<TableView {...noDataProps} />);

  expect(screen.getByText('No data here')).toBeInTheDocument();
});

test('should render the right page', () => {
  const pageIndexProps = {
    ...mockedProps,
    initialPageIndex: 1,
  };
  render(<TableView {...pageIndexProps} />);

  expect(screen.getByText('321')).toBeInTheDocument();
  expect(screen.getByText('10')).toBeInTheDocument();
  expect(screen.getByText('Kate')).toBeInTheDocument();
  expect(screen.queryByText('Emily')).not.toBeInTheDocument();
});

test('should render the right wrap content text by columnsForWrapText', () => {
  const props = {
    ...mockedProps,
    columnsForWrapText: ['Name'],
  };
  render(<TableView {...props} />);

  expect(screen.getAllByTestId('table-row-cell')[0]).toHaveClass(
    'table-cell__nowrap',
  );
  expect(screen.getAllByTestId('table-row-cell')[1]).toHaveClass(
    'table-cell__nowrap',
  );
  expect(screen.getAllByTestId('table-row-cell')[2]).toHaveClass(
    'table-cell__wrap',
  );
});
