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
  isEqualArray,
  NumberFormats,
  styled,
  t,
} from '@superset-ui/core';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FilterBarOrientation } from 'src/dashboard/types';
import Metadata from '@superset-ui/core/components/Metadata';
import { isNumber } from 'lodash';
import { FormItem, InputNumber } from '@superset-ui/core/components';
import { PluginFilterRangeProps } from './types';
import { StatusMessage, FilterPluginStyle } from '../common';
import { getRangeExtraFormData } from '../../utils';
import { SingleValueType } from './SingleValueType';

type InputValue = number | null;
type RangeValue = [InputValue, InputValue];

const StyledDivider = styled.span`
  margin: 0 ${({ theme }) => theme.sizeUnit * 3}px;
  color: ${({ theme }) => theme.colorSplit};
  font-weight: ${({ theme }) => theme.fontWeightStrong};
  font-size: ${({ theme }) => theme.fontSize}px;
  align-content: center;
`;

const Wrapper = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;

  .ant-input-number {
    width: 100%;
    min-width: 80px;
    position: relative;
  }
`;

const SliderWrapper = styled.div`
  margin: ${({ theme }) => theme.gridUnit * 4}px 0;
  padding: 0 ${({ theme }) => theme.gridUnit}px;
  width: 100%;
  min-width: 200px;
`;

const ErrorIconWrapper = styled.div`
  margin-right: ${({ theme }) => theme.gridUnit * 2}px;
  display: flex;
  align-items: center;
