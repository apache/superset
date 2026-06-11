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
import {
  Input,
  Table,
  SelectionType,
  TableSize,
  type ColumnsType,
} from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';
import { Icons } from '@superset-ui/core/components/Icons';

type AssetType = 'chart' | 'dashboard' | 'folder';

interface Asset {
  id: number;
  key: string;
  name: string;
  type: AssetType;
  uuid?: string;
}

interface ChartResult {
  id: number;
  slice_name: string;
}
interface DashboardResult {
  id: number;
  dashboard_title: string;
}
interface FolderResult {
  id: number;
  uuid: string;
  name: string;
}

interface FolderAssetsModalProps {
  folderUuid: string;
  folderName: string;
  show: boolean;
  onHide: () => void;
  onSuccess: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const PAGE_SIZE = 25;

const ModalContent = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
  `}
`;

const TabBar = styled.div`
  display: flex;
  gap: 0;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 3}px;
  border-bottom: 1px solid ${({ theme }) => theme.colorBorder};
`;

const Tab = styled.button<{ active: boolean }>`
  ${({ theme, active }) => css`
    display: flex;
    align-items: center;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 4}px;
    border: none;
    background: none;
    cursor: pointer;
    font-weight: ${active ? theme.fontWeightStrong : theme.fontWeightNormal};
    color: ${active ? theme.colorPrimary : theme.colorText};
    border-bottom: 2px solid ${active ? theme.colorPrimary : 'transparent'};
  `}
`;

