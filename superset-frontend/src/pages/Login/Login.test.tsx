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
import { render, screen } from 'spec/helpers/testing-library';
import getBootstrapData from 'src/utils/getBootstrapData';
import Login from './index';

const defaultBootstrapData = {
  common: {
    conf: {
      AUTH_TYPE: 1,
      AUTH_PROVIDERS: [],
      AUTH_USER_REGISTRATION: false,
    },
    feature_flags: {},
  },
};

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    common: {
      conf: {
        AUTH_TYPE: 1,
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  })),
}));

const mockEnsureAppRoot = jest.fn((path: string) => path);
jest.mock('src/utils/pathUtils', () => ({
  ensureAppRoot: (...args: string[]) => mockEnsureAppRoot(...args),
}));

const mockGetBootstrapData = jest.mocked(getBootstrapData);

beforeEach(() => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1,
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  } as ReturnType<typeof getBootstrapData>);
  mockEnsureAppRoot.mockClear();
  mockEnsureAppRoot.mockImplementation((path: string) => path);
});

// --- DB / LDAP Auth tests ---

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

test('should call ensureAppRoot for login endpoint on DB auth', () => {
  render(<Login />, { useRedux: true });
  expect(mockEnsureAppRoot).toHaveBeenCalledWith('/login/');
});

// --- OAuth tests ---

test('should render OAuth provider buttons when AUTH_TYPE is OAuth', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4,
        AUTH_PROVIDERS: [
          { name: 'google', icon: 'google' },
          { name: 'github', icon: 'github' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(
    screen.getByRole('link', { name: /Sign in with Google/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: /Sign in with Github/ }),
  ).toBeInTheDocument();
});

test('should not render username/password fields for OAuth auth type', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4,
        AUTH_PROVIDERS: [{ name: 'google', icon: 'google' }],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(screen.queryByTestId('username-input')).not.toBeInTheDocument();
  expect(screen.queryByTestId('password-input')).not.toBeInTheDocument();
  expect(screen.queryByTestId('login-button')).not.toBeInTheDocument();
});

test('should call ensureAppRoot for OAuth provider login URLs', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4,
        AUTH_PROVIDERS: [
          { name: 'google', icon: 'google' },
          { name: 'github', icon: 'github' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(mockEnsureAppRoot).toHaveBeenCalledWith('/login/google');
  expect(mockEnsureAppRoot).toHaveBeenCalledWith('/login/github');
});

// --- OID tests ---

test('should render OID provider buttons when AUTH_TYPE is OID', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 0,
        AUTH_PROVIDERS: [
          { name: 'google', url: 'https://accounts.google.com' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(
    screen.getByRole('link', { name: /Sign in with Google/ }),
  ).toBeInTheDocument();
});

test('should not render username/password fields for OID auth type', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 0,
        AUTH_PROVIDERS: [
          { name: 'google', url: 'https://accounts.google.com' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(screen.queryByTestId('username-input')).not.toBeInTheDocument();
  expect(screen.queryByTestId('password-input')).not.toBeInTheDocument();
});

// --- Registration button tests ---

test('should render register button when AUTH_USER_REGISTRATION is enabled', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1,
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: true,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(screen.getByTestId('register-button')).toBeInTheDocument();
});

test('should not render register button when AUTH_USER_REGISTRATION is disabled', () => {
  render(<Login />, { useRedux: true });
  expect(screen.queryByTestId('register-button')).not.toBeInTheDocument();
});

// --- ensureAppRoot / SUPERSET_APP_ROOT tests ---

test('should prefix OAuth provider URLs with application root', () => {
  mockEnsureAppRoot.mockImplementation(
    (path: string) => `/superset${path.startsWith('/') ? path : `/${path}`}`,
  );
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4,
        AUTH_PROVIDERS: [{ name: 'google', icon: 'google' }],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  const googleLink = screen.getByRole('link', {
    name: /Sign in with Google/,
  });
  expect(googleLink).toHaveAttribute('href', '/superset/login/google');
});

test('should prefix multiple OAuth provider URLs with application root', () => {
  mockEnsureAppRoot.mockImplementation(
    (path: string) => `/app${path.startsWith('/') ? path : `/${path}`}`,
  );
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4,
        AUTH_PROVIDERS: [
          { name: 'google', icon: 'google' },
          { name: 'github', icon: 'github' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(
    screen.getByRole('link', { name: /Sign in with Google/ }),
  ).toHaveAttribute('href', '/app/login/google');
  expect(
    screen.getByRole('link', { name: /Sign in with Github/ }),
  ).toHaveAttribute('href', '/app/login/github');
});

test('should prefix register URL with application root', () => {
  mockEnsureAppRoot.mockImplementation(
    (path: string) => `/superset${path.startsWith('/') ? path : `/${path}`}`,
  );
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 1,
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: true,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(screen.getByTestId('register-button')).toHaveAttribute(
    'href',
    '/superset/register/',
  );
});

test('should prefix OID provider URLs with application root', () => {
  mockEnsureAppRoot.mockImplementation(
    (path: string) => `/superset${path.startsWith('/') ? path : `/${path}`}`,
  );
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 0,
        AUTH_PROVIDERS: [
          { name: 'google', url: 'https://accounts.google.com' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(
    screen.getByRole('link', { name: /Sign in with Google/ }),
  ).toHaveAttribute('href', '/superset/login/google');
});

test('should use ensureAppRoot for all generated URLs with deep application root', () => {
  mockEnsureAppRoot.mockImplementation(
    (path: string) =>
      `/my-org/superset${path.startsWith('/') ? path : `/${path}`}`,
  );
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 4,
        AUTH_PROVIDERS: [{ name: 'google', icon: 'google' }],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(
    screen.getByRole('link', { name: /Sign in with Google/ }),
  ).toHaveAttribute('href', '/my-org/superset/login/google');
});
