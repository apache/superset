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
import { HeaderGroup } from 'react-table';
import { TableCollectionHeadCol } from './TableCollectionHeadCol';

jest.mock('src/components/Icon', () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => <div data-test={name} />,
}));

test('Should render null when the column is hidden', () => {
  const column = { hidden: true } as HeaderGroup;
  render(
    <table>
      <thead>
        <tr>
          <TableCollectionHeadCol column={column} />
        </tr>
      </thead>
    </table>,
  );

  expect(screen.queryByTestId('sort-header')).not.toBeInTheDocument();
});

test('Should render the column correctly - minimal props', () => {
  const column = { getHeaderProps: jest.fn(), render: jest.fn() };
  render(
    <table>
      <thead>
        <tr>
          <TableCollectionHeadCol column={column as any} />
        </tr>
      </thead>
    </table>,
  );
  expect(screen.getByTestId('sort-header')).toBeInTheDocument();
  expect(screen.getByTestId('sort-header')).not.toHaveClass();

  expect(column.getHeaderProps).toBeCalledTimes(1);
  expect(column.getHeaderProps).toBeCalledWith({});

  expect(column.render).toBeCalledTimes(1);
  expect(column.render).toBeCalledWith('Header');
});

test('Should render the column correctly - sortable column', () => {
  const column = {
    getHeaderProps: jest.fn(),
    getSortByToggleProps: jest.fn(),
    render: jest.fn(),
    canSort: true,
  };

  column.getSortByToggleProps.mockReturnValue({ resp: 'getSortByToggleProps' });

  render(
    <table>
      <thead>
        <tr>
          <TableCollectionHeadCol column={column as any} />
        </tr>
      </thead>
    </table>,
  );
  expect(screen.getByTestId('sort-header')).toBeInTheDocument();
  expect(screen.getByTestId('sort')).toBeInTheDocument();

  expect(column.getSortByToggleProps).toBeCalledTimes(1);

  expect(column.getHeaderProps).toBeCalledTimes(1);
  expect(column.getHeaderProps).toBeCalledWith({
    resp: 'getSortByToggleProps',
  });

  expect(column.render).toBeCalledTimes(1);
  expect(column.render).toBeCalledWith('Header');
});

test('Should render the column correctly - sortable column asc', () => {
  const column = {
    getHeaderProps: jest.fn(),
    getSortByToggleProps: jest.fn(),
    render: jest.fn(),
    canSort: true,
    isSorted: true,
  };

  render(
    <table>
      <thead>
        <tr>
          <TableCollectionHeadCol column={column as any} />
        </tr>
      </thead>
    </table>,
  );

  expect(screen.getByTestId('sort-asc')).toBeInTheDocument();
});

test('Should render the column correctly - sortable column desc', () => {
  const column = {
    getHeaderProps: jest.fn(),
    getSortByToggleProps: jest.fn(),
    render: jest.fn(),
    canSort: true,
    isSorted: true,
    isSortedDesc: true,
  };

  render(
    <table>
      <thead>
        <tr>
          <TableCollectionHeadCol column={column as any} />
        </tr>
      </thead>
    </table>,
  );
  expect(screen.getByTestId('sort-desc')).toBeInTheDocument();
});

test('Should use size as class', async () => {
  const column = {
    getHeaderProps: jest.fn(),
    getSortByToggleProps: jest.fn(),
    render: jest.fn(),
    size: 'xs',
  };

  render(
    <table>
      <thead>
        <tr>
          <TableCollectionHeadCol column={column as any} />
        </tr>
      </thead>
    </table>,
  );
  expect(screen.getByTestId('sort-header')).toHaveClass('xs');
});
