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
import { useCallback, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Checkbox, Input } from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';

interface CreateFolderModalProps {
  show: boolean;
  /** UUID of the folder to create this one under, or null for the root. */
  parentFolderUuid: string | null;
  onHide: () => void;
  onSuccess: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

import { ModalContent, FormGroup } from './styles';

export default function CreateFolderModal({
  show,
  parentFolderUuid,
  onHide,
  onSuccess,
  addDangerToast,
  addSuccessToast,
}: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      addDangerToast(t('Folder name is required'));
      return;
    }
    setSaving(true);
    try {
      await SupersetClient.post({
        endpoint: '/api/v1/folders/',
        jsonPayload: {
          name: name.trim(),
          folder_type: 'analytics',
          ...(parentFolderUuid ? { parent_uuid: parentFolderUuid } : {}),
          ...(isPrivate ? { is_private: true } : {}),
        },
      });
      addSuccessToast(t('Folder "%s" created', name.trim()));
      setName('');
      onSuccess();
      onHide();
    } catch {
      addDangerToast(t('Error creating folder'));
    } finally {
      setSaving(false);
    }
  }, [
    name,
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
        <FormGroup>
          <label htmlFor="create-folder-name">{t('Name')}</label>
          <Input
            id="create-folder-name"
            placeholder={t('Folder name')}
            value={name}
            onChange={e => setName(e.target.value)}
            onPressEnter={handleSave}
            autoFocus
          />
        </FormGroup>
        {!parentFolderUuid && (
          <FormGroup>
            <Checkbox
              checked={isPrivate}
              onChange={e => setIsPrivate(e.target.checked)}
            >
              {t('Private folder')}
            </Checkbox>
          </FormGroup>
        )}
      </ModalContent>
    </StandardModal>
  );
}
