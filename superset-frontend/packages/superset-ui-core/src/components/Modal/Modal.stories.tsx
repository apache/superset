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
import { Button } from '../Button';
import { Modal } from './Modal';
import type { ModalProps, ModalFuncProps } from './types';

export default {
  title: 'Components/Modal',
  component: Modal,
  parameters: {
    docs: {
      description: {
        component:
          'Modal dialog component for displaying content that requires user attention or interaction. Supports customizable buttons, drag/resize, and confirmation dialogs.',
      },
    },
  },
};

export const InteractiveModal = (props: ModalProps) => (
  <Modal {...props}>Hi</Modal>
);

InteractiveModal.args = {
  disablePrimaryButton: false,
  primaryButtonName: 'Submit',
  primaryButtonStyle: 'primary',
  show: false,
  title: "I'm a modal!",
  resizable: false,
  draggable: false,
  width: 500,
};

InteractiveModal.argTypes = {
  show: {
    control: 'boolean',
    description:
      'Whether the modal is visible. Use the "Try It" example below for a working demo.',
  },
  title: {
    control: 'text',
    description: 'Title displayed in the modal header.',
  },
  primaryButtonName: {
    control: 'text',
    description: 'Text for the primary action button.',
  },
  primaryButtonStyle: {
    control: 'select',
    options: ['primary', 'secondary', 'dashed', 'danger', 'link'],
    description: 'The style of the primary action button.',
  },
  width: {
    control: 'number',
    description: 'Width of the modal in pixels.',
  },
  resizable: {
    control: 'boolean',
    description: 'Whether the modal can be resized by dragging corners.',
  },
  draggable: {
    control: 'boolean',
    description: 'Whether the modal can be dragged by its header.',
  },
  disablePrimaryButton: {
    control: 'boolean',
    description: 'Whether the primary button is disabled.',
  },
  onHandledPrimaryAction: { action: 'onHandledPrimaryAction' },
  onHide: { action: 'onHide' },
};

InteractiveModal.parameters = {
  docs: {
    triggerProp: 'show',
    onHideProp: 'onHide',
    liveExample: `function ModalDemo() {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal
        show={isOpen}
        onHide={() => setIsOpen(false)}
        title="Example Modal"
        primaryButtonName="Submit"
        onHandledPrimaryAction={() => {
          alert('Submitted!');
          setIsOpen(false);
        }}
      >
        <p>This is the modal content. Click Submit or close the modal.</p>
      </Modal>
    </>
  );
}`,
    examples: [
      {
        title: 'Danger Modal',
        code: `function DangerModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <>
      <Button buttonStyle="danger" onClick={() => setIsOpen(true)}>Delete Item</Button>
      <Modal
        show={isOpen}
        onHide={() => setIsOpen(false)}
        title="Confirm Delete"
        primaryButtonName="Delete"
        primaryButtonStyle="danger"
        onHandledPrimaryAction={() => {
          alert('Deleted!');
          setIsOpen(false);
        }}
      >
        <p>Are you sure you want to delete this item? This action cannot be undone.</p>
      </Modal>
    </>
  );
}`,
      },
      {
        title: 'Confirmation Dialogs',
        code: `function ConfirmationDialogs() {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button onClick={() => Modal.confirm({
        title: 'Confirm Action',
        content: 'Are you sure you want to proceed?',
        okText: 'Yes',
      })}>Confirm</Button>
      <Button onClick={() => Modal.warning({
        title: 'Warning',
        content: 'This action may have consequences.',
      })}>Warning</Button>
      <Button onClick={() => Modal.error({
        title: 'Error',
        content: 'Something went wrong.',
      })}>Error</Button>
    </div>
  );
}`,
      },
    ],
  },
};

export const ModalFunctions = (props: ModalFuncProps) => (
  <div>
    <Button onClick={() => Modal.error(props)}>Error</Button>
    <Button onClick={() => Modal.warning(props)}>Warning</Button>
    <Button onClick={() => Modal.confirm(props)}>Confirm</Button>
  </div>
);

ModalFunctions.args = {
  title: 'Modal title',
  content: 'Modal content',
  keyboard: true,
  okText: 'Test',
  maskClosable: true,
  mask: true,
};

/**
 * Two top-level Modals that are React siblings, not nested inside one
 * another (e.g. a "View query" modal and a confirmation dialog it can
 * trigger, like `UnsavedChangesModal`). Ant Design only assigns an
 * automatically-incremented z-index when a Modal is nested inside another
 * *currently open* Modal's React tree, so two siblings always fall back to
 * the same static z-index and are tie-broken by DOM order: whichever
 * `.ant-modal-wrap` was inserted later paints on top.
 *
 * With `destroyOnHidden={false}` (Ant Design's default), a Modal's wrap
 * node is created once, lazily, on first open, and is never removed or
 * recreated afterward. So the modal that happens to have been opened
 * *first ever*, not most recently, keeps winning the DOM-order tiebreak
 * even after being closed and reopened. Toggle "Reproduce stale DOM order"
 * off to see the fix: with `destroyOnHidden`, every open recreates the wrap
 * node at the end of the document, so DOM order (and stacking) always
 * matches true open-recency and no manual z-index is ever needed.
 *
 * To see the bug: click "Open A", close it, then "Open B", then "Open A"
 * again -- with the toggle on, A renders behind B despite being the modal
 * that was opened most recently.
 */
export const SiblingModalStacking = ({
  reproduceStaleDomOrder,
}: {
  reproduceStaleDomOrder: boolean;
}) => {
  const [showA, setShowA] = useState(false);
  const [showB, setShowB] = useState(false);
  return (
    <div>
      <Button onClick={() => setShowA(true)} buttonStyle="secondary">
        Open A
      </Button>
      <Button onClick={() => setShowB(true)} buttonStyle="secondary">
        Open B
      </Button>
      <Modal
        name="modal-a"
        title="Modal A"
        show={showA}
        onHide={() => setShowA(false)}
        destroyOnHidden={!reproduceStaleDomOrder}
      >
        Modal A content
      </Modal>
      <Modal
        name="modal-b"
        title="Modal B"
        show={showB}
        onHide={() => setShowB(false)}
        destroyOnHidden={!reproduceStaleDomOrder}
      >
        Modal B content
      </Modal>
    </div>
  );
};

SiblingModalStacking.args = {
  reproduceStaleDomOrder: true,
};

SiblingModalStacking.argTypes = {
  reproduceStaleDomOrder: {
    control: 'boolean',
    description:
      'On: Ant Design default behavior, a modal opened once keeps its DOM position forever (the bug from #42510). Off: destroyOnHidden, DOM order always matches true open-recency (the fix).',
  },
};
