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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { TreeSelect } from '@superset-ui/core/components/TreeSelect';
import { ModalFormField } from 'src/components/Modal/ModalFormField';

interface FolderInfo {
  uuid: string;
  name: string;
  parent_uuid: string | null;
  user_permission?: string | null;
  is_only_me?: boolean;
  is_private?: boolean;
}

export interface FolderSelectorProps {
  assetId: number;
  assetType: 'chart' | 'dashboard';
  accessorCount?: number;
  onChange?: (folderUuid: string | null) => void;
  onValidationError?: (error: string | null) => void;
}

const ROOT_VALUE = '__root__';

export default function FolderSelector({
  assetId,
  assetType,
  accessorCount = 0,
  onChange,
  onValidationError,
}: FolderSelectorProps) {
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [initialValue, setInitialValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch folder list + current asset location on mount
  useEffect(() => {
    setLoading(true);
    Promise.all([
      SupersetClient.get({
        endpoint: '/api/v1/folders/?folder_type=analytics',
      }),
      SupersetClient.get({
        endpoint: `/api/v1/folders/asset-location?type=${assetType}&id=${assetId}`,
      }),
    ])
      .then(([foldersRes, locationRes]) => {
        const allFolders = (foldersRes.json.result as FolderInfo[]) || [];
        setFolders(allFolders.filter(f => f.user_permission === 'editor'));

        const location = locationRes.json.result;
        const currentUuid = location?.folder_uuid ?? ROOT_VALUE;
        setSelectedValue(currentUuid);
        setInitialValue(currentUuid);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assetId, assetType]);

  // Build tree data for TreeSelect
  const treeData = useMemo(() => {
    type TreeNode = {
      value: string;
      title: string;
      children: TreeNode[];
    };

    const nodeMap = new Map<string, TreeNode>();
    for (const f of folders) {
      nodeMap.set(f.uuid, {
        value: f.uuid,
        title: f.name,
        children: [],
      });
    }
    const roots: TreeNode[] = [];
    for (const f of folders) {
      const node = nodeMap.get(f.uuid)!;
      if (f.parent_uuid && nodeMap.has(f.parent_uuid)) {
        nodeMap.get(f.parent_uuid)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return [
      { value: ROOT_VALUE, title: t('Analytics (root)'), children: [] },
      ...roots,
    ];
  }, [folders]);

  // Only Me validation: item is in Only Me folder AND has multiple accessors
  const validateOnlyMe = useCallback(
    (folderValue: string, count: number) => {
      const folder = folders.find(f => f.uuid === folderValue);
      if (folder?.is_only_me && count > 1) {
        const errMsg = t(
          'Move this item out of your private folder before sharing',
        );
        onValidationError?.(errMsg);
      } else {
        onValidationError?.(null);
      }
    },
    [folders, onValidationError],
  );

  // Re-validate when accessorCount changes (user adds/removes people)
  useEffect(() => {
    if (selectedValue) {
      validateOnlyMe(selectedValue, accessorCount);
    }
  }, [accessorCount, selectedValue, validateOnlyMe]);

  const handleChange = useCallback(
    (value: string) => {
      setSelectedValue(value);
      const folderUuid = value === ROOT_VALUE ? null : value;

      validateOnlyMe(value, accessorCount);

      onChange?.(folderUuid);
    },
    [accessorCount, onChange, validateOnlyMe],
  );

  const hasChanged = selectedValue !== initialValue;

  return (
    <ModalFormField
      label={t('Folder')}
      helperText={
        hasChanged ? t('The item will be moved when you save.') : undefined
      }
    >
      <TreeSelect
        value={selectedValue ?? ROOT_VALUE}
        treeData={treeData}
        onChange={handleChange}
        treeDefaultExpandAll
        showSearch
        filterTreeNode={(input: string, node: any) =>
          (node?.title as string)?.toLowerCase().includes(input.toLowerCase())
        }
        loading={loading}
        style={{ width: '100%' }}
      />
    </ModalFormField>
  );
}
