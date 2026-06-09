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
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { Input } from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';
import { Icons } from '@superset-ui/core/components/Icons';

type AssetType = 'chart' | 'dashboard' | 'folder';

interface Asset {
  id: number;
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

const AssetList = styled.div`
  ${({ theme }) => css`
    max-height: 400px;
    overflow-y: auto;
    margin-top: ${theme.sizeUnit * 2}px;

    .asset-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 2}px;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      cursor: pointer;

      &:hover {
        background: ${theme.colorBgTextHover};
      }

      &.selected {
        background: ${theme.colorInfoBg};
      }

      .asset-info {
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
      }

      .check-icon {
        color: ${theme.colorSuccess};
      }
    }
  `}
`;

const SelectedCount = styled.div`
  ${({ theme }) => css`
    margin-top: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    background: ${theme.colorInfoBg};
    border-radius: ${theme.borderRadius}px;
    font-weight: ${theme.fontWeightStrong};
  `}
`;

const LoadMoreButton = styled.button`
  ${({ theme }) => css`
    width: 100%;
    padding: ${theme.sizeUnit * 2}px;
    margin-top: ${theme.sizeUnit}px;
    border: 1px solid ${theme.colorBorder};
    border-radius: ${theme.borderRadius}px;
    background: none;
    cursor: pointer;
    color: ${theme.colorPrimary};
    &:hover {
      background: ${theme.colorBgTextHover};
    }
  `}
`;

