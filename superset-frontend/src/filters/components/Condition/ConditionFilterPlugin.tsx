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
import { t } from '@apache-superset/core/translation';
import {
  AppSection,
  ensureIsArray,
  finestTemporalGrainFormatter,
  getColumnLabel,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { styled } from '@apache-superset/core/theme';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormItem, Input, Select } from '@superset-ui/core/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import { getDataRecordFormatter } from '../../utils';
import { FilterPluginStyle, StatusMessage } from '../common';
import {
  ConditionOperator,
  ConditionValue,
  PluginFilterConditionProps,
} from './types';
import {
  getAllowedOperators,
  getConditionError,
  getConditionExtraFormData,
  getConditionLabel,
  isConditionComplete,
  isSetConditionOperator,
  isUnaryConditionOperator,
} from './utils';

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  '==': '=',
  '!=': '!=',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  LIKE: 'LIKE',
  IN: 'IN',
  'NOT IN': 'NOT IN',
  'IS NULL': 'IS NULL',
  'IS NOT NULL': 'IS NOT NULL',
};

// Operators that pick from the column's existing values. The rest are
// free text (comparisons and LIKE patterns rarely match an existing value).
const PICKER_OPERATORS: ConditionOperator[] = ['==', '!=', 'IN', 'NOT IN'];

// The Select only takes string or number values. Booleans are shown as
// strings and cast back by coerceConditionValue.
const toSelectValue = (value: unknown): string | number =>
  typeof value === 'number' ? value : String(value);

const Wrapper = styled.div<{ horizontal: boolean }>`
  display: flex;
  flex-direction: ${({ horizontal }) => (horizontal ? 'row' : 'column')};
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  width: 100%;

  .condition-operator {
    min-width: ${({ theme }) => theme.sizeUnit * 30}px;
  }

  .condition-value {
    flex: 1;
    min-width: ${({ theme }) => theme.sizeUnit * 40}px;
  }
`;

