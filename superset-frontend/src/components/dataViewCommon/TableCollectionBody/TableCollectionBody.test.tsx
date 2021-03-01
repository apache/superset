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
import { TableCollectionBody } from './TableCollectionBody';

jest.mock('./TableCollectionLoading', () => ({
  TableCollectionLoading: (props: any) => (
    <tr>
      <td>
        <div
          data-test="loading"
          data-columns={props.columns}
          data-rows={props.rows}
          data-loading={props.loading}
        />
      </td>
    </tr>
  ),
}));

jest.mock('./TableCollectionBodyContent', () => ({
  TableCollectionBodyContent: (props: any) => (
    <tr>
      <td>
        <div
          data-test="content"
          data-prepare-row={props.prepareRow}
          data-rows={props.rows}
          data-loading={props.loading}
          data-highlight-row-id={props.highlightRowId}
        />
      </td>
    </tr>
  ),
}));

test('Should only pass props to TableCollectionLoading and TableCollectionBodyContent', () => {
  const props = {
    getTableProps: 'getTableProps',
    getTableBodyProps: jest.fn(),
    prepareRow: 'prepareRow',
    headerGroups: 'headerGroups',
    rows: 'rows',
    columns: 'columns',
    loading: 'loading',
    highlightRowId: 'highlightRowId',
  };

  render(
    <table>
      <TableCollectionBody {...(props as any)} />
    </table>,
  );

  expect(props.getTableBodyProps).toBeCalledTimes(1);

  expect(screen.getByTestId('loading')).toHaveAttribute(
    'data-columns',
    'columns',
  );
  expect(screen.getByTestId('loading')).toHaveAttribute(
    'data-rows',
    `${props.rows.length}`,
  );
  expect(screen.getByTestId('loading')).toHaveAttribute(
    'data-loading',
    'loading',
  );
  expect(screen.getByTestId('content')).toHaveAttribute(
    'data-prepare-row',
    'prepareRow',
  );
  expect(screen.getByTestId('content')).toHaveAttribute('data-rows', 'rows');
  expect(screen.getByTestId('content')).toHaveAttribute(
    'data-loading',
    'loading',
  );
  expect(screen.getByTestId('content')).toHaveAttribute(
    'data-highlight-row-id',
    'highlightRowId',
  );
});
