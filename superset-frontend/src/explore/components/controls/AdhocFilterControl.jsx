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
import VirtualizedSelect from 'react-virtualized-select';

import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import ControlHeader from '../ControlHeader';
import adhocFilterType from '../../propTypes/adhocFilterType';
import adhocMetricType from '../../propTypes/adhocMetricType';
import savedMetricType from '../../propTypes/savedMetricType';
import columnType from '../../propTypes/columnType';
import AdhocFilter, { CLAUSES, EXPRESSION_TYPES } from '../../AdhocFilter';
import AdhocMetric from '../../AdhocMetric';
import { OPERATORS } from '../../constants';
import VirtualizedRendererWrap from '../../../components/VirtualizedRendererWrap';
import OnPasteSelect from '../../../components/OnPasteSelect';
import AdhocFilterOption from '../AdhocFilterOption';
import FilterDefinitionOption from '../FilterDefinitionOption';

const propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  value: PropTypes.arrayOf(adhocFilterType),
  datasource: PropTypes.object,
  columns: PropTypes.arrayOf(columnType),
  savedMetrics: PropTypes.arrayOf(savedMetricType),
  formData: PropTypes.shape({
    metric: PropTypes.oneOfType([PropTypes.string, adhocMetricType]),
    metrics: PropTypes.arrayOf(
      PropTypes.oneOfType([PropTypes.string, adhocMetricType]),
    ),
  }),
};

const defaultProps = {
  name: '',
  onChange: () => {},
  columns: [],
  savedMetrics: [],
  formData: {},
};

function isDictionaryForAdhocFilter(value) {
  return value && !(value instanceof AdhocFilter) && value.expressionType;
}

export default class AdhocFilterControl extends React.Component {
  constructor(props) {
    super(props);
    this.optionsForSelect = this.optionsForSelect.bind(this);
    this.onFilterEdit = this.onFilterEdit.bind(this);
    this.onChange = this.onChange.bind(this);
    this.getMetricExpression = this.getMetricExpression.bind(this);

    const filters = (this.props.value || []).map(filter =>
      isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter,
    );

    this.optionRenderer = VirtualizedRendererWrap(option => (
      <FilterDefinitionOption option={option} />
    ));
    this.valueRenderer = adhocFilter => (
      <AdhocFilterOption
        adhocFilter={adhocFilter}
        onFilterEdit={this.onFilterEdit}
        options={this.state.options}
        datasource={this.props.datasource}
      />
    );
    this.state = {
      values: filters,
      options: this.optionsForSelect(this.props),
    };
  }

  componentDidMount() {
    const { datasource } = this.props;
    if (datasource && datasource.type === 'table') {
      const dbId = datasource.database ? datasource.database.id : null;
      const datasourceName = datasource.datasource_name;
      const datasourceSchema = datasource.schema;

      if (dbId && datasourceName && datasourceSchema) {
        SupersetClient.get({
          endpoint: `/superset/extra_table_metadata/${dbId}/${datasourceName}/${datasourceSchema}/`,
        }).then(
          ({ json }) => {
            if (json && json.partitions) {
              const partitions = json.partitions;
              // for now only show latest_partition option
              // when table datasource has only 1 partition key.
              if (
                partitions &&
                partitions.cols &&
                Object.keys(partitions.cols).length === 1
              ) {
                const partitionColumn = partitions.cols[0];
                this.valueRenderer = adhocFilter => (
                  <AdhocFilterOption
                    adhocFilter={adhocFilter}
                    onFilterEdit={this.onFilterEdit}
                    options={this.state.options}
                    datasource={this.props.datasource}
                    partitionColumn={partitionColumn}
                  />
                );
              }
            }
          },
          // no error handler, in case of error do not show partition option
        );
      }
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (
      this.props.columns !== nextProps.columns ||
      this.props.formData !== nextProps.formData
    ) {
      this.setState({ options: this.optionsForSelect(nextProps) });
    }
    if (this.props.value !== nextProps.value) {
      this.setState({
        values: (nextProps.value || []).map(filter =>
          isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter,
        ),
      });
    }
  }

  onFilterEdit(changedFilter) {
    this.props.onChange(
      this.state.values.map(value => {
        if (value.filterOptionName === changedFilter.filterOptionName) {
          return changedFilter;
        }
        return value;
      }),
    );
  }

  onChange(opts) {
    this.props.onChange(
      opts
        .map(option => {
          if (option.saved_metric_name) {
            return new AdhocFilter({
              expressionType:
                this.props.datasource.type === 'druid'
                  ? EXPRESSION_TYPES.SIMPLE
                  : EXPRESSION_TYPES.SQL,
              subject:
                this.props.datasource.type === 'druid'
                  ? option.saved_metric_name
                  : this.getMetricExpression(option.saved_metric_name),
              operator: OPERATORS['>'],
              comparator: 0,
              clause: CLAUSES.HAVING,
            });
          } else if (option.label) {
            return new AdhocFilter({
              expressionType:
                this.props.datasource.type === 'druid'
                  ? EXPRESSION_TYPES.SIMPLE
                  : EXPRESSION_TYPES.SQL,
              subject:
                this.props.datasource.type === 'druid'
                  ? option.label
                  : new AdhocMetric(option).translateToSql(),
              operator: OPERATORS['>'],
              comparator: 0,
              clause: CLAUSES.HAVING,
            });
          } else if (option.column_name) {
            return new AdhocFilter({
              expressionType: EXPRESSION_TYPES.SIMPLE,
              subject: option.column_name,
              operator: OPERATORS['=='],
              comparator: '',
              clause: CLAUSES.WHERE,
            });
          } else if (option instanceof AdhocFilter) {
            return option;
          }
          return null;
        })
        .filter(option => option),
    );
  }

  getMetricExpression(savedMetricName) {
    return this.props.savedMetrics.find(
      savedMetric => savedMetric.metric_name === savedMetricName,
    ).expression;
  }

  optionsForSelect(props) {
    const options = [
      ...props.columns,
      ...[...(props.formData.metrics || []), props.formData.metric].map(
        metric =>
          metric &&
          (typeof metric === 'string'
            ? { saved_metric_name: metric }
            : new AdhocMetric(metric)),
      ),
    ].filter(option => option);

    return options
      .reduce((results, option) => {
        if (option.saved_metric_name) {
          results.push({
            ...option,
            filterOptionName: option.saved_metric_name,
          });
        } else if (option.column_name) {
          results.push({
            ...option,
            filterOptionName: '_col_' + option.column_name,
          });
        } else if (option instanceof AdhocMetric) {
          results.push({
            ...option,
            filterOptionName: '_adhocmetric_' + option.label,
          });
        }
        return results;
      }, [])
      .sort((a, b) =>
        (a.saved_metric_name || a.column_name || a.label).localeCompare(
          b.saved_metric_name || b.column_name || b.label,
        ),
      );
  }

  render() {
    return (
      <div className="metrics-select">
        <ControlHeader {...this.props} />
        <OnPasteSelect
          multi
          name={`select-${this.props.name}`}
          placeholder={t('choose a column or metric')}
          options={this.state.options}
          value={this.state.values}
          labelKey="label"
          valueKey="filterOptionName"
          clearable
          closeOnSelect
          onChange={this.onChange}
          optionRenderer={this.optionRenderer}
          valueRenderer={this.valueRenderer}
          selectWrap={VirtualizedSelect}
        />
      </div>
    );
  }
}

AdhocFilterControl.propTypes = propTypes;
AdhocFilterControl.defaultProps = defaultProps;
