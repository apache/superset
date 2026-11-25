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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { Alert } from '@apache-superset/core/components';
import { t } from '@apache-superset/core/translation';
import { styled, css } from '@apache-superset/core/theme';
import {
  CertifiedBadge,
  InfoTooltip,
  Input,
} from '@superset-ui/core/components';
import {
  Table,
  TableSize,
  SortOrder,
  type TablePaginationConfig,
  type OnChangeFunction,
} from '@superset-ui/core/components/Table';
import { ModifiedInfo, GenericLink } from 'src/components';
import { SubjectPile } from 'src/features/subjects/SubjectPile';
import ArchivedLabel from 'src/components/ArchivedLabel';
import type { ChartLinkedDashboard } from 'src/types/Chart';
import type Subject from 'src/types/Subject';
import { DashboardCrossLinks } from 'src/components/ListView/DashboardCrossLinks';

const FlexRowContainer = styled.div`
  align-items: center;
  display: flex;
  gap: ${({ theme }) => theme.sizeUnit}px;

  a,
  > .archived-chart-title {
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

export interface UsageChart {
  id?: number;
  slice_name: string;
  url: string;
  certified_by?: string;
  certification_details?: string;
  description?: string;
  editors?: Subject[];
  changed_on_delta_humanized: string;
  changed_on?: string;
  changed_by: {
    first_name: string;
    last_name: string;
    id: number;
  } | null;
  dashboards?: ChartLinkedDashboard[];
  deleted_at?: string | null;
  deleted_at_delta_humanized?: string | null;
}

interface DatasetUsageTabProps {
  datasourceId: number;
  charts: UsageChart[];
  totalCount: number;
  onFetchCharts: (
    page?: number,
    pageSize?: number,
    sortColumn?: string,
    sortDirection?: 'asc' | 'desc',
  ) => Promise<{
    charts: UsageChart[];
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
  const prevLoadingRef = useRef(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string>(
    'changed_on_delta_humanized',
  );
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');

  const handleFetchCharts = useCallback(
    async (page = 1, column = sortColumn, direction = sortDirection) => {
      if (!datasourceId) return;

      setLoading(true);

      try {
        await onFetchCharts(page, PAGE_SIZE, column, direction);

        if (isMountedRef.current) {
          setCurrentPage(page);
          setSortColumn(column);
          setSortDirection(direction);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;

        if (addDangerToastRef.current) {
          addDangerToastRef.current(t('Error fetching charts'));
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [datasourceId, onFetchCharts, sortColumn, sortDirection],
  );

  useEffect(() => {
    addDangerToastRef.current = addDangerToast;
  }, [addDangerToast]);

  // Scroll to top after data loads (when loading changes from true to false)
  useEffect(() => {
    let frameId: number | undefined;

    if (prevLoadingRef.current && !loading) {
      // Loading just finished, scroll to top
      frameId = requestAnimationFrame(() => {
        const tableBody =
          tableContainerRef.current?.querySelector('.ant-table-body');
        if (tableBody) {
          tableBody.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }
      });
    }
    prevLoadingRef.current = loading;

    // Cleanup: cancel animation frame if component unmounts
    return () => {
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [loading]);

  const handlePageChange = useCallback(
    (page: number) => {
      handleFetchCharts(page);
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

  const handleTableChange: OnChangeFunction<UsageChart> = useCallback(
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
        render: (_: unknown, record: UsageChart) => (
          <FlexRowContainer>
            {record.deleted_at ? (
              <>
                <span
                  className="archived-chart-title"
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
                </span>
                <ArchivedLabel />
              </>
            ) : (
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
            )}
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
        title: t('Chart editors'),
        dataIndex: 'editors',
        key: 'editors',
        render: (_: unknown, record: UsageChart) => (
          <SubjectPile subjects={record.editors || []} maxCount={3} />
        ),
        sorter: false,
        width: 150,
      },
      {
        title: t('Last modified'),
        dataIndex: 'changed_on_delta_humanized',
        key: 'changed_on_delta_humanized',
        render: (_, record: UsageChart) =>
          record.deleted_at ? (
            <div>
              <div>{t('Archived')}</div>
              <div>{record.deleted_at_delta_humanized}</div>
            </div>
          ) : (
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
        render: (_, record: UsageChart) => (
          <DashboardCrossLinks dashboards={record.dashboards ?? []} external />
        ),
        sorter: false,
        width: 200,
      },
    ],
    [handleSortChange, sortColumn, sortDirection],
  );

  const filteredCharts = useMemo(() => {
    if (!searchTerm) return charts;

    const lowerSearch = searchTerm.toLowerCase();
    return charts.filter(chart => {
      // Search in chart name
      if (chart.slice_name?.toLowerCase().includes(lowerSearch)) return true;

      // Search in editor names
      if (
        chart.editors?.some(editor =>
          editor.label?.toLowerCase().includes(lowerSearch),
        )
      )
        return true;

      // Search in dashboard titles
      if (
        chart.dashboards?.some(dashboard =>
          dashboard.dashboard_title?.toLowerCase().includes(lowerSearch),
        )
      )
        return true;

      return false;
    });
  }, [charts, searchTerm]);

  return (
    <div ref={tableContainerRef}>
      {isFeatureEnabled(FeatureFlag.SoftDelete) && (
        <Alert
          css={theme => ({ marginBottom: theme.sizeUnit * 4 })}
          type="info"
          closable={false}
          message={t(
            'Archived charts and dashboards may still depend on this dataset, including assets you cannot view. Archiving or permanently deleting this dataset can prevent those assets from working after they are recovered.',
          )}
        />
      )}
      <Input.Search
        placeholder={t('Search charts by name, editor, or dashboard')}
        value={searchTerm}
        onChange={e => {
          setSearchTerm(e.target.value);
          if (!e.target.value) {
            setCurrentPage(1);
          }
        }}
        style={{ marginBottom: 16, width: 400 }}
        allowClear
      />
      <Table
        sticky
        columns={columns}
        data={filteredCharts}
        pagination={
          searchTerm
            ? false
            : {
                current: currentPage,
                total: totalCount,
                pageSize: PAGE_SIZE,
                onChange: handlePageChange,
                showSizeChanger: false,
              }
        }
        loading={loading}
        size={TableSize.Middle}
        rowKey={(record: UsageChart) =>
          record.id ? `chart-${record.id}` : `chart-${record.slice_name}`
        }
        tableLayout="fixed"
        scroll={{ y: 293, x: '100%' }}
        css={css`
          .ant-table-pagination.ant-pagination {
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
