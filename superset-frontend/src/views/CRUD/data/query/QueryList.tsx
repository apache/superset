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
import React, { useMemo, useState, useCallback, ReactElement } from 'react';
import { SupersetClient, t, styled, useTheme } from '@superset-ui/core';
import moment from 'moment';
import {
  createFetchRelated,
  createFetchDistinct,
  createErrorHandler,
  shortenSQL,
} from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/components/Menu/SubMenu';
import Popover from 'src/components/Popover';
import { commonMenuData } from 'src/views/CRUD/data/common';
import ListView, {
  Filters,
  FilterOperator,
  ListViewProps,
} from 'src/components/ListView';
import { Tooltip } from 'src/components/Tooltip';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/cjs/light';
import sql from 'react-syntax-highlighter/dist/cjs/languages/hljs/sql';
import github from 'react-syntax-highlighter/dist/cjs/styles/hljs/github';
import { DATETIME_WITH_TIME_ZONE, TIME_WITH_MS } from 'src/constants';
import { QueryObject, QueryObjectColumns } from 'src/views/CRUD/types';

import Icons from 'src/components/Icons';
import QueryPreviewModal from './QueryPreviewModal';

const PAGE_SIZE = 25;
const SQL_PREVIEW_MAX_LINES = 4;

const TopAlignedListView = styled(ListView)<ListViewProps<QueryObject>>`
  table .table-cell {
    vertical-align: top;
  }
`;

SyntaxHighlighter.registerLanguage('sql', sql);
const StyledSyntaxHighlighter = styled(SyntaxHighlighter)`
  height: ${({ theme }) => theme.gridUnit * 26}px;
  overflow: hidden !important; /* needed to override inline styles */
  text-overflow: ellipsis;
  white-space: nowrap;
`;

interface QueryListProps {
  addDangerToast: (msg: string, config?: any) => any;
  addSuccessToast: (msg: string, config?: any) => any;
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

function QueryList({ addDangerToast, addSuccessToast }: QueryListProps) {
  const {
    state: { loading, resourceCount: queryCount, resourceCollection: queries },
    fetchData,
  } = useListViewResource<QueryObject>(
    'query',
    t('Query history'),
    addDangerToast,
    false,
  );

  const [queryCurrentlyPreviewing, setQueryCurrentlyPreviewing] =
    useState<QueryObject>();

  const theme = useTheme();

  const handleQueryPreview = useCallback(
    (id: number) => {
      SupersetClient.get({
        endpoint: `/api/v1/query/${id}`,
      }).then(
        ({ json = {} }) => {
          setQueryCurrentlyPreviewing({ ...json.result });
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t('There was an issue previewing the selected query. %s', errMsg),
          ),
        ),
      );
    },
    [addDangerToast],
  );

  const menuData: SubMenuProps = {
    activeChild: 'Query history',
    ...commonMenuData,
  };

