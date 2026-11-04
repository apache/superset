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

import React from 'react';
import { Modal, styled, t } from './host';
import ChangeList, { BlockedNotice } from './ChangeList';
import { changeCount, reviewBlocker, totalChangeCount } from './display';
import type { ChangeRequest } from './types';

const Hint = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    margin-top: ${theme.sizeUnit * 2}px;
  `}
`;

export interface ApprovePublishModalProps {
  changeRequest: ChangeRequest;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * The step that makes a change public.
 *
 * Everything before this is private to the editors; approving is the moment
 * viewers see it, and the only way back is through another reviewed change.
 * So it is the only action that stops to ask, and it says what happens to
 * viewers rather than asking "are you sure".
 */
export default function ApprovePublishModal({
  changeRequest,
  open,
  onClose,
  onConfirm,
}: ApprovePublishModalProps) {
  const deleting = changeRequest.operation === 'delete';
  // Approving something with nothing in it to read is approving blind, and
  // every Approve button in the app ends at this dialog, so this is the one
  // place that holds for all of them.
  const blocker = reviewBlocker(changeRequest);
  const keywords = (changeRequest.changes ?? []).filter(change => change.keyword);
  const restoring = changeRequest.command === 'restore';

  return (
    <Modal
      show={open}
      disablePrimaryButton={!!blocker}
      title={deleting ? t('Approve and delete?') : t('Approve and publish?')}
      onHide={onClose}
      onHandledPrimaryAction={onConfirm}
      primaryButtonName={
        deleting ? t('Approve and delete') : t('Approve and publish')
      }
      data-test="approve-publish-modal"
    >
      {blocker ? <BlockedNotice reason={blocker} /> : null}
      {blocker ? null : restoring
        ? // An un-archive has nothing to preview on a page, because the asset
          // is in the trash and has none, so this dialog is the only place
          // the reviewer is told what approving does. It said the generic
          // sentence below and listed nothing, which for a restore read as a
          // change that did not exist.
          t(
            'Viewers can see the %s again straight away. It comes out of Recently archived.',
            changeRequest.asset_type,
          )
        : deleting
        ? // Said "It cannot be undone", which the product contradicts twice
          // over: the archive confirmation on the same delete promises
          // Recently archived, and Walk C restored an approved delete from
          // there. This is the sentence a reviewer reads while pressing an
          // irreversible-sounding button, so it has to be the true one. Kept
          // word for word with the host's ApprovePublishModal: the queue and
          // the asset page decide the same delete, and two readings of the
          // consequence is how the wrong one survived.
          t(
            'Viewers lose the %s straight away. It is archived rather than destroyed, so it can be restored from Recently archived, and that restore goes through review of its own.',
            changeRequest.asset_type,
          )
        : // "these 1 change" otherwise: the count reads naturally in a list
          // ("What changed · 1 change") but not after a demonstrative.
          totalChangeCount(changeRequest) === 1
          ? t(
              'Viewers see this change right away. The current version moves to version history.',
            )
          : t(
              'Viewers see these %s right away. The current version moves to version history.',
              changeCount(changeRequest),
            )}
      {changeRequest.asset_archived && (changeRequest.changes ?? []).length ? (
        // What the request changes, for the one kind of request that is
        // decided here and not on the asset's own page.
        <div data-test="approve-changes">
          <ChangeList changes={changeRequest.changes} />
        </div>
      ) : null}
      {keywords.length && !changeRequest.asset_archived ? (
        // What the save is also called with, repeated at the moment of
        // approval: the keyword is the part most likely to have been missed.
        <div data-test="approve-keywords">
          <ChangeList changes={keywords} />
        </div>
      ) : null}
      <Hint>{t('Your note is saved with the approval.')}</Hint>
    </Modal>
  );
}
