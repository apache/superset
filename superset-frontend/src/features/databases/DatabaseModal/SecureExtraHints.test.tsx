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
  within,
} from 'spec/helpers/testing-library';
import SecureExtraHints, {
  resolveMaskedSecretFields,
} from './SecureExtraHints';

const endpoint = 'glob:*/api/v1/database/7/encrypted_extra_hints/';
const SHOW = 'Show stored secret.';
const HIDE = 'Hide stored secret.';
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
    length: 69,
  },
  {
    path: '$.connect_args.password',
    label: 'Password',
    suffix: 'k9Zx2',
    length: 40,
  },
];

const showButtons = () => screen.getAllByRole('button', { name: SHOW });
const hideButtons = () => screen.getAllByRole('button', { name: HIDE });
const blocks = () => screen.getAllByTestId('secure-extra-hint');
const inputs = () =>
  screen.getAllByTestId<HTMLInputElement>('secure-extra-hint-input');
const EYE_NAME = /^(Show|Hide) stored secret\.$/;
const eyeOf = (index: number) =>
  within(blocks()[index]).getByRole('button', { name: EYE_NAME });
const TOO_SHORT = 'Too short to show safely';
const TOO_SHORT_TIP =
  'Only the ending of secrets with at least 20 characters is shown.';
const countSlots = () =>
  document.querySelectorAll('.ant-input-show-count-suffix');
const suffixChildren = (block: HTMLElement) =>
  Array.from(block.querySelector('.ant-input-suffix')?.children ?? []);

const expectHiddenJwtField = () => {
  expect(blocks()).toHaveLength(1);
  expect(within(blocks()[0]).getByText('JWT Token')).toBeInTheDocument();
  expect(within(blocks()[0]).getByText(JWT_HELPER)).toBeInTheDocument();
  expect(inputs()[0]).toHaveAttribute('type', 'text');
  expect(inputs()[0]).toHaveValue(BULLETS);
  expect(inputs()[0]).toHaveAttribute('readonly');
  expect(showButtons()).toHaveLength(1);
  expect(countSlots()).toHaveLength(0);
};

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
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
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);
  await userEvent.click(eyeOf(1));
  await screen.findByDisplayValue(`${BULLETS}k9Zx2`);
  await userEvent.click(eyeOf(0));
  await userEvent.click(eyeOf(1));
  await userEvent.click(eyeOf(0));
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);

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

  expect(await screen.findByDisplayValue(`${BULLETS}R0t8Q`)).toBe(input);
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

// Browser-drawn password dots differ from literal bullets, so the dots would move.
test('the input is a text input in both states and the revealed value extends the hidden one', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);
  const [input] = inputs();
  const hiddenValue = input.value;
  const hiddenClass = input.className;
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveAttribute('readonly');

  await userEvent.click(showButtons()[0]);
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);

  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveAttribute('readonly');
  expect(input.className).toBe(hiddenClass);
  expect(input.value.startsWith(hiddenValue)).toBe(true);
  expect(input.value).not.toBe(hiddenValue);
});

test('clicking the first eye reveals only that field and the other stays bullets', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));

  expect(await screen.findByDisplayValue(`${BULLETS}R0t8Q`)).toBe(inputs()[0]);
  expect(inputs()[1]).toHaveValue(BULLETS);
  expect(inputs()[1]).toHaveAttribute('type', 'text');
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
  expect(await screen.findByDisplayValue(`${BULLETS}k9Zx2`)).toBe(inputs()[1]);
  expect(inputs()[0]).toHaveValue(BULLETS);

  await userEvent.click(eyeOf(0));

  expect(await screen.findByDisplayValue(`${BULLETS}R0t8Q`)).toBe(inputs()[0]);
  expect(inputs()[1]).toHaveValue(`${BULLETS}k9Zx2`);
  expect(hideButtons()).toHaveLength(2);
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('hiding one field keeps the other revealed', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);
  await userEvent.click(eyeOf(1));
  await screen.findByDisplayValue(`${BULLETS}k9Zx2`);
  await userEvent.click(eyeOf(0));

  expect(inputs()[0]).toHaveValue(BULLETS);
  expect(inputs()[1]).toHaveValue(`${BULLETS}k9Zx2`);
  expect(eyeOf(0)).toHaveAccessibleName(SHOW);
  expect(eyeOf(1)).toHaveAccessibleName(HIDE);
  expect(document.body.innerHTML).not.toContain('R0t8Q');
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('each eye is labelled for its own field, in the singular', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);
  expect(eyeOf(0)).toHaveAccessibleName(SHOW);
  expect(eyeOf(1)).toHaveAccessibleName(SHOW);

  await userEvent.click(eyeOf(0));
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);

  expect(eyeOf(0)).toHaveAccessibleName(HIDE);
  expect(eyeOf(1)).toHaveAccessibleName(SHOW);
  expect(screen.queryByRole('button', { name: /secrets/ })).toBeNull();

  await userEvent.hover(eyeOf(1));
  expect(
    (await screen.findByText(SHOW)).closest('[role="tooltip"]'),
  ).toBeInTheDocument();
  screen
    .getAllByRole('tooltip')
    .forEach(tip => expect(tip).toHaveTextContent(EYE_NAME));
});

