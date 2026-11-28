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

const targets: HTMLElement[] = [];

const createTarget = (id: string) => {
  const target = document.createElement('div');
  target.id = id;
  document.body.appendChild(target);
  targets.push(target);
  return target;
};

afterEach(() => {
  targets.splice(0).forEach(target => target.remove());
  window.location.hash = '';
});

test('renders the default label pointing at #main-content', () => {
  render(<SkipLink />);
  expect(
    screen.getByRole('link', { name: 'Skip to main content' }),
  ).toHaveAttribute('href', '#main-content');
});

test('renders custom children and targetId', () => {
  render(<SkipLink targetId="my-target">Jump to content</SkipLink>);
  expect(screen.getByRole('link', { name: 'Jump to content' })).toHaveAttribute(
    'href',
    '#my-target',
  );
});

// A fixed negative offset leaves part of the link visible once larger text
// makes it taller than the offset; translating by its own height does not.
test('hides the link by its own height until it is focused', () => {
  render(<SkipLink />);
  const link = screen.getByRole('link', { name: 'Skip to main content' });
  expect(link).toHaveStyle({ transform: 'translateY(-100%)' });
  expect(link).not.toHaveStyle({ top: '-100px' });
});

test('moves focus to the target and removes the temporary tabindex on blur', async () => {
  const target = createTarget('target-area');
  render(<SkipLink targetId="target-area">Skip</SkipLink>);

  await userEvent.click(screen.getByRole('link', { name: 'Skip' }));

  expect(target).toHaveFocus();
  expect(target).toHaveAttribute('tabindex', '-1');

  target.blur();
  expect(target).not.toHaveAttribute('tabindex');
});

test('keeps a tabindex the target already had', async () => {
  const target = createTarget('target-area');
  target.setAttribute('tabindex', '0');
  render(<SkipLink targetId="target-area">Skip</SkipLink>);

  await userEvent.click(screen.getByRole('link', { name: 'Skip' }));
  expect(target).toHaveFocus();

  target.blur();
  expect(target).toHaveAttribute('tabindex', '0');
});

test('falls back to the URL hash when the target is missing', async () => {
  render(<SkipLink targetId="missing-target">Skip</SkipLink>);

  await userEvent.click(screen.getByRole('link', { name: 'Skip' }));

  expect(window.location.hash).toBe('#missing-target');
});
