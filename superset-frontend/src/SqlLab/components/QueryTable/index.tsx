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
import { t, useTheme } from '@superset-ui/core';
import { useSelector } from 'react-redux';
import TableView from 'src/components/TableView';
import Button from 'src/components/Button';
import { fDuration } from 'src/modules/dates';
import Icons from 'src/components/Icons';
import { Tooltip } from 'src/components/Tooltip';
import { Query } from 'src/SqlLab/types';
import ResultSet from '../ResultSet';
import ModalTrigger from '../../../components/ModalTrigger';
import HighlightedSql from '../HighlightedSql';
import { StaticPosition, verticalAlign, StyledTooltip } from './styles';

// query's type is original Query; Shallow-copy of query, q's type is QueryTableQuery. So that prop, sql passed to another component will remain string, the type of original Query
interface QueryTableQueryTemp1 extends Omit<Query, 'sql'> {
  sql: string | Record<string, any>;
}

interface QueryTableQueryTemp2 extends Omit<QueryTableQueryTemp1, 'progress'> {
  progress: number | Record<string, any>;
}

interface QueryTableQuery extends Omit<QueryTableQueryTemp2, 'state'> {
  state: string | Record<string, any>;
}

interface QueryTableProps {
  columns: Array<string>;
  actions: Record<string, any>;
  queries: Query[];
  onUserClicked?: Function;
  onDbClicked?: Function;
  displayLimit: number;
}

const openQuery = (id: number) => {
  const url = `/superset/sqllab?queryId=${id}`;
  window.open(url);
};

const QueryTable = ({
  columns = ['started', 'duration', 'rows'],
  actions,
  queries = [],
  onUserClicked = () => undefined,
  onDbClicked = () => undefined,
  displayLimit = Infinity,
}: QueryTableProps) => {
  const theme = useTheme();

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
        Header: () => setHeaders(column),
        disableSortBy: true,
      })),
    [columns],
  );

  const user = useSelector((state: any) => state.sqlLab.user);

  const data = useMemo(() => {
    const restoreSql = (query: Record<string, any>) => {
      actions?.queryEditorSetSql({ id: query.sqlEditorId }, query.sql);
    };

    const openQueryInNewTab = (query: Record<string, any>) => {
      actions?.cloneQueryToNewTab(query, true);
    };

    const openAsyncResults = (
      query: Record<string, any>,
      displayLimit: number,
    ) => {
      actions?.fetchQueryResults(query, displayLimit);
    };

    const clearQueryResults = (query: Record<string, any>) => {
      actions?.clearQueryResults(query);
    };

    const removeQuery = (query: Record<string, any>) => {
      actions?.removeQuery(query);
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
          label: t('fetching'),
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
        // query's type is original Query; Shallow-copy of query, q's type is QueryTableQuery. So that prop, sql passed to another component will remain string, the type of original Query
        const q: QueryTableQuery = { ...query };
        let status: any;
        if (typeof q.state === 'string') {
          status = statusAttributes[q.state] || statusAttributes.error;
        }

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
        q.started = moment(q.startDttm).format('HH:mm:ss');
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
              sql={query.sql}
              rawSql={q.executedSql}
              shrink
              maxWidth={60}
            />
          </Card>
        );
        if (q.resultsKey) {
          q.output = (
            <ModalTrigger
              className="ResultsModal"
              triggerNode={
                <Label type="info" className="pointer">
                  {t('View results')}
                </Label>
              }
              modalTitle={t('Data preview')}
              beforeOpen={() => openAsyncResults(query, displayLimit)}
              onExit={() => clearQueryResults(query)}
              modalBody={
                <ResultSet
                  showSql
                  user={user}
                  query={query}
                  actions={actions}
                  height={400}
                  displayLimit={displayLimit}
                />
              }
              responsive
            />
          );
        } else {
          // if query was run using ctas and force_ctas_schema was set
          // tempTable will have the schema
          const schemaUsed =
            q.ctas && q.tempTable && q.tempTable.includes('.') ? '' : q.schema;
          q.output = [schemaUsed, q.tempTable].filter(v => v).join('.');
        }
        q.progress =
          q.state === 'success' ? (
            <ProgressBar
              percent={parseInt(q.progress.toFixed(0), 10)}
              striped
              showInfo={false}
            />
          ) : (
            <ProgressBar
              percent={parseInt(q.progress.toFixed(0), 10)}
              striped
            />
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
              <Icons.Edit iconSize="s" />
            </StyledTooltip>
            <StyledTooltip
              onClick={() => openQueryInNewTab(query)}
              tooltip={t('Run query in a new tab')}
              placement="top"
            >
              <Icons.PlusCircleOutlined iconSize="s" css={verticalAlign} />
            </StyledTooltip>
            <StyledTooltip
              tooltip={t('Remove query from log')}
              onClick={() => removeQuery(query)}
            >
              <Icons.Trash iconSize="s" />
            </StyledTooltip>
          </div>
        );
        return q;
      })
      .reverse();
  }, [actions, queries, onUserClicked, onDbClicked, displayLimit, user, theme]);

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
