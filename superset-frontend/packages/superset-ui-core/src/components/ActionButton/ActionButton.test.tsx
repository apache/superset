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
import { render, screen, userEvent } from '@superset-ui/core/spec';
import { Icons } from '@superset-ui/core/components/Icons';
import { ActionButton } from '.';

const defaultProps = {
  label: 'test-action',
  icon: <Icons.EditOutlined />,
  onClick: jest.fn(),
};

test('renders action button with icon', () => {
  render(<ActionButton {...defaultProps} />);

  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
  expect(button).toHaveAttribute('data-test', 'test-action');
  expect(button).toHaveClass('action-button');
});

test('calls onClick when clicked', async () => {
  const onClick = jest.fn();
  render(<ActionButton {...defaultProps} onClick={onClick} />);

  const button = screen.getByRole('button');
  userEvent.click(button);

  expect(onClick).toHaveBeenCalledTimes(1);
});

test('renders with tooltip when tooltip prop is provided', async () => {
  const tooltipText = 'This is a tooltip';
  render(<ActionButton {...defaultProps} tooltip={tooltipText} />);

  const button = screen.getByRole('button');
  userEvent.hover(button);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent(tooltipText);
});

test('renders without tooltip when tooltip prop is not provided', async () => {
  render(<ActionButton {...defaultProps} />);

  const button = screen.getByRole('button');
  userEvent.hover(button);

  const tooltip = screen.queryByRole('tooltip');
  expect(tooltip).not.toBeInTheDocument();
});

test('supports ReactElement tooltip', async () => {
  const tooltipElement = <div>Custom tooltip content</div>;
  render(<ActionButton {...defaultProps} tooltip={tooltipElement} />);

  const button = screen.getByRole('button');
  userEvent.hover(button);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
  expect(tooltip).toHaveTextContent('Custom tooltip content');
});

test('renders different icons correctly', () => {
  render(<ActionButton {...defaultProps} icon={<Icons.DeleteOutlined />} />);

  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
});

test('renders with custom placement for tooltip', async () => {
  const tooltipText = 'Tooltip with custom placement';
  render(
    <ActionButton {...defaultProps} tooltip={tooltipText} placement="bottom" />,
  );

  const button = screen.getByRole('button');
  userEvent.hover(button);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();
});

test('has proper accessibility attributes', () => {
  render(<ActionButton {...defaultProps} />);

  const button = screen.getByRole('button');
  expect(button).toHaveAttribute('tabIndex', '0');
  expect(button).toHaveAttribute('role', 'button');
});
