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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import type { MenuItem } from '@superset-ui/core/components/Menu';
import { KebabMenuButton } from '.';

const menuItems: MenuItem[] = [
  {
    key: 'edit',
    label: 'Edit',
  },
  {
    key: 'delete',
    label: 'Delete',
  },
];

test('opens the menu on click', async () => {
  render(<KebabMenuButton menuItems={menuItems} />);

  await userEvent.click(screen.getByRole('button', { name: 'More Options' }));

  expect(await screen.findByText('Edit')).toBeInTheDocument();
  expect(screen.getByText('Delete')).toBeInTheDocument();
});

test('does not open the menu on hover', async () => {
  render(<KebabMenuButton menuItems={menuItems} />);

  await userEvent.hover(screen.getByRole('button', { name: 'More Options' }));

  await waitFor(() => {
    expect(screen.queryByText('Edit')).not.toBeInTheDocument();
  });
});

test('sets accessibility and test attributes on the trigger button', () => {
  render(
    <KebabMenuButton
      menuItems={menuItems}
      ariaLabel="Open actions"
      buttonId="actions-menu"
      dataTest="actions-menu-trigger"
    />,
  );

  const button = screen.getByRole('button', { name: 'Open actions' });
  expect(button).toHaveAttribute('id', 'actions-menu');
  expect(button).toHaveAttribute('aria-haspopup', 'true');
  expect(button).toHaveAttribute('data-test', 'actions-menu-trigger');
});

test('renders a custom icon', () => {
  render(
    <KebabMenuButton
      menuItems={menuItems}
      icon={<span data-test="custom-menu-icon">Actions</span>}
    />,
  );

  expect(screen.getByTestId('custom-menu-icon')).toBeInTheDocument();
});

test('renders a rotated vertical icon when requested', () => {
  render(<KebabMenuButton menuItems={menuItems} iconOrientation="vertical" />);

  const button = screen.getByRole('button', { name: 'More Options' });
  expect(button.querySelector('[style*="rotate(90deg)"]')).toBeInTheDocument();
});
