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
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { styled, useTheme } from '@apache-superset/core/theme';
import rison from 'rison';
import { useHistory } from 'react-router-dom';
import type { CellProps } from 'react-table';
import {
  FacePile,
  ListView,
  ListViewFilterOperator as FilterOperator,
  ModifiedInfo,
  type ListViewFilters,
} from 'src/components';
import {
  Button,
  ConfirmStatusChange,
  Dropdown,
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
  createFetchOwners,
  handleChartDelete,
  handleDashboardDelete,
} from 'src/views/CRUD/utils';
import handleResourceExport from 'src/utils/export';
import ChartPropertiesModal from 'src/explore/components/PropertiesModal';
import DashboardPropertiesModal from 'src/dashboard/components/PropertiesModal';
import { type Slice } from 'src/types/Chart';
import CreateFolderModal from './CreateFolderModal';
import FolderAssetsModal from './FolderAssetsModal';
import FolderPermissionsModal from './FolderPermissionsModal';
import MoveToModal from './MoveToModal';
import DashboardCharts from './DashboardCharts';

type ItemType = 'folder' | 'chart' | 'dashboard' | 'dataset';

interface Owner {
  id: number;
  first_name: string;
  last_name: string;
}

/** A contents row (folder or asset) from /api/v1/folders/[<uuid>/]assets. */
interface ContentItem {
  type: ItemType;
  id: number;
  uuid: string | null;
  name: string;
  url?: string | null;
  database?: string | null;
  schema?: string | null;
  owners?: Owner[];
  changed_on?: string;
  changed_by?: Owner | null;
}

/** A location in the drill path; the root has a null uuid. */
interface Crumb {
  uuid: string | null;
  name: string;
}

