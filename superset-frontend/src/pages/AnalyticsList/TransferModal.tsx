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
import { type UIEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import rison from 'rison';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import {
  Button,
  Checkbox,
  Constants,
  Flex,
  Input,
  List,
  Loading,
} from '@superset-ui/core/components';
import { TreeSelect } from '@superset-ui/core/components/TreeSelect';
import { StandardModal, MODAL_LARGE_WIDTH } from 'src/components/Modal';
import { Icons } from '@superset-ui/core/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';

type ItemType = 'folder' | 'chart' | 'dashboard';

interface TransferItem {
  key: string;
  type: ItemType;
  id: number;
  uuid?: string | null;
  name: string;
}

interface FolderOption {
  uuid: string;
  name: string;
  parent_uuid: string | null;
}

interface TransferModalProps {
  currentFolderUuid: string | null;
  currentFolderName: string;
  preSelectedKeys?: string[];
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
}

const PAGE_SIZE = 25;
const SCROLL_THRESHOLD = 0.7;

const PanelContainer = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: ${theme.sizeUnit * 2}px;
    align-items: start;
    min-height: 400px;
  `}
`;

const Panel = styled.div`
  ${({ theme }) => css`
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: ${theme.sizeUnit * 4}px;
    min-width: 0;
  `}
`;

const Field = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit}px;
    min-width: 0;
  `}
`;

const BulkActionsBar = styled(Flex)`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit}px 0;
    border-bottom: 1px solid ${theme.colorSplit};
    .superset-button {
      font-family: inherit;
      margin-left: 0 !important;
    }
    .superset-button:first-of-type {
      padding-right: 0 !important;
    }
    .superset-button:last-of-type {
      padding-left: 0 !important;
    }
  `}
`;

const FieldLabel = styled.div`
  ${({ theme }) => css`
    font-weight: ${theme.fontWeightStrong};
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextLabel};
  `}
`;

const PanelCount = styled.div`
  ${({ theme }) => css`
    font-size: ${theme.fontSizeSM}px;
    color: ${theme.colorTextSecondary};
  `}
