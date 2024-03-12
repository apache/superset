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
import moment from 'moment';
import Card from 'src/components/Card';
import ProgressBar from 'src/components/ProgressBar';
import Label from 'src/components/Label';
import { t, useTheme, QueryResponse } from '@superset-ui/core';
import { useDispatch, useSelector } from 'react-redux';

import {
  queryEditorSetSql,
  cloneQueryToNewTab,
  fetchQueryResults,
  clearQueryResults,
  removeQuery,
} from 'src/SqlLab/actions/sqlLab';
import TableView from 'src/components/TableView';
import Button from 'src/components/Button';
import { fDuration } from 'src/utils/dates';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import { SqlLabRootState } from 'src/SqlLab/types';
import ModalTrigger from 'src/components/ModalTrigger';
import { UserWithPermissionsAndRoles as User } from 'src/types/bootstrapTypes';
import ResultSet from '../ResultSet';
import HighlightedSql from '../HighlightedSql';
import { StaticPosition, verticalAlign, StyledTooltip } from './styles';

interface QueryTableQuery
  extends Omit<QueryResponse, 'state' | 'sql' | 'progress' | 'results'> {
  state?: Record<string, any>;
  sql?: Record<string, any>;
  progress?: Record<string, any>;
  results?: Record<string, any>;
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
          QUERY_HISTORY_TABLE_HEADERS_LOCALIZED[column] || setHeaders(column),
        disableSortBy: true,
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
          icon: <Icons.Check iconColor={theme.colors.success.base} />,
          label: t('Success'),
        },
      },
      failed: {
        config: {
          icon: <Icons.XSmall iconColor={theme.colors.error.base} />,
          label: t('Failed'),
        },
      },
      stopped: {
        config: {
          icon: <Icons.XSmall iconColor={theme.colors.error.base} />,
          label: t('Failed'),
        },
      },
      running: {
        config: {
          icon: <Icons.Running iconColor={theme.colors.primary.base} />,
          label: t('Running'),
        },
      },
      fetching: {
        config: {
          icon: <Icons.Queued iconColor={theme.colors.primary.base} />,
          label: t('Fetching'),
        },
      },
      timed_out: {
        config: {
          icon: <Icons.Offline iconColor={theme.colors.grayscale.light1} />,
          label: t('Offline'),
        },
      },
      scheduled: {
        config: {
          icon: <Icons.Queued iconColor={theme.colors.grayscale.base} />,
          label: t('Scheduled'),
        },
      },
      pending: {
        config: {
          icon: <Icons.Queued iconColor={theme.colors.grayscale.base} />,
          label: t('Scheduled'),
        },
      },
      error: {
        config: {
          icon: <Icons.Error iconColor={theme.colors.error.base} />,
          label: t('Unknown Status'),
        },
      },
    };

    return queries
      .map(query => {
        const { state, sql, progress, ...rest } = query;
        const q = rest as QueryTableQuery;

        const status = statusAttributes[state] || statusAttributes.error;

        if (q.endDttm) {
          q.duration = fDuration(q.startDttm, q.endDttm);
        }
        const time = moment(q.startDttm).format().split('T');
        q.time = (
          <div>
            <span>
              {time[0]} <br /> {time[1]}
            </span>
          </div>
        );
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
        q.started = moment(q.startDttm).format('L HH:mm:ss');
        q.querylink = (
          <Button
            buttonSize="small"
            buttonStyle="link"
            onClick={() => openQuery(q.queryId)}
          >
            <i className="fa fa-external-link m-r-3" />
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
                <Label type="info" className="pointer">
                  {t('View')}
                </Label>
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
          <Tooltip title={status.config.label} placement="bottom">
            <span>{status.config.icon}</span>
          </Tooltip>
        );
        q.actions = (
          <div>
            <StyledTooltip
              onClick={() => restoreSql(query)}
              tooltip={t(
                'Overwrite text in the editor with a query on this table',
              )}
              placement="top"
            >
              <Icons.Edit iconSize="xl" />
            </StyledTooltip>
            <StyledTooltip
              onClick={() => openQueryInNewTab(query)}
              tooltip={t('Run query in a new tab')}
              placement="top"
            >
              <Icons.PlusCircleOutlined iconSize="xl" css={verticalAlign} />
            </StyledTooltip>
            {q.id !== latestQueryId && (
              <StyledTooltip
                tooltip={t('Remove query from log')}
                onClick={() => dispatch(removeQuery(query))}
              >
                <Icons.Trash iconSize="xl" />
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
