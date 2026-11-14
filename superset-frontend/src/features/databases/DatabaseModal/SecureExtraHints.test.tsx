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
import { StrictMode } from 'react';
import fetchMock from 'fetch-mock';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { supersetTheme } from '@apache-superset/core/theme';
import SecureExtraHints, {
  resolveMaskedSecretFields,
} from './SecureExtraHints';

const endpoint = 'glob:*/api/v1/database/7/encrypted_extra_hints/';
// antd's own toggle, labelled by its locale.
const SHOW = 'Show';
const HIDE = 'Hide';
const BULLETS = '•'.repeat(20);
const MASK = 'XXXXXXXXXX';
const ALERT = 'Could not load the stored secrets. Try again.';
const JWT_HELPER =
  'Stored at connect_args.jwt. Edits to Secure extra above are not reflected until saved.';
const PASSWORD_HELPER =
  'Stored at connect_args.password. Edits to Secure extra above are not reflected until saved.';

const jwtField = { path: '$.connect_args.jwt', label: 'JWT Token' };
const passwordField = { path: '$.connect_args.password', label: 'Password' };
const fields = [jwtField];
const twoFields = [jwtField, passwordField];

const hints = [
  {
    path: '$.connect_args.jwt',
    label: 'JWT Token',
    suffix: 'R0t8Q',
  },
  {
    path: '$.connect_args.password',
    label: 'Password',
    suffix: 'k9Zx2',
  },
];

const showButtons = () => screen.getAllByRole('button', { name: SHOW });
const hideButtons = () => screen.getAllByRole('button', { name: HIDE });
const blocks = () => screen.getAllByTestId('secure-extra-hint');
const inputs = () =>
  screen.getAllByTestId<HTMLInputElement>('secure-extra-hint-input');
const EYE_NAME = /^(Show|Hide)$/;
const eyeOf = (index: number) =>
  within(blocks()[index]).getByRole('button', { name: EYE_NAME });
const TOO_SHORT = 'Too short to show safely';
const TOO_SHORT_TIP =
  'Only the ending of secrets with at least 20 characters is shown.';
const countSlots = () =>
  document.querySelectorAll('.ant-input-show-count-suffix');
// The severity icon in a revealed field's slot, if any.
const slotIcon = (slot: Element) =>
  within(slot as HTMLElement).queryByTestId('exclamation-circle');
const TYPE_CLASSES = [
  'ant-typography-secondary',
  'ant-typography-warning',
  'ant-typography-danger',
];
const suffixChildren = (block: HTMLElement) =>
  Array.from(block.querySelector('.ant-input-suffix')?.children ?? []);

// Waits for the field showing `suffix` as text: the ending of a revealed secret.
const revealedInput = (suffix: string) =>
  waitFor(() => {
    const input = inputs().find(
      candidate => candidate.type === 'text' && candidate.value === suffix,
    );
    expect(input).toBeDefined();
    return input as HTMLInputElement;
  });
// A revealed field: its ending in clear, after the static bullets.
const expectShown = (input: HTMLInputElement, suffix: string) => {
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue(suffix);
};
// The static bullets in front of the value.
const prefixOf = (block: HTMLElement) =>
  block.querySelector('.ant-input-prefix');
// A hidden field: a password input, whatever ending it holds is masked.
const expectHidden = (input: HTMLInputElement) => {
  expect(input).toHaveAttribute('type', 'password');
};

const expectHiddenJwtField = () => {
  expect(blocks()).toHaveLength(1);
  expect(within(blocks()[0]).getByText('JWT Token')).toBeInTheDocument();
  expect(within(blocks()[0]).getByText(JWT_HELPER)).toBeInTheDocument();
  expectHidden(inputs()[0]);
  expect(inputs()[0]).toHaveValue('');
  expect(prefixOf(blocks()[0])).toHaveTextContent(BULLETS);
  expect(inputs()[0]).toHaveAttribute('readonly');
  expect(showButtons()).toHaveLength(1);
  expect(countSlots()).toHaveLength(0);
};

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
  jest.useRealTimers();
});

