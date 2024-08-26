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

import { useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  css,
  ensureIsArray,
  styled,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import Chart, { ChartLinkedDashboard } from 'src/types/Chart';
import Table, {
  ColumnsType,
  TableSize,
  OnChangeFunction,
} from 'src/components/Table';
import { EmptyStateBig } from 'src/components/EmptyState';
import ChartImage from 'src/assets/images/chart.svg';
import Icons from 'src/components/Icons';
import { useToasts } from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import { FilterOperator } from 'src/components/ListView';
import moment from 'moment';
import TruncatedList from 'src/components/TruncatedList';

interface DatasetUsageProps {
  datasetId: string;
}

const DEFAULT_PAGE_SIZE = 25;

const getLinkProps = (dashboard: ChartLinkedDashboard) => ({
  key: dashboard.id,
  to: `/superset/dashboard/${dashboard.id}`,
  target: '_blank',
  rel: 'noreferer noopener',
  children: dashboard.dashboard_title,
});

const tooltipItemCSS = (theme: SupersetTheme) => css`
  color: ${theme.colors.grayscale.light5};
  text-decoration: underline;
  &:hover {
    color: inherit;
  }
`;

const columns: ColumnsType<Chart> = [
  {
    key: 'slice_name',
    title: t('Chart'),
    width: '320px',
    sorter: true,
    render: (value, record) => <Link to={record.url}>{record.slice_name}</Link>,
  },
  {
    key: 'owners',
    title: t('Chart owners'),
    width: '242px',
    render: (value, record) => (
      <TruncatedList
        items={
          record.owners?.map(
            owner => `${owner.first_name} ${owner.last_name}`,
          ) ?? []
        }
      />
    ),
  },
  {
    key: 'last_saved_at',
    title: t('Chart last modified'),
    width: '209px',
    sorter: true,
    defaultSortOrder: 'descend',
    render: (value, record) =>
      record.last_saved_at ? moment.utc(record.last_saved_at).fromNow() : null,
  },
  {
    key: 'last_saved_by.first_name',
    title: t('Chart last modified by'),
    width: '216px',
    sorter: true,
    render: (value, record) =>
      record.last_saved_by
        ? `${record.last_saved_by.first_name} ${record.last_saved_by.last_name}`
        : null,
  },
  {
    key: 'dashboards',
    title: t('Dashboard usage'),
    width: '420px',
    render: (value, record) => (
      <TruncatedList<ChartLinkedDashboard>
        items={record.dashboards}
        renderVisibleItem={dashboard => <Link {...getLinkProps(dashboard)} />}
        renderTooltipItem={dashboard => (
          <Link {...getLinkProps(dashboard)} css={tooltipItemCSS} />
        )}
        getKey={dashboard => dashboard.id}
      />
    ),
  },
];

const emptyStateTableCSS = (theme: SupersetTheme) => css`
  && th.ant-table-cell {
    color: ${theme.colors.grayscale.light1};
  }

  .ant-table-placeholder {
    display: none;
  }
`;

const emptyStateButtonText = (
  <>
    <Icons.PlusOutlined
      iconSize="m"
      css={css`
        & > .anticon {
          line-height: 0;
        }
      `}
    />
    {t('Create chart with dataset')}
  </>
);

const StyledEmptyStateBig = styled(EmptyStateBig)`
  margin: ${({ theme }) => 13 * theme.gridUnit}px 0;
`;

/**
 * Hook that uses the useListViewResource hook to retrieve records
 * based on pagination state.
 */
const useDatasetChartRecords = (datasetId: string) => {
  const { addDangerToast } = useToasts();

  // Always filters charts by dataset
  const baseFilters = useMemo(
    () => [
      {
        id: 'datasource_id',
        operator: FilterOperator.Equals,
        value: datasetId,
      },
    ],
    [datasetId],
  );

  // Returns request status/results and function for re-fetching
  const {
    state: { loading, resourceCount, resourceCollection },
    fetchData,
  } = useListViewResource<Chart>(
    'chart',
    t('chart'),
    addDangerToast,
    true,
    [],
    baseFilters,
  );

  // Adds `key` field
  const resourceCollectionWithKey = useMemo(
    () => resourceCollection.map(o => ({ ...o, key: o.id })),
    [resourceCollection],
  );

  // Called by table with updated table state to fetch new data
  // @ts-ignore
  const onChange: OnChangeFunction = useCallback(
    // @ts-ignore
    (tablePagination, tableFilters, tableSorter) => {
      const pageIndex = (tablePagination.current ?? 1) - 1;
      const pageSize = tablePagination.pageSize ?? 0;
      const sortBy = ensureIsArray(tableSorter)
        .filter(({ columnKey }) => typeof columnKey === 'string')
        .map(({ columnKey, order }) => ({
          id: columnKey as string,
          desc: order === 'descend',
        }));
      fetchData({ pageIndex, pageSize, sortBy, filters: [] });
    },
    [fetchData],
  );

  // Initial data request
  useEffect(() => {
    fetchData({
      pageIndex: 0,
      pageSize: DEFAULT_PAGE_SIZE,
      sortBy: [{ id: 'last_saved_at', desc: true }],
      filters: [],
    });
  }, [fetchData]);

  return {
    loading,
    recordCount: resourceCount,
    data: resourceCollectionWithKey,
    onChange,
  };
};

const DatasetUsage = ({ datasetId }: DatasetUsageProps) => {
  const { loading, recordCount, data, onChange } =
    useDatasetChartRecords(datasetId);

  const emptyStateButtonAction = useCallback(
    () =>
      window.open(
        `/explore/?dataset_type=table&dataset_id=${datasetId}`,
        '_blank',
      ),
    [datasetId],
  );

  return (
    <div css={!data.length ? emptyStateTableCSS : null}>
      <Table
        columns={columns}
        data={data}
        size={TableSize.Middle}
        defaultPageSize={DEFAULT_PAGE_SIZE}
        recordCount={recordCount}
        loading={loading}
        onChange={onChange}
      />
      {!data.length && !loading ? (
        <StyledEmptyStateBig
          image={<ChartImage />}
          title={t('No charts')}
          description={t('This dataset is not used to power any charts.')}
          buttonText={emptyStateButtonText}
          buttonAction={emptyStateButtonAction}
        />
      ) : null}
    </div>
  );
};

export default DatasetUsage;
