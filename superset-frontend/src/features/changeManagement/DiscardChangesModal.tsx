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
import { styled } from '@apache-superset/core/theme';
import { ago, totalChangeCount } from './display';
import { displayName } from './types';
import type { ChangeRequest } from './types';

const Hint = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    margin-top: ${theme.sizeUnit * 3}px;
  `}
`;

export interface DiscardChangesModalProps {
  changeRequest: ChangeRequest;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * Clearing work that is not yours.
 *
 * SOW 5.3 lets any editor discard to unblock the asset, which means the
 * destructive case is the normal one, not an edge case. So the count and
 * the age are stated -- "3 changes made 2 days ago" is what tells someone
 * whether they are unblocking a forgotten draft or deleting this morning's
 * work -- and the author is told who did it rather than finding their
 * request silently gone.
 */
export default function DiscardChangesModal({
  changeRequest,
  open,
  onClose,
  onConfirm,
}: DiscardChangesModalProps) {
  const author = displayName(changeRequest.author);
  const count = totalChangeCount(changeRequest);

  return (
    <Modal
      show={open}
      title={t("Discard %s's changes?", author)}
      onHide={onClose}
      onHandledPrimaryAction={onConfirm}
      primaryButtonName={t('Discard changes')}
      primaryButtonStyle="danger"
      data-test="discard-changes-modal"
    >
      <div>
        {count === 1
          ? t(
              'This deletes 1 change %s made %s. It cannot be undone.',
              author,
              ago(changeRequest.changed_on),
            )
          : t(
              'This deletes %s changes %s made %s. It cannot be undone.',
              count,
              author,
              ago(changeRequest.changed_on),
            )}
      </div>
      <Hint>
        {t(
          '%s sees this in their Approvals history: "Discarded by you".',
          author,
        )}
      </Hint>
    </Modal>
  );
}
