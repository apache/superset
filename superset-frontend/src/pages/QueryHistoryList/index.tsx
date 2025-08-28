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
import { useMemo, useState, useCallback, ReactElement, useEffect } from 'react';
import { Link, useHistory } from 'react-router-dom';
import {
  css,
  QueryState,
  styled,
  SupersetClient,
  t,
  useTheme,
} from '@superset-ui/core';
import {
  createFetchRelated,
  createFetchDistinct,
  createErrorHandler,
  shortenSQL,
} from 'src/views/CRUD/utils';
import withToasts from 'src/components/MessageToasts/withToasts';
import { useListViewResource } from 'src/views/CRUD/hooks';
import SubMenu, { SubMenuProps } from 'src/features/home/SubMenu';
import { Popover, Label, Tooltip } from '@superset-ui/core/components';
import { commonMenuData } from 'src/features/home/commonMenuData';
import {
  ListView,
  ListViewFilterOperator as FilterOperator,
  type ListViewProps,
  type ListViewFilters,
} from 'src/components';
import CodeSyntaxHighlighter, {
  preloadLanguages,
} from '@superset-ui/core/components/CodeSyntaxHighlighter';
import { DATETIME_WITH_TIME_ZONE, TIME_WITH_MS } from 'src/constants';
import { QueryObject, QueryObjectColumns } from 'src/views/CRUD/types';

import { Icons } from '@superset-ui/core/components/Icons';
import QueryPreviewModal from 'src/features/queries/QueryPreviewModal';
import { addSuccessToast } from 'src/components/MessageToasts/actions';
import getOwnerName from 'src/utils/getOwnerName';
import { extendedDayjs } from '@superset-ui/core/utils/dates';

const PAGE_SIZE = 25;
const SQL_PREVIEW_MAX_LINES = 4;

const TopAlignedListView = styled(ListView)<ListViewProps<QueryObject>>`
  table .ant-table-cell {
    vertical-align: top;
  }
`;

const StyledCodeSyntaxHighlighter = styled(CodeSyntaxHighlighter)`
  height: ${({ theme }) => theme.sizeUnit * 26}px;
  overflow: hidden !important; /* needed to override inline styles */
  text-overflow: ellipsis;
  white-space: nowrap;

  /* Ensure the syntax highlighter content respects the container constraints */
  & > div {
    height: 100%;
    overflow: hidden;
  }

  pre {
    height: 100% !important;
    overflow: hidden !important;
    margin: 0 !important;
  }
`;

interface QueryListProps {
  addDangerToast: (msg: string, config?: any) => any;
  addSuccessToast: (msg: string, config?: any) => any;
}

const StyledTableLabel = styled.div`
  .count {
    margin-left: 5px;
    color: ${({ theme }) => theme.colorPrimary};
    text-decoration: underline;
    cursor: pointer;
  }
`;

const StyledPopoverItem = styled.div`
  color: ${({ theme }) => theme.colorText};
`;

const TimerLabel = styled(Label)`
  text-align: left;
  font-family: ${({ theme }) => theme.fontFamilyCode};
`;

