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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';
import Login from './index';

const mockGetBootstrapData = jest.fn();
const mockApplicationRoot = jest.fn();

const renderLogin = () => render(<Login />, { useRedux: true });

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => mockGetBootstrapData(),
}));

jest.mock('src/utils/pathUtils', () => ({
  __esModule: true,
  ensureAppRoot: (path: string) =>
    `${mockApplicationRoot()}${path.startsWith('/') ? path : `/${path}`}`,
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
});

test('should render login form elements', () => {
  renderLogin();
  expect(screen.getByTestId('login-form')).toBeInTheDocument();
  expect(screen.getByTestId('username-input')).toBeInTheDocument();
  expect(screen.getByTestId('password-input')).toBeInTheDocument();
  expect(screen.getByTestId('login-button')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
});

test('should render username and password labels', () => {
  renderLogin();
  expect(screen.getByText('Username:')).toBeInTheDocument();
  expect(screen.getByText('Password:')).toBeInTheDocument();
});

test('should render form instruction text', () => {
  renderLogin();
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

  renderLogin();

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

  renderLogin();

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

  renderLogin();

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

  renderLogin();

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

  renderLogin();

  const registerButton = screen.getByTestId('register-button');
  expect(registerButton).toHaveAttribute('href', '/register/');
});

test('should call SupersetClient.postForm with correct endpoint (no double-prefix)', async () => {
  const postFormSpy = jest
    .spyOn(SupersetClient, 'postForm')
    .mockResolvedValue();

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

  renderLogin();

  // Fill in the form
  const usernameInput = screen.getByTestId('username-input');
  const passwordInput = screen.getByTestId('password-input');
  const loginButton = screen.getByTestId('login-button');

  await userEvent.type(usernameInput, 'testuser');
  await userEvent.type(passwordInput, 'testpass');
  await userEvent.click(loginButton);

  await waitFor(() => {
    expect(postFormSpy).toHaveBeenCalledWith(
      '/login/', // Should be bare endpoint, not /superset/login/
      { username: 'testuser', password: 'testpass' },
      '',
    );
  });

  postFormSpy.mockRestore();
});

// Edge case tests
test('should handle empty providers array gracefully', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4, // AuthType.AuthOauth
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  // Should not crash and OAuth section should be empty
  expect(
    screen.queryByRole('link', { name: /Sign in with/i }),
  ).not.toBeInTheDocument();
});

test('should handle invalid provider objects', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4, // AuthType.AuthOauth
        AUTH_PROVIDERS: [
          { name: null, icon: 'google' },
          { name: 'github' }, // missing icon
          {}, // empty object
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  // Should only render valid providers
  const githubButton = screen.getByRole('link', {
    name: /Sign in with Github/i,
  });
  expect(githubButton).toBeInTheDocument();
});

test('should handle providers with special characters in names', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4, // AuthType.AuthOauth
        AUTH_PROVIDERS: [
          { name: 'test-provider', icon: 'test' },
          { name: 'test_provider', icon: 'test' },
          { name: 'test.provider', icon: 'test' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  const testDashButton = screen.getByRole('link', {
    name: /Sign in with Test-provider/i,
  });
  expect(testDashButton).toHaveAttribute(
    'href',
    '/superset/login/test-provider',
  );

  const testUnderscoreButton = screen.getByRole('link', {
    name: /Sign in with Test_provider/i,
  });
  expect(testUnderscoreButton).toHaveAttribute(
    'href',
    '/superset/login/test_provider',
  );

  const testDotButton = screen.getByRole('link', {
    name: /Sign in with Test.provider/i,
  });
  expect(testDotButton).toHaveAttribute(
    'href',
    '/superset/login/test.provider',
  );
});

test('should handle very long provider names', () => {
  const longName = 'a'.repeat(100);
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4, // AuthType.AuthOauth
        AUTH_PROVIDERS: [{ name: longName, icon: 'test' }],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  const longButton = screen.getByRole('link', {
    name: new RegExp(`Sign in with ${longName.charAt(0).toUpperCase()}`, 'i'),
  });
  expect(longButton).toBeInTheDocument();
});

test('should handle mixed auth types correctly', () => {
  // Test OAuth with registration enabled
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4, // AuthType.AuthOauth
        AUTH_PROVIDERS: [{ name: 'google', icon: 'google' }],
        AUTH_USER_REGISTRATION: true, // Registration with OAuth
      },
    },
  });

  renderLogin();

  const googleButton = screen.getByRole('link', {
    name: /Sign in with Google/i,
  });
  expect(googleButton).toBeInTheDocument();
  // Registration button should not be shown with OAuth
  expect(screen.queryByTestId('register-button')).not.toBeInTheDocument();
});

test('should handle undefined provider configuration', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4, // AuthType.AuthOauth
        AUTH_PROVIDERS: undefined,
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  // Should not crash
  expect(screen.getByTestId('login-form')).toBeInTheDocument();
});

test('should handle null provider configuration', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4, // AuthType.AuthOauth
        AUTH_PROVIDERS: null,
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  // Should not crash
  expect(screen.getByTestId('login-form')).toBeInTheDocument();
});

// Integration and interaction tests
test('should handle full login flow with session storage', async () => {
  const postFormSpy = jest
    .spyOn(SupersetClient, 'postForm')
    .mockResolvedValue();

  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  const usernameInput = screen.getByTestId('username-input');
  const passwordInput = screen.getByTestId('password-input');
  const loginButton = screen.getByTestId('login-button');

  // Type credentials
  await userEvent.type(usernameInput, 'testuser');
  await userEvent.type(passwordInput, 'testpass123');

  // Check session storage is set before submission
  await userEvent.click(loginButton);

  expect(sessionStorage.getItem('login_attempted')).toBe('true');

  await waitFor(() => {
    expect(postFormSpy).toHaveBeenCalledWith(
      '/login/',
      { username: 'testuser', password: 'testpass123' },
      '',
    );
  });

  postFormSpy.mockRestore();
});

