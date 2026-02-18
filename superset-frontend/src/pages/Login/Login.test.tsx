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
import userEvent from '@testing-library/user-event';
import { SupersetClient } from '@superset-ui/core';
import getBootstrapData, { applicationRoot } from 'src/utils/getBootstrapData';
import Login from './index';

const defaultBootstrapData = (authUserRegistration: boolean = false) => ({
  common: {
    conf: {
      AUTH_TYPE: 1,
      AUTH_PROVIDERS: [],
      AUTH_USER_REGISTRATION: authUserRegistration,
    },
    feature_flags: {},
  },
});

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => defaultBootstrapData()),
  applicationRoot: jest.fn(() => ''),
}));

const mockGetBootstrapData = getBootstrapData as jest.Mock;
const mockApplicationRoot = applicationRoot as jest.Mock;

const renderLogin = () => render(<Login />, { useRedux: true });

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

test('should render registration button with correct app root URL when authRegister=true', () => {
  mockGetBootstrapData.mockReturnValue(defaultBootstrapData(true));
  mockApplicationRoot.mockReturnValue('/superset');

  renderLogin();

  const registerButton = screen.getByTestId('register-button');
  expect(registerButton).toHaveAttribute('href', '/superset/register/');
});

test.each([['', '/superset']])(
  'should render OAuth providers with app root %s',
  (app_root: string) => {
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

    mockApplicationRoot.mockReturnValue(app_root);

    renderLogin();

    const googleButton = screen.getByRole('link', {
      name: /Sign in with Google/i,
    });
    const githubButton = screen.getByRole('link', {
      name: /Sign in with Github/i,
    });

    expect(googleButton).toHaveAttribute('href', `${app_root}/login/google`);
    expect(githubButton).toHaveAttribute('href', `${app_root}/login/github`);
  },
);

test.each([[1, 2]])(
  'should call SupersetClient.postForm with correct endpoint for AuthDB/AuthLDAP',
  async (authType: number) => {
    mockGetBootstrapData.mockReturnValue({
      common: {
        conf: {
          AUTH_TYPE: authType,
          AUTH_PROVIDERS: [],
          AUTH_USER_REGISTRATION: false,
        },
      },
    });
    mockApplicationRoot.mockReturnValue('/superset');

    const postFormSpy = jest
      .spyOn(SupersetClient, 'postForm')
      .mockResolvedValue();

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
        // Should be bare endpoint, not /superset/login/
        {
          endpoint: '/login/',
          payload: { username: 'testuser', password: 'testpass' },
          target: '',
        },
      );
    });

    postFormSpy.mockRestore();
  },
);
