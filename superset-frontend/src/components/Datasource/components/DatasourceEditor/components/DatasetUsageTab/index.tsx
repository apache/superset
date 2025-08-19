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
import Table, { TableSize } from '@superset-ui/core/components/Table';
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

const processChartsForSorting = (charts: Chart[]): Chart[] =>
  (charts || []).map(chart => ({
    ...chart,
    changed_on_ts: chart.changed_on
      ? new Date(chart.changed_on).getTime()
      : undefined,
  }));

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
  changed_on_ts?: number;
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

  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [processedCharts, setProcessedCharts] = useState<Chart[]>(
    processChartsForSorting(charts || []),
  );
  const [shouldScrollToTop, setShouldScrollToTop] = useState(false);

  const handleFetchCharts = useCallback(
    async (page = 1) => {
      if (!datasourceId) return;

      setLoading(true);
      setShouldScrollToTop(true);

      try {
        await onFetchCharts(page, PAGE_SIZE);
        setCurrentPage(page);
      } catch (error) {
        if (addDangerToastRef.current)
          addDangerToastRef.current(t('Error fetching charts'));
        setShouldScrollToTop(false);
      } finally {
        setLoading(false);
      }
    },
    [datasourceId, onFetchCharts],
  );

  useEffect(() => {
    addDangerToastRef.current = addDangerToast;
  }, [addDangerToast]);

  useEffect(() => {
    setProcessedCharts(processChartsForSorting(charts || []));
  }, [charts]);

  useEffect(() => {
    if (!loading && shouldScrollToTop) {
      const timeoutId = setTimeout(() => {
        const tableBody = document.querySelector('.ant-table-body');
        if (tableBody && typeof tableBody.scrollTo === 'function')
          tableBody.scrollTo({
            top: 0,
            behavior: 'smooth',
          });

        setShouldScrollToTop(false);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [loading, shouldScrollToTop]);

  const handlePageChange = (page: number) => {
    handleFetchCharts(page);
  };

  const columns = useMemo(
    () => [
      {
        title: t('Chart'),
        dataIndex: 'slice_name',
        key: 'slice_name',
        render: (_: any, record: Chart) => (
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
        sorter: (a: Chart, b: Chart) =>
          a.slice_name.localeCompare(b.slice_name),
        width: 300,
      },
      {
        title: t('Chart owners'),
        dataIndex: 'owners',
        key: 'owners',
        render: (_: any, record: Chart) => (
          <FacePile users={record.owners} maxCount={3} />
        ),
        sorter: false,
        width: 150,
      },
      {
        title: t('Last modified'),
        dataIndex: 'changed_on_delta_humanized',
        key: 'changed_on_delta_humanized',
        render: (_: any, record: Chart) => (
          <ModifiedInfo
            date={record.changed_on_delta_humanized}
            user={record.changed_by || undefined}
          />
        ),
        sorter: (a: Chart, b: Chart) => {
          if (a.changed_on_ts && b.changed_on_ts)
            return b.changed_on_ts - a.changed_on_ts;

          return a.changed_on_delta_humanized.localeCompare(
            b.changed_on_delta_humanized,
          );
        },
        width: 160,
      },
      {
        title: t('Dashboard usage'),
        dataIndex: 'dashboards',
        key: 'dashboards',
        render: (_: any, record: Chart) => (
          <DashboardLinksExternal dashboards={record.dashboards} />
        ),
        sorter: false,
        width: 200,
      },
    ],
    [],
  );

  return (
    <Table
      columns={columns}
      data={processedCharts}
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
          margin-bottom: 0 !important;
        }
      `}
      locale={{
        emptyText: t('No items'),
      }}
    />
  );
};

export default DatasetUsageTab;
