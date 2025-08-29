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
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { styled, t, css } from '@superset-ui/core';
import { CertifiedBadge, InfoTooltip } from '@superset-ui/core/components';
import Table, {
  TableSize,
  SortOrder,
  type TablePaginationConfig,
  type OnChangeFunction,
} from '@superset-ui/core/components/Table';
import { FacePile, ModifiedInfo, GenericLink } from 'src/components';
import DashboardLinksExternal from '../DashboardLinksExternal';

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit}px;

  a {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
  }

  svg {
    margin-right: ${({ theme }) => theme.sizeUnit}px;
  }
`;

const PAGE_SIZE = 25;

interface Chart {
  id?: number;
  slice_name: string;
  url: string;
  certified_by?: string;
  certification_details?: string;
  description?: string;
  owners: Array<{
    first_name: string;
    last_name: string;
    id: number;
  }>;
  changed_on_delta_humanized: string;
  changed_on?: string;
  changed_by: {
    first_name: string;
    last_name: string;
    id: number;
  } | null;
  dashboards: Array<{
    id: number;
    dashboard_title: string;
    url: string;
  }>;
}

interface DatasetUsageTabProps {
  datasourceId: number;
  charts: Chart[];
  totalCount: number;
  onFetchCharts: (
    page?: number,
    pageSize?: number,
    sortColumn?: string,
    sortDirection?: 'asc' | 'desc',
  ) => Promise<{
    charts: Chart[];
    count: number;
    ids: number[];
  }>;
  addDangerToast?: (msg: string) => void;
}

const DatasetUsageTab = ({
  datasourceId,
  charts,
  totalCount,
  onFetchCharts,
  addDangerToast,
}: DatasetUsageTabProps) => {
  const addDangerToastRef = useRef(addDangerToast);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string>(
    'changed_on_delta_humanized',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleFetchCharts = useCallback(
    async (page = 1, column = sortColumn, direction = sortDirection) => {
      if (!datasourceId) return;

      setLoading(true);

      try {
        await onFetchCharts(page, PAGE_SIZE, column, direction);
        setCurrentPage(page);
        setSortColumn(column);
        setSortDirection(direction);
      } catch (error) {
        if (addDangerToastRef.current)
          addDangerToastRef.current(t('Error fetching charts'));
      } finally {
        setLoading(false);
      }
    },
    [datasourceId, onFetchCharts, sortColumn, sortDirection],
  );

  useEffect(() => {
    addDangerToastRef.current = addDangerToast;
  }, [addDangerToast]);

  const handlePageChange = useCallback(
    (page: number) => {
      handleFetchCharts(page);

      setTimeout(() => {
        const tableBody =
          tableContainerRef.current?.querySelector('.ant-table-body');
        if (tableBody) {
          tableBody.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }
      }, 100);
    },
    [handleFetchCharts],
  );

  const handleSortChange = useCallback(
    (column: string) => {
      const newDirection =
        column === sortColumn && sortDirection === 'desc' ? 'asc' : 'desc';
      handleFetchCharts(1, column, newDirection);
    },
    [handleFetchCharts, sortColumn, sortDirection],
  );

  const handleTableChange: OnChangeFunction<Chart> = useCallback(
    (pagination: TablePaginationConfig) => {
      if (pagination?.current && pagination.current !== currentPage)
        handlePageChange(pagination.current);
    },
    [currentPage, handlePageChange],
  );

  const columns = useMemo(
    () => [
      {
        title: t('Chart'),
        dataIndex: 'slice_name',
        key: 'slice_name',
        render: (_: unknown, record: Chart) => (
          <FlexRowContainer>
            <GenericLink
              to={record.url}
              target="_blank"
              data-test={`${record.slice_name}-usage-chart-title`}
            >
              {record.certified_by && (
                <>
                  <CertifiedBadge
                    certifiedBy={record.certified_by}
                    details={record.certification_details}
                  />{' '}
                </>
              )}
              {record.slice_name}
            </GenericLink>
            {record.description && <InfoTooltip tooltip={record.description} />}
          </FlexRowContainer>
        ),
        sorter: true,
        sortOrder:
          sortColumn === 'slice_name'
            ? ((sortDirection === 'asc' ? 'ascend' : 'descend') as SortOrder)
            : undefined,
        onHeaderCell: () => ({
          onClick: () => handleSortChange('slice_name'),
          style: { cursor: 'pointer' },
        }),
        width: 300,
      },
      {
        title: t('Chart owners'),
        dataIndex: 'owners',
        key: 'owners',
        render: (_: unknown, record: Chart) => (
          <FacePile users={record.owners} maxCount={3} />
        ),
        sorter: false,
        width: 150,
      },
      {
        title: t('Last modified'),
        dataIndex: 'changed_on_delta_humanized',
        key: 'changed_on_delta_humanized',
        render: (_, record: Chart) => (
          <ModifiedInfo
            date={record.changed_on_delta_humanized}
            user={record.changed_by || undefined}
          />
        ),
        sorter: true,
        sortOrder:
          sortColumn === 'changed_on_delta_humanized'
            ? ((sortDirection === 'asc' ? 'ascend' : 'descend') as SortOrder)
            : undefined,
        onHeaderCell: () => ({
          onClick: () => handleSortChange('changed_on_delta_humanized'),
          style: { cursor: 'pointer' },
        }),
        width: 160,
      },
      {
        title: t('Dashboard usage'),
        dataIndex: 'dashboards',
        key: 'dashboards',
        render: (_, record: Chart) => (
          <DashboardLinksExternal dashboards={record.dashboards} />
        ),
        sorter: false,
        width: 200,
      },
    ],
    [handleSortChange, sortColumn, sortDirection],
  );

  return (
    <div ref={tableContainerRef}>
      <Table
        columns={columns}
        data={charts}
        pagination={{
          current: currentPage,
          total: totalCount,
          pageSize: PAGE_SIZE,
          onChange: handlePageChange,
          showSizeChanger: false,
          size: 'default',
        }}
        loading={loading}
        size={TableSize.Middle}
        rowKey={(record: Chart) =>
          record.id ? `chart-${record.id}` : `chart-${record.slice_name}`
        }
        tableLayout="fixed"
        css={css`
          .ant-table-body {
            height: 293px;
            overflow-y: auto;
            overflow-x: hidden;
          }
          .ant-table-pagination.ant-pagination {
            justify-content: center;
            margin-bottom: 0;
          }
        `}
        locale={{
          emptyText: t('No items'),
        }}
        onChange={handleTableChange}
      />
    </div>
  );
};

export default DatasetUsageTab;
