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
import { Select } from 'src/components/Select';
import { t, SupersetClient } from '@superset-ui/core';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../AdhocFilter';
import adhocMetricType from '../propTypes/adhocMetricType';
import columnType from '../propTypes/columnType';
import {
  OPERATORS,
  OPERATORS_OPTIONS,
  TABLE_ONLY_OPERATORS,
  DRUID_ONLY_OPERATORS,
  HAVING_OPERATORS,
  MULTI_OPERATORS,
  CUSTOM_OPERATORS,
  DISABLE_INPUT_OPERATORS,
} from '../constants';
import FilterDefinitionOption from './FilterDefinitionOption';
import SelectControl from './controls/SelectControl';

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
    return 'like';
  }
  if (operator === OPERATORS['LATEST PARTITION']) {
    return 'use latest_partition template';
  }
  return operator;
}

const SINGLE_LINE_SELECT_CONTROL_HEIGHT = 30;

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
    this.multiComparatorRef = this.multiComparatorRef.bind(this);

    this.state = {
      suggestions: [],
      multiComparatorHeight: SINGLE_LINE_SELECT_CONTROL_HEIGHT,
      abortActiveRequest: null,
    };

    this.selectProps = {
      isMulti: false,
      name: 'select-column',
      labelKey: 'label',
      autosize: false,
      clearable: false,
    };
  }

  UNSAFE_componentWillMount() {
    this.refreshComparatorSuggestions();
  }

  componentDidMount() {
    this.handleMultiComparatorInputHeightChange();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.adhocFilter.subject !== this.props.adhocFilter.subject) {
      this.refreshComparatorSuggestions();
    }
    this.handleMultiComparatorInputHeightChange();
  }

  onSubjectChange(option) {
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

  handleMultiComparatorInputHeightChange() {
    if (this.multiComparatorComponent) {
      const multiComparatorDOMNode = this.multiComparatorComponent?.select
        ?.select.controlRef;
      if (multiComparatorDOMNode) {
        if (
          multiComparatorDOMNode.clientHeight !==
          this.state.multiComparatorHeight
        ) {
          this.props.onHeightChange(
            multiComparatorDOMNode.clientHeight -
              this.state.multiComparatorHeight,
          );
          this.setState({
            multiComparatorHeight: multiComparatorDOMNode.clientHeight,
          });
        }
      }
    }
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

  focusComparator(ref) {
    if (ref) {
      ref.focus();
    }
  }

  multiComparatorRef(ref) {
    if (ref) {
      this.multiComparatorComponent = ref;
    }
  }

  renderSubjectOptionLabel(option) {
    return <FilterDefinitionOption option={option} />;
  }

  renderSubjectOptionValue({ value }) {
    return <span>{value}</span>;
  }

  render() {
    const { adhocFilter, options: columns, datasource } = this.props;
    const { subject, operator, comparator } = adhocFilter;
    const subjectSelectProps = {
      options: columns,
      value: subject ? { value: subject } : undefined,
      onChange: this.onSubjectChange,
      optionRenderer: this.renderSubjectOptionLabel,
      valueRenderer: this.renderSubjectOptionValue,
      valueKey: 'filterOptionName',
      noResultsText: t(
        'No such column found. To filter on a metric, try the Custom SQL tab.',
      ),
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
      // make sure options have `column_name`
      subjectSelectProps.options = columns.filter(option => option.column_name);
    }

    const operatorSelectProps = {
      placeholder: t('%s operators(s)', OPERATORS_OPTIONS.length),
      // like AGGREGTES_OPTIONS, operator options are string
      options: OPERATORS_OPTIONS.filter(op =>
        this.isOperatorRelevant(op, subject),
      ),
      value: operator,
      onChange: this.onOperatorChange,
      getOptionLabel: translateOperator,
    };

    return (
      <span>
        <FormGroup className="adhoc-filter-simple-column-dropdown">
          <Select
            {...this.selectProps}
            {...subjectSelectProps}
            name="filter-column"
          />
        </FormGroup>
        <FormGroup>
          <Select
            {...this.selectProps}
            {...operatorSelectProps}
            name="filter-operator"
          />
        </FormGroup>
        <FormGroup data-test="adhoc-filter-simple-value">
          {MULTI_OPERATORS.has(operator) ||
          this.state.suggestions.length > 0 ? (
            <SelectControl
              name="filter-value"
              autoFocus
              freeForm
              multi={MULTI_OPERATORS.has(operator)}
              value={comparator}
              isLoading={this.state.loading}
              choices={this.state.suggestions}
              onChange={this.onComparatorChange}
              showHeader={false}
              noResultsText={t('type a value here')}
              selectRef={this.multiComparatorRef}
              disabled={DISABLE_INPUT_OPERATORS.includes(operator)}
            />
          ) : (
            <input
              name="filter-value"
              ref={this.focusComparator}
              type="text"
              onChange={this.onInputComparatorChange}
              value={comparator}
              className="form-control input-sm"
              placeholder={t('Filter value')}
              disabled={DISABLE_INPUT_OPERATORS.includes(operator)}
            />
          )}
        </FormGroup>
      </span>
    );
  }
}
AdhocFilterEditPopoverSimpleTabContent.propTypes = propTypes;
AdhocFilterEditPopoverSimpleTabContent.defaultProps = defaultProps;
