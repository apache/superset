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
import { MemoryRouter } from 'react-router-dom';
import Register from './index';

const mockGetBootstrapData = jest.fn();
const mockApplicationRoot = jest.fn();

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => mockGetBootstrapData(),
}));

jest.mock('src/utils/pathUtils', () => ({
  __esModule: true,
  ensureAppRoot: (path: string) =>
    `${mockApplicationRoot()}${path.startsWith('/') ? path : `/${path}`}`,
}));

jest.mock('react-google-recaptcha', () => ({
  __esModule: true,
  default: () => <div data-test="captcha-input" />,
}));

const renderRegister = () =>
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  );

beforeEach(() => {
  mockGetBootstrapData.mockReturnValue({
    common: {
      conf: {
        RECAPTCHA_PUBLIC_KEY: '',
      },
    },
  });
  mockApplicationRoot.mockReturnValue('');
});

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

test('should render login button with correct app root URL', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  renderRegister();

  const loginButton = screen.getByTestId('login-button');
  expect(loginButton).toHaveAttribute('href', '/superset/login/');
});

test('should render login button with default URL when no app root', () => {
  mockApplicationRoot.mockReturnValue('');
  renderRegister();

  const loginButton = screen.getByTestId('login-button');
  expect(loginButton).toHaveAttribute('href', '/login/');
});

test('should handle empty app root correctly', () => {
  mockApplicationRoot.mockReturnValue(null);
  renderRegister();

  const loginButton = screen.getByTestId('login-button');
  expect(loginButton).toHaveAttribute('href', '/login/');
});

test('should handle app root with trailing slash', () => {
  mockApplicationRoot.mockReturnValue('/superset/');
  renderRegister();

  const loginButton = screen.getByTestId('login-button');
  expect(loginButton).toHaveAttribute('href', '/superset/login/');
});
