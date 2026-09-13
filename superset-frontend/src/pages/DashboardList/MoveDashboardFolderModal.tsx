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
import { useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { FormItem, Modal, Select } from '@superset-ui/core/components';
import type { DashboardFolder } from './DashboardFolderPanel';

interface MoveDashboardFolderModalProps {
  dashboardTitle: string;
  currentFolderId?: string | null;
  folders: DashboardFolder[];
  onHide: () => void;
  onMove: (folderId: string | null) => Promise<void>;
}

export function MoveDashboardFolderModal({
  dashboardTitle,
  currentFolderId,
  folders,
  onHide,
  onMove,
}: MoveDashboardFolderModalProps) {
  const folderById = useMemo(
    () => new Map(folders.map(folder => [folder.id, folder])),
    [folders],
  );
  const initialSelection = useMemo(() => {
    if (!currentFolderId) return { parentId: null, childId: null };
    let current = folderById.get(currentFolderId);
    if (!current) return { parentId: null, childId: null };
    const visited = new Set<string>();
    while (current.parent_id && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = folderById.get(current.parent_id);
      if (!parent) break;
      current = parent;
    }
    return {
      parentId: current.id,
      childId: current.id === currentFolderId ? null : currentFolderId,
    };
  }, [currentFolderId, folderById]);
  const [parentId, setParentId] = useState<string | null>(
    initialSelection.parentId,
  );
  const [childId, setChildId] = useState<string | null>(
    initialSelection.childId,
  );
  const [saving, setSaving] = useState(false);
  const parentOptions = folders
    .filter(folder => !folder.parent_id)
    .map(folder => ({ label: folder.name, value: folder.id }));
  const childOptions = useMemo(() => {
    if (!parentId) return [];
    const childrenByParent = new Map<string, DashboardFolder[]>();
    folders.forEach(folder => {
      if (!folder.parent_id) return;
      childrenByParent.set(folder.parent_id, [
        ...(childrenByParent.get(folder.parent_id) ?? []),
        folder,
      ]);
    });
    const options: { label: string; value: string }[] = [];
    const visited = new Set<string>();
    const appendChildren = (folderId: string, prefix = '') => {
      if (visited.has(folderId)) return;
      visited.add(folderId);
      (childrenByParent.get(folderId) ?? []).forEach(folder => {
        const label = prefix ? `${prefix} / ${folder.name}` : folder.name;
        if (folder.can_move_dashboard) {
          options.push({ label, value: folder.id });
        }
        appendChildren(folder.id, label);
      });
    };
    appendChildren(parentId);
    return options;
  }, [folders, parentId]);
  const targetFolderId = childId ?? parentId;
  const targetFolder = targetFolderId
    ? folderById.get(targetFolderId)
    : undefined;
  const targetIsReadOnly = Boolean(
    targetFolderId && !targetFolder?.can_move_dashboard,
  );

  return (
    <Modal
      show
      title={t('Move dashboard')}
      onHide={onHide}
      primaryButtonName={t('Move')}
      disablePrimaryButton={saving || targetIsReadOnly}
      onHandledPrimaryAction={async () => {
        setSaving(true);
        try {
          await onMove(childId ?? parentId);
          onHide();
        } finally {
          setSaving(false);
        }
      }}
    >
      <p>{dashboardTitle}</p>
      <FormItem label={t('Parent folder')}>
        <Select
          aria-label={t('Parent folder')}
          allowClear
          placeholder={t('Uncategorized')}
          value={parentId ?? undefined}
          options={parentOptions}
          onChange={value => {
            setParentId(value ? String(value) : null);
            setChildId(null);
          }}
        />
      </FormItem>
      {parentId && childOptions.length > 0 && (
        <FormItem label={t('Child folder')}>
          <Select
            aria-label={t('Child folder')}
            allowClear
            placeholder={t('Place in parent folder')}
            value={childId ?? undefined}
            options={childOptions}
            onChange={value => setChildId(value ? String(value) : null)}
          />
        </FormItem>
      )}
    </Modal>
  );
}
