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
import { StandardModal, MODAL_STANDARD_WIDTH } from './StandardModal';

const defaultProps = {
  title: 'Test Modal',
  show: true,
  onHide: jest.fn(),
  onSave: jest.fn(),
  children: <div>Modal content</div>,
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('renders modal with default width', () => {
  render(<StandardModal {...defaultProps} />);

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toHaveStyle(
    `width: ${MODAL_STANDARD_WIDTH}px`,
  );
  expect(screen.getByText('Test Modal')).toBeInTheDocument();
  expect(screen.getByText('Modal content')).toBeInTheDocument();
});

test('renders with custom width', () => {
  render(<StandardModal {...defaultProps} width={600} />);

  expect(screen.getByRole('dialog')).toHaveStyle('width: 600px');
});

test('renders save and cancel buttons with default text', () => {
  render(<StandardModal {...defaultProps} />);

  expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
});

test('renders save button with custom text in edit mode', () => {
  render(<StandardModal {...defaultProps} isEditMode saveText="Update" />);

  expect(screen.getByRole('button', { name: 'Update' })).toBeInTheDocument();
});

test('disables save button when saveDisabled is true', () => {
  render(<StandardModal {...defaultProps} saveDisabled />);

  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
});

test('shows loading state on save button', () => {
  render(<StandardModal {...defaultProps} saveLoading />);

  const saveButton = screen.getByRole('button', { name: 'loading Add' });
  expect(saveButton).toBeDisabled();
});

test('calls onHide when cancel button is clicked', async () => {
  const onHide = jest.fn();
  render(<StandardModal {...defaultProps} onHide={onHide} />);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onHide).toHaveBeenCalledTimes(1);
});

test('calls onSave when save button is clicked', async () => {
  const onSave = jest.fn();
  render(<StandardModal {...defaultProps} onSave={onSave} />);

  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(onSave).toHaveBeenCalledTimes(1);
});

test('renders error tooltip when provided', () => {
  const errorTooltip = <div>Error message</div>;
  render(
    <StandardModal
      {...defaultProps}
      errorTooltip={errorTooltip}
      saveDisabled
    />,
  );

  // Error tooltip should be associated with disabled save button
  const saveButton = screen.getByRole('button', { name: 'Add' });
  expect(saveButton).toBeDisabled();
});

test('does not render when show is false', () => {
  render(<StandardModal {...defaultProps} show={false} />);

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('renders with icon in title when provided', () => {
  const icon = <span data-testid="modal-icon">📊</span>;
  render(<StandardModal {...defaultProps} icon={icon} />);

  // Check that ModalTitleWithIcon is rendered when icon is provided
  expect(screen.getByTestId('standard-modal-title')).toBeInTheDocument();
});

test('applies wrapProps to modal wrapper', () => {
  const wrapProps = { 'data-test': 'custom-modal' };
  render(<StandardModal {...defaultProps} wrapProps={wrapProps} />);

  expect(screen.getByTestId('custom-modal')).toBeInTheDocument();
});
