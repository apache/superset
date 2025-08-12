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
import { useMemo, ReactNode } from 'react';
import {
  Card,
  Button,
  Tooltip,
  Label,
  Icons,
  ModalTrigger,
  TableView,
} from '@superset-ui/core/components';
import ProgressBar from '@superset-ui/core/components/ProgressBar';
import { t, useTheme, QueryResponse } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';

import {
  queryEditorSetSql,
  cloneQueryToNewTab,
  fetchQueryResults,
  clearQueryResults,
  removeQuery,
} from 'src/SqlLab/actions/sqlLab';
import { fDuration, extendedDayjs } from '@superset-ui/core/utils/dates';
import { SqlLabRootState } from 'src/SqlLab/types';
import { UserWithPermissionsAndRoles as User } from 'src/types/bootstrapTypes';
import ResultSet from '../ResultSet';
import HighlightedSql from '../HighlightedSql';
import { StaticPosition, StyledTooltip } from './styles';

interface QueryTableQuery
  extends Omit<
    QueryResponse,
    'state' | 'sql' | 'progress' | 'results' | 'duration' | 'started'
  > {
  state?: Record<string, any>;
  sql?: Record<string, any>;
  progress?: Record<string, any>;
  results?: Record<string, any>;
  duration?: ReactNode;
  started?: ReactNode;
}

interface QueryTableProps {
  columns?: string[];
  queries?: QueryResponse[];
  onUserClicked?: Function;
  onDbClicked?: Function;
  displayLimit: number;
  latestQueryId?: string | undefined;
}

const openQuery = (id: number) => {
  const url = `/sqllab?queryId=${id}`;
  window.open(url);
};

