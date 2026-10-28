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
import { Modal, Select } from '@superset-ui/core/components';
import { Input } from '@superset-ui/core/components/Input';
import { styled } from '@apache-superset/core/theme';
import { displayName } from './types';
import { fetchAssetEditorIds, fetchEditorOptions, saveEditors } from './api';
import type { ChangeRequest, UserBrief } from './types';

const Field = styled.div`
  ${({ theme }) => `
    margin-bottom: ${theme.sizeUnit * 4}px;
  `}
`;

const Label = styled.div`
  ${({ theme }) => `
    font-weight: ${theme.fontWeightStrong};
    margin-bottom: ${theme.sizeUnit}px;
  `}
`;

const Warning = styled.div`
  ${({ theme }) => `
    padding: ${theme.sizeUnit * 3}px;
    background: ${theme.colorWarningBg};
    border: 1px solid ${theme.colorWarningBorder};
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorText};
  `}
`;

const Hint = styled.div`
  ${({ theme }) => `
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    margin-top: ${theme.sizeUnit}px;
  `}
`;

export interface RequestReviewModalProps {
  changeRequest: ChangeRequest;
  open: boolean;
  onClose: () => void;
  onSubmit: (note: string, approverId: number | null) => void | Promise<void>;
  /** Reload the request after the editors list changes. */
  onEditorsChanged?: () => void | Promise<void>;
}

/**
 * Ask a second editor to approve.
 *
 * "Ask someone specific" is advisory and says so: it puts the request first
 * for that person, it does not restrict who may approve (Decision 4).
 * Making it exclusive would create the hole GitLab's "auto approved" has --
 * one unavailable approver and the change is stuck or waved through.
 */
export default function RequestReviewModal({
  changeRequest,
  open,
  onClose,
  onSubmit,
  onEditorsChanged,
}: RequestReviewModalProps) {
  const [note, setNote] = useState('');
  const [approverId, setApproverId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setNote(changeRequest.note ?? '');
      setApproverId(changeRequest.requested_approver?.id ?? null);
    }
  }, [open, changeRequest.note, changeRequest.requested_approver]);

  const approvers = changeRequest.eligible_approvers ?? [];

  // Adding an editor here is the documented way out of "nobody can
  // approve this" (SOW 5.4), so it saves immediately and then asks the
  // page to reload the request, which is what recomputes who is eligible.
  const [editorOptions, setEditorOptions] = useState<UserBrief[]>([]);
  const [editorIds, setEditorIds] = useState<number[]>([]);
  const [savingEditors, setSavingEditors] = useState(false);

  useEffect(() => {
    if (!open || approvers.length > 0) return;
    fetchEditorOptions(changeRequest.asset_type)
      .then(setEditorOptions)
      .catch(() => setEditorOptions([]));
    fetchAssetEditorIds(changeRequest.asset_type, changeRequest.asset_id)
      .then(setEditorIds)
      .catch(() => setEditorIds([]));
  }, [
    open,
    approvers.length,
    changeRequest.asset_type,
    changeRequest.asset_id,
  ]);

  const onEditorsPicked = async (ids: number[]) => {
    setEditorIds(ids);
    setSavingEditors(true);
    try {
      await saveEditors(changeRequest.asset_type, changeRequest.asset_id, ids);
      await onEditorsChanged?.();
    } finally {
      setSavingEditors(false);
    }
  };

  return (
    <Modal
      show={open}
      title={t('Request review')}
      onHide={onClose}
      onHandledPrimaryAction={() => onSubmit(note, approverId)}
      primaryButtonName={t('Request review')}
      data-test="request-review-modal"
    >
      <Field>
        <Label>{t('What changed?')}</Label>
        <Input.TextArea
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={t('A sentence helps whoever reviews this.')}
        />
      </Field>

      <Field>
        <Label>{t('Who can approve')}</Label>
        {approvers.length === 0 ? (
          <>
            <Warning>
              {t(
                'No one else can approve this %s. Add another editor to submit.',
                changeRequest.asset_type,
              )}
            </Warning>
            <Field style={{ marginTop: 12 }}>
              <Label>{t('Editors')}</Label>
              <Select
                mode="multiple"
                allowClear
                ariaLabel={t('Editors')}
                value={editorIds}
                onChange={value => onEditorsPicked(value as number[])}
                options={editorOptions.map(u => ({
                  value: u.id,
                  label: displayName(u),
                }))}
                loading={savingEditors}
              />
              {/* SOW 5.2: the editors list is exempt, which is what makes
                  this a way out rather than a second thing needing the
                  approval they cannot get. */}
              <Hint>{t("Changing editors doesn't need approval.")}</Hint>
            </Field>
          </>
        ) : (
          <>
            <div>{approvers.map(displayName).join(', ')}</div>
            <Field style={{ marginTop: 12 }}>
              <Label>{t('Ask someone specific (optional)')}</Label>
              <Select
                allowClear
                ariaLabel={t('Ask someone specific')}
                value={approverId ?? undefined}
                onChange={value => setApproverId((value as number) ?? null)}
                options={approvers.map(u => ({
                  value: u.id,
                  label: displayName(u),
                }))}
              />
              <Hint>
                {t('Puts it first for them. Anyone above can still approve.')}
              </Hint>
            </Field>
          </>
        )}
      </Field>

      <Hint>
        {t('Your changes lock while they wait. Editing withdraws the request.')}
      </Hint>
    </Modal>
  );
}
