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
import {
  FC,
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';

import {
  AsyncSelect,
  Input,
  InputRef,
  Select,
  Tooltip,
  type AsyncSelectRef,
  type LabeledValue,
  type SelectOptionsTypePage,
  type SelectValue,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import {
  isFeatureEnabled,
  FeatureFlag,
  isDefined,
  SupersetClient,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { styled, useTheme, css } from '@apache-superset/core/theme';
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
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { optionLabel } from 'src/utils/common';
import {
  ColumnMeta,
  Dataset,
  isTemporalColumn,
} from '@superset-ui/chart-controls';
import useAdvancedDataTypes from './useAdvancedDataTypes';
import { useDatePickerInAdhocFilter } from '../utils';
import { useDefaultTimeFilter } from '../../DateFilterControl/utils';
import { Clauses, ExpressionTypes } from '../types';

const SelectWithLabel = styled(AsyncSelect)<{ labelText: string }>`
  .ant-select-content::after {
    content: ${({ labelText }) => labelText || '\\A0'};
    display: inline-block;
    white-space: nowrap;
    color: ${({ theme }) => theme.colorTextSecondary};
    width: max-content;
  }
`;

// The server answers with one bounded page, not an offset window: paging would
// need a stable ORDER BY, and ordering a high-cardinality column is the full
// scan this search exists to avoid. A page size no response can reach keeps
// AsyncSelect from asking for a second page.
const COMPARATOR_PAGE_SIZE = 1_000_000;

// SupersetClient rejects with the raw Response, so a refused request carries
// its status. A 4xx is the caller's problem (an unknown column, no access) and
// is not an outage; a 5xx is the server's own failure, and no status at all
// means the request got no answer (network failure, timeout). Only the last
// two are "suggestions unavailable".
const isSuggestionsOutage = (error: unknown): boolean => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status !== 'number' || status >= 500;
};

const toLabeledValue = (value: unknown): LabeledValue => ({
  value: value as LabeledValue['value'],
  label: optionLabel(value as null | number | boolean | string),
});

// The reverse of toLabeledValue: what AsyncSelect emits is labelled, and the
// comparator has to be the raw value or the engine cannot render it as a
// literal.
const unwrapComparator = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(unwrapComparator);
  }
  if (value !== null && typeof value === 'object' && 'value' in value) {
    return (value as LabeledValue).value;
  }
  return value;
};

export interface SimpleExpressionType {
  expressionType: keyof typeof ExpressionTypes;
  column: ColumnMeta;
  aggregate: keyof typeof AGGREGATES;
  label: string;
}
export interface SQLExpressionType {
  expressionType: keyof typeof ExpressionTypes;
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
  datasource: Dataset;
  partitionColumn?: string;
  operators?: Operators[];
  validHandler: (isValid: boolean) => void;
  onHeightChange?: (heightDifference: number) => void;
  popoverRef?: HTMLDivElement | null;
}

export interface AdvancedDataTypesState {
  parsedAdvancedDataType: string;
  advancedDataTypeOperatorList: string[];
  errorMessage: string;
}

