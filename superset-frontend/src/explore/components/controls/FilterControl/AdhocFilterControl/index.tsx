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
import { Component } from 'react';
import PropTypes from 'prop-types';
import {
  t,
  logging,
  SupersetClient,
  withTheme,
  ensureIsArray,
} from '@superset-ui/core';

import ControlHeader from 'src/explore/components/ControlHeader';
import adhocMetricType from 'src/explore/components/controls/MetricControl/adhocMetricType';
import savedMetricType from 'src/explore/components/controls/MetricControl/savedMetricType';
import AdhocMetric from 'src/explore/components/controls/MetricControl/AdhocMetric';
import {
  Operators,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
} from 'src/explore/constants';
import FilterDefinitionOption from 'src/explore/components/controls/MetricControl/FilterDefinitionOption';
import {
  AddControlLabel,
  AddIconButton,
  HeaderContainer,
  LabelsContainer,
} from 'src/explore/components/controls/OptionControls';
import { Icons } from '@superset-ui/core/components/Icons';
import { Modal } from '@superset-ui/core/components';
import AdhocFilterPopoverTrigger from 'src/explore/components/controls/FilterControl/AdhocFilterPopoverTrigger';
import AdhocFilterOption from 'src/explore/components/controls/FilterControl/AdhocFilterOption';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import adhocFilterType from 'src/explore/components/controls/FilterControl/adhocFilterType';
import columnType from 'src/explore/components/controls/FilterControl/columnType';
import { toQueryString } from 'src/utils/urlUtils';
import { Clauses, ExpressionTypes } from '../types';

const { warning } = Modal;

const selectedMetricType = PropTypes.oneOfType([
  PropTypes.string,
  adhocMetricType,
]);

const propTypes = {
  label: PropTypes.oneOfType([PropTypes.object, PropTypes.string]),
  name: PropTypes.string,
  sections: PropTypes.arrayOf(PropTypes.string),
  operators: PropTypes.arrayOf(PropTypes.string),
  onChange: PropTypes.func,
  value: PropTypes.arrayOf(adhocFilterType),
  datasource: PropTypes.object,
  columns: PropTypes.arrayOf(columnType),
  savedMetrics: PropTypes.arrayOf(savedMetricType),
  selectedMetrics: PropTypes.oneOfType([
    selectedMetricType,
    PropTypes.arrayOf(selectedMetricType),
  ]),
  isLoading: PropTypes.bool,
  canDelete: PropTypes.func,
};

const defaultProps = {
  name: '',
  onChange: () => {},
  columns: [],
  savedMetrics: [],
  selectedMetrics: [],
};

function isDictionaryForAdhocFilter(value: $TSFixMe) {
  return value && !(value instanceof AdhocFilter) && value.expressionType;
}

class AdhocFilterControl extends Component {
  optionRenderer: $TSFixMe;

  valueRenderer: $TSFixMe;