test('renders each declared field hidden with its final label and helper, without a request', () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  expect(screen.getByTestId('secure-extra-hints')).toBeInTheDocument();
  expectHiddenJwtField();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(0);
});

test('revealing and hiding each field logs no console errors or warnings', async () => {
  const error = jest.spyOn(console, 'error');
  const warn = jest.spyOn(console, 'warn');
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));
  await revealedInput('R0t8Q');
  await userEvent.click(eyeOf(1));
  await revealedInput('k9Zx2');
  await userEvent.click(eyeOf(0));
  await userEvent.click(eyeOf(1));
  await userEvent.click(eyeOf(0));
  await revealedInput('R0t8Q');

  expect(error).not.toHaveBeenCalled();
  expect(warn).not.toHaveBeenCalled();
  error.mockRestore();
  warn.mockRestore();
});

test('reveal changes only the value of the same input and shows no count', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);
  const [input] = inputs();
  const label = within(blocks()[0]).getByText('JWT Token');
  const helper = within(blocks()[0]).getByText(JWT_HELPER);
  const hiddenSuffix = suffixChildren(blocks()[0]);

  await userEvent.click(showButtons()[0]);

  expect(await revealedInput('R0t8Q')).toBe(input);
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
  expect(fetchMock.callHistory.lastCall(endpoint)?.url).toMatch(
    /\/api\/v1\/database\/7\/encrypted_extra_hints\/$/,
  );
  expect(inputs()[0]).toBe(input);
  expect(input).toHaveAttribute('type', 'text');
  expect(within(blocks()[0]).getByText('JWT Token')).toBe(label);
  expect(label).toHaveTextContent(/^JWT Token$/);
  expect(within(blocks()[0]).getByText(JWT_HELPER)).toBe(helper);
  expect(helper).toHaveTextContent(JWT_HELPER);
  expect(countSlots()).toHaveLength(0);
  expect(screen.queryByText(/69|characters/)).not.toBeInTheDocument();
  expect(suffixChildren(blocks()[0])).toEqual(hiddenSuffix);
  expect(hideButtons()).toHaveLength(1);
  expect(screen.queryByRole('button', { name: SHOW })).not.toBeInTheDocument();
});

test('the bullets are a static prefix and only the ending switches between masked and clear', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);
  const [input] = inputs();
  const prefix = prefixOf(blocks()[0]);
  const hiddenClass = input.className;
  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveAttribute('readonly');

  await userEvent.click(showButtons()[0]);
  await revealedInput('R0t8Q');

  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveAttribute('readonly');
  expect(input.className).toBe(hiddenClass);
  expect(prefixOf(blocks()[0])).toBe(prefix);
  expect(prefix).toHaveTextContent(BULLETS);
  expect(prefix?.firstElementChild).toHaveAttribute('aria-hidden', 'true');

  await userEvent.click(hideButtons()[0]);

  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveValue('');
  expect(prefixOf(blocks()[0])).toBe(prefix);
});

