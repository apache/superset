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
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { Checkbox, Input } from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';

interface DeleteFolderModalProps {
  folder: {
    uuid: string;
    name: string;
    asset_count: number;
    children_count: number;
  };
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const ModalContent = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

export default function DeleteFolderModal({
  folder,
  show,
  onHide,
  onSuccess,
  addDangerToast,
  addSuccessToast,
}: DeleteFolderModalProps) {
  const theme = useTheme();
  const [confirmName, setConfirmName] = useState('');
  const [deleteItems, setDeleteItems] = useState(false);
  const [saving, setSaving] = useState(false);

  const isEmpty = folder.asset_count === 0 && folder.children_count === 0;
  const nameMatches = confirmName === folder.name;

  const handleDelete = useCallback(async () => {
    setSaving(true);
    try {
      await SupersetClient.delete({
        endpoint: `/api/v1/folders/${folder.uuid}${deleteItems ? '?archive_items=true' : ''}`,
      });
      addSuccessToast(t('Folder "%s" deleted', folder.name));
      onSuccess();
      onHide();
    } catch {
      addDangerToast(t('Error deleting folder'));
    } finally {
      setSaving(false);
    }
  }, [folder, deleteItems, addSuccessToast, addDangerToast, onSuccess, onHide]);

  const handleHide = useCallback(() => {
    setConfirmName('');
    setDeleteItems(false);
    onHide();
  }, [onHide]);

  return (
    <StandardModal
      title={t('Delete folder')}
      show={show}
      onHide={handleHide}
      onSave={handleDelete}
      saveText={t('Delete')}
      saveLoading={saving}
      saveDisabled={!nameMatches}
    >
      <ModalContent>
        <p css={{ color: theme.colorText, margin: 0 }}>
          {isEmpty
            ? t("Delete this folder? It doesn't contain any items.")
            : t(
                'This folder contains items. Items will be moved to the parent folder or Analytics page (depending on the level) unless you choose to delete everything together.',
              )}
        </p>
        <div>
          <Input
            placeholder={t('Type folder name to confirm')}
            value={confirmName}
            onChange={e => setConfirmName(e.target.value)}
          />
        </div>
        {!isEmpty && (
          <Checkbox
            checked={deleteItems}
            onChange={e => setDeleteItems(e.target.checked)}
          >
            {t('Delete all items in this folder')}
          </Checkbox>
        )}
      </ModalContent>
    </StandardModal>
  );
}
