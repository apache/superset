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
import { Modal } from '@superset-ui/core/components';
import { namesOf } from './display';
import type { ChangeRequest } from './types';

export interface WithdrawModalProps {
  changeRequest: ChangeRequest;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Editing a submitted change takes it off the approvers' queue.
 *
 * Confirmed rather than silent because the author cannot see the queue they
 * are removing themselves from: to them the asset simply becomes editable
 * again, while the approver who had set time aside for it is the one who
 * notices. Naming the approvers is the point of the dialog.
 */
export default function WithdrawModal({
  changeRequest,
  open,
  onClose,
  onConfirm,
}: WithdrawModalProps) {
  const approvers =
    namesOf(changeRequest.eligible_approvers) || t('Your approvers');

  return (
    <Modal
      show={open}
      title={t('Edit and withdraw your request?')}
      onHide={onClose}
      onHandledPrimaryAction={onConfirm}
      primaryButtonName={t('Withdraw and edit')}
      data-test="withdraw-modal"
    >
      {t(
        "Your changes become editable again. %s won't see it in Needs my review until you submit again.",
        approvers,
      )}
    </Modal>
  );
}
