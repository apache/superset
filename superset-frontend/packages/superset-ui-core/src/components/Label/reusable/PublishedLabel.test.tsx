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
import { PublishedLabel } from './PublishedLabel';

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

test('renders "Published" text when isPublished is true', () => {
  renderWithDefaultTheme(<PublishedLabel isPublished />);
  expect(screen.getByText('Published')).toBeInTheDocument();
});

test('renders "Draft" text when isPublished is false', () => {
  renderWithDefaultTheme(<PublishedLabel isPublished={false} />);
  expect(screen.getByText('Draft')).toBeInTheDocument();
});

test('uses default success color for published label', () => {
  renderWithDefaultTheme(<PublishedLabel isPublished />);
  const tag = screen.getByText('Published').closest('.ant-tag');
  expect(tag).toHaveStyle({ color: supersetTheme.colorSuccessText });
});

test('uses default primary color for draft label', () => {
  renderWithDefaultTheme(<PublishedLabel isPublished={false} />);
  const tag = screen.getByText('Draft').closest('.ant-tag');
  expect(tag).toHaveStyle({ color: supersetTheme.colorPrimaryText });
});

test('applies custom labelPublished tokens when set', () => {
  renderWithTokens(<PublishedLabel isPublished />, {
    labelPublishedColor: '#111111',
    labelPublishedBg: '#222222',
    labelPublishedBorderColor: '#333333',
  });
  const tag = screen.getByText('Published').closest('.ant-tag');
  expect(tag).toHaveStyle({
    color: '#111111',
    backgroundColor: '#222222',
    borderColor: '#333333',
  });
});

test('applies custom labelDraft tokens when set', () => {
  renderWithTokens(<PublishedLabel isPublished={false} />, {
    labelDraftColor: '#444444',
    labelDraftBg: '#555555',
    labelDraftBorderColor: '#666666',
  });
  const tag = screen.getByText('Draft').closest('.ant-tag');
  expect(tag).toHaveStyle({
    color: '#444444',
    backgroundColor: '#555555',
    borderColor: '#666666',
  });
});

test('applies custom labelPublishedIconColor to icon', () => {
  const { container } = renderWithTokens(<PublishedLabel isPublished />, {
    labelPublishedIconColor: '#aabbcc',
  });
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: '#aabbcc' });
});

test('applies custom labelDraftIconColor to icon', () => {
  const { container } = renderWithTokens(
    <PublishedLabel isPublished={false} />,
    { labelDraftIconColor: '#ddeeff' },
  );
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: '#ddeeff' });
});
