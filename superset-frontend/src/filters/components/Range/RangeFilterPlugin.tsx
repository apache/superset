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
  enableSingleValue?: boolean;
}>`
  display: flex;
  justify-content: space-between;
  flex-direction: ${({ enableSingleValue }) =>
    enableSingleValue ? 'column' : 'row'};

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
  if (enableSingleExactValue && lower !== null) {
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

  const enableSingleMinValue = enableSingleValue === SingleValueType.Minimum;
  const enableSingleMaxValue = enableSingleValue === SingleValueType.Maximum;
  const enableSingleExactValue = enableSingleValue === SingleValueType.Exact;

  const [col = ''] = ensureIsArray(groupby).map(getColumnLabel);
  const [value, setValue] = useState<[number, number]>(
    defaultValue ?? [min, enableSingleExactValue ? min : max],
  );

  const minIndex = 0;
  const maxIndex = 1;
  const minMax = value ?? [min, max];

  const getBounds = useCallback(
    (
      value: [number, number],
    ): { lower: number | null; upper: number | null } => {
      const [lowerRaw, upperRaw] = value;

      if (enableSingleExactValue) {
        return { lower: lowerRaw, upper: upperRaw };
      }

      return {
        lower: lowerRaw > min ? lowerRaw : null,
        upper: upperRaw < max ? upperRaw : null,
      };
    },
    [max, min, enableSingleExactValue],
  );

  const handleAfterChange = useCallback(
    (value: [number, number]): void => {
      const { lower, upper } = getBounds(value);
      setDataMask({
        extraFormData: getRangeExtraFormData(col, lower, upper),
        filterState: {
          value: lower !== null || upper !== null ? value : null,
          label: getLabel(lower, upper, enableSingleExactValue),
        },
      });
    },
    [col, getBounds, setDataMask],
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

  const handleChange = (newValue: number, index: 0 | 1) => {
    const updatedValue: [number, number] = [...value];

    if (enableSingleExactValue) {
      setValue([newValue, newValue]);
      handleAfterChange([newValue, newValue]);
      return;
    }
    if (enableSingleMinValue) {
      updatedValue[minIndex] = newValue;
      setValue(updatedValue);
      handleAfterChange(updatedValue);
      return;
    }

    if (enableSingleMaxValue) {
      updatedValue[maxIndex] = newValue;
      setValue(updatedValue);
      handleAfterChange(updatedValue);
      return;
    }

    if (index === minIndex && newValue > updatedValue[maxIndex]) {
      updatedValue[minIndex] = min;
    } else if (index === maxIndex && newValue < updatedValue[minIndex]) {
      updatedValue[maxIndex] = max;
    } else {
      updatedValue[index] = newValue;
    }
    setValue(updatedValue);
    handleAfterChange(updatedValue);
  };

  useEffect(() => {
    // when switch filter type and queriesData still not updated we need ignore this case (in FilterBar)
    if (row?.min === undefined && row?.max === undefined) {
      return;
    }
    const filterStateValue = filterState.value ?? minMax;
    setValue(filterStateValue);
    handleAfterChange(filterStateValue);
  }, [
    enableSingleMaxValue,
    enableSingleMinValue,
    enableSingleExactValue,
    JSON.stringify(filterState.value),
    JSON.stringify(data),
  ]);

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

  useEffect(() => {
    if (enableSingleMaxValue) {
      setValue([min, minMax[maxIndex]]);
      handleAfterChange([min, minMax[maxIndex]]);
    }
  }, [enableSingleMaxValue]);

  useEffect(() => {
    if (enableSingleMinValue) {
      setValue([minMax[minIndex], max]);
      handleAfterChange([minMax[minIndex], max]);
    }
  }, [enableSingleMinValue]);

  useEffect(() => {
    if (enableSingleExactValue) {
      setValue([minMax[minIndex], minMax[minIndex]]);
      handleAfterChange([minMax[minIndex], minMax[minIndex]]);
    }
  }, [enableSingleExactValue]);

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
            enableSingleValue={enableSingleValue !== undefined}
          >
            {enableSingleValue !== undefined ? (
              <>
                <InputNumber
                  value={
                    enableSingleMaxValue ? minMax[maxIndex] : minMax[minIndex]
                  }
                  min={min}
                  max={max}
                  onChange={val => handleChange(Number(val), minIndex)}
                  placeholder={t('Number')}
                  data-test="native-filter-single-value"
                />
                {filterBarOrientation === FilterBarOrientation.Vertical && (
                  <Metadata value={metadataText} />
                )}
              </>
            ) : (
              <>
                <InputNumber
                  value={minMax[minIndex]}
                  min={min}
                  max={max}
                  onChange={val => handleChange(Number(val), minIndex)}
                  placeholder={t('From')}
                  data-test="native-filter-from-input"
                />
                <StyledDivider>-</StyledDivider>
                <InputNumber
                  value={minMax[maxIndex]}
                  min={min}
                  max={max}
                  onChange={val => handleChange(Number(val), maxIndex)}
                  placeholder={t('To')}
                  data-test="native-filter-to-input"
                />
              </>
            )}
          </Wrapper>
        </StyledFormItem>
      )}
    </FilterPluginStyle>
  );
}
