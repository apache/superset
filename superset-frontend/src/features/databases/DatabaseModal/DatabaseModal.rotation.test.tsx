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
import { ChangeEvent } from 'react';
import fetchMock from 'fetch-mock';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { ConfigurationMethod } from '../types';
import DatabaseModal from './index';

// The Secure extra editor is a plain textarea here, so a test can type into
// it; every other JSON editor stays the real one.
type MockEditorProps = {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
};
jest.mock('./styles', () => {
  const actual = jest.requireActual('./styles');
  const { createElement } = jest.requireActual('react');
  const StyledJsonEditor = (props: MockEditorProps) =>
    props.name === 'masked_encrypted_extra'
      ? createElement('textarea', {
          'data-test': 'secure-extra-editor',
          value: props.value,
          onChange: (event: ChangeEvent<HTMLTextAreaElement>) =>
            props.onChange?.(event.target.value),
        })
      : createElement(actual.StyledJsonEditor, props);
  return { ...actual, StyledJsonEditor };
});

const MASK = 'XXXXXXXXXX';
const STORED = JSON.stringify({ connect_args: { jwt: MASK } });
const EXPIRED_TEXT = 'The stored JWT Token expired on Nov 3, 2026.';
const DAY_MS = 24 * 3600 * 1000;

const base64url = (text: string) =>
  btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tokenExpiring = (at: Date) =>
  [
    base64url('{"alg":"HS256","typ":"JWT"}'),
    base64url(JSON.stringify({ exp: Math.floor(at.getTime() / 1000) })),
    'c2lnbmF0dXJl',
  ].join('.');
const withJwt = (jwt: string) => JSON.stringify({ connect_args: { jwt } });

// Opens the edit modal on a saved database whose stored JWT expired, then
// Secure extra through the alert's link.
const openSecureExtra = async () => {
  fetchMock.get('glob:*/api/v1/database/available*', { databases: [] });
  fetchMock.get('glob:*/api/v1/database/*/encrypted_extra_hints/', {
    result: [],
  });
  fetchMock.get('glob:*/api/v1/database/10/connection', {
    result: {
      id: 10,
      database_name: 'Token connection',
      backend: 'druid',
      configuration_method: ConfigurationMethod.SqlalchemyUri,
      sqlalchemy_uri: 'druid://druid:8888/druid/v2/sql/',
      masked_encrypted_extra: STORED,
      engine_information: {
        encrypted_extra_sensitive_fields: { '$.connect_args.jwt': 'JWT Token' },
        encrypted_extra_expirations: {
          '$.connect_args.jwt': {
            expires_at: '2026-11-03T12:00:00+00:00',
            expired: true,
          },
        },
      },
    },
  });
  render(<DatabaseModal show onHide={jest.fn()} databaseId={10} />, {
    useRedux: true,
    initialState: { common: { conf: { ENCRYPTED_EXTRA_HINT_CHARS: 5 } } },
  });
  expect(
    await screen.findByDisplayValue('Token connection'),
  ).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(EXPIRED_TEXT);
  await userEvent.click(
    screen.getByRole('button', { name: 'Go to Secure extra' }),
  );
  return screen.findByTestId('secure-extra-editor');
};

const typeInto = (editor: HTMLElement, value: string) =>
  fireEvent.change(editor, { target: { value } });

const expiryAlert = () =>
  screen
    .queryAllByRole('alert')
    .find(alert => /JWT Token/.test(alert.textContent ?? ''));

const notes = () =>
  screen
    .queryAllByTestId('secure-extra-expiry-note')
    .map(note => note.textContent);

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('pasting a JWT that expires later confirms it under the editor, clears the alert, and sends nothing', async () => {
  const editor = await openSecureExtra();
  const requests = fetchMock.callHistory.calls().length;
  const expiresAt = new Date(Date.now() + 90 * DAY_MS);

  typeInto(editor, withJwt(tokenExpiring(expiresAt)));

  const confirmation = `The new JWT Token expires on ${extendedDayjs(
    expiresAt,
  ).format('ll')}. Click Finish to save it.`;
  expect(notes()).toEqual([confirmation]);
  expect(expiryAlert()).toBeUndefined();
  expect(screen.queryByText(EXPIRED_TEXT)).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Go to Secure extra' }),
  ).not.toBeInTheDocument();

  // A half pasted value keeps the last valid state.
  typeInto(editor, '{"connect_args": {"jwt": "eyJhbGci');
  expect(notes()).toEqual([confirmation]);
  expect(expiryAlert()).toBeUndefined();

  // An expired new token is reported the same way in the alert and the note.
  const expiredAt = new Date(Date.now() - 2 * DAY_MS);
  typeInto(editor, withJwt(tokenExpiring(expiredAt)));
  const expiredText = `The new, unsaved JWT Token expired on ${extendedDayjs(
    expiredAt,
  ).format('ll')}.`;
  expect(notes()).toEqual([expiredText]);
  expect(expiryAlert()).toHaveTextContent(expiredText);
  expect(expiryAlert()).toHaveClass('ant-alert-error');

  // Putting the masked value back restores the stored state.
  typeInto(editor, STORED);
  expect(notes()).toEqual([EXPIRED_TEXT]);
  expect(expiryAlert()).toHaveTextContent(EXPIRED_TEXT);

  expect(fetchMock.callHistory.calls()).toHaveLength(requests);
});
