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
  const [value, setValue] = useState<[number | null, number | null]>([
    defaultValue?.[minIndex] ?? null,
    defaultValue?.[maxIndex] ?? null,
  ]);
  const [previousMode, setPreviousMode] = useState<SingleValueType | null>(
    null,
  );

  const minMax = value ?? [min, max];

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
    [max, min, enableSingleExactValue],
  );

  const handleAfterChange = useCallback(
    (value: [number | null, number | null]): void => {
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

  useEffect(() => {
    console.log('Datamask has been called');
    console.log(filterState);
  }, [setDataMask]);

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
    const updatedValue: [number | null, number | null] = [...value];

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

    updatedValue[index] = newValue;
    console.log(updatedValue);
    setValue(updatedValue);
    handleAfterChange(updatedValue);
  };

  // useEffect(() => {
  //   // when switch filter type and queriesData still not updated we need ignore this case (in FilterBar)
  //   if (row?.min === undefined && row?.max === undefined) {
  //     return;
  //   }
  //   console.log(filterState)
  //   const filterStateValue = filterState.value ?? [null, null];
  //   setValue(filterStateValue);
  //   handleAfterChange(filterStateValue);
  // }, [
  //   filterState?.value, row?.min, row?.max
  // ]);

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

  const updateValue = (newValue: [number, number], mode: SingleValueType) => {
    setValue(newValue);
    setPreviousMode(mode);
    handleAfterChange(newValue);
  };

  const getNewValue = (
    currentMode: SingleValueType,
    previousMode: SingleValueType | undefined | null,
  ): [number, number] => {
    switch (currentMode) {
      case SingleValueType.Maximum:
        return (
          (previousMode === SingleValueType.Exact && [min, minMax[maxIndex]]) ||
          (previousMode === SingleValueType.Minimum && [
            min,
            minMax[minIndex],
          ]) || [min, minMax[maxIndex]]
        );

      case SingleValueType.Minimum:
        return (
          (previousMode === SingleValueType.Exact && [minMax[minIndex], max]) ||
          (previousMode === SingleValueType.Maximum && [
            minMax[maxIndex],
            max,
          ]) || [minMax[minIndex], max]
        );

      case SingleValueType.Exact:
        return (
          (previousMode === SingleValueType.Maximum && [
            minMax[maxIndex],
            minMax[maxIndex],
          ]) ||
          (previousMode === SingleValueType.Minimum && [
            minMax[minIndex],
            minMax[minIndex],
          ]) || [minMax[minIndex], minMax[minIndex]]
        );

      default:
        throw new Error('Invalid SingleValueType provided');
    }
  };

  useEffect(() => {
    if (enableSingleMaxValue) {
      const newValue = getNewValue(SingleValueType.Maximum, previousMode);
      updateValue(newValue, SingleValueType.Maximum);
    }
  }, [enableSingleMaxValue]);

  useEffect(() => {
    if (enableSingleMinValue) {
      const newValue = getNewValue(SingleValueType.Minimum, previousMode);
      updateValue(newValue, SingleValueType.Minimum);
    }
  }, [enableSingleMinValue]);

  useEffect(() => {
    if (enableSingleExactValue) {
      const newValue = getNewValue(SingleValueType.Exact, previousMode);
      updateValue(newValue, SingleValueType.Exact);
    }
  }, [enableSingleExactValue]);

  const handleBlur = (index: 0 | 1) => {
    if (index === minIndex) {
      handleChange(filterState?.value[minIndex], minIndex);
    } else if (index === maxIndex) {
      handleChange(filterState?.value[maxIndex], maxIndex);
    }
  };

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
            {enableSingleValue !== undefined ? (
              <>
                <InputNumber
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
                  value={filterState?.value?.[minIndex] ?? null}
                  min={min}
                  max={max}
                  onChange={val => handleChange(val, minIndex)}
                  // onBlur={() => handleBlur(minIndex)}
                  placeholder={t(`${min}`)}
                  data-test="native-filter-from-input"
                />
                <StyledDivider>-</StyledDivider>
                <InputNumber
                  value={filterState?.value?.[maxIndex] ?? null}
                  min={min}
                  max={max}
                  onChange={val => handleChange(val, maxIndex)}
                  // onBlur={() => handleBlur(maxIndex)}
                  placeholder={t(`${max}`)}
                  data-test="native-filter-to-input"
                  // changeOnBlur={false}
                />
              </>
            )}
          </Wrapper>
        </StyledFormItem>
      )}
    </FilterPluginStyle>
  );
}
