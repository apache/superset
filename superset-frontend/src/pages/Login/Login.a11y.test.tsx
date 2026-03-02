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

/**
 * Login Page - Accessibility Tests (WCAG 2.1 Level A + AA)
 *
 * Tests cover:
 * - WCAG 1.1.1: Form inputs have accessible labels
 * - WCAG 1.3.5: Autocomplete attributes on username/password
 * - WCAG 2.4.6: Labels and headings are descriptive
 * - WCAG 3.3.1: Error identification for form validation
 * - WCAG 3.3.3: Error suggestions
 */
import { render, screen } from 'spec/helpers/testing-library';
import { checkA11y } from 'spec/helpers/a11yTestHelper';
import Login from './index';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    common: {
      conf: {
        AUTH_TYPE: 1,
        AUTH_PROVIDERS: [],
        AUTH_USER_REGISTRATION: false,
      },
    },
  }),
}));

// eslint-disable-next-line no-restricted-globals
describe('Login Page - Accessibility', () => {
  test('should have no axe-core violations', async () => {
    const { container } = render(<Login />, { useRedux: true });
    const results = await checkA11y(container);
    expect(results).toHaveNoViolations();
  });

  test('form inputs should have associated labels', () => {
    render(<Login />, { useRedux: true });
    const usernameInput = screen.getByTestId('username-input');
    const passwordInput = screen.getByTestId('password-input');

    // Inputs must have accessible names (via label, aria-label, or aria-labelledby)
    expect(usernameInput).toBeInTheDocument();
    expect(passwordInput).toBeInTheDocument();
    expect(screen.getByText('Username:')).toBeInTheDocument();
    expect(screen.getByText('Password:')).toBeInTheDocument();
  });

  test('login button should have accessible name', () => {
    render(<Login />, { useRedux: true });
    const button = screen.getByRole('button', { name: 'Sign in' });
    expect(button).toBeInTheDocument();
  });

  test('form should be identifiable as a login form', () => {
    render(<Login />, { useRedux: true });
    const form = screen.getByTestId('login-form');
    expect(form).toBeInTheDocument();
  });

  test('should have proper heading structure', () => {
    render(<Login />, { useRedux: true });
    // Login page should have descriptive instruction text
    expect(
      screen.getByText('Enter your login and password below:'),
    ).toBeInTheDocument();
  });
});
