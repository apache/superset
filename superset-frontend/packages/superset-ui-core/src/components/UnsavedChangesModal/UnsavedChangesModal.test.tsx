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
import { useState } from 'react';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from '@superset-ui/core/spec';
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

// Regression coverage for the underlying bug (#42510): this modal could
// render BEHIND another already-open modal (e.g. a draggable "View query"
// modal). Ant Design only assigns a Modal a higher z-index automatically
// when it's nested inside another *currently open* Modal's React tree --
// two top-level siblings (this modal's Modal and whatever it's interrupting
// are always siblings, never nested in each other) both fall back to the
// same static z-index, tie-broken by DOM order: whichever `.ant-modal-wrap`
// comes later in the document paints on top. So the invariant this modal
// actually needs to hold isn't "higher z-index than the other modal" (both
// are legitimately unset/tied by design) -- it's "always ends up later in
// the DOM than whatever it's interrupting, no matter what already happened
// on the page." A modal's wrap node is created once, lazily, on first open,
// and normally stays in that DOM position forever; `destroyOnHidden` is
// what makes every open recreate it fresh at the end of the document.
function dialogWrap(titleText: string) {
  const dialogs = screen.queryAllByRole('dialog');
  // rc-util's `useId` hook always returns the same mocked id ("test-id") in
  // test environments, so with two dialogs open at once their
  // `aria-labelledby` ids collide and `getByRole('dialog', { name })` can't
  // tell them apart. Find each by its title text instead.
  const dialog = dialogs.find(d => within(d).queryByText(titleText));
  return dialog?.closest<HTMLElement>('.ant-modal-wrap') ?? null;
}

test('renders above an already-open modal without a hardcoded z-index', async () => {
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

  const otherWrap = await waitFor(() => {
    const wrap = dialogWrap('Other open modal');
    expect(wrap).not.toBeNull();
    return wrap as HTMLElement;
  });
  const unsavedChangesWrap = await waitFor(() => {
    const wrap = dialogWrap('Unsaved Changes');
    expect(wrap).not.toBeNull();
    return wrap as HTMLElement;
  });

  // eslint-disable-next-line no-bitwise
  expect(
    otherWrap.compareDocumentPosition(unsavedChangesWrap) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

test('still renders on top after being opened, closed, and reopened once the other modal is already open', async () => {
  function Harness() {
    const [showOther, setShowOther] = useState(false);
    const [showUnsaved, setShowUnsaved] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setShowOther(true)}>
          open other
        </button>
        <button type="button" onClick={() => setShowUnsaved(true)}>
          open unsaved
        </button>
        <Modal
          show={showOther}
          title="Other open modal"
          onHide={() => setShowOther(false)}
        >
          <div>Other modal content</div>
        </Modal>
        <UnsavedChangesModal
          showModal={showUnsaved}
          onHide={() => setShowUnsaved(false)}
          handleSave={() => {}}
          // Mirrors real callers: confirming navigation is what dismisses
          // this modal, not `onHide` directly (see the Discard-button test
          // above -- clicking Discard never calls `onHide` on its own).
          onConfirmNavigation={() => setShowUnsaved(false)}
        />
      </>
    );
  }

  render(<Harness />);

  // Open this modal once -- e.g. some other in-app action tripped it --
  // before the modal it's supposed to interrupt has ever been opened. Its
  // wrap node gets created now, first in the document.
  userEvent.click(screen.getByText('open unsaved'));
  await waitFor(() => expect(dialogWrap('Unsaved Changes')).not.toBeNull());
  userEvent.click(await screen.findByRole('button', { name: /discard/i }));
  await waitFor(() => expect(dialogWrap('Unsaved Changes')).toBeNull());

  // Now open the modal it's meant to interrupt for the first time.
  userEvent.click(screen.getByText('open other'));
  const otherWrap = await waitFor(() => {
    const wrap = dialogWrap('Other open modal');
    expect(wrap).not.toBeNull();
    return wrap as HTMLElement;
  });

  // Reopen this modal -- the real scenario the bug report describes. If its
  // wrap node were still the one created on the first open above, it would
  // be stuck earlier in the document than `otherWrap` and render behind it
  // again.
  userEvent.click(screen.getByText('open unsaved'));
  const unsavedChangesWrap = await waitFor(() => {
    const wrap = dialogWrap('Unsaved Changes');
    expect(wrap).not.toBeNull();
    return wrap as HTMLElement;
  });

  // eslint-disable-next-line no-bitwise
  expect(
    otherWrap.compareDocumentPosition(unsavedChangesWrap) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});