const QueryTable = ({
  columns = ['started', 'duration', 'rows'],
  queries = [],
  onUserClicked = () => undefined,
  onDbClicked = () => undefined,
  displayLimit,
  latestQueryId,
}: QueryTableProps) => {
  const theme = useTheme();
  const dispatch = useDispatch();

  const QUERY_HISTORY_TABLE_HEADERS_LOCALIZED = {
    state: t('State'),
    started: t('Started'),
    duration: t('Duration'),
    progress: t('Progress'),
    rows: t('Rows'),
    sql: t('SQL'),
    results: t('Results'),
    actions: t('Actions'),
  };

  const setHeaders = (column: string) => {
    if (column === 'sql') {
      return column.toUpperCase();
    }
    return column.charAt(0).toUpperCase().concat(column.slice(1));
  };

  const columnsOfTable = useMemo(
    () =>
      columns.map(column => ({
        accessor: column,
        Header:
          QUERY_HISTORY_TABLE_HEADERS_LOCALIZED[
            column as keyof typeof QUERY_HISTORY_TABLE_HEADERS_LOCALIZED
          ] || setHeaders(column),
        disableSortBy: true,
        id: column,
      })),
    [columns],
  );

  const user = useSelector<SqlLabRootState, User>(state => state.user);

  const data = useMemo(() => {
    const restoreSql = (query: QueryResponse) => {
      dispatch(
        queryEditorSetSql({ id: query.sqlEditorId }, query.sql, query.id),
      );
    };

    const openQueryInNewTab = (query: QueryResponse) => {
      dispatch(cloneQueryToNewTab(query, true));
    };

    const openAsyncResults = (query: QueryResponse, displayLimit: number) => {
      dispatch(fetchQueryResults(query, displayLimit));
    };

    const statusAttributes = {
      success: {
        config: {
          icon: (
            <Icons.CheckOutlined iconColor={theme.colorSuccess} iconSize="m" />
          ),
          // icon: <Icons.Edit iconSize="xl" />,
          label: t('Success'),
        },
      },
      failed: {
        config: {
          icon: (
            <Icons.CloseOutlined iconColor={theme.colorError} iconSize="m" />
          ),
          label: t('Failed'),
        },
      },
      stopped: {
        config: {
          icon: (
            <Icons.CloseOutlined iconColor={theme.colorError} iconSize="m" />
          ),
          label: t('Failed'),
        },
      },
      running: {
        config: {
          icon: (
            <Icons.LoadingOutlined
              iconColor={theme.colorPrimary}
              iconSize="m"
            />
          ),
          label: t('Running'),
        },
      },
      fetching: {
        config: {
          icon: (
            <Icons.LoadingOutlined
              iconColor={theme.colorPrimary}
              iconSize="m"
            />
          ),
          label: t('Fetching'),
        },
      },
      timed_out: {
        config: {
          icon: (
            <Icons.ClockCircleOutlined
              iconColor={theme.colorError}
              iconSize="m"
            />
          ),
          label: t('Offline'),
        },
      },
      scheduled: {
        config: {
          icon: (
            <Icons.LoadingOutlined
              iconColor={theme.colorWarning}
              iconSize="m"
            />
          ),
          label: t('Scheduled'),
        },
      },
      pending: {
        config: {
          icon: (
            <Icons.LoadingOutlined
              iconColor={theme.colorWarning}
              iconSize="m"
            />
          ),
          label: t('Scheduled'),
        },
      },
      error: {
        config: {
          icon: <Icons.Error iconColor={theme.colorError} iconSize="m" />,
          label: t('Unknown Status'),
        },
      },
      started: {
        config: {
          icon: (
            <Icons.LoadingOutlined
              iconColor={theme.colorPrimary}
              iconSize="m"
            />
          ),
          label: t('Started'),
        },
      },
    };

    return queries
      .map(query => {
        const { state, sql, progress, ...rest } = query;
        const q = rest as QueryTableQuery;

        const status = statusAttributes[state] || statusAttributes.error;

        if (q.endDttm) {
          q.duration = (
            <Label monospace>{fDuration(q.startDttm, q.endDttm)}</Label>
          );
        }
        q.user = (
          <Button
            buttonSize="small"
            buttonStyle="link"
            onClick={() => onUserClicked(q.userId)}
          >
            {q.user}
          </Button>
        );
        q.db = (
          <Button
            buttonSize="small"
            buttonStyle="link"
            onClick={() => onDbClicked(q.dbId)}
          >
            {q.db}
          </Button>
        );
        q.started = (
          <Label monospace>
            {extendedDayjs(q.startDttm).format('L HH:mm:ss')}
          </Label>
        );
        q.querylink = (
          <Button
            buttonSize="small"
            buttonStyle="link"
            onClick={() => openQuery(q.queryId)}
          >
            <Icons.Full iconSize="m" iconColor={theme.colorPrimary} />
            {t('Edit')}
          </Button>
        );
        q.sql = (
          <Card css={[StaticPosition]}>
            <HighlightedSql
              sql={sql}
              rawSql={q.executedSql}
              shrink
              maxWidth={60}
            />
          </Card>
        );
        if (q.resultsKey) {
          q.results = (
            <ModalTrigger
              className="ResultsModal"
              triggerNode={
                <Button buttonSize="xsmall" buttonStyle="secondary">
                  {t('View')}
                </Button>
              }
              modalTitle={t('Data preview')}
              beforeOpen={() => openAsyncResults(query, displayLimit)}
              onExit={() => dispatch(clearQueryResults(query))}
              modalBody={
                <ResultSet
                  showSql
                  queryId={query.id}
                  height={400}
                  displayLimit={displayLimit}
                  defaultQueryLimit={1000}
                />
              }
              responsive
            />
          );
        } else {
          q.results = <></>;
        }

        q.progress =
          state === 'success' ? (
            <ProgressBar
              percent={parseInt(progress.toFixed(0), 10)}
              striped
              showInfo={false}
            />
          ) : (
            <ProgressBar percent={parseInt(progress.toFixed(0), 10)} striped />
          );
        q.state = (
          <Tooltip title={status.config.label}>{status.config.icon}</Tooltip>
        );
        q.actions = (
          <div>
            <StyledTooltip
              onClick={() => restoreSql(query)}
              tooltip={t(
                'Overwrite text in the editor with a query on this table',
              )}
              placement="top"
              className="pointer"
            >
              <Icons.EditOutlined iconSize="l" />
            </StyledTooltip>
            <StyledTooltip
              onClick={() => openQueryInNewTab(query)}
              tooltip={t('Run query in a new tab')}
              placement="top"
              className="pointer"
            >
              <Icons.PlusCircleOutlined iconSize="l" />
            </StyledTooltip>
            {q.id !== latestQueryId && (
              <StyledTooltip
                tooltip={t('Remove query from log')}
                onClick={() => dispatch(removeQuery(query))}
                className="pointer"
              >
                <Icons.DeleteOutlined iconSize="l" />
              </StyledTooltip>
            )}
          </div>
        );
        return q;
      })
      .reverse();
  }, [queries, onUserClicked, onDbClicked, user, displayLimit]);

  return (
    <div className="QueryTable">
      <TableView
        columns={columnsOfTable}
        data={data}
        className="table-condensed"
        pageSize={50}
      />
    </div>
  );
};

export default QueryTable;
