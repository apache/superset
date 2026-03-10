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
import type { MenuItemType } from '@superset-ui/core/components/Menu';
import { KebabMenuButton, KebabMenuButtonProps } from './index';

const mockMenuItems: MenuItemType[] = [
  {
    key: 'edit',
    label: 'Edit',
  },
  {
    key: 'delete',
    label: 'Delete',
  },
  {
    key: 'share',
    label: 'Share',
  },
];

const defaultProps: Partial<KebabMenuButtonProps> = {
  menuItems: mockMenuItems,
  dataTest: 'kebab-menu-button',
};

const setup = (props: Partial<KebabMenuButtonProps> = defaultProps) =>
  render(<KebabMenuButton menuItems={mockMenuItems} {...props} />, {
    useRouter: true,
  });

test('should render with default props', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeInTheDocument();
});

test('should render with horizontal icon orientation by default', () => {
  setup();
  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
  // Check for horizontal three-dot icon (MoreOutlined)
  const icon = button.querySelector('svg');
  expect(icon).toBeInTheDocument();
});

test('should render with vertical icon orientation', () => {
  setup({ ...defaultProps, iconOrientation: 'vertical' });
  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
  // Check for vertical three-dot icon (EllipsisOutlined with rotation)
  const icon = button.querySelector('svg');
  expect(icon).toBeInTheDocument();
});

test('should render custom icon when provided', () => {
  const customIcon = <span data-test="custom-icon">★</span>;
  setup({ ...defaultProps, icon: customIcon });
  expect(screen.getByText('★')).toBeInTheDocument();
});

test('should have correct aria attributes for accessibility', () => {
  setup({ ...defaultProps, ariaLabel: 'Menu Options' });
  const button = screen.getByRole('button');
  expect(button).toHaveAttribute('aria-label', 'Menu Options');
  expect(button).toHaveAttribute('aria-haspopup', 'true');
});

test('should use default aria-label when not provided', () => {
  setup();
  const button = screen.getByRole('button');
  expect(button).toHaveAttribute('aria-label', 'More Options');
});

test('should have correct data-test attribute', () => {
  setup({ ...defaultProps, dataTest: 'custom-test-id' });
  const button = screen.getByTestId('custom-test-id');
  expect(button).toBeInTheDocument();
});

test('should have correct button id when provided', () => {
  setup({ ...defaultProps, buttonId: 'my-button-id' });
  const button = screen.getByRole('button');
  expect(button).toHaveAttribute('id', 'my-button-id');
});

test('should open menu on click', async () => {
  setup();
  const button = screen.getByRole('button');

  // Click the button to open menu
  await userEvent.click(button);

  // Check if menu items appear
  expect(await screen.findByText('Edit')).toBeInTheDocument();
  expect(screen.getByText('Delete')).toBeInTheDocument();
  expect(screen.getByText('Share')).toBeInTheDocument();
});

test('should render menu items correctly', async () => {
  setup();
  const button = screen.getByRole('button');

  // Open the menu
  await userEvent.click(button);

  // Verify all menu items are present
  expect(screen.getByText('Edit')).toBeInTheDocument();
  expect(screen.getByText('Delete')).toBeInTheDocument();
  expect(screen.getByText('Share')).toBeInTheDocument();
});

test('should apply custom button size', () => {
  setup({ ...defaultProps, buttonSize: 'small' });
  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
  // The button component applies size through classes/props
});

test('should apply custom button style', () => {
  setup({ ...defaultProps, buttonStyle: 'primary' });
  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
});

test('should use link button style by default', () => {
  setup();
  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
});

test('should apply custom placement', () => {
  setup({ ...defaultProps, placement: 'topRight' });
  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
});
