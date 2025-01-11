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
import { PluginFilterRangeProps } from './types';
import { StatusMessage, StyledFormItem, FilterPluginStyle } from '../common';
import { getRangeExtraFormData } from '../../utils';
import { SingleValueType } from './SingleValueType';

const StyledDivider = styled.span`
  margin: 0 10px;
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
`;

const numberFormatter = getNumberFormatter(NumberFormats.SMART_NUMBER);

const getLabel = (lower: number | null, upper: number | null): string => {
  if (lower !== null && upper !== null && lower === upper) {
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
    filterBarOrientation,
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
      setValue(value);

      setDataMask({
        extraFormData: getRangeExtraFormData(col, lower, upper),
        filterState: {
          value: lower !== null || upper !== null ? value : null,
          label: getLabel(lower, upper),
        },
      });
    },
    [col, getBounds, setDataMask],
  );

  const handleChange = (newValue: number, index: 0 | 1) => {
    const updatedValue: [number, number] = [...value];
    if (index === minIndex && newValue > updatedValue[maxIndex]) {
      updatedValue[minIndex] = updatedValue[maxIndex];
    } else if (index === maxIndex && newValue < updatedValue[minIndex]) {
      updatedValue[maxIndex] = updatedValue[minIndex];
    } else {
      updatedValue[index] = newValue;
    }
    handleAfterChange(updatedValue);
  };

  useEffect(() => {
    // when switch filter type and queriesData still not updated we need ignore this case (in FilterBar)
    if (row?.min === undefined && row?.max === undefined) {
      return;
    }

    let filterStateValue = filterState.value ?? [min, max];
    if (enableSingleMaxValue) {
      const filterStateMax =
        filterStateValue[maxIndex] <= minMax[maxIndex]
          ? filterStateValue[maxIndex]
          : minMax[maxIndex];

      filterStateValue = [min, filterStateMax];
    } else if (enableSingleMinValue) {
      const filterStateMin =
        filterStateValue[minIndex] >= minMax[minIndex]
          ? filterStateValue[minIndex]
          : minMax[minIndex];

      filterStateValue = [filterStateMin, max];
    } else if (enableSingleExactValue) {
      filterStateValue = [minMax[minIndex], minMax[minIndex]];
    }

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
      handleAfterChange([min, minMax[maxIndex]]);
    }
  }, [enableSingleMaxValue]);

  useEffect(() => {
    if (enableSingleMinValue) {
      handleAfterChange([minMax[minIndex], max]);
    }
  }, [enableSingleMinValue]);

  useEffect(() => {
    if (enableSingleExactValue) {
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
          >
            <InputNumber
              value={minMax[minIndex]}
              min={min}
              max={max}
              onChange={value => handleChange(Number(value), minIndex)}
              placeholder="From"
              data-test="native-filter-from-input"
            />
            <StyledDivider>-</StyledDivider>
            <InputNumber
              value={minMax[maxIndex]}
              min={min}
              max={max}
              onChange={value => handleChange(Number(value), maxIndex)}
              placeholder="To"
              data-test="native-filter-to-input"
            />
          </Wrapper>
        </StyledFormItem>
      )}
    </FilterPluginStyle>
  );
}
