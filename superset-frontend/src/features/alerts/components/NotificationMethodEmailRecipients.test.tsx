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
// Unlike NotificationMethod.test.tsx, this file intentionally renders the
// real AsyncSelect so it can catch regressions in the interaction between
// the alerts CSS and the antd Select internals.
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { NotificationMethod } from './NotificationMethod';
import { NotificationMethodOption, NotificationSetting } from '../types';

const RELATED_USERS_ENDPOINT = 'glob:*/api/v1/report/related/created_by?*';

const emailSetting: NotificationSetting = {
  method: NotificationMethodOption.Email,
  recipients: '',
  options: [NotificationMethodOption.Email, NotificationMethodOption.Slack],
};

const renderComponent = () =>
  render(
    <NotificationMethod
      setting={emailSetting}
      index={0}
      onUpdate={jest.fn()}
      onRemove={jest.fn()}
      onInputChange={jest.fn()}
      email_subject=""
      defaultSubject=""
      setErrorSubject={jest.fn()}
    />,
  );

fetchMock.get(RELATED_USERS_ENDPOINT, {
  result: [
    {
      text: 'Admin User',
      value: 1,
      extra: { email: 'admin@example.com', active: true },
    },
  ],
  count: 1,
});

test('typed email stays visible in the recipients field and becomes an option', async () => {
  renderComponent();

  const input = screen.getByRole('combobox', { name: 'Email recipients' });
  await userEvent.click(input);
  // AsyncSelect debounces its search handler and cancels the pending call
  // whenever it re-renders, so wait for the initial options fetch to settle
  // (its option is visible) before typing to guarantee the search is
  // processed.
  await screen.findByRole('option', {
    name: /Admin User <admin@example\.com>/,
  });
  await userEvent.type(input, 'joe@example.com');

  expect(input).toHaveValue('joe@example.com');
  await waitFor(() =>
    expect(
      screen.getByRole('option', { name: /joe@example\.com/ }),
    ).toBeInTheDocument(),
  );
});

test('alerts CSS does not override the width of antd Select internals', () => {
  // The email recipient selector once used an `.email-recipient-select > div`
  // rule written for the antd v5 DOM. In the antd v6 DOM that rule matched
  // `.ant-select-content` instead, collapsing it (and the search input) to
  // zero width, so typed recipient emails were invisible.
  const { container } = renderComponent();

  const select = container.querySelector('.email-recipient-select');
  expect(select).toBeInTheDocument();

  const internalDivs = Array.from(select!.querySelectorAll(':scope > div'));
  expect(internalDivs.length).toBeGreaterThan(0);
  internalDivs.forEach(div => {
    expect(getComputedStyle(div).width).not.toBe('100%');
  });
});