export const useSimpleTabFilterProps = (props: Props) => {
  const defaultTimeFilter = useDefaultTimeFilter();

  const isOperatorRelevant = (operator: Operators, subject: string) => {
    const column = props.datasource.columns?.find(
      col => col.column_name === subject,
    );
    const isColumnBoolean =
      !!column && (column.type === 'BOOL' || column.type === 'BOOLEAN');
    const isColumnNumber =
      !!column && (column.type === 'INT' || column.type === 'INTEGER');
    const isColumnFunction = !!column && !!column.expression;
    const isColumnMultiValue =
      !!column && column.type_generic === GenericDataType.MultiValue;

    if (operator && operator === Operators.LatestPartition) {
      const { partitionColumn } = props;
      return partitionColumn && subject && subject === partitionColumn;
    }
    if (operator && operator === Operators.TemporalRange) {
      // hide the TEMPORAL_RANGE operator
      return false;
    }
    // Element-level array operators only apply to multi-value columns.
    const arrayElementOperators = [
      Operators.ContainsAny,
      Operators.ContainsAll,
      Operators.IsEmpty,
      Operators.IsNotEmpty,
      Operators.LengthEquals,
      Operators.LengthGreaterThan,
      Operators.LengthLessThan,
      Operators.LengthGreaterThanOrEqual,
      Operators.LengthLessThanOrEqual,
    ];
    if (arrayElementOperators.includes(operator)) {
      return isColumnMultiValue;
    }
    if (isColumnMultiValue) {
      // Array columns support whole-array operators (=, !=, In, Not in, null
      // checks) plus the element-level operators above. Scalar-only operators
      // (Like, <, >, <=, >=) are hidden because they aren't valid on an array.
      return [
        Operators.Equals,
        Operators.NotEquals,
        Operators.In,
        Operators.NotIn,
        Operators.IsNull,
        Operators.IsNotNull,
        ...arrayElementOperators,
      ].includes(operator);
    }
    if (operator === Operators.IsTrue || operator === Operators.IsFalse) {
      // An expression column may evaluate to a boolean, but that is only a
      // safe assumption while its type is unknown; a declared type wins.
      return (
        isColumnBoolean || isColumnNumber || (isColumnFunction && !column?.type)
      );
    }
    if (isColumnBoolean) {
      return operator === Operators.IsNull || operator === Operators.IsNotNull;
    }
    return (
      props.adhocFilter.clause !== Clauses.Having ||
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
      clause = Clauses.Where;
    } else if (option && 'saved_metric_name' in option) {
      subject = option.saved_metric_name;
      clause = Clauses.Having;
    } else if (option?.label) {
      subject = option.label;
      clause = Clauses.Having;
    }
    let { operator, operatorId, comparator } = props.adhocFilter;
    operator =
      operator &&
      operatorId &&
      isOperatorRelevant(operatorId as Operators, subject)
        ? OPERATOR_ENUM_TO_OPERATOR_TYPE[
            operatorId as keyof typeof OPERATOR_ENUM_TO_OPERATOR_TYPE
          ].operation
        : null;
    if (!isDefined(operator)) {
      // The previous operator is not relevant for the new subject; pick a
      // sensible default and reset the comparator. Multi-value (array) columns
      // default to "Contains any" (element membership) rather than the
      // scalar-only IN.
      const newColumn = props.datasource.columns?.find(
        col => col.column_name === subject,
      );
      const defaultOperator =
        newColumn?.type_generic === GenericDataType.MultiValue
          ? Operators.ContainsAny
          : Operators.In;
      operator = defaultOperator;
      operatorId = defaultOperator;
      comparator = undefined;
    }

    if (isTemporalColumn(id, props.datasource)) {
      subject = id;
      operator = Operators.TemporalRange;
      operatorId = Operators.TemporalRange;
      comparator = defaultTimeFilter;
    }

    props.onChange(
      props.adhocFilter.duplicateWith({
        subject,
        clause,
        operator,
        expressionType: ExpressionTypes.Simple,
        operatorId,
        comparator,
      }),
    );
  };
  const onOperatorChange = (operatorId: Operators) => {
    const currentComparator = props.adhocFilter.comparator;
    // The value space differs between operator families: element-level array
    // ops (Contains any/all) take individual elements, whole-array/scalar ops
    // (=, In, …) take whole arrays or scalars, Length ops take a count, and the
    // unary ops take nothing. A value from one family is meaningless in another,
    // so reset the value when the family changes (e.g. Equal to -> Contains all).
    const comparatorKind = (op?: Operators): string => {
      if (!op) return 'none';
      if (op === Operators.ContainsAny || op === Operators.ContainsAll) {
        return 'element';
      }
      if (
        op === Operators.LengthEquals ||
        op === Operators.LengthGreaterThan ||
        op === Operators.LengthLessThan ||
        op === Operators.LengthGreaterThanOrEqual ||
        op === Operators.LengthLessThanOrEqual
      ) {
        return 'length';
      }
      if (DISABLE_INPUT_OPERATORS.includes(op)) return 'none';
      return 'value';
    };
    const valueFamilyChanged =
      comparatorKind(props.adhocFilter.operatorId as Operators | undefined) !==
      comparatorKind(operatorId);

    let newComparator;
    if (valueFamilyChanged) {
      newComparator = undefined;
    } else if (MULTI_OPERATORS.has(operatorId)) {
      // convert between list of comparators and individual comparators
      // (e.g. `in ('North America', 'Africa')` to `== 'North America'`)
      newComparator = Array.isArray(currentComparator)
        ? currentComparator
        : [currentComparator].filter(element => element != null);
    } else {
      newComparator = Array.isArray(currentComparator)
        ? currentComparator[0]
        : currentComparator;
    }
    if (operatorId && CUSTOM_OPERATORS.has(operatorId)) {
      props.onChange(
        props.adhocFilter.duplicateWith({
          subject: props.adhocFilter.subject,
          clause: Clauses.Where,
          operatorId,
          operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[operatorId].operation,
          expressionType: ExpressionTypes.Sql,
          datasource: props.datasource,
        }),
      );
    } else {
      props.onChange(
        props.adhocFilter.duplicateWith({
          operatorId,
          operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[operatorId].operation,
          comparator: newComparator,
          expressionType: ExpressionTypes.Simple,
        }),
      );
    }
  };
  const onComparatorChange = (comparator: string) => {
    props.onChange(
      props.adhocFilter.duplicateWith({
        comparator,
        expressionType: ExpressionTypes.Simple,
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
  const onDatePickerChange = (columnName: string, timeRange: string) => {
    props.onChange(
      props.adhocFilter.duplicateWith({
        subject: columnName,
        operator: Operators.TemporalRange,
        comparator: timeRange,
        expressionType: ExpressionTypes.Simple,
      }),
    );
  };
  return {
    onSubjectChange,
    onOperatorChange,
    onComparatorChange,
    isOperatorRelevant,
    clearOperator,
    onDatePickerChange,
  };
};

const AdhocFilterEditPopoverSimpleTabContent: FC<Props> = props => {
  const {
    onSubjectChange,
    onOperatorChange,
    isOperatorRelevant,
    onComparatorChange,
    onDatePickerChange,
  } = useSimpleTabFilterProps(props);
  const [comparator, setComparator] = useState(props.adhocFilter.comparator);
  const comparatorInputRef = useRef<InputRef | null>(null);
  const comparatorSelectRef = useRef<AsyncSelectRef>(null);
  const [loadedOptionCount, setLoadedOptionCount] = useState(0);
  const [optionsTruncated, setOptionsTruncated] = useState(false);
  const [suggestionsUnavailable, setSuggestionsUnavailable] = useState(false);
  // Identity of the newest suggestions request. A slow response that loses
  // the race -- a failing fetch resolving after a newer search succeeded, or
  // after the column changed -- must not stamp its outcome over the current
  // one, so every state write below is guarded on still being the latest.
  const comparatorRequestRef = useRef(0);
  const [hasFocusedComparator, setHasFocusedComparator] =
    useState<boolean>(false);

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
  const onInputComparatorChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setComparator(value);
    onComparatorChange(value);
  };

  const renderSubjectOptionLabel = (option: ColumnType) => (
    <FilterDefinitionOption
      option={
        option as unknown as {
          column_name?: string;
          saved_metric_name?: string;
          label?: string;
          type?: string;
          [key: string]: unknown;
        }
      }
    />
  );

  const createSuggestionsPlaceholder = () =>
    loadedOptionCount ? t('%s option(s)', loadedOptionCount) : '';

  const handleSubjectChange = (subject: string) => {
    setComparator(undefined);
    onSubjectChange(subject);
  };

  let columns = props.options;
  const { subject, operator, operatorId } = props.adhocFilter;

  const subjectValue =
    typeof subject === 'string'
      ? subject
      : subject && 'column_name' in subject
        ? subject.column_name
        : undefined;

  const subjectSelectProps = {
    ariaLabel: t('Select subject'),
    value: subjectValue,
    onChange: handleSubjectChange,
    notFoundContent: t(
      'No such column found. To filter on a metric, try the Custom SQL tab.',
    ),
    autoFocus: !subject,
    placeholder: '',
  };

  subjectSelectProps.placeholder =
    props.adhocFilter.clause === Clauses.Where
      ? t('%s column(s)', columns.length)
      : t('To filter on a metric, use Custom SQL tab.');
  columns = props.options.filter(
    option => 'column_name' in option && option.column_name,
  );

  const subjectString = typeof subject === 'string' ? subject : '';
  const operatorSelectProps = {
    placeholder: t(
      '%s operator(s)',
      (props.operators ?? OPERATORS_OPTIONS).filter(op =>
        isOperatorRelevantWrapper(op, subjectString),
      ).length,
    ),
    value: operatorId,
    onChange: onOperatorChange,
    autoFocus: !!subjectSelectProps.value && !operator,
    ariaLabel: t('Select operator'),
  };

  const shouldFocusComparator =
    !!subjectSelectProps.value && !!operatorSelectProps.value;

  const isUnaryOperator =
    operatorId !== undefined &&
    DISABLE_INPUT_OPERATORS.includes(operatorId as Operators);

  const canSuggestComparatorValues = Boolean(
    subjectString &&
    props.datasource?.filter_select &&
    props.adhocFilter.clause !== Clauses.Having,
  );

  const hasComparatorOptions =
    (operatorId && MULTI_OPERATORS.has(operatorId as Operators)) ||
    canSuggestComparatorValues;

  // AsyncSelect is labelInValue, so the value it is given has to be labelled
  // too. Handed a bare value it still renders, but `handleOnDeselect` then
  // compares `element.value` against entries that have no `.value`, matches
  // nothing, and the tag cannot be removed.
  //
  // Memoised because AsyncSelect resets its internal selection whenever the
  // identity of `value` changes. A fresh array every render would wipe out
  // each pick as soon as it was made.
  const comparatorSelectValue = useMemo(
    () =>
      Array.isArray(comparator)
        ? comparator.map(toLabeledValue)
        : isDefined(comparator) && comparator !== ''
          ? toLabeledValue(comparator)
          : undefined,
    [comparator],
  );

  const handleComparatorChange = useCallback(
    (value: unknown) => {
      onComparatorChange(unwrapComparator(value) as string);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.adhocFilter, props.onChange],
  );

  const comparatorSelectProps = {
    allowClear: true,
    allowNewOptions: true,
    ariaLabel: t('Comparator option'),
    pageSize: COMPARATOR_PAGE_SIZE,
    // An empty list reads as "this column has no values" unless it says
    // otherwise, so a failed request has to say so -- that silence is how a
    // months-long 500 on every semantic view went unreported. Likewise a capped
    // list reads as the whole set, so an absent value looks like a value that
    // does not exist. Each note is only shown when it applies.
    helperText: suggestionsUnavailable
      ? t('Suggestions could not be loaded. You can still type a value.')
      : optionsTruncated
        ? t(
            'Only the first %s values are listed. Type to search all of them, ' +
              'or enter a value that is not listed.',
            loadedOptionCount,
          )
        : undefined,
    mode:
      operatorId && MULTI_OPERATORS.has(operatorId as Operators)
        ? ('multiple' as const)
        : ('single' as const),
    value: comparatorSelectValue as SelectValue,
    onChange: handleComparatorChange,
    notFoundContent: t('Type a value here'),
    placeholder: createSuggestionsPlaceholder(),
  };

  const comparatorHasValue =
    comparator != null &&
    comparator !== '' &&
    (Array.isArray(comparator)
      ? comparator.length > 0
      : String(comparator).length > 0);
  const labelText = comparatorHasValue ? createSuggestionsPlaceholder() : '';

  const datePicker = useDatePickerInAdhocFilter({
    columnName:
      typeof props.adhocFilter.subject === 'string'
        ? props.adhocFilter.subject
        : undefined,
    timeRange:
      props.adhocFilter.operator === Operators.TemporalRange
        ? (props.adhocFilter.comparator as string | undefined)
        : undefined,
    datasource: props.datasource,
    onChange: onDatePickerChange,
  });

  // Element-level array operators (Contains any / Contains all) search inside
  // the array, so suggest individual elements; whole-array operators (=, In, …)
  // keep the default distinct-array suggestions.
  const arrayElements =
    props.adhocFilter.operatorId === Operators.ContainsAny ||
    props.adhocFilter.operatorId === Operators.ContainsAll;

  // AsyncSelect throws away every loaded option when the identity of its
  // `options` callback changes, so this depends on plain values rather than on
  // `props.datasource`, whose identity the parent does not guarantee.
  const datasourceType = props.datasource?.type;
  const datasourceId = props.datasource?.id;

  const loadComparatorOptions = useCallback(
    async (search: string): Promise<SelectOptionsTypePage> => {
      const col = subjectString;
      if (!col || !canSuggestComparatorValues) {
        return { data: [], totalCount: 0 };
      }

      const requestId = comparatorRequestRef.current + 1;
      comparatorRequestRef.current = requestId;
      const isCurrent = () => comparatorRequestRef.current === requestId;

      const params = new URLSearchParams();
      if (arrayElements) {
        params.set('array_elements', 'true');
      }
      if (search) {
        params.set('q', search);
      }
      const query = params.toString();

      try {
        const { json } = await SupersetClient.get({
          endpoint:
            `/api/v1/datasource/${datasourceType}/${datasourceId}` +
            `/column/${encodeURIComponent(col)}/values/${query ? `?${query}` : ''}`,
        });
        const data = json.result.map((suggestion: unknown) => {
          // Complex column values arrive as JS arrays or objects: whole arrays
          // for MULTI_VALUE columns (e.g. [5, 6, 7]) and Map/Tuple objects for
          // nested-container columns (e.g. {"a": ["x","y"]}). A raw
          // array/object is neither a valid single-select value (antd collapses
          // an array to its first element) nor renderable as a React child (an
          // object throws). Render it as its literal string, which is also
          // exactly what the backend's parse_array_literal expects for the
          // whole-array operators.
          if (suggestion !== null && typeof suggestion === 'object') {
            const literal = JSON.stringify(suggestion);
            return { value: literal, label: literal };
          }
          return {
            value: suggestion as null | number | boolean | string,
            label: optionLabel(suggestion as null | number | boolean | string),
          };
        });

        if (isCurrent()) {
          setLoadedOptionCount(data.length);
          setOptionsTruncated(
            isDefined(json.limit) && data.length >= json.limit,
          );
          setSuggestionsUnavailable(false);
        }

        // The count has to exceed what was returned. AsyncSelect treats
        // `loaded >= totalCount` as "that is every value", sets allValuesLoaded
        // and from then on serves searches by filtering the loaded page
        // client-side -- which is the behaviour this whole change exists to
        // replace. Pagination is held off by COMPARATOR_PAGE_SIZE instead.
        return { data, totalCount: data.length + 1 };
      } catch (error) {
        if (isCurrent()) {
          setLoadedOptionCount(0);
          setOptionsTruncated(false);
          // The empty page keeps the dropdown, and with it the value the
          // user types, in place; the note says why the page is empty.
          setSuggestionsUnavailable(isSuggestionsOutage(error));
        }
        // The count has to exceed the page: an empty page reported as
        // complete (0 >= 0) makes AsyncSelect serve every later search from
        // it, so the server would never be asked again for this column.
        return { data: [], totalCount: 1 };
      }
    },
    [
      subjectString,
      canSuggestComparatorValues,
      datasourceType,
      datasourceId,
      arrayElements,
    ],
  );

  // Options are cached per search term inside AsyncSelect; a different column
  // or a switch to element-level suggestions invalidates all of them, and a
  // note about the previous column's request with them.
  useEffect(() => {
    // The ref only carries the AsyncSelect handle while the suggestions
    // branch is mounted; a column without comparator options renders the
    // plain input, so the method itself is optional too.
    comparatorSelectRef.current?.clearCache?.();
    // Invalidate any in-flight request as well: a slow response for the
    // previous column must not resurface the note after this reset.
    comparatorRequestRef.current += 1;
    setSuggestionsUnavailable(false);
  }, [subjectString, arrayElements]);

  useEffect(() => {
    if (isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)) {
      fetchSubjectAdvancedDataType(
        props.options,
        props.adhocFilter.subject,
        props.validHandler,
      );
    }
  }, [
    props.adhocFilter.subject,
    props.options,
    props.validHandler,
    fetchSubjectAdvancedDataType,
  ]);

  useEffect(() => {
    if (isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)) {
      const comparatorValue =
        comparator === undefined
          ? ''
          : typeof comparator === 'string'
            ? comparator
            : String(comparator);
      fetchAdvancedDataTypeValueCallback(
        comparatorValue,
        advancedDataTypesState,
        subjectAdvancedDataType,
      );
    }
    // advancedDataTypesState intentionally omitted - set by the callback, would cause infinite API calls
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparator, subjectAdvancedDataType, fetchAdvancedDataTypeValueCallback]);

  useEffect(() => {
    if (isFeatureEnabled(FeatureFlag.EnableAdvancedDataTypes)) {
      setComparator(props.adhocFilter.comparator);
    }
  }, [props.adhocFilter.comparator]);

  useEffect(() => {
    if (
      shouldFocusComparator &&
      !hasFocusedComparator &&
      comparatorInputRef.current
    ) {
      comparatorInputRef.current.focus();
      setHasFocusedComparator(true);
    }

    if (!shouldFocusComparator) {
      setHasFocusedComparator(false);
    }
  }, [shouldFocusComparator, hasFocusedComparator]);

  const theme = useTheme();

  // another name for columns, just for following previous naming.
  const subjectComponent = (
    <Select
      css={{
        marginBottom: theme.marginXS,
      }}
      data-test="select-element"
      options={columns.map(column => ({
        value:
          ('column_name' in column && column.column_name) ||
          ('optionName' in column && column.optionName) ||
          '',
        key:
          ('id' in column && column.id) ||
          ('optionName' in column && column.optionName) ||
          undefined,
        label: renderSubjectOptionLabel(column),
        column_name: 'column_name' in column ? column.column_name : undefined,
        verbose_name:
          'verbose_name' in column ? column.verbose_name : undefined,
      }))}
      optionFilterProps={['column_name', 'verbose_name']}
      {...subjectSelectProps}
    />
  );

  const operatorsAndOperandComponent = (
    <>
      <Select
        options={(props.operators ?? OPERATORS_OPTIONS)
          .filter(op => isOperatorRelevantWrapper(op, subjectString))
          .map((option, index) => ({
            value: option,
            label: OPERATOR_ENUM_TO_OPERATOR_TYPE[option].display,
            key: option,
            order: index,
          }))}
        {...operatorSelectProps}
      />
      {!isUnaryOperator &&
        (hasComparatorOptions ? (
          <Tooltip
            title={
              advancedDataTypesState.errorMessage ||
              advancedDataTypesState.parsedAdvancedDataType
            }
          >
            <SelectWithLabel
              ref={comparatorSelectRef}
              css={css`
                margin-top: ${theme.marginXS}px;
              `}
              labelText={labelText}
              options={loadComparatorOptions}
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
            <div
              css={css`
                margin-top: ${theme.marginXS}px;
              `}
            />
            <Input
              data-test="adhoc-filter-simple-value"
              name="filter-value"
              ref={comparatorInputRef}
              onChange={onInputComparatorChange}
              value={typeof comparator === 'string' ? comparator : undefined}
              placeholder={t('Filter value (case sensitive)')}
            />
          </Tooltip>
        ))}
    </>
  );
  return (
    <>
      {subjectComponent}
      {datePicker ?? operatorsAndOperandComponent}
    </>
  );
};

export default AdhocFilterEditPopoverSimpleTabContent;
