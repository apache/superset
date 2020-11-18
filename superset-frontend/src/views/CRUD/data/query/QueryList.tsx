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
import React, { useMemo } from 'react';
import { t, styled } from '@superset-ui/core';
import moment from 'moment';

import withToasts from 'src/messageToasts/enhancers/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import { Popover } from 'src/common/components';
import { commonMenuData } from 'src/views/CRUD/data/common';
import ListView, { Filters, ListViewProps } from 'src/components/ListView';
import Icon, { IconName } from 'src/components/Icon';
import Tooltip from 'src/common/components/Tooltip';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { DATETIME_WITH_TIME_ZONE, TIME_WITH_MS } from 'src/constants';

SyntaxHighlighter.registerLanguage('sql', sql);

const TopAlignedListView = styled(ListView)<ListViewProps<QueryObject>>`
  table .table-cell {
    vertical-align: top;
  }
`;

const StyledSyntaxHighlighter = styled(SyntaxHighlighter)`
  height: ${({ theme }) => theme.gridUnit * 26}px;
  overflow-x: hidden !important; /* needed to override inline styles */
  text-overflow: ellipsis;
  white-space: nowrap;
`;
const PAGE_SIZE = 25;
const SQL_PREVIEW_MAX_LINES = 4;
function shortenSQL(sql: string) {
  let lines: string[] = sql.split('\n');
  if (lines.length >= SQL_PREVIEW_MAX_LINES) {
    lines = lines.slice(0, SQL_PREVIEW_MAX_LINES);
    lines.push('...');
  }
  return lines.join('\n');
}
interface QueryListProps {
  addDangerToast: (msg: string, config?: any) => any;
  addSuccessToast: (msg: string, config?: any) => any;
}

export interface QueryObject {
  id: number;
  changed_on: string;
  database: {
    database_name: string;
  };
  schema: string;
  sql: string;
  sql_tables?: { catalog?: string; schema: string; table: string }[];
  status:
    | 'success'
    | 'failed'
    | 'stopped'
    | 'running'
    | 'timed_out'
    | 'scheduled'
    | 'pending';
  tab_name: string;
  user: {
    first_name: string;
    id: number;
    last_name: string;
    username: string;
  };
  start_time: number;
  end_time: number;
  rows: number;
  tmp_table_name: string;
  tracking_url: string;
}

const StyledTableLabel = styled.div`
  .count {
    margin-left: 5px;
    color: ${({ theme }) => theme.colors.primary.base};
    text-decoration: underline;
    cursor: pointer;
  }
`;

const StyledPopoverItem = styled.div`
  color: ${({ theme }) => theme.colors.grayscale.dark2};
`;

const StatusIcon = styled(Icon)<{ status: string }>`
  color: ${({ status, theme }) => {
    if (status === 'success') return theme.colors.success.base;
    if (status === 'failed') return theme.colors.error.base;
    if (status === 'running') return theme.colors.primary.base;
    if (status === 'offline') return theme.colors.grayscale.light1;

    return theme.colors.grayscale.base;
  }};
`;

