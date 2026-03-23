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
import { screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { supersetTheme } from '@superset-ui/core';
import { PublishedLabel } from './PublishedLabel';
import { renderWithTheme } from './testUtils';

test('renders "Published" text when isPublished is true', () => {
  renderWithTheme(<PublishedLabel isPublished />);
  expect(screen.getByText('Published')).toBeInTheDocument();
});

test('renders "Draft" text when isPublished is false', () => {
  renderWithTheme(<PublishedLabel isPublished={false} />);
  expect(screen.getByText('Draft')).toBeInTheDocument();
});

test('uses default success color for published label', () => {
  renderWithTheme(<PublishedLabel isPublished />);
  const tag = screen.getByText('Published').closest('.ant-tag');
  expect(tag).toHaveStyle({ color: supersetTheme.colorSuccessText });
});

test('uses default primary color for draft label', () => {
  renderWithTheme(<PublishedLabel isPublished={false} />);
  const tag = screen.getByText('Draft').closest('.ant-tag');
  expect(tag).toHaveStyle({ color: supersetTheme.colorPrimaryText });
});

test('applies custom labelPublished tokens when set', () => {
  renderWithTheme(<PublishedLabel isPublished />, {
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
  renderWithTheme(<PublishedLabel isPublished={false} />, {
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
  const { container } = renderWithTheme(<PublishedLabel isPublished />, {
    labelPublishedIconColor: '#aabbcc',
  });
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: '#aabbcc' });
});

test('applies custom labelDraftIconColor to icon', () => {
  const { container } = renderWithTheme(
    <PublishedLabel isPublished={false} />,
    { labelDraftIconColor: '#ddeeff' },
  );
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: '#ddeeff' });
});

test('uses default colorSuccess for published icon', () => {
  const { container } = renderWithTheme(<PublishedLabel isPublished />);
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: supersetTheme.colorSuccess });
});

test('uses default colorPrimary for draft icon', () => {
  const { container } = renderWithTheme(<PublishedLabel isPublished={false} />);
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: supersetTheme.colorPrimary });
});

test('calls onClick handler when clicked', () => {
  const handleClick = jest.fn();
  renderWithTheme(<PublishedLabel isPublished onClick={handleClick} />);
  fireEvent.click(screen.getByText('Published'));
  expect(handleClick).toHaveBeenCalledTimes(1);
});

test('partial token override uses custom bg with default color fallback', () => {
  renderWithTheme(<PublishedLabel isPublished />, {
    labelPublishedBg: '#ff0000',
  });
  const tag = screen.getByText('Published').closest('.ant-tag');
  expect(tag).toHaveStyle({
    backgroundColor: '#ff0000',
    color: supersetTheme.colorSuccessText,
  });
});
