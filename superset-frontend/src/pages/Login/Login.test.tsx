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
  createStore,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import { ThemeProvider, supersetTheme } from '@apache-superset/core/theme';
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

const mockStaticAssetsPrefix = jest.fn(() => '');
jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => defaultBootstrapData),
  staticAssetsPrefix: () => mockStaticAssetsPrefix(),
}));

const mockAddDangerToast = jest.fn((text: string) => ({
  type: 'MOCK_TOAST',
  text,
}));
const mockAddInfoToast = jest.fn((text: string) => ({
  type: 'MOCK_TOAST',
  text,
}));
const mockAddSuccessToast = jest.fn((text: string) => ({
  type: 'MOCK_TOAST',
  text,
}));
const mockAddWarningToast = jest.fn((text: string) => ({
  type: 'MOCK_TOAST',
  text,
}));
jest.mock('src/components/MessageToasts/actions', () => ({
  addDangerToast: (text: string) => mockAddDangerToast(text),
  addInfoToast: (text: string) => mockAddInfoToast(text),
  addSuccessToast: (text: string) => mockAddSuccessToast(text),
  addWarningToast: (text: string) => mockAddWarningToast(text),
}));

const mockEnsureAppRoot = jest.fn((...args: string[]) => args[0]);
jest.mock('src/utils/pathUtils', () => ({
  ensureAppRoot: (...args: string[]) => mockEnsureAppRoot(...args),
}));

const mockGetBootstrapData = getBootstrapData as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBootstrapData.mockReturnValue(defaultBootstrapData);
  mockEnsureAppRoot.mockClear();
  mockEnsureAppRoot.mockImplementation((path: string) => path);
  mockStaticAssetsPrefix.mockReturnValue('');
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

test('should render SAML provider buttons', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 5,
        AUTH_PROVIDERS: [
          { name: 'okta', icon: 'okta' },
          { name: 'onelogin', icon: 'onelogin' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(screen.getByText('Sign in with Okta')).toBeInTheDocument();
  expect(screen.getByText('Sign in with Onelogin')).toBeInTheDocument();
});

test('should call ensureAppRoot for login endpoint on DB auth', () => {
  render(<Login />, { useRedux: true });
  expect(mockEnsureAppRoot).toHaveBeenCalledWith('/login/');
});

test('links to password recovery when the backend enables it', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        ...defaultBootstrapData.common.conf,
        PASSWORD_RECOVERY_ENABLED: true,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(screen.getByTestId('forgot-password-link')).toHaveAttribute(
    'href',
    '/login/forgot_password/',
  );
});

test.each([
  ['the backend does not enable it', 1, false],
  ['the deployment uses LDAP', 2, true],
])(
  'hides the password recovery link when %s',
  (_, authType, recoveryEnabled) => {
    mockGetBootstrapData.mockReturnValue({
      common: {
        conf: {
          ...defaultBootstrapData.common.conf,
          AUTH_TYPE: authType,
          PASSWORD_RECOVERY_ENABLED: recoveryEnabled,
        },
      },
    });
    render(<Login />, { useRedux: true });
    expect(screen.getByTestId('login-button')).toBeInTheDocument();
    expect(
      screen.queryByTestId('forgot-password-link'),
    ).not.toBeInTheDocument();
  },
);

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

