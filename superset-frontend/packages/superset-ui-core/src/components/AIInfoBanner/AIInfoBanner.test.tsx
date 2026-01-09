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

import { render, screen, waitFor } from '@superset-ui/core/spec';
import userEvent from '@testing-library/user-event';
import { AIInfoBanner } from '.';

test('renders with default props', () => {
  render(<AIInfoBanner text="Hello AI" />);
  const banner = screen.getByTestId('ai-info-banner');
  expect(banner).toBeInTheDocument();
  expect(banner).toHaveAttribute('role', 'status');
  expect(banner).toHaveAttribute('aria-live', 'polite');
});

test('displays text with typing effect', async () => {
  const testText = 'Test message';
  render(<AIInfoBanner text={testText} typingSpeed={10} />);

  // Wait for text to be fully typed
  await waitFor(
    () => {
      expect(screen.getByText(testText)).toBeInTheDocument();
    },
    { timeout: 500 },
  );
});

test('shows close button when dismissible is true (default)', () => {
  render(<AIInfoBanner text="Test" />);
  const closeButton = screen.getByTestId('ai-info-banner-close');
  expect(closeButton).toBeInTheDocument();
});

test('hides close button when dismissible is false', () => {
  render(<AIInfoBanner text="Test" dismissible={false} />);
  expect(
    screen.queryByTestId('ai-info-banner-close'),
  ).not.toBeInTheDocument();
});

test('calls onDismiss and hides banner when close button is clicked', async () => {
  const onDismiss = jest.fn();
  render(<AIInfoBanner text="Test" onDismiss={onDismiss} />);

  const closeButton = screen.getByTestId('ai-info-banner-close');
  await userEvent.click(closeButton);

  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('ai-info-banner')).not.toBeInTheDocument();
});

test('accepts custom className', () => {
  render(<AIInfoBanner text="Test" className="custom-class" />);
  const banner = screen.getByTestId('ai-info-banner');
  expect(banner).toHaveClass('custom-class');
});

test('accepts custom data-test attribute', () => {
  render(<AIInfoBanner text="Test" data-test="custom-test-id" />);
  expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
});
