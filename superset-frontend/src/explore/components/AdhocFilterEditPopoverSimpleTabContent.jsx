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
import VirtualizedSelect from 'react-virtualized-select';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import AdhocFilter, { EXPRESSION_TYPES, CLAUSES } from '../AdhocFilter';
import adhocMetricType from '../propTypes/adhocMetricType';
import columnType from '../propTypes/columnType';
import {
  OPERATORS,
  TABLE_ONLY_OPERATORS,
  DRUID_ONLY_OPERATORS,
  HAVING_OPERATORS,
  MULTI_OPERATORS,
  CUSTOM_OPERATORS,
  DISABLE_INPUT_OPERATORS,
} from '../constants';
import FilterDefinitionOption from './FilterDefinitionOption';
import OnPasteSelect from '../../components/OnPasteSelect';
import SelectControl from './controls/SelectControl';
import VirtualizedRendererWrap from '../../components/VirtualizedRendererWrap';

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
  } else if (operator === OPERATORS['!=']) {
    return 'not equal to';
  } else if (operator === OPERATORS.LIKE) {
    return 'like';
  } else if (operator === OPERATORS['LATEST PARTITION']) {
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
      multi: false,
      name: 'select-column',
      labelKey: 'label',
      autosize: false,
      clearable: false,
      selectWrap: VirtualizedSelect,
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
    if (MULTI_OPERATORS.indexOf(operator.operator) >= 0) {
      newComparator = Array.isArray(currentComparator)
        ? currentComparator
        : [currentComparator].filter(element => element);
    } else {
      newComparator = Array.isArray(currentComparator)
        ? currentComparator[0]
        : currentComparator;
    }

    if (operator && CUSTOM_OPERATORS.includes(operator.operator)) {
      this.props.onChange(
        this.props.adhocFilter.duplicateWith({
          subject: this.props.adhocFilter.subject,
          clause: CLAUSES.WHERE,
          operator: operator && operator.operator,
          expressionType: EXPRESSION_TYPES.SQL,
          datasource: this.props.datasource,
        }),
      );
    } else {
      this.props.onChange(
        this.props.adhocFilter.duplicateWith({
          operator: operator && operator.operator,
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
      /* eslint-disable no-underscore-dangle */
      const multiComparatorDOMNode =
        this.multiComparatorComponent._selectRef &&
        this.multiComparatorComponent._selectRef.select &&
        this.multiComparatorComponent._selectRef.select.control;
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
    const datasource = this.props.datasource;
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
      }).then(({ json }) => {
        this.setState(() => ({
          suggestions: json,
          abortActiveRequest: null,
          loading: false,
        }));
      });
    }
  }

  isOperatorRelevant(operator, subject) {
    if (operator && CUSTOM_OPERATORS.includes(operator)) {
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

  render() {
    const { adhocFilter, options, datasource } = this.props;

    let subjectSelectProps = {
      value: adhocFilter.subject ? { value: adhocFilter.subject } : undefined,
      onChange: this.onSubjectChange,
      optionRenderer: VirtualizedRendererWrap(option => (
        <FilterDefinitionOption option={option} />
      )),
      valueRenderer: option => <span>{option.value}</span>,
      valueKey: 'filterOptionName',
      noResultsText: t(
        'No such column found. To filter on a metric, try the Custom SQL tab.',
      ),
    };

    if (datasource.type === 'druid') {
      subjectSelectProps = {
        ...subjectSelectProps,
        placeholder: t('%s column(s) and metric(s)', options.length),
        options,
      };
    } else {
      // we cannot support simple ad-hoc filters for metrics because we don't know what type
      // the value should be cast to (without knowing the output type of the aggregate, which
      // becomes a rather complicated problem)
      subjectSelectProps = {
        ...subjectSelectProps,
        placeholder:
          adhocFilter.clause === CLAUSES.WHERE
            ? t('%s column(s)', options.length)
            : t('To filter on a metric, use Custom SQL tab.'),
        options: options.filter(option => option.column_name),
      };
    }

    const operatorSelectProps = {
      placeholder: t('%s operators(s)', Object.keys(OPERATORS).length),
      options: Object.keys(OPERATORS)
        .filter(operator =>
          this.isOperatorRelevant(operator, adhocFilter.subject),
        )
        .map(operator => ({
          operator,
          label: translateOperator(operator),
          value: operator,
        })),
      value: adhocFilter.operator,
      onChange: this.onOperatorChange,
      optionRenderer: VirtualizedRendererWrap(operator =>
        translateOperator(operator.operator),
      ),
      valueRenderer: operator => (
        <span>{translateOperator(operator.operator)}</span>
      ),
      valueKey: 'operator',
    };

    return (
      <span>
        <FormGroup className="adhoc-filter-simple-column-dropdown">
          <OnPasteSelect {...this.selectProps} {...subjectSelectProps} />
        </FormGroup>
        <FormGroup>
          <OnPasteSelect {...this.selectProps} {...operatorSelectProps} />
        </FormGroup>
        <FormGroup data-test="adhoc-filter-simple-value">
          {MULTI_OPERATORS.indexOf(adhocFilter.operator) >= 0 ||
          this.state.suggestions.length > 0 ? (
            <SelectControl
              multi={MULTI_OPERATORS.indexOf(adhocFilter.operator) >= 0}
              freeForm
              name="filter-comparator-value"
              value={adhocFilter.comparator}
              isLoading={this.state.loading}
              choices={this.state.suggestions}
              onChange={this.onComparatorChange}
              showHeader={false}
              noResultsText={t('type a value here')}
              refFunc={this.multiComparatorRef}
              disabled={DISABLE_INPUT_OPERATORS.includes(adhocFilter.operator)}
            />
          ) : (
            <input
              ref={this.focusComparator}
              type="text"
              onChange={this.onInputComparatorChange}
              value={adhocFilter.comparator || ''}
              className="form-control input-sm"
              placeholder={t('Filter value')}
              disabled={DISABLE_INPUT_OPERATORS.includes(adhocFilter.operator)}
            />
          )}
        </FormGroup>
      </span>
    );
  }
}
AdhocFilterEditPopoverSimpleTabContent.propTypes = propTypes;
AdhocFilterEditPopoverSimpleTabContent.defaultProps = defaultProps;
