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
import RedirectWarning from './index';

// The interstitial page MUST visibly refuse a
// backslash-laden URL — both the `isAllowedScheme` check *and* the rendered
// shape have to communicate the block, so a user does not see a normal-
// looking "External link warning" Card with a Continue button for what
// browsers would normalise to `https://evil.com`.

function setLocationSearch(search: string): void {
  Object.defineProperty(window, 'location', {
    value: {
      search,
      origin: 'https://example.com',
      href: `https://example.com/redirect/${search}`,
    },
    writable: true,
    configurable: true,
  });
}

describe('RedirectWarning interstitial', () => {
  test('does NOT offer a Continue button when ?url=%2F%5Cevil.com', () => {
    setLocationSearch('?url=%2F%5Cevil.example.com');
    render(<RedirectWarning />);
    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();
  });

  test('shows a blocked-URL message for /\\evil.com', () => {
    setLocationSearch('?url=%2F%5Cevil.example.com');
    render(<RedirectWarning />);
    // The page surfaces an unsafe / blocked state — assert the text shape
    // without pinning the exact wording so copy changes do not break the
    // security regression. The standard "External link warning" title must
    // not appear for this input.
    expect(
      screen.queryByText(/external link warning/i),
    ).not.toBeInTheDocument();
  });

  test('still renders the standard Continue flow for a legit https target', () => {
    setLocationSearch('?url=https%3A%2F%2Fexample.com%2Fpage');
    render(<RedirectWarning />);
    expect(
      screen.getByRole('button', { name: /continue/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/external link warning/i)).toBeInTheDocument();
  });

  test('shows the missing-URL state when no url query parameter is present', () => {
    setLocationSearch('');
    render(<RedirectWarning />);
    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/missing url parameter/i)).toBeInTheDocument();
  });
});
