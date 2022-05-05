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

import React from 'react';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { SelectAllButton } from './index';

const createProps = (overrides: Record<string, any> = {}) => ({
  onSelectAll: jest.fn(),
  selectMode: jest.fn(),
  deselectEnabled: false,
  ...overrides,
});

test('renders select all button', () => {
  const props = createProps();
  render(<SelectAllButton {...props} />);
  expect(screen.getByText('Select All')).toBeVisible();
  userEvent.click(screen.getByRole('button'));
  expect(props.onSelectAll).toHaveBeenCalled();
});

test('renders deselect all button when deselect is enabled', () => {
  const props = createProps({ deselectEnabled: true, selectMode: () => false });
  render(<SelectAllButton {...props} />);
  expect(screen.getByText('Deselect All')).toBeVisible();
  userEvent.click(screen.getByRole('button'));
  expect(props.onSelectAll).toHaveBeenCalled();
});

test('renders disabled select all button when deselect is not enabled', () => {
  const props = createProps({ selectMode: () => false });
  render(<SelectAllButton {...props} />);
  expect(screen.getByText('Select All')).toBeVisible();
  expect(screen.getByRole('button')).toBeDisabled();
  userEvent.click(screen.getByRole('button'));
  expect(props.onSelectAll).not.toHaveBeenCalled();
});
