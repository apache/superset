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
import React, { useEffect, useState, useCallback } from 'react';
import { debounce } from 'lodash';
import rison from 'rison';
import { Select } from 'src/components';
import { t, SupersetClient, styled } from '@superset-ui/core';
import {
  Operators,
  OPERATORS_OPTIONS,
  TABLE_ONLY_OPERATORS,
  DRUID_ONLY_OPERATORS,
  HAVING_OPERATORS,
  MULTI_OPERATORS,
  CUSTOM_OPERATORS,
  DISABLE_INPUT_OPERATORS,
  AGGREGATES,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
} from 'src/explore/constants';
import FilterDefinitionOption from 'src/explore/components/controls/MetricControl/FilterDefinitionOption';
import AdhocFilter, {
  EXPRESSION_TYPES,
  CLAUSES,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { Input } from 'src/common/components';
import { Tooltip } from 'src/components/Tooltip';

const StyledInput = styled(Input)`
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

const SelectWithLabel = styled(Select)<{ labelText: string }>`
  .ant-select-selector::after {
    content: ${({ labelText }) => labelText || '\\A0'};
    display: inline-block;
    white-space: nowrap;
    color: ${({ theme }) => theme.colors.grayscale.light1};
    width: max-content;
  }
`;

export interface SimpleColumnType {
  id: number;
  column_name: string;
  expression?: string;
  type: string;
  optionName?: string;
  filterBy?: string;
  value?: string;
  business_type?: string;
}

export interface SimpleExpressionType {
  expressionType: keyof typeof EXPRESSION_TYPES;
  column: SimpleColumnType;
  aggregate: keyof typeof AGGREGATES;
  label: string;
}
export interface SQLExpressionType {
  expressionType: keyof typeof EXPRESSION_TYPES;
  sqlExpression: string;
  label: string;
}

export interface MetricColumnType {
  saved_metric_name: string;
}

export type ColumnType =
  | SimpleColumnType
  | SimpleExpressionType
  | SQLExpressionType
  | MetricColumnType;

export interface Props {
  adhocFilter: AdhocFilter;
  onChange: (filter: AdhocFilter) => void;
  options: ColumnType[];
  datasource: {
    id: string;
    columns: SimpleColumnType[];
    type: string;
    filter_select: boolean;
  };
  partitionColumn: string;
  operators?: Operators[];
}

export interface BusinessTypesState {
  parsedBusniessType: string;
  subjectBusinessType: string | undefined;
  busninessTypeOperatorList: string[];
}

const useBusinessTypes = () => {
  const [businessTypesState, setBusinessTypesState] =
    useState<BusinessTypesState>({
      parsedBusniessType: '',
      subjectBusinessType: undefined,
      busninessTypeOperatorList: [],
    });

  const fetchBusinessTypeValueCallback = useCallback(
    debounce((comp: string | string[], type: string | undefined) => {
      console.log('INSIDE DEBOUNCE');
      const queryParams = rison.encode({
        type,
        values: typeof comp === 'string' ? [comp] : comp,
      });
      const endpoint = `/api/v1/chart/business_type?q=${queryParams}`;
      SupersetClient.get({ endpoint })
        .then(({ json }) => {
          setBusinessTypesState({
            parsedBusniessType: json.result.display_value,
            subjectBusinessType: type,
            busninessTypeOperatorList: json.result.valid_filter_operators,
          });
        })
        .catch(e => {
          setBusinessTypesState({
            parsedBusniessType: '',
            subjectBusinessType: type,
            busninessTypeOperatorList:
              businessTypesState.busninessTypeOperatorList,
          });
        });
    }, 600),
    [],
  );

  const fetchSubjectBusinessType = (props: Props) => {
    const option = props.options.find(
      option =>
        ('column_name' in option &&
          option.column_name === props.adhocFilter.subject) ||
        ('optionName' in option &&
          option.optionName === props.adhocFilter.subject),
    );
    if (option && 'business_type' in option) {
      console.log(`Setting Type tp ${option.business_type}`);
      setBusinessTypesState({
        ...businessTypesState,
        subjectBusinessType: option.business_type,
      });
    }
  };

  return {
    businessTypesState,
    setBusinessTypesState,
    fetchBusinessTypeValueCallback,
    fetchSubjectBusinessType,
  };
};

export const useSimpleTabFilterProps = (props: Props) => {
  const isOperatorRelevant = (operator: Operators, subject: string) => {
    const column = props.datasource.columns?.find(
      col => col.column_name === subject,
    );
    const isColumnBoolean =
      !!column && (column.type === 'BOOL' || column.type === 'BOOLEAN');
    const isColumnNumber =
      !!column && (column.type === 'INT' || column.type === 'INTEGER');
    const isColumnFunction = !!column && !!column.expression;

    if (operator && CUSTOM_OPERATORS.has(operator)) {
      const { partitionColumn } = props;
      return partitionColumn && subject && subject === partitionColumn;
    }
    if (operator === Operators.IS_TRUE || operator === Operators.IS_FALSE) {
      return isColumnBoolean || isColumnNumber || isColumnFunction;
    }
    if (isColumnBoolean) {
      return (
        operator === Operators.IS_NULL || operator === Operators.IS_NOT_NULL
      );
    }
    return !(
      (props.datasource.type === 'druid' &&
        TABLE_ONLY_OPERATORS.indexOf(operator) >= 0) ||
      (props.datasource.type === 'table' &&
        DRUID_ONLY_OPERATORS.indexOf(operator) >= 0) ||
      (props.adhocFilter.clause === CLAUSES.HAVING &&
        HAVING_OPERATORS.indexOf(operator) === -1)
    );
  };
  const onSubjectChange = (id: string) => {
    const option = props.options.find(
      option =>
        ('column_name' in option && option.column_name === id) ||
        ('optionName' in option && option.optionName === id),
    );
    let subject = '';
    let clause;
    // infer the new clause based on what subject was selected.
    if (option && 'column_name' in option) {
      subject = option.column_name;
      clause = CLAUSES.WHERE;
    } else if (option && 'saved_metric_name' in option) {
      subject = option.saved_metric_name;
      clause = CLAUSES.HAVING;
    } else if (option && option.label) {
      subject = option.label;
      clause = CLAUSES.HAVING;
    }
    const { operator, operatorId } = props.adhocFilter;
    props.onChange(
      props.adhocFilter.duplicateWith({
        subject,
        clause,
        operator:
          operator && operatorId && isOperatorRelevant(operatorId, subject)
            ? OPERATOR_ENUM_TO_OPERATOR_TYPE[operatorId].operation
            : null,
        expressionType: EXPRESSION_TYPES.SIMPLE,
        operatorId,
      }),
    );
  };
  const onOperatorChange = (operatorId: Operators) => {
    const currentComparator = props.adhocFilter.comparator;
    let newComparator;
    // convert between list of comparators and individual comparators
    // (e.g. `in ('North America', 'Africa')` to `== 'North America'`)
    if (MULTI_OPERATORS.has(operatorId)) {
      newComparator = Array.isArray(currentComparator)
        ? currentComparator
        : [currentComparator].filter(element => element);
    } else {
      newComparator = Array.isArray(currentComparator)
        ? currentComparator[0]
        : currentComparator;
    }
    if (operatorId === Operators.IS_TRUE || operatorId === Operators.IS_FALSE) {
      newComparator = Operators.IS_TRUE === operatorId;
    }
    if (operatorId && CUSTOM_OPERATORS.has(operatorId)) {
      props.onChange(
        props.adhocFilter.duplicateWith({
          subject: props.adhocFilter.subject,
          clause: CLAUSES.WHERE,
          operatorId,
          operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[operatorId].operation,
          expressionType: EXPRESSION_TYPES.SQL,
          datasource: props.datasource,
        }),
      );
    } else {
      props.onChange(
        props.adhocFilter.duplicateWith({
          operatorId,
          operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[operatorId].operation,
          comparator: newComparator,
          expressionType: EXPRESSION_TYPES.SIMPLE,
        }),
      );
    }
  };
  const onComparatorChange = (comparator: string) => {
    props.onChange(
      props.adhocFilter.duplicateWith({
        comparator,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    );
  };
  return {
    onSubjectChange,
    onOperatorChange,
    onComparatorChange,
    isOperatorRelevant,
  };
};

const AdhocFilterEditPopoverSimpleTabContent: React.FC<Props> = props => {
  const {
    onSubjectChange,
    onOperatorChange,
    isOperatorRelevant,
    onComparatorChange,
  } = useSimpleTabFilterProps(props);
  const [suggestions, setSuggestions] = useState<Record<string, any>>([]);
  const [comparator, setComparator] = useState(props.adhocFilter.comparator);
  const [loadingComparatorSuggestions, setLoadingComparatorSuggestions] =
    useState(false);

  const {
    businessTypesState,
    fetchBusinessTypeValueCallback,
    fetchSubjectBusinessType,
  } = useBusinessTypes();
  // TODO: This does not need to exists, just use the busninessTypeOperatorList lsit
  const isOperatorRelevantWrapper = (operator: Operators, subject: string) => {
    const op = OPERATOR_ENUM_TO_OPERATOR_TYPE[operator].operation;
    return businessTypesState.subjectBusinessType
      ? isOperatorRelevant(operator, subject) &&
          businessTypesState.busninessTypeOperatorList.includes(op)
      : isOperatorRelevant(operator, subject);
  };
  const onInputComparatorChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    onComparatorChange(event.target.value);
  };

  const renderSubjectOptionLabel = (option: ColumnType) => (
    <FilterDefinitionOption option={option} />
  );

  const getOptionsRemaining = () => {
    // if select is multi/value is array, we show the options not selected
    const valuesFromSuggestionsLength = Array.isArray(comparator)
      ? comparator.filter(v => suggestions.includes(v)).length
      : 0;
    return suggestions?.length - valuesFromSuggestionsLength ?? 0;
  };
  const createSuggestionsPlaceholder = () => {
    const optionsRemaining = getOptionsRemaining();
    const placeholder = t('%s option(s)', optionsRemaining);
    return optionsRemaining ? placeholder : '';
  };

  const handleSubjectChange = (subject: string) => {
    setComparator(undefined);
    onSubjectChange(subject);
  };

  let columns = props.options;
  const { subject, operator, operatorId } = props.adhocFilter;

  const subjectSelectProps = {
    ariaLabel: t('Select subject'),
    value: subject ?? undefined,
    onChange: handleSubjectChange,
    notFoundContent: t(
      'No such column found. To filter on a metric, try the Custom SQL tab.',
    ),
    autoFocus: !subject,
    placeholder: '',
  };

  if (props.datasource.type === 'druid') {
    subjectSelectProps.placeholder = t(
      '%s column(s) and metric(s)',
      columns.length,
    );
  } else {
    // we cannot support simple ad-hoc filters for metrics because we don't know what type
    // the value should be cast to (without knowing the output type of the aggregate, which
    // becomes a rather complicated problem)
    subjectSelectProps.placeholder =
      props.adhocFilter.clause === CLAUSES.WHERE
        ? t('%s column(s)', columns.length)
        : t('To filter on a metric, use Custom SQL tab.');
    columns = props.options.filter(
      option => 'column_name' in option && option.column_name,
    );
  }

  const operatorSelectProps = {
    placeholder: t(
      '%s operator(s)',
      (props.operators ?? OPERATORS_OPTIONS).filter(op =>
        isOperatorRelevantWrapper(op, subject),
      ).length,
    ),
    value: operatorId,
    onChange: onOperatorChange,
    autoFocus: !!subjectSelectProps.value && !operator,
    ariaLabel: t('Select operator'),
  };

  const shouldFocusComparator =
    !!subjectSelectProps.value && !!operatorSelectProps.value;

  const comparatorSelectProps = {
    allowClear: true,
    allowNewOptions: true,
    ariaLabel: t('Comparator option'),
    mode: MULTI_OPERATORS.has(operatorId)
      ? ('multiple' as const)
      : ('single' as const),
    loading: loadingComparatorSuggestions,
    value: comparator,
    onChange: onComparatorChange,
    notFoundContent: t('Type a value here'),
    disabled: DISABLE_INPUT_OPERATORS.includes(operatorId),
    placeholder: createSuggestionsPlaceholder(),
    autoFocus: shouldFocusComparator,
  };
  useEffect(() => {
    fetchSubjectBusinessType(props);
  }, [props.adhocFilter.subject]);

  useEffect(() => {
    fetchBusinessTypeValueCallback(
      comparator === undefined ? '' : comparator,
      businessTypesState.subjectBusinessType,
    );
  }, [businessTypesState.subjectBusinessType, comparator]);

  const labelText =
    comparator && comparator.length > 0 && createSuggestionsPlaceholder();

  useEffect(() => {
    const refreshComparatorSuggestions = () => {
      const { datasource } = props;
      const col = props.adhocFilter.subject;
      const having = props.adhocFilter.clause === CLAUSES.HAVING;

      if (col && datasource && datasource.filter_select && !having) {
        const controller = new AbortController();
        const { signal } = controller;
        if (loadingComparatorSuggestions) {
          controller.abort();
        }
        setLoadingComparatorSuggestions(true);
        SupersetClient.get({
          signal,
          endpoint: `/superset/filter/${datasource.type}/${datasource.id}/${col}/`,
        })
          .then(({ json }) => {
            setSuggestions(json);
            setLoadingComparatorSuggestions(false);
          })
          .catch(() => {
            setSuggestions([]);
            setLoadingComparatorSuggestions(false);
          });
      }
    };
    refreshComparatorSuggestions();
  }, [props.adhocFilter.subject]);

  useEffect(() => {
    setComparator(props.adhocFilter.comparator);
  }, [props.adhocFilter.comparator]);

  return (
    <>
      <Select
        css={theme => ({
          marginTop: theme.gridUnit * 4,
          marginBottom: theme.gridUnit * 4,
        })}
        options={columns.map(column => ({
          value:
            ('column_name' in column && column.column_name) ||
            ('optionName' in column && column.optionName) ||
            '',
          label:
            ('saved_metric_name' in column && column.saved_metric_name) ||
            ('column_name' in column && column.column_name) ||
            ('label' in column && column.label),
          key:
            ('id' in column && column.id) ||
            ('optionName' in column && column.optionName) ||
            undefined,
          customLabel: renderSubjectOptionLabel(column),
        }))}
        {...subjectSelectProps}
      />
      <Select
        css={theme => ({ marginBottom: theme.gridUnit * 4 })}
        options={(props.operators ?? OPERATORS_OPTIONS)
          .filter(op => isOperatorRelevantWrapper(op, subject))
          .map(option => ({
            value: option,
            label: OPERATOR_ENUM_TO_OPERATOR_TYPE[option].display,
            key: option,
          }))}
        {...operatorSelectProps}
      />
      {MULTI_OPERATORS.has(operatorId) || suggestions.length > 0 ? (
        <Tooltip title={businessTypesState.subjectBusinessType}>
          <SelectWithLabel
            labelText={labelText}
            options={suggestions.map((suggestion: string) => ({
              value: suggestion,
              label: String(suggestion),
            }))}
            {...comparatorSelectProps}
          />
        </Tooltip>
      ) : (
        <Tooltip title={businessTypesState.parsedBusniessType}>
          <StyledInput
            data-test="adhoc-filter-simple-value"
            name="filter-value"
            ref={ref => {
              if (ref && shouldFocusComparator) {
                ref.focus();
              }
            }}
            onChange={onInputComparatorChange}
            value={comparator}
            placeholder={t('Filter value (case sensitive)')}
            disabled={DISABLE_INPUT_OPERATORS.includes(operatorId)}
          />
        </Tooltip>
      )}
    </>
  );
};

export default AdhocFilterEditPopoverSimpleTabContent;
