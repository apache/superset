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
import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import Alert from 'src/components/Alert';
import { t } from '@superset-ui/core';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import shortid from 'shortid';
import Button from 'src/components/Button';
import * as actions from 'src/SqlLab/actions/sqlLab';

const propTypes = {
  actions: PropTypes.object.isRequired,
  query: PropTypes.object,
  errorMessage: PropTypes.string,
  timeout: PropTypes.number,
  database: PropTypes.object.isRequired,
  onClick: PropTypes.func.isRequired,
};
const defaultProps = {
  query: {},
};

class ExploreResultsButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.getInvalidColumns = this.getInvalidColumns.bind(this);
    this.renderInvalidColumnMessage =
      this.renderInvalidColumnMessage.bind(this);
  }

  getColumns() {
    const { props } = this;
    if (
      props.query &&
      props.query.results &&
      props.query.results.selected_columns
    ) {
      return props.query.results.selected_columns;
    }
    return [];
  }

  getQueryDuration() {
    return moment
      .duration(this.props.query.endDttm - this.props.query.startDttm)
      .asSeconds();
  }

  getInvalidColumns() {
    const re1 = /__\d+$/; // duplicate column name pattern
    const re2 = /^__timestamp/i; // reserved temporal column alias

    return this.props.query.results.selected_columns
      .map(col => col.name)
      .filter(col => re1.test(col) || re2.test(col));
  }

  datasourceName() {
    const { query } = this.props;
    const uniqueId = shortid.generate();
    let datasourceName = uniqueId;
    if (query) {
      datasourceName = query.user ? `${query.user}-` : '';
      datasourceName += `${query.tab}-${uniqueId}`;
    }
    return datasourceName;
  }

  buildVizOptions() {
    const { schema, sql, dbId, templateParams } = this.props.query;
    return {
      dbId,
      schema,
      sql,
      templateParams,
      datasourceName: this.datasourceName(),
      columns: this.getColumns(),
    };
  }

  renderTimeoutWarning() {
    return (
      <Alert
        type="warning"
        message={
          <>
            {t(
              'This query took %s seconds to run, ',
              Math.round(this.getQueryDuration()),
            ) +
              t(
                'and the explore view times out at %s seconds ',
                this.props.timeout,
              ) +
              t(
                'following this flow will most likely lead to your query timing out. ',
              ) +
              t(
                'We recommend your summarize your data further before following that flow. ',
              ) +
              t('If activated you can use the ')}
            <strong>CREATE TABLE AS </strong>
            {t(
              'feature to store a summarized data set that you can then explore.',
            )}
          </>
        }
      />
    );
  }

  renderInvalidColumnMessage() {
    const invalidColumns = this.getInvalidColumns();
    if (invalidColumns.length === 0) {
      return null;
    }
    return (
      <div>
        {t('Column name(s) ')}
        <code>
          <strong>{invalidColumns.join(', ')} </strong>
        </code>
        {t(`cannot be used as a column name. The column name/alias "__timestamp"
          is reserved for the main temporal expression, and column aliases ending with
          double underscores followed by a numeric value (e.g. "my_col__1") are reserved
          for deduplicating duplicate column names. Please use aliases to rename the
          invalid column names.`)}
      </div>
    );
  }

  render() {
    const allowsSubquery =
      this.props.database && this.props.database.allows_subquery;
    return (
      <>
        <Button
          buttonSize="small"
          onClick={this.props.onClick}
          disabled={!allowsSubquery}
          tooltip={t('Explore the result set in the data exploration view')}
        >
          <InfoTooltipWithTrigger
            icon="line-chart"
            placement="top"
            label="explore"
          />{' '}
          {t('Explore')}
        </Button>
      </>
    );
  }
}
ExploreResultsButton.propTypes = propTypes;
ExploreResultsButton.defaultProps = defaultProps;

function mapStateToProps({ sqlLab, common }) {
  return {
    errorMessage: sqlLab.errorMessage,
    timeout: common.conf ? common.conf.SUPERSET_WEBSERVER_TIMEOUT : null,
  };
}

function mapDispatchToProps(dispatch) {
  return {
    actions: bindActionCreators(actions, dispatch),
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(ExploreResultsButton);
