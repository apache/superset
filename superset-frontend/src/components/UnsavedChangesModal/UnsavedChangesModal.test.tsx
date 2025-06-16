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
import { fireEvent, render, waitFor } from 'spec/helpers/testing-library';
import UnsavedChangesModal from '.';

test('should render nothing if showModal is false', () => {
  const { queryByTestId } = render(
    <UnsavedChangesModal
      showModal={false}
      onHide={() => {}}
      handleSave={() => {}}
      onConfirmNavigation={() => {}}
    />,
  );

  expect(queryByTestId('unsaved-changes-modal')).not.toBeInTheDocument();
});

test('should render the UnsavedChangesModal component if showModal is true', async () => {
  const { findByTestId } = render(
    <UnsavedChangesModal
      showModal
      onHide={() => {}}
      handleSave={() => {}}
      onConfirmNavigation={() => {}}
    />,
  );

  expect(await findByTestId('unsaved-changes-modal')).toBeInTheDocument();
});

test('should only call onConfirmNavigation when click on the modal Discard button', async () => {
  const mockOnHide = jest.fn();
  const mockHandleSave = jest.fn();
  const mockOnConfirmNavigation = jest.fn();

  const { findByTestId } = render(
    <UnsavedChangesModal
      showModal
      onHide={mockOnHide}
      handleSave={mockHandleSave}
      onConfirmNavigation={mockOnConfirmNavigation}
    />,
  );

  await waitFor(async () => {
    expect(mockOnHide).toHaveBeenCalledTimes(0);
    expect(mockHandleSave).toHaveBeenCalledTimes(0);
    expect(mockOnConfirmNavigation).toHaveBeenCalledTimes(0);

    const cancelButton: HTMLElement = await findByTestId(
      'unsaved-modal-discard-button',
    );
    fireEvent.click(cancelButton);

    expect(mockOnHide).toHaveBeenCalledTimes(0);
    expect(mockHandleSave).toHaveBeenCalledTimes(0);
    expect(mockOnConfirmNavigation).toHaveBeenCalled();
  });
});

test('should only call handleSave when click on the modal Save button', async () => {
  const mockOnHide = jest.fn();
  const mockHandleSave = jest.fn();
  const mockOnConfirmNavigation = jest.fn();

  const { findByTestId } = render(
    <UnsavedChangesModal
      showModal
      onHide={mockOnHide}
      handleSave={mockHandleSave}
      onConfirmNavigation={mockOnConfirmNavigation}
    />,
  );

  await waitFor(async () => {
    expect(mockOnHide).toHaveBeenCalledTimes(0);
    expect(mockHandleSave).toHaveBeenCalledTimes(0);
    expect(mockOnConfirmNavigation).toHaveBeenCalledTimes(0);

    const confirmationButton: HTMLElement = await findByTestId(
      'unsaved-confirm-save-button',
    );
    fireEvent.click(confirmationButton);

    expect(mockHandleSave).toHaveBeenCalled();
    expect(mockOnHide).toHaveBeenCalledTimes(0);
    expect(mockOnConfirmNavigation).toHaveBeenCalledTimes(0);
  });
});