`;

const HorizontalLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.gridUnit * 4}px;
  width: 100%;

  .controls-container {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.gridUnit * 4}px;
    width: 100%;

    .slider-wrapper {
      display: flex;
      align-items: center;
      flex: 2;
    }

    .slider-container {
      flex: 1;
      min-width: 180px;
    }

    .inputs-container {
      flex: 1;
      min-width: 200px;
      max-width: 300px;
    }
  }

  .message-container {
    width: 100%;
    text-align: center;
    padding-top: ${({ theme }) => theme.gridUnit * 2}px;
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
  values: RangeValue,
  min: number,
  max: number,
  enableEmptyFilter: boolean,
  enableSingleValue?: SingleValueType,
): { isValid: boolean; errorMessage: string | null } => {
  const [inputMin, inputMax] = values;
  const requiredError = t('Filter value is required');
  const rangeError = t('Numbers must be within %(min)s and %(max)s', {
    min,
    max,
  });

  // Single value validation
  if (enableSingleValue !== undefined) {
    const isSingleMin =
      enableSingleValue === SingleValueType.Minimum ||
      enableSingleValue === SingleValueType.Exact;
    const value = isSingleMin ? inputMin : inputMax;

    if (!isNumber(value) && !enableEmptyFilter) {
      return { isValid: false, errorMessage: requiredError };
    }

    if (isNumber(value) && (value < min || value > max)) {
      return { isValid: false, errorMessage: rangeError };
    }

    return { isValid: true, errorMessage: null };
  }

  // Range validation
  // Allow empty ranges if enableEmptyFilter is false
  if (!enableEmptyFilter && inputMin === null && inputMax === null) {
    return { isValid: true, errorMessage: null };
  }

  // If enableEmptyFilter is true, at least one value is required
  if (enableEmptyFilter && inputMin === null && inputMax === null) {
    return {
      isValid: false,
      errorMessage: t('Please provide a valid min or max value'),
    };
  }

  // Check individual value bounds if provided
  if (inputMin !== null && (inputMin < min || inputMin > max)) {
    return {
      isValid: false,
      errorMessage: rangeError,
    };
  }

  if (inputMax !== null && (inputMax < min || inputMax > max)) {
    return {
      isValid: false,
      errorMessage: rangeError,
    };
  }

  // Check relationship between min and max when both are provided
  if (inputMin !== null && inputMax !== null && inputMin > inputMax) {
    return {
      isValid: false,
      errorMessage: t('Min value cannot be greater than max value'),
    };
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

  // Get the display mode from formData
  const rangeDisplayMode =
    formData?.rangeDisplayMode || RangeDisplayMode.SliderAndInput;

  const minIndex = 0;
  const maxIndex = 1;

  const enableSingleExactValue = enableSingleValue === SingleValueType.Exact;

  const [col = ''] = ensureIsArray(groupby).map(getColumnLabel);

  const [inputValue, setInputValue] = useState<RangeValue>(
    filterState.value || defaultValue || [null, null],
  );
  const [error, setError] = useState<string | null>(null);

  // Prepare slider value from input value, converting nulls to min/max
  const sliderValue = useMemo(() => {
    const [inputMin, inputMax] = inputValue;

    // For single value filters
    if (enableSingleValue === SingleValueType.Minimum) {
      return inputMin !== null ? inputMin : min;
    }
    if (enableSingleValue === SingleValueType.Maximum) {
      return inputMax !== null ? inputMax : max;
    }
    if (enableSingleValue === SingleValueType.Exact) {
      return inputMin !== null ? inputMin : (min + max) / 2;
    }

    // For range filters - use placeholders when values are null
    // If only min is provided, set max to the dataset max
    // If only max is provided, set min to the dataset min
    const sliderMin = inputMin !== null ? inputMin : min;
    const sliderMax = inputMax !== null ? inputMax : max;

    return [sliderMin, sliderMax];
  }, [inputValue, min, max, enableSingleValue]);

  const updateDataMaskError = useCallback(
    (errorMessage: string | null) => {
      setDataMask({
        extraFormData: {},
        filterState: {
          value: null,
          label: '',
          validateStatus: 'error',
          validateMessage: errorMessage || '',
        },
      });
    },
    [setDataMask],
  );

  const updateDataMaskValue = useCallback(
    (value: RangeValue) => {
      const [inputMin, inputMax] = value;
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
    [setDataMask],
  );

  useEffect(() => {
    if (row?.min === undefined && row?.max === undefined) {
      return;
    }

    // Handle error case
    if (filterState.validateStatus === 'error') {
      setError(filterState.validateMessage);

      // Only re-validate if message changed to prevents redundant validation
      if (error !== filterState.validateMessage) {
        const { isValid, errorMessage } = validateRange(
          inputValue,
          min,
          max,
          enableEmptyFilter,
          enableSingleValue,
        );

        if (!isValid) {
          setError(errorMessage);
          updateDataMaskError(errorMessage);
        } else {
          setError(null);
          updateDataMaskValue(inputValue);
        }
      }
      return;
    }

    // Clear all case
    if (filterState.value === undefined && !filterState.validateStatus) {
      setInputValue([null, null]);
      updateDataMaskValue([null, null]);
      return;
    }

    if (isEqualArray(defaultValue, inputValue)) {
      updateDataMaskValue(defaultValue);
      return;
    }

    // Filter state is pre-set case
    if (filterState.value && !filterState.validateStatus) {
      setInputValue(filterState.value);
      updateDataMaskValue(filterState.value);
    }
  }, [JSON.stringify(filterState.value)]);

  // Get just the filter behavior text without the range information (which is shown in the tooltip)
  const metadataText = useMemo(() => {
    switch (enableSingleValue) {
      case SingleValueType.Minimum:
        return t('Filters for values greater than or equal.');
      case SingleValueType.Maximum:
        return t('Filters for values less than or equal.');
      case SingleValueType.Exact:
        return t('Filters for values equal to this exact value.');
      default:
        return null; // Don't show redundant metadata for range filters
    }
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

      const { isValid, errorMessage } = validateRange(
        newInputValue,
        min,
        max,
        enableEmptyFilter,
        enableSingleValue,
      );

      if (!isValid) {
        setError(errorMessage);
        updateDataMaskError(errorMessage);
        return;
      }

      setError(null);
      updateDataMaskValue(newInputValue);
    },
    [
      min,
      max,
      enableEmptyFilter,
      enableSingleValue,
      updateDataMaskError,
      updateDataMaskValue,
      inputValue,
    ],
  );

  // Handler for slider change
  const handleSliderChange = useCallback(
    (value: number[]) => {
      let newInputValue: RangeValue;

      const [sliderMin, sliderMax] =
        value.length >= 2 ? [value[0], value[1]] : [min, max];

      if (enableSingleValue !== undefined) {
        // Apply single value logic but still using the range UI
        if (enableSingleValue === SingleValueType.Minimum) {
          newInputValue = [sliderMin, null];
        } else if (enableSingleValue === SingleValueType.Maximum) {
          newInputValue = [null, sliderMax];
        } else {
          // Exact - use the same value for both
          newInputValue = [sliderMin, sliderMin];
        }
      } else {
        // Regular range case
        newInputValue = [sliderMin, sliderMax];
      }

      setInputValue(newInputValue);
      setError(null);
      updateDataMaskValue(newInputValue);
    },
    [min, max, enableSingleValue, updateDataMaskValue],
  );

  // different error display components for vertical and horizontal orientations
  const verticalErrorDisplay = useMemo(() => {
    if (error) {
      return <StatusMessage status="error">{error}</StatusMessage>;
    }
    // Display the range info message in vertical orientation when no error
    return (
      <StatusMessage status="help">
        {t('Choose numbers between %(min)s and %(max)s', { min, max })};
      </StatusMessage>
    );
  }, [error, min, max]);

  // Info/Error tooltip component for horizontal orientation - always shown
  const InfoTooltip = useCallback(() => {
    const tooltipMessage =
      error || t('Choose numbers between %(min)s and %(max)s', { min, max });

    return (
      <ErrorIconWrapper>
        <Tooltip title={tooltipMessage} placement="top">
          {error ? (
            <Icons.ExclamationCircleOutlined iconSize="m" iconColor="error" />
          ) : (
            <Icons.InfoCircleOutlined iconSize="m" iconColor="primary" />
          )}
        </Tooltip>
      </ErrorIconWrapper>
    );
  }, [error, min, max]);

  useEffect(() => {
    if (enableSingleValue !== undefined) {
      switch (enableSingleValue) {
        case SingleValueType.Minimum:
        case SingleValueType.Exact:
          if (inputValue[maxIndex] !== null) {
            handleChange(null, maxIndex);
          }
          break;
        case SingleValueType.Maximum:
          if (inputValue[minIndex] !== null) {
            handleChange(null, minIndex);
          }
          break;
        default:
          break;
      }
    }

    // Reset data mask when single value mode changes
    setDataMask({
      extraFormData: {},
      filterState: {
        value: null,
        label: '',
      },
    });
  }, [enableSingleValue]);

  const renderSlider = () => (
    <SliderWrapper>
      <Slider
        min={min}
        max={max}
        range
        value={Array.isArray(sliderValue) ? sliderValue : [min, sliderValue]}
        onChange={handleSliderChange}
        tooltip={{
          formatter: val => (val !== null ? numberFormatter(val) : ''),
        }}
      />
    </SliderWrapper>
  );

  const renderInputs = () => (
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
      {/* Always show both input fields for range mode */}
      <InputNumber
        value={inputValue[minIndex]}
        onChange={val => handleChange(val, minIndex)}
        placeholder={`${min}`}
        style={{ width: '100%' }}
        status={filterState.validateStatus}
        data-test="range-filter-from-input"
      />

      <StyledDivider>-</StyledDivider>

      <InputNumber
        value={inputValue[maxIndex]}
        onChange={val => handleChange(val, maxIndex)}
        placeholder={`${max}`}
        style={{ width: '100%' }}
        data-test="range-filter-to-input"
        status={filterState.validateStatus}
      />
    </Wrapper>
  );

  return (
    <FilterPluginStyle height={height} width={width}>
      {Number.isNaN(Number(min)) || Number.isNaN(Number(max)) ? (
        <h4>{t('Chosen non-numeric column')}</h4>
      ) : (
        <FormItem
          aria-labelledby={`filter-name-${formData.nativeFilterId}`}
          extra={
            filterBarOrientation === FilterBarOrientation.Vertical
              ? verticalErrorDisplay
              : undefined
          }
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
        </FormItem>
      )}
    </FilterPluginStyle>
  );
}
