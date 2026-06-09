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
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { styled, css } from '@apache-superset/core/theme';
import { StandardModal } from 'src/components/Modal';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';

interface Folder {
  id: number;
  uuid: string;
  name: string;
  parent_uuid: string | null;
  children_count: number;
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

const FolderRow = styled.div<{ selected?: boolean; depth?: number }>`
  ${({ theme, selected, depth = 0 }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    padding-left: ${theme.sizeUnit * 3 + depth * theme.sizeUnit * 4}px;
    border-radius: 4px;
    cursor: pointer;
    background: ${selected ? theme.colorInfoBg : 'transparent'};
    border: 1px solid ${selected ? theme.colorPrimary : 'transparent'};

    &:hover {
      background: ${selected ? theme.colorInfoBg : theme.colorBgTextHover};
    }

    .folder-name {
      flex: 1;
    }

    .toggle-button {
      display: flex;
      align-items: center;
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      color: ${theme.colorIcon};
      &:hover {
        color: ${theme.colorPrimary};
      }
    }
  `}
`;

const FolderTree = styled.div`
  max-height: 400px;
  overflow-y: auto;
`;

interface TreeNode extends Folder {
  children: TreeNode[];
}

function buildTree(folders: Folder[]): TreeNode[] {
  const map = new Map<string | null, TreeNode[]>();
  const nodes: TreeNode[] = folders.map(f => ({ ...f, children: [] }));

  for (const node of nodes) {
    const parentKey = node.parent_uuid ?? null;
    if (!map.has(parentKey)) map.set(parentKey, []);
    map.get(parentKey)!.push(node);
  }

  // Attach children
  for (const node of nodes) {
    node.children = map.get(node.uuid) || [];
  }

  // Return root-level nodes
  return map.get(null) || [];
}

function getDescendantUuids(node: TreeNode): Set<string> {
  const result = new Set<string>();
  function walk(n: TreeNode) {
    result.add(n.uuid);
    n.children.forEach(walk);
  }
  walk(node);
  return result;
}

export default function MoveToModal({
  item,
  currentFolderUuid,
  show,
  onHide,
  onSuccess,
}: MoveToModalProps) {
  const { addSuccessToast, addDangerToast } = useToasts();
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [expandedUuids, setExpandedUuids] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    setSelectedUuid(null);
    setExpandedUuids(new Set());
    setLoading(true);
    SupersetClient.get({
      endpoint: '/api/v1/folders/?folder_type=analytics',
    })
      .then(({ json }) => {
        setAllFolders(json.result || []);
      })
      .catch(() => addDangerToast(t('Error loading folders')))
      .finally(() => setLoading(false));
  }, [show, addDangerToast]);

  // Build tree and exclude the item being moved + its descendants
  const tree = useMemo(() => {
    const fullTree = buildTree(allFolders);
    if (item.type !== 'folder') return fullTree;

    // Find the node being moved and collect its descendants
    const allNodes = buildTree(allFolders);
    function findNode(nodes: TreeNode[], uuid: string): TreeNode | null {
      for (const n of nodes) {
        if (n.uuid === uuid) return n;
        const found = findNode(n.children, uuid);
        if (found) return found;
      }
      return null;
    }
    const movingNode = item.uuid ? findNode(allNodes, item.uuid) : null;
    const excludeUuids = movingNode
      ? getDescendantUuids(movingNode)
      : new Set<string>();

    // Filter out excluded nodes
    function filterTree(nodes: TreeNode[]): TreeNode[] {
      return nodes
        .filter(n => !excludeUuids.has(n.uuid))
        .map(n => ({ ...n, children: filterTree(n.children) }));
    }
    return filterTree(fullTree);
  }, [allFolders, item]);

  const toggleExpand = useCallback((uuid: string) => {
    setExpandedUuids(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
      } else {
        next.add(uuid);
      }
      return next;
    });
  }, []);

  const handleMove = useCallback(async () => {
    setSaving(true);
    try {
      if (selectedUuid === 'root') {
        // Move to root: if folder, set parent_id to null; if asset, remove from folder
        if (item.type === 'folder') {
          await SupersetClient.put({
            endpoint: `/api/v1/folders/${item.uuid}`,
            jsonPayload: { parent_uuid: null },
          });
        } else {
          // Remove asset from its current folder by moving to root
          // This requires a separate endpoint or convention
          // For now, use the folder update to set parent to null
          await SupersetClient.delete({
            endpoint: `/api/v1/folders/${currentFolderUuid}/assets/${item.type}/${item.id}`,
          });
        }
      } else if (selectedUuid) {
        await SupersetClient.put({
          endpoint: `/api/v1/folders/${selectedUuid}/assets/${item.type}/${item.id}`,
        });
      }
      addSuccessToast(t('Moved "%s" successfully', item.name));
      onSuccess();
      onHide();
    } catch {
      addDangerToast(t('Error moving item'));
    } finally {
      setSaving(false);
    }
  }, [
    selectedUuid,
    item,
    currentFolderUuid,
    addSuccessToast,
    addDangerToast,
    onSuccess,
    onHide,
  ]);

  function renderNodes(nodes: TreeNode[], depth: number = 0) {
    return nodes.map(node => {
      const isExpanded = expandedUuids.has(node.uuid);
      const hasChildren = node.children.length > 0;
      return (
        <div key={node.uuid}>
          <FolderRow
            selected={selectedUuid === node.uuid}
            depth={depth}
            onClick={() => setSelectedUuid(node.uuid)}
          >
            {hasChildren ? (
              <button
                type="button"
                className="toggle-button"
                onClick={e => {
                  e.stopPropagation();
                  toggleExpand(node.uuid);
                }}
              >
                {isExpanded ? (
                  <Icons.DownOutlined iconSize="s" />
                ) : (
                  <Icons.RightOutlined iconSize="s" />
                )}
              </button>
            ) : (
              <span style={{ width: 14 }} />
            )}
            <Icons.FolderOutlined iconSize="m" />
            <span className="folder-name">{node.name}</span>
          </FolderRow>
          {isExpanded && hasChildren && renderNodes(node.children, depth + 1)}
        </div>
      );
    });
  }

  return (
    <StandardModal
      title={t('Move "%s" to…', item.name)}
      show={show}
      onHide={onHide}
      onSave={handleMove}
      saveText={t('Move')}
      saveDisabled={selectedUuid === null}
      saveLoading={saving}
    >
      <ModalContent>
        {loading ? (
          <p>{t('Loading folders...')}</p>
        ) : (
          <FolderTree>
            <FolderRow
              selected={selectedUuid === 'root'}
              onClick={() => setSelectedUuid('root')}
            >
              <Icons.FolderOpenOutlined iconSize="m" />
              <span className="folder-name">{t('Root (Analytics)')}</span>
            </FolderRow>
            {renderNodes(tree)}
          </FolderTree>
        )}
      </ModalContent>
    </StandardModal>
  );
}
