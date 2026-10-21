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
import { Modal, Button } from '@superset-ui/core/components';
import { styled } from '@apache-superset/core/theme';
import { ago } from './display';
import { displayName, STATUS_LABEL } from './types';
import type { ChangeRequest } from './types';

const Who = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: baseline;
    gap: ${theme.sizeUnit * 2}px;
    margin-bottom: ${theme.sizeUnit * 3}px;
  `}
`;

const Name = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const Meta = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const Footer = styled.div`
  ${({ theme }) => `
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    /* Discard sits apart from the two safe actions: it destroys someone
       else's work and must not sit under a wandering cursor. */
    justify-content: space-between;
  `}
`;

export interface AssetLockedModalProps {
  changeRequest: ChangeRequest;
  open: boolean;
  onClose: () => void;
  onView: () => void;
  onDiscard: () => void;
}

/**
 * Why another editor cannot start their own change (SOW 5.3).
 *
 * The lock is explained rather than enforced silently: it says who holds
 * the asset, how old their work is, and offers the two ways forward --
 * look at what they did, or clear it and start fresh. Without the name and
 * the age this reads as the product being broken.
 */
export default function AssetLockedModal({
  changeRequest,
  open,
  onClose,
  onView,
  onDiscard,
}: AssetLockedModalProps) {
  const author = displayName(changeRequest.author);

  return (
    <Modal
      show={open}
      title={t('%s is changing this dashboard', author)}
      onHide={onClose}
      hideFooter
      data-test="asset-locked-modal"
    >
      <Who>
        <Name>{author}</Name>
        <Meta>
          {t(
            'Last saved %s · %s',
            ago(changeRequest.changed_on),
            STATUS_LABEL[changeRequest.status].toLowerCase(),
          )}
        </Meta>
      </Who>

      <div>
        {t(
          "Only one set of changes can be open at a time. View %s's changes, or discard them to start your own.",
          author,
        )}
      </div>

      <Footer>
        <Button buttonStyle="danger" onClick={onDiscard}>
          {t('Discard changes…')}
        </Button>
        <span>
          <Button buttonStyle="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>{' '}
          <Button buttonStyle="primary" onClick={onView}>
            {t('View changes')}
          </Button>
        </span>
      </Footer>
    </Modal>
  );
}