test('clicking the first eye reveals only that field and the other stays bullets', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));

  expect(await revealedInput('R0t8Q')).toBe(inputs()[0]);
  expectHidden(inputs()[1]);
  expect(inputs()[1]).toHaveValue('');
  expect(within(blocks()[1]).getByText('Password')).toBeInTheDocument();
  expect(within(blocks()[1]).getByText(PASSWORD_HELPER)).toBeInTheDocument();
  expect(document.body.innerHTML).not.toContain('k9Zx2');
  expect(countSlots()).toHaveLength(0);
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('the second eye reveals its field from the loaded hints without a second request', async () => {
  fetchMock.get(endpoint, { result: [...hints].reverse() });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(1));
  expect(await revealedInput('k9Zx2')).toBe(inputs()[1]);
  expectHidden(inputs()[0]);

  await userEvent.click(eyeOf(0));

  expect(await revealedInput('R0t8Q')).toBe(inputs()[0]);
  expectShown(inputs()[1], 'k9Zx2');
  expect(hideButtons()).toHaveLength(2);
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('hiding one field keeps the other revealed', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));
  await revealedInput('R0t8Q');
  await userEvent.click(eyeOf(1));
  await revealedInput('k9Zx2');
  await userEvent.click(eyeOf(0));

  expectHidden(inputs()[0]);
  expectShown(inputs()[1], 'k9Zx2');
  expect(eyeOf(0)).toHaveAccessibleName(SHOW);
  expect(eyeOf(1)).toHaveAccessibleName(HIDE);
  expect(document.body.innerHTML).not.toContain('R0t8Q');
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('a revealed field removed from the editor and added back comes back hidden', async () => {
  fetchMock.get(endpoint, { result: hints });
  const { rerender } = render(
    <SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />,
  );
  await userEvent.click(eyeOf(0));
  await revealedInput('R0t8Q');

  rerender(
    <SecureExtraHints databaseId={7} minLength={20} fields={[passwordField]} />,
  );
  expect(blocks()).toHaveLength(1);
  expect(document.body.innerHTML).not.toContain('R0t8Q');

  rerender(
    <SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />,
  );
  expect(blocks()).toHaveLength(2);
  expectHidden(inputs()[0]);
  expect(inputs()[0]).toHaveValue('');
  expect(eyeOf(0)).toHaveAccessibleName(SHOW);
  expect(document.body.innerHTML).not.toContain('R0t8Q');
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('each field has exactly one eye, labelled by its own state', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);
  blocks().forEach(block =>
    expect(within(block).getAllByRole('button')).toHaveLength(1),
  );
  expect(eyeOf(0)).toHaveAccessibleName(SHOW);
  expect(eyeOf(0)).toHaveAttribute('aria-pressed', 'false');
  expect(eyeOf(1)).toHaveAccessibleName(SHOW);

  await userEvent.click(eyeOf(0));
  await revealedInput('R0t8Q');

  blocks().forEach(block =>
    expect(within(block).getAllByRole('button')).toHaveLength(1),
  );
  expect(eyeOf(0)).toHaveAccessibleName(HIDE);
  expect(eyeOf(0)).toHaveAttribute('aria-pressed', 'true');
  expect(eyeOf(1)).toHaveAccessibleName(SHOW);
  expect(screen.queryByText(/stored secret\./)).not.toBeInTheDocument();
  expect(document.body.innerHTML).not.toMatch(/(Show|Hide) stored secret/);
});