function QueryList({ addDangerToast, addSuccessToast }: QueryListProps) {
  const {
    state: { loading, resourceCount: queryCount, resourceCollection: queries },
    fetchData,
  } = useListViewResource<QueryObject>(
    'query',
    t('Query History'),
    addDangerToast,
    false,
  );

  const menuData: SubMenuProps = {
    activeChild: 'Query History',
    ...commonMenuData,
  };

  const initialSort = [{ id: 'changed_on', desc: true }];
  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { status },
          },
        }: any) => {
          const statusConfig = {
            name: '',
            label: '',
            status: '',
          };
          if (status === 'success') {
            statusConfig.name = 'check';
            statusConfig.label = t('Success');
            statusConfig.status = 'success';
          }
          if (status === 'failed' || status === 'stopped') {
            statusConfig.name = 'x-small';
            statusConfig.label = t('Failed');
            statusConfig.status = 'failed';
          }
          if (status === 'running') {
            statusConfig.name = 'running';
            statusConfig.label = t('Running');
            statusConfig.status = 'running';
          }
          if (status === 'timed_out') {
            statusConfig.name = 'offline';
            statusConfig.label = t('Offline');
            statusConfig.status = 'offline';
          }
          if (status === 'scheduled' || status === 'pending') {
            statusConfig.name = 'queued';
            statusConfig.label = t('Scheduled');
            statusConfig.status = 'queued';
          }
          return (
            <Tooltip title={statusConfig.label} placement="bottom">
              <StatusIcon
                name={statusConfig.name as IconName}
                status={statusConfig.status}
              />
            </Tooltip>
          );
        },
        accessor: 'status',
        size: 'xs',
        disableSortBy: true,
      },
      {
        accessor: 'start_time',
        Header: t('Time'),
        size: 'lg',
        Cell: ({
          row: {
            original: { start_time, end_time },
          },
        }: any) => {
          const startMoment = moment.utc(start_time).local();
          const formattedStartTimeData = startMoment
            .format(DATETIME_WITH_TIME_ZONE)
            .split(' ');

          const formattedStartTime = (
            <>
              {formattedStartTimeData[0]} <br />
              {formattedStartTimeData[1]}
            </>
          );

          return end_time ? (
            <Tooltip
              title={t(
                'Duration: %s',
                moment(moment.utc(end_time - start_time)).format(TIME_WITH_MS),
              )}
              placement="bottom"
            >
              <span>{formattedStartTime}</span>
            </Tooltip>
          ) : (
            formattedStartTime
          );
        },
      },
      {
        accessor: 'tab_name',
        Header: t('Tab Name'),
        size: 'lg',
      },
      {
        accessor: 'database.database_name',
        Header: t('Database'),
        size: 'lg',
      },
      {
        accessor: 'schema',
        Header: t('Schema'),
        size: 'lg',
      },
      {
        Cell: ({
          row: {
            original: { sql_tables: tables = [] },
          },
        }: any) => {
          const names = tables.map((table: any) => table.table);
          const main = names.length > 0 ? names.shift() : '';

          if (names.length) {
            return (
              <StyledTableLabel>
                <span>{main}</span>
                <Popover
                  placement="right"
                  title={t('TABLES')}
                  trigger="click"
                  content={
                    <>
                      {names.map((name: string) => (
                        <StyledPopoverItem>{name}</StyledPopoverItem>
                      ))}
                    </>
                  }
                >
                  <span className="count">(+{names.length})</span>
                </Popover>
              </StyledTableLabel>
            );
          }

          return main;
        },
        accessor: 'sql_tables',
        Header: t('Tables'),
        size: 'lg',
        disableSortBy: true,
      },
      {
        accessor: 'user.first_name',
        Header: t('User'),
        size: 'lg',
        Cell: ({
          row: {
            original: { user },
          },
        }: any) => `${user.first_name} ${user.last_name}`,
      },
      {
        accessor: 'rows',
        Header: t('Rows'),
        size: 'md',
      },
      {
        accessor: 'sql',
        Header: t('SQL'),
        Cell: ({
          row: {
            original: { sql },
          },
        }: any) => {
          return (
            <StyledSyntaxHighlighter language="sql" style={github}>
              {shortenSQL(sql)}
            </StyledSyntaxHighlighter>
          );
        },
      },
      {
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        Cell: ({
          row: {
            original: { id },
          },
        }: any) => {
          return (
            <Tooltip title={t('Open query in SQL Lab')} placement="bottom">
              <a href={`/superset/sqllab?queryId=${id}`}>
                <Icon name="full" />
              </a>
            </Tooltip>
          );
        },
      },
    ],
    [],
  );

  const filters: Filters = useMemo(() => [], []);

  return (
    <>
      <SubMenu {...menuData} />
      <TopAlignedListView
        className="query-history-list-view"
        columns={columns}
        count={queryCount}
        data={queries}
        fetchData={fetchData}
        filters={filters}
        initialSort={initialSort}
        loading={loading}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}

export default withToasts(QueryList);
