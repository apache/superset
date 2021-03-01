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
import { TableCollectionLoading } from './TableCollectionLoading';

test('Should render null if loading:false', () => {
  const props = { columns: [], rows: 0, loading: false };
  render(
    <table>
      <tbody data-test="test-table">
        <TableCollectionLoading {...(props as any)} />
      </tbody>
    </table>,
  );
  expect(screen.getByTestId('test-table').childElementCount).toBe(0);
});

test('Should render null if rows !== 0', () => {
  const props = { columns: [], rows: 1, loading: true };
  render(
    <table>
      <tbody data-test="test-table">
        <TableCollectionLoading {...(props as any)} />
      </tbody>
    </table>,
  );
  expect(screen.getByTestId('test-table').childElementCount).toBe(0);
});

test('Should render 25 rows', () => {
  const props = { columns: [], rows: 0, loading: true };
  render(
    <table>
      <tbody data-test="test-table">
        <TableCollectionLoading {...(props as any)} />
      </tbody>
    </table>,
  );
  expect(screen.getByTestId('test-table').childElementCount).toBe(25);
});

test('Should render <tr> without <td> if there is no columns', () => {
  const props = { columns: [], rows: 0, loading: true };
  render(
    <table>
      <tbody data-test="test-table">
        <TableCollectionLoading {...(props as any)} />
      </tbody>
    </table>,
  );

  // eslint-disable-next-line no-plusplus
  for (let i = 1; i <= 25; i++) {
    expect(screen.getByTestId(`tr-loading-${i}`).childElementCount).toBe(0);
  }
});

test('Should render <tr> without <td> if column is hidden', () => {
  const props = {
    columns: [{ hidden: true }, { hidden: true }],
    rows: 0,
    loading: true,
  };
  render(
    <table>
      <tbody data-test="test-table">
        <TableCollectionLoading {...(props as any)} />
      </tbody>
    </table>,
  );

  // eslint-disable-next-line no-plusplus
  for (let i = 1; i <= 25; i++) {
    expect(screen.getByTestId(`tr-loading-${i}`).childElementCount).toBe(0);
  }
});

test('Should render <tr> with <td> if column exists', () => {
  const props = {
    columns: [{}, {}],
    rows: 0,
    loading: true,
  };
  render(
    <table>
      <tbody data-test="test-table">
        <TableCollectionLoading {...(props as any)} />
      </tbody>
    </table>,
  );

  // eslint-disable-next-line no-plusplus
  for (let i = 1; i <= 25; i++) {
    expect(screen.getByTestId(`tr-loading-${i}`).childElementCount).toBe(2);
    expect(screen.getByTestId(`span-loading-${i}-1`)).toBeInTheDocument();
    expect(screen.getByTestId(`span-loading-${i}-1`)).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByTestId(`span-loading-${i}-1`)?.textContent).toBe(
      'LOADING',
    );
    expect(screen.getByTestId(`span-loading-${i}-2`)).toBeInTheDocument();
    expect(screen.getByTestId(`span-loading-${i}-2`)).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByTestId(`span-loading-${i}-2`)?.textContent).toBe(
      'LOADING',
    );
  }
});
