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
import React, { useEffect, useState } from 'react';
import FormItem from 'src/components/Form/FormItem';
import { Select } from 'src/components';
import { t, SupersetClient, SupersetTheme, styled } from '@superset-ui/core';
import {
  Operators,
  OPERATORS_OPTIONS,
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
import { Tooltip } from 'src/components/Tooltip';
import { Input } from 'src/components/Input';
import { optionLabel } from 'src/utils/common';
import { FeatureFlag, isFeatureEnabled } from 'src/featureFlags';
import { ColumnMeta } from '@superset-ui/chart-controls';
import useAdvancedDataTypes from './useAdvancedDataTypes';

const StyledInput = styled(Input)`
  margin-bottom: ${({ theme }) => theme.gridUnit * 4}px;
`;

export const StyledFormItem = styled(FormItem)`
  &.ant-row.ant-form-item {
    margin: 0;
  }
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

export interface SimpleExpressionType {
  expressionType: keyof typeof EXPRESSION_TYPES;
  column: ColumnMeta;
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
  | ColumnMeta
  | SimpleExpressionType
  | SQLExpressionType
  | MetricColumnType;

export interface Props {
  adhocFilter: AdhocFilter;
  onChange: (filter: AdhocFilter) => void;
  options: ColumnType[];
  datasource: {
    id: string;
    columns: ColumnMeta[];
    type: string;
    filter_select: boolean;
  };
  partitionColumn: string;
  operators?: Operators[];
  validHandler: (isValid: boolean) => void;
}

export interface AdvancedDataTypesState {
  parsedAdvancedDataType: string;
  advancedDataTypeOperatorList: string[];
  errorMessage: string;
}

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
    return (
      props.adhocFilter.clause !== CLAUSES.HAVING ||
      HAVING_OPERATORS.indexOf(operator) !== -1
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
    } else if (option?.label) {
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
  const clearOperator = (): void => {
    props.onChange(
      props.adhocFilter.duplicateWith({
        operatorId: undefined,
        operator: undefined,
      }),
    );
  };
  return {
    onSubjectChange,
    onOperatorChange,
    onComparatorChange,
    isOperatorRelevant,
    clearOperator,
  };
};

const AdhocFilterEditPopoverSimpleTabContent: React.FC<Props> = props => {
  const {
    onSubjectChange,
    onOperatorChange,
    isOperatorRelevant,
    onComparatorChange,
  } = useSimpleTabFilterProps(props);
  const [suggestions, setSuggestions] = useState<
    Record<'label' | 'value', any>[]
  >([]);
  const [comparator, setComparator] = useState(props.adhocFilter.comparator);
  const [loadingComparatorSuggestions, setLoadingComparatorSuggestions] =
    useState(false);

  const {
    advancedDataTypesState,
    subjectAdvancedDataType,
    fetchAdvancedDataTypeValueCallback,
    fetchSubjectAdvancedDataType,
  } = useAdvancedDataTypes(props.validHandler);
  // TODO: This does not need to exist, just use the advancedTypeOperatorList list
  const isOperatorRelevantWrapper = (operator: Operators, subject: string) =>
    subjectAdvancedDataType
      ? isOperatorRelevant(operator, subject) &&
        advancedDataTypesState.advancedDataTypeOperatorList.includes(operator)
      : isOperatorRelevant(operator, subject);
  const onInputComparatorChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const { value } = event.target;
    setComparator(value);
    onComparatorChange(value);
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

  subjectSelectProps.placeholder =
    props.adhocFilter.clause === CLAUSES.WHERE
      ? t('%s column(s)', columns.length)
      : t('To filter on a metric, use Custom SQL tab.');
  columns = props.options.filter(
    option => 'column_name' in option && option.column_name,
  );

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
            setSuggestions(
              json.map((suggestion: null | number | boolean | string) => ({
                value: suggestion,
                label: optionLabel(suggestion),
              })),
            );
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
    if (isFeatureEnabled(FeatureFlag.ENABLE_ADVANCED_DATA_TYPES)) {
      fetchSubjectAdvancedDataType(props);
    }
  }, [props.adhocFilter.subject]);

  useEffect(() => {
    if (isFeatureEnabled(FeatureFlag.ENABLE_ADVANCED_DATA_TYPES)) {
      fetchAdvancedDataTypeValueCallback(
        comparator === undefined ? '' : comparator,
        advancedDataTypesState,
        subjectAdvancedDataType,
      );
    }
  }, [comparator, subjectAdvancedDataType, fetchAdvancedDataTypeValueCallback]);

  useEffect(() => {
    if (isFeatureEnabled(FeatureFlag.ENABLE_ADVANCED_DATA_TYPES)) {
      setComparator(props.adhocFilter.comparator);
    }
  }, [props.adhocFilter.comparator]);

  // another name for columns, just for following previous naming.
  const subjectComponent = (
    <Select
      css={(theme: SupersetTheme) => ({
        marginTop: theme.gridUnit * 4,
        marginBottom: theme.gridUnit * 4,
      })}
      data-test="select-element"
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
  );

  const operatorsAndOperandComponent = (
    <>
      <Select
        css={(theme: SupersetTheme) => ({ marginBottom: theme.gridUnit * 4 })}
        options={(props.operators ?? OPERATORS_OPTIONS)
          .filter(op => isOperatorRelevantWrapper(op, subject))
          .map((option, index) => ({
            value: option,
            label: OPERATOR_ENUM_TO_OPERATOR_TYPE[option].display,
            key: option,
            order: index,
          }))}
        {...operatorSelectProps}
      />
      {MULTI_OPERATORS.has(operatorId) || suggestions.length > 0 ? (
        <Tooltip
          title={
            advancedDataTypesState.errorMessage ||
            advancedDataTypesState.parsedAdvancedDataType
          }
        >
          <SelectWithLabel
            labelText={labelText}
            options={suggestions}
            {...comparatorSelectProps}
          />
        </Tooltip>
      ) : (
        <Tooltip
          title={
            advancedDataTypesState.errorMessage ||
            advancedDataTypesState.parsedAdvancedDataType
          }
        >
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
  return (
    <>
      {subjectComponent}
      {operatorsAndOperandComponent}
    </>
  );
};

export default AdhocFilterEditPopoverSimpleTabContent;
