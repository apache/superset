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
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { GroupListAddModal } from './GroupListModal';
import { fetchUserOptions, toUserSelectOption } from './utils';

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  fetchUserOptions: jest.fn(),
}));

jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (Component: unknown) => Component,
  useToasts: () => ({ addDangerToast: jest.fn(), addSuccessToast: jest.fn() }),
}));

const props = {
  show: true,
  onHide: jest.fn(),
  onSave: jest.fn(),
  roles: [],
};

test('Users picker shows a user matched by email with the email under their name', async () => {
  // The server matches email, but the option label is the display name, so
  // the picker has to re-filter on the option's plain-text name and email
  // props and show the email, or the match is hidden or unexplained.
  jest
    .mocked(fetchUserOptions)
    .mockImplementation(async (filterValue: string) =>
      filterValue === 'jane@example.com'
        ? {
            data: [
              toUserSelectOption({
                id: 7,
                username: 'jsmith',
                first_name: 'Jane',
                last_name: 'Smith',
                email: 'jane@example.com',
              }),
            ],
            totalCount: 1,
          }
        : // totalCount must exceed the empty initial page here, otherwise
          // AsyncSelect marks allValuesLoaded and short-circuits every
          // later fetch, including the search request this test depends on.
          { data: [], totalCount: 1 },
    );

  render(<GroupListAddModal {...props} />);
  const combobox = screen.getByRole('combobox', { name: /users/i });
  await waitFor(() => userEvent.click(combobox));
  await userEvent.type(combobox, 'jane@example.com', { delay: 10 });

  await waitFor(() =>
    expect(fetchUserOptions).toHaveBeenCalledWith(
      'jane@example.com',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    ),
  );
  const dropdown = within(document.querySelector('.ant-select-dropdown-list')!);
  expect(await dropdown.findByText('Jane Smith')).toBeInTheDocument();
  expect(dropdown.getByText('jane@example.com')).toBeInTheDocument();
});
