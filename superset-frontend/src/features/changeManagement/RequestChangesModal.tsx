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
import { useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Modal } from '@superset-ui/core/components';
import { Input } from '@superset-ui/core/components/Input';
import { styled } from '@apache-superset/core/theme';
import { displayName } from './types';
import type { ChangeRequest } from './types';

const Label = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    margin-bottom: ${theme.sizeUnit}px;
  `}
`;

const Hint = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    margin-top: ${theme.sizeUnit * 2}px;
  `}
`;

export interface RequestChangesModalProps {
  changeRequest: ChangeRequest;
  open: boolean;
  onClose: () => void;
  onSubmit: (reviewNote: string) => void | Promise<void>;
}

/**
 * Send the change back to its author.
 *
 * Not "Reject": the work goes back, it is not killed, and that is what
 * GitHub, Webflow, Figma, Canva and Hex all call it (Decision 3). The note
 * is required and the primary action stays disabled without it -- sending
 * work back with no reason is the one thing that makes this useless.
 */
export default function RequestChangesModal({
  changeRequest,
  open,
  onClose,
  onSubmit,
}: RequestChangesModalProps) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  const author = displayName(changeRequest.author);

  return (
    <Modal
      show={open}
      title={t('Request changes')}
      onHide={onClose}
      onHandledPrimaryAction={() => onSubmit(note)}
      primaryButtonName={t('Request changes')}
      disablePrimaryButton={!note.trim()}
      data-test="request-changes-modal"
    >
      <Label>{t('What needs to change?')}</Label>
      <Input.TextArea
        rows={4}
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder={t('Be specific enough to act on.')}
        autoFocus
      />
      <Hint>
        {t(
          '%s can update them and request review again. Nothing is lost.',
          author,
        )}
      </Hint>
    </Modal>
  );
}
