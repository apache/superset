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
import { MemoryRouter, Route } from 'react-router-dom';
import type { History, Location } from 'history';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import ResetPassword, { PASSWORD_RESET_ENDPOINT } from './index';

const endpoint = `glob:*${PASSWORD_RESET_ENDPOINT}`;
const TOKEN = 'abcDEF123_-xyz';

jest.mock('src/utils/pathUtils', () => ({
  ensureAppRoot: (path: string) => path,
}));

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

const renderResetPassword = (url = `/login/reset_password/#token=${TOKEN}`) => {
  const router: { location?: Location; history?: History } = {};
  render(
    <MemoryRouter initialEntries={[url]}>
      <ResetPassword />
      <Route
        path="*"
        render={({ location, history }) => {
          router.location = location;
          router.history = history;
          return null;
        }}
      />
    </MemoryRouter>,
  );
  return router;
};

const fillAndSubmit = async (password: string, confirmation = password) => {
  await userEvent.type(screen.getByTestId('password-input'), password);
  await userEvent.type(
    screen.getByTestId('confirm-password-input'),
    confirmation,
  );
  await userEvent.click(screen.getByTestId('reset-password-button'));
};

const sentPayloads = () =>
  fetchMock.callHistory
    .calls(endpoint)
    .map(call => JSON.parse(call.options?.body as string));

test('strips the token from the URL as soon as the page opens', async () => {
  const router = renderResetPassword();

  expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
  await waitFor(() => expect(router.location?.hash).toBe(''));
  expect(router.location?.pathname).toBe('/login/reset_password/');
  expect(document.body.innerHTML).not.toContain(TOKEN);
});

test('posts the token and the new password, then sends the user to sign in', async () => {
  fetchMock.post(endpoint, { status: 200, body: { message: 'ok' } });
  renderResetPassword();
  await fillAndSubmit('N3w-Passw0rd!');

  expect(
    await screen.findByText('Your password has been reset'),
  ).toBeInTheDocument();
  expect(sentPayloads()).toEqual([{ token: TOKEN, password: 'N3w-Passw0rd!' }]);
  expect(screen.getByTestId('login-button')).toHaveAttribute('href', '/login/');
});

