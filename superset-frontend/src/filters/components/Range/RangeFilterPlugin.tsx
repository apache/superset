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
  ensureIsArray,
  getColumnLabel,
  getNumberFormatter,
  NumberFormats,
  styled,
  t,
} from '@superset-ui/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { InputNumber } from 'src/components/Input';
import { FilterBarOrientation } from 'src/dashboard/types';
import Metadata from 'src/components/Metadata';
import { isNumber } from 'lodash';
import { PluginFilterRangeProps } from './types';
import { StatusMessage, StyledFormItem, FilterPluginStyle } from '../common';
import { getRangeExtraFormData } from '../../utils';
import { SingleValueType } from './SingleValueType';

type InputValue = number | null;

const StyledDivider = styled.span`
  margin: 0 ${({ theme }) => theme.gridUnit * 3}px;
  color: ${({ theme }) => theme.colors.grayscale.light1};
  font-weight: ${({ theme }) => theme.typography.weights.bold};
  font-size: ${({ theme }) => theme.typography.sizes.m}px;
  align-content: center;
`;

const Wrapper = styled.div`
  display: flex;
  justify-content: space-between;

  .antd5-input-number {
    width: 100%;
    position: relative;
  }
`;

const numberFormatter = getNumberFormatter(NumberFormats.SMART_NUMBER);

const getLabel = (
  lower: number | null,
  upper: number | null,
  enableSingleExactValue = false,
): string => {
  if (
    (enableSingleExactValue && lower !== null) ||
    (lower !== null && lower === upper)
  ) {
    return `x = ${numberFormatter(lower)}`;
  }
  if (lower !== null && upper !== null) {
    return `${numberFormatter(lower)} ≤ x ≤ ${numberFormatter(upper)}`;
  }
  if (lower !== null) {
    return `x ≥ ${numberFormatter(lower)}`;
  }
  if (upper !== null) {
    return `x ≤ ${numberFormatter(upper)}`;
  }
  return '';
};

const validateRange = (
  inputMin: InputValue,
  inputMax: InputValue,
  min: number,
  max: number,
  enableEmptyFilter: boolean,
  enableSingleValue?: SingleValueType,
): { isValid: boolean; errorMessage: string | null } => {
  const requiredError = t('Filter value is required');
  const rangeError = t('Please provide a value within range');
  if (enableSingleValue !== undefined) {
    const isSingleMin =
      enableSingleValue === SingleValueType.Minimum ||
      enableSingleValue === SingleValueType.Exact;
    const value = isSingleMin ? inputMin : inputMax;

    if (!value && enableEmptyFilter) {
      return { isValid: false, errorMessage: requiredError };
    }

    if (isNumber(value) && (value < min || value > max)) {
      return { isValid: false, errorMessage: rangeError };
    }

    return { isValid: true, errorMessage: null };
  }

  // Range validation
  if (enableEmptyFilter && (inputMin === null || inputMax === null)) {
    return { isValid: false, errorMessage: t('Please provide a valid range') };
  }

  if (!enableEmptyFilter && (inputMin !== null) !== (inputMax !== null)) {
    return { isValid: false, errorMessage: t('Please provide a valid range') };
  }

  if (inputMin !== null && inputMax !== null) {
    if (inputMin > inputMax) {
      return {
        isValid: false,
        errorMessage: t('Minimum value cannot be higher than maximum value'),
      };
    }
    if (inputMin < min || inputMax > max) {
      return {
        isValid: false,
        errorMessage: t('Your range is not within the dataset range'),
      };
    }
  }

  return { isValid: true, errorMessage: null };
};

