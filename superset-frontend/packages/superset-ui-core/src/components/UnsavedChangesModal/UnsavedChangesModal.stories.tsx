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
import { ReactElement } from 'react';
import { UnsavedChangesModal, type UnsavedChangesModalProps } from '.';

export default {
  title: 'Components/UnsavedChangesModal',
  component: UnsavedChangesModal,
};

export const InteractiveUnsavedChangesModal = (
  props: UnsavedChangesModalProps,
): ReactElement => (
  <UnsavedChangesModal {...props}>
    If you don't save, changes will be lost.
  </UnsavedChangesModal>
);

InteractiveUnsavedChangesModal.args = {
  showModal: false,
  title: 'Unsaved Changes',
};

InteractiveUnsavedChangesModal.argTypes = {
  showModal: {
    control: { type: 'boolean' },
    description: 'Whether the modal is visible.',
  },
  title: {
    control: { type: 'text' },
    description: 'Title text displayed in the modal header.',
  },
  onHide: { action: 'onHide' },
  handleSave: { action: 'handleSave' },
  onConfirmNavigation: { action: 'onConfirmNavigation' },
};

InteractiveUnsavedChangesModal.parameters = {
  docs: {
    triggerProp: 'showModal',
    onHideProp: 'onHide',
    liveExample: `function Demo() {
  const [show, setShow] = React.useState(false);
  return (
    <div>
      <Button onClick={() => setShow(true)}>
        Navigate Away (Unsaved Changes)
      </Button>
      <UnsavedChangesModal
        showModal={show}
        onHide={() => setShow(false)}
        handleSave={() => { alert('Saved!'); setShow(false); }}
        onConfirmNavigation={() => { alert('Discarded changes'); setShow(false); }}
        title="Unsaved Changes"
      >
        If you don&apos;t save, changes will be lost.
      </UnsavedChangesModal>
    </div>
  );
}`,
    examples: [
      {
        title: 'Custom Title',
        code: `function CustomTitle() {
  const [show, setShow] = React.useState(false);
  return (
    <div>
      <Button onClick={() => setShow(true)}>
        Close Without Saving
      </Button>
      <UnsavedChangesModal
        showModal={show}
        onHide={() => setShow(false)}
        handleSave={() => setShow(false)}
        onConfirmNavigation={() => setShow(false)}
        title="You have unsaved dashboard changes"
      >
        Your dashboard layout and filter changes have not been saved.
        Do you want to save before leaving?
      </UnsavedChangesModal>
    </div>
  );
}`,
      },
    ],
  },
};
