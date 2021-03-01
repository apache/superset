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
import { TableCollectionHead } from './TableCollectionHead';
import { TableCollectionHeadCol } from './TableCollectionHeadCol';

jest.mock('./TableCollectionHeadCol');

beforeEach(() => {
  (TableCollectionHeadCol as jest.Mock).mockImplementation(
    ({ column }: { column: any }) => <th>{JSON.stringify(column)}</th>,
  );
});

test('Should render the <thead> correctly - 2 rows', () => {
  const headers = [
    { id: 'column-01' },
    { id: 'column-02' },
    { id: 'column-03' },
    { id: 'column-04' },
  ];
  const headerGroups = [
    {
      getHeaderGroupProps: jest.fn(),
      headers: [headers[0], headers[1]],
    },
    {
      getHeaderGroupProps: jest.fn(),
      headers: [headers[2], headers[3]],
    },
  ];
  render(
    <table>
      <TableCollectionHead headerGroups={headerGroups as any} />
    </table>,
  );

  expect(screen.getByTestId('thead')).toBeInTheDocument();
  expect(headerGroups[0].getHeaderGroupProps).toBeCalledTimes(1);
  expect(headerGroups[1].getHeaderGroupProps).toBeCalledTimes(1);
  expect(TableCollectionHeadCol).toBeCalledTimes(4);
  headers.forEach(header =>
    expect(screen.getByText(JSON.stringify(header))).toBeInTheDocument(),
  );
});
