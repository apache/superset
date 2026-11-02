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
import { t, tn } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { Modal } from '@superset-ui/core/components';
import { styled } from '@apache-superset/core/theme';
import { changeCount, totalChangeCount } from './display';
import type { ChangeRequest } from './types';

const Warning = styled(Alert)`
  ${({ theme }) => `
    margin-bottom: ${theme.sizeUnit * 3}px;
  `}
`;

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
  const dependency = changeRequest.pending_dependency;
  // The author's name where we have it: the approver's next move is to ask
  // them whether the dataset change should go first.
  const heldBy = dependency?.author
    ? [dependency.author.first_name, dependency.author.last_name]
        .filter(Boolean)
        .join(' ') || dependency.author.username
    : null;

  return (
    <Modal
      show={open}
      title={deleting ? t('Approve and delete?') : t('Approve and publish?')}
      onHide={onClose}
      onHandledPrimaryAction={onConfirm}
      primaryButtonName={
        deleting ? t('Approve and delete') : t('Approve and publish')
      }
      data-test="approve-publish-modal"
    >
      {dependency && (
        <Warning
          type="warning"
          showIcon
          data-test="pending-dependency-warning"
          message={
            dependency.asset_type === 'chart'
              ? tn(
                  'A chart on this dashboard has a change waiting',
                  '%s charts on this dashboard have changes waiting',
                  dependency.count ?? 1,
                  dependency.count ?? 1,
                )
              : t('The dataset this chart uses has a change waiting')
          }
          description={
            dependency.asset_type === 'chart'
              ? heldBy
                ? t(
                    'Approving this dashboard publishes it around the charts as they are now, not as %s has proposed. Decide the chart change first, or check with them.',
                    heldBy,
                  )
                : t(
                    'Approving this dashboard publishes it around the charts as they are now, not as proposed. Decide the chart change first.',
                  )
              : heldBy
                ? t(
                    'Approving this chart first publishes it against the dataset as it is now. If it relies on the change %s has waiting, viewers will see it break. Decide the dataset change first, or check with them.',
                    heldBy,
                  )
                : t(
                    'Approving this chart first publishes it against the dataset as it is now. If it relies on the dataset change still waiting, viewers will see it break. Decide the dataset change first.',
                  )
          }
        />
      )}
      {deleting
        ? // Said "It cannot be undone", which the product contradicts twice
          // over: the archive confirmation on the same delete promises
          // Recently archived, and Walk C restored an approved delete from
          // there. This is the sentence a reviewer reads while pressing an
          // irreversible-sounding button, so it has to be the true one. The
          // weight stays in what viewers lose and in the restore needing its
          // own review, not in a false claim of finality. No day count is
          // quoted: the retention window is configurable and can be unbounded
          // (see `archiveConfirmDescription`), which this copy cannot reach.
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
      <Hint>{t('Your note is saved with the approval.')}</Hint>
    </Modal>
  );
}