export default function FolderAssetsModal({
  folderUuid,
  folderName,
  show,
  onHide,
  onSuccess,
  addDangerToast,
  addSuccessToast,
}: FolderAssetsModalProps) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<AssetType>('chart');
  const [search, setSearch] = useState('');

  const [charts, setCharts] = useState<Asset[]>([]);
  const [chartsTotal, setChartsTotal] = useState(0);
  const [chartsPage, setChartsPage] = useState(0);

  const [dashboards, setDashboards] = useState<Asset[]>([]);
  const [dashboardsTotal, setDashboardsTotal] = useState(0);
  const [dashboardsPage, setDashboardsPage] = useState(0);

  const [folders, setFolders] = useState<Asset[]>([]);
  const [foldersTotal, setFoldersTotal] = useState(0);
  const [foldersPage, setFoldersPage] = useState(0);

  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchCharts = useCallback(
    async (page: number, append = false) => {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/chart/?q=(page_size:${PAGE_SIZE},page:${page})`,
      });
      const mapped = ((json.result as ChartResult[]) || []).map(c => ({
        id: c.id,
        name: c.slice_name,
        type: 'chart' as AssetType,
      }));
      setCharts(prev => (append ? [...prev, ...mapped] : mapped));
      setChartsTotal(json.count || 0);
      setChartsPage(page);
    },
    [],
  );

  const fetchDashboards = useCallback(
    async (page: number, append = false) => {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/?q=(page_size:${PAGE_SIZE},page:${page})`,
      });
      const mapped = ((json.result as DashboardResult[]) || []).map(d => ({
        id: d.id,
        name: d.dashboard_title,
        type: 'dashboard' as AssetType,
      }));
      setDashboards(prev => (append ? [...prev, ...mapped] : mapped));
      setDashboardsTotal(json.count || 0);
      setDashboardsPage(page);
    },
    [],
  );

  const fetchFolders = useCallback(
    async (page: number, append = false) => {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/folders/?folder_type=analytics`,
      });
      // Filter out the current folder (can't add a folder to itself)
      const mapped = ((json.result as FolderResult[]) || [])
        .filter(f => f.uuid !== folderUuid)
        .map(f => ({
          id: f.id,
          name: f.name,
          type: 'folder' as AssetType,
          uuid: f.uuid,
        }));
      setFolders(prev => (append ? [...prev, ...mapped] : mapped));
      setFoldersTotal(mapped.length);
      setFoldersPage(page);
    },
    [folderUuid],
  );

  const fetchMembers = useCallback(async () => {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/folders/${folderUuid}/assets?types=chart,dashboard&page_size=1000`,
    });
    const members =
      (json.result as { type: string; id: number }[]) || [];
    setSelected(
      new Set(
        members
          .filter(m => m.type === 'chart' || m.type === 'dashboard')
          .map(m => `${m.type}-${m.id}`),
      ),
    );
  }, [folderUuid]);

  useEffect(() => {
    if (!show) return;
    setSearch('');
    setLoading(true);
    Promise.all([
      fetchCharts(0),
      fetchDashboards(0),
      fetchFolders(0),
      fetchMembers(),
    ])
      .catch(() => addDangerToast(t('Error loading assets')))
      .finally(() => setLoading(false));
  }, [show, fetchCharts, fetchDashboards, fetchFolders, fetchMembers, addDangerToast]);

  const toggleSelect = useCallback((key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payloadAssets = Array.from(selected).map(key => {
        const [type, id] = key.split('-');
        return { type, id: parseInt(id, 10) };
      });
      await SupersetClient.put({
        endpoint: `/api/v1/folders/${folderUuid}/assets`,
        jsonPayload: { assets: payloadAssets },
      });
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
    selected,
    addSuccessToast,
    addDangerToast,
    onSuccess,
    onHide,
  ]);

  const getItems = () => {
    if (activeTab === 'chart') return charts;
    if (activeTab === 'dashboard') return dashboards;
    return folders;
  };

  const getTotal = () => {
    if (activeTab === 'chart') return chartsTotal;
    if (activeTab === 'dashboard') return dashboardsTotal;
    return foldersTotal;
  };

  const hasMore = () => {
    const items = getItems();
    return items.length < getTotal();
  };

  const loadMore = () => {
    if (activeTab === 'chart') fetchCharts(chartsPage + 1, true);
    else if (activeTab === 'dashboard')
      fetchDashboards(dashboardsPage + 1, true);
    else fetchFolders(foldersPage + 1, true);
  };

  const items = getItems();
  const filtered = search
    ? items.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : items;
  const sorted = [...filtered].sort((a, b) => {
    const aSelected = selected.has(`${a.type}-${a.id}`) ? 0 : 1;
    const bSelected = selected.has(`${b.type}-${b.id}`) ? 0 : 1;
    return aSelected - bSelected;
  });

  return (
    <StandardModal
      title={t('Manage assets in %s', folderName)}
      show={show}
      onHide={onHide}
      onSave={handleSave}
      saveText={t('Save')}
      saveLoading={saving}
    >
      <ModalContent>
        <TabBar>
          <Tab
            type="button"
            active={activeTab === 'chart'}
            onClick={() => setActiveTab('chart')}
          >
            <Icons.AreaChartOutlined
              iconSize="m"
              css={{ marginRight: 4, color: '#722ED1' }}
            />
            {t('Charts')} ({chartsTotal})
          </Tab>
          <Tab
            type="button"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          >
            <Icons.AppstoreOutlined
              iconSize="m"
              css={{ marginRight: 4, color: '#EB2F96' }}
            />
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
          <AssetList>
            {sorted.length === 0 ? (
              <p css={{ padding: 12, color: theme.colorTextSecondary }}>
                {t('No items found')}
              </p>
            ) : (
              sorted.map(asset => {
                const key = `${asset.type}-${asset.id}`;
                const isSelected = selected.has(key);
                return (
                  <div
                    key={key}
                    className={`asset-row ${isSelected ? 'selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSelect(key)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') toggleSelect(key);
                    }}
                  >
                    <div className="asset-info">
                      {asset.type === 'chart' && (
                        <Icons.AreaChartOutlined
                          iconSize="m"
                          css={{ color: '#722ED1' }} // eslint-disable-line theme-colors/no-literal-colors
                        />
                      )}
                      {asset.type === 'dashboard' && (
                        <Icons.AppstoreOutlined
                          iconSize="m"
                          css={{ color: '#EB2F96' }} // eslint-disable-line theme-colors/no-literal-colors
                        />
                      )}
                      {asset.type === 'folder' && (
                        <Icons.FolderOutlined iconSize="m" />
                      )}
                      <span>{asset.name}</span>
                    </div>
                    {isSelected && (
                      <Icons.CheckOutlined
                        iconSize="m"
                        className="check-icon"
                      />
                    )}
                  </div>
                );
              })
            )}
            {!search && hasMore() && (
              <LoadMoreButton type="button" onClick={loadMore}>
                {t('Load more…')}
              </LoadMoreButton>
            )}
          </AssetList>
        )}
        <SelectedCount>
          {t('%s item(s) in this folder', selected.size)}
        </SelectedCount>
      </ModalContent>
    </StandardModal>
  );
}