const ASSET_COLUMNS: ColumnsType<Asset> = [
  {
    title: t('Name'),
    dataIndex: 'name',
    key: 'name',
    render: (name: string, record: Asset) => (
      <span css={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {record.type === 'chart' && <Icons.AreaChartOutlined iconSize="m" />}
        {record.type === 'dashboard' && <Icons.AppstoreOutlined iconSize="m" />}
        {record.type === 'folder' && <Icons.FolderOutlined iconSize="m" />}
        {name}
      </span>
    ),
  },
];

export default function FolderAssetsModal({
  folderUuid,
  folderName,
  show,
  onHide,
  onSuccess,
  addDangerToast,
  addSuccessToast,
}: FolderAssetsModalProps) {
  const [activeTab, setActiveTab] = useState<AssetType>('chart');
  const [search, setSearch] = useState('');

  const [charts, setCharts] = useState<Asset[]>([]);
  const [chartsTotal, setChartsTotal] = useState(0);

  const [dashboards, setDashboards] = useState<Asset[]>([]);
  const [dashboardsTotal, setDashboardsTotal] = useState(0);

  const [folders, setFolders] = useState<Asset[]>([]);
  const [foldersTotal, setFoldersTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [initialMemberKeys, setInitialMemberKeys] = useState<Set<string>>(
    new Set(),
  );
  const [saving, setSaving] = useState(false);

  const fetchCharts = useCallback(async () => {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/chart/?q=(page_size:1000,page:0)`,
    });
    const mapped = ((json.result as ChartResult[]) || []).map(c => ({
      id: c.id,
      key: `chart-${c.id}`,
      name: c.slice_name,
      type: 'chart' as AssetType,
    }));
    setCharts(mapped);
    setChartsTotal(json.count || 0);
  }, []);

  const fetchDashboards = useCallback(async () => {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=(page_size:1000,page:0)`,
    });
    const mapped = ((json.result as DashboardResult[]) || []).map(d => ({
      id: d.id,
      key: `dashboard-${d.id}`,
      name: d.dashboard_title,
      type: 'dashboard' as AssetType,
    }));
    setDashboards(mapped);
    setDashboardsTotal(json.count || 0);
  }, []);

  const fetchFolders = useCallback(async () => {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/folders/?folder_type=analytics`,
    });
    const mapped = ((json.result as FolderResult[]) || [])
      .filter(f => f.uuid !== folderUuid)
      .map(f => ({
        id: f.id,
        key: `folder-${f.id}`,
        name: f.name,
        type: 'folder' as AssetType,
        uuid: f.uuid,
      }));
    setFolders(mapped);
    setFoldersTotal(mapped.length);
  }, [folderUuid]);

  const fetchMembers = useCallback(async () => {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/folders/${folderUuid}/assets?page_size=1000`,
    });
    const members = (json.result as { type: string; id: number }[]) || [];
    const keys = members.map(m => `${m.type}-${m.id}`);
    setSelectedKeys(keys);
    setInitialMemberKeys(new Set(keys));
  }, [folderUuid]);

  useEffect(() => {
    if (!show) return;
    setSearch('');
    setLoading(true);
    Promise.all([
      fetchCharts(),
      fetchDashboards(),
      fetchFolders(),
      fetchMembers(),
    ])
      .catch(() => addDangerToast(t('Error loading assets')))
      .finally(() => setLoading(false));
  }, [
    show,
    fetchCharts,
    fetchDashboards,
    fetchFolders,
    fetchMembers,
    addDangerToast,
  ]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const all = selectedKeys.map(key => {
        const [type, id] = key.split('-');
        return { type, id: parseInt(id, 10) };
      });
      const assetPayload = all.filter(a => a.type !== 'folder');
      const folderPayload = all.filter(a => a.type === 'folder');

      const calls: Promise<unknown>[] = [];

      calls.push(
        SupersetClient.put({
          endpoint: `/api/v1/folders/${folderUuid}/assets`,
          jsonPayload: { assets: assetPayload },
        }),
      );

      const folderById = new Map(folders.map(f => [f.id, f]));
      for (const f of folderPayload) {
        const folderItem = folderById.get(f.id);
        if (folderItem?.uuid) {
          calls.push(
            SupersetClient.put({
              endpoint: `/api/v1/folders/${folderItem.uuid}`,
              jsonPayload: { parent_uuid: folderUuid },
            }),
          );
        }
      }

      await Promise.all(calls);
      addSuccessToast(t('Updated assets in %s', folderName));
      onSuccess();
      onHide();
    } catch {
      addDangerToast(t('Error updating assets'));
    } finally {
      setSaving(false);
    }
  }, [
    folderUuid,
    folderName,
    selectedKeys,
    addSuccessToast,
    addDangerToast,
    folders,
    onSuccess,
    onHide,
  ]);

  const getItems = () => {
    if (activeTab === 'chart') return charts;
    if (activeTab === 'dashboard') return dashboards;
    return folders;
  };

  const items = getItems();
  const filtered = useMemo(() => {
    const list = search
      ? items.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
      : items;
    // Sort initial members to the top (stable — no jumping on select)
    return [...list].sort((a, b) => {
      const aInitial = initialMemberKeys.has(a.key) ? 0 : 1;
      const bInitial = initialMemberKeys.has(b.key) ? 0 : 1;
      return aInitial - bInitial;
    });
  }, [items, search, initialMemberKeys]);

  const hasChanges = useMemo(() => {
    if (selectedKeys.length !== initialMemberKeys.size) return true;
    const current = new Set(selectedKeys);
    for (const key of initialMemberKeys) {
      if (!current.has(key)) return true;
    }
    return false;
  }, [selectedKeys, initialMemberKeys]);

  return (
    <StandardModal
      title={t('Manage assets in %s', folderName)}
      show={show}
      onHide={onHide}
      onSave={handleSave}
      saveText={t('Save')}
      saveLoading={saving}
      saveDisabled={!hasChanges}
    >
      <ModalContent>
        <TabBar>
          <Tab
            type="button"
            active={activeTab === 'chart'}
            onClick={() => setActiveTab('chart')}
          >
            <Icons.AreaChartOutlined iconSize="m" css={{ marginRight: 4 }} />
            {t('Charts')} ({chartsTotal})
          </Tab>
          <Tab
            type="button"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          >
            <Icons.AppstoreOutlined iconSize="m" css={{ marginRight: 4 }} />
            {t('Dashboards')} ({dashboardsTotal})
          </Tab>
          <Tab
            type="button"
            active={activeTab === 'folder'}
            onClick={() => setActiveTab('folder')}
          >
            <Icons.FolderOutlined iconSize="m" css={{ marginRight: 4 }} />
            {t('Folders')} ({foldersTotal})
          </Tab>
        </TabBar>
        <Input
          placeholder={t('Search...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
        {loading ? (
          <p>{t('Loading...')}</p>
        ) : (
          <Table<Asset>
            data={filtered}
            columns={ASSET_COLUMNS}
            selectionType={SelectionType.Multi}
            selectedRows={selectedKeys}
            handleRowSelection={keys => setSelectedKeys(keys as string[])}
            usePagination
            defaultPageSize={PAGE_SIZE}
            size={TableSize.Small}
            height={400}
          />
        )}
      </ModalContent>
    </StandardModal>
  );
}
