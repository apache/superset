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
import { useSelector } from 'react-redux';
import {
  isFeatureEnabled,
  FeatureFlag,
  getChartMetadataRegistry,
  SupersetClient,
} from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
// eslint-disable-next-line no-restricted-imports -- icons not yet in AntdEnhanced on 6.0-release
import {
  MinusSquareOutlined,
  PlusSquareOutlined,
  PushpinOutlined,
} from '@ant-design/icons';
import rison from 'rison';
import { useHistory, useParams } from 'react-router-dom';
import type { CellProps } from 'react-table';
import {
  FacePile,
  ListView,
  ListViewFilterOperator as FilterOperator,
  ModifiedInfo,
  TagType,
  TagsList,
  type ListViewFilters,
} from 'src/components';
import { TagTypeEnum } from 'src/components/Tag/TagType';
import { loadTags } from 'src/components/Tag/utils';
import {
  Button,
  ConfirmStatusChange,
  Dropdown,
  Flex,
  Tooltip,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  FolderBreadcrumb,
  type FolderBreadcrumbItem,
} from '@superset-ui/core/components/Folders';
import SubMenu, { type SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  createErrorHandler,
  createFetchRelated,
  handleChartDelete,
  handleDashboardDelete,
} from 'src/views/CRUD/utils';
import { nativeFilterGate } from 'src/dashboard/components/nativeFilters/utils';
import handleResourceExport from 'src/utils/export';
import ChartPropertiesModal from 'src/explore/components/PropertiesModal';
import DashboardPropertiesModal from 'src/dashboard/components/PropertiesModal';
import { type Slice } from 'src/types/Chart';
import CreateFolderModal from './CreateFolderModal';
import TransferModal from './TransferModal';
import FolderPermissionsModal from './FolderPermissionsModal';
import RenameFolderModal from './RenameFolderModal';
import DeleteFolderModal from './DeleteFolderModal';
import DashboardCharts from './DashboardCharts';
import type { ContentItem } from './types';

/** A location in the drill path; the root has a null uuid. */
interface Crumb {
  uuid: string | null;
  name: string;
  user_permission?: 'editor' | 'viewer' | null;
}

interface SortColumn {
  id: string;
  desc?: boolean;
}

interface FetchConfig {
  pageIndex: number;
  pageSize: number;
  sortBy: SortColumn[];
  filters: { id: string; operator?: string; value?: unknown }[];
}

const PAGE_SIZE = 25;
const FOLDER_TYPE = 'analytics';

const Actions = styled.div`
  ${({ theme }) => `
    color: ${theme.colorIcon};
    display: flex;
    gap: ${theme.sizeUnit * 2}px;

    .action-button {
      cursor: pointer;
      &:hover {
        color: ${theme.colorPrimary};
      }
    }
  `}
`;

const NameLink = styled.a`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    cursor: pointer;
  `}
`;

const NameRow = styled.span`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
  `}
`;

// Expand/collapse caret rendered immediately after a dashboard's title.
const CaretButton = styled.button`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    margin: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: ${theme.colorIcon};
    cursor: pointer;
    &:hover {
      color: ${theme.colorPrimary};
    }
  `}
`;

const BreadcrumbWrap = styled.div`
  padding: 0;
