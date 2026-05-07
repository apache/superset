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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import SkipLink from './SkipLink';

const createTarget = (id: string) => {
  const target = document.createElement('div');
  target.id = id;
  document.body.appendChild(target);
  return target;
};

afterEach(() => {
  document.body.replaceChildren();
});

test('renders the default label', () => {
  render(<SkipLink />);
  expect(screen.getByText('Skip to main content')).toBeInTheDocument();
});

test('renders custom children when provided', () => {
  render(<SkipLink>Jump to content</SkipLink>);
  expect(screen.getByText('Jump to content')).toBeInTheDocument();
});

test('href targets the default main-content id', () => {
  render(<SkipLink />);
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', '#main-content');
});

test('href reflects custom targetId', () => {
  render(<SkipLink targetId="my-target">Skip</SkipLink>);
  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', '#my-target');
});

test('focuses the target element on click', async () => {
  const target = createTarget('target-area');
  render(<SkipLink targetId="target-area">Skip</SkipLink>);

  const link = screen.getByRole('link');
  await userEvent.click(link);

  expect(document.activeElement).toBe(target);
});

test('does not leave a permanent tabindex on the target after blur', async () => {
  const target = createTarget('target-area');
  render(<SkipLink targetId="target-area">Skip</SkipLink>);

  const link = screen.getByRole('link');
  await userEvent.click(link);

  expect(target).toHaveAttribute('tabindex', '-1');

  target.dispatchEvent(new FocusEvent('blur'));
  expect(target.hasAttribute('tabindex')).toBe(false);
});
