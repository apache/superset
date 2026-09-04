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
import { UnsavedChangesModal } from '.';

test('should render nothing if showModal is false', () => {
  const { queryByRole } = render(
    <UnsavedChangesModal
      showModal={false}
      onHide={() => {}}
      handleSave={() => {}}
      onConfirmNavigation={() => {}}
    />,
  );

  expect(queryByRole('dialog')).not.toBeInTheDocument();
});

test('should render the UnsavedChangesModal component if showModal is true', async () => {
  const { queryByRole } = render(
    <UnsavedChangesModal
      showModal
      onHide={() => {}}
      handleSave={() => {}}
      onConfirmNavigation={() => {}}
    />,
  );

  expect(queryByRole('dialog')).toBeInTheDocument();
});

test('should only call onConfirmNavigation when clicking the Discard button', async () => {
  const mockOnHide = jest.fn();
  const mockHandleSave = jest.fn();
  const mockOnConfirmNavigation = jest.fn();

  render(
    <UnsavedChangesModal
      showModal
      onHide={mockOnHide}
      handleSave={mockHandleSave}
      onConfirmNavigation={mockOnConfirmNavigation}
    />,
  );

  const discardButton: HTMLElement = await screen.findByRole('button', {
    name: /discard/i,
  });

  userEvent.click(discardButton);

  expect(mockOnConfirmNavigation).toHaveBeenCalled();
  expect(mockHandleSave).not.toHaveBeenCalled();
  expect(mockOnHide).not.toHaveBeenCalled();
});

test('should only call handleSave when clicking the Save button', async () => {
  const mockOnHide = jest.fn();
  const mockHandleSave = jest.fn();
  const mockOnConfirmNavigation = jest.fn();

  render(
    <UnsavedChangesModal
      showModal
      onHide={mockOnHide}
      handleSave={mockHandleSave}
      onConfirmNavigation={mockOnConfirmNavigation}
    />,
  );

  const saveButton: HTMLElement = await screen.findByRole('button', {
    name: /save/i,
  });

  userEvent.click(saveButton);

  expect(mockHandleSave).toHaveBeenCalled();
  expect(mockOnHide).not.toHaveBeenCalled();
  expect(mockOnConfirmNavigation).not.toHaveBeenCalled();
});
