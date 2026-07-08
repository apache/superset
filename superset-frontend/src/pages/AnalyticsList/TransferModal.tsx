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
import {
  type ReactNode,
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { SupersetClient, getNumberFormatter } from '@superset-ui/core';
import rison from 'rison';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import {
  Button,
  Checkbox,
  Constants,
  Flex,
  FormLabel,
  Input,
  List,
  Skeleton,
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
    .superset-button {
      font-family: inherit;
      font-weight: normal;
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

const StyledFormLabel = styled(FormLabel)`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 0.5}px;
    font-size: ${theme.fontSizeSM}px;
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

const smartFormatter = getNumberFormatter('SMART_NUMBER');
const formatCount = (n: number) => smartFormatter(n);

function ItemIcon({ type }: { type: ItemType }) {
  if (type === 'chart') return <Icons.LineChartOutlined iconSize="m" />;
  if (type === 'dashboard') return <Icons.LayoutOutlined iconSize="m" />;
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
  const [movedToRight, setMovedToRight] = useState<TransferItem[]>([]);
  const [movedToLeft, setMovedToLeft] = useState<TransferItem[]>([]);
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const leftSyncedSearch = useRef('');
  const rightSyncedSearch = useRef('');
  const [targetFolderUuid, setTargetFolderUuid] = useState<string | null>(null);
  const [allFolders, setAllFolders] = useState<FolderOption[]>([]);
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch left (source) first page + folder list on open
  useEffect(() => {
    if (!show) return;
    setLeftSearch('');
    setRightSearch('');
    setLeftSelected(new Set());
    setRightSelected(new Set());
    setMovedToRight([]);
    setMovedToLeft([]);
    setRightItems([]);
    setRightTotal(0);
    setRightPage(0);
    setTargetFolderUuid(null);
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
      })
      .catch(() => addDangerToast(t('Error loading folder contents')))
      .finally(() => setRightLoading(false));
  }, [show, targetFolderUuid, addDangerToast]);

  // Debounced server-side search — server data only, no merging.
  // Moved items are handled in the filtered memos below.
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => {
      setLeftLoading(true);
      fetchPage(currentFolderUuid, 0, leftSearch || undefined)
        .then(({ items, total }) => {
          leftSyncedSearch.current = leftSearch;
          setLeftItems(items);
          setLeftTotal(total);
          setLeftPage(0);
        })
        .catch(() => addDangerToast(t('Error searching items')))
        .finally(() => setLeftLoading(false));
    }, Constants.SLOW_DEBOUNCE);
    return () => clearTimeout(timer);
  }, [leftSearch, show, currentFolderUuid, addDangerToast]);

  useEffect(() => {
    if (!show || !targetFolderUuid) return;
    const timer = setTimeout(() => {
      setRightLoading(true);
      const apiUuid = targetFolderUuid === '__root__' ? null : targetFolderUuid;
      fetchPage(apiUuid, 0, rightSearch || undefined)
        .then(({ items, total }) => {
          rightSyncedSearch.current = rightSearch;
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
  const handleScroll = useCallback(
    (side: 'left' | 'right') => (e: UIEvent<HTMLDivElement>) => {
      const isLeft = side === 'left';
      const page = isLeft ? leftPage : rightPage;
      const total = isLeft ? leftTotal : rightTotal;
      const loading = isLeft ? leftLoading : rightLoading;
      const search = isLeft ? leftSearch : rightSearch;
      const setItems = isLeft ? setLeftItems : setRightItems;
      const setPage = isLeft ? setLeftPage : setRightPage;
      const setLoading = isLeft ? setLeftLoading : setRightLoading;
      const folderUuid = isLeft
        ? currentFolderUuid
        : targetFolderUuid === '__root__'
          ? null
          : targetFolderUuid;

      const el = e.currentTarget;
      const nearBottom =
        el.scrollTop > (el.scrollHeight - el.offsetHeight) * SCROLL_THRESHOLD;
      const hasMore = (page + 1) * PAGE_SIZE < total;
      if (!loading && hasMore && nearBottom) {
        const nextPage = page + 1;
        setLoading(true);
        fetchPage(folderUuid, nextPage, search || undefined)
          .then(({ items }) => {
            setItems(prev => {
              const existing = new Set(prev.map(i => i.key));
              return [...prev, ...items.filter(i => !existing.has(i.key))];
            });
            setPage(nextPage);
          })
          .catch(() => addDangerToast(t('Error loading more items')))
          .finally(() => setLoading(false));
      }
    },
    [
      leftPage,
      leftTotal,
      leftLoading,
      leftSearch,
      rightPage,
      rightTotal,
      rightLoading,
      rightSearch,
      currentFolderUuid,
      targetFolderUuid,
      addDangerToast,
    ],
  );

  const toggleSelection = useCallback((key: string, side: 'left' | 'right') => {
    const setter = side === 'left' ? setLeftSelected : setRightSelected;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectAll = useCallback(
    (filtered: TransferItem[], setter: typeof setLeftSelected) => {
      setter(prev => new Set([...prev, ...filtered.map(i => i.key)]));
    },
    [],
  );

  const deselectAll = useCallback(
    (filtered: TransferItem[], setter: typeof setLeftSelected) => {
      setter(prev => {
        const next = new Set(prev);
        filtered.forEach(i => next.delete(i.key));
        return next;
      });
    },
    [],
  );

  const moveRight = useCallback(() => {
    if (!leftSelected.size) return;
    const moving = leftItems.filter(i => leftSelected.has(i.key));
    const movingKeys = new Set(moving.map(i => i.key));
    setMovedToRight(prev => [
      ...prev.filter(i => !movingKeys.has(i.key)),
      ...moving,
    ]);
    setMovedToLeft(prev => prev.filter(i => !movingKeys.has(i.key)));
    setLeftSelected(new Set());
  }, [leftSelected, leftItems]);

  const moveLeft = useCallback(() => {
    if (!rightSelected.size) return;
    const moving = rightItems.filter(i => rightSelected.has(i.key));
    const movingKeys = new Set(moving.map(i => i.key));
    setMovedToLeft(prev => [
      ...prev.filter(i => !movingKeys.has(i.key)),
      ...moving,
    ]);
    setMovedToRight(prev => prev.filter(i => !movingKeys.has(i.key)));
    setRightSelected(new Set());
  }, [rightSelected, rightItems]);

  const hasChanges = useMemo(
    () => movedToRight.length > 0 || movedToLeft.length > 0,
    [movedToRight, movedToLeft],
  );

  const handleDone = useCallback(async () => {
    if (!targetFolderUuid) return;
    const targetApiUuid =
      targetFolderUuid === '__root__' ? null : targetFolderUuid;
    setSaving(true);
    try {
      const calls: Promise<unknown>[] = [];

      // Items moved from left → right (add to target)
      const assetsToAdd = movedToRight.filter(i => i.type !== 'folder');
      const foldersToAdd = movedToRight.filter(i => i.type === 'folder');

      if (assetsToAdd.length && targetApiUuid) {
        calls.push(
          SupersetClient.post({
            endpoint: `/api/v1/folders/${targetApiUuid}/assets`,
            jsonPayload: {
              assets: assetsToAdd.map(i => ({ type: i.type, id: i.id })),
            },
          }),
        );
      } else if (assetsToAdd.length && !targetApiUuid && currentFolderUuid) {
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

      // Items moved from right → left (return to source)
      for (const item of movedToLeft) {
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
    movedToRight,
    movedToLeft,
    addSuccessToast,
    addDangerToast,
    onSuccess,
    onHide,
  ]);

  const filteredLeft = useMemo(() => {
    const movedRightKeys = new Set(movedToRight.map(i => i.key));
    // Server items minus anything moved to the right
    let items = leftItems.filter(i => !movedRightKeys.has(i.key));
    if (targetFolderUuid) {
      const rightKeys = new Set(rightItems.map(i => i.key));
      items = items.filter(
        i =>
          !(i.type === 'folder' && i.uuid === targetFolderUuid) &&
          !rightKeys.has(i.key),
      );
    }
    // Append moved-to-left items filtered by the synced search value,
    // so they disappear at the same time as server results.
    const serverKeys = new Set(items.map(i => i.key));
    const q = leftSyncedSearch.current?.toLowerCase();
    const localMatches = movedToLeft.filter(
      i => !serverKeys.has(i.key) && (!q || i.name.toLowerCase().includes(q)),
    );
    return [...items, ...localMatches];
  }, [leftItems, movedToRight, movedToLeft, targetFolderUuid, rightItems]);

  const filteredRight = useMemo(() => {
    const movedLeftKeys = new Set(movedToLeft.map(i => i.key));
    const items = rightItems.filter(
      i =>
        !movedLeftKeys.has(i.key) &&
        !(i.type === 'folder' && i.uuid === currentFolderUuid),
    );
    // Append moved-to-right items filtered by the synced search value,
    // so they disappear at the same time as server results.
    const serverKeys = new Set(items.map(i => i.key));
    const q = rightSyncedSearch.current?.toLowerCase();
    const localMatches = movedToRight.filter(
      i => !serverKeys.has(i.key) && (!q || i.name.toLowerCase().includes(q)),
    );
    return [...items, ...localMatches];
  }, [rightItems, movedToLeft, movedToRight, currentFolderUuid]);

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
      title: ReactNode;
      children: TreeNode[];
    };
    const nodeMap = new Map<string, TreeNode>();
    for (const f of eligible) {
      nodeMap.set(f.uuid, {
        value: f.uuid,
        title: (
          <Flex align="center" gap={4}>
            <Icons.FolderOutlined iconSize="m" />
            {f.name}
          </Flex>
        ),
        children: [],
      });
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
        title: (
          <Flex align="center" gap={4}>
            <Icons.HomeOutlined iconSize="m" />
            {t('Root (Analytics)')}
          </Flex>
        ),
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
              <StyledFormLabel>{t('Source folder')}</StyledFormLabel>
              <Input
                value={currentFolderName || t('Root (Analytics)')}
                disabled
              />
            </Field>
            <Input
              placeholder={t('Search the folder')}
              value={leftSearch}
              onChange={e => setLeftSearch(e.target.value)}
              allowClear
              prefix={<Icons.SearchOutlined iconSize="l" />}
            />
            <Field>
              <BulkActionsBar gap={theme.sizeUnit}>
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  disabled={leftSelectableCount === 0}
                  onClick={() => selectAll(filteredLeft, setLeftSelected)}
                >
                  {t('Select all (%s)', formatCount(leftSelectableCount))}
                </Button>
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  disabled={leftDeselectableCount === 0}
                  onClick={() => deselectAll(filteredLeft, setLeftSelected)}
                >
                  {t('Deselect all (%s)', formatCount(leftDeselectableCount))}
                </Button>
                <PanelCount css={{ marginLeft: 'auto' }}>
                  {leftSelected.size > 0
                    ? t(
                        '%s/%s items selected',
                        formatCount(leftSelected.size),
                        formatCount(leftTotal),
                      )
                    : t('0 items selected')}
                </PanelCount>
              </BulkActionsBar>
              {leftLoading && !leftItems.length ? (
                <Skeleton active />
              ) : (
                <ScrollableList onScroll={handleScroll('left')}>
                  <List
                    dataSource={filteredLeft}
                    locale={{ emptyText: t('No items') }}
                    renderItem={(item: TransferItem) => (
                      <List.Item
                        key={item.key}
                        onClick={() => toggleSelection(item.key, 'left')}
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
              <StyledFormLabel>{t('Destination folder')}</StyledFormLabel>
              <TreeSelect
                aria-label={t('Target folder')}
                placeholder={t('Select a location…')}
                suffixIcon={<Icons.DownOutlined iconSize="m" />}
                treeIcon
                treeData={folderTreeData}
                value={targetFolderUuid}
                onChange={(val: string) => setTargetFolderUuid(val)}
                allowClear
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
            <Input
              placeholder={t('Search the folder')}
              value={rightSearch}
              onChange={e => setRightSearch(e.target.value)}
              allowClear
              prefix={<Icons.SearchOutlined iconSize="l" />}
            />
            <Field>
              <BulkActionsBar gap={theme.sizeUnit}>
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  disabled={rightSelectableCount === 0}
                  onClick={() => selectAll(filteredRight, setRightSelected)}
                >
                  {t('Select all (%s)', formatCount(rightSelectableCount))}
                </Button>
                <Button
                  buttonStyle="link"
                  buttonSize="xsmall"
                  disabled={rightDeselectableCount === 0}
                  onClick={() => deselectAll(filteredRight, setRightSelected)}
                >
                  {t('Deselect all (%s)', formatCount(rightDeselectableCount))}
                </Button>
                <PanelCount css={{ marginLeft: 'auto' }}>
                  {rightSelected.size > 0
                    ? t(
                        '%s/%s items selected',
                        formatCount(rightSelected.size),
                        formatCount(rightTotal),
                      )
                    : t('0 items selected')}
                </PanelCount>
              </BulkActionsBar>
              {!targetFolderUuid ? (
                <EmptyState>
                  {t('Select a location to see its contents')}
                </EmptyState>
              ) : rightLoading && !rightItems.length ? (
                <Skeleton active />
              ) : (
                <ScrollableList onScroll={handleScroll('right')}>
                  <List
                    dataSource={filteredRight}
                    locale={{ emptyText: t('No items') }}
                    renderItem={(item: TransferItem) => (
                      <List.Item
                        key={item.key}
                        onClick={() => toggleSelection(item.key, 'right')}
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
