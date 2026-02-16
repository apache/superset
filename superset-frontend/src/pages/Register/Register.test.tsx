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
import { MemoryRouter, Route } from 'react-router-dom';
import getBootstrapData from 'src/utils/getBootstrapData';
import Register from './index';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    common: {
      conf: {
        RECAPTCHA_PUBLIC_KEY: '',
      },
    },
  })),
}));

const mockMakeUrl = jest.fn((path: string) => path);
jest.mock('src/utils/pathUtils', () => ({
  makeUrl: (...args: string[]) => mockMakeUrl(...args),
}));

jest.mock('react-google-recaptcha', () => ({
  __esModule: true,
  default: () => <div data-test="captcha-input" />,
}));

const mockGetBootstrapData = jest.mocked(getBootstrapData);

beforeEach(() => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        RECAPTCHA_PUBLIC_KEY: '',
      },
    },
  } as ReturnType<typeof getBootstrapData>);
  mockMakeUrl.mockClear();
  mockMakeUrl.mockImplementation((path: string) => path);
});

const renderRegister = () =>
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );

const renderActivated = () =>
  render(
    <MemoryRouter initialEntries={['/register/activation/abc123']}>
      <Route path="/register/activation/:activationHash">
        <Register />
      </Route>
    </MemoryRouter>,
  );

// --- Registration form tests ---

test('should render register form elements', () => {
  renderRegister();

  expect(screen.getByTestId('register-form')).toBeInTheDocument();
  expect(screen.getByTestId('username-input')).toBeInTheDocument();
  expect(screen.getByTestId('first-name-input')).toBeInTheDocument();
  expect(screen.getByTestId('last-name-input')).toBeInTheDocument();
  expect(screen.getByTestId('email-input')).toBeInTheDocument();
  expect(screen.getByTestId('password-input')).toBeInTheDocument();
  expect(screen.getByTestId('confirm-password-input')).toBeInTheDocument();
  expect(screen.getByTestId('register-button')).toBeInTheDocument();
  expect(
    screen.getByText('Fill out the registration form'),
  ).toBeInTheDocument();
});

test('should render form labels', () => {
  renderRegister();

  expect(screen.getByText('Username')).toBeInTheDocument();
  expect(screen.getByText('First Name')).toBeInTheDocument();
  expect(screen.getByText('Last Name')).toBeInTheDocument();
  expect(screen.getByText('Email')).toBeInTheDocument();
  expect(screen.getByText('Password')).toBeInTheDocument();
  expect(screen.getByText('Confirm password')).toBeInTheDocument();
});

test('should render input placeholders', () => {
  renderRegister();

  expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('First name')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Last name')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Confirm password')).toBeInTheDocument();
});

// --- Recaptcha tests ---

test('should not render captcha when RECAPTCHA_PUBLIC_KEY is empty', () => {
  renderRegister();
  expect(screen.queryByTestId('captcha-input')).not.toBeInTheDocument();
});

test('should render captcha when RECAPTCHA_PUBLIC_KEY is set', () => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        RECAPTCHA_PUBLIC_KEY: 'test-key-123',
      },
    },
  } as ReturnType<typeof getBootstrapData>);
  renderRegister();
  expect(screen.getByTestId('captcha-input')).toBeInTheDocument();
});

// --- Activation success page tests ---

test('should render activation success page when activationHash is present', () => {
  renderActivated();
  expect(screen.getByText('Registration successful')).toBeInTheDocument();
  expect(
    screen.getByText(
      'Your account is activated. You can log in with your credentials.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByTestId('login-button')).toBeInTheDocument();
});

test('should not render registration form on activation page', () => {
  renderActivated();
  expect(screen.queryByTestId('username-input')).not.toBeInTheDocument();
  expect(screen.queryByTestId('register-button')).not.toBeInTheDocument();
});

test('should call makeUrl for login link on activation page', () => {
  renderActivated();
  expect(mockMakeUrl).toHaveBeenCalledWith('/login/');
});

// --- makeUrl / SUPERSET_APP_ROOT tests ---

test('should prefix login link with application root on activation page', () => {
  mockMakeUrl.mockImplementation(
    (path: string) => `/superset${path.startsWith('/') ? path : `/${path}`}`,
  );
  renderActivated();
  expect(screen.getByTestId('login-button')).toHaveAttribute(
    'href',
    '/superset/login/',
  );
});

test('should prefix login link with deep application root on activation page', () => {
  mockMakeUrl.mockImplementation(
    (path: string) =>
      `/my-org/superset${path.startsWith('/') ? path : `/${path}`}`,
  );
  renderActivated();
  expect(screen.getByTestId('login-button')).toHaveAttribute(
    'href',
    '/my-org/superset/login/',
  );
});
