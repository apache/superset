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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InputNumber } from 'src/components/Input';
import { FilterBarOrientation } from 'src/dashboard/types';
import Metadata from 'src/components/Metadata';
import { PluginFilterRangeProps } from './types';
import { StatusMessage, StyledFormItem, FilterPluginStyle } from '../common';
import { getRangeExtraFormData } from '../../utils';
import { SingleValueType } from './SingleValueType';

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
  const { groupby, defaultValue, enableSingleValue, enableEmptyFilter } =
    formData;
  const minIndex = 0;
  const maxIndex = 1;
  const enableSingleMinValue = enableSingleValue === SingleValueType.Minimum;
  const enableSingleMaxValue = enableSingleValue === SingleValueType.Maximum;
  const enableSingleExactValue = enableSingleValue === SingleValueType.Exact;

  const [col = ''] = ensureIsArray(groupby).map(getColumnLabel);

  const [inputValue, setInputValue] = useState<[number | null, number | null]>([null, null]);
  const currentInputValues = useRef<[number | null, number | null]>([null, null]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (filterState.value) {
      currentInputValues.current = filterState.value;
      setInputValue(filterState.value);
    } else {
      // clear all scenario
      if (filterState.validateStatus === undefined) {
        currentInputValues.current = [null, null];
        setInputValue([null, null]);
        return;
      }
      if (defaultValue) {
        currentInputValues.current = defaultValue;
        setInputValue(defaultValue);
      }
    }
  }, [filterState.value]);

  const getBounds = useCallback(
    (
      value: [number | null, number | null],
    ): { lower: number | null; upper: number | null } => {
      const [lowerRaw, upperRaw] = value;

      return {
        lower: lowerRaw !== null && lowerRaw > min ? lowerRaw : null,
        upper: upperRaw !== null && upperRaw < max ? upperRaw : null,
      };
    },
    [max, min],
  );

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

  const handleChange = (newValue: number | null, index: 0 | 1) => {
    if (index === minIndex) {
      currentInputValues.current = [newValue, currentInputValues.current[1]];
      setInputValue([newValue, currentInputValues.current[1]]);
    } else {
      currentInputValues.current = [currentInputValues.current[0], newValue];
      setInputValue([currentInputValues.current[0], newValue]);
    }
  };

  const handleBlur = () => {
    let realValue = inputValue;
    const inputMin = inputValue[minIndex];
    const inputMax = inputValue[maxIndex];

    if (enableSingleExactValue) {
      realValue = [inputValue[minIndex], realValue[minIndex]];
    }
    if (enableSingleMinValue) {
      realValue = [inputValue[minIndex], null];
    }
    if (enableSingleMaxValue) {
      realValue = [null, inputValue[maxIndex]];
    }

    // checking that min and max are valid
    // const { lower: isMin, upper: isMaxHig } = getBounds(realValue);

    let isRangeValid = true;
    let errorMessage = t('Please provide a valid range');

    if (enableEmptyFilter) {
      // filter can never be empty
      if (inputMin === null || inputMax === null) {
        isRangeValid = false;
      }
    }

    if (!enableEmptyFilter) {
      // if the filter is not required but any of the two is set, then the other must be set
      if (
        (inputMin != null && inputMax === null) ||
        (inputMin === null && inputMax != null)
      ) {
        isRangeValid = false;
      }
    }

    // min is higher than max
    if (inputMin !== null && inputMax !== null && inputMin > inputMax) {
      isRangeValid = false;
      errorMessage = t('Minimum value cannot be higher than maximum value');
    }

    // max is lower than min
    if (inputMin !== null && inputMax !== null && inputMax < inputMin) {
      isRangeValid = false;
      errorMessage = t('Maximum value cannot be lower than minimum value');
    }

    // input values are not within dataset ranges
    if (
      inputMin !== null &&
      inputMax !== null &&
      (inputMin < min || inputMax > max)
    ) {
      isRangeValid = false;
      errorMessage = t('Your range is not within the dataset range');
    }

    if (!isRangeValid) {
      setError(errorMessage);
      setDataMask({
        extraFormData: getRangeExtraFormData(col, null, null),
        filterState: {
          value: undefined,
          label: '',
          validateStatus: 'error',
          validateMessage: errorMessage,
        },
      });
      return;
    }
    setInputValue(() => {
      setError(null);
      setDataMask({
        extraFormData: getRangeExtraFormData(col, inputMin, inputMax),
        filterState: {
          value: [inputMin, inputMax],
          label: getLabel(inputMin, inputMax, enableSingleExactValue),
          validateStatus: 'success',
          validateMessage: '',
        },
      });
      return [inputMin, inputMax];
    });
  };

  useEffect(() => {
    if (row?.min === undefined && row?.max === undefined) {
      return;
    }
    if (filterState.value) {
      setInputValue(filterState.value);
      return;
    }
    setInputValue([null, null]);
    setDataMask({
      extraFormData: getRangeExtraFormData(col, null, null),
      filterState: {
        value: undefined,
        label: '',
      },
    });
  }, [row?.min, row?.max, JSON.stringify(filterState.value), getBounds]);

  const formItemExtra = useMemo(() => {
    if (error) {
      return (
        <StatusMessage status="error">
          {error}
        </StatusMessage>
      );
    }
    return undefined;
  }, [error]);

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
            {(enableSingleValue === 0 ||
              enableSingleValue === 1 ||
              enableSingleValue === undefined) && (
              <InputNumber
                value={currentInputValues.current[0]}
                onChange={val => handleChange(val, minIndex)}
                onBlur={() => handleBlur()}
                placeholder={`${min}`}
                status={filterState.validateStatus}
                data-test="range-filter-from-input"
              />
            )}
            {enableSingleValue === undefined && (
              <StyledDivider>-</StyledDivider>
            )}
            {(enableSingleValue === 2 || enableSingleValue === undefined) && (
              <InputNumber
                value={currentInputValues.current[1]}
                onChange={val => handleChange(val, maxIndex)}
                onBlur={() => handleBlur()}
                placeholder={`${max}`}
                data-test="range-filter-to-input"
                status={filterState.validateStatus}
              />
            )}
          </Wrapper>
          {(enableSingleValue !== undefined ||
            filterBarOrientation === FilterBarOrientation.Vertical) &&
            !filterState.validateStatus && <Metadata value={metadataText} />}
        </StyledFormItem>
      )}
    </FilterPluginStyle>
  );
}