export default function RangeFilterPlugin(props: PluginFilterRangeProps) {
  const {
    data,
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
    filterBarOrientation = FilterBarOrientation.Vertical,
  } = props;
  const [row] = data;
  // @ts-ignore
  const { min, max }: { min: number; max: number } = row;
  const { groupby, enableSingleValue, enableEmptyFilter, defaultValue } =
    formData;
  const minIndex = 0;
  const maxIndex = 1;
  const enableSingleMinValue = enableSingleValue === SingleValueType.Minimum;
  const enableSingleMaxValue = enableSingleValue === SingleValueType.Maximum;
  const enableSingleExactValue = enableSingleValue === SingleValueType.Exact;
  const rangeInput = enableSingleValue === undefined;

  const [col = ''] = ensureIsArray(groupby).map(getColumnLabel);

  const [inputValue, setInputValue] = useState<[InputValue, InputValue]>([
    null,
    null,
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (row?.min === undefined && row?.max === undefined) {
      return;
    }

    if (
      filterState.validateStatus === 'error' &&
      error !== filterState.validateMessage
    ) {
      setError(filterState.validateMessage);

      const inputMin = inputValue[minIndex];
      const inputMax = inputValue[maxIndex];

      const { isValid, errorMessage } = validateRange(
        inputMin,
        inputMax,
        min,
        max,
        enableEmptyFilter,
        enableSingleValue,
      );

      const isDefaultError =
        inputMin === null &&
        inputMax === null &&
        filterState.validateStatus === 'error';

      if (!isValid || isDefaultError) {
        setError(errorMessage);
        setDataMask({
          extraFormData: getRangeExtraFormData(col, null, null),
          filterState: {
            value: null,
            label: '',
            validateStatus: 'error',
            validateMessage: errorMessage,
          },
        });
        return;
      }

      setError(null);
      setDataMask({
        extraFormData: getRangeExtraFormData(col, inputMin, inputMax),
        filterState: {
          value: enableSingleExactValue
            ? [inputMin, inputMin]
            : [inputMin, inputMax],
          label: getLabel(inputMin, inputMax, enableSingleExactValue),
          validateStatus: undefined,
          validateMessage: '',
        },
      });
      return;
    }
    if (filterState.validateStatus === 'error') {
      setError(filterState.validateMessage);
      return;
    }

    // Default value case
    if (defaultValue && !filterState.value) {
      setInputValue(defaultValue);
      const [minVal, maxVal] = defaultValue;
      setDataMask({
        extraFormData: getRangeExtraFormData(col, minVal, maxVal),
        filterState: {
          value: defaultValue,
          label: getLabel(minVal, maxVal, enableSingleExactValue),
          validateStatus: undefined,
          validateMessage: '',
        },
      });
      return;
    }
    // Clear all case
    if (!filterState.value && !filterState.validateStatus) {
      setInputValue([null, null]);
      setDataMask({
        extraFormData: getRangeExtraFormData(col, null, null),
        filterState: {
          value: [null, null],
          label: '',
          validateStatus: undefined,
          validateMessage: '',
        },
      });
      return;
    }
    // Filter state is pre-set case
    if (filterState.value && !filterState.validateStatus) {
      setInputValue(filterState.value);
      const [minVal, maxVal] = filterState.value;
      setDataMask({
        extraFormData: getRangeExtraFormData(col, minVal, maxVal),
        filterState: {
          value: filterState.value,
          label: getLabel(minVal, maxVal, enableSingleExactValue),
          validateStatus: undefined,
          validateMessage: '',
        },
      });
    }
  }, [filterState.value]);

  const metadataText = useMemo(() => {
    if (enableSingleMinValue) {
      return t('Filters for values greater than or equal.');
    }
    if (enableSingleMaxValue) {
      return t('Filters for values less than or equal.');
    }
    if (enableSingleExactValue) {
      return t('Filters for values equal to this exact value.');
    }
    return '';
  }, [enableSingleValue]);

  const handleChange = useCallback(
    (newValue: number | null, index: 0 | 1) => {
      if (row?.min === undefined && row?.max === undefined) {
        return;
      }
      const newInputValue: [number | null, number | null] =
        index === minIndex
          ? [newValue, inputValue[maxIndex]]
          : [inputValue[minIndex], newValue];

      setInputValue(newInputValue);

      const inputMin = newInputValue[minIndex];
      const inputMax = newInputValue[maxIndex];

      const { isValid, errorMessage } = validateRange(
        inputMin,
        inputMax,
        min,
        max,
        enableEmptyFilter,
        enableSingleValue,
      );

      if (!isValid) {
        setError(errorMessage);
        setDataMask({
          extraFormData: getRangeExtraFormData(col, null, null),
          filterState: {
            value: null,
            label: '',
            validateStatus: 'error',
            validateMessage: errorMessage,
          },
        });
        return;
      }

      setError(null);
      console.log({ inputMin, inputMax });
      setDataMask({
        extraFormData: getRangeExtraFormData(col, inputMin, inputMax),
        filterState: {
          value: enableSingleExactValue
            ? [inputMin, inputMin]
            : [inputMin, inputMax],
          label: getLabel(inputMin, inputMax, enableSingleExactValue),
          validateStatus: undefined,
          validateMessage: '',
        },
      });
    },
    [col, min, max, enableEmptyFilter, enableSingleValue, setDataMask],
  );

  const formItemExtra = useMemo(() => {
    if (error) {
      return <StatusMessage status="error">{error}</StatusMessage>;
    }
    return undefined;
  }, [error]);

  useEffect(() => {
    switch (enableSingleValue) {
      case SingleValueType.Minimum:
      case SingleValueType.Exact:
        setInputValue(prev => [prev[minIndex], null]);
        break;
      case SingleValueType.Maximum:
        setInputValue(prev => [null, prev[maxIndex]]);
        break;
      default:
        break;
    }
  }, [enableSingleValue]);

  return (
    <FilterPluginStyle height={height} width={width}>
      {Number.isNaN(Number(min)) || Number.isNaN(Number(max)) ? (
        <h4>{t('Chosen non-numeric column')}</h4>
      ) : (
        <StyledFormItem
          aria-labelledby={`filter-name-${formData.nativeFilterId}`}
          extra={formItemExtra}
        >
          <Wrapper
            tabIndex={-1}
            ref={inputRef}
            onFocus={setFocusedFilter}
            onBlur={unsetFocusedFilter}
            onMouseEnter={setHoveredFilter}
            onMouseLeave={unsetHoveredFilter}
            onMouseDown={() => setFilterActive(true)}
            onMouseUp={() => setFilterActive(false)}
          >
            {(enableSingleValue === SingleValueType.Minimum ||
              enableSingleValue === SingleValueType.Exact ||
              enableSingleValue === undefined) && (
              <InputNumber
                value={inputValue[minIndex]}
                onChange={val => handleChange(val, minIndex)}
                placeholder={`${min}`}
                status={filterState.validateStatus}
                data-test="range-filter-from-input"
              />
            )}
            {enableSingleValue === undefined && (
              <StyledDivider>-</StyledDivider>
            )}
            {(enableSingleValue === SingleValueType.Maximum ||
              enableSingleValue === undefined) && (
              <InputNumber
                value={inputValue[maxIndex]}
                onChange={val => handleChange(val, maxIndex)}
                placeholder={`${max}`}
                data-test="range-filter-to-input"
                status={filterState.validateStatus}
              />
            )}
          </Wrapper>
          {(rangeInput ||
            filterBarOrientation === FilterBarOrientation.Vertical) &&
            !filterState.validateStatus && <Metadata value={metadataText} />}
        </StyledFormItem>
      )}
    </FilterPluginStyle>
  );
}
