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

import { render, screen } from '../../testing';
import { Alert } from '.';

test('renders Alert with default props', async () => {
  const { container } = render(<Alert />);
  expect(container).toHaveTextContent('Default message');
});

// WCAG 3.3.1 - Error Identification accessibility tests
test('renders with role="alert" for screen reader announcement', () => {
  render(<Alert type="error">Error message</Alert>);
  expect(screen.getByRole('alert')).toBeInTheDocument();
});

test('renders with aria-atomic="true" so full content is announced', () => {
  render(<Alert type="error">Error message</Alert>);
  expect(screen.getByRole('alert')).toHaveAttribute('aria-atomic', 'true');
});

test('uses aria-live="assertive" for error alerts', () => {
  render(<Alert type="error">Error message</Alert>);
  expect(screen.getByRole('alert')).toHaveAttribute(
    'aria-live',
    'assertive',
  );
});

test('uses aria-live="polite" for warning alerts', () => {
  render(<Alert type="warning">Warning message</Alert>);
  expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
});

test('uses aria-live="polite" for info alerts', () => {
  render(<Alert type="info">Info message</Alert>);
  expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
});

test('uses aria-live="polite" for success alerts', () => {
  render(<Alert type="success">Success message</Alert>);
  expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'polite');
});