test('should not render register button for LDAP even when AUTH_USER_REGISTRATION is enabled', () => {
  // LDAP deployments must enable AUTH_USER_REGISTRATION so FlaskAppBuilder
  // provisions users on first login; that must not expose self-registration.
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: 2,
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: true,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(screen.getByTestId('login-form')).toBeInTheDocument();
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

// --- Auth flash messages ---

test('should show flashed warnings as warning toasts', () => {
  mockGetBootstrapData.mockReturnValue({
    ...defaultBootstrapData,
    auth_messages: [['warning', 'Invalid login. Please try again.']],
  });

  render(<Login />, { useRedux: true });

  expect(mockAddWarningToast).toHaveBeenCalledWith(
    'Invalid login. Please try again.',
  );
  expect(mockAddDangerToast).not.toHaveBeenCalled();
});

test('should clear a seeded password on an error-category auth message', async () => {
  mockGetBootstrapData.mockReturnValue({
    ...defaultBootstrapData,
    auth_messages: [],
  });
  const { rerender } = render(
    <Provider store={createStore()}>
      <Login />
    </Provider>,
  );
  const password = screen.getByTestId('password-input') as HTMLInputElement;
  await userEvent.type(password, 'wrong-secret');
  expect(password).toHaveValue('wrong-secret');

  mockGetBootstrapData.mockReturnValue({
    ...defaultBootstrapData,
    auth_messages: [['error', 'Invalid login. Please try again.']],
  });
  rerender(
    <Provider store={createStore()}>
      <Login />
    </Provider>,
  );

  expect(screen.getByTestId('password-input')).toHaveValue('');
});

test('should show every drained auth message', () => {
  mockGetBootstrapData.mockReturnValue({
    ...defaultBootstrapData,
    auth_messages: [
      ['warning', 'Invalid login. Please try again.'],
      ['warning', 'Your session has ended. Please sign in again.'],
    ],
  });

  render(<Login />, { useRedux: true });

  expect(mockAddWarningToast).toHaveBeenCalledTimes(2);
  expect(mockAddWarningToast).toHaveBeenCalledWith(
    'Your session has ended. Please sign in again.',
  );
});

test('should not fabricate a login error without auth messages', () => {
  render(<Login />, { useRedux: true });

  expect(mockAddDangerToast).not.toHaveBeenCalled();
  expect(mockAddWarningToast).not.toHaveBeenCalled();
  expect(mockAddInfoToast).not.toHaveBeenCalled();
  expect(mockAddSuccessToast).not.toHaveBeenCalled();
});

test('should map success and info categories to matching toasts', () => {
  mockGetBootstrapData.mockReturnValue({
    ...defaultBootstrapData,
    auth_messages: [
      ['success', 'Password changed.'],
      ['message', 'Welcome back.'],
    ],
  });

  render(<Login />, { useRedux: true });

  expect(mockAddSuccessToast).toHaveBeenCalledWith('Password changed.');
  expect(mockAddInfoToast).toHaveBeenCalledWith('Welcome back.');
  expect(mockAddDangerToast).not.toHaveBeenCalled();
  expect(mockAddWarningToast).not.toHaveBeenCalled();
});

test('should map danger and error categories to danger toasts', () => {
  mockGetBootstrapData.mockReturnValue({
    ...defaultBootstrapData,
    auth_messages: [
      ['danger', 'Login failed.'],
      ['error', 'Something went wrong.'],
    ],
  });

  render(<Login />, { useRedux: true });

  expect(mockAddDangerToast).toHaveBeenCalledTimes(2);
  expect(mockAddDangerToast).toHaveBeenCalledWith('Login failed.');
  expect(mockAddDangerToast).toHaveBeenCalledWith('Something went wrong.');
  expect(mockAddWarningToast).not.toHaveBeenCalled();
});

// --- Login page theming tests ---

const renderWithTokens = (tokens: Record<string, string>) =>
  render(
    <ThemeProvider theme={{ ...supersetTheme, ...tokens }}>
      <Login />
    </ThemeProvider>,
    { useRedux: true },
  );

// The background layer is rendered immediately before the login form.
const getBackground = () =>
  screen.getByTestId('login-form').previousElementSibling as HTMLElement;

test('should render the Sign in heading and no brand logo with the default theme', () => {
  render(<Login />, { useRedux: true });
  expect(
    screen.getByRole('heading', { level: 4, name: 'Sign in' }),
  ).toBeInTheDocument();
  expect(screen.queryByAltText('Apache Superset')).not.toBeInTheDocument();
});

test('should render the brand logo with the Apache Superset alt text fallback', () => {
  renderWithTokens({ loginFormBrandLogoUrl: '/static/logo.png' });
  const logo = screen.getByRole('img', { name: 'Apache Superset' });
  expect(logo).toHaveAttribute('src', '/static/logo.png');
});

test('should use brandLogoAlt as the brand logo alt text', () => {
  renderWithTokens({
    loginFormBrandLogoUrl: '/static/logo.png',
    brandLogoAlt: 'Acme Analytics',
  });
  expect(screen.getByRole('img', { name: 'Acme Analytics' })).toHaveAttribute(
    'src',
    '/static/logo.png',
  );
});

test('should apply the static assets prefix to the brand logo URL', () => {
  mockStaticAssetsPrefix.mockReturnValue('/analytics');
  renderWithTokens({ loginFormBrandLogoUrl: '/static/logo.png' });
  expect(screen.getByRole('img', { name: 'Apache Superset' })).toHaveAttribute(
    'src',
    '/analytics/static/logo.png',
  );
});

test('should not style a background layer without a background image token', () => {
  render(<Login />, { useRedux: true });
  expect(getBackground()).not.toHaveStyleRule('position', 'fixed');
});

test('should render the escaped, quoted background image URL with the theme mask overlay by default', () => {
  expect(() =>
    renderWithTokens({
      loginPageBackgroundImageUrl: '/static/assets/images/x.jpg',
    }),
  ).not.toThrow();
  const background = getBackground();
  expect(background).toHaveStyleRule(
    'background-image',
    `url('\\/static\\/assets\\/images\\/x\\.jpg')`,
    { target: '::before' },
  );
  expect(background).toHaveStyleRule(
    'background-color',
    supersetTheme.colorBgMask,
    { target: '::after' },
  );
});

test('should apply the static assets prefix, blur and overlay color to the background', () => {
  mockStaticAssetsPrefix.mockReturnValue('/analytics');
  renderWithTokens({
    loginPageBackgroundImageUrl: '/static/bg.jpg',
    loginPageBackgroundOverlayColor: 'rgb(1, 2, 3)',
    loginPageBackgroundBlur: '4px',
  });
  const background = getBackground();
  expect(background).toHaveStyleRule(
    'background-image',
    `url('\\/analytics\\/static\\/bg\\.jpg')`,
    { target: '::before' },
  );
  expect(background).toHaveStyleRule('filter', 'blur(4px)', {
    target: '::before',
  });
  expect(background).toHaveStyleRule('background-color', 'rgb(1, 2, 3)', {
    target: '::after',
  });
});

interface ReactFiberNode {
  key: string | null;
  return: ReactFiberNode | null;
}

// React warns about missing keys only once per owner component, so a console
// spy cannot detect a missing key reliably across tests. Read the keys React
// assigned to the element's ancestors instead.
const getAncestorKeys = (element: HTMLElement): string[] => {
  const fiberProp = Object.keys(element).find(prop =>
    prop.startsWith('__reactFiber$'),
  );
  const keys: string[] = [];
  let fiber = fiberProp
    ? ((element as unknown as Record<string, ReactFiberNode>)[fiberProp] ??
      null)
    : null;
  while (fiber) {
    if (fiber.key !== null) {
      keys.push(fiber.key);
    }
    fiber = fiber.return;
  }
  return keys;
};

test.each([
  ['OID', 0],
  ['OAuth', 4],
  ['SAML', 5],
])('should key each %s provider item by provider name', (_name, authType) => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        AUTH_TYPE: authType,
        AUTH_PROVIDERS: [
          { name: 'okta', icon: 'okta', url: 'https://okta.example' },
          { name: 'google', icon: 'google', url: 'https://google.example' },
        ],
        AUTH_USER_REGISTRATION: false,
      },
    },
  });
  render(<Login />, { useRedux: true });
  expect(getAncestorKeys(screen.getByText('Sign in with Okta'))).toContain(
    'okta',
  );
  expect(getAncestorKeys(screen.getByText('Sign in with Google'))).toContain(
    'google',
  );
});
