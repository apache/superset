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
import { render } from 'spec/helpers/testing-library';
import { AppLink } from 'src/utils/navigationUtils';

// AppLink renders a real React element via React Testing Library, which is
// incompatible with the withApplicationRoot fixture's `jest.resetModules()`
// (it corrupts the testing-library module graph). Mock applicationRoot at
// file scope and vary per test instead. Variable must start with `mock` to
// satisfy Jest's hoisted-factory out-of-scope check.
const mockApplicationRoot = jest.fn<string, []>(() => '');

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    common: { application_root: '', static_assets_prefix: '' },
  }),
  applicationRoot: () => mockApplicationRoot(),
  staticAssetsPrefix: () => '',
}));

beforeEach(() => {
  mockApplicationRoot.mockReturnValue('');
});

test('renders an anchor with prefixed href under subdirectory deployment', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  const { container } = render(<AppLink href="/foo">go</AppLink>);
  const anchor = container.querySelector('a');
  expect(anchor).not.toBeNull();
  expect(anchor?.getAttribute('href')).toBe('/superset/foo');
});

test('passes through other anchor props', () => {
  const { container } = render(
    <AppLink href="/foo" target="_blank" rel="noreferrer">
      go
    </AppLink>,
  );
  const anchor = container.querySelector('a');
  expect(anchor?.getAttribute('target')).toBe('_blank');
  expect(anchor?.getAttribute('rel')).toBe('noreferrer');
});

test('passes absolute URLs through without prefixing', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  const { container } = render(
    <AppLink href="https://external.example.com">x</AppLink>,
  );
  expect(container.querySelector('a')?.getAttribute('href')).toBe(
    'https://external.example.com',
  );
});

// AppLink runs `assertSafeNavigationUrl(ensureAppRoot(href))` during render, so
// an unsafe href throws rather than emitting an anchor that points at the
// attacker-controlled target. Mirror the openInNewTab / getShareableUrl pins.
test('throws on a backslash-laden authority-spoof href', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(() => render(<AppLink href="/\evil.com">x</AppLink>)).toThrow(
      /refused unsafe URL/,
    );
  } finally {
    errorSpy.mockRestore();
  }
});

test('throws on a protocol-relative href', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(() =>
      render(<AppLink href="//evil.example.com">x</AppLink>),
    ).toThrow(/refused unsafe URL/);
  } finally {
    errorSpy.mockRestore();
  }
});