test('blocks submission when the confirmation does not match', async () => {
  fetchMock.post(endpoint, { status: 200, body: {} });
  renderResetPassword();
  await fillAndSubmit('N3w-Passw0rd!', 'Different-Passw0rd!');

  expect(
    await screen.findByText('Passwords do not match!'),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(0);
});

test('shows the password policy errors from the server and lets the user retry', async () => {
  fetchMock.post(
    endpoint,
    {
      status: 400,
      body: {
        message: {
          password: ['Password must be at least 12 characters long.'],
        },
      },
    },
    { repeat: 1 },
  );
  fetchMock.post(endpoint, { status: 200, body: {} });
  renderResetPassword();
  await fillAndSubmit('short');

  expect(
    await screen.findByText('Password must be at least 12 characters long.'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();

  await userEvent.clear(screen.getByTestId('password-input'));
  await userEvent.clear(screen.getByTestId('confirm-password-input'));
  await fillAndSubmit('A-much-longer-Passw0rd!');

  expect(
    await screen.findByText('Your password has been reset'),
  ).toBeInTheDocument();
  expect(sentPayloads()).toEqual([
    { token: TOKEN, password: 'short' },
    { token: TOKEN, password: 'A-much-longer-Passw0rd!' },
  ]);
});

test('shows the invalid link state when the server rejects the token', async () => {
  fetchMock.post(endpoint, {
    status: 400,
    body: {
      message: {
        token: ['This password reset link is invalid or has expired.'],
      },
    },
  });
  renderResetPassword();
  await fillAndSubmit('N3w-Passw0rd!');

  expect(
    await screen.findByTestId('reset-password-invalid-link'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('request-new-link-button')).toHaveAttribute(
    'href',
    '/login/forgot_password/',
  );
  // The way forward stands out; going back is the secondary action.
  expect(screen.getByTestId('request-new-link-button')).toHaveClass(
    'superset-button-primary',
  );
  expect(screen.getByTestId('back-to-login-button')).toHaveClass(
    'superset-button-secondary',
  );
  expect(screen.queryByTestId('reset-password-form')).not.toBeInTheDocument();
});

test('uses a new link opened in the same tab instead of the one it replaced', async () => {
  const NEW_TOKEN = 'newTOKEN456_-abc';
  fetchMock.post(
    endpoint,
    {
      status: 400,
      body: {
        message: {
          token: ['This password reset link is invalid or has expired.'],
        },
      },
    },
    { repeat: 1 },
  );
  fetchMock.post(endpoint, { status: 200, body: {} });
  const router = renderResetPassword();
  await fillAndSubmit('N3w-Passw0rd!');
  expect(
    await screen.findByTestId('reset-password-invalid-link'),
  ).toBeInTheDocument();

  // Pasting a second link into the same tab only changes the fragment, so
  // the page is not reloaded and the component stays mounted.
  act(() => {
    router.history?.push(`/login/reset_password/#token=${NEW_TOKEN}`);
  });

  expect(await screen.findByTestId('reset-password-form')).toBeInTheDocument();
  await waitFor(() => expect(router.location?.hash).toBe(''));
  await fillAndSubmit('N3w-Passw0rd!');

  expect(
    await screen.findByText('Your password has been reset'),
  ).toBeInTheDocument();
  expect(sentPayloads()).toEqual([
    { token: TOKEN, password: 'N3w-Passw0rd!' },
    { token: NEW_TOKEN, password: 'N3w-Passw0rd!' },
  ]);
});

test.each([
  ['succeeds', { status: 200, body: {} }],
  [
    'rejects the token',
    {
      status: 400,
      body: {
        message: {
          token: ['This password reset link is invalid or has expired.'],
        },
      },
    },
  ],
])(
  'ignores a late response for a link replaced while it was in flight (%s)',
  async (_, lateResponse) => {
    const NEW_TOKEN = 'newTOKEN456_-abc';
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    fetchMock.post(endpoint, () => gate.then(() => lateResponse), {
      repeat: 1,
    });
    fetchMock.post(endpoint, { status: 200, body: {} });
    const router = renderResetPassword();
    await fillAndSubmit('N3w-Passw0rd!');

    act(() => {
      router.history?.push(`/login/reset_password/#token=${NEW_TOKEN}`);
    });
    await act(async () => {
      release();
      await gate;
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    // The first link's answer must not decide the page for the second one.
    expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
    expect(screen.getByTestId('reset-password-button')).toBeEnabled();

    await fillAndSubmit('N3w-Passw0rd!');
    expect(
      await screen.findByText('Your password has been reset'),
    ).toBeInTheDocument();
    expect(sentPayloads()).toEqual([
      { token: TOKEN, password: 'N3w-Passw0rd!' },
      { token: NEW_TOKEN, password: 'N3w-Passw0rd!' },
    ]);
  },
);

test('shows the invalid link state without calling the API when the link has no token', () => {
  fetchMock.post(endpoint, { status: 200, body: {} });
  renderResetPassword('/login/reset_password/');

  expect(screen.getByTestId('reset-password-invalid-link')).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(0);
});

test('asks the user to retry later when rate limited', async () => {
  // Flask-Limiter answers with a plain-text body, not JSON.
  fetchMock.post(endpoint, {
    status: 429,
    body: 'Too Many Requests: 5 per 15 minutes',
  });
  renderResetPassword();
  await fillAndSubmit('N3w-Passw0rd!');

  expect(
    await screen.findByText('Too many requests. Please wait and try again.'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
  expect(screen.getByTestId('reset-password-button')).toBeEnabled();
});

test('shows a generic error, not the server text, on unexpected failures', async () => {
  fetchMock.post(endpoint, {
    status: 500,
    body: { message: 'Traceback: database is on fire' },
  });
  renderResetPassword();
  await fillAndSubmit('N3w-Passw0rd!');

  expect(
    await screen.findByText(
      'Your password could not be reset. Please try again later.',
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(/database is on fire/)).not.toBeInTheDocument();
  expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
});