test('a hint without a suffix shows bullets and says it is too short, without a number', async () => {
  fetchMock.get(endpoint, {
    result: [{ ...hints[0], suffix: null }],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  const note = await screen.findByText(TOO_SHORT);
  expect(countSlots()).toHaveLength(1);
  expect(countSlots()[0]).toHaveTextContent(new RegExp(`^${TOO_SHORT}$`));
  expect(screen.queryByText(/3 characters/)).not.toBeInTheDocument();
  expect(note).toBeInTheDocument();
  expectShown(inputs()[0], '');
  expect(prefixOf(blocks()[0])).toHaveTextContent(BULLETS);
  expect(within(blocks()[0]).getByText(JWT_HELPER)).toBeInTheDocument();
});

test('hovering the too short note explains the minimum length', async () => {
  fetchMock.get(endpoint, {
    result: [{ ...hints[0], suffix: null }],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);
  await userEvent.hover(await screen.findByText(TOO_SHORT));

  expect(
    (await screen.findByText(TOO_SHORT_TIP)).closest('[role="tooltip"]'),
  ).toBeInTheDocument();
});

test('a field without a matching hint says not available', async () => {
  fetchMock.get(endpoint, { result: [hints[1]] });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  expect(await screen.findByText('Not available')).toBeInTheDocument();
  expectShown(inputs()[0], '');
  expect(within(blocks()[0]).getByText(JWT_HELPER)).toBeInTheDocument();
});

const EXPIRY_TIP = "Read from the token's exp claim.";
const expiringHint = {
  ...hints[0],
  expires_at: '2026-12-12T12:00:00+00:00',
  expired: false,
};
const expiredHint = {
  ...hints[0],
  expires_at: '2026-11-03T12:00:00+00:00',
  expired: true,
};

// Pins the clock to noon UTC on Nov 5, 2026 (07:00 in the jest timezone).
const pinClock = () => {
  jest.useFakeTimers({ advanceTimers: true });
  jest.setSystemTime(new Date('2026-11-05T12:00:00Z'));
};

test('a revealed JWT says when it expires in secondary text', async () => {
  pinClock();
  fetchMock.get(endpoint, { result: [expiringHint, hints[1]] });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));

  const expiry = await screen.findByText('Expires Dec 12, 2026');
  expect(countSlots()).toHaveLength(1);
  expect(countSlots()[0]).toHaveTextContent(/^Expires Dec 12, 2026$/);
  expect(within(blocks()[0]).getByText('Expires Dec 12, 2026')).toBe(expiry);
  expect(expiry).toHaveClass('ant-typography-secondary');
  expect(expiry).not.toHaveClass('ant-typography-danger');
  expect(slotIcon(countSlots()[0])).not.toBeInTheDocument();
  expectShown(inputs()[0], 'R0t8Q');
});

test('a revealed expired JWT says when it expired in danger text after an error icon', async () => {
  fetchMock.get(endpoint, { result: [expiredHint] });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  const expiry = await screen.findByText('Expired Nov 3, 2026');
  expect(countSlots()[0]).toHaveTextContent(/^Expired Nov 3, 2026$/);
  expect(expiry).toHaveClass('ant-typography-danger');
  expect(slotIcon(countSlots()[0])).toHaveStyle({
    color: supersetTheme.colorError,
  });
  expect(screen.queryByText(/^Expires/)).not.toBeInTheDocument();
});

test('a revealed JWT expiring within 7 days says so in default text after a warning icon', async () => {
  pinClock();
  fetchMock.get(endpoint, {
    result: [{ ...expiringHint, expires_at: '2026-11-08T12:00:00+00:00' }],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  const expiry = await screen.findByText('Expires Nov 8, 2026');
  expect(expiry).toHaveClass('ant-typography');
  TYPE_CLASSES.forEach(type => expect(expiry).not.toHaveClass(type));
  const icon = slotIcon(countSlots()[0]);
  expect(icon).toHaveStyle({ color: supersetTheme.colorWarning });
  expect(icon).toHaveAttribute('aria-hidden', 'true');
});

test('a revealed JWT the browser clock passed 2 hours ago, not expired on the server, warns', async () => {
  pinClock();
  fetchMock.get(endpoint, {
    result: [
      {
        ...expiringHint,
        expires_at: '2026-11-05T10:00:00+00:00',
        expired: false,
      },
    ],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  const expiry = await screen.findByText('Expires Nov 5, 2026');
  TYPE_CLASSES.forEach(type => expect(expiry).not.toHaveClass(type));
  expect(slotIcon(countSlots()[0])).toHaveStyle({
    color: supersetTheme.colorWarning,
  });
});

test('a revealed JWT the browser clock passed yesterday, not expired on the server, warns', async () => {
  pinClock();
  fetchMock.get(endpoint, {
    result: [
      {
        ...expiringHint,
        expires_at: '2026-11-04T12:00:00+00:00',
        expired: false,
      },
    ],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  const expiry = await screen.findByText('Expires Nov 4, 2026');
  TYPE_CLASSES.forEach(type => expect(expiry).not.toHaveClass(type));
  expect(slotIcon(countSlots()[0])).toHaveStyle({
    color: supersetTheme.colorWarning,
  });
});

test('a revealed JWT with an unreadable expiry date shows no expiry', async () => {
  fetchMock.get(endpoint, {
    result: [{ ...expiringHint, expires_at: 'not a date', expired: false }],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  await revealedInput('R0t8Q');
  expect(countSlots()).toHaveLength(0);
  expect(screen.queryByText(/^Expire/)).not.toBeInTheDocument();
});

test('a revealed JWT expiring in 60 days keeps the secondary colour', async () => {
  pinClock();
  fetchMock.get(endpoint, {
    result: [{ ...expiringHint, expires_at: '2027-01-04T12:00:00+00:00' }],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  const expiry = await screen.findByText('Expires Jan 4, 2027');
  expect(expiry).toHaveClass('ant-typography-secondary');
  expect(expiry).not.toHaveClass('ant-typography-warning');
  expect(slotIcon(countSlots()[0])).not.toBeInTheDocument();
});

test('a revealed secret without an expiry leaves the slot empty', async () => {
  fetchMock.get(endpoint, {
    result: [{ ...hints[0], expires_at: null, expired: null }],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  await revealedInput('R0t8Q');
  expect(countSlots()).toHaveLength(0);
  expect(screen.queryByText(/^Expire/)).not.toBeInTheDocument();
});

test('hovering the expiry says it is read from the exp claim', async () => {
  fetchMock.get(endpoint, { result: [expiringHint] });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);
  await userEvent.hover(await screen.findByText('Expires Dec 12, 2026'));

  expect(
    (await screen.findByText(EXPIRY_TIP)).closest('[role="tooltip"]'),
  ).toBeInTheDocument();
});

test('a withheld ending still shows the expiry next to the too-short note', async () => {
  fetchMock.get(endpoint, {
    result: [{ ...expiringHint, suffix: null }],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  await screen.findByText('Too short');
  expect(countSlots()).toHaveLength(1);
  expect(countSlots()[0]).toHaveTextContent(/^Too shortExpires Dec 12, 2026$/);
  expect(inputs()[0]).toHaveValue('');
  await userEvent.hover(screen.getByText('Too short'));
  expect(await screen.findByText(TOO_SHORT_TIP)).toBeInTheDocument();
});

test('a withheld ending of an expired secret still shows it expired', async () => {
  fetchMock.get(endpoint, {
    result: [{ ...expiredHint, suffix: null }],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  await screen.findByText('Too short');
  expect(countSlots()[0]).toHaveTextContent(/^Too shortExpired Nov 3, 2026$/);
  expect(inputs()[0]).toHaveValue('');
});

test('hiding a JWT drops its expiry', async () => {
  fetchMock.get(endpoint, { result: [expiringHint] });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);
  await screen.findByText('Expires Dec 12, 2026');
  await userEvent.click(hideButtons()[0]);

  expect(countSlots()).toHaveLength(0);
  expect(screen.queryByText(/^Expire/)).not.toBeInTheDocument();
});

test('a failed first eye warns under its field only and the second eye can still fetch', async () => {
  fetchMock.get(endpoint, 500);
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(ALERT);
  expect(within(alert).queryByRole('button')).toBeNull();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(blocks()[0]).toContainElement(alert);
  expect(blocks()[1]).not.toContainElement(alert);
  expectHidden(inputs()[0]);
  expectHidden(inputs()[1]);
  expect(showButtons()).toHaveLength(2);
  expect(eyeOf(1)).toBeEnabled();

  fetchMock.removeRoutes().get(endpoint, { result: hints });
  await userEvent.click(eyeOf(1));

  expect(await revealedInput('k9Zx2')).toBe(inputs()[1]);
  expectHidden(inputs()[0]);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(2);
});

test('a failed second eye warns under the second field and retries from that eye', async () => {
  fetchMock.get(endpoint, 500);
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(1));

  const alert = await screen.findByRole('alert');
  expect(blocks()[1]).toContainElement(alert);
  expect(blocks()[0]).not.toContainElement(alert);
  expect(eyeOf(1)).toHaveAccessibleName(SHOW);
  expect(eyeOf(1)).toBeEnabled();

  fetchMock.removeRoutes().get(endpoint, { result: hints });
  await userEvent.click(eyeOf(1));

  expect(await revealedInput('k9Zx2')).toBe(inputs()[1]);
  expectHidden(inputs()[0]);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(2);
});

test('only the eye that started the request shows the loading state', async () => {
  let respond: (value: object) => void = () => {};
  fetchMock.get(
    endpoint,
    new Promise(resolve => {
      respond = resolve;
    }),
  );
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));

  expect(
    within(blocks()[0]).getByRole('img', { name: 'loading' }),
  ).toBeInTheDocument();
  expect(
    within(blocks()[1]).queryByRole('img', { name: 'loading' }),
  ).not.toBeInTheDocument();
  expect(countSlots()[0]).toContainElement(
    within(blocks()[0]).getByRole('img', { name: 'loading' }),
  );
  expect(eyeOf(0)).toBeVisible();
  expect(within(eyeOf(0)).getByRole('img', { name: 'eye' })).toBeVisible();
  expect(eyeOf(1)).toHaveAccessibleName(SHOW);

  respond({ result: hints });
  expect(await revealedInput('R0t8Q')).toBe(inputs()[0]);
  expectHidden(inputs()[1]);
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('a second eye clicked while the request is pending also loads and both reveal from one request', async () => {
  let respond: (value: object) => void = () => {};
  fetchMock.get(
    endpoint,
    new Promise(resolve => {
      respond = resolve;
    }),
  );
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));
  await userEvent.click(eyeOf(1));

  expect(
    within(blocks()[0]).getByRole('img', { name: 'loading' }),
  ).toBeInTheDocument();
  expect(
    within(blocks()[1]).getByRole('img', { name: 'loading' }),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);

  respond({ result: hints });
  expect(await revealedInput('R0t8Q')).toBe(inputs()[0]);
  expectShown(inputs()[1], 'k9Zx2');
  expect(hideButtons()).toHaveLength(2);
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('a double click while pending sends one request', async () => {
  let respond: (value: object) => void = () => {};
  fetchMock.get(
    endpoint,
    new Promise(resolve => {
      respond = resolve;
    }),
  );
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);
  await userEvent.dblClick(showButtons()[0]);

  expect(screen.getByRole('img', { name: 'loading' })).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);

  respond({ result: hints });
  expect(await revealedInput('R0t8Q')).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

// Both clicks land before the rerender that disables the button.
test('two clicks in the same task send one request', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);
  const [eye] = showButtons();

  act(() => {
    eye.click();
    eye.click();
  });

  expect(await revealedInput('R0t8Q')).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('hiding every field restores the hidden values and drops the suffixes and the count', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));
  await revealedInput('R0t8Q');
  await userEvent.click(eyeOf(1));
  await revealedInput('k9Zx2');
  await userEvent.click(eyeOf(1));
  await userEvent.click(eyeOf(0));

  inputs().forEach(input => {
    expectHidden(input);
    expect(input).toHaveValue('');
  });
  expect(showButtons()).toHaveLength(2);
  expect(countSlots()).toHaveLength(0);
  expect(within(blocks()[0]).getByText('JWT Token')).toBeInTheDocument();
  expect(within(blocks()[0]).getByText(JWT_HELPER)).toBeInTheDocument();
  expect(within(blocks()[1]).getByText(PASSWORD_HELPER)).toBeInTheDocument();
  expect(document.body.innerHTML).not.toContain('R0t8Q');
  expect(document.body.innerHTML).not.toContain('k9Zx2');
});

test('revealing again after hide reuses the loaded hints', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);
  await revealedInput('R0t8Q');
  await userEvent.click(hideButtons()[0]);
  expectHidden(inputs()[0]);

  await userEvent.click(showButtons()[0]);

  expect(await revealedInput('R0t8Q')).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('a remount after a reveal starts hidden and fetches again', async () => {
  fetchMock.get(endpoint, { result: hints });
  const { unmount } = render(
    <SecureExtraHints databaseId={7} minLength={20} fields={fields} />,
  );

  await userEvent.click(showButtons()[0]);
  await revealedInput('R0t8Q');
  unmount();

  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  expectHiddenJwtField();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);

  await userEvent.click(showButtons()[0]);

  expect(await revealedInput('R0t8Q')).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(2);
});

test('reveal works when effects run twice, as in strict mode', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(
    <StrictMode>
      <SecureExtraHints databaseId={7} minLength={20} fields={fields} />
    </StrictMode>,
  );

  await userEvent.click(showButtons()[0]);

  expect(await revealedInput('R0t8Q')).toBeInTheDocument();
});

// The container's text input rule would draw a second border inside the field.
test('a revealed input draws no border of its own inside the field', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);
  await revealedInput('R0t8Q');

  expect(inputs()[0].style.borderWidth).toBe('0px');
  expect(inputs()[0].style.padding).toBe('0px');
});

// Inter's contextual alternates restyle the bullets next to the suffix.
test('the bullets keep their glyphs when the suffix follows them', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  expect(inputs()[0].style.fontVariantLigatures).toBe('no-contextual');

  await userEvent.click(showButtons()[0]);
  await revealedInput('R0t8Q');

  expect(inputs()[0].style.fontVariantLigatures).toBe('no-contextual');
});

test('keyboard: Tab reaches the first eye, Enter reveals and hides its field, focus stays on it', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.tab();
  expect(inputs()[0]).toHaveFocus();
  await userEvent.tab();
  const eye = eyeOf(0);
  expect(eye).toHaveFocus();
  expect(within(blocks()[0]).getAllByRole('button')).toEqual([eye]);

  await userEvent.keyboard('{Enter}');
  await revealedInput('R0t8Q');
  expect(eyeOf(0)).toBe(eye);
  expect(eye).toHaveAccessibleName(HIDE);
  expect(document.activeElement).toBe(eye);
  expectHidden(inputs()[1]);
  expect(eyeOf(1)).toHaveAccessibleName(SHOW);

  await userEvent.keyboard('{Enter}');
  expectHidden(inputs()[0]);
  expect(eyeOf(0)).toBe(eye);
  expect(eye).toHaveAccessibleName(SHOW);
  expect(document.activeElement).toBe(eye);
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('resolveMaskedSecretFields matches a dotted path', () => {
  expect(
    resolveMaskedSecretFields(
      JSON.stringify({ connect_args: { jwt: MASK, host: 'h' } }),
      { '$.connect_args.jwt': 'JWT Token' },
    ),
  ).toEqual([{ path: '$.connect_args.jwt', label: 'JWT Token' }]);
});

test('resolveMaskedSecretFields expands a wildcard to the masked keys only', () => {
  expect(
    resolveMaskedSecretFields(JSON.stringify({ a: MASK, b: 1 }), {
      '$.*': 'Encrypted Extra',
    }),
  ).toEqual([{ path: '$.a', label: 'Encrypted Extra' }]);
});

test('resolveMaskedSecretFields expands a nested wildcard', () => {
  expect(
    resolveMaskedSecretFields(
      JSON.stringify({
        auth: { one: { token: MASK }, two: { token: 'plain' }, three: 4 },
      }),
      { '$.auth.*.token': 'Token' },
    ),
  ).toEqual([{ path: '$.auth.one.token', label: 'Token' }]);
});

test('resolveMaskedSecretFields ignores values that are not the mask', () => {
  expect(
    resolveMaskedSecretFields(
      JSON.stringify({
        connect_args: { jwt: 'XXXXXXXXXXX', password: { v: MASK } },
      }),
      { '$.connect_args.jwt': 'JWT', '$.connect_args.password': 'Password' },
    ),
  ).toEqual([]);
});

test('resolveMaskedSecretFields returns no fields for non-object or invalid JSON and missing paths', () => {
  const declared = { '$.connect_args.jwt': 'JWT Token', '$.*': 'Any' };
  expect(resolveMaskedSecretFields('"XXXXXXXXXX"', declared)).toEqual([]);
  expect(resolveMaskedSecretFields('[1, 2]', declared)).toEqual([]);
  expect(resolveMaskedSecretFields('null', declared)).toEqual([]);
  expect(resolveMaskedSecretFields('{"connect_args": ', declared)).toEqual([]);
  expect(resolveMaskedSecretFields(undefined, declared)).toEqual([]);
  expect(
    resolveMaskedSecretFields(JSON.stringify({ other: { jwt: 'x' } }), {
      '$.connect_args.jwt': 'JWT Token',
    }),
  ).toEqual([]);
});

test('resolveMaskedSecretFields follows the declared order', () => {
  expect(
    resolveMaskedSecretFields(
      JSON.stringify({
        connect_args: { jwt: MASK, password: MASK },
        oauth2_client_info: { secret: MASK },
      }),
      {
        '$.oauth2_client_info.secret': 'OAuth2 client secret',
        '$.connect_args.password': 'Password',
        '$.connect_args.jwt': 'JWT Token',
      },
    ),
  ).toEqual([
    { path: '$.oauth2_client_info.secret', label: 'OAuth2 client secret' },
    { path: '$.connect_args.password', label: 'Password' },
    { path: '$.connect_args.jwt', label: 'JWT Token' },
  ]);
});

test('resolveMaskedSecretFields lists a path matched twice once', () => {
  expect(
    resolveMaskedSecretFields(JSON.stringify({ jwt: MASK }), {
      '$.jwt': 'JWT Token',
      '$.*': 'Encrypted Extra',
    }),
  ).toEqual([{ path: '$.jwt', label: 'JWT Token' }]);
});

test('resolveMaskedSecretFields keeps the label of a concrete path declared after a wildcard', () => {
  expect(
    resolveMaskedSecretFields(JSON.stringify({ jwt: MASK, token: MASK }), {
      '$.*': 'Encrypted Extra',
      '$.jwt': 'JWT Token',
    }),
  ).toEqual([
    { path: '$.jwt', label: 'JWT Token' },
    { path: '$.token', label: 'Encrypted Extra' },
  ]);
});

test('resolveMaskedSecretFields lists only the stored fields of a per-database map', () => {
  expect(
    resolveMaskedSecretFields(
      JSON.stringify({
        api_key: MASK,
        connect_args: MASK,
        oauth2_client_info: MASK,
      }),
      {
        '$.api_key': 'api_key',
        '$.oauth2_client_info.secret': 'OAuth2 client secret',
      },
    ),
  ).toEqual([
    { path: '$.api_key', label: 'api_key' },
    { path: '$.oauth2_client_info.secret', label: 'OAuth2 client secret' },
  ]);
});

test('resolveMaskedSecretFields lists a declared leaf under a masked parent, not the parent', () => {
  expect(
    resolveMaskedSecretFields(JSON.stringify({ oauth2_client_info: MASK }), {
      '$.*': 'Encrypted Extra',
      '$.oauth2_client_info.secret': 'OAuth2 client secret',
    }),
  ).toEqual([
    { path: '$.oauth2_client_info.secret', label: 'OAuth2 client secret' },
  ]);
});

test('resolveMaskedSecretFields does not list a wildcard parent next to its declared leaf', () => {
  expect(
    resolveMaskedSecretFields(
      JSON.stringify({ connect_args: MASK, token: MASK }),
      { '$.connect_args.jwt': 'JWT Token', '$.*': 'Encrypted Extra' },
    ),
  ).toEqual([
    { path: '$.connect_args.jwt', label: 'JWT Token' },
    { path: '$.token', label: 'Encrypted Extra' },
  ]);
});

test('resolveMaskedSecretFields keeps a masked parent with no declared leaf under it', () => {
  expect(
    resolveMaskedSecretFields(JSON.stringify({ connect_args: MASK }), {
      '$.*': 'Encrypted Extra',
    }),
  ).toEqual([{ path: '$.connect_args', label: 'Encrypted Extra' }]);
});
