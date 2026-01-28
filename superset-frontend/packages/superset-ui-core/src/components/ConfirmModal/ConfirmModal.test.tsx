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
import { ThemeProvider, supersetTheme } from '@apache-superset/core/ui';
import { ConfirmModal } from '.';

const defaultProps = {
  show: true,
  onHide: jest.fn(),
  onConfirm: jest.fn(),
  title: 'Confirm Action',
  body: 'Are you sure you want to proceed?',
};

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={supersetTheme}>{component}</ThemeProvider>);

test('renders modal with title and body', () => {
  renderWithTheme(<ConfirmModal {...defaultProps} />);

  expect(screen.getByText('Confirm Action')).toBeInTheDocument();
  expect(
    screen.getByText('Are you sure you want to proceed?'),
  ).toBeInTheDocument();
});

test('renders default confirm and cancel buttons', () => {
  renderWithTheme(<ConfirmModal {...defaultProps} />);

  expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
});

test('renders custom button text', () => {
  renderWithTheme(
    <ConfirmModal {...defaultProps} confirmText="Delete" cancelText="Keep" />,
  );

  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
});

test('calls onConfirm when confirm button is clicked', () => {
  const onConfirm = jest.fn();
  renderWithTheme(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

  userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test('calls onHide when cancel button is clicked', () => {
  const onHide = jest.fn();
  renderWithTheme(<ConfirmModal {...defaultProps} onHide={onHide} />);

  userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(onHide).toHaveBeenCalledTimes(1);
});

test('renders danger button style', () => {
  renderWithTheme(
    <ConfirmModal {...defaultProps} confirmButtonStyle="danger" />,
  );

  const confirmButton = screen.getByRole('button', { name: 'Confirm' });
  expect(confirmButton).toBeInTheDocument();
});

test('shows loading state on confirm button', () => {
  renderWithTheme(<ConfirmModal {...defaultProps} loading />);

  const confirmButton = screen.getByRole('button', { name: /Confirm/ });
  expect(confirmButton).toBeInTheDocument();
  expect(confirmButton).toHaveClass('ant-btn-loading');
});

test('disables buttons when loading', () => {
  renderWithTheme(<ConfirmModal {...defaultProps} loading />);

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  expect(cancelButton).toBeDisabled();
});

test('renders custom icon', () => {
  const CustomIcon = () => <span data-test="custom-icon">!</span>;
  renderWithTheme(<ConfirmModal {...defaultProps} icon={<CustomIcon />} />);

  expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
});

test('renders ReactNode as body', () => {
  renderWithTheme(
    <ConfirmModal
      {...defaultProps}
      body={
        <div>
          <p>Line 1</p>
          <p>Line 2</p>
        </div>
      }
    />,
  );

  expect(screen.getByText('Line 1')).toBeInTheDocument();
  expect(screen.getByText('Line 2')).toBeInTheDocument();
});

test('does not render when show is false', () => {
  renderWithTheme(<ConfirmModal {...defaultProps} show={false} />);

  expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
});
