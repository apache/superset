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
import { StandardModal } from 'src/components/Modal';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';

interface Folder {
  uuid: string;
  name: string;
  parent_uuid: string | null;
}

interface MoveToModalProps {
  item: { type: string; id: number; uuid: string | null; name: string };
  currentFolderUuid: string | null;
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
}

const ModalContent = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
  `}
`;

const FolderRow = styled.div<{ selected?: boolean }>`
  ${({ theme, selected }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    border-radius: 4px;
    cursor: pointer;
    background: ${selected ? theme.colorInfoBg : 'transparent'};
    border: 1px solid ${selected ? theme.colorPrimary : 'transparent'};

    &:hover {
      background: ${selected ? theme.colorInfoBg : theme.colorBgTextHover};
    }
  `}
`;

export default function MoveToModal({
  item,
  currentFolderUuid,
  show,
  onHide,
  onSuccess,
}: MoveToModalProps) {
  const { addSuccessToast, addDangerToast } = useToasts();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setSelectedUuid(null);
    setLoading(true);
    SupersetClient.get({
      endpoint: '/api/v1/folders/?folder_type=analytics',
    })
      .then(({ json }) => {
        setFolders(
          (json.result || []).filter(
            (f: Folder) => f.uuid !== currentFolderUuid,
          ),
        );
      })
      .catch(() => addDangerToast(t('Error loading folders')))
      .finally(() => setLoading(false));
  }, [show, currentFolderUuid, addDangerToast]);

  const handleMove = useCallback(async () => {
    if (!selectedUuid) return;
    setSaving(true);
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/folders/${selectedUuid}/assets/${item.type}/${item.id}`,
      });
      addSuccessToast(t('Moved "%s" successfully', item.name));
      onSuccess();
      onHide();
    } catch {
      addDangerToast(t('Error moving item'));
    } finally {
      setSaving(false);
    }
  }, [selectedUuid, item, addSuccessToast, addDangerToast, onSuccess, onHide]);

  return (
    <StandardModal
      title={t('Move "%s" to…', item.name)}
      show={show}
      onHide={onHide}
      onSave={handleMove}
      saveText={t('Move')}
      saveDisabled={!selectedUuid}
      saveLoading={saving}
    >
      <ModalContent>
        {loading ? (
          <p>{t('Loading folders...')}</p>
        ) : folders.length === 0 ? (
          <p>{t('No folders available')}</p>
        ) : (
          folders.map(folder => (
            <FolderRow
              key={folder.uuid}
              selected={selectedUuid === folder.uuid}
              onClick={() => setSelectedUuid(folder.uuid)}
            >
              <Icons.FolderOutlined iconSize="m" />
              {folder.name}
            </FolderRow>
          ))
        )}
      </ModalContent>
    </StandardModal>
  );
}
