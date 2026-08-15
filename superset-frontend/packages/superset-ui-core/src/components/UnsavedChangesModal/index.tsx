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
import { useTheme } from '@apache-superset/core/theme';
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
}: UnsavedChangesModalProps): ReactElement => {
  const theme = useTheme();
  return (
    <Modal
      centered
      responsive
      onHide={onHide}
      show={showModal}
      width="444px"
      // This modal always interrupts something already on screen (a
      // draggable "View query" modal, an in-progress form, etc). Ant
      // Design only assigns a higher z-index automatically when a Modal is
      // nested inside another *currently open Modal's* React tree. This
      // one is always a top-level sibling of whatever it interrupts, so on
      // its own it would fall back to the same static base z-index -- BUT
      // the modal it's interrupting isn't always a plain top-level sibling
      // itself: "View query" is rendered as a dropdown menu item's label,
      // and Ant Design's Menu.Item silently wraps every item's content in
      // a Tooltip (even when that tooltip never opens), which supplies a
      // real ZIndexContext to its children. That gives the nested "View
      // query" Modal a genuinely higher, non-tied z-index (theme's popup
      // base plus ~200) than this modal's plain base value, so DOM order
      // alone (destroyOnHidden below) can't win the tie -- there isn't
      // one. An explicit zIndex, comfortably above any such context-fed
      // value, guarantees this modal isn't shadowed by a sibling that
      // happens to inherit an elevated stacking context.
      zIndex={theme.zIndexPopupBase + 1000}
      // Without destroyOnHidden, a Modal's portal node is created once
      // (lazily, on first open) and then left in place forever, so if this
      // dialog is ever opened once before whatever it's interrupting is
      // opened, a later reopen would go right back to that stale,
      // now-too-early DOM position. destroyOnHidden tears the portal down
      // on every close so every open recreates it fresh at the end of the
      // DOM, keeping DOM order (the tie-breaker for any modals that
      // genuinely do share this one's base z-index) tracking true
      // open-recency.
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
};
