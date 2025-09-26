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
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import Login from './index';

const mockGetBootstrapData = jest.fn();

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => mockGetBootstrapData(),
}));

const mockApplicationRoot = jest.fn();

jest.mock('src/utils/pathUtils', () => ({
  __esModule: true,
  ensureAppRoot: (path: string) =>
    `${mockApplicationRoot()}${path.startsWith('/') ? path : `/${path}`}`,
}));

// Mock SupersetClient to test form submissions
const mockPostForm = jest.fn(() => Promise.resolve());
jest.mock('@superset-ui/core', () => ({
  SupersetClient: {
    postForm: mockPostForm,
  },
}));

const defaultBootstrapData = {
  common: {
    conf: {
      AUTH_TYPE: 1,
      AUTH_PROVIDERS: [],
      AUTH_USER_REGISTRATION: false,
    },
  },
};

beforeEach(() => {
  mockGetBootstrapData.mockReturnValue(defaultBootstrapData);
  mockApplicationRoot.mockReturnValue('');
  mockPostForm.mockClear();
});

test('should render login form elements', () => {
  render(<Login />, { useRedux: true });
  expect(screen.getByTestId('login-form')).toBeInTheDocument();
  expect(screen.getByTestId('username-input')).toBeInTheDocument();
  expect(screen.getByTestId('password-input')).toBeInTheDocument();
  expect(screen.getByTestId('login-button')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
});

test('should render username and password labels', () => {
  render(<Login />, { useRedux: true });
  expect(screen.getByText('Username:')).toBeInTheDocument();
  expect(screen.getByText('Password:')).toBeInTheDocument();
});

test('should render form instruction text', () => {
  render(<Login />, { useRedux: true });
  expect(
    screen.getByText('Enter your login and password below:'),
  ).toBeInTheDocument();
});

test('should render OAuth providers with correct app root URLs', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4, // AuthType.AuthOauth
        AUTH_PROVIDERS: [
          { name: 'google', icon: 'google' },
          { name: 'github', icon: 'github' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  render(<Login />);

  const googleButton = screen.getByRole('link', {
    name: /Sign in with Google/i,
  });
  const githubButton = screen.getByRole('link', {
    name: /Sign in with Github/i,
  });

  expect(googleButton).toHaveAttribute('href', '/superset/login/google');
  expect(githubButton).toHaveAttribute('href', '/superset/login/github');
});

test('should render OAuth providers with default URLs when no app root', () => {
  mockApplicationRoot.mockReturnValue('');
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4, // AuthType.AuthOauth
        AUTH_PROVIDERS: [{ name: 'google', icon: 'google' }],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  render(<Login />);

  const googleButton = screen.getByRole('link', {
    name: /Sign in with Google/i,
  });
  expect(googleButton).toHaveAttribute('href', '/login/google');
});

test('should render LDAP/OID providers with correct app root URLs', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 0, // AuthType.AuthOID
        AUTH_PROVIDERS: [{ name: 'ldap', url: '/login/ldap' }],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  render(<Login />);

  const ldapButton = screen.getByRole('link', { name: /Sign in with Ldap/i });
  expect(ldapButton).toHaveAttribute('href', '/superset/login/ldap');
});

test('should render registration button with correct app root URL', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: true,
      },
    },
  });

  render(<Login />);

  const registerButton = screen.getByTestId('register-button');
  expect(registerButton).toHaveAttribute('href', '/superset/register/');
});

test('should render registration button with default URL when no app root', () => {
  mockApplicationRoot.mockReturnValue('');
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: true,
      },
    },
  });

  render(<Login />);

  const registerButton = screen.getByTestId('register-button');
  expect(registerButton).toHaveAttribute('href', '/register/');
});

test('should call SupersetClient.postForm with correct endpoint (no double-prefix)', async () => {
  mockApplicationRoot.mockReturnValue('/superset');
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  render(<Login />);

  // Fill in the form
  const usernameInput = screen.getByTestId('username-input');
  const passwordInput = screen.getByTestId('password-input');
  const loginButton = screen.getByTestId('login-button');

  fireEvent.change(usernameInput, { target: { value: 'testuser' } });
  fireEvent.change(passwordInput, { target: { value: 'testpass' } });
  fireEvent.click(loginButton);

  await waitFor(() => {
    expect(mockPostForm).toHaveBeenCalledWith(
      '/login/', // Should be bare endpoint, not /superset/login/
      { username: 'testuser', password: 'testpass' },
      '',
    );
  });
});
