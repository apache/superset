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

const Wrapper = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
  orientation?: FilterBarOrientation;
  isOverflowing?: boolean;
}>`
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
    isOverflowingFilterBar,
  } = props;
  const [row] = data;
  // @ts-ignore
  const { min, max }: { min: number; max: number } = row;
  const { groupby, defaultValue, enableSingleValue } = formData;
  const minIndex = 0;
  const maxIndex = 1;
  const enableSingleMinValue = enableSingleValue === SingleValueType.Minimum;
  const enableSingleMaxValue = enableSingleValue === SingleValueType.Maximum;
  const enableSingleExactValue = enableSingleValue === SingleValueType.Exact;

  const [col = ''] = ensureIsArray(groupby).map(getColumnLabel);
  const [inputValue, setInputValue] = useState<[number | null, number | null]>(
    filterState.value != null
      ? filterState.value
      : (defaultValue ?? [null, null]),
  );

  const getBounds = useCallback(
    (
      value: [number | null, number | null],
    ): { lower: number | null; upper: number | null } => {
      const [lowerRaw, upperRaw] = value;

      // if (enableSingleExactValue) {
      //   return { lower: lowerRaw, upper: upperRaw };
      // }

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
    setInputValue(prev => {
      if (index === minIndex) {
        return [newValue, prev[maxIndex]];
      }
      return [prev[minIndex], newValue];
    });
  };

  const handleBlur = (index: 0 | 1) => {
    if (inputValue[index] === null) {
      return;
    }

    let realValue = inputValue;

    if (enableSingleExactValue) {
      realValue = [inputValue[minIndex], realValue[minIndex]];
    }
    if (enableSingleMinValue) {
      realValue = [inputValue[minIndex], null];
    }
    if (enableSingleMaxValue) {
      realValue = [null, inputValue[maxIndex]];
    }

    const { lower, upper } = getBounds(realValue);
    setInputValue(() => {
      setDataMask({
        extraFormData: getRangeExtraFormData(col, lower, upper),
        filterState: {
          value: [lower, upper],
          label: getLabel(lower, upper, enableSingleExactValue),
        },
      });
      return [lower, upper];
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
        value: null,
        label: '',
      },
    });
  }, [row?.min, row?.max, filterState?.value, getBounds]);

  const formItemExtra = useMemo(() => {
    if (filterState.validateMessage) {
      return (
        <StatusMessage status={filterState.validateStatus}>
          {filterState.validateMessage}
        </StatusMessage>
      );
    }
    return undefined;
  }, [filterState.validateMessage, filterState.validateStatus]);

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
            validateStatus={filterState.validateStatus}
            orientation={filterBarOrientation}
            isOverflowing={isOverflowingFilterBar}
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
                value={inputValue[0]}
                min={min}
                max={inputValue[maxIndex] ?? max}
                onChange={val => handleChange(val, minIndex)}
                onBlur={() => handleBlur(minIndex)}
                placeholder={`${min}`}
                data-test="range-filter-min-input"
              />
            )}
            {enableSingleValue === undefined && (
              <StyledDivider>-</StyledDivider>
            )}
            {(enableSingleValue === 2 || enableSingleValue === undefined) && (
              <InputNumber
                value={inputValue[1]}
                min={inputValue[minIndex] ?? min}
                max={max}
                onChange={val => handleChange(val, maxIndex)}
                onBlur={() => handleBlur(maxIndex)}
                placeholder={`${max}`}
                data-test="range-filter-max-input"
              />
            )}
            {(enableSingleValue !== undefined ||
              filterBarOrientation === FilterBarOrientation.Vertical) && (
              <Metadata value={metadataText} />
            )}
          </Wrapper>
        </StyledFormItem>
      )}
    </FilterPluginStyle>
  );
}
