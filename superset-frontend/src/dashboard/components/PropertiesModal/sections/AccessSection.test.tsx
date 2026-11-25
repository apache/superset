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
import {
  render,
  screen,
  selectOption,
  userEvent,
  within,
} from 'spec/helpers/testing-library';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { loadTags } from 'src/components/Tag/utils';
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
const mockedLoadTags = loadTags as jest.Mock;

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

test('always renders editors field', () => {
  mockedIsFeatureEnabled.mockReturnValue(false);

  render(<AccessSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-editors-field')).toBeInTheDocument();
});

test('does not render viewers field when EnableViewers is off', () => {
  mockedIsFeatureEnabled.mockReturnValue(false);

  render(<AccessSection {...defaultProps} />);

  expect(
    screen.queryByTestId('dashboard-viewers-field'),
  ).not.toBeInTheDocument();
});

test('renders viewers field when EnableViewers is on', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: any) => flag === FeatureFlag.EnableViewers,
  );

  render(<AccessSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-editors-field')).toBeInTheDocument();
  expect(screen.getByTestId('dashboard-viewers-field')).toBeInTheDocument();
});

test('renders tags field when TaggingSystem feature is enabled', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: any) => flag === FeatureFlag.TaggingSystem,
  );

  render(<AccessSection {...defaultProps} />);

  expect(screen.getByTestId('dashboard-tags-field')).toBeInTheDocument();
});

test('does not render tags field when TaggingSystem feature is disabled', () => {
  mockedIsFeatureEnabled.mockReturnValue(false);

  render(<AccessSection {...defaultProps} />);

  expect(screen.queryByTestId('dashboard-tags-field')).not.toBeInTheDocument();
});

test('disables inputs when loading', () => {
  mockedIsFeatureEnabled.mockReturnValue(false);

  render(<AccessSection {...defaultProps} isLoading />);

  expect(screen.getByTestId('dashboard-editors-field')).toBeInTheDocument();
});

test('shows editors helper text', () => {
  mockedIsFeatureEnabled.mockReturnValue(false);

  render(<AccessSection {...defaultProps} />);

  expect(screen.getByText(/Editors is a list of subjects/)).toBeInTheDocument();
});

test('shows editors and viewers helper text when EnableViewers is on', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: any) => flag === FeatureFlag.EnableViewers,
  );

  render(<AccessSection {...defaultProps} />);

  expect(screen.getByText(/Editors is a list of subjects/)).toBeInTheDocument();
  expect(screen.getByText(/Viewers is a list of subjects/)).toBeInTheDocument();
});

test('adds a picked tag to the existing selection', async () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.TaggingSystem,
  );
  mockedLoadTags.mockResolvedValue({
    data: [
      { value: 1, label: 'Important' },
      { value: 3, label: 'Review' },
    ],
    totalCount: 2,
  });

  render(<AccessSection {...defaultProps} />);

  await selectOption('Review', 'Tags');

  expect(defaultProps.onChangeTags).toHaveBeenCalledWith(
    [
      expect.objectContaining({ value: 1, label: 'Important' }),
      expect.objectContaining({ value: 3, label: 'Review' }),
    ],
    expect.anything(),
  );
});

test('shows selected tags in the tag selector', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.TaggingSystem,
  );

  const tags = [
    { id: 1, name: 'Important' },
    { id: 2, name: 'Urgent' },
  ];

  render(<AccessSection {...defaultProps} tags={tags} />);

  const tagsField = screen.getByTestId('dashboard-tags-field');
  expect(within(tagsField).getByText('Important')).toBeInTheDocument();
  expect(within(tagsField).getByText('Urgent')).toBeInTheDocument();
});

test('calls onClearTags when the tags are cleared', async () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.TaggingSystem,
  );

  render(<AccessSection {...defaultProps} />);

  const tagsField = screen.getByTestId('dashboard-tags-field');
  await userEvent.hover(within(tagsField).getByRole('combobox'));
  await userEvent.click(within(tagsField).getByLabelText('close-circle'));

  expect(defaultProps.onClearTags).toHaveBeenCalled();
});

test('shows tags helper text when TaggingSystem is enabled', () => {
  mockedIsFeatureEnabled.mockImplementation(
    (flag: FeatureFlag) => flag === FeatureFlag.TaggingSystem,
  );

  render(<AccessSection {...defaultProps} />);

  expect(
    screen.getByText(/A list of tags that have been applied to this dashboard/),
  ).toBeInTheDocument();
});