export default function ConditionFilterPlugin(
  props: PluginFilterConditionProps,
) {
  const {
    data,
    coltype,
    formData,
    height,
    width,
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
    setHoveredFilter,
    unsetHoveredFilter,
    setFilterActive,
    filterState,
    inputRef,
    appSection,
    filterBarOrientation = FilterBarOrientation.Vertical,
    isOverflowingFilterBar,
  } = props;
  const { groupby, enableEmptyFilter, defaultValue } = formData;
  const [col = ''] = ensureIsArray(groupby).map(getColumnLabel);

  const [condition, setCondition] = useState<ConditionValue>(
    filterState.value ??
      defaultValue ?? { op: getAllowedOperators(coltype)[0] },
  );

  // The filter bar overrides validateStatus with its own required-value
  // check, so errors about the condition itself are computed and shown here.
  const conditionError = getConditionError(condition, coltype);

  const updateDataMask = useCallback(
    (next: ConditionValue, { restored = false } = {}) => {
      if (getConditionError(next, coltype)) {
        // While the user is typing, keep the last valid condition so Apply
        // can't silently drop the filter. A restored condition that no longer
        // fits the column type is cleared so the charts don't receive it.
        if (restored) {
          setDataMask({
            extraFormData: {},
            filterState: { value: null, label: '', validateStatus: undefined },
          });
        }
        return;
      }
      if (isConditionComplete(next)) {
        setDataMask({
          extraFormData: getConditionExtraFormData(col, next, coltype),
          filterState: {
            value: next,
            label: getConditionLabel(col, next),
            validateStatus: undefined,
          },
        });
      } else if (enableEmptyFilter) {
        setDataMask({
          extraFormData: {},
          filterState: {
            value: null,
            label: '',
            validateStatus: 'error',
            validateMessage: t('Please enter a condition'),
          },
        });
      } else {
        setDataMask({
          extraFormData: {},
          filterState: { value: null, label: '', validateStatus: undefined },
        });
      }
    },
    [col, coltype, enableEmptyFilter, setDataMask],
  );

  const handleChange = useCallback(
    (next: ConditionValue) => {
      setCondition(next);
      updateDataMask(next);
    },
    [updateDataMask],
  );

  // Keep local state in sync with external changes (defaults, "Clear all",
  // permalinks) and make sure a restored value is applied to the charts.
  useEffect(() => {
    const value = filterState.value as ConditionValue | null | undefined;
    if (isConditionComplete(value)) {
      setCondition(value);
      updateDataMask(value, { restored: true });
    } else if (value === null || value === undefined) {
      // Cleared from outside: keep the chosen operator, drop the value.
      setCondition(prev => ({ op: prev.op }));
      if (enableEmptyFilter && !filterState.validateStatus) {
        updateDataMask({ op: condition.op });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filterState.value), enableEmptyFilter, col, coltype]);

  const handleOperatorChange = (op: ConditionOperator) => {
    let val: ConditionValue['val'];
    if (isUnaryConditionOperator(op)) {
      val = undefined;
    } else if (isSetConditionOperator(op)) {
      // Switching e.g. from "=" to "IN" keeps the value as the first item.
      val = ensureIsArray(condition.val);
    } else {
      val = Array.isArray(condition.val) ? condition.val[0] : condition.val;
    }
    handleChange({ op, val });
  };

  const valueOptions = useMemo(() => {
    const values = data
      .map(row => row[col])
      .filter(value => value !== null && value !== undefined);
    const formatLabel = getDataRecordFormatter({
      timeFormatter: finestTemporalGrainFormatter(values),
    });
    const seen = new Set<string>();
    return values
      .filter(value => {
        const key = String(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(value => ({
        value: toSelectValue(value),
        label: formatLabel(value, coltype ?? GenericDataType.String),
      }));
  }, [data, col, coltype]);

  const operatorOptions = useMemo(
    () =>
      getAllowedOperators(coltype).map(op => ({
        value: op,
        label: OPERATOR_LABELS[op],
      })),
    [coltype],
  );

  const getPopupContainer = useCallback(
    (trigger: HTMLElement) =>
      appSection === AppSection.FilterConfigModal
        ? (trigger?.parentNode as HTMLElement) || document.body
        : document.body,
    [appSection],
  );

  const { op } = condition;
  const errorMessage =
    conditionError ??
    (filterState.validateStatus === 'error'
      ? filterState.validateMessage
      : undefined);
  const status = errorMessage ? 'error' : undefined;

  const renderValueInput = () => {
    if (isUnaryConditionOperator(op)) {
      return null;
    }
    if (PICKER_OPERATORS.includes(op)) {
      const multiple = isSetConditionOperator(op);
      return (
        <Select
          // Remount when switching between single and multiple values so the
          // Select doesn't keep a stale value of the wrong shape.
          key={multiple ? 'multiple' : 'single'}
          className="condition-value"
          ariaLabel={t('Condition value')}
          data-test="condition-filter-value-select"
          allowClear
          allowNewOptions
          showSearch
          mode={multiple ? 'multiple' : 'single'}
          value={
            multiple
              ? ensureIsArray(condition.val).map(toSelectValue)
              : condition.val === undefined || condition.val === null
                ? undefined
                : toSelectValue(condition.val)
          }
          options={valueOptions}
          placeholder={multiple ? t('Select values') : t('Select a value')}
          getPopupContainer={getPopupContainer}
          oneLine={filterBarOrientation === FilterBarOrientation.Horizontal}
          status={status}
          // @ts-expect-error Select's onChange is typed for LabeledValue
          onChange={(val: ConditionValue['val']) => handleChange({ op, val })}
          onClear={() => handleChange({ op, val: multiple ? [] : undefined })}
          onOpenChange={setFilterActive}
        />
      );
    }
    return (
      <Input
        className="condition-value"
        aria-label={t('Condition value')}
        data-test="condition-filter-value-input"
        allowClear
        status={status}
        placeholder={op === 'LIKE' ? t('e.g. %value%') : t('Enter a value')}
        value={
          condition.val === undefined || condition.val === null
            ? ''
            : String(condition.val)
        }
        onChange={event => handleChange({ op, val: event.target.value })}
      />
    );
  };

  return (
    <FilterPluginStyle height={height} width={width}>
      <FormItem aria-labelledby={`filter-name-${formData.nativeFilterId}`}>
        <Wrapper
          ref={inputRef}
          tabIndex={-1}
          horizontal={
            filterBarOrientation === FilterBarOrientation.Horizontal &&
            !isOverflowingFilterBar
          }
          onFocus={setFocusedFilter}
          onBlur={unsetFocusedFilter}
          onMouseEnter={setHoveredFilter}
          onMouseLeave={unsetHoveredFilter}
        >
          <Select
            className="condition-operator"
            ariaLabel={t('Condition operator')}
            data-test="condition-filter-operator"
            value={op}
            options={operatorOptions}
            getPopupContainer={getPopupContainer}
            onChange={handleOperatorChange}
            onOpenChange={setFilterActive}
          />
          {renderValueInput()}
        </Wrapper>
        {errorMessage && (
          <StatusMessage status="error">{errorMessage}</StatusMessage>
        )}
      </FormItem>
    </FilterPluginStyle>
  );
}