  constructor(props: $TSFixMe) {
    super(props);
    this.optionsForSelect = this.optionsForSelect.bind(this);
    this.onRemoveFilter = this.onRemoveFilter.bind(this);
    this.onNewFilter = this.onNewFilter.bind(this);
    this.onFilterEdit = this.onFilterEdit.bind(this);
    this.moveLabel = this.moveLabel.bind(this);
    this.onChange = this.onChange.bind(this);
    this.mapOption = this.mapOption.bind(this);
    this.getMetricExpression = this.getMetricExpression.bind(this);
    this.removeFilter = this.removeFilter.bind(this);

    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
    const filters = (this.props.value || []).map((filter: $TSFixMe) =>
      isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter,
    );

    this.optionRenderer = (option: $TSFixMe) => (
      <FilterDefinitionOption option={option} />
    );
    this.valueRenderer = (adhocFilter: $TSFixMe, index: $TSFixMe) => (
      <AdhocFilterOption
        key={index}
        index={index}
        adhocFilter={adhocFilter}
        // @ts-expect-error TS(2322): Type '(changedFilter: any) => void' is not assigna... Remove this comment to see the full error message
        onFilterEdit={this.onFilterEdit}
        // @ts-expect-error TS(2339): Property 'options' does not exist on type 'Readonl... Remove this comment to see the full error message
        options={this.state.options}
        // @ts-expect-error TS(2339): Property 'sections' does not exist on type 'Readon... Remove this comment to see the full error message
        sections={this.props.sections}
        // @ts-expect-error TS(2339): Property 'operators' does not exist on type 'Reado... Remove this comment to see the full error message
        operators={this.props.operators}
        // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
        datasource={this.props.datasource}
        // @ts-expect-error TS(2322): Type '(e: $TSFixMe) => void' is not assignable to ... Remove this comment to see the full error message
        onRemoveFilter={(e: $TSFixMe) => {
          e.stopPropagation();
          this.onRemoveFilter(index);
        }}
        // @ts-expect-error TS(2322): Type '(dragIndex: any, hoverIndex: any) => void' i... Remove this comment to see the full error message
        onMoveLabel={this.moveLabel}
        // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
        onDropLabel={() => this.props.onChange(this.state.values)}
        // @ts-expect-error TS(2339): Property 'partitionColumn' does not exist on type ... Remove this comment to see the full error message
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
    // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
    const { datasource } = this.props;
    if (datasource && datasource.type === 'table') {
      const dbId = datasource.database?.id;
      const {
        datasource_name: name,
        catalog,
        schema,
        is_sqllab_view: isSqllabView,
      } = datasource;

      if (!isSqllabView && dbId && name && schema) {
        SupersetClient.get({
          endpoint: `/api/v1/database/${dbId}/table_metadata/extra/${toQueryString(
            {
              name,
              catalog,
              schema,
            },
          )}`,
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

  UNSAFE_componentWillReceiveProps(nextProps: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'columns' does not exist on type 'Readonl... Remove this comment to see the full error message
    if (this.props.columns !== nextProps.columns) {
      this.setState({ options: this.optionsForSelect(nextProps) });
    }
    // @ts-expect-error TS(2339): Property 'value' does not exist on type 'Readonly<... Remove this comment to see the full error message
    if (this.props.value !== nextProps.value) {
      this.setState({
        values: (nextProps.value || []).map((filter: $TSFixMe) =>
          isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter,
        ),
      });
    }
  }

  removeFilter(index: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'values' does not exist on type 'Readonly... Remove this comment to see the full error message
    const valuesCopy = [...this.state.values];
    valuesCopy.splice(index, 1);
    this.setState(prevState => ({
      ...prevState,
      values: valuesCopy,
    }));
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(valuesCopy);
  }

  onRemoveFilter(index: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'canDelete' does not exist on type 'Reado... Remove this comment to see the full error message
    const { canDelete } = this.props;
    // @ts-expect-error TS(2339): Property 'values' does not exist on type 'Readonly... Remove this comment to see the full error message
    const { values } = this.state;
    const result = canDelete?.(values[index], values);
    if (typeof result === 'string') {
      warning({ title: t('Warning'), content: result });
      return;
    }
    this.removeFilter(index);
  }

  onNewFilter(newFilter: $TSFixMe) {
    const mappedOption = this.mapOption(newFilter);
    if (mappedOption) {
      this.setState(
        prevState => ({
          ...prevState,
          // @ts-expect-error TS(2339): Property 'values' does not exist on type 'Readonly... Remove this comment to see the full error message
          values: [...prevState.values, mappedOption],
        }),
        () => {
          // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
          this.props.onChange(this.state.values);
        },
      );
    }
  }

  onFilterEdit(changedFilter: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(
      // @ts-expect-error TS(2339): Property 'values' does not exist on type 'Readonly... Remove this comment to see the full error message
      this.state.values.map((value: $TSFixMe) => {
        if (value.filterOptionName === changedFilter.filterOptionName) {
          return changedFilter;
        }
        return value;
      }),
    );
  }

  onChange(opts: $TSFixMe) {
    const options = (opts || [])
      .map((option: $TSFixMe) => this.mapOption(option))
      .filter((option: $TSFixMe) => option);
    // @ts-expect-error TS(2339): Property 'onChange' does not exist on type 'Readon... Remove this comment to see the full error message
    this.props.onChange(options);
  }

  getMetricExpression(savedMetricName: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'savedMetrics' does not exist on type 'Re... Remove this comment to see the full error message
    return this.props.savedMetrics.find(
      (savedMetric: $TSFixMe) => savedMetric.metric_name === savedMetricName,
    ).expression;
  }

  moveLabel(dragIndex: $TSFixMe, hoverIndex: $TSFixMe) {
    // @ts-expect-error TS(2339): Property 'values' does not exist on type 'Readonly... Remove this comment to see the full error message
    const { values } = this.state;

    const newValues = [...values];
    [newValues[hoverIndex], newValues[dragIndex]] = [
      newValues[dragIndex],
      newValues[hoverIndex],
    ];
    this.setState({ values: newValues });
  }

  mapOption(option: $TSFixMe) {
    // already a AdhocFilter, skip
    if (option instanceof AdhocFilter) {
      return option;
    }
    // via datasource saved metric
    if (option.saved_metric_name) {
      return new AdhocFilter({
        expressionType: ExpressionTypes.Sql,
        subject: this.getMetricExpression(option.saved_metric_name),
        operator:
          OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GreaterThan].operation,
        comparator: 0,
        clause: Clauses.Having,
      });
    }
    // has a custom label, meaning it's custom column
    if (option.label) {
      return new AdhocFilter({
        expressionType: ExpressionTypes.Sql,
        subject: new AdhocMetric(option).translateToSql(),
        operator:
          OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GreaterThan].operation,
        comparator: 0,
        clause: Clauses.Having,
      });
    }
    // add a new filter item
    if (option.column_name) {
      return new AdhocFilter({
        expressionType: ExpressionTypes.Simple,
        subject: option.column_name,
        operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.Equals].operation,
        comparator: '',
        clause: Clauses.Where,
        isNew: true,
      });
    }
    return null;
  }

  optionsForSelect(props: $TSFixMe) {
    const options = [
      ...props.columns,
      ...ensureIsArray(props.selectedMetrics).map(
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
      .sort((a: $TSFixMe, b: $TSFixMe) =>
        (a.saved_metric_name || a.column_name || a.label).localeCompare(
          b.saved_metric_name || b.column_name || b.label,
        ),
      );
  }

  addNewFilterPopoverTrigger(trigger: $TSFixMe) {
    return (
      <AdhocFilterPopoverTrigger
        // @ts-expect-error TS(2339): Property 'operators' does not exist on type 'Reado... Remove this comment to see the full error message
        operators={this.props.operators}
        // @ts-expect-error TS(2339): Property 'sections' does not exist on type 'Readon... Remove this comment to see the full error message
        sections={this.props.sections}
        adhocFilter={new AdhocFilter({})}
        // @ts-expect-error TS(2339): Property 'datasource' does not exist on type 'Read... Remove this comment to see the full error message
        datasource={this.props.datasource}
        // @ts-expect-error TS(2339): Property 'options' does not exist on type 'Readonl... Remove this comment to see the full error message
        options={this.state.options}
        onFilterEdit={this.onNewFilter}
        // @ts-expect-error TS(2339): Property 'partitionColumn' does not exist on type ... Remove this comment to see the full error message
        partitionColumn={this.state.partitionColumn}
      >
        {trigger}
      </AdhocFilterPopoverTrigger>
    );
  }

  render() {
    return (
      <div className="metrics-select" data-test="adhoc-filter-control">
        <HeaderContainer>
          <ControlHeader {...this.props} />
          {this.addNewFilterPopoverTrigger(
            <AddIconButton data-test="add-filter-button">
              <Icons.PlusOutlined iconSize="m" />
            </AddIconButton>,
          )}
        </HeaderContainer>
        <LabelsContainer>
          // @ts-expect-error TS(2339): Property 'values' does not exist on type
          'Readonly... Remove this comment to see the full error message
          {this.state.values.length > 0
            ? // @ts-expect-error TS(2339): Property 'values' does not exist on type 'Readonly... Remove this comment to see the full error message
              this.state.values.map((value: $TSFixMe, index: $TSFixMe) =>
                this.valueRenderer(value, index),
              )
            : this.addNewFilterPopoverTrigger(
                <AddControlLabel>
                  <Icons.PlusOutlined iconSize="m" />
                  {t('Add filter')}
                </AddControlLabel>,
              )}
        </LabelsContainer>
      </div>
    );
  }
}

// @ts-expect-error TS(2339): Property 'propTypes' does not exist on type 'typeo... Remove this comment to see the full error message
AdhocFilterControl.propTypes = propTypes;
// @ts-expect-error TS(2339): Property 'defaultProps' does not exist on type 'ty... Remove this comment to see the full error message
AdhocFilterControl.defaultProps = defaultProps;

export default withTheme(AdhocFilterControl);