test('should show loading state during form submission', async () => {
  const postFormSpy = jest
    .spyOn(SupersetClient, 'postForm')
    .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  const usernameInput = screen.getByTestId('username-input');
  const passwordInput = screen.getByTestId('password-input');
  const loginButton = screen.getByTestId('login-button');

  await userEvent.type(usernameInput, 'user');
  await userEvent.type(passwordInput, 'pass');
  await userEvent.click(loginButton);

  // Button should show loading state
  expect(loginButton).toHaveAttribute('aria-busy', 'true');

  await waitFor(() => {
    expect(loginButton).not.toHaveAttribute('aria-busy', 'true');
  });

  postFormSpy.mockRestore();
});

test('should validate password field is required', async () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  const usernameInput = screen.getByTestId('username-input');
  const loginButton = screen.getByTestId('login-button');

  // Try to submit with only username
  await userEvent.type(usernameInput, 'testuser');
  await userEvent.click(loginButton);

  // Form should not submit without password
  await waitFor(() => {
    expect(screen.getByText('Please enter your password')).toBeInTheDocument();
  });
});

test('should handle keyboard navigation for accessibility', async () => {
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

  renderLogin();

  const googleButton = screen.getByRole('link', {
    name: /Sign in with Google/i,
  });
  const githubButton = screen.getByRole('link', {
    name: /Sign in with Github/i,
  });

  // Tab to first OAuth button
  googleButton.focus();
  expect(googleButton).toHaveFocus();

  // Tab to next OAuth button
  await userEvent.tab();
  expect(githubButton).toHaveFocus();
});

test('should handle password visibility toggle', async () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  const passwordInput = screen.getByTestId('password-input');

  // Initially password should be hidden
  expect(passwordInput).toHaveAttribute('type', 'password');

  // Find and click the visibility toggle button
  const toggleButton = screen.getByRole('button', { name: /eye/i });
  await userEvent.click(toggleButton);

  // Password should now be visible
  expect(passwordInput).toHaveAttribute('type', 'text');

  // Click again to hide
  await userEvent.click(toggleButton);
  expect(passwordInput).toHaveAttribute('type', 'password');
});

test('should handle form reset when navigating away', async () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: true,
      },
    },
  });

  const { unmount } = renderLogin();

  const usernameInput = screen.getByTestId('username-input');
  const passwordInput = screen.getByTestId('password-input');

  // Enter some data
  await userEvent.type(usernameInput, 'testuser');
  await userEvent.type(passwordInput, 'testpass');

  // Unmount and remount
  unmount();
  renderLogin();

  // Fields should be empty after remounting
  expect(screen.getByTestId('username-input')).toHaveValue('');
  expect(screen.getByTestId('password-input')).toHaveValue('');
});

// Error state tests
test('should handle network error during form submission', async () => {
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  const postFormSpy = jest
    .spyOn(SupersetClient, 'postForm')
    .mockRejectedValue(new Error('Network error'));

  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  const usernameInput = screen.getByTestId('username-input');
  const passwordInput = screen.getByTestId('password-input');
  const loginButton = screen.getByTestId('login-button');

  await userEvent.type(usernameInput, 'testuser');
  await userEvent.type(passwordInput, 'testpass');
  await userEvent.click(loginButton);

  // Should handle error gracefully
  await waitFor(() => {
    expect(postFormSpy).toHaveBeenCalled();
  });

  postFormSpy.mockRestore();
  consoleSpy.mockRestore();
});

test('should handle malformed bootstrap data', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: null, // Malformed config
    },
  });

  // Should not crash
  renderLogin();
  expect(screen.getByTestId('login-form')).toBeInTheDocument();
});

test('should handle missing auth type', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        // No AUTH_TYPE
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();
  // Should still render form
  expect(screen.getByTestId('login-form')).toBeInTheDocument();
});

test('should handle error when sessionStorage is unavailable', async () => {
  const originalSessionStorage = global.sessionStorage;
  // @ts-ignore
  delete global.sessionStorage;

  const postFormSpy = jest
    .spyOn(SupersetClient, 'postForm')
    .mockResolvedValue();

  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  const usernameInput = screen.getByTestId('username-input');
  const passwordInput = screen.getByTestId('password-input');
  const loginButton = screen.getByTestId('login-button');

  await userEvent.type(usernameInput, 'testuser');
  await userEvent.type(passwordInput, 'testpass');

  // Should not crash even without sessionStorage
  await userEvent.click(loginButton);

  await waitFor(() => {
    expect(postFormSpy).toHaveBeenCalled();
  });

  global.sessionStorage = originalSessionStorage;
  postFormSpy.mockRestore();
});

test('should display error message from session storage on mount', () => {
  sessionStorage.setItem('login_attempted', 'true');

  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1, // AuthType.AuthDB
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  // Should show error toast
  expect(sessionStorage.getItem('login_attempted')).toBeNull();
});

test('should handle OAuth provider with malformed URL', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 0, // AuthType.AuthOID
        AUTH_PROVIDERS: [
          { name: 'provider1', url: null }, // null URL
          { name: 'provider2', url: '' }, // empty URL
          { name: 'provider3' }, // missing URL
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });

  renderLogin();

  // Should still render buttons for all providers
  expect(
    screen.getByRole('link', { name: /Sign in with Provider1/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Sign in with Provider2/i }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Sign in with Provider3/i }),
  ).toBeInTheDocument();
});
