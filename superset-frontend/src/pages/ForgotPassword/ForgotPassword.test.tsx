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
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import ForgotPassword, { PASSWORD_RECOVERY_ENDPOINT } from './index';

const endpoint = `glob:*${PASSWORD_RECOVERY_ENDPOINT}`;

jest.mock('src/utils/pathUtils', () => ({
  ensureAppRoot: (path: string) => path,
}));

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

const submitEmail = async (email: string) => {
  render(<ForgotPassword />);
  await userEvent.type(screen.getByTestId('email-input'), email);
  await userEvent.click(screen.getByTestId('send-reset-link-button'));
};

test('posts the email to the password recovery endpoint', async () => {
  fetchMock.post(endpoint, { status: 200, body: { message: 'ok' } });
  await submitEmail('jane@example.com');

  await screen.findByTestId('forgot-password-sent');
  const [call] = fetchMock.callHistory.calls(endpoint);
  expect(JSON.parse(call.options?.body as string)).toEqual({
    email: 'jane@example.com',
  });
});

test('shows the confirmation after a successful request', async () => {
  fetchMock.post(endpoint, {
    status: 200,
    body: { message: 'Server says sent' },
  });
  await submitEmail('jane@example.com');

  expect(await screen.findByText('Check your email')).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
  expect(
    screen.getByText(/If an account exists for that email address/),
  ).toBeInTheDocument();
  // The server's own text is never shown; the confirmation reads the same
  // for every address.
  expect(screen.queryByText('Server says sent')).not.toBeInTheDocument();
  expect(screen.getByTestId('back-to-login-button')).toHaveAttribute(
    'href',
    '/login/',
  );
});

test.each([
  [
    'a malformed-request error',
    { status: 400, body: { message: 'Bad' } },
    'Bad',
  ],
  [
    'a disabled feature',
    { status: 404, body: { message: 'Not found' } },
    'Not found',
  ],
  [
    'a server error',
    { status: 500, body: { message: 'SMTP exploded' } },
    'SMTP exploded',
  ],
])(
  'keeps the form and shows a generic error after %s',
  async (_, response, serverText) => {
    fetchMock.post(endpoint, response, { repeat: 1 });
    fetchMock.post(endpoint, { status: 200, body: {} });
    await submitEmail('jane@example.com');

    // No email went out, so the confirmation would leave the user waiting
    // for a link that never arrives. The endpoint answers 200 for known and
    // unknown addresses alike, so a failure carries no account information
    // and can be shown as such; the server's own text still stays hidden.
    expect(
      await screen.findByText('Something went wrong. Please try again later.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
    expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
    expect(screen.queryByText(serverText)).not.toBeInTheDocument();

    // The address is still in the field, so the user can simply retry.
    await userEvent.click(screen.getByTestId('send-reset-link-button'));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(2);
  },
);

test('keeps the form and shows a generic error when the request never reaches the server', async () => {
  // SupersetClient retries a thrown fetch three times, a second apart,
  // before giving up, so every attempt has to fail for the error to surface.
  fetchMock.post(
    endpoint,
    { throws: new TypeError('Failed to fetch') },
    { repeat: 4 },
  );
  fetchMock.post(endpoint, { status: 200, body: {} });
  await submitEmail('jane@example.com');

  expect(
    await screen.findByText(
      'Something went wrong. Please try again later.',
      {},
      { timeout: 6000 },
    ),
  ).toBeInTheDocument();
  expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
  expect(screen.queryByText('Check your email')).not.toBeInTheDocument();

  await userEvent.click(screen.getByTestId('send-reset-link-button'));
  expect(await screen.findByText('Check your email')).toBeInTheDocument();
}, 15000);

test('asks the user to retry later when rate limited', async () => {
  fetchMock.post(endpoint, { status: 429, body: {} });
  await submitEmail('jane@example.com');

  expect(
    await screen.findByText('Too many requests. Please wait and try again.'),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
  expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
  expect(screen.queryByText('Check your email')).not.toBeInTheDocument();
});

test('validates the email before sending anything', async () => {
  fetchMock.post(endpoint, { status: 200, body: {} });
  await submitEmail('not-an-email');

  expect(
    await screen.findByText('Please enter a valid email'),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(0);
});
