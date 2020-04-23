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
import { FormGroup, Radio } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../AdhocFilter';

const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onChange: PropTypes.func.isRequired,
  datasource: PropTypes.object.isRequired,
  latestPartitions: PropTypes.object.isRequired,
  height: PropTypes.number.isRequired,
};

export default class AdhocFilterEditPopoverPartitionTabContent extends React.Component {
  constructor(props) {
    super(props);
    this.onUseLatestPartitionChange = this.onUseLatestPartitionChange.bind(
      this,
    );
    this.updateSQLExpression = this.updateSQLExpression.bind(this);

    const { adhocFilter } = props;
    let selectedColumn;
    if (adhocFilter && adhocFilter.sqlExpression) {
      const expressionParts = adhocFilter.sqlExpression.split('=');
      if (expressionParts.length >= 2) {
        const expressionBody = expressionParts.slice(1).join('=');
        const pattern = new RegExp(
          /presto\.(latest_partition|latest_sub_partition)/gm,
        );
        if (pattern.test(expressionBody)) {
          selectedColumn = expressionParts[0].trim();
        }
      }
    }

    this.state = {
      selectedColumn,
    };
  }

  onUseLatestPartitionChange(ev) {
    const selectedColumn = ev.target.value;
    this.setState({ selectedColumn }, this.updateSQLExpression);
  }

  getLatestPartition(schema, name) {
    return `{{ presto.latest_partition('${schema}.${name}') }}`;
  }

  getLatestSubPartition(schema, name, filters) {
    return `{{ presto.latest_sub_partition('${schema}.${name}', ${filters}) }}`;
  }

  updateSQLExpression() {
    const { latestPartitions, datasource } = this.props;
    const { selectedColumn } = this.state;
    const columnsCount = Object.keys(latestPartitions).length;
    const datasourceName = datasource.datasource_name;
    const datasourceSchema = datasource.schema;

    let sqlExpression = '';
    if (columnsCount === 1) {
      sqlExpression = `${selectedColumn} = '${this.getLatestPartition(
        datasourceSchema,
        datasourceName,
      )}'`;
    } else if (columnsCount > 1) {
      const filters = Object.keys(latestPartitions)
        .filter(col => col !== selectedColumn)
        .map(col => `${col}=${JSON.stringify(latestPartitions[col])}`)
        .join(', ');

      sqlExpression = `${selectedColumn} = '${this.getLatestSubPartition(
        datasourceSchema,
        datasourceName,
        filters,
      )}'`;
    }

    this.props.onChange(
      this.props.adhocFilter.duplicateWith({
        clause: CLAUSES.WHERE,
        expressionType: EXPRESSION_TYPES.SQL,
        sqlExpression,
      }),
    );
  }

  render() {
    const { latestPartitions } = this.props;
    const { selectedColumn } = this.state;

    return (
      <span>
        <div>{t('Use latest partition for field:')}</div>
        <FormGroup>
          {Object.keys(latestPartitions).map(col => (
            <Radio
              value={col}
              checked={col === selectedColumn}
              onChange={this.onUseLatestPartitionChange}
            >
              {col}
            </Radio>
          ))}
        </FormGroup>
      </span>
    );
  }
}
AdhocFilterEditPopoverPartitionTabContent.propTypes = propTypes;