function QueryList({ addDangerToast }: QueryListProps) {
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
  const history = useHistory();

  // Preload SQL language since this component will definitely display SQL
  useEffect(() => {
    preloadLanguages(['sql']);
  }, []);

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

  const initialSort = [{ id: QueryObjectColumns.StartTime, desc: true }];
  const columns = useMemo(
    () => [
      {
        Cell: ({
          row: {
            original: { status },
          },
        }: {
          row: {
            original: {
              status: QueryState;
            };
          };
        }) => {
          const statusConfig: {
            name: ReactElement | null;
            label: string;
          } = {
            name: null,
            label: '',
          };
          if (status === QueryState.Success) {
            statusConfig.name = (
              <Icons.CheckOutlined
                iconSize="m"
                iconColor={theme.colorSuccess}
                css={css`
                  vertical-align: -webkit-baseline-middle;
                `}
              />
            );
            statusConfig.label = t('Success');
          } else if (
            status === QueryState.Failed ||
            status === QueryState.Stopped
          ) {
            statusConfig.name = (
              <Icons.CloseOutlined
                iconSize="m"
                iconColor={
                  status === QueryState.Failed
                    ? theme.colorError
                    : theme.colorIcon
                }
              />
            );
            statusConfig.label = t('Failed');
          } else if (status === QueryState.Running) {
            statusConfig.name = (
              <Icons.LoadingOutlined
                iconSize="m"
                iconColor={theme.colorPrimary}
              />
            );
            statusConfig.label = t('Running');
          } else if (status === QueryState.TimedOut) {
            statusConfig.name = (
              <Icons.CircleSolid iconSize="m" iconColor={theme.colorIcon} />
            );
            statusConfig.label = t('Offline');
          } else if (
            status === QueryState.Scheduled ||
            status === QueryState.Pending
          ) {
            statusConfig.name = <Icons.Queued iconSize="m" />;
            statusConfig.label = t('Scheduled');
          }
          return (
            <Tooltip title={statusConfig.label} placement="bottom">
              <span>{statusConfig.name}</span>
            </Tooltip>
          );
        },
        accessor: QueryObjectColumns.Status,
        size: 'xs',
        disableSortBy: true,
        id: QueryObjectColumns.Status,
      },
      {
        accessor: QueryObjectColumns.StartTime,
        Header: t('Time'),
        size: 'lg',
        Cell: ({
          row: {
            original: { start_time },
          },
        }: any) => {
          const start = extendedDayjs.utc(start_time).local();
          const formattedStartTimeData = start
            .format(DATETIME_WITH_TIME_ZONE)
            .split(' ');

          const formattedStartTime = (
            <>
              {formattedStartTimeData[0]} <br />
              {formattedStartTimeData[1]}
            </>
          );
          return formattedStartTime;
        },
        id: QueryObjectColumns.StartTime,
      },
      {
        Header: t('Duration'),
        size: 'lg',
        Cell: ({
          row: {
            original: { status, start_time, start_running_time, end_time },
          },
        }: any) => {
          const timerType = status === QueryState.Failed ? 'danger' : status;
          // Use start_running_time if available for more accurate duration
          const startTime = start_running_time || start_time;
          const timerTime =
            end_time && startTime
              ? extendedDayjs(extendedDayjs.utc(end_time - startTime)).format(
                  TIME_WITH_MS,
                )
              : '00:00:00.000';
          return (
            <TimerLabel type={timerType} role="timer">
              {timerTime}
            </TimerLabel>
          );
        },
        id: 'duration',
      },
      {
        accessor: QueryObjectColumns.TabName,
        Header: t('Tab name'),
        size: 'xl',
        id: QueryObjectColumns.TabName,
      },
      {
        accessor: QueryObjectColumns.DatabaseName,
        Header: t('Database'),
        size: 'lg',
        id: QueryObjectColumns.DatabaseName,
      },
      {
        accessor: QueryObjectColumns.Database,
        hidden: true,
        id: QueryObjectColumns.Database,
      },
      {
        accessor: QueryObjectColumns.Schema,
        Header: t('Schema'),
        size: 'lg',
        id: QueryObjectColumns.Schema,
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
        accessor: QueryObjectColumns.SqlTables,
        Header: t('Tables'),
        size: 'lg',
        disableSortBy: true,
        id: QueryObjectColumns.SqlTables,
      },
      {
        accessor: QueryObjectColumns.UserFirstName,
        Header: t('User'),
        size: 'xl',
        Cell: ({
          row: {
            original: { user },
          },
        }: any) => getOwnerName(user),
        id: QueryObjectColumns.UserFirstName,
      },
      {
        accessor: QueryObjectColumns.User,
        hidden: true,
        id: QueryObjectColumns.User,
      },
      {
        accessor: QueryObjectColumns.Rows,
        Header: t('Rows'),
        size: 'sm',
        id: QueryObjectColumns.Rows,
      },
      {
        accessor: QueryObjectColumns.Sql,
        Header: t('SQL'),
        Cell: ({ row: { original, id } }: any) => (
          <div
            tabIndex={0}
            role="button"
            data-test={`open-sql-preview-${id}`}
            onClick={() => setQueryCurrentlyPreviewing(original)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setQueryCurrentlyPreviewing(original);
              }
            }}
            style={{ cursor: 'pointer' }}
          >
            <StyledCodeSyntaxHighlighter
              language="sql"
              customStyle={{
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              {shortenSQL(original.sql, SQL_PREVIEW_MAX_LINES)}
            </StyledCodeSyntaxHighlighter>
          </div>
        ),
        size: 'xxl',
        id: QueryObjectColumns.Sql,
      },
      {
        Header: t('Actions'),
        id: 'actions',
        disableSortBy: true,
        size: 'sm',
        Cell: ({
          row: {
            original: { id },
          },
        }: any) => (
          <Tooltip title={t('Open query in SQL Lab')} placement="bottom">
            <Link to={`/sqllab?queryId=${id}`}>
              <Icons.Full iconSize="l" />
            </Link>
          </Tooltip>
        ),
      },
    ],
    [theme], // Add theme to dependencies since it's used in the columns
  );

  const filters: ListViewFilters = useMemo(
    () => [
      {
        Header: t('Database'),
        key: 'database',
        id: 'database',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
        unfilteredLabel: t('All'),
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
        key: 'state',
        id: 'status',
        input: 'select',
        operator: FilterOperator.Equals,
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
        key: 'user',
        id: 'user',
        input: 'select',
        operator: FilterOperator.RelationOneMany,
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
        key: 'start_time',
        id: 'start_time',
        input: 'datetime_range',
        operator: FilterOperator.Between,
      },
      {
        Header: t('Search by query text'),
        key: 'sql',
        id: 'sql',
        input: 'search',
        operator: FilterOperator.Contains,
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
          openInSqlLab={(id: number) => history.push(`/sqllab?queryId=${id}`)}
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
        refreshData={() => {}}
        addDangerToast={addDangerToast}
        addSuccessToast={addSuccessToast}
      />
    </>
  );
}

export default withToasts(QueryList);
