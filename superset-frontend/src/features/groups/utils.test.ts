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
import { render, screen } from 'spec/helpers/testing-library';
import {
  fetchUserOptions,
  toUserSelectOption,
  USER_OPTION_FILTER_PROPS,
  userOptionSortComparator,
} from './utils';

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
  const q = new URLSearchParams(endpoint.split('?')[1]).get('q') ?? '';
  return rison.decode(q);
};

afterEach(() => {
  getMock.mockReset();
});

test('fetchUserOptions sends the search term as a server-side filter', async () => {
  mockUsersResponse([
    {
      id: 7,
      username: 'jsmith',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
    },
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
    data: [
      {
        value: 7,
        label: expect.anything(),
        title: 'Jane Smith',
        textLabel: 'Jane Smith',
        subjectDetail: 'jane@example.com',
        username: 'jsmith',
      },
    ],
    totalCount: 1,
  });
});

test('fetchUserOptions trims the search term before sending it', async () => {
  mockUsersResponse([]);

  await fetchUserOptions('  jane ', 0, 100, jest.fn());

  expect(decodeQuery()).toEqual({
    filters: [{ col: 'username', opr: 'user_all_text', value: 'jane' }],
    page: 0,
    page_size: 100,
    order_column: 'username',
    order_direction: 'asc',
  });
});

test.each([
  ['an empty', ''],
  ['a whitespace-only', '   '],
])(
  'fetchUserOptions sends no filters for %s search term',
  async (_label, filterValue) => {
    mockUsersResponse([{ id: 1, username: 'admin' }], 250);

    const result = await fetchUserOptions(filterValue, 2, 100, jest.fn());

    expect(decodeQuery()).toEqual({
      filters: [],
      page: 2,
      page_size: 100,
      order_column: 'username',
      order_direction: 'asc',
    });
    expect(result).toEqual({
      data: [
        expect.objectContaining({
          value: 1,
          title: 'admin',
          username: 'admin',
        }),
      ],
      totalCount: 250,
    });
  },
);

test('fetchUserOptions shows a toast and returns no options on error', async () => {
  getMock.mockRejectedValue(new Error('boom'));
  const addDangerToast = jest.fn();

  const result = await fetchUserOptions('jane', 0, 100, addDangerToast);

  expect(addDangerToast).toHaveBeenCalledWith(
    'There was an error while fetching users',
  );
  expect(result).toEqual({ data: [], totalCount: 0 });
});

test('toUserSelectOption shows the email under the display name', () => {
  const option = toUserSelectOption({
    id: 7,
    username: 'jsmith',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
  });

  render(option.label);

  expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  expect(option).toMatchObject({
    value: 7,
    title: 'Jane Smith',
    textLabel: 'Jane Smith',
    subjectDetail: 'jane@example.com',
    username: 'jsmith',
  });
});

test('USER_OPTION_FILTER_PROPS covers every column the server search matches', () => {
  // The server-side user_all_text filter matches name, email and username.
  // Each must be a plain-text prop on the option, or AsyncSelect's client-side
  // re-filter hides a user the server returned.
  const option = toUserSelectOption({
    id: 7,
    username: 'jsmith',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
  });

  expect(USER_OPTION_FILTER_PROPS).toEqual([
    'textLabel',
    'subjectDetail',
    'username',
  ]);
  expect(
    USER_OPTION_FILTER_PROPS.map(prop => option[prop as keyof typeof option]),
  ).toEqual(['Jane Smith', 'jane@example.com', 'jsmith']);
});

test('toUserSelectOption falls back to the username and omits a missing email', () => {
  const option = toUserSelectOption({ id: 3, username: 'svc_reporting' });

  render(option.label);

  expect(screen.getByText('svc_reporting')).toBeInTheDocument();
  expect(option).toMatchObject({
    value: 3,
    title: 'svc_reporting',
    textLabel: 'svc_reporting',
    subjectDetail: undefined,
  });
});

test('userOptionSortComparator orders users by display name, not id', () => {
  const options = [
    toUserSelectOption({ id: 1, first_name: 'Zoe', last_name: 'Adams' }),
    toUserSelectOption({ id: 2, first_name: 'Amy', last_name: 'Young' }),
    toUserSelectOption({ id: 3, first_name: 'Max', last_name: 'Ng' }),
  ];

  expect(
    [...options]
      .sort((a, b) => userOptionSortComparator(a, b))
      .map(o => o.value),
  ).toEqual([2, 3, 1]);
  // With a search term, names containing it rank first
  expect(
    [...options]
      .sort((a, b) => userOptionSortComparator(a, b, 'ad'))
      .map(o => o.value),
  ).toEqual([1, 2, 3]);
});

test('fetchUserOptions URL-encodes reserved characters in the search term', async () => {
  mockUsersResponse([]);

  await fetchUserOptions('jane+ops&co', 0, 100, jest.fn());

  expect(decodeQuery().filters).toEqual([
    { col: 'username', opr: 'user_all_text', value: 'jane+ops&co' },
  ]);
});
