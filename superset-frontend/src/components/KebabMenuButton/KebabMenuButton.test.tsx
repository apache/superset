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
  fireEvent,
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

test.each([undefined, 'Some actions require edit access'])(
  'Tab returns focus from the menu to More Options (hint=%s)',
  async tooltipTitle => {
    render(
      <KebabMenuButton menuItems={menuItems} tooltipTitle={tooltipTitle} />,
    );
    const trigger = screen.getByRole('button', { name: 'More Options' });
    await userEvent.click(trigger);
    const item = await screen.findByRole('menuitem', { name: 'Edit' });
    // Wait for the real Dropdown autoFocus rather than assigning focus in the test.
    await waitFor(() => expect(item).toHaveFocus());
    fireEvent.keyDown(item, { key: 'Tab', code: 'Tab', keyCode: 9, which: 9 });
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument(),
    );
    expect(trigger).toHaveFocus();
  },
);

test('focus exposes the hint as the trigger accessible description', async () => {
  render(
    <KebabMenuButton
      menuItems={menuItems}
      tooltipTitle="Edit requires ownership"
    />,
  );
  await userEvent.tab();
  const trigger = screen.getByRole('button', { name: 'More Options' });
  expect(trigger).toHaveFocus();
  const tooltip = await screen.findByRole('tooltip');
  expect(trigger).toHaveAttribute('aria-describedby', tooltip.id);
  expect(trigger).toHaveAccessibleDescription('Edit requires ownership');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('opens the menu on click', async () => {
  render(
    <KebabMenuButton
      menuItems={menuItems}
      tooltipTitle="Some actions require edit access"
    />,
  );

  await userEvent.click(screen.getByRole('button', { name: 'More Options' }));

  expect(await screen.findByText('Edit')).toBeInTheDocument();
  expect(screen.getByText('Delete')).toBeInTheDocument();
});

test('hint ids are distinct and the description is removed when the hint disappears', () => {
  const { rerender } = render(
    <>
      <KebabMenuButton menuItems={menuItems} tooltipTitle="First hint" />
      <KebabMenuButton menuItems={menuItems} tooltipTitle="Second hint" />
    </>,
  );
  const [first, second] = screen.getAllByRole('button', {
    name: 'More Options',
  });
  const firstId = first.getAttribute('aria-describedby');
  expect(firstId).toBeTruthy();
  expect(second.getAttribute('aria-describedby')).toBeTruthy();
  expect(firstId).not.toBe(second.getAttribute('aria-describedby'));
  rerender(
    <>
      <KebabMenuButton menuItems={menuItems} tooltipTitle="Updated hint" />
      <KebabMenuButton menuItems={menuItems} />
    </>,
  );
  expect(first).toHaveAttribute('aria-describedby', firstId);
  expect(second).not.toHaveAttribute('aria-describedby');
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