interface FetchConfig {
  pageIndex: number;
  pageSize: number;
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
  ${({ theme }) => `
    padding: 0 ${theme.sizeUnit * 4}px;
  `}
`;

function AnalyticsList({
  addDangerToast,
  addSuccessToast,
}: {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}) {
  const history = useHistory();
  const theme = useTheme();
  const currentUserId: number = useSelector<any, number>(
    state => state.user?.userId,
  );
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [count, setCount] = useState(0);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>(() => [
    { uuid: null, name: t('Analytics') },
  ]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderToAddAssets, setFolderToAddAssets] =
    useState<ContentItem | null>(null);
  const [folderToManagePerms, setFolderToManagePerms] =
    useState<ContentItem | null>(null);
  const [editChart, setEditChart] = useState<Slice | null>(null);
  const [editDashboard, setEditDashboard] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [bulkSelectEnabled, setBulkSelectEnabled] = useState(false);
  const [moveTarget, setMoveTarget] = useState<ContentItem | null>(null);

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

  // Fetch pins on mount and after refresh
  useEffect(() => {
    fetchPins();
  }, [fetchPins, refreshKey]);

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
      } catch {
        addDangerToast(t('Error pinning item'));
      }
    },
    [pinnedKeys.size, pins, addSuccessToast, addDangerToast, fetchPins],
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
      } catch {
        addDangerToast(t('Error unpinning item'));
      }
    },
    [pins, addSuccessToast, addDangerToast, fetchPins],
  );

  const currentFolder = breadcrumb[breadcrumb.length - 1];
  const isAtRoot = currentFolder.uuid === null;

  const fetchData = useCallback(
    async ({ pageIndex, pageSize, filters }: FetchConfig) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(pageIndex));
      params.set('page_size', String(pageSize));
      if (!currentFolder.uuid) {
        params.set('folder_type', FOLDER_TYPE);
      }
      filters.forEach(({ id, operator, value }) => {
        if (value === undefined || value === null || value === '') {
          return;
        }
        // Select/relation filters store the chosen option object
        // ({ label, value }); unwrap it to the scalar the API expects.
        const scalar =
          typeof value === 'object' &&
          !Array.isArray(value) &&
          value !== null &&
          'value' in value
            ? (value as { value: unknown }).value
            : value;
        switch (id) {
          case 'name':
            params.set('search', String(scalar));
            break;
          case 'type':
            params.set('types', String(scalar));
            break;
          case 'owners':
            params.set('owners', String(scalar));
            break;
          case 'changed_on':
            // A "between" range is split into gt/lt entries by ListView.
            if (operator === 'gt') params.set('modified_start', String(scalar));
            else if (operator === 'lt')
              params.set('modified_end', String(scalar));
            break;
          default:
            break;
        }
      });
      const base = currentFolder.uuid
        ? `/api/v1/folders/${currentFolder.uuid}/assets`
        : '/api/v1/folders/assets';
      try {
        const { json } = await SupersetClient.get({
          endpoint: `${base}?${params.toString()}`,
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

  const refreshData = useCallback(() => setRefreshKey(key => key + 1), []);

  const drillInto = useCallback((item: ContentItem) => {
    setExpandedKeys([]);
    setBreadcrumb(prev => [...prev, { uuid: item.uuid, name: item.name }]);
  }, []);

  const navigateToCrumb = useCallback((index: number) => {
    setExpandedKeys([]);
    setBreadcrumb(prev => prev.slice(0, index + 1));
  }, []);

  const toggleExpand = useCallback((rowId: string) => {
    setExpandedKeys(prev =>
      prev.includes(rowId)
        ? prev.filter(key => key !== rowId)
        : [...prev, rowId],
    );
  }, []);

  const deleteFolder = useCallback(
    async (item: ContentItem) => {
      try {
        await SupersetClient.delete({
          endpoint: `/api/v1/folders/${item.uuid}`,
        });
        addSuccessToast(t('Deleted: %s', item.name));
        refreshData();
      } catch {
        addDangerToast(t('Error deleting %s', item.name));
      }
    },
    [addSuccessToast, addDangerToast, refreshData],
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

  const handleBulkDelete = useCallback(
    (rows: ContentItem[]) => {
      const charts = rows.filter(r => r.type === 'chart').map(r => r.id);
      const dashboards = rows
        .filter(r => r.type === 'dashboard')
        .map(r => r.id);
      const folders = rows.filter(r => r.type === 'folder');
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
      folders.forEach(f =>
        calls.push(
          SupersetClient.delete({ endpoint: `/api/v1/folders/${f.uuid}` }),
        ),
      );
      Promise.all(calls)
        .then(() => {
          addSuccessToast(t('Deleted %s items', rows.length));
          refreshData();
        })
        .catch(() =>
          addDangerToast(t('There was an issue deleting the selected items')),
        );
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
              <Icons.PushpinFilled
                iconSize="s"
                css={{ color: theme.colorPrimary }}
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
          contextMenuItems.push({
            key: 'move',
            label: t('Move to…'),
            onClick: () => setMoveTarget(original),
          });

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
                  <Icons.FolderOutlined iconSize="m" />
                  {original.name}
                  {pinIcon}
                </NameLink>
              );
            }
            if (original.type === 'dashboard') {
              const expanded = expandedKeys.includes(id);
              return (
                <NameRow>
                  <Icons.AppstoreOutlined
                    iconSize="m"
                    css={{ color: '#EB2F96' }} // eslint-disable-line theme-colors/no-literal-colors
                  />
                  {original.url ? (
                    <NameLink href={original.url}>{original.name}</NameLink>
                  ) : (
                    original.name
                  )}
                  {pinIcon}
                  <CaretButton
                    type="button"
                    aria-label={expanded ? t('Collapse') : t('Expand')}
                    onClick={() => toggleExpand(id)}
                  >
                    {expanded ? (
                      <Icons.DownOutlined iconSize="s" />
                    ) : (
                      <Icons.RightOutlined iconSize="s" />
                    )}
                  </CaretButton>
                </NameRow>
              );
            }
            return original.url ? (
              <NameLink href={original.url}>
                <Icons.AreaChartOutlined
                  iconSize="m"
                  css={{ color: '#722ED1' }} // eslint-disable-line theme-colors/no-literal-colors
                />
                {original.name}
                {pinIcon}
              </NameLink>
            ) : (
              <NameRow>
                <Icons.AreaChartOutlined
                  iconSize="m"
                  css={{ color: '#722ED1' }} // eslint-disable-line theme-colors/no-literal-colors
                />
                {original.name}
                {pinIcon}
              </NameRow>
            );
          })();

          return (
            <Dropdown
              trigger={['contextMenu']}
              menu={{ items: contextMenuItems }}
            >
              <span>{nameContent}</span>
            </Dropdown>
          );
        },
      },
      {
        accessor: 'type',
        Header: t('Type'),
        id: 'type',
        size: 'sm',
        disableSortBy: true,
        Cell: ({ row: { original } }: CellProps<ContentItem>) =>
          original.type
            ? original.type.charAt(0).toUpperCase() + original.type.slice(1)
            : '',
      },
      {
        accessor: 'database',
        Header: t('Database'),
        id: 'database',
        disableSortBy: true,
        Cell: ({ row: { original } }: CellProps<ContentItem>) =>
          original.database || '-',
      },
      {
        accessor: 'schema',
        Header: t('Schema'),
        id: 'schema',
        disableSortBy: true,
        Cell: ({ row: { original } }: CellProps<ContentItem>) =>
          original.schema || '-',
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
        disableSortBy: true,
        Cell: ({ row: { original } }: CellProps<ContentItem>) =>
          original.changed_on ? (
            <ModifiedInfo
              date={original.changed_on}
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
            return (
              <Actions className="actions">
                <Tooltip title={t('Manage assets')} placement="bottom">
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={() => setFolderToAddAssets(original)}
                  >
                    <Icons.PlusSquareOutlined iconSize="l" />
                  </span>
                </Tooltip>
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
                <Tooltip title={t('Delete folder')} placement="bottom">
                  <span
                    role="button"
                    tabIndex={0}
                    className="action-button"
                    onClick={() => deleteFolder(original)}
                  >
                    <Icons.DeleteOutlined iconSize="l" />
                  </span>
                </Tooltip>
              </Actions>
            );
          }
          // chart / dashboard rows: mirror the CRUD lists' row actions.
          return (
            <Actions className="actions">
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
            </Actions>
          );
        },
      },
    ],
    [
      drillInto,
      deleteFolder,
      expandedKeys,
      toggleExpand,
      openChartEdit,
      exportAsset,
      deleteAsset,
      isPinned,
      isAtRoot,
      pinnedKeys.size,
      pinItem,
      unpinItem,
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
        fetchSelects: createFetchOwners(
          'chart',
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
    ],
    [addDangerToast],
  );

  // Sort pinned items to the top (root level only)
  const sortedItems = useMemo(() => {
    if (!isAtRoot || pinnedKeys.size === 0) return items;
    return [...items].sort((a, b) => {
      const aPinned = pinnedKeys.has(`${a.type}-${a.id}`) ? 0 : 1;
      const bPinned = pinnedKeys.has(`${b.type}-${b.id}`) ? 0 : 1;
      return aPinned - bPinned;
    });
  }, [items, pinnedKeys, isAtRoot]);

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
      expandedRowRender: (record: Record<string, unknown>) => (
        <DashboardCharts
          dashboardId={record.id as number}
          addDangerToast={addDangerToast}
        />
      ),
    }),
    [addDangerToast, expandedKeys],
  );

  const breadcrumbItems: FolderBreadcrumbItem[] = useMemo(
    () =>
      breadcrumb.map((crumb, index) => ({
        key: crumb.uuid ?? 'root',
        title: crumb.name,
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
        name: t('New'),
        buttonStyle: 'primary',
        component: (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'chart',
                  label: t('Chart'),
                  onClick: () => history.push('/chart/add'),
                },
                {
                  key: 'dashboard',
                  label: t('Dashboard'),
                  onClick: () => window.location.assign('/dashboard/new'),
                },
                {
                  key: 'folder',
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
              <Icons.CaretDownOutlined iconSize="m" />
            </Button>
          </Dropdown>
        ),
      },
    ],
  };

  return (
    <>
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
      {folderToAddAssets && (
        <FolderAssetsModal
          folderUuid={folderToAddAssets.uuid ?? ''}
          folderName={folderToAddAssets.name}
          show
          onHide={() => setFolderToAddAssets(null)}
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
          show
          onHide={() => setFolderToManagePerms(null)}
          addDangerToast={addDangerToast}
          addSuccessToast={addSuccessToast}
        />
      )}
      {moveTarget && (
        <MoveToModal
          item={moveTarget}
          currentFolderUuid={currentFolder.uuid}
          show
          onHide={() => setMoveTarget(null)}
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
      <SubMenu {...menuData} />
      <BreadcrumbWrap>
        <FolderBreadcrumb items={breadcrumbItems} />
      </BreadcrumbWrap>
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
            pageSize={PAGE_SIZE}
            filters={filters}
            expandable={expandable}
            defaultViewMode="table"
            bulkSelectEnabled={bulkSelectEnabled}
            disableBulkSelect={() => setBulkSelectEnabled(false)}
            bulkActions={[
              {
                key: 'delete',
                name: t('Delete'),
                type: 'danger',
                onSelect: confirmDelete,
              },
              {
                key: 'export',
                name: t('Export'),
                type: 'primary',
                onSelect: handleBulkExport,
              },
            ]}
            addSuccessToast={addSuccessToast}
            addDangerToast={addDangerToast}
          />
        )}
      </ConfirmStatusChange>
    </>
  );
}

export default withToasts(AnalyticsList);
