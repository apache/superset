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
import { useCallback, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/theme';
import { Input } from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';

interface RenameFolderModalProps {
  folderUuid: string;
  currentName: string;
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const ModalContent = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
  `}
`;

const FormGroup = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 2}px 0;

    label {
      display: block;
      font-weight: ${theme.fontWeightStrong};
      margin-bottom: ${theme.sizeUnit}px;
    }
  `}
`;

export default function RenameFolderModal({
  folderUuid,
  currentName,
  show,
  onHide,
  onSuccess,
  addDangerToast,
  addSuccessToast,
}: RenameFolderModalProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) setName(currentName);
  }, [show, currentName]);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      addDangerToast(t('Folder name is required'));
      return;
    }
    if (trimmed === currentName) {
      onHide();
      return;
    }
    setSaving(true);
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/folders/${folderUuid}`,
        jsonPayload: { name: trimmed },
      });
      addSuccessToast(t('Folder renamed to "%s"', trimmed));
      onSuccess();
      onHide();
    } catch {
      addDangerToast(t('Error renaming folder'));
    } finally {
      setSaving(false);
    }
  }, [
    name,
    currentName,
    folderUuid,
    addSuccessToast,
    addDangerToast,
    onSuccess,
    onHide,
  ]);

  return (
    <StandardModal
      title={t('Rename folder')}
      show={show}
      onHide={onHide}
      onSave={handleSave}
      saveText={t('Save')}
      saveDisabled={!name.trim() || name.trim() === currentName}
      saveLoading={saving}
    >
      <ModalContent>
        <FormGroup>
          <label htmlFor="rename-folder-name">{t('Name')}</label>
          <Input
            id="rename-folder-name"
            placeholder={t('Folder name')}
            value={name}
            onChange={e => setName(e.target.value)}
            onPressEnter={handleSave}
            autoFocus
          />
        </FormGroup>
      </ModalContent>
    </StandardModal>
  );
}
