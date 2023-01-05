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

import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  css,
  ensureIsArray,
  styled,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import CrossLinks from 'src/components/ListView/CrossLinks';
import Chart from 'src/types/Chart';
import Table, { ColumnsType, TableSize } from 'src/components/Table';
import { alphabeticalSort } from 'src/components/Table/sorters';
import { EmptyStateBig } from 'src/components/EmptyState';
import ChartImage from 'src/assets/images/chart.svg';
import Icons from 'src/components/Icons';

interface DatasetUsageProps {
  datasetId: string;
}

const DEFAULT_PAGE_SIZE = 25;
const columns: ColumnsType<Chart> = [
  {
    key: 'slice_name',
    title: t('Chart'),
    width: '320px',
    render: (value, record) => <Link to={record.url}>{record.slice_name}</Link>,
    sorter: (a, b) => alphabeticalSort('slice_name', a, b),
  },
  {
    key: 'owners',
    title: t('Chart owners'),
    width: '242px',
    render: (value, record) =>
      record.owners
        ?.map(owner => `${owner.first_name} ${owner.last_name}`)
        .join(', '),
  },
  {
    key: 'last-modified',
    dataIndex: 'changed_on_delta_humanized',
    title: t('Chart last modified'),
    width: '209px',
    sorter: (a, b) => alphabeticalSort('changed_on_utc', a, b),
  },
  {
    key: 'last-modified-by',
    title: t('Chart last modified by'),
    width: '216px',
    dataIndex: 'changed_by_name',
    sorter: (a, b) => alphabeticalSort('changed_by_name', a, b),
  },
  {
    key: 'dashboards',
    title: t('Dashboard usage'),
    width: '420px',
    render: (value, record) => (
      <CrossLinks
        crossLinks={ensureIsArray(record.dashboards).map(d => ({
          title: d.dashboard_title,
          id: d.id,
        }))}
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

const data: Chart[] = [];

const DatasetUsage = ({ datasetId }: DatasetUsageProps) => {
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
        size={TableSize.MIDDLE}
        defaultPageSize={DEFAULT_PAGE_SIZE}
      />
      {!data.length ? (
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
