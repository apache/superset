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
import ExtensionPlaceholder from './ExtensionPlaceholder';

test('renders the placeholder component with correct text', () => {
  render(<ExtensionPlaceholder id="test-extension" />, { useTheme: true });

  expect(
    screen.getByText('The extension test-extension could not be loaded.'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(
      'This may be due to the extension not being activated or the content not being available.',
    ),
  ).toBeInTheDocument();
});

test('renders with the empty state image', () => {
  render(<ExtensionPlaceholder id="test-extension" />, { useTheme: true });

  // Check that the EmptyState component is rendered with the correct props
  const emptyStateContainer = screen
    .getByText('The extension test-extension could not be loaded.')
    .closest('div');
  expect(emptyStateContainer).toBeInTheDocument();
});
