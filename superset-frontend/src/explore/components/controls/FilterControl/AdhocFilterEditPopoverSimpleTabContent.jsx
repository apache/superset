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
import { FormGroup } from 'react-bootstrap';
import { Select } from 'src/common/components/Select';
import { Input } from 'src/common/components';
import { t, SupersetClient, styled } from '@superset-ui/core';

import adhocMetricType from 'src/explore/components/controls/MetricControl/adhocMetricType';
import columnType from 'src/explore/propTypes/columnType';
import {
  OPERATORS,
  OPERATORS_OPTIONS,
  TABLE_ONLY_OPERATORS,
  DRUID_ONLY_OPERATORS,
  HAVING_OPERATORS,
  MULTI_OPERATORS,
  CUSTOM_OPERATORS,
  DISABLE_INPUT_OPERATORS,
} from 'src/explore/constants';
import FilterDefinitionOption from 'src/explore/components/controls/MetricControl/FilterDefinitionOption';
import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from './AdhocFilter';

const SelectWithLabel = styled(Select)`
  .ant-select-selector::after {
    content: '${({ labelText }) => labelText || '\\A0'}';
    display: inline-block;
    white-space: nowrap;
    color: ${({ theme }) => theme.colors.grayscale.light1};
    width: max-content;
  }
`;

const propTypes = {
  adhocFilter: PropTypes.instanceOf(AdhocFilter).isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.oneOfType([
      columnType,
      PropTypes.shape({ saved_metric_name: PropTypes.string.isRequired }),
      adhocMetricType,
    ]),
  ).isRequired,
  onHeightChange: PropTypes.func.isRequired,
  datasource: PropTypes.object,
  partitionColumn: PropTypes.string,
  popoverRef: PropTypes.object,
};

const defaultProps = {
  datasource: {},
};

function translateOperator(operator) {
  if (operator === OPERATORS['==']) {
    return 'equals';
  }
  if (operator === OPERATORS['!=']) {
    return 'not equal to';
  }
  if (operator === OPERATORS.LIKE) {
    return 'LIKE';
  }
  if (operator === OPERATORS['LATEST PARTITION']) {
    return 'use latest_partition template';
  }
  return operator;
}

export default class AdhocFilterEditPopoverSimpleTabContent extends React.Component {
  constructor(props) {
    super(props);
    this.onSubjectChange = this.onSubjectChange.bind(this);
    this.onOperatorChange = this.onOperatorChange.bind(this);
    this.onComparatorChange = this.onComparatorChange.bind(this);
    this.onInputComparatorChange = this.onInputComparatorChange.bind(this);
    this.isOperatorRelevant = this.isOperatorRelevant.bind(this);
    this.refreshComparatorSuggestions = this.refreshComparatorSuggestions.bind(
      this,
    );

    this.state = {
      suggestions: [],
      abortActiveRequest: null,
    };

    this.selectProps = {
      name: 'select-column',
      showSearch: true,
    };
  }

