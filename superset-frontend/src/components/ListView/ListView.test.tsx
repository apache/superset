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
import { render, waitFor } from 'spec/helpers/testing-library';
import ListView from './ListView';

const mockedProps = {
  title: 'Data Table',
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
    {
      accessor: 'time',
      Header: 'Time',
    },
  ],
  data: [
    { id: 1, name: 'data 1', age: 10, time: '2020-11-18T07:53:45.354Z' },
    { id: 2, name: 'data 2', age: 1, time: '2020-11-18T07:53:45.354Z' },
  ],
  count: 2,
  pageSize: 1,
  loading: false,
  refreshData: jest.fn(),
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
};

test('redirects to first page when page index is invalid', async () => {
  const fetchData = jest.fn();
  window.history.pushState({}, '', '/?pageIndex=9');
  render(<ListView {...mockedProps} fetchData={fetchData} />, {
    useRouter: true,
    useQueryParams: true,
  });
  await waitFor(() => {
    expect(window.location.search).toEqual('?pageIndex=0');
    expect(fetchData).toBeCalledTimes(2);
    expect(fetchData).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 9 }),
    );
    expect(fetchData).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 0 }),
    );
  });
  fetchData.mockClear();
});
