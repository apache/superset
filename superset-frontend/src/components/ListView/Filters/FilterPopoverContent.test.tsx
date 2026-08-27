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
import FilterPopoverContent from './FilterPopoverContent';

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders children inside the wrapper', () => {
  render(
    <FilterPopoverContent>
      <div data-test="inner-content">Inner content</div>
    </FilterPopoverContent>,
  );
  expect(screen.getByTestId('inner-content')).toBeInTheDocument();
});

test('renders the Apply button', () => {
  render(
    <FilterPopoverContent>
      <div>content</div>
    </FilterPopoverContent>,
  );
  expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
});

test('calls onClose when Apply button is clicked', async () => {
  const onClose = jest.fn();
  render(
    <FilterPopoverContent onClose={onClose}>
      <div>content</div>
    </FilterPopoverContent>,
  );
  await userEvent.click(screen.getByRole('button', { name: /apply/i }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('renders without onClose and clicking Apply does not throw', async () => {
  render(
    <FilterPopoverContent>
      <div>content</div>
    </FilterPopoverContent>,
  );
  // No onClose prop — click should not throw
  await userEvent.click(screen.getByRole('button', { name: /apply/i }));
  expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
});

test('visually hides label elements so pills remain accessible', () => {
  render(
    <FilterPopoverContent>
      <label htmlFor="input">Date range</label>
      <input id="input" />
    </FilterPopoverContent>,
  );
  const label = screen.getByText('Date range');
  // The label must be in the DOM for screen readers but visually hidden via CSS
  expect(label).toBeInTheDocument();
  const computedStyle = window.getComputedStyle(label);
  // clip / overflow hidden pattern applied; position absolute is the key indicator
  expect(computedStyle.position).toBe('absolute');
});
