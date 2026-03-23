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
import { screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { supersetTheme } from '@superset-ui/core';
import { DatasetTypeLabel } from './DatasetTypeLabel';
import { renderWithTheme } from './testUtils';

test('renders "Physical" text for physical dataset', () => {
  renderWithTheme(<DatasetTypeLabel datasetType="physical" />);
  expect(screen.getByText('Physical')).toBeInTheDocument();
});

test('renders "Virtual" text for virtual dataset', () => {
  renderWithTheme(<DatasetTypeLabel datasetType="virtual" />);
  expect(screen.getByText('Virtual')).toBeInTheDocument();
});

test('uses default primary color for physical label', () => {
  renderWithTheme(<DatasetTypeLabel datasetType="physical" />);
  const tag = screen
    .getByText('Physical')
    .closest('[data-test="dataset-type-label"]');
  expect(tag).toHaveStyle({ color: supersetTheme.colorPrimaryText });
});

test('uses default color for virtual label', () => {
  renderWithTheme(<DatasetTypeLabel datasetType="virtual" />);
  const tag = screen
    .getByText('Virtual')
    .closest('[data-test="dataset-type-label"]');
  expect(tag).toHaveStyle({ color: supersetTheme.colorPrimary });
});

test('applies custom labelDatasetPhysical tokens when set', () => {
  renderWithTheme(<DatasetTypeLabel datasetType="physical" />, {
    labelDatasetPhysicalColor: '#111111',
    labelDatasetPhysicalBg: '#222222',
    labelDatasetPhysicalBorderColor: '#333333',
  });
  const tag = screen
    .getByText('Physical')
    .closest('[data-test="dataset-type-label"]');
  expect(tag).toHaveStyle({
    color: '#111111',
    backgroundColor: '#222222',
    borderColor: '#333333',
  });
});

test('applies custom labelDatasetVirtual tokens when set', () => {
  renderWithTheme(<DatasetTypeLabel datasetType="virtual" />, {
    labelDatasetVirtualColor: '#444444',
    labelDatasetVirtualBg: '#555555',
    labelDatasetVirtualBorderColor: '#666666',
  });
  const tag = screen
    .getByText('Virtual')
    .closest('[data-test="dataset-type-label"]');
  expect(tag).toHaveStyle({
    color: '#444444',
    backgroundColor: '#555555',
    borderColor: '#666666',
  });
});

test('applies custom labelDatasetPhysicalIconColor to icon', () => {
  const { container } = renderWithTheme(
    <DatasetTypeLabel datasetType="physical" />,
    { labelDatasetPhysicalIconColor: '#aabbcc' },
  );
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: '#aabbcc' });
});

test('applies custom labelDatasetVirtualIconColor to icon', () => {
  const { container } = renderWithTheme(
    <DatasetTypeLabel datasetType="virtual" />,
    { labelDatasetVirtualIconColor: '#ddeeff' },
  );
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: '#ddeeff' });
});

test('uses default colorPrimary for physical dataset icon', () => {
  const { container } = renderWithTheme(
    <DatasetTypeLabel datasetType="physical" />,
  );
  const svg = container.querySelector('[role="img"]');
  expect(svg).toHaveStyle({ color: supersetTheme.colorPrimary });
});

test('virtual dataset icon has no explicit icon color by default', () => {
  const { container } = renderWithTheme(
    <DatasetTypeLabel datasetType="virtual" />,
  );
  const svg = container.querySelector('[role="img"]') as HTMLElement;
  // eslint-disable-next-line jest-dom/prefer-to-have-style
  expect(svg.style.color).toBe('');
});

test('partial token override uses custom bg with default color fallback', () => {
  renderWithTheme(<DatasetTypeLabel datasetType="physical" />, {
    labelDatasetPhysicalBg: '#ff0000',
  });
  const tag = screen
    .getByText('Physical')
    .closest('[data-test="dataset-type-label"]');
  expect(tag).toHaveStyle({
    backgroundColor: '#ff0000',
    color: supersetTheme.colorPrimaryText,
  });
});
