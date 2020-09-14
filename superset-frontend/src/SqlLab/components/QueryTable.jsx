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
import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { Table } from 'reactable-arc';
import { ProgressBar, Well } from 'react-bootstrap';
import Label from 'src/components/Label';
import { t } from '@superset-ui/core';

import Button from 'src/components/Button';
import Link from '../../components/Link';
import ResultSet from './ResultSet';
import ModalTrigger from '../../components/ModalTrigger';
import HighlightedSql from './HighlightedSql';
import { fDuration } from '../../modules/dates';
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

class QueryTable extends React.PureComponent {
  openQuery(id) {
    const url = `/superset/sqllab?queryId=${id}`;
    window.open(url);
  }

  restoreSql(query) {
    this.props.actions.queryEditorSetSql({ id: query.sqlEditorId }, query.sql);
  }

  openQueryInNewTab(query) {
    this.props.actions.cloneQueryToNewTab(query, true);
  }

  openAsyncResults(query, displayLimit) {
    this.props.actions.fetchQueryResults(query, displayLimit);
  }

  clearQueryResults(query) {
    this.props.actions.clearQueryResults(query);
  }

  removeQuery(query) {
    this.props.actions.removeQuery(query);
  }

  render() {
    const data = this.props.queries
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
            onClick={this.props.onUserClicked.bind(this, q.userId)}
          >
            {q.user}
          </Button>
        );
        q.db = (
          <Button
            buttonSize="small"
            buttonStyle="link"
            onClick={this.props.onDbClicked.bind(this, q.dbId)}
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
              onClick={this.openQuery.bind(this, q.queryId)}
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
              beforeOpen={this.openAsyncResults.bind(
                this,
                query,
                this.props.displayLimit,
              )}
              onExit={this.clearQueryResults.bind(this, query)}
              modalBody={
                <ResultSet
                  showSql
                  query={query}
                  actions={this.props.actions}
                  height={400}
                  displayLimit={this.props.displayLimit}
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
              onClick={this.restoreSql.bind(this, query)}
              tooltip={t(
                'Overwrite text in the editor with a query on this table',
              )}
              placement="top"
            />
            <Link
              className="fa fa-plus-circle m-r-3"
              onClick={this.openQueryInNewTab.bind(this, query)}
              tooltip={t('Run query in a new tab')}
              placement="top"
            />
            <Link
              className="fa fa-trash m-r-3"
              tooltip={t('Remove query from log')}
              onClick={this.removeQuery.bind(this, query)}
            />
          </div>
        );
        return q;
      })
      .reverse();
    return (
      <div className="QueryTable">
        <Table
          columns={this.props.columns}
          className="table table-condensed"
          data={data}
          itemsPerPage={50}
        />
      </div>
    );
  }
}
QueryTable.propTypes = propTypes;
QueryTable.defaultProps = defaultProps;

export default QueryTable;
