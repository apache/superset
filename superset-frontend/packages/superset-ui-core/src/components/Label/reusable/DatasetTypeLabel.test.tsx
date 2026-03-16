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
import { type ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '@emotion/react';
import { Theme, supersetTheme } from '@apache-superset/core/theme';
import { DatasetTypeLabel } from './DatasetTypeLabel';

function renderWithDefaultTheme(ui: ReactElement) {
  return render(<ThemeProvider theme={supersetTheme}>{ui}</ThemeProvider>);
}

function renderWithTokens(
  ui: ReactElement,
  tokenOverrides: Record<string, string>,
) {
  const customTheme = Theme.fromConfig({ token: tokenOverrides });
  return render(<ThemeProvider theme={customTheme.theme}>{ui}</ThemeProvider>);
}

test('renders "Physical" text for physical dataset', () => {
  renderWithDefaultTheme(<DatasetTypeLabel datasetType="physical" />);
  expect(screen.getByText('Physical')).toBeInTheDocument();
});

test('renders "Virtual" text for virtual dataset', () => {
  renderWithDefaultTheme(<DatasetTypeLabel datasetType="virtual" />);
  expect(screen.getByText('Virtual')).toBeInTheDocument();
});

test('uses default primary color for physical label', () => {
  renderWithDefaultTheme(<DatasetTypeLabel datasetType="physical" />);
  const tag = screen.getByText('Physical').closest('.ant-tag');
  expect(tag).toHaveStyle({ color: supersetTheme.colorPrimaryText });
});

test('uses default color for virtual label', () => {
  renderWithDefaultTheme(<DatasetTypeLabel datasetType="virtual" />);
  const tag = screen.getByText('Virtual').closest('.ant-tag');
  expect(tag).toHaveStyle({ color: supersetTheme.colorPrimary });
});

test('applies custom labelDatasetPhysical tokens when set', () => {
  renderWithTokens(<DatasetTypeLabel datasetType="physical" />, {
    labelDatasetPhysicalColor: '#111111',
    labelDatasetPhysicalBg: '#222222',
    labelDatasetPhysicalBorderColor: '#333333',
  });
  const tag = screen.getByText('Physical').closest('.ant-tag');
  expect(tag).toHaveStyle({
    color: '#111111',
    backgroundColor: '#222222',
    borderColor: '#333333',
  });
});

test('applies custom labelDatasetVirtual tokens when set', () => {
  renderWithTokens(<DatasetTypeLabel datasetType="virtual" />, {
    labelDatasetVirtualColor: '#444444',
    labelDatasetVirtualBg: '#555555',
    labelDatasetVirtualBorderColor: '#666666',
  });
  const tag = screen.getByText('Virtual').closest('.ant-tag');
  expect(tag).toHaveStyle({
    color: '#444444',
    backgroundColor: '#555555',
    borderColor: '#666666',
  });
});

test('applies custom labelDatasetPhysicalIconColor to icon', () => {
  const { container } = renderWithTokens(
    <DatasetTypeLabel datasetType="physical" />,
    { labelDatasetPhysicalIconColor: '#aabbcc' },
  );
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: '#aabbcc' });
});

test('applies custom labelDatasetVirtualIconColor to icon', () => {
  const { container } = renderWithTokens(
    <DatasetTypeLabel datasetType="virtual" />,
    { labelDatasetVirtualIconColor: '#ddeeff' },
  );
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: '#ddeeff' });
});
