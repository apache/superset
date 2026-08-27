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
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Input } from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';
import { ModalFormField } from 'src/components/Modal/ModalFormField';

import { ModalContent } from './styles';

interface RenameFolderModalProps {
  folderUuid: string;
  currentName: string;
  currentDescription?: string | null;
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

export default function RenameFolderModal({
  folderUuid,
  currentName,
  currentDescription = '',
  show,
  onHide,
  onSuccess,
  addDangerToast,
  addSuccessToast,
}: RenameFolderModalProps) {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription || '');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setName(currentName);
      setDescription(currentDescription || '');
      setNameError('');
    }
  }, [show, currentName, currentDescription]);

  const hasChanges =
    name.trim() !== currentName ||
    (description.trim() || null) !== (currentDescription || null);

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('Folder name is required'));
      return;
    }
    if (!hasChanges) {
      onHide();
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/folders/${folderUuid}`,
        jsonPayload: {
          name: trimmed,
          description: description.trim() || null,
        },
      });
      addSuccessToast(t('Folder updated'));
      onSuccess();
      onHide();
    } catch (err: any) {
      const message =
        err?.json?.message?.name?.[0] ||
        err?.json?.message ||
        t('Error updating folder');
      if (
        typeof message === 'string' &&
        message.toLowerCase().includes('already exists')
      ) {
        setNameError(message);
      } else {
        addDangerToast(
          typeof message === 'string' ? message : t('Error updating folder'),
        );
      }
    } finally {
      setSaving(false);
    }
  }, [
    name,
    description,
    hasChanges,
    folderUuid,
    addSuccessToast,
    addDangerToast,
    onSuccess,
    onHide,
  ]);

  return (
    <StandardModal
      title={t('Edit folder')}
      show={show}
      onHide={onHide}
      onSave={handleSave}
      saveText={t('Save')}
      saveDisabled={!name.trim() || !hasChanges}
      saveLoading={saving}
    >
      <ModalContent>
        <ModalFormField label={t('Name')} required error={nameError}>
          <Input
            placeholder={t('Folder name')}
            value={name}
            onChange={e => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
            onPressEnter={handleSave}
            status={nameError ? 'error' : undefined}
            autoFocus
          />
        </ModalFormField>
        <ModalFormField label={t('Description')}>
          <Input.TextArea
            placeholder={t('Optional description')}
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        </ModalFormField>
      </ModalContent>
    </StandardModal>
  );
}
