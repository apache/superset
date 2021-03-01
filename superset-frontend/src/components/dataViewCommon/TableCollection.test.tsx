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
import TableCollection from './TableCollection';

jest.mock('./TableCollectionHead', () => ({
  TableCollectionHead: (props: any) => (
    <thead>
      <tr>
        <td>
          <div data-test="header" data-header-groups={props.headerGroups} />
        </td>
      </tr>
    </thead>
  ),
}));

jest.mock('./TableCollectionBody', () => ({
  TableCollectionBody: (props: any) => (
    <tbody>
      <tr>
        <td>
          <div
            data-test="body"
            data-get-table-body-props={props.getTableBodyProps}
            data-prepare-row={props.prepareRow}
            data-header-groups={props.headerGroups}
            data-rows={props.rows}
            data-columns={props.columns}
            data-loading={props.loading}
            data-highlight-row-id={props.highlightRowId}
          />
        </td>
      </tr>
    </tbody>
  ),
}));

test('Should only pass props to TableCollectionHead and TableCollectionBody', () => {
  const props = {
    getTableProps: jest.fn(),
    getTableBodyProps: 'getTableBodyProps',
    prepareRow: 'prepareRow',
    headerGroups: 'headerGroups',
    rows: 'rows',
    columns: 'columns',
    loading: 'loading',
    highlightRowId: 'highlightRowId',
  };

  render(<TableCollection {...(props as any)} />);
  expect(props.getTableProps).toBeCalledTimes(1);

  expect(screen.getByTestId('header')).toHaveAttribute(
    'data-header-groups',
    'headerGroups',
  );
  expect(screen.getByTestId('body')).toHaveAttribute(
    'data-get-table-body-props',
    'getTableBodyProps',
  );
  expect(screen.getByTestId('body')).toHaveAttribute(
    'data-prepare-row',
    'prepareRow',
  );
  expect(screen.getByTestId('body')).toHaveAttribute(
    'data-header-groups',
    'headerGroups',
  );
  expect(screen.getByTestId('body')).toHaveAttribute('data-rows', 'rows');
  expect(screen.getByTestId('body')).toHaveAttribute('data-columns', 'columns');
  expect(screen.getByTestId('body')).toHaveAttribute('data-loading', 'loading');
  expect(screen.getByTestId('body')).toHaveAttribute(
    'data-highlight-row-id',
    'highlightRowId',
  );
});
