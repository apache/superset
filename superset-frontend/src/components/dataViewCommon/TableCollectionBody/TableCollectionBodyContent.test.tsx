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
import { TableCollectionBodyContent } from './TableCollectionBodyContent';

const generateRows = ({ rows, cells }: { rows: number; cells: number }) =>
  [...new Array(rows)].map((_, row) => ({
    original: { id: row + 1 },
    getRowProps: jest.fn(),
    cells:
      [...new Array(cells)].map((_, cell) => ({
        render: jest.fn(),
        getCellProps: jest.fn().mockReturnValue({ key: cell + 1 }),
        column: { getCellProps: {} },
      })) || [],
  }));

test('Should render nothing if rows is empty array', () => {
  const props = {
    prepareRow: jest.fn(),
    rows: [],
    loading: false,
  };

  render(
    <table>
      <tbody data-test="table">
        <TableCollectionBodyContent {...props} />
      </tbody>
    </table>,
  );
  expect(props.prepareRow).toBeCalledTimes(0);
  expect(screen.getByTestId('table').childElementCount).toBe(0);
});

test('Should render only <tr> when row has no cells', () => {
  const props = {
    prepareRow: jest.fn(),
    rows: generateRows({ rows: 1, cells: 0 }),
    loading: false,
  };

  render(
    <table>
      <tbody data-test="table">
        <TableCollectionBodyContent {...(props as any)} />
      </tbody>
    </table>,
  );

  expect(screen.getByTestId('table').childElementCount).toBe(props.rows.length);
  expect(props.prepareRow).toBeCalledTimes(props.rows.length);
  expect(props.rows[0].getRowProps).toBeCalledTimes(1);
  expect(screen.getByTestId('table-row').childElementCount).toBe(
    props.rows[0].cells.length,
  );
});

test('Should render <tr> and <td>', () => {
  const props = {
    prepareRow: jest.fn(),
    rows: generateRows({ rows: 1, cells: 2 }),
    loading: false,
  };

  render(
    <table>
      <tbody data-test="table">
        <TableCollectionBodyContent {...(props as any)} />
      </tbody>
    </table>,
  );

  expect(screen.getByTestId('table').childElementCount).toBe(props.rows.length);
  expect(props.prepareRow).toBeCalledTimes(props.rows.length);
  expect(screen.getByTestId('table-row').childElementCount).toBe(
    props.rows[0].cells.length,
  );

  props.rows.forEach(row => {
    expect(row.getRowProps).toBeCalledTimes(1);
    row.cells.forEach(cell => {
      expect(cell.getCellProps).toBeCalledTimes(1);
      expect(cell.render).toBeCalledTimes(1);
      expect(cell.render).toBeCalledWith('Cell');
    });
  });
});
