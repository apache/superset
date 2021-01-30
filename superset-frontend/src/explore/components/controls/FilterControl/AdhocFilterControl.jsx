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
import { t, logging, SupersetClient, withTheme } from '@superset-ui/core';

import ControlHeader from 'src/explore/components/ControlHeader';
import adhocMetricType from 'src/explore/components/controls/MetricControl/adhocMetricType';
import savedMetricType from 'src/explore/components/controls/MetricControl/savedMetricType';
import columnType from 'src/explore/propTypes/columnType';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import { OPERATORS } from 'src/explore/constants';
import FilterDefinitionOption from 'src/explore/components/controls/MetricControl/FilterDefinitionOption';
import {
  AddControlLabel,
  AddIconButton,
  HeaderContainer,
  LabelsContainer,
} from 'src/explore/components/OptionControls';
import Icon from 'src/components/Icon';
import AdhocFilterPopoverTrigger from './AdhocFilterPopoverTrigger';
import AdhocFilterOption from './AdhocFilterOption';
import AdhocFilter, { CLAUSES, EXPRESSION_TYPES } from './AdhocFilter';
import adhocFilterType from './adhocFilterType';

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
  isLoading: PropTypes.bool,
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

class AdhocFilterControl extends React.Component {
  constructor(props) {
    super(props);
    this.optionsForSelect = this.optionsForSelect.bind(this);
    this.onRemoveFilter = this.onRemoveFilter.bind(this);
    this.onNewFilter = this.onNewFilter.bind(this);
    this.onFilterEdit = this.onFilterEdit.bind(this);
    this.moveLabel = this.moveLabel.bind(this);
    this.onChange = this.onChange.bind(this);
    this.mapOption = this.mapOption.bind(this);
    this.getMetricExpression = this.getMetricExpression.bind(this);

    const filters = (this.props.value || []).map(filter =>
      isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter,
    );

    this.optionRenderer = option => <FilterDefinitionOption option={option} />;
    this.valueRenderer = (adhocFilter, index) => (
      <AdhocFilterOption
        key={index}
        index={index}
        adhocFilter={adhocFilter}
        onFilterEdit={this.onFilterEdit}
        options={this.state.options}
        datasource={this.props.datasource}
        onRemoveFilter={() => this.onRemoveFilter(index)}
        onMoveLabel={this.moveLabel}
        onDropLabel={() => this.props.onChange(this.state.values)}
        partitionColumn={this.state.partitionColumn}
      />
    );
    this.state = {
      values: filters,
      options: this.optionsForSelect(this.props),
      partitionColumn: null,
    };
  }

  componentDidMount() {
    const { datasource } = this.props;
    if (datasource && datasource.type === 'table') {
      const dbId = datasource.database?.id;
      const {
        datasource_name: name,
        schema,
        is_sqllab_view: isSqllabView,
      } = datasource;

      if (!isSqllabView && dbId && name && schema) {
        SupersetClient.get({
          endpoint: `/superset/extra_table_metadata/${dbId}/${name}/${schema}/`,
        })
          .then(({ json }) => {
            if (json && json.partitions) {
              const { partitions } = json;
              // for now only show latest_partition option
              // when table datasource has only 1 partition key.
              if (
                partitions &&
                partitions.cols &&
                Object.keys(partitions.cols).length === 1
              ) {
                this.setState({ partitionColumn: partitions.cols[0] });
              }
            }
          })
          .catch(error => {
            logging.error('fetch extra_table_metadata:', error.statusText);
          });
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

  onRemoveFilter(index) {
    const valuesCopy = [...this.state.values];
    valuesCopy.splice(index, 1);
    this.setState(prevState => ({
      ...prevState,
      values: valuesCopy,
    }));
    this.props.onChange(valuesCopy);
  }

  onNewFilter(newFilter) {
    const mappedOption = this.mapOption(newFilter);
    if (mappedOption) {
      this.setState(
        prevState => ({
          ...prevState,
          values: [...prevState.values, mappedOption],
        }),
        () => {
          this.props.onChange(this.state.values);
        },
      );
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
    const options = (opts || [])
      .map(option => this.mapOption(option))
      .filter(option => option);
    this.props.onChange(options);
  }

  getMetricExpression(savedMetricName) {
    return this.props.savedMetrics.find(
      savedMetric => savedMetric.metric_name === savedMetricName,
    ).expression;
  }

  moveLabel(dragIndex, hoverIndex) {
    const { values } = this.state;

    const newValues = [...values];
    [newValues[hoverIndex], newValues[dragIndex]] = [
      newValues[dragIndex],
      newValues[hoverIndex],
    ];
    this.setState({ values: newValues });
  }

  mapOption(option) {
    // already a AdhocFilter, skip
    if (option instanceof AdhocFilter) {
      return option;
    }
    // via datasource saved metric
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
    }
    // has a custom label, meaning it's custom column
    if (option.label) {
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
    }
    // add a new filter item
    if (option.column_name) {
      return new AdhocFilter({
        expressionType: EXPRESSION_TYPES.SIMPLE,
        subject: option.column_name,
        operator: OPERATORS['=='],
        comparator: '',
        clause: CLAUSES.WHERE,
        isNew: true,
      });
    }
    return null;
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
            filterOptionName: `_col_${option.column_name}`,
          });
        } else if (option instanceof AdhocMetric) {
          results.push({
            ...option,
            filterOptionName: `_adhocmetric_${option.label}`,
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

  addNewFilterPopoverTrigger(trigger) {
    return (
      <AdhocFilterPopoverTrigger
        adhocFilter={new AdhocFilter({})}
        datasource={this.props.datasource}
        options={this.state.options}
        onFilterEdit={this.onNewFilter}
        partitionColumn={this.state.partitionColumn}
        createNew
      >
        {trigger}
      </AdhocFilterPopoverTrigger>
    );
  }

  render() {
    const { theme } = this.props;
    return (
      <div className="metrics-select" data-test="adhoc-filter-control">
        <HeaderContainer>
          <ControlHeader {...this.props} />
          {this.addNewFilterPopoverTrigger(
            <AddIconButton data-test="add-filter-button">
              <Icon
                name="plus-large"
                width={theme.gridUnit * 3}
                height={theme.gridUnit * 3}
                color={theme.colors.grayscale.light5}
              />
            </AddIconButton>,
          )}
        </HeaderContainer>
        <LabelsContainer>
          {this.state.values.length > 0
            ? this.state.values.map((value, index) =>
                this.valueRenderer(value, index),
              )
            : this.addNewFilterPopoverTrigger(
                <AddControlLabel>
                  <Icon
                    name="plus-small"
                    color={theme.colors.grayscale.light1}
                  />
                  {t('Add filter')}
                </AddControlLabel>,
              )}
        </LabelsContainer>
      </div>
    );
  }
}

AdhocFilterControl.propTypes = propTypes;
AdhocFilterControl.defaultProps = defaultProps;

export default withTheme(AdhocFilterControl);
