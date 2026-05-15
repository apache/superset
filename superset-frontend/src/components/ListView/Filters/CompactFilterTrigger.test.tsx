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
import userEvent from '@testing-library/user-event';
import CompactFilterTrigger from './CompactFilterTrigger';

const defaultProps = {
  label: 'Owner',
  hasValue: false,
  onClear: jest.fn(),
  children: <div data-testid="filter-content">Filter content</div>,
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders the label', () => {
  render(<CompactFilterTrigger {...defaultProps} />);
  expect(screen.getByText('Owner')).toBeInTheDocument();
});

test('renders as inactive pill with down chevron when hasValue is false', () => {
  render(<CompactFilterTrigger {...defaultProps} />);
  const pill = screen.getByTestId('compact-filter-pill');
  expect(pill).toBeInTheDocument();
});

test('renders active state with close icon when hasValue is true', () => {
  render(<CompactFilterTrigger {...defaultProps} hasValue />);
  // The close icon has role="button" with aria-label="close"
  expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
});

test('toggles aria-expanded when pill is clicked', async () => {
  render(<CompactFilterTrigger {...defaultProps} />);
  const pill = screen.getByTestId('compact-filter-pill');
  expect(pill).toHaveAttribute('aria-expanded', 'false');
  await userEvent.click(pill);
  expect(pill).toHaveAttribute('aria-expanded', 'true');
});

test('calls onClear when clear icon is clicked', async () => {
  const onClear = jest.fn();
  render(<CompactFilterTrigger {...defaultProps} hasValue onClear={onClear} />);
  // The close icon has role="button" with aria-label="close"
  const closeIcon = screen.getByRole('button', { name: /close/i });
  await userEvent.click(closeIcon);
  expect(onClear).toHaveBeenCalledTimes(1);
});
