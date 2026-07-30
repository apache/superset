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
import { render, screen, userEvent, within } from '@superset-ui/core/spec';
import { Modal } from '@superset-ui/core/components';
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

test('renders above an already-open modal without a hardcoded z-index', () => {
  // Regression test for a bug where this modal could render BEHIND another
  // already-open modal (e.g. a draggable "View query" modal), because its
  // z-index was pinned to a hardcoded constant instead of relying on Ant
  // Design's automatic z-index stacking. Since this modal is always opened
  // on top of whatever it's interrupting, it should always come out ahead
  // with no manual override at all.
  render(
    <>
      <Modal show title="Other open modal" onHide={() => {}}>
        <div>Other modal content</div>
      </Modal>
      <UnsavedChangesModal
        showModal
        onHide={() => {}}
        handleSave={() => {}}
        onConfirmNavigation={() => {}}
      />
    </>,
  );

  // rc-util's `useId` hook always returns the same mocked id ("test-id")
  // in test environments, so with two modals open at once their
  // `aria-labelledby` ids collide and `getByRole('dialog', { name })` can't
  // tell them apart. Find each dialog by its title text instead.
  const dialogs = screen.getAllByRole('dialog');
  const otherDialog = dialogs.find(dialog =>
    within(dialog).queryByText('Other open modal'),
  );
  const unsavedChangesDialog = dialogs.find(dialog =>
    within(dialog).queryByText('Unsaved Changes'),
  );

  expect(otherDialog).toBeDefined();
  expect(unsavedChangesDialog).toBeDefined();

  // Ant Design applies the automatically-assigned stacking z-index to the
  // `.ant-modal-wrap` element that wraps the dialog, not to the dialog
  // (`role="dialog"`) element itself, so the wrapper is what needs checking.
  const otherWrap = otherDialog?.closest<HTMLElement>('.ant-modal-wrap');
  const unsavedChangesWrap =
    unsavedChangesDialog?.closest<HTMLElement>('.ant-modal-wrap');

  expect(otherWrap).not.toBeNull();
  expect(unsavedChangesWrap).not.toBeNull();

  const otherZIndex = Number(getComputedStyle(otherWrap as HTMLElement).zIndex);
  const unsavedChangesZIndex = Number(
    getComputedStyle(unsavedChangesWrap as HTMLElement).zIndex,
  );

  expect(unsavedChangesZIndex).toBeGreaterThan(otherZIndex);
});