`;

const chartRegistry = getChartMetadataRegistry();

const createFetchDatasets = async (
  filterValue = '',
  page: number,
  pageSize: number,
) => {
  const filters = filterValue
    ? { filters: [{ col: 'table_name', opr: 'sw', value: filterValue }] }
    : {};
  const queryParams = rison.encode({
    columns: ['table_name', 'id'],
    keys: ['none'],
    order_column: 'table_name',
    order_direction: 'asc',
    page,
    page_size: pageSize,
    ...filters,
  });
  const { json = {} } = await SupersetClient.get({
    endpoint: `/api/v1/dataset/?q=${queryParams}`,
  });
  return {
    data: (json?.result ?? []).map(
      ({ table_name: tableName, id }: { table_name: string; id: number }) => ({
        label: tableName,
        value: id,
      }),
    ),
    totalCount: json?.count ?? 0,
  };
};

function AnalyticsList({
  addDangerToast,
  addSuccessToast,
}: {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}) {
  const history = useHistory();
  const { folderUuid } = useParams<{ folderUuid?: string }>();
  const theme = useTheme();
  const currentUserId = useSelector<any, number>(state => state.user?.userId);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [count, setCount] = useState(0);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>(() => [
    { uuid: null, name: t('Analytics') },
  ]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // Charts per expanded dashboard, owned here so they survive antd remounting
  // the expanded-row subtree (which would otherwise re-flash the loader).
  const [chartsByDashboard, setChartsByDashboard] = useState<
    Record<number, { loading: boolean; charts: ContentItem[] }>
  >({});
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderToManagePerms, setFolderToManagePerms] =
    useState<ContentItem | null>(null);
  const [folderToRename, setFolderToRename] = useState<ContentItem | null>(
    null,
  );
  const [editChart, setEditChart] = useState<Slice | null>(null);
  const [editDashboard, setEditDashboard] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [bulkSelectEnabled, setBulkSelectEnabled] = useState(false);
  const [moveTarget, setMoveTarget] = useState<ContentItem | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  // Queue of folders awaiting the DeleteFolderModal — used for both single-
  // and bulk-delete flows. The modal shows for queue[0] and pops on close.
  const [folderDeleteQueue, setFolderDeleteQueue] = useState<ContentItem[]>([]);
  // Batch-delete result deferred until the folder modal queue is empty, so
  // toasts appear only after the user has finished handling all folder prompts.
  const [pendingBatchResult, setPendingBatchResult] = useState<{
    succeeded: number;
    failed: number;
  } | null>(null);

  // --- Pinning state ---
  const [pins, setPins] = useState<
    Array<{
      id: number;
      object_id: number;
      object_type: string;
      position: number;
    }>
  >([]);
  const pinnedKeys = useMemo(
    () => new Set(pins.map(p => `${p.object_type}-${p.object_id}`)),
    [pins],
  );
  const isPinned = useCallback(
    (item: ContentItem) => pinnedKeys.has(`${item.type}-${item.id}`),
    [pinnedKeys],
  );
  const fetchPins = useCallback(async () => {
    try {
      const { json } = await SupersetClient.get({
        endpoint: '/api/v1/folders/pins',
      });
      setPins(json.result || []);
    } catch {
      // silently fail — pins are non-critical
    }
  }, []);

  // Clear stale items when navigating to a different folder
  useEffect(() => {
    setItems([]);
    setCount(0);
  }, [folderUuid]);

  // Fetch pins only at root level (pins are root-only)
  useEffect(() => {
    if (!folderUuid) fetchPins();
  }, [fetchPins, refreshKey, folderUuid]);

  const refreshData = useCallback(() => setRefreshKey(key => key + 1), []);

  const pinItem = useCallback(
    async (item: ContentItem) => {
      if (pinnedKeys.size >= 3) {
        addDangerToast(t('Maximum 3 pins allowed'));
        return;
      }
      const usedPositions = new Set(pins.map(p => p.position));
      const nextPosition = [1, 2, 3].find(p => !usedPositions.has(p)) ?? 1;
      try {
        await SupersetClient.post({
          endpoint: '/api/v1/folders/pins',
          jsonPayload: {
            object_id: item.id,
            object_type: item.type,
            position: nextPosition,
          },
        });
        addSuccessToast(t('Pinned: %s', item.name));
        fetchPins();
        refreshData();
      } catch {
        addDangerToast(t('Error pinning item'));
      }
    },
    [
      pinnedKeys.size,
      pins,
      addSuccessToast,
      addDangerToast,
      fetchPins,
      refreshData,
    ],
  );

  const unpinItem = useCallback(
    async (item: ContentItem) => {
      const pin = pins.find(
        p => p.object_type === item.type && p.object_id === item.id,
      );
      if (!pin) return;
      try {
        await SupersetClient.delete({
          endpoint: `/api/v1/folders/pins/${pin.id}`,
        });
        addSuccessToast(t('Unpinned: %s', item.name));
        fetchPins();
        refreshData();
      } catch {
        addDangerToast(t('Error unpinning item'));
      }
    },
    [pins, addSuccessToast, addDangerToast, fetchPins, refreshData],
  );

  const currentFolder = breadcrumb[breadcrumb.length - 1];
  const isAtRoot = currentFolder.uuid === null;
  const canEditCurrentFolder =
    isAtRoot || currentFolder.user_permission === 'editor';
  // True while the breadcrumb effect is still resolving the URL folder UUID.
  // Prevents ListView from firing a fetch against the root endpoint on reload.
  const breadcrumbLoading = !!folderUuid && isAtRoot;

  const fetchData = useCallback(
    async ({ pageIndex, pageSize, sortBy, filters }: FetchConfig) => {
      setLoading(true);
      setExpandedKeys([]);
      setChartsByDashboard({});

      // Track the name filter for search highlighting
      const nameFilter = filters.find(f => f.id === 'name');
      setSearchQuery(
        nameFilter?.value
          ? String(
              typeof nameFilter.value === 'object' &&
                nameFilter.value !== null &&
                'value' in nameFilter.value
                ? (nameFilter.value as { value: unknown }).value
                : nameFilter.value,
            )
          : '',
      );

      // Build rison-encoded filters matching the standard {col, opr, value} format
      const filterExps: Array<{ col: string; opr: string; value: unknown }> =
        [];
      filters.forEach(({ id, operator, value }) => {
        if (value === undefined || value === null || value === '') return;
        const scalar =
          typeof value === 'object' &&
          !Array.isArray(value) &&
          value !== null &&
          'value' in value
            ? (value as { value: unknown }).value
            : value;
        switch (id) {
          case 'name':
            filterExps.push({ col: 'name', opr: 'ct', value: scalar });
            break;
          case 'type':
            filterExps.push({ col: 'type', opr: 'in', value: scalar });
            break;
          case 'owners':
            filterExps.push({ col: 'owners', opr: 'rel_m_m', value: scalar });
            break;
          case 'changed_on':
            if (operator === 'gt')
              filterExps.push({ col: 'changed_on', opr: 'gt', value: scalar });
            else if (operator === 'lt')
              filterExps.push({ col: 'changed_on', opr: 'lt', value: scalar });
            break;
          case 'viz_type':
            filterExps.push({ col: 'viz_type', opr: 'in', value: scalar });
            break;
          case 'datasource':
            filterExps.push({ col: 'dataset', opr: 'in', value: scalar });
            break;
          case 'tags':
            filterExps.push({ col: 'tags', opr: 'rel_m_m', value: scalar });
            break;
          default:
            break;
        }
      });

      const queryParams = rison.encode_uri({
        order_column: sortBy[0]?.id ?? 'changed_on',
        order_direction: sortBy[0]?.desc === false ? 'asc' : 'desc',
        page: pageIndex,
        page_size: pageSize,
        ...(filterExps.length ? { filters: filterExps } : {}),
      });

      const base = currentFolder.uuid
        ? `/api/v1/folders/${currentFolder.uuid}/assets`
        : `/api/v1/folders/assets?folder_type=${FOLDER_TYPE}&`;
      const separator = base.includes('?') ? '' : '?';
      try {
        const { json } = await SupersetClient.get({
          endpoint: `${base}${separator}q=${queryParams}`,
        });
        setItems((json.result as ContentItem[]) || []);
        setCount((json.count as number) || 0);
      } catch {
        addDangerToast(t('Error fetching folder contents'));
      } finally {
        setLoading(false);
      }
    },
    [currentFolder.uuid, addDangerToast],
  );

  // Sync URL → breadcrumb on mount, back/forward, or direct link
  useEffect(() => {
    const currentUuid = breadcrumb[breadcrumb.length - 1]?.uuid ?? undefined;
    if ((folderUuid ?? undefined) === (currentUuid ?? undefined)) return;

    if (!folderUuid) {
      setBreadcrumb([{ uuid: null, name: t('Analytics') }]);
      return;
    }

    let cancelled = false;
    (async () => {
      const crumbs: Crumb[] = [];
      let uuid: string | null = folderUuid;
      try {
        while (uuid) {
          const response = await SupersetClient.get({
            endpoint: `/api/v1/folders/${uuid}`,
          });
          const folder = response.json.result as {
            uuid: string;
            name: string;
            parent_uuid: string | null;
            user_permission?: 'editor' | 'viewer' | null;
          };
          crumbs.unshift({
            uuid: folder.uuid,
            name: folder.name,
            user_permission: folder.user_permission,
          });
          uuid = folder.parent_uuid;
        }
        crumbs.unshift({ uuid: null, name: t('Analytics') });
        if (!cancelled) setBreadcrumb(crumbs);
      } catch {
        if (!cancelled) {
          addDangerToast(t('Folder not found'));
          history.replace('/analytics/');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folderUuid]); // eslint-disable-line react-hooks/exhaustive-deps

  const drillInto = useCallback(
    (item: ContentItem) => {
      setExpandedKeys([]);
      history.push(`/analytics/${item.uuid}/`);
    },
    [history],
  );

  const navigateToCrumb = useCallback(
    (index: number) => {
      setExpandedKeys([]);
      setBreadcrumb(prev => {
        const sliced = prev.slice(0, index + 1);
        const target = sliced[sliced.length - 1];
        history.push(
          target.uuid ? `/analytics/${target.uuid}/` : '/analytics/',
        );
        return sliced;
      });
    },
    [history],
  );

  const toggleExpand = useCallback((rowId: string) => {
    setExpandedKeys(prev =>
      prev.includes(rowId)
        ? prev.filter(key => key !== rowId)
        : [...prev, rowId],
    );
  }, []);

  // Lazily load a dashboard's charts, deduped via the functional updater so
  // repeated remounts of DashboardCharts don't refetch an already-loaded entry.
  const requestDashboardCharts = useCallback(
    (dashboardId: number) => {
      setChartsByDashboard(prev => {
        if (prev[dashboardId]) return prev;
        (async () => {
          try {
            const { json } = await SupersetClient.get({
              endpoint: `/api/v1/folders/dashboard-charts/${dashboardId}`,
            });
            const charts = (json.result as ContentItem[]) || [];
            setChartsByDashboard(curr => ({
              ...curr,
              [dashboardId]: { loading: false, charts },
            }));
          } catch {
            addDangerToast(t('Error loading dashboard charts'));
            setChartsByDashboard(curr => ({
              ...curr,
              [dashboardId]: { loading: false, charts: [] },
            }));
          }
        })();
        return { ...prev, [dashboardId]: { loading: true, charts: [] } };
      });
    },
    [addDangerToast],
  );

  // Mirror ChartList: PropertiesModal fetches the chart itself by `slice_id`,
  // so it only needs a minimal slice built from the row (no pre-fetch).
  const openChartEdit = useCallback(
    (item: ContentItem) =>
      setEditChart({ slice_id: item.id, slice_name: item.name } as Slice),
    [],
  );

  const exportAsset = useCallback((item: ContentItem) => {
    handleResourceExport(
      item.type === 'chart' ? 'chart' : 'dashboard',
      [item.id],
      () => {},
    );
  }, []);

  const deleteAsset = useCallback(
    (item: ContentItem) => {
      if (item.type === 'chart') {
        handleChartDelete(
          { id: item.id, slice_name: item.name } as Parameters<
            typeof handleChartDelete
          >[0],
          addSuccessToast,
          addDangerToast,
          refreshData,
        );
      } else {
        handleDashboardDelete(
          { id: item.id, dashboard_title: item.name } as Parameters<
            typeof handleDashboardDelete
          >[0],
          refreshData,
          addSuccessToast,
          addDangerToast,
        );
      }
    },
    [addSuccessToast, addDangerToast, refreshData],
  );

  // Show deferred batch-delete toasts once the folder modal queue drains.
  useEffect(() => {
    if (!pendingBatchResult || folderDeleteQueue.length > 0) return;
    const { succeeded, failed } = pendingBatchResult;
    if (failed === 0) {
      addSuccessToast(t('Successfully deleted selected items'));
    } else if (succeeded > 0) {
      addSuccessToast(t('Some items were deleted successfully'));
      addDangerToast(t('Some items could not be deleted'));
    } else {
      addDangerToast(t('There was an issue deleting the selected items'));
    }
    setPendingBatchResult(null);
  }, [folderDeleteQueue.length, pendingBatchResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBulkDelete = useCallback(
    async (rows: ContentItem[]) => {
      const charts = rows.filter(r => r.type === 'chart').map(r => r.id);
      const dashboards = rows
        .filter(r => r.type === 'dashboard')
        .map(r => r.id);
      const emptyFolders = rows.filter(
        r =>
          r.type === 'folder' &&
          (r.asset_count ?? 0) === 0 &&
          (r.children_count ?? 0) === 0,
      );
      const nonEmptyFolders = rows.filter(
        r =>
          r.type === 'folder' &&
          ((r.asset_count ?? 0) > 0 || (r.children_count ?? 0) > 0),
      );

      const calls: Promise<unknown>[] = [];
      if (charts.length) {
        calls.push(
          SupersetClient.delete({
            endpoint: `/api/v1/chart/?q=${rison.encode(charts)}`,
          }),
        );
      }
      if (dashboards.length) {
        calls.push(
          SupersetClient.delete({
            endpoint: `/api/v1/dashboard/?q=${rison.encode(dashboards)}`,
          }),
        );
      }
      emptyFolders.forEach(f =>
        calls.push(
          SupersetClient.delete({ endpoint: `/api/v1/folders/${f.uuid}` }),
        ),
      );

      if (calls.length) {
        const results = await Promise.allSettled(calls);
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        if (succeeded > 0) refreshData();
        if (nonEmptyFolders.length > 0) {
          // Defer toasts until after all folder modals have been handled.
          setPendingBatchResult({ succeeded, failed });
        } else if (failed === 0) {
          addSuccessToast(t('Successfully deleted selected items'));
        } else if (succeeded > 0) {
          addSuccessToast(t('Some items were deleted successfully'));
          addDangerToast(t('Some items could not be deleted'));
        } else {
          addDangerToast(t('There was an issue deleting the selected items'));
        }
      }

      // Non-empty folders need individual confirmation via DeleteFolderModal.
      if (nonEmptyFolders.length > 0) {
        setFolderDeleteQueue(nonEmptyFolders);
      }
    },
    [addSuccessToast, addDangerToast, refreshData],
  );

  const handleBulkExport = useCallback((rows: ContentItem[]) => {
    const charts = rows.filter(r => r.type === 'chart').map(r => r.id);
    const dashboards = rows.filter(r => r.type === 'dashboard').map(r => r.id);
    if (charts.length) handleResourceExport('chart', charts, () => {});
    if (dashboards.length)
      handleResourceExport('dashboard', dashboards, () => {});
  }, []);

  const highlightName = useCallback(
    (name: string) => {
      if (!searchQuery) return name;
      const idx = name.toLowerCase().indexOf(searchQuery.toLowerCase());
      if (idx === -1) return name;
      return (
        <span>
          {name.slice(0, idx)}
          <mark css={{ background: theme.colorPrimaryBg, padding: 0 }}>
            {name.slice(idx, idx + searchQuery.length)}
          </mark>
          {name.slice(idx + searchQuery.length)}
        </span>
      );
    },
    [searchQuery, theme.colorPrimaryBg],
  );

  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        id: 'name',
        Cell: ({ row: { original, id } }: CellProps<ContentItem>) => {
          if (!original.type) {
            return null;
          }
          const pinIcon =
            isAtRoot && isPinned(original) ? (
              <PushpinOutlined
                style={{ fontSize: 12, color: theme.colorPrimary }}
              />
            ) : null;

          const contextMenuItems: Array<{
            key: string;
            label: string;
            disabled?: boolean;
            onClick: () => void;
          }> = [];

          if (isAtRoot) {
            if (isPinned(original)) {
              contextMenuItems.push({
                key: 'unpin',
                label: t('Unpin'),
                onClick: () => unpinItem(original),
              });
            } else {
              contextMenuItems.push({
                key: 'pin',
                label:
                  pinnedKeys.size >= 3 ? t('Pin (max 3 reached)') : t('Pin'),
                disabled: pinnedKeys.size >= 3,
                onClick: () => pinItem(original),
              });
            }
          }
          if (canEditCurrentFolder) {
            contextMenuItems.push({
              key: 'move',
              label: t('Move to…'),
              onClick: () => setMoveTarget(original),
            });
          }

          const nameContent = (() => {
            if (original.type === 'folder') {
              return (
                <NameLink
                  role="button"
                  tabIndex={0}
                  onClick={() => drillInto(original)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') drillInto(original);
                  }}
                >
                  <Icons.FolderOutlined
                    iconSize="m"
                    css={{
                      color: theme.colorSuccess,
                    }}
                  />
                  {highlightName(original.name)}
                  {pinIcon}
                </NameLink>
              );
            }
            if (original.type === 'dashboard') {
              const expanded = expandedKeys.includes(id);
              return (
                <NameRow>
                  <Icons.LayoutOutlined
                    iconSize="m"
                    css={{ color: theme.colorWarning }}
                  />
                  {original.url ? (
                    <NameLink href={original.url}>
                      {highlightName(original.name)}
                    </NameLink>
                  ) : (
                    highlightName(original.name)
                  )}
                  {pinIcon}
                  <CaretButton
                    type="button"
                    aria-label={expanded ? t('Collapse') : t('Expand')}
                    onClick={() => toggleExpand(id)}
                  >
                    {expanded ? (
                      <MinusSquareOutlined style={{ fontSize: 12 }} />
                    ) : (
                      <PlusSquareOutlined style={{ fontSize: 12 }} />
                    )}
                  </CaretButton>
                </NameRow>
              );
            }
            return original.url ? (
              <NameLink href={original.url}>
                <Icons.LineChartOutlined
                  iconSize="m"
                  css={{ color: theme.colorErrorBorderHover }}
                />
                {highlightName(original.name)}
                {pinIcon}
              </NameLink>
            ) : (
              <NameRow>
                <Icons.LineChartOutlined
                  iconSize="m"
                  css={{ color: theme.colorErrorBorderHover }}
                />
                {highlightName(original.name)}
                {pinIcon}
              </NameRow>
            );
          })();

          return (
            <Dropdown
              trigger={['contextMenu']}
              menu={{ items: contextMenuItems }}
            >
              <span>
                {nameContent}
                {original.folder_path && (
                  <Flex
                    align="center"
                    gap={theme.sizeUnit * 0.5}
                    css={{
                      fontSize: theme.fontSizeXS,
                      color: theme.colorTextSecondary,
                      marginTop: theme.sizeUnit,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    <Icons.HomeOutlined iconSize="s" />
                    {t('Analytics')}
                    {original.folder_path.map(p => (
                      <Flex
                        key={p.uuid}
                        align="center"
                        gap={theme.sizeUnit * 0.5}
                      >
                        <span css={{ margin: `0 ${theme.sizeUnit * 0.5}px` }}>
                          /
                        </span>
                        <Icons.FolderOutlined iconSize="s" />
                        {p.name}
                      </Flex>
                    ))}
                  </Flex>
                )}
              </span>
            </Dropdown>
          );
        },
      },
      {
        accessor: 'type',
        Header: t('Type'),
        id: 'type',
        size: 'sm',
        Cell: ({ row: { original } }: CellProps<ContentItem>) =>
          original.type
            ? original.type.charAt(0).toUpperCase() + original.type.slice(1)
            : '',
      },
      {
        accessor: 'viz_type',
        Header: t('Visualization type'),
        id: 'viz_type',
        disableSortBy: true,
        Cell: ({ row: { original } }: CellProps<ContentItem>) =>
          original.viz_type
            ? (chartRegistry.get(original.viz_type)?.name ?? original.viz_type)
            : null,
      },
      {
        accessor: 'datasource_name',
        Header: t('Dataset'),
        id: 'datasource',
        disableSortBy: false,
        Cell: ({ row: { original } }: CellProps<ContentItem>) => {
          if (!original.datasource_name) return null;
          if (original.datasource_url) {
            return (
              <a href={original.datasource_url}>{original.datasource_name}</a>
            );
          }
          return original.datasource_name;
        },
      },
      {
        accessor: 'tags',
        Header: t('Tags'),
        id: 'tags',
        disableSortBy: true,
        hidden: !isFeatureEnabled(FeatureFlag.TaggingSystem),
        Cell: ({ row: { original } }: CellProps<ContentItem>) => {
          if (!original.tags?.length) return null;
          return (
            <TagsList
              tags={original.tags.filter(
                (tag: TagType) =>
                  tag.type === 'TagTypes.custom' ||
                  tag.type === TagTypeEnum.Custom,
              )}
              maxTags={3}
            />
          );
        },
      },
      {
        accessor: 'owners',
        Header: t('Owners'),
        id: 'owners',
        disableSortBy: true,
        Cell: ({ row: { original } }: CellProps<ContentItem>) => (
          <FacePile users={original.owners || []} />
        ),
      },
      {
        accessor: 'changed_on',
        Header: t('Last modified'),
        id: 'changed_on',
        Cell: ({ row: { original } }: CellProps<ContentItem>) =>
          original.changed_on_humanized ? (
            <ModifiedInfo
              date={original.changed_on_humanized}
              user={original.changed_by ?? undefined}
            />
          ) : (
            '-'
          ),
      },
      {
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        Cell: ({ row: { original } }: CellProps<ContentItem>) => {
          if (!original.type) {
            return null;
          }
          if (original.type === 'folder') {
            const canEdit = original.user_permission === 'editor';
            return (
              <Actions className="actions">
                {canEdit && (
                  <Tooltip title={t('Manage permissions')} placement="bottom">
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={() => setFolderToManagePerms(original)}
                    >
                      <Icons.ShareAltOutlined iconSize="l" />
                    </span>
                  </Tooltip>
                )}
                {canEdit && (
                  <Tooltip title={t('Rename folder')} placement="bottom">
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={() => setFolderToRename(original)}
                    >
                      <Icons.EditOutlined iconSize="l" />
                    </span>
                  </Tooltip>
                )}
                {canEdit &&
                  original.parent_uuid &&
                  original.inherits_permissions === false && (
                    <Tooltip
                      title={t('Sync permissions with parent')}
                      placement="bottom"
                    >
                      <Icons.SyncOutlined
                        iconSize="l"
                        className="action-button"
                        onClick={async () => {
                          try {
                            await SupersetClient.put({
                              endpoint: `/api/v1/folders/${original.uuid}`,
                              jsonPayload: { sync_permissions: true },
                            });
                            addSuccessToast(
                              t('Permissions synced with parent'),
                            );
                            refreshData();
                          } catch {
                            addDangerToast(t('Error syncing permissions'));
                          }
                        }}
                      />
                    </Tooltip>
                  )}
                {canEdit && (
                  <Tooltip title={t('Delete folder')} placement="bottom">
                    <span
                      role="button"
                      tabIndex={0}
                      className="action-button"
                      onClick={() => setFolderDeleteQueue([original])}
                    >
                      <Icons.DeleteOutlined iconSize="l" />
                    </span>
                  </Tooltip>
                )}
              </Actions>
            );
          }
          // chart / dashboard rows: mirror the CRUD lists' row actions.
          return (
            <Actions className="actions">
              {canEditCurrentFolder && (
                <Tooltip title={t('Edit')} placement="bottom">
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={() =>
                      original.type === 'chart'
                        ? openChartEdit(original)
                        : setEditDashboard({
                            id: original.id,
                            title: original.name,
                          })
                    }
                  >
                    <Icons.EditOutlined iconSize="l" />
                  </span>
                </Tooltip>
              )}
              <Tooltip title={t('Export')} placement="bottom">
                <span
                  role="button"
                  tabIndex={0}
                  className="action-button"
                  onClick={() => exportAsset(original)}
                >
                  <Icons.UploadOutlined iconSize="l" />
                </span>
              </Tooltip>
              {canEditCurrentFolder && (
                <ConfirmStatusChange
                  title={t('Please confirm')}
                  description={t(
                    'Are you sure you want to delete %s?',
                    original.name,
                  )}
                  onConfirm={() => deleteAsset(original)}
                >
                  {confirmDelete => (
                    <Tooltip title={t('Delete')} placement="bottom">
                      <span
                        role="button"
                        tabIndex={0}
                        className="action-button"
                        onClick={confirmDelete}
                      >
                        <Icons.DeleteOutlined iconSize="l" />
                      </span>
                    </Tooltip>
                  )}
                </ConfirmStatusChange>
              )}
            </Actions>
          );
        },
      },
    ],
    [
      drillInto,
      expandedKeys,
      toggleExpand,
      openChartEdit,
      exportAsset,
      deleteAsset,
      isPinned,
      isAtRoot,
      canEditCurrentFolder,
      pinnedKeys.size,
      pinItem,
      unpinItem,
      highlightName,
      theme,
    ],
  );

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Search'),
        key: 'search',
        id: 'name',
        input: 'search',
        operator: FilterOperator.Contains,
      },
      {
        Header: t('Type'),
        key: 'type',
        id: 'type',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('All'),
        selects: [
          { label: t('Folder'), value: 'folder' },
          { label: t('Chart'), value: 'chart' },
          { label: t('Dashboard'), value: 'dashboard' },
        ],
      },
      {
        Header: t('Owner'),
        key: 'owners',
        id: 'owners',
        input: 'select',
        operator: FilterOperator.RelationManyMany,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchRelated(
          'chart',
          'owners',
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching owners: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Last modified'),
        key: 'changed_on',
        id: 'changed_on',
        input: 'datetime_range',
        operator: FilterOperator.Between,
        dateFilterValueType: 'iso',
      },
      {
        Header: t('Visualization type'),
        key: 'viz_type',
        id: 'viz_type',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('All'),
        selects: chartRegistry
          .keys()
          .filter(k => nativeFilterGate(chartRegistry.get(k)?.behaviors ?? []))
          .map(k => ({ label: chartRegistry.get(k)?.name ?? k, value: k }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      },
      {
        Header: t('Dataset'),
        key: 'datasource',
        id: 'datasource',
        input: 'select',
        operator: FilterOperator.Equals,
        unfilteredLabel: t('All'),
        fetchSelects: createFetchDatasets,
        paginate: true,
      },
      ...(isFeatureEnabled(FeatureFlag.TaggingSystem)
        ? [
            {
              Header: t('Tag'),
              key: 'tags',
              id: 'tags',
              input: 'select' as const,
              operator: FilterOperator.RelationManyMany,
              unfilteredLabel: t('All'),
              fetchSelects: loadTags,
            },
          ]
        : []),
    ],
    [addDangerToast],
  );

  // Pinned-on-top sorting is handled by the backend
  const sortedItems = items;

  const expandable = useMemo(
    () => ({
      // Expansion is driven by the caret in the Name cell, so hide antd's
      // default expand column and control the open rows ourselves.
      showExpandColumn: false,
      expandedRowKeys: expandedKeys,
      onExpandedRowsChange: (keys: readonly (string | number | bigint)[]) =>
        setExpandedKeys(keys.map(String)),
      rowExpandable: (record: Record<string, unknown>) =>
        record.type === 'dashboard',
      expandedRowRender: (record: Record<string, unknown>) => {
        const dashboardId = record.id as number;
        const entry = chartsByDashboard[dashboardId];
        return (
          <DashboardCharts
            dashboardId={dashboardId}
            charts={entry?.charts ?? []}
            loading={entry?.loading ?? true}
            onRequest={requestDashboardCharts}
          />
        );
      },
    }),
    [chartsByDashboard, requestDashboardCharts, expandedKeys],
  );

  const breadcrumbItems: FolderBreadcrumbItem[] = useMemo(
    () =>
      breadcrumb.map((crumb, index) => ({
        key: crumb.uuid ?? 'root',
        title:
          index === 0 ? (
            <Flex align="center" gap={4}>
              <Icons.HomeOutlined iconSize="m" />
              {crumb.name}
            </Flex>
          ) : (
            crumb.name
          ),
        hideIcon: index === 0,
        onClick: () => navigateToCrumb(index),
      })),
    [breadcrumb, navigateToCrumb],
  );

  const menuData: SubMenuProps = {
    name: t('Analytics'),
    buttons: [
      {
        name: bulkSelectEnabled ? t('Cancel') : t('Bulk select'),
        buttonStyle: 'secondary',
        onClick: () => setBulkSelectEnabled(prev => !prev),
      },
      {
        name: t('Move assets'),
        buttonStyle: 'secondary',
        onClick: () => setShowTransferModal(true),
      },
      {
        name: t('New'),
        buttonStyle: 'primary',
        component: (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'chart',
                  icon: <Icons.LineChartOutlined />,
                  label: t('Chart'),
                  onClick: () => history.push('/chart/add'),
                },
                {
                  key: 'dashboard',
                  icon: <Icons.LayoutOutlined />,
                  label: t('Dashboard'),
                  onClick: () => window.location.assign('/dashboard/new'),
                },
                {
                  key: 'folder',
                  icon: <Icons.FolderOutlined />,
                  label: t('Folder'),
                  onClick: () => setShowCreateFolder(true),
                },
              ],
            }}
          >
            <Button
              buttonStyle="primary"
              css={{ marginLeft: theme.sizeUnit * 2 }}
            >
              <Icons.PlusOutlined iconSize="m" /> {t('New')}{' '}
              <Icons.DownOutlined iconSize="m" />
            </Button>
          </Dropdown>
        ),
      } as any,
    ],
  };

  // Persistent hover-like highlight on expanded dashboard rows via dynamic CSS,
  // since antd Table doesn't support styling the parent row of an expanded section.
  const expandedRowStyle = useMemo(() => {
    if (!expandedKeys.length) return null;
    const selectors = expandedKeys
      .map(key => `.ant-table-row[data-row-key="${key}"] > td`)
      .join(', ');
    return (
      <style>{`${selectors} { background: ${theme.controlItemBgHover} !important; }`}</style>
    );
  }, [expandedKeys, theme.controlItemBgHover]);

  return (
    <>
      {expandedRowStyle}
      {showCreateFolder && (
        <CreateFolderModal
          show
          parentFolderUuid={currentFolder.uuid}
          onHide={() => setShowCreateFolder(false)}
          onSuccess={refreshData}
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
        />
      )}
      {folderToRename && (
        <RenameFolderModal
          folderUuid={folderToRename.uuid ?? ''}
          currentName={folderToRename.name}
          show
          onHide={() => setFolderToRename(null)}
          onSuccess={refreshData}
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
        />
      )}
      {folderToManagePerms && (
        <FolderPermissionsModal
          folderUuid={folderToManagePerms.uuid ?? ''}
          folderName={folderToManagePerms.name}
          currentUserId={currentUserId}
          isSubfolder={!!folderToManagePerms.parent_uuid}
          show
          onHide={() => {
            setFolderToManagePerms(null);
            refreshData();
          }}
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
        />
      )}
      {(moveTarget || showTransferModal) && (
        <TransferModal
          currentFolderUuid={currentFolder.uuid}
          currentFolderName={currentFolder.name}
          preSelectedKeys={
            moveTarget ? [`${moveTarget.type}-${moveTarget.id}`] : []
          }
          show
          onHide={() => {
            setMoveTarget(null);
            setShowTransferModal(false);
          }}
          onSuccess={refreshData}
        />
      )}
      {editChart && (
        <ChartPropertiesModal
          slice={editChart}
          show
          onHide={() => setEditChart(null)}
          onSave={() => {
            setEditChart(null);
            refreshData();
          }}
        />
      )}
      {folderDeleteQueue.length > 0 && (
        <DeleteFolderModal
          folder={{
            uuid: folderDeleteQueue[0].uuid ?? '',
            name: folderDeleteQueue[0].name,
            asset_count: folderDeleteQueue[0].asset_count ?? 0,
            children_count: folderDeleteQueue[0].children_count ?? 0,
          }}
          show
          silent={pendingBatchResult !== null || folderDeleteQueue.length > 1}
          onHide={() =>
            setFolderDeleteQueue((prev: ContentItem[]) => prev.slice(1))
          }
          onSuccess={() => {
            setFolderDeleteQueue((prev: ContentItem[]) => prev.slice(1));
            refreshData();
          }}
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
        />
      )}
      {editDashboard && (
        <DashboardPropertiesModal
          dashboardId={editDashboard.id}
          dashboardTitle={editDashboard.title}
          show
          onHide={() => setEditDashboard(null)}
          onSubmit={() => {
            setEditDashboard(null);
            refreshData();
          }}
        />
      )}
      {!breadcrumbLoading && <SubMenu {...menuData} />}
      {!breadcrumbLoading && (
        <ConfirmStatusChange
          title={t('Please confirm')}
          description={t('Are you sure you want to delete the selected items?')}
          onConfirm={handleBulkDelete}
        >
          {confirmDelete => (
            <ListView<ContentItem>
              key={`${currentFolder.uuid ?? 'root'}-${refreshKey}`}
              className="analytics-list-view"
              columns={columns}
              count={count}
              data={sortedItems}
              fetchData={fetchData}
              refreshData={refreshData}
              loading={loading}
              initialSort={[{ id: 'changed_on', desc: true }]}
              pageSize={PAGE_SIZE}
              filters={filters}
              expandable={expandable}
              defaultViewMode="table"
              bulkSelectEnabled={bulkSelectEnabled}
              disableBulkSelect={() => setBulkSelectEnabled(false)}
              headerContent={
                isAtRoot ? null : (
                  <BreadcrumbWrap>
                    <FolderBreadcrumb items={breadcrumbItems} />
                  </BreadcrumbWrap>
                )
              }
              bulkActions={[
                ...(canEditCurrentFolder
                  ? [
                      {
                        key: 'delete',
                        name: t('Delete'),
                        type: 'danger' as const,
                        onSelect: confirmDelete,
                      },
                    ]
                  : []),
                {
                  key: 'export',
                  name: (
                    <Tooltip
                      title={t(
                        'Export is only available for dashboards and charts',
                      )}
                    >
                      <Flex gap={theme.sizeUnit}>
                        <Icons.WarningOutlined iconSize="s" />
                        {t('Export')}
                      </Flex>
                    </Tooltip>
                  ),
                  type: 'primary',
                  onSelect: handleBulkExport,
                  hidden: (rows: ContentItem[]) =>
                    rows.every(r => r.type === 'folder'),
                },
              ]}
              addSuccessToast={addSuccessToast}
              addDangerToast={addDangerToast}
            />
          )}
        </ConfirmStatusChange>
      )}
    </>
  );
}

export default withToasts(AnalyticsList);