`;

const ArrowColumn = styled.div`
  ${({ theme }) => css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${theme.sizeUnit}px;
    padding: 0 ${theme.sizeUnit}px;
    align-self: center;
  `}
`;

const ModalContent = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

const ScrollableList = styled.div`
  ${({ theme }) => css`
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const EmptyState = styled.p`
  ${({ theme }) => css`
    opacity: 0.5;
    padding: ${theme.sizeUnit * 4}px;
    text-align: center;
  `}
`;

function toTransferItem(item: {
  type: string;
  id: number;
  uuid?: string | null;
  name: string;
}): TransferItem {
  return {
    key: `${item.type}-${item.id}`,
    type: item.type as ItemType,
    id: item.id,
    uuid: item.uuid,
    name: item.name,
  };
}

function ItemIcon({ type }: { type: ItemType }) {
  if (type === 'chart') return <Icons.AreaChartOutlined iconSize="m" />;
  if (type === 'dashboard') return <Icons.AppstoreOutlined iconSize="m" />;
  return <Icons.FolderOutlined iconSize="m" />;
}

async function fetchPage(
  folderUuid: string | null,
  page: number,
  search?: string,
): Promise<{ items: TransferItem[]; total: number }> {
  const base = folderUuid
    ? `/api/v1/folders/${folderUuid}/assets`
    : '/api/v1/folders/assets';
  const risonParams: Record<string, unknown> = {
    page,
    page_size: PAGE_SIZE,
    order_column: 'changed_on',
    order_direction: 'desc',
  };
  if (search) {
    risonParams.filters = [{ col: 'name', opr: 'ct', value: search }];
  }
  const q = rison.encode_uri(risonParams);
  const folderParam = folderUuid ? '' : 'folder_type=analytics&';
  const response = await SupersetClient.get({
    endpoint: `${base}?${folderParam}q=${q}`,
  });
  const results =
    (response.json.result as {
      type: string;
      id: number;
      uuid?: string | null;
      name: string;
    }[]) || [];
  return {
    items: results.map(toTransferItem),
    total: (response.json.count as number) || 0,
  };
}

export default function TransferModal({
  currentFolderUuid,
  currentFolderName,
  preSelectedKeys,
  show,
  onHide,
  onSuccess,
}: TransferModalProps) {
  const { addDangerToast, addSuccessToast } = useToasts();
  const theme = useTheme();
  const [leftItems, setLeftItems] = useState<TransferItem[]>([]);
  const [leftTotal, setLeftTotal] = useState(0);
  const [leftPage, setLeftPage] = useState(0);
  const [rightItems, setRightItems] = useState<TransferItem[]>([]);
  const [rightTotal, setRightTotal] = useState(0);
  const [rightPage, setRightPage] = useState(0);
  const [leftSelected, setLeftSelected] = useState<Set<string>>(new Set());
  const [rightSelected, setRightSelected] = useState<Set<string>>(new Set());
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [targetFolderUuid, setTargetFolderUuid] = useState<string | null>(null);
  const [allFolders, setAllFolders] = useState<FolderOption[]>([]);
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [originalRightItems, setOriginalRightItems] = useState<
    Map<string, TransferItem>
  >(() => new Map());

  // Fetch left (source) first page + folder list on open
  useEffect(() => {
    if (!show) return;
    setLeftSearch('');
    setRightSearch('');
    setLeftSelected(new Set());
    setRightSelected(new Set());
    setRightItems([]);
    setRightTotal(0);
    setRightPage(0);
    setTargetFolderUuid(null);
    setOriginalRightItems(new Map());
    setLeftLoading(true);

    Promise.all([
      fetchPage(currentFolderUuid, 0),
      SupersetClient.get({
        endpoint: '/api/v1/folders/?folder_type=analytics',
      }),
    ])
      .then(([{ items, total }, foldersRes]) => {
        setLeftItems(items);
        setLeftTotal(total);
        setLeftPage(0);
        const folders = (
          (foldersRes.json.result as FolderOption[]) || []
        ).filter(f => f.uuid !== currentFolderUuid);
        setAllFolders(folders);
        if (preSelectedKeys?.length) {
          setLeftSelected(new Set(preSelectedKeys));
        }
      })
      .catch(() => addDangerToast(t('Error loading data')))
      .finally(() => setLeftLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, currentFolderUuid, addDangerToast]);

  // Fetch right (target) first page when target changes
  useEffect(() => {
    if (!show || !targetFolderUuid) {
      setRightItems([]);
      setRightTotal(0);
      setRightPage(0);
      setOriginalRightItems(new Map());
      return;
    }
    setRightSearch('');
    setRightSelected(new Set());
    setRightLoading(true);
    const apiUuid = targetFolderUuid === '__root__' ? null : targetFolderUuid;
    fetchPage(apiUuid, 0)
      .then(({ items, total }) => {
        setRightItems(items);
        setRightTotal(total);
        setRightPage(0);
        setOriginalRightItems(new Map(items.map(i => [i.key, i])));
      })
      .catch(() => addDangerToast(t('Error loading folder contents')))
      .finally(() => setRightLoading(false));
  }, [show, targetFolderUuid, addDangerToast]);

  // Debounced server-side search for left panel
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      setLeftLoading(true);
      fetchPage(currentFolderUuid, 0, leftSearch || undefined)
        .then(({ items, total }) => {
          setLeftItems(items);
          setLeftTotal(total);
          setLeftPage(0);
        })
        .catch(() => addDangerToast(t('Error searching items')))
        .finally(() => setLeftLoading(false));
    }, Constants.SLOW_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [leftSearch, show, currentFolderUuid, addDangerToast]);

  // Debounced server-side search for right panel
  useEffect(() => {
    if (!show || !targetFolderUuid) return;
    const timer = setTimeout(() => {
      const apiUuid = targetFolderUuid === '__root__' ? null : targetFolderUuid;
      setRightLoading(true);
      fetchPage(apiUuid, 0, rightSearch || undefined)
        .then(({ items, total }) => {
          setRightItems(items);
          setRightTotal(total);
          setRightPage(0);
        })
        .catch(() => addDangerToast(t('Error searching items')))
        .finally(() => setRightLoading(false));
    }, Constants.SLOW_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [rightSearch, show, targetFolderUuid, addDangerToast]);

  // Scroll handler — fetch next page when near bottom (AsyncSelect pattern)
  const handleLeftScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom =
        el.scrollTop > (el.scrollHeight - el.offsetHeight) * SCROLL_THRESHOLD;
      const hasMore = (leftPage + 1) * PAGE_SIZE < leftTotal;
      if (!leftLoading && hasMore && nearBottom) {
        const nextPage = leftPage + 1;
        setLeftLoading(true);
        fetchPage(currentFolderUuid, nextPage, leftSearch || undefined)
          .then(({ items }) => {
            setLeftItems(prev => {
              const existing = new Set(prev.map(i => i.key));
              return [...prev, ...items.filter(i => !existing.has(i.key))];
            });
            setLeftPage(nextPage);
          })
          .catch(() => addDangerToast(t('Error loading more items')))
          .finally(() => setLeftLoading(false));
      }
    },
    [
      leftPage,
      leftTotal,
      leftLoading,
      leftSearch,
      currentFolderUuid,
      addDangerToast,
    ],
  );

  const handleRightScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const nearBottom =
        el.scrollTop > (el.scrollHeight - el.offsetHeight) * SCROLL_THRESHOLD;
      const hasMore = (rightPage + 1) * PAGE_SIZE < rightTotal;
      if (!rightLoading && hasMore && nearBottom) {
        const nextPage = rightPage + 1;
        const apiUuid =
          targetFolderUuid === '__root__' ? null : targetFolderUuid;
        setRightLoading(true);
        fetchPage(apiUuid, nextPage, rightSearch || undefined)
          .then(({ items }) => {
            setRightItems(prev => {
              const existing = new Set(prev.map(i => i.key));
              return [...prev, ...items.filter(i => !existing.has(i.key))];
            });
            setRightPage(nextPage);
          })
          .catch(() => addDangerToast(t('Error loading more items')))
          .finally(() => setRightLoading(false));
      }
    },
    [
      rightPage,
      rightTotal,
      rightLoading,
      rightSearch,
      targetFolderUuid,
      addDangerToast,
    ],
  );

  const toggleLeftSelect = useCallback((key: string) => {
    setLeftSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleRightSelect = useCallback((key: string) => {
    setRightSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const moveRight = useCallback(() => {
    if (!leftSelected.size) return;
    const moving = leftItems.filter(i => leftSelected.has(i.key));
    setLeftItems(prev => prev.filter(i => !leftSelected.has(i.key)));
    setRightItems(prev => [...prev, ...moving]);
    setLeftSelected(new Set());
  }, [leftSelected, leftItems]);

  const moveLeft = useCallback(() => {
    if (!rightSelected.size) return;
    const moving = rightItems.filter(i => rightSelected.has(i.key));
    setRightItems(prev => prev.filter(i => !rightSelected.has(i.key)));
    setLeftItems(prev => [...prev, ...moving]);
    setRightSelected(new Set());
  }, [rightSelected, rightItems]);

  const hasChanges = useMemo(() => {
    // Check if any items were moved TO the target (exist in right but not originally)
    const addedToRight = rightItems.some(i => !originalRightItems.has(i.key));
    // Check if any items were moved FROM the target (originally in right but no longer)
    const rightKeysNow = new Set(rightItems.map(i => i.key));
    const removedFromRight = Array.from(originalRightItems.keys()).some(
      key => !rightKeysNow.has(key),
    );
    return addedToRight || removedFromRight;
  }, [rightItems, originalRightItems]);

  const handleDone = useCallback(async () => {
    if (!targetFolderUuid) return;
    const targetApiUuid =
      targetFolderUuid === '__root__' ? null : targetFolderUuid;
    setSaving(true);
    try {
      const rightKeysNow = new Set(rightItems.map(i => i.key));
      const calls: Promise<unknown>[] = [];

      const addedToTarget = rightItems.filter(
        i => !originalRightItems.has(i.key),
      );
      const assetsToAdd = addedToTarget.filter(i => i.type !== 'folder');
      const foldersToAdd = addedToTarget.filter(i => i.type === 'folder');

      if (assetsToAdd.length && targetApiUuid) {
        // Move assets into target folder
        calls.push(
          SupersetClient.post({
            endpoint: `/api/v1/folders/${targetApiUuid}/assets`,
            jsonPayload: {
              assets: assetsToAdd.map(i => ({ type: i.type, id: i.id })),
            },
          }),
        );
      } else if (assetsToAdd.length && !targetApiUuid && currentFolderUuid) {
        // Move assets to root — remove them from source folder
        const q = rison.encode(
          assetsToAdd.map(i => ({ type: i.type, id: i.id })),
        );
        calls.push(
          SupersetClient.delete({
            endpoint: `/api/v1/folders/${currentFolderUuid}/assets?q=${q}`,
          }),
        );
      }
      for (const f of foldersToAdd) {
        if (f.uuid) {
          calls.push(
            SupersetClient.put({
              endpoint: `/api/v1/folders/${f.uuid}`,
              jsonPayload: { parent_uuid: targetApiUuid },
            }),
          );
        }
      }

      for (const [key, item] of originalRightItems) {
        if (!rightKeysNow.has(key)) {
          if (item.type === 'folder' && item.uuid) {
            calls.push(
              SupersetClient.put({
                endpoint: `/api/v1/folders/${item.uuid}`,
                jsonPayload: { parent_uuid: currentFolderUuid },
              }),
            );
          } else if (currentFolderUuid) {
            calls.push(
              SupersetClient.post({
                endpoint: `/api/v1/folders/${currentFolderUuid}/assets`,
                jsonPayload: {
                  assets: [{ type: item.type, id: item.id }],
                },
              }),
            );
          }
        }
      }

      const results = await Promise.allSettled(calls);
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length) {
        addDangerToast(t('%s item(s) failed to move', failures.length));
      } else {
        addSuccessToast(t('Items moved successfully'));
      }
      onSuccess();
      onHide();
    } catch {
      addDangerToast(t('Error moving items'));
    } finally {
      setSaving(false);
    }
  }, [
    targetFolderUuid,
    currentFolderUuid,
    rightItems,
    originalRightItems,
    addSuccessToast,
    addDangerToast,
    onSuccess,
    onHide,
  ]);

  const filteredLeft = useMemo(() => {
    if (!targetFolderUuid) return leftItems;
    const rightKeys = new Set(rightItems.map(i => i.key));
    return leftItems.filter(
      i =>
        !(i.type === 'folder' && i.uuid === targetFolderUuid) &&
        !rightKeys.has(i.key),
    );
  }, [leftItems, targetFolderUuid, rightItems]);

  const filteredRight = useMemo(
    () =>
      rightItems.filter(
        i => !(i.type === 'folder' && i.uuid === currentFolderUuid),
      ),
    [rightItems, currentFolderUuid],
  );

  const leftSelectableCount = filteredLeft.filter(
    (i: TransferItem) => !leftSelected.has(i.key),
  ).length;
  const leftDeselectableCount = filteredLeft.filter((i: TransferItem) =>
    leftSelected.has(i.key),
  ).length;
  const rightSelectableCount = filteredRight.filter(
    (i: TransferItem) => !rightSelected.has(i.key),
  ).length;
  const rightDeselectableCount = filteredRight.filter((i: TransferItem) =>
    rightSelected.has(i.key),
  ).length;

  const folderTreeData = useMemo(() => {
    // Collect UUIDs of selected folders — they can't be their own target.
    const selectedFolderUuids = new Set(
      leftItems
        .filter(i => i.type === 'folder' && i.uuid && leftSelected.has(i.key))
        .map(i => i.uuid as string),
    );

    // BFS: also exclude all descendants so a parent can't be moved into a child.
    const childrenMap = new Map<string, string[]>();
    for (const f of allFolders) {
      if (f.parent_uuid) {
        const siblings = childrenMap.get(f.parent_uuid) ?? [];
        siblings.push(f.uuid);
        childrenMap.set(f.parent_uuid, siblings);
      }
    }
    const excluded = new Set(selectedFolderUuids);
    const queue = [...selectedFolderUuids];
    while (queue.length) {
      const uuid = queue.shift()!;
      for (const childUuid of childrenMap.get(uuid) ?? []) {
        if (!excluded.has(childUuid)) {
          excluded.add(childUuid);
          queue.push(childUuid);
        }
      }
    }

    const eligible = allFolders.filter(f => !excluded.has(f.uuid));

    // Build tree from flat list
    type TreeNode = {
      value: string;
      title: string;
      children: TreeNode[];
    };
    const nodeMap = new Map<string, TreeNode>();
    for (const f of eligible) {
      nodeMap.set(f.uuid, { value: f.uuid, title: f.name, children: [] });
    }
    const roots: TreeNode[] = [];
    for (const f of eligible) {
      const node = nodeMap.get(f.uuid)!;
      const parentNode = f.parent_uuid ? nodeMap.get(f.parent_uuid) : null;
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    }

    // Prepend root option when inside a folder
    if (currentFolderUuid) {
      roots.unshift({
        value: '__root__',
        title: t('Root (Analytics)'),
        children: [],
      });
    }

    return roots;
  }, [allFolders, currentFolderUuid, leftItems, leftSelected]);

  return (
    <StandardModal
      title={t('Move items')}
      show={show}
      onHide={onHide}
      onSave={handleDone}
      saveText={t('Done')}
      saveLoading={saving}
      saveDisabled={!hasChanges || !targetFolderUuid}
      width={MODAL_LARGE_WIDTH}
    >
      <ModalContent>
        <PanelContainer>
          <Panel>
            <Field>
              <FieldLabel>{t('Source folder')}</FieldLabel>
              <Input
                value={currentFolderName || t('Root (Analytics)')}
                disabled
              />
            </Field>
            <Field>
              <PanelCount>
                {leftSelected.size > 0
                  ? t('%s/%s items selected', leftSelected.size, leftTotal)
                  : t('0 items selected')}
              </PanelCount>
              <Input
                placeholder={t('Search here')}
                value={leftSearch}
                onChange={e => setLeftSearch(e.target.value)}
                allowClear
              />
            </Field>
            <Field>
              <BulkActionsBar gap={theme.sizeUnit}>
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  disabled={leftSelectableCount === 0}
                  onClick={() =>
                    setLeftSelected(
                      (prev: Set<string>) =>
                        new Set([
                          ...prev,
                          ...filteredLeft.map((i: TransferItem) => i.key),
                        ]),
                    )
                  }
                >
                  {t('Select all (%s)', leftSelectableCount)}
                </Button>
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  disabled={leftDeselectableCount === 0}
                  onClick={() =>
                    setLeftSelected((prev: Set<string>) => {
                      const next = new Set(prev);
                      filteredLeft.forEach((i: TransferItem) =>
                        next.delete(i.key),
                      );
                      return next;
                    })
                  }
                >
                  {t('Clear (%s)', leftDeselectableCount)}
                </Button>
              </BulkActionsBar>
              {leftLoading && !leftItems.length ? (
                <Loading />
              ) : (
                <ScrollableList onScroll={handleLeftScroll}>
                  <List
                    dataSource={filteredLeft}
                    locale={{ emptyText: t('No items') }}
                    renderItem={(item: TransferItem) => (
                      <List.Item
                        key={item.key}
                        onClick={() => toggleLeftSelect(item.key)}
                        css={{ cursor: 'pointer' }}
                      >
                        <Flex align="center" gap={theme.sizeUnit * 2}>
                          <Checkbox
                            css={{ paddingLeft: theme.sizeUnit * 2 }}
                            checked={leftSelected.has(item.key)}
                          />
                          <ItemIcon type={item.type} />
                          {item.name}
                        </Flex>
                      </List.Item>
                    )}
                  />
                </ScrollableList>
              )}
            </Field>
          </Panel>

          <ArrowColumn>
            <Button
              buttonStyle="primary"
              buttonSize="small"
              disabled={!leftSelected.size || !targetFolderUuid}
              onClick={moveRight}
            >
              <Icons.RightOutlined iconSize="m" />
            </Button>
            <Button
              buttonStyle="primary"
              buttonSize="small"
              disabled={!rightSelected.size}
              onClick={moveLeft}
              css={css`
                margin-left: 0 !important;
              `}
            >
              <Icons.LeftOutlined iconSize="m" />
            </Button>
          </ArrowColumn>

          <Panel>
            <Field>
              <FieldLabel>{t('Destination folder')}</FieldLabel>
              <TreeSelect
                aria-label={t('Target folder')}
                placeholder={t('Select a location…')}
                treeData={folderTreeData}
                value={targetFolderUuid}
                onChange={(val: string) => setTargetFolderUuid(val)}
                treeDefaultExpandAll
                showSearch
                filterTreeNode={(input, node) =>
                  (node?.title as string)
                    ?.toLowerCase()
                    .includes(input.toLowerCase()) ?? false
                }
                getPopupContainer={trigger =>
                  trigger.closest('.ant-modal-content') || document.body
                }
                css={{ width: '100%' }}
              />
            </Field>
            <Field>
              <PanelCount>
                {rightSelected.size > 0
                  ? t('%s/%s items selected', rightSelected.size, rightTotal)
                  : t('0 items selected')}
              </PanelCount>
              <Input
                placeholder={t('Search here')}
                value={rightSearch}
                onChange={e => setRightSearch(e.target.value)}
                allowClear
              />
            </Field>
            <Field>
              <BulkActionsBar gap={theme.sizeUnit}>
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  disabled={rightSelectableCount === 0}
                  onClick={() =>
                    setRightSelected(
                      (prev: Set<string>) =>
                        new Set([
                          ...prev,
                          ...filteredRight.map((i: TransferItem) => i.key),
                        ]),
                    )
                  }
                >
                  {t('Select all (%s)', rightSelectableCount)}
                </Button>
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  disabled={rightDeselectableCount === 0}
                  onClick={() =>
                    setRightSelected((prev: Set<string>) => {
                      const next = new Set(prev);
                      filteredRight.forEach((i: TransferItem) =>
                        next.delete(i.key),
                      );
                      return next;
                    })
                  }
                >
                  {t('Clear (%s)', rightDeselectableCount)}
                </Button>
              </BulkActionsBar>
              {!targetFolderUuid ? (
                <EmptyState>
                  {t('Select a location to see its contents')}
                </EmptyState>
              ) : rightLoading && !rightItems.length ? (
                <Loading />
              ) : (
                <ScrollableList onScroll={handleRightScroll}>
                  <List
                    dataSource={filteredRight}
                    locale={{ emptyText: t('No items') }}
                    renderItem={(item: TransferItem) => (
                      <List.Item
                        key={item.key}
                        onClick={() => toggleRightSelect(item.key)}
                        css={{ cursor: 'pointer' }}
                      >
                        <Flex align="center" gap={theme.sizeUnit * 2}>
                          <Checkbox
                            css={{ paddingLeft: theme.sizeUnit * 2 }}
                            checked={rightSelected.has(item.key)}
                          />
                          <ItemIcon type={item.type} />
                          {item.name}
                        </Flex>
                      </List.Item>
                    )}
                  />
                </ScrollableList>
              )}
            </Field>
          </Panel>
        </PanelContainer>
      </ModalContent>
    </StandardModal>
  );
}