  const initialSort = [{ id: QueryObjectColumns.start_time, desc: true }];
  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { status },
          },
        }: any) => {
          const statusConfig: {
            name: ReactElement | null;
            label: string;
          } = {
            name: null,
            label: '',
          };
          if (status === 'success') {
            statusConfig.name = (
              <Icons.Check iconColor={theme.colors.success.base} />
            );
            statusConfig.label = t('Success');
          } else if (status === 'failed' || status === 'stopped') {
            statusConfig.name = (
              <Icons.XSmall
                iconColor={
                  status === 'failed'
                    ? theme.colors.error.base
                    : theme.colors.grayscale.base
                }
              />
            );
            statusConfig.label = t('Failed');
          } else if (status === 'running') {
            statusConfig.name = (
              <Icons.Running iconColor={theme.colors.primary.base} />
            );
            statusConfig.label = t('Running');
          } else if (status === 'timed_out') {
            statusConfig.name = (
              <Icons.Offline iconColor={theme.colors.grayscale.light1} />
            );
            statusConfig.label = t('Offline');
          } else if (status === 'scheduled' || status === 'pending') {
            statusConfig.name = (
              <Icons.Queued iconColor={theme.colors.grayscale.base} />
            );
            statusConfig.label = t('Scheduled');
          }
          return (
            <Tooltip title={statusConfig.label} placement="bottom">
              <span>{statusConfig.name}</span>
            </Tooltip>
          );
        },
        accessor: QueryObjectColumns.status,
        size: 'xs',
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.start_time,
        Header: t('Time'),
        size: 'xl',
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
        accessor: QueryObjectColumns.tab_name,
        Header: t('Tab name'),
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.database_name,
        Header: t('Database'),
        size: 'xl',
      },
      {
        accessor: QueryObjectColumns.database,
        hidden: true,
      },
      {
        accessor: QueryObjectColumns.schema,
        Header: t('Schema'),
        size: 'xl',
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
                        <StyledPopoverItem key={name}>{name}</StyledPopoverItem>
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
        accessor: QueryObjectColumns.sql_tables,
        Header: t('Tables'),
        size: 'xl',
        disableSortBy: true,
      },
      {
        accessor: QueryObjectColumns.user_first_name,
        Header: t('User'),
        size: 'xl',
        Cell: ({
          row: {
            original: { user },
          },
        }: any) => (user ? `${user.first_name} ${user.last_name}` : ''),
      },
      {
        accessor: QueryObjectColumns.user,
        hidden: true,
      },
      {
        accessor: QueryObjectColumns.rows,
        Header: t('Rows'),
        size: 'md',
      },
      {
        accessor: QueryObjectColumns.sql,
        Header: t('SQL'),
        Cell: ({ row: { original, id } }: any) => (
          <div
            tabIndex={0}
            role="button"
            data-test={`open-sql-preview-${id}`}
            onClick={() => setQueryCurrentlyPreviewing(original)}
          >
            <StyledSyntaxHighlighter language="sql" style={github}>
              {shortenSQL(original.sql, SQL_PREVIEW_MAX_LINES)}
            </StyledSyntaxHighlighter>
          </div>
        ),
      },
      {
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        Cell: ({
          row: {
            original: { id },
          },
        }: any) => (
          <Tooltip title={t('Open query in SQL Lab')} placement="bottom">
            <a href={`/superset/sqllab?queryId=${id}`}>
              <Icons.Full iconColor={theme.colors.grayscale.base} />
            </a>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  const filters: Filters = useMemo(
    () => [
      {
        Header: t('Database'),
        id: 'database',
        input: 'select',
        operator: FilterOperator.relationOneMany,
        unfilteredLabel: 'All',
        fetchSelects: createFetchRelated(
          'query',
          'database',
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching database values: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('State'),
        id: 'status',
        input: 'select',
        operator: FilterOperator.equals,
        unfilteredLabel: 'All',
        fetchSelects: createFetchDistinct(
          'query',
          'status',
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching schema values: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('User'),
        id: 'user',
        input: 'select',
        operator: FilterOperator.relationOneMany,
        unfilteredLabel: 'All',
        fetchSelects: createFetchRelated(
          'query',
          'user',
          createErrorHandler(errMsg =>
            addDangerToast(
              t('An error occurred while fetching user values: %s', errMsg),
            ),
          ),
        ),
        paginate: true,
      },
      {
        Header: t('Time range'),
        id: 'start_time',
        input: 'datetime_range',
        operator: FilterOperator.between,
      },
      {
        Header: t('Search by query text'),
        id: 'sql',
        input: 'search',
        operator: FilterOperator.contains,
      },
    ],
    [addDangerToast],
  );

  return (
    <>
      <SubMenu {...menuData} />
      {queryCurrentlyPreviewing && (
        <QueryPreviewModal
          onHide={() => setQueryCurrentlyPreviewing(undefined)}
          query={queryCurrentlyPreviewing}
          queries={queries}
          fetchData={handleQueryPreview}
          openInSqlLab={(id: number) =>
            window.location.assign(`/superset/sqllab?queryId=${id}`)
          }
          show
        />
      )}
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
        highlightRowId={queryCurrentlyPreviewing?.id}
      />
    </>
  );
}

export default withToasts(QueryList);