  UNSAFE_componentWillMount() {
    this.refreshComparatorSuggestions();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.adhocFilter.subject !== this.props.adhocFilter.subject) {
      this.refreshComparatorSuggestions();
    }
  }

  onSubjectChange(id) {
    const option = this.props.options.find(
      option => option.id === id || option.optionName === id,
    );

    let subject;
    let clause;
    // infer the new clause based on what subject was selected.
    if (option && option.column_name) {
      subject = option.column_name;
      clause = CLAUSES.WHERE;
    } else if (option && (option.saved_metric_name || option.label)) {
      subject = option.saved_metric_name || option.label;
      clause = CLAUSES.HAVING;
    }
    const { operator } = this.props.adhocFilter;
    this.props.onChange(
      this.props.adhocFilter.duplicateWith({
        subject,
        clause,
        operator:
          operator && this.isOperatorRelevant(operator, subject)
            ? operator
            : null,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    );
  }

  onOperatorChange(operator) {
    const currentComparator = this.props.adhocFilter.comparator;
    let newComparator;
    // convert between list of comparators and individual comparators
    // (e.g. `in ('North America', 'Africa')` to `== 'North America'`)
    if (MULTI_OPERATORS.has(operator)) {
      newComparator = Array.isArray(currentComparator)
        ? currentComparator
        : [currentComparator].filter(element => element);
    } else {
      newComparator = Array.isArray(currentComparator)
        ? currentComparator[0]
        : currentComparator;
    }

    if (operator && CUSTOM_OPERATORS.has(operator)) {
      this.props.onChange(
        this.props.adhocFilter.duplicateWith({
          subject: this.props.adhocFilter.subject,
          clause: CLAUSES.WHERE,
          operator,
          expressionType: EXPRESSION_TYPES.SQL,
          datasource: this.props.datasource,
        }),
      );
    } else {
      this.props.onChange(
        this.props.adhocFilter.duplicateWith({
          operator,
          comparator: newComparator,
          expressionType: EXPRESSION_TYPES.SIMPLE,
        }),
      );
    }
  }

  onInputComparatorChange(event) {
    this.onComparatorChange(event.target.value);
  }

  onComparatorChange(comparator) {
    this.props.onChange(
      this.props.adhocFilter.duplicateWith({
        comparator,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    );
  }

  refreshComparatorSuggestions() {
    const { datasource } = this.props;
    const col = this.props.adhocFilter.subject;
    const having = this.props.adhocFilter.clause === CLAUSES.HAVING;

    if (col && datasource && datasource.filter_select && !having) {
      if (this.state.abortActiveRequest) {
        this.state.abortActiveRequest();
      }

      const controller = new AbortController();
      const { signal } = controller;
      this.setState({ abortActiveRequest: controller.abort, loading: true });

      SupersetClient.get({
        signal,
        endpoint: `/superset/filter/${datasource.type}/${datasource.id}/${col}/`,
      })
        .then(({ json }) => {
          this.setState(() => ({
            suggestions: json,
            abortActiveRequest: null,
            loading: false,
          }));
        })
        .catch(() => {
          this.setState(() => ({
            suggestions: [],
            abortActiveRequest: null,
            loading: false,
          }));
        });
    }
  }

  isOperatorRelevant(operator, subject) {
    if (operator && CUSTOM_OPERATORS.has(operator)) {
      const { partitionColumn } = this.props;
      return partitionColumn && subject && subject === partitionColumn;
    }

    return !(
      (this.props.datasource.type === 'druid' &&
        TABLE_ONLY_OPERATORS.indexOf(operator) >= 0) ||
      (this.props.datasource.type === 'table' &&
        DRUID_ONLY_OPERATORS.indexOf(operator) >= 0) ||
      (this.props.adhocFilter.clause === CLAUSES.HAVING &&
        HAVING_OPERATORS.indexOf(operator) === -1)
    );
  }

  focusComparator(ref, shouldFocus) {
    if (ref && shouldFocus) {
      ref.focus();
    }
  }

  optionsRemaining() {
    const { suggestions } = this.state;
    const { comparator } = this.props.adhocFilter;
    // if select is multi/value is array, we show the options not selected
    const valuesFromSuggestionsLength = Array.isArray(comparator)
      ? comparator.filter(v => suggestions.includes(v)).length
      : 0;
    return suggestions?.length - valuesFromSuggestionsLength ?? 0;
  }

  createSuggestionsPlaceholder() {
    const optionsRemaining = this.optionsRemaining();
    const placeholder = t('%s option(s)', optionsRemaining);
    return optionsRemaining ? placeholder : '';
  }

  renderSubjectOptionLabel(option) {
    return <FilterDefinitionOption option={option} />;
  }

  render() {
    const { adhocFilter, options, datasource } = this.props;
    let columns = options;
    const { subject, operator, comparator } = adhocFilter;
    const subjectSelectProps = {
      value: subject ?? undefined,
      onChange: this.onSubjectChange,
      notFoundContent: t(
        'No such column found. To filter on a metric, try the Custom SQL tab.',
      ),
      filterOption: (input, option) =>
        option.filterBy.toLowerCase().indexOf(input.toLowerCase()) >= 0,
      autoFocus: !subject,
    };

    if (datasource.type === 'druid') {
      subjectSelectProps.placeholder = t(
        '%s column(s) and metric(s)',
        columns.length,
      );
    } else {
      // we cannot support simple ad-hoc filters for metrics because we don't know what type
      // the value should be cast to (without knowing the output type of the aggregate, which
      // becomes a rather complicated problem)
      subjectSelectProps.placeholder =
        adhocFilter.clause === CLAUSES.WHERE
          ? t('%s column(s)', columns.length)
          : t('To filter on a metric, use Custom SQL tab.');
      columns = options.filter(option => option.column_name);
    }

    const operatorSelectProps = {
      placeholder: t(
        '%s operator(s)',
        OPERATORS_OPTIONS.filter(op => this.isOperatorRelevant(op, subject))
          .length,
      ),
      // like AGGREGTES_OPTIONS, operator options are string
      value: operator,
      onChange: this.onOperatorChange,
      filterOption: (input, option) =>
        option.value.toLowerCase().indexOf(input.toLowerCase()) >= 0,
      autoFocus: !!subjectSelectProps.value && !operator,
    };

    const focusComparator =
      !!subjectSelectProps.value && !!operatorSelectProps.value;
    const comparatorSelectProps = {
      allowClear: true,
      showSearch: true,
      mode: MULTI_OPERATORS.has(operator) && 'tags',
      tokenSeparators: [',', '\n', '\t', ';'],
      loading: this.state.loading,
      value: comparator,
      onChange: this.onComparatorChange,
      notFoundContent: t('Type a value here'),
      disabled: DISABLE_INPUT_OPERATORS.includes(operator),
      placeholder: this.createSuggestionsPlaceholder(),
      labelText: comparator?.length > 0 && this.createSuggestionsPlaceholder(),
      autoFocus: focusComparator,
    };

    return (
      <>
        <FormGroup className="adhoc-filter-simple-column-dropdown">
          <Select
            {...this.selectProps}
            {...subjectSelectProps}
            name="filter-column"
            getPopupContainer={triggerNode => triggerNode.parentNode}
          >
            {columns.map(column => (
              <Select.Option
                value={column.id || column.optionName}
                filterBy={
                  column.saved_metric_name || column.column_name || column.label
                }
                key={column.id || column.optionName}
              >
                {this.renderSubjectOptionLabel(column)}
              </Select.Option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup>
          <Select
            {...this.selectProps}
            {...operatorSelectProps}
            getPopupContainer={triggerNode => triggerNode.parentNode}
            name="filter-operator"
          >
            {OPERATORS_OPTIONS.filter(op =>
              this.isOperatorRelevant(op, subject),
            ).map(option => (
              <Select.Option value={option} key={option}>
                {translateOperator(option)}
              </Select.Option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup data-test="adhoc-filter-simple-value">
          {MULTI_OPERATORS.has(operator) ||
          this.state.suggestions.length > 0 ? (
            <SelectWithLabel
              name="filter-value"
              {...comparatorSelectProps}
              getPopupContainer={triggerNode => triggerNode.parentNode}
            >
              {this.state.suggestions.map(suggestion => (
                <Select.Option value={suggestion} key={suggestion}>
                  {suggestion}
                </Select.Option>
              ))}
            </SelectWithLabel>
          ) : (
            <Input
              name="filter-value"
              ref={ref => this.focusComparator(ref, focusComparator)}
              onChange={this.onInputComparatorChange}
              value={comparator}
              placeholder={t('Filter value (case sensitive)')}
              disabled={DISABLE_INPUT_OPERATORS.includes(operator)}
            />
          )}
        </FormGroup>
      </>
    );
  }
}
AdhocFilterEditPopoverSimpleTabContent.propTypes = propTypes;
AdhocFilterEditPopoverSimpleTabContent.defaultProps = defaultProps;
