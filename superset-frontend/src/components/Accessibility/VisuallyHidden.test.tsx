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
import VisuallyHidden from './VisuallyHidden';

test('renders children', () => {
  render(<VisuallyHidden>Screen-reader only text</VisuallyHidden>);
  expect(screen.getByText('Screen-reader only text')).toBeInTheDocument();
});

test('renders as span by default', () => {
  render(<VisuallyHidden>Default tag</VisuallyHidden>);
  const el = screen.getByText('Default tag');
  expect(el.tagName).toBe('SPAN');
});

test('renders as a custom element when as prop is provided', () => {
  render(<VisuallyHidden as="h1">Page heading</VisuallyHidden>);
  const el = screen.getByText('Page heading');
  expect(el.tagName).toBe('H1');
});

test('forwards id and className props', () => {
  render(
    <VisuallyHidden id="my-id" className="my-class">
      Text
    </VisuallyHidden>,
  );
  const el = screen.getByText('Text');
  expect(el).toHaveAttribute('id', 'my-id');
  expect(el).toHaveClass('my-class');
});

test('applies clip-rect style for screen-reader-only behavior', () => {
  render(<VisuallyHidden>Hidden</VisuallyHidden>);
  const el = screen.getByText('Hidden');
  expect(el).toHaveStyle({ position: 'absolute' });
});
