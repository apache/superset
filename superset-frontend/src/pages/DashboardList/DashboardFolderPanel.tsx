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
import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import {
  ActionButton,
  Button,
  DeleteModal,
  FormItem,
  Icons,
  Input,
  Modal,
  Select,
  Tooltip,
  Tree,
  type TreeDataNode,
} from '@superset-ui/core/components';

export interface DashboardFolder {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  dashboard_count: number;
  can_create: boolean;
  can_rename: boolean;
  can_delete: boolean;
  can_move_dashboard: boolean;
}

interface DashboardFolderPanelProps {
  folders: DashboardFolder[];
  selectedFolderId: string | null;
  canCreate: boolean;
  onSelect: (folderId: string | null) => void;
  onCreate: (name: string, parentId: string | null) => Promise<void>;
  onRename: (folder: DashboardFolder, name: string) => Promise<void>;
  onDelete: (folder: DashboardFolder) => Promise<void>;
}

const Panel = styled.aside<{ collapsed: boolean }>`
  flex: 0 0 ${({ collapsed }) => (collapsed ? '48px' : '280px')};
  width: ${({ collapsed }) => (collapsed ? '48px' : '280px')};
  min-width: ${({ collapsed }) => (collapsed ? '48px' : '240px')};
  border-right: 1px solid ${({ theme }) => theme.colorBorderSecondary};
  padding: ${({ collapsed, theme }) =>
    collapsed ? theme.sizeUnit * 2 : theme.sizeUnit * 4}px;
  background: ${({ theme }) => theme.colorBgContainer};
  overflow: hidden;
  transition:
    width 160ms ease,
    flex-basis 160ms ease;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 2}px;
  font-weight: ${({ theme }) => theme.fontWeightStrong};
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const CollapseButton = styled(Button)`
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
`;

const OverviewButton = styled.button<{ selected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 36px;
  margin-bottom: ${({ theme }) => theme.sizeUnit}px;
  padding: 0 ${({ theme }) => theme.sizeUnit * 2}px;
  border: 0;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  background: ${({ selected, theme }) =>
    selected ? theme.colorPrimaryBg : 'transparent'};
  color: ${({ selected, theme }) =>
    selected ? theme.colorPrimary : theme.colorText};
  text-align: left;
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colorFillSecondary};
  }
`;

const FolderTree = styled(Tree)`
  margin-top: ${({ theme }) => theme.sizeUnit}px;
  background: transparent;

  .ant-tree-list-holder-inner > .ant-tree-treenode {
    width: 100%;
    min-height: 36px;
    align-items: center;
    border-radius: ${({ theme }) => theme.borderRadius}px;
  }

  .ant-tree-treenode:hover {
    background: ${({ theme }) => theme.colorFillSecondary};
  }

  .ant-tree-treenode.ant-tree-treenode-selected {
    background: ${({ theme }) => theme.colorPrimaryBg};
  }

  .ant-tree-switcher {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    line-height: normal;
  }

  .ant-tree-switcher-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ant-tree-node-content-wrapper {
    min-width: 0;
    min-height: 32px;
    padding: 0 ${({ theme }) => theme.sizeUnit}px;
    border-radius: ${({ theme }) => theme.borderRadius}px;
    line-height: 32px;
  }

  .ant-tree-treenode:hover > .ant-tree-node-content-wrapper,
  .ant-tree-treenode.ant-tree-treenode-selected
    > .ant-tree-node-content-wrapper {
    background: transparent;
  }

  .ant-tree-node-content-wrapper:hover .folder-actions,
  .ant-tree-node-content-wrapper:focus-within .folder-actions {
    opacity: 1;
  }
`;

const FolderTitle = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const FolderLabel = styled.span`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const FolderName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const FolderActions = styled.span`
  display: flex;
  flex: none;
  align-items: center;
  opacity: 0;
`;

const EditorInput = styled(Input)`
  height: ${({ theme }) => theme.sizeUnit * 10}px;
`;

const EditorSelect = styled(Select)`
  width: 100%;
  height: ${({ theme }) => theme.sizeUnit * 10}px;

  .ant-select-selector {
    height: ${({ theme }) => theme.sizeUnit * 10}px !important;
    align-items: center;
  }
