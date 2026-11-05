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
import {
  render,
  screen,
  userEvent,
  within,
} from 'spec/helpers/testing-library';
import { EncryptedExtraExpiration } from '../types';
import StoredSecretExpiryAlert from './StoredSecretExpiryAlert';

const EXPIRED = { expires_at: '2026-11-03T12:00:00+00:00', expired: true };
const expirations = { '$.connect_args.jwt': EXPIRED };
const sensitiveFields = { '$.connect_args.jwt': 'JWT Token' };
const ACTION = 'Paste a new token into Secure extra and click Finish.';

// Noon UTC is 07:00 on Nov 5 under the jest timezone, America/New_York.
const NOW = new Date('2026-11-05T12:00:00Z');

const expiring = (expiresAt: string) => ({
  expires_at: expiresAt,
  expired: false,
});

const renderAlert = (
  entries: Record<string, EncryptedExtraExpiration>,
  labels: Record<string, string> = sensitiveFields,
  onGoToSecureExtra = jest.fn(),
) =>
  render(
    <StoredSecretExpiryAlert
      isEditMode
      sensitiveFields={labels}
      expirations={entries}
      onGoToSecureExtra={onGoToSecureExtra}
    />,
  );

const renderAtNow = (
  entries: Record<string, EncryptedExtraExpiration>,
  labels?: Record<string, string>,
) => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  renderAlert(entries, labels);
};

const renderExpiringAt = (expiresAt: string) =>
  renderAtNow({ '$.connect_args.jwt': expiring(expiresAt) });

const lineTexts = () =>
  within(screen.getByRole('alert'))
    .getAllByText(/^The stored /)
    .map(line => line.textContent);

afterEach(() => {
  jest.useRealTimers();
});

test('the expiry warning renders in edit mode', () => {
  renderAlert(expirations);

  expect(lineTexts()).toEqual(['The stored JWT Token expired on Nov 3, 2026.']);
});

test('no expiry warning in create mode', () => {
  render(
    <StoredSecretExpiryAlert
      isEditMode={false}
      sensitiveFields={sensitiveFields}
      expirations={expirations}
      onGoToSecureExtra={jest.fn()}
    />,
  );

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('a secret without a declared label is named by its path', () => {
  renderAlert(expirations, {});

  expect(lineTexts()).toEqual([
    'The stored connect_args.jwt expired on Nov 3, 2026.',
  ]);
});

test('days left count calendar days, not periods of 24 hours', () => {
  renderExpiringAt('2026-11-10T13:00:00Z');

  expect(screen.getByRole('alert')).toHaveTextContent(
    'The stored JWT Token expires in 5 days (Nov 10, 2026).',
  );
});

test('a token expiring later the same day says the time it expires today', () => {
  renderExpiringAt('2026-11-05T22:50:00Z');

  expect(lineTexts()).toEqual([
    'The stored JWT Token expires today at 5:50 PM.',
  ]);
});

test('a token 8 calendar days away does not warn, even under 8 days of hours', () => {
  // Nov 13 at 00:30 in New York, 7 days and 17.5 hours ahead.
  renderExpiringAt('2026-11-13T05:30:00Z');

  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('the alert is an error when any listed token has expired', () => {
  renderAtNow({
    '$.connect_args.jwt': EXPIRED,
    '$.connect_args.password': expiring('2026-11-10T13:00:00Z'),
  });

  expect(screen.getByRole('alert')).toHaveClass('ant-alert-error');
  expect(screen.getByRole('alert')).not.toHaveClass('ant-alert-warning');
});

test('the alert is a warning when no listed token has expired', () => {
  renderExpiringAt('2026-11-10T13:00:00Z');

  expect(screen.getByRole('alert')).toHaveClass('ant-alert-warning');
  expect(screen.getByRole('alert')).not.toHaveClass('ant-alert-error');
});

test('tokens sharing a label are told apart by their path, expired first', () => {
  renderAtNow(
    {
      '$.connect_args.requests_kwargs.jwt': expiring('2026-11-10T13:00:00Z'),
      '$.auth_params.token': EXPIRED,
    },
    {
      '$.auth_params.token': 'JWT Token',
      '$.connect_args.requests_kwargs.jwt': 'JWT Token',
    },
  );

  expect(lineTexts()).toEqual([
    'The stored JWT Token (auth_params.token) expired on Nov 3, 2026.',
    'The stored JWT Token (connect_args.requests_kwargs.jwt) expires in 5 days (Nov 10, 2026).',
  ]);
});

test('tokens with distinct labels keep their bare labels', () => {
  renderAtNow(
    {
      '$.a': EXPIRED,
      '$.b': expiring('2026-11-06T13:00:00Z'),
      '$.c': expiring('2026-11-10T13:00:00Z'),
    },
    { '$.a': 'Access token', '$.b': 'Refresh token', '$.c': 'JWT Token' },
  );

  expect(lineTexts()).toEqual([
    'The stored Access token expired on Nov 3, 2026.',
    'The stored Refresh token expires in 1 day (Nov 6, 2026).',
    'The stored JWT Token expires in 5 days (Nov 10, 2026).',
  ]);
});

test('lines list expired tokens first, each group by expiry date', () => {
  renderAtNow(
    {
      '$.d': expiring('2026-11-10T13:00:00Z'),
      '$.b': { expires_at: '2026-11-04T12:00:00+00:00', expired: true },
      '$.c': expiring('2026-11-06T13:00:00Z'),
      '$.a': { expires_at: '2026-11-02T12:00:00+00:00', expired: true },
    },
    { '$.a': 'A', '$.b': 'B', '$.c': 'C', '$.d': 'D' },
  );

  expect(lineTexts()).toEqual([
    'The stored A expired on Nov 2, 2026.',
    'The stored B expired on Nov 4, 2026.',
    'The stored C expires in 1 day (Nov 6, 2026).',
    'The stored D expires in 5 days (Nov 10, 2026).',
  ]);
});

test('the action line shows once, and its link goes to Secure extra', async () => {
  const onGoToSecureExtra = jest.fn();
  renderAlert(
    {
      '$.connect_args.jwt': EXPIRED,
      '$.connect_args.password': {
        expires_at: '2026-11-04T12:00:00+00:00',
        expired: true,
      },
    },
    {
      '$.connect_args.jwt': 'JWT Token',
      '$.connect_args.password': 'Password',
    },
    onGoToSecureExtra,
  );

  const alert = screen.getByRole('alert');
  expect(within(alert).getAllByText(ACTION)).toHaveLength(1);
  expect(alert).not.toHaveTextContent('and save');

  await userEvent.click(
    within(alert).getByRole('button', { name: 'Go to Secure extra' }),
  );

  expect(onGoToSecureExtra).toHaveBeenCalledTimes(1);
});

test('a token the browser clock passed but the server did not expire is listed as expiring today', () => {
  renderExpiringAt('2026-11-05T10:00:00Z');

  expect(lineTexts()).toEqual([
    'The stored JWT Token expires today at 5:00 AM.',
  ]);
  expect(screen.getByRole('alert')).toHaveClass('ant-alert-warning');
});
