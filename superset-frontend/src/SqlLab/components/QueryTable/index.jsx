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
import PropTypes from 'prop-types';
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
import ResultSet from '../ResultSet';
import ModalTrigger from '../../../components/ModalTrigger';
import HighlightedSql from '../HighlightedSql';
import { StaticPosition, verticalAlign, StyledTooltip } from './styles';

const propTypes = {
  columns: PropTypes.array,
  actions: PropTypes.object,
  queries: PropTypes.array,
  onUserClicked: PropTypes.func,
  onDbClicked: PropTypes.func,
  displayLimit: PropTypes.number.isRequired,
};
const defaultProps = {
  columns: ['started', 'duration', 'rows'],
  queries: [],
  onUserClicked: () => {},
  onDbClicked: () => {},
};

const openQuery = id => {
  const url = `/superset/sqllab?queryId=${id}`;
  window.open(url);
};

const QueryTable = props => {
  const theme = useTheme();
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

  const setHeaders = column => {
    if (column === 'sql') {
      return column.toUpperCase();
    }
    return column.charAt(0).toUpperCase().concat(column.slice(1));
  };
  const columns = useMemo(
    () =>
      props.columns.map(column => ({
        accessor: column,
        Header: () => setHeaders(column),
        disableSortBy: true,
      })),
    [props.columns],
  );

  const user = useSelector(({ sqlLab: { user } }) => user);

  const data = useMemo(() => {
    const restoreSql = query => {
      props.actions.queryEditorSetSql({ id: query.sqlEditorId }, query.sql);
    };

    const openQueryInNewTab = query => {
      props.actions.cloneQueryToNewTab(query, true);
    };

    const openAsyncResults = (query, displayLimit) => {
      props.actions.fetchQueryResults(query, displayLimit);
    };

    const clearQueryResults = query => {
      props.actions.clearQueryResults(query);
    };

    const removeQuery = query => {
      props.actions.removeQuery(query);
    };

    return props.queries
      .map(query => {
        const q = { ...query };
        const status = statusAttributes[q.state] || statusAttributes.error;

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
            onClick={() => props.onUserClicked(q.userId)}
          >
            {q.user}
          </Button>
        );
        q.db = (
          <Button
            buttonSize="small"
            buttonStyle="link"
            onClick={() => props.onDbClicked(q.dbId)}
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
              sql={q.sql}
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
              beforeOpen={() => openAsyncResults(query, props.displayLimit)}
              onExit={() => clearQueryResults(query)}
              modalBody={
                <ResultSet
                  showSql
                  user={user}
                  query={query}
                  actions={props.actions}
                  height={400}
                  displayLimit={props.displayLimit}
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
              <Icons.Edit iconSize="small" />
            </StyledTooltip>
            <StyledTooltip
              onClick={() => openQueryInNewTab(query)}
              tooltip={t('Run query in a new tab')}
              placement="top"
            >
              <Icons.PlusCircleOutlined
                iconSize="x-small"
                css={verticalAlign}
              />
            </StyledTooltip>
            <StyledTooltip
              tooltip={t('Remove query from log')}
              onClick={() => removeQuery(query)}
            >
              <Icons.Trash iconSize="x-small" />
            </StyledTooltip>
          </div>
        );
        return q;
      })
      .reverse();
  }, [props]);

  return (
    <div className="QueryTable">
      <TableView
        columns={columns}
        data={data}
        className="table-condensed"
        pageSize={50}
      />
    </div>
  );
};

QueryTable.propTypes = propTypes;
QueryTable.defaultProps = defaultProps;

export default QueryTable;
