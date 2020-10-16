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
import { ProgressBar, Well } from 'react-bootstrap';
import Label from 'src/components/Label';
import { t } from '@superset-ui/core';

import TableView from 'src/components/TableView';
import Button from 'src/components/Button';
import { fDuration } from 'src/modules/dates';
import Link from '../../components/Link';
import ResultSet from './ResultSet';
import ModalTrigger from '../../components/ModalTrigger';
import HighlightedSql from './HighlightedSql';
import QueryStateLabel from './QueryStateLabel';

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
  const columns = useMemo(
    () =>
      props.columns.map(column => ({
        accessor: column,
        Header: column,
        disableSortBy: true,
      })),
    [props.columns],
  );

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
          <div style={{ width: '100px' }}>
            <Button
              buttonSize="small"
              buttonStyle="link"
              onClick={() => openQuery(q.queryId)}
            >
              <i className="fa fa-external-link m-r-3" />
              {t('Edit')}
            </Button>
          </div>
        );
        q.sql = (
          <Well>
            <HighlightedSql
              sql={q.sql}
              rawSql={q.executedSql}
              shrink
              maxWidth={60}
            />
          </Well>
        );
        if (q.resultsKey) {
          q.output = (
            <ModalTrigger
              bsSize="large"
              className="ResultsModal"
              triggerNode={
                <Label bsStyle="info" className="pointer">
                  {t('view results')}
                </Label>
              }
              modalTitle={t('Data preview')}
              beforeOpen={() => openAsyncResults(query, props.displayLimit)}
              onExit={() => clearQueryResults(query)}
              modalBody={
                <ResultSet
                  showSql
                  query={query}
                  actions={props.actions}
                  height={400}
                  displayLimit={props.displayLimit}
                />
              }
            />
          );
        } else {
          // if query was run using ctas and force_ctas_schema was set
          // tempTable will have the schema
          const schemaUsed =
            q.ctas && q.tempTable && q.tempTable.includes('.') ? '' : q.schema;
          q.output = [schemaUsed, q.tempTable].filter(v => v).join('.');
        }
        q.progress = (
          <ProgressBar
            style={{ width: '75px' }}
            striped
            now={q.progress}
            label={`${q.progress.toFixed(0)}%`}
          />
        );
        let errorTooltip;
        if (q.errorMessage) {
          errorTooltip = (
            <Link tooltip={q.errorMessage}>
              <i className="fa fa-exclamation-circle text-danger" />
            </Link>
          );
        }
        q.state = (
          <div>
            <QueryStateLabel query={query} />
            {errorTooltip}
          </div>
        );
        q.actions = (
          <div style={{ width: '75px' }}>
            <Link
              className="fa fa-pencil m-r-3"
              onClick={() => restoreSql(query)}
              tooltip={t(
                'Overwrite text in the editor with a query on this table',
              )}
              placement="top"
            />
            <Link
              className="fa fa-plus-circle m-r-3"
              onClick={() => openQueryInNewTab(query)}
              tooltip={t('Run query in a new tab')}
              placement="top"
            />
            <Link
              className="fa fa-trash m-r-3"
              tooltip={t('Remove query from log')}
              onClick={() => removeQuery(query)}
            />
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
