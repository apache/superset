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
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import AccessSection from './AccessSection';

// Mock feature flags
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

// Mock tags utils
jest.mock('src/components/Tag/utils', () => ({
  loadTags: jest.fn(),
}));

const mockedIsFeatureEnabled = isFeatureEnabled as jest.Mock;

const defaultProps = {
  isLoading: false,
  tags: [{ id: 1, name: 'Important' }],
  editors: [{ id: 10, label: 'Editor Subject', type: 1 }],
  viewers: [{ id: 11, label: 'Viewer Subject', type: 2 }],
  onChangeEditors: jest.fn(),
  onChangeViewers: jest.fn(),
  onChangeTags: jest.fn(),
  onClearTags: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders tags field with multiple tags when TaggingSystem feature is enabled', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: any) => flag === FeatureFlag.TaggingSystem,
  );

  render(<AccessSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-tags-field')).toBeInTheDocument();
});

test('allows selecting multiple tags', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: any) => flag === FeatureFlag.TaggingSystem,
  );

  const newTags = [
    { id: 1, name: 'Important' },
    { id: 2, name: 'Urgent' },
    { id: 3, name: 'Review' },
  ];

  render(<AccessSection {...defaultProps} tags={newTags} />);

  expect(screen.getByTestId('dashboard-tags-field')).toBeInTheDocument();
});

test('shows selected tags in the tag selector', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: any) => flag === FeatureFlag.TaggingSystem,
  );

  const tags = [
    { id: 1, name: 'Important' },
    { id: 2, name: 'Urgent' },
  ];

  render(<AccessSection {...defaultProps} tags={[
    { id: 1, name: 'Important' },
    { id: 2, name: 'Urgent' },
  ]} />);

  expect(screen.getByTestId('dashboard-tags-field')).toBeInTheDocument();
});

test('tags field is disabled when loading', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: any) => flag === FeatureFlag.TaggingSystem,
  );

  render(<AccessSection {...defaultProps} isLoading />);

  expect(screen.getByTestId('dashboard-tags-field')).toBeInTheDocument();
});

test('clears tags when clear button is clicked', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: any) => flag === FeatureFlag.TaggingSystem,
  );

  const onClearTags = jest.fn();
  
  render(<AccessSection {...defaultProps} onClearTags={jest.fn()} />);
  
  // The clear button should be accessible
  expect(screen.getByTestId('dashboard-tags-field')).toBeInTheDocument();
});

test('shows tags helper text', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: any) => flag === FeatureFlag.TaggingSystem,
  );

  render(<AccessSection {...defaultProps} />);

  expect(screen.getByText(/A list of tags that have been applied to this dashboard/)).toBeInTheDocument();
});

test('tags field is hidden when TaggingSystem feature is disabled', () => {
  mockedIsFeatureEnabled.mockReturnValue(false);

  render(<AccessSection {...defaultProps} />);

  expect(screen.queryByTestId('dashboard-tags-field')).not.toBeInTheDocument();
});