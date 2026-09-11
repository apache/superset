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
import { SupersetClient, getClientErrorObject } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Checkbox, Input } from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';
import { ModalFormField } from 'src/components/Modal/ModalFormField';

import { ModalContent } from './styles';

interface CreateFolderModalProps {
  show: boolean;
  /** UUID of the folder to create this one under, or null for the root. */
  parentFolderUuid: string | null;
  onHide: () => void;
  onSuccess: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

export default function CreateFolderModal({
  show,
  parentFolderUuid,
  onHide,
  onSuccess,
  addDangerToast,
  addSuccessToast,
}: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show) {
      setName('');
      setDescription('');
      setNameError('');
    }
  }, [show]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setNameError(t('Folder name is required'));
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      await SupersetClient.post({
        endpoint: '/api/v1/folders/',
        jsonPayload: {
          name: name.trim(),
          description: description.trim() || null,
          folder_type: 'analytics',
          ...(parentFolderUuid ? { parent_uuid: parentFolderUuid } : {}),
          ...(isPrivate ? { is_private: true } : {}),
        },
      });
      addSuccessToast(t('Folder "%s" created', name.trim()));
      onSuccess();
      onHide();
    } catch (err: any) {
      const { error } = await getClientErrorObject(err);
      const isDuplicate = error?.toLowerCase().includes('already exists');
      addDangerToast(isDuplicate ? error : t('Error creating folder'));
    } finally {
      setSaving(false);
    }
  }, [
    name,
    description,
    parentFolderUuid,
    addSuccessToast,
    addDangerToast,
    onSuccess,
    onHide,
  ]);

  return (
    <StandardModal
      title={t('Create folder')}
      show={show}
      onHide={onHide}
      onSave={handleSave}
      saveText={t('Create')}
      saveDisabled={!name.trim()}
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
        {!parentFolderUuid && (
          <Checkbox
            checked={isPrivate}
            onChange={e => setIsPrivate(e.target.checked)}
          >
            {t('Private folder')}
          </Checkbox>
        )}
      </ModalContent>
    </StandardModal>
  );
}
