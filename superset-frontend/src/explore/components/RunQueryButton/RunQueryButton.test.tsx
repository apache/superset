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

import { render, screen, userEvent } from 'spec/helpers/testing-library';
import { RunQueryButton } from './index';

const createProps = (overrides: Record<string, any> = {}) => ({
  loading: false,
  onQuery: jest.fn(),
  onStop: jest.fn(),
  errorMessage: null,
  isNewChart: false,
  canStopQuery: true,
  chartIsStale: true,
  ...overrides,
});

test('renders update chart button', () => {
  const props = createProps();
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Update chart')).toBeVisible();
  userEvent.click(screen.getByRole('button'));
  expect(props.onQuery).toHaveBeenCalled();
});

test('renders create chart button', () => {
  const props = createProps({ isNewChart: true });
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Create chart')).toBeVisible();
  userEvent.click(screen.getByRole('button'));
  expect(props.onQuery).toHaveBeenCalled();
});

test('renders disabled button', () => {
  const props = createProps({ errorMessage: 'error' });
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Update chart')).toBeVisible();
  expect(screen.getByRole('button')).toBeDisabled();
  userEvent.click(screen.getByRole('button'));
  expect(props.onQuery).not.toHaveBeenCalled();
});

test('renders query running button', () => {
  const props = createProps({ loading: true });
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Stop')).toBeVisible();
  userEvent.click(screen.getByRole('button'));
  expect(props.onStop).toHaveBeenCalled();
});

test('renders query running button disabled', () => {
  const props = createProps({ loading: true, canStopQuery: false });
  render(<RunQueryButton {...props} />);
  expect(screen.getByText('Stop')).toBeVisible();
  expect(screen.getByRole('button')).toBeDisabled();
  userEvent.click(screen.getByRole('button'));
  expect(props.onStop).not.toHaveBeenCalled();
});
