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
import { t } from '@apache-superset/core/translation';
import { Icons, Modal, Typography, Button } from '@superset-ui/core/components';
import type { FC, ReactElement } from 'react';

export type UnsavedChangesModalProps = {
  showModal: boolean;
  onHide: () => void;
  handleSave: () => void;
  onConfirmNavigation: () => void;
  title?: string;
  body?: string;
};

export const UnsavedChangesModal: FC<UnsavedChangesModalProps> = ({
  showModal,
  onHide,
  handleSave,
  onConfirmNavigation,
  title = 'Unsaved Changes',
  body = "If you don't save, changes will be lost.",
}: UnsavedChangesModalProps): ReactElement => (
  <Modal
    centered
    responsive
    onHide={onHide}
    show={showModal}
    width="444px"
    // This modal always interrupts something already on screen (a draggable
    // "View query" modal, an in-progress form, etc). Ant Design only assigns
    // a higher z-index automatically when a Modal is nested inside another
    // open Modal's React tree; two top-level siblings both fall back to the
    // same static z-index and are tie-broken by DOM order instead. Without
    // destroyOnHidden, a Modal's portal node is created once (lazily, on
    // first open) and then left in place forever, so if this dialog is ever
    // opened once before whatever it's interrupting is opened, a later
    // reopen would go right back to that stale, now-too-early DOM position
    // and render behind it again. destroyOnHidden tears the portal down on
    // every close, so every open recreates it at the end of the DOM and it
    // reliably paints on top -- no z-index, hardcoded or otherwise, needed.
    destroyOnHidden
    title={
      <>
        <Icons.WarningOutlined iconSize="m" style={{ marginRight: 8 }} />
        {title}
      </>
    }
    footer={
      <>
        <Button buttonStyle="secondary" onClick={onConfirmNavigation}>
          {t('Discard')}
        </Button>
        <Button buttonStyle="primary" onClick={handleSave}>
          {t('Save')}
        </Button>
      </>
    }
  >
    <Typography.Text>{body}</Typography.Text>
  </Modal>
);
