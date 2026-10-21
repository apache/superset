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
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { fetchUserOptions } from './utils';

type GetResponse = Awaited<ReturnType<typeof SupersetClient.get>>;

const getMock = jest.spyOn(SupersetClient, 'get');

const mockUsersResponse = (
  result: Record<string, unknown>[],
  count = result.length,
) =>
  getMock.mockResolvedValue({
    json: { count, result },
  } as unknown as GetResponse);

const decodeQuery = () => {
  const { endpoint } = getMock.mock.calls[0][0] as { endpoint: string };
  return rison.decode(endpoint.split('?q=')[1]);
};

afterEach(() => {
  getMock.mockReset();
});

test('fetchUserOptions sends the search term as a server-side filter', async () => {
  mockUsersResponse([
    { id: 7, username: 'jsmith', first_name: 'Jane', last_name: 'Smith' },
  ]);

  const result = await fetchUserOptions('Jane Sm', 0, 100, jest.fn());

  expect(decodeQuery()).toEqual({
    filters: [{ col: 'username', opr: 'user_all_text', value: 'Jane Sm' }],
    page: 0,
    page_size: 100,
    order_column: 'username',
    order_direction: 'asc',
  });
  expect(result).toEqual({
    data: [{ value: 7, label: 'Jane Smith' }],
    totalCount: 1,
  });
});

test('fetchUserOptions omits filters when there is no search term', async () => {
  mockUsersResponse([{ id: 1, username: 'admin' }], 250);

  const result = await fetchUserOptions('', 2, 100, jest.fn());

  expect(decodeQuery()).toEqual({
    page: 2,
    page_size: 100,
    order_column: 'username',
    order_direction: 'asc',
  });
  expect(result).toEqual({
    data: [{ value: 1, label: 'admin' }],
    totalCount: 250,
  });
});

test('fetchUserOptions shows a toast and returns no options on error', async () => {
  getMock.mockRejectedValue(new Error('boom'));
  const addDangerToast = jest.fn();

  const result = await fetchUserOptions('jane', 0, 100, addDangerToast);

  expect(addDangerToast).toHaveBeenCalledWith(
    'There was an error while fetching users',
  );
  expect(result).toEqual({ data: [], totalCount: 0 });
});
