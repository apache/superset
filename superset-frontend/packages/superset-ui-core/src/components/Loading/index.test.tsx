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

import { render, screen } from '@superset-ui/core/spec';
import * as themeModule from '../../theme';
import { Loading } from '.';

// Mock the loading.gif import since it's a file stub in tests
jest.mock('../assets', () => ({
  Loading: 'mocked-loading.gif',
}));

const mockUseTheme = jest.fn();

beforeEach(() => {
  mockUseTheme.mockReset();
  jest.spyOn(themeModule, 'useTheme').mockImplementation(mockUseTheme);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('uses default spinner when no theme spinner configured', () => {
  mockUseTheme.mockReturnValue({});

  render(<Loading />);
  const loading = screen.getByRole('status');
  expect(loading).toBeInTheDocument();
  expect(loading).toHaveAttribute('src', 'mocked-loading.gif');
});

test('uses brandSpinnerUrl from theme when configured', () => {
  mockUseTheme.mockReturnValue({
    brandSpinnerUrl: '/custom/spinner.png',
  });

  render(<Loading />);
  const loading = screen.getByRole('status');
  expect(loading).toBeInTheDocument();
  expect(loading).toHaveAttribute('src', '/custom/spinner.png');
});

test('uses brandSpinnerSvg from theme when configured', () => {
  const svgContent = '<svg><circle cx="25" cy="25" r="20"/></svg>';
  mockUseTheme.mockReturnValue({
    brandSpinnerSvg: svgContent,
  });

  render(<Loading />);
  const loading = screen.getByRole('status');
  expect(loading).toBeInTheDocument();
  const src = loading.getAttribute('src');
  expect(src).toContain('data:image/svg+xml;base64,');
  expect(atob(src!.split(',')[1])).toBe(svgContent);
});

test('brandSpinnerSvg takes precedence over brandSpinnerUrl', () => {
  const svgContent = '<svg><circle cx="25" cy="25" r="20"/></svg>';
  mockUseTheme.mockReturnValue({
    brandSpinnerUrl: '/custom/spinner.png',
    brandSpinnerSvg: svgContent,
  });

  render(<Loading />);
  const loading = screen.getByRole('status');
  expect(loading).toBeInTheDocument();
  const src = loading.getAttribute('src');
  expect(src).toContain('data:image/svg+xml;base64,');
  expect(src).not.toBe('/custom/spinner.png');
});

test('explicit image prop takes precedence over theme spinners', () => {
  const svgContent = '<svg><circle cx="25" cy="25" r="20"/></svg>';
  mockUseTheme.mockReturnValue({
    brandSpinnerUrl: '/custom/spinner.png',
    brandSpinnerSvg: svgContent,
  });

  render(<Loading image="/explicit/spinner.gif" />);
  const loading = screen.getByRole('status');
  expect(loading).toBeInTheDocument();
  expect(loading).toHaveAttribute('src', '/explicit/spinner.gif');
});
