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
import { styled, SupersetClient, t, css } from '@superset-ui/core';
import rison from 'rison';
import {
  CertifiedBadge,
  InfoTooltip,
  Loading,
} from '@superset-ui/core/components';
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

const StyledUsageTabWrapper = styled.div``;

const PAGE_SIZE = 6;

const processChartsForSorting = (charts: Chart[]): Chart[] =>
  charts.map(chart => ({
    ...chart,
    changed_on_ts: chart.changed_on
      ? new Date(chart.changed_on).getTime()
      : undefined,
  }));

interface Chart {
  id: number;
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
  };
  dashboards: Array<{
    id: number;
    dashboard_title: string;
    url: string;
  }>;
}

interface DatasetUsageTabProps {
  datasourceId: number;
  charts?: Chart[];
  onDataLoad?: (charts: Chart[]) => void;
  addDangerToast?: (msg: string) => void;
}

const DatasetUsageTab = ({
  datasourceId,
  charts: preloadedCharts,
  onDataLoad,
  addDangerToast,
}: DatasetUsageTabProps) => {
  const hasFetchedRef = useRef(preloadedCharts !== undefined);
  const onDataLoadRef = useRef(onDataLoad);
  const addDangerToastRef = useRef(addDangerToast);

  const [loading, setLoading] = useState(preloadedCharts === undefined);
  const [charts, setCharts] = useState<Chart[]>(
    processChartsForSorting(preloadedCharts || []),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(preloadedCharts?.length || 0);

  const fetchCharts = useCallback(
    async (page = 1) => {
      if (!datasourceId || preloadedCharts !== undefined) return;

      setLoading(true);

      try {
        const queryParams = rison.encode({
          columns: [
            'slice_name',
            'url',
            'certified_by',
            'certification_details',
            'description',
            'owners.first_name',
            'owners.last_name',
            'owners.id',
            'changed_on_delta_humanized',
            'changed_on',
            'changed_by.first_name',
            'changed_by.last_name',
            'changed_by.id',
            'dashboards.id',
            'dashboards.dashboard_title',
            'dashboards.url',
          ],
          filters: [
            {
              col: 'datasource_id',
              opr: 'eq',
              value: datasourceId,
            },
          ],
          order_column: 'changed_on_delta_humanized',
          order_direction: 'desc',
          page: page - 1, // API uses 0-based pagination
          page_size: PAGE_SIZE,
        });

        const { json = {} } = await SupersetClient.get({
          endpoint: `/api/v1/chart/?q=${queryParams}`,
        });

        const newCharts = json?.result || [];
        const processedCharts = processChartsForSorting(newCharts);

        setCharts(processedCharts);
        setTotalItems(json?.count || 0);
        setCurrentPage(page);

        if (onDataLoadRef.current) onDataLoadRef.current(newCharts);
      } catch (error) {
        if (addDangerToastRef.current)
          addDangerToastRef.current(t('Error fetching charts'));

        setCharts([]);
        setTotalItems(0);

        if (onDataLoadRef.current) onDataLoadRef.current([]);
      } finally {
        setLoading(false);
      }
    },
    [datasourceId, preloadedCharts],
  );

  useEffect(() => {
    onDataLoadRef.current = onDataLoad;
    addDangerToastRef.current = addDangerToast;
  }, [onDataLoad, addDangerToast]);

  useEffect(() => {
    if (preloadedCharts === undefined) {
      fetchCharts();
    }
  }, [fetchCharts, preloadedCharts]);

  useEffect(() => {
    if (preloadedCharts === undefined) {
      hasFetchedRef.current = false;
      setCurrentPage(1);
    }
  }, [datasourceId, preloadedCharts]);

  const handlePageChange = (page: number) => {
    if (preloadedCharts === undefined) {
      fetchCharts(page);
    } else {
      setCurrentPage(page);
    }
  };

  const paginatedCharts = useMemo(() => {
    if (preloadedCharts !== undefined) {
      const startIndex = (currentPage - 1) * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;

      return charts.slice(startIndex, endIndex);
    }

    return charts;
  }, [charts, currentPage, preloadedCharts]);

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
        render: (_: any, record: Chart) => <FacePile users={record.owners} />,
        sorter: false,
        width: 180,
      },
      {
        title: t('Last modified'),
        dataIndex: 'changed_on_delta_humanized',
        key: 'changed_on_delta_humanized',
        render: (_: any, record: Chart) => (
          <ModifiedInfo
            date={record.changed_on_delta_humanized}
            user={record.changed_by}
          />
        ),
        sorter: (a: Chart, b: Chart) => {
          if (a.changed_on_ts && b.changed_on_ts)
            return b.changed_on_ts - a.changed_on_ts;

          return a.changed_on_delta_humanized.localeCompare(
            b.changed_on_delta_humanized,
          );
        },
        width: 200,
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

  if (loading && paginatedCharts.length === 0) {
    return (
      <StyledUsageTabWrapper>
        <Loading />
      </StyledUsageTabWrapper>
    );
  }

  return (
    <StyledUsageTabWrapper>
      <Table
        columns={columns}
        data={paginatedCharts}
        sticky
        pagination={{
          current: currentPage,
          total: totalItems,
          pageSize: PAGE_SIZE,
          onChange: handlePageChange,
          showSizeChanger: false,
          size: 'default',
        }}
        loading={loading}
        size={TableSize.Middle}
        rowKey={(record: Chart) => `chart-${record.id || record.slice_name}`}
        tableLayout="auto"
        css={css`
          height: 388px;
        `}
        locale={{
          emptyText: t('No items'),
        }}
      />
    </StyledUsageTabWrapper>
  );
};

export default DatasetUsageTab;