test('a hint without a suffix shows bullets and says it is too short, without a number', async () => {
  fetchMock.get(endpoint, {
    result: [{ ...hints[0], suffix: null, length: 3 }],
  });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);

  const note = await screen.findByText(TOO_SHORT);
  expect(countSlots()).toHaveLength(1);
  expect(countSlots()[0]).toHaveTextContent(new RegExp(`^${TOO_SHORT}$`));
  expect(screen.queryByText(/3 characters/)).not.toBeInTheDocument();
  expect(note).toBeInTheDocument();
  expect(inputs()[0]).toHaveAttribute('type', 'text');
  expect(inputs()[0]).toHaveValue(BULLETS);
  expect(within(blocks()[0]).getByText(JWT_HELPER)).toBeInTheDocument();
});

test('hovering the too short note explains the minimum length', async () => {
  fetchMock.get(endpoint, {
    result: [{ ...hints[0], suffix: null, length: 3 }],
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
  expect(inputs()[0]).toHaveValue(BULLETS);
  expect(within(blocks()[0]).getByText(JWT_HELPER)).toBeInTheDocument();
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
  expect(inputs()[0]).toHaveValue(BULLETS);
  expect(inputs()[1]).toHaveValue(BULLETS);
  expect(showButtons()).toHaveLength(2);
  expect(eyeOf(1)).toBeEnabled();

  fetchMock.removeRoutes().get(endpoint, { result: hints });
  await userEvent.click(eyeOf(1));

  expect(await screen.findByDisplayValue(`${BULLETS}k9Zx2`)).toBe(inputs()[1]);
  expect(inputs()[0]).toHaveValue(BULLETS);
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

  expect(await screen.findByDisplayValue(`${BULLETS}k9Zx2`)).toBe(inputs()[1]);
  expect(inputs()[0]).toHaveValue(BULLETS);
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
  expect(eyeOf(1)).toHaveAccessibleName(SHOW);

  respond({ result: hints });
  expect(await screen.findByDisplayValue(`${BULLETS}R0t8Q`)).toBe(inputs()[0]);
  expect(inputs()[1]).toHaveValue(BULLETS);
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
  expect(await screen.findByDisplayValue(`${BULLETS}R0t8Q`)).toBe(inputs()[0]);
  expect(inputs()[1]).toHaveValue(`${BULLETS}k9Zx2`);
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
  expect(
    await screen.findByDisplayValue(`${BULLETS}R0t8Q`),
  ).toBeInTheDocument();
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

  expect(
    await screen.findByDisplayValue(`${BULLETS}R0t8Q`),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('hiding every field restores the hidden values and drops the suffixes and the count', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={twoFields} />);

  await userEvent.click(eyeOf(0));
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);
  await userEvent.click(eyeOf(1));
  await screen.findByDisplayValue(`${BULLETS}k9Zx2`);
  await userEvent.click(eyeOf(1));
  await userEvent.click(eyeOf(0));

  inputs().forEach(input => {
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue(BULLETS);
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
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);
  await userEvent.click(hideButtons()[0]);
  expect(inputs()[0]).toHaveValue(BULLETS);

  await userEvent.click(showButtons()[0]);

  expect(
    await screen.findByDisplayValue(`${BULLETS}R0t8Q`),
  ).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);
});

test('a remount after a reveal starts hidden and fetches again', async () => {
  fetchMock.get(endpoint, { result: hints });
  const { unmount } = render(
    <SecureExtraHints databaseId={7} minLength={20} fields={fields} />,
  );

  await userEvent.click(showButtons()[0]);
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);
  unmount();

  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  expectHiddenJwtField();
  expect(fetchMock.callHistory.calls(endpoint)).toHaveLength(1);

  await userEvent.click(showButtons()[0]);

  expect(
    await screen.findByDisplayValue(`${BULLETS}R0t8Q`),
  ).toBeInTheDocument();
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

  expect(
    await screen.findByDisplayValue(`${BULLETS}R0t8Q`),
  ).toBeInTheDocument();
});

// The container's text input rule would draw a second border inside the field.
test('a revealed input draws no border of its own inside the field', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  await userEvent.click(showButtons()[0]);
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);

  expect(inputs()[0].style.borderWidth).toBe('0px');
  expect(inputs()[0].style.padding).toBe('0px');
});

// Inter's contextual alternates restyle the bullets next to the suffix.
test('the bullets keep their glyphs when the suffix follows them', async () => {
  fetchMock.get(endpoint, { result: hints });
  render(<SecureExtraHints databaseId={7} minLength={20} fields={fields} />);

  expect(inputs()[0].style.fontVariantLigatures).toBe('no-contextual');

  await userEvent.click(showButtons()[0]);
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);

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

  await userEvent.keyboard('{Enter}');
  await screen.findByDisplayValue(`${BULLETS}R0t8Q`);
  expect(eyeOf(0)).toBe(eye);
  expect(eye).toHaveAccessibleName(HIDE);
  expect(document.activeElement).toBe(eye);
  expect(inputs()[1]).toHaveValue(BULLETS);
  expect(eyeOf(1)).toHaveAccessibleName(SHOW);

  await userEvent.keyboard('{Enter}');
  expect(inputs()[0]).toHaveValue(BULLETS);
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
