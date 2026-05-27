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
import { Link } from 'react-router-dom';
import { ListView } from 'src/components';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import withToasts from 'src/components/MessageToasts/withToasts';

interface FolderContentItem {
  type: 'folder' | 'chart' | 'dashboard';
  id: number;
  uuid: string;
  name: string;
  changed_on: string | null;
}

interface BreadcrumbItem {
  uuid: string | null;
  name: string;
}

const PAGE_SIZE = 25;

function FoldersPOC({
  addDangerToast,
  addSuccessToast,
}: {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FolderContentItem[]>([]);
  const [count, setCount] = useState(0);
  const [currentFolderUuid, setCurrentFolderUuid] = useState<string | null>(
    null,
  );
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set());
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { uuid: null, name: t('Analytics') },
  ]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = currentFolderUuid
        ? `/api/v1/folder/${currentFolderUuid}/assets`
        : '/api/v1/folder/assets?folder_type=analytics';

      const { json } = await SupersetClient.get({ endpoint });
      setData(json.result || []);
      setCount(json.count || 0);
    } catch (err) {
      addDangerToast(t('Error fetching folder contents'));
    } finally {
      setLoading(false);
    }
  }, [currentFolderUuid, addDangerToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateToFolder = useCallback((uuid: string, name: string) => {
    setCurrentFolderUuid(uuid);
    setBreadcrumb(prev => [...prev, { uuid, name }]);
    setExpandedRowIds(new Set());
  }, []);

  const navigateToBreadcrumb = useCallback((index: number) => {
    setBreadcrumb(prev => {
      const newBreadcrumb = prev.slice(0, index + 1);
      const target = newBreadcrumb[newBreadcrumb.length - 1];
      setCurrentFolderUuid(target.uuid);
      return newBreadcrumb;
    });
    setExpandedRowIds(new Set());
  }, []);

  const columns = useMemo(
    () => [
      {
        accessor: 'name',
        Header: t('Name'),
        size: 'xxl',
        Cell: ({
          row: { original },
        }: {
          row: { original: FolderContentItem };
        }) => {
          if (original.type === 'folder') {
            return (
              <button
                type="button"
                onClick={() => navigateToFolder(original.uuid, original.name)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#1890ff',
                  padding: 0,
                  textAlign: 'left',
                  fontWeight: 500,
                }}
              >
                📁 {original.name}
              </button>
            );
          }
          const url =
            original.type === 'chart'
              ? `/explore/?slice_id=${original.id}`
              : `/superset/dashboard/${original.uuid}/`;
          return (
            <Link to={url}>
              {original.type === 'chart' ? '📊' : '📋'} {original.name}
            </Link>
          );
        },
        id: 'name',
      },
      {
        accessor: 'type',
        Header: t('Type'),
        size: 'sm',
        Cell: ({
          row: { original },
        }: {
          row: { original: FolderContentItem };
        }) => original.type.charAt(0).toUpperCase() + original.type.slice(1),
        id: 'type',
      },
      {
        accessor: 'changed_on',
        Header: t('Last modified'),
        size: 'lg',
        Cell: ({
          row: { original },
        }: {
          row: { original: FolderContentItem };
        }) =>
          original.changed_on
            ? new Date(original.changed_on).toLocaleDateString()
            : '-',
        id: 'changed_on',
      },
    ],
    [navigateToFolder],
  );

  const expandable = useMemo(
    () => ({
      expandedRowRender: (record: FolderContentItem) => {
        if (record.type === 'dashboard') {
          return (
            <div style={{ padding: '8px 16px', background: '#fafafa' }}>
              <strong>{t('Charts in Dashboard')}</strong>
              <p style={{ color: '#888', marginTop: 4 }}>
                {t('Dashboard inline expansion — chart preview loads here')}
              </p>
            </div>
          );
        }
        return null;
      },
      rowExpandable: (record: FolderContentItem) =>
        record.type === 'dashboard',
    }),
    [],
  );

  const menuData: SubMenuProps = {
    name: (
      <span>
        {breadcrumb.map((item, index) => (
          <span key={item.uuid ?? 'root'}>
            {index > 0 && ' > '}
            {index < breadcrumb.length - 1 ? (
              <button
                type="button"
                onClick={() => navigateToBreadcrumb(index)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {item.name}
              </button>
            ) : (
              item.name
            )}
          </span>
        ))}
      </span>
    ),
  };

  return (
    <>
      <SubMenu {...menuData} />
      <ListView<FolderContentItem>
        className="folders-poc-list-view"
        columns={columns}
        count={count}
        data={data}
        fetchData={fetchData}
        loading={loading}
        pageSize={PAGE_SIZE}
        addSuccessToast={addSuccessToast}
        addDangerToast={addDangerToast}
        refreshData={fetchData}
        expandable={expandable}
      />
    </>
  );
}

export default withToasts(FoldersPOC);