`;

interface FolderEditorProps {
  folder?: DashboardFolder;
  folders: DashboardFolder[];
  onClose: () => void;
  onSubmit: (name: string, parentId: string | null) => Promise<void>;
}

function FolderEditor({
  folder,
  folders,
  onClose,
  onSubmit,
}: FolderEditorProps) {
  const [name, setName] = useState(folder?.name ?? '');
  const [parentId, setParentId] = useState<string | null>(
    folder?.parent_id ?? null,
  );
  const [saving, setSaving] = useState(false);
  const options = folders
    .filter(item => item.id !== folder?.id && item.can_create)
    .map(item => ({ label: item.name, value: item.id }));

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit(name.trim(), parentId);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      show
      title={
        folder ? t('Rename dashboard folder') : t('Create dashboard folder')
      }
      onHide={onClose}
      onHandledPrimaryAction={save}
      primaryButtonName={folder ? t('Save') : t('Create')}
      disablePrimaryButton={!name.trim() || saving}
    >
      <FormItem label={t('Folder name')} required>
        <EditorInput
          aria-label={t('Folder name')}
          value={name}
          maxLength={100}
          onChange={event => setName(event.target.value)}
        />
      </FormItem>
      {!folder && (
        <FormItem label={t('Parent folder')}>
          <EditorSelect
            aria-label={t('Parent folder')}
            allowClear
            options={options}
            value={parentId ?? undefined}
            onChange={value => setParentId(value ? String(value) : null)}
          />
        </FormItem>
      )}
    </Modal>
  );
}

export function DashboardFolderPanel({
  folders,
  selectedFolderId,
  canCreate,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: DashboardFolderPanelProps) {
  const [editing, setEditing] = useState<DashboardFolder | 'create' | null>(
    null,
  );
  const [deleting, setDeleting] = useState<DashboardFolder | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedFolderIds, setExpandedFolderIds] = useState<string[]>([]);
  const knownParentFolderIds = useRef(new Set<string>());
  const children = useMemo(() => {
    const map = new Map<string | null, DashboardFolder[]>();
    folders.forEach(folder => {
      const key = folder.parent_id ?? null;
      map.set(key, [...(map.get(key) ?? []), folder]);
    });
    return map;
  }, [folders]);

  useEffect(() => {
    const validFolderIds = new Set(folders.map(folder => folder.id));
    const parentFolderIds = new Set(
      folders
        .map(folder => folder.parent_id)
        .filter((parentId): parentId is string => Boolean(parentId)),
    );
    setExpandedFolderIds(current => {
      const next = new Set(current.filter(id => validFolderIds.has(id)));
      parentFolderIds.forEach(id => {
        if (!knownParentFolderIds.current.has(id)) next.add(id);
      });
      return [...next];
    });
    knownParentFolderIds.current = parentFolderIds;
  }, [folders]);

  useEffect(() => {
    if (!selectedFolderId || selectedFolderId === 'uncategorized') return;

    const parentById = new Map(
      folders.map(folder => [folder.id, folder.parent_id ?? null]),
    );
    const ancestors: string[] = [];
    const visited = new Set<string>();
    let parentId = parentById.get(selectedFolderId);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      ancestors.push(parentId);
      parentId = parentById.get(parentId);
    }
    setCollapsed(false);
    setExpandedFolderIds(current => [...new Set([...current, ...ancestors])]);
  }, [folders, selectedFolderId]);

  const treeData = useMemo(() => {
    const buildTree = (
      parentId: string | null,
      ancestors: Set<string>,
    ): TreeDataNode[] =>
      (children.get(parentId) ?? [])
        .filter(folder => !ancestors.has(folder.id))
        .map(folder => {
          const nextAncestors = new Set(ancestors).add(folder.id);
          const childNodes = buildTree(folder.id, nextAncestors);
          const isExpanded = expandedFolderIds.includes(folder.id);
          return {
            key: folder.id,
            title: (
              <FolderTitle>
                <FolderLabel title={folder.name}>
                  {isExpanded ? (
                    <Icons.FolderOpenOutlined iconSize="m" />
                  ) : (
                    <Icons.FolderOutlined iconSize="m" />
                  )}
                  <FolderName>{folder.name}</FolderName>
                </FolderLabel>
                {(folder.can_rename || folder.can_delete) && (
                  <FolderActions
                    className="folder-actions"
                    onClick={event => event.stopPropagation()}
                  >
                    {folder.can_rename && (
                      <ActionButton
                        label={t('Rename folder')}
                        tooltip={t('Rename folder')}
                        icon={<Icons.EditOutlined iconSize="m" />}
                        onClick={() => setEditing(folder)}
                      />
                    )}
                    {folder.can_delete && (
                      <ActionButton
                        label={t('Delete folder')}
                        tooltip={t('Delete folder')}
                        icon={<Icons.DeleteOutlined iconSize="m" />}
                        onClick={() => setDeleting(folder)}
                      />
                    )}
                  </FolderActions>
                )}
              </FolderTitle>
            ),
            children: childNodes.length ? childNodes : undefined,
            isLeaf: childNodes.length === 0,
          };
        });

    return buildTree(null, new Set());
  }, [children, expandedFolderIds]);

  if (collapsed) {
    return (
      <Panel collapsed aria-label={t('Dashboard folders')}>
        <Tooltip title={t('Expand folders')}>
          <CollapseButton
            buttonStyle="link"
            aria-label={t('Expand folders')}
            aria-expanded={false}
            onClick={() => setCollapsed(false)}
          >
            <Icons.RightOutlined iconSize="m" />
          </CollapseButton>
        </Tooltip>
      </Panel>
    );
  }

  return (
    <Panel collapsed={false} aria-label={t('Dashboard folders')}>
      <Header>
        <span>{t('Folders')}</span>
        <HeaderActions>
          {canCreate && (
            <Tooltip title={t('Create dashboard folder')}>
              <CollapseButton
                buttonStyle="link"
                aria-label={t('Create dashboard folder')}
                onClick={() => setEditing('create')}
              >
                <Icons.PlusOutlined iconSize="m" />
              </CollapseButton>
            </Tooltip>
          )}
          <Tooltip title={t('Collapse folders')}>
            <CollapseButton
              buttonStyle="link"
              aria-label={t('Collapse folders')}
              aria-expanded
              onClick={() => setCollapsed(true)}
            >
              <Icons.LeftOutlined iconSize="m" />
            </CollapseButton>
          </Tooltip>
        </HeaderActions>
      </Header>
      <OverviewButton
        selected={selectedFolderId === 'uncategorized'}
        onClick={() =>
          onSelect(
            selectedFolderId === 'uncategorized' ? null : 'uncategorized',
          )
        }
      >
        <span>{t('Uncategorized')}</span>
      </OverviewButton>
      <FolderTree
        blockNode
        expandedKeys={expandedFolderIds}
        onExpand={keys => setExpandedFolderIds(keys.map(String))}
        selectedKeys={
          selectedFolderId && selectedFolderId !== 'uncategorized'
            ? [selectedFolderId]
            : []
        }
        treeData={treeData}
        onSelect={(keys, info) => {
          const folderId = String(info.node.key);
          const isSelected = Boolean(keys[0]);
          setExpandedFolderIds(current =>
            isSelected
              ? [...new Set([...current, folderId])]
              : current.filter(id => id !== folderId),
          );
          onSelect(isSelected ? folderId : null);
        }}
      />
      {editing && (
        <FolderEditor
          folder={editing === 'create' ? undefined : editing}
          folders={folders}
          onClose={() => setEditing(null)}
          onSubmit={(name, parentId) =>
            editing === 'create'
              ? onCreate(name, parentId)
              : onRename(editing, name)
          }
        />
      )}
      <DeleteModal
        open={Boolean(deleting)}
        title={t('Delete dashboard folder')}
        description={t(
          'This also deletes its child folders. Dashboards will become uncategorized.',
        )}
        onHide={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const folder = deleting;
          await onDelete(folder);
          setDeleting(current => (current?.id === folder.id ? null : current));
        }}
      />
    </Panel>
  );
}
