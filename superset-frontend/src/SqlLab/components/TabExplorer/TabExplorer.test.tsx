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
import TabExplorer from '.';

jest.mock('../DatabaseSelectorPopover', () => ({
  __esModule: true,
  default: () => <div data-test="mock-database-selector-popover" />,
}));

jest.mock('../TableExploreTree', () => ({
  __esModule: true,
  default: () => <div data-test="mock-table-explore-tree" />,
}));

const originalLocation = window.location;

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: originalLocation,
    writable: true,
  });
});

test('renders the database selector and the table explore tree', () => {
  render(<TabExplorer queryEditorId="qe1" />, { useRedux: true });

  expect(
    screen.getByTestId('mock-database-selector-popover'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('mock-table-explore-tree')).toBeInTheDocument();
  expect(screen.queryByText('Reset state')).not.toBeInTheDocument();
});

test('shows a reset button only when ?reset=1', async () => {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocation, search: '?reset=1' },
    writable: true,
  });

  render(<TabExplorer queryEditorId="qe1" />, { useRedux: true });

  const resetButton = screen.getByText('Reset state');
  expect(resetButton).toBeInTheDocument();
  await userEvent.click(resetButton);
});
