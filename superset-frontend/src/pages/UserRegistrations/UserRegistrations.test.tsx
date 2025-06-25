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

import fetchMock from 'fetch-mock';
import { render, screen } from 'spec/helpers/testing-library';
import UserRegistrations from '.';

const userRegistrationsEndpoint = 'glob:*/security/user_registrations/?*';

const mockUserRegistrations = [...new Array(5)].map((_, i) => ({
  id: i,
  username: `user${i}`,
  first_name: `User${i}`,
  last_name: `Test${i}`,
  email: `user${i}@test.com`,
  registration_date: new Date(2025, 2, 25, 11, 4, 32 + i).toISOString(),
  registration_hash: `hash${i}`,
}));

fetchMock.get(userRegistrationsEndpoint, {
  ids: [0, 1, 2, 3, 4],
  count: 5,
  result: mockUserRegistrations,
});

describe('UserRegistrations', () => {
  beforeEach(() => {
    render(<UserRegistrations />, {
      useRedux: true,
      useRouter: true,
      useQueryParams: true,
    });
  });
  it('fetches and renders user registrations', async () => {
    expect(await screen.findByText('User registrations')).toBeVisible();
    const calls = fetchMock.calls(userRegistrationsEndpoint);
    expect(calls.length).toBeGreaterThan(0);
  });
});
