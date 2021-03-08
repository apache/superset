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
import { TableCollectionCell } from './TableCollectionCell';

test('Should render the <td> correctly - minimal props', () => {
  const props = { column: {} };

  render(
    <table>
      <tbody>
        <tr>
          <TableCollectionCell {...props}>
            <div data-test="content">Test</div>
          </TableCollectionCell>
        </tr>
      </tbody>
    </table>,
  );
  expect(screen.getByTestId('content')).toBeInTheDocument();
});

test('Should render the <td> with additional attributes', () => {
  const props = {
    column: {},
    'data-custom': 'custom',
    'data-attr': 'attr-test',
  };

  render(
    <table>
      <tbody>
        <tr>
          <TableCollectionCell {...props}>
            <div data-test="content">Test</div>
          </TableCollectionCell>
        </tr>
      </tbody>
    </table>,
  );

  expect(screen.getByRole('cell', { name: 'Test' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Test' })).toHaveAttribute(
    'data-custom',
    'custom',
  );
  expect(screen.getByRole('cell', { name: 'Test' })).toHaveAttribute(
    'data-attr',
    'attr-test',
  );
  expect(screen.getByRole('cell', { name: 'Test' })).toHaveClass('table-cell');
});

test('Should use size as class', () => {
  const props = { column: { size: 'my-custom-size' } };

  render(
    <table>
      <tbody>
        <tr>
          <TableCollectionCell {...props}>
            <div data-test="content">Test</div>
          </TableCollectionCell>
        </tr>
      </tbody>
    </table>,
  );
  expect(screen.getByTestId('content')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Test' })).toHaveClass(
    'table-cell',
    'my-custom-size',
  );
});

test('Should has correct class on loading state', () => {
  const props = { column: {}, loading: true };

  render(
    <table>
      <tbody>
        <tr>
          <TableCollectionCell {...props}>
            <div data-test="content">Test</div>
          </TableCollectionCell>
        </tr>
      </tbody>
    </table>,
  );
  expect(screen.getByTestId('content')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'Test' })).toHaveClass(
    'table-cell',
    'table-cell-loader',
  );
});
