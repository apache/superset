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
  useTheme,
  t,
  css,
} from '@superset-ui/core';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { FilterBarOrientation } from 'src/dashboard/types';
// import Metadata from '@superset-ui/core/components/Metadata';
import { isNumber } from 'lodash';
import { InputNumber } from '@superset-ui/core/components/Input';
import Slider from '@superset-ui/core/components/Slider';
import { FormItem, Tooltip, Icons } from '@superset-ui/core/components';
import { PluginFilterRangeProps, RangeDisplayMode } from './types';
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
    min-width: 80px;
    position: relative;
  }
`;

const SliderWrapper = styled.div`
  ${({ theme }) => `
    margin: ${theme.sizeUnit * 4}px 0;
    padding: 0 ${theme.sizeUnit}px;
  `}
`;

const TooltipContainer = styled.div`
  ${({ theme }) => `
    position: absolute;
    top: -${theme.sizeUnit * 6}px;
    right: 0px;
    z-index: 100;
    display: flex;
    align-items: center;

    .tooltip-icon {
      margin-left: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const HorizontalLayout = styled.div`
  ${({ theme }) => `
    display: flex;
    gap: ${theme.sizeUnit * 4}px;
    width: 100%;
    align-items: center;

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
      min-width: 160px;
      max-width: 200px;
    }
  `}
`;

const FocusContainer = styled.div`
  ${({ theme }) => `
  border-radius: ${theme.borderRadius}px;
  transition: box-shadow ${theme.motionDurationMid} ease-in-out;
  &:focus {
    box-shadow: 0 0 0 2px ${theme.colorPrimary};
  }
  &:focus-visible {
    outline: none;
  }`}
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
  const requiredError = t('Please provide a valid min or max value');
  const minMaxError = t('Min value cannot be greater than max value');
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

    if (!isNumber(value)) {
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
      errorMessage: requiredError,
    };
  }

  // Check relationship between min and max when both are provided
  if (inputMin !== null && inputMax !== null && inputMin > inputMax) {
    return {
      isValid: false,
      errorMessage: minMaxError,
    };
  }

  //   Check individual value bounds if provided
  if (
    (inputMin !== null && inputMin < min) ||
    (inputMax !== null && inputMax > max)
  ) {
    return {
      isValid: false,
      errorMessage: rangeError,
    };
  }

  return { isValid: true, errorMessage: null };
};

export default function RangeFilterPlugin(props: PluginFilterRangeProps) {
  const theme = useTheme();
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
    if (
      enableSingleValue === SingleValueType.Minimum ||
      enableSingleValue === SingleValueType.Exact
    ) {
      return inputMin !== null ? inputMin : min;
    }
    if (enableSingleValue === SingleValueType.Maximum) {
      return inputMax !== null ? inputMax : max;
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
        return null;
    }
  }, [enableSingleValue]);

  const keyPressed = useRef(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    keyPressed.current = !!/^[0-9]$/.test(event.key);
  };

  const handleChange = useCallback(
    (newValue: number | null, index: 0 | 1) => {
      if (row?.min === undefined && row?.max === undefined) {
        return;
      }

      // When using increment/decrement buttons on an empty input,
      // use the dataset min/max as the base value
      let adjustedValue = newValue;
      if (newValue !== null && inputValue[index] === null) {
        if (keyPressed.current) {
          adjustedValue = newValue;
          keyPressed.current = false;
        } else if (index === minIndex && newValue === 1) {
          adjustedValue = min + 1;
        } else if (index === minIndex && newValue === -1) {
          adjustedValue = min - 1;
        } else if (index === maxIndex && newValue === 1) {
          adjustedValue = max + 1;
        } else if (index === maxIndex && newValue === -1) {
          adjustedValue = max - 1;
        }
      }

      const newInputValue: [number | null, number | null] =
        index === minIndex
          ? [adjustedValue, inputValue[maxIndex]]
          : [inputValue[minIndex], adjustedValue];

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
    (value: number | number[]) => {
      let newInputValue: RangeValue;

      if (enableSingleValue !== undefined) {
        const singleValue =
          typeof value === 'number'
            ? value
            : Array.isArray(value) && value.length > 0
              ? value[0]
              : (min + max) / 2;

        if (enableSingleValue === SingleValueType.Minimum) {
          newInputValue = [singleValue, null];
        } else if (enableSingleValue === SingleValueType.Maximum) {
          newInputValue = [null, singleValue];
        } else {
          newInputValue = [singleValue, singleValue];
        }
      } else {
        const arrayValue = Array.isArray(value) ? value : [min, max];
        const [sliderMin, sliderMax] =
          arrayValue.length >= 2 ? [arrayValue[0], arrayValue[1]] : [min, max];
        newInputValue = [sliderMin, sliderMax];
      }

      setInputValue(newInputValue);
      setError(null);
      updateDataMaskValue(newInputValue);
    },
    [min, max, enableSingleValue, updateDataMaskValue],
  );

  const getMessageAndStatus = useCallback(() => {
    const defaultMessage = t('Choose numbers between %(min)s and %(max)s', {
      min,
      max,
    });

    if (error) {
      return { message: error, status: 'error' as const };
    }

    if (enableSingleValue !== undefined && metadataText) {
      return { message: metadataText, status: 'help' as const };
    }

    return { message: defaultMessage, status: 'help' as const };
  }, [error, min, max, enableSingleValue, metadataText]);

  const MessageDisplay = useCallback(() => {
    const { message, status } = getMessageAndStatus();

    if (filterBarOrientation === FilterBarOrientation.Vertical) {
      return <StatusMessage status={status}>{message}</StatusMessage>;
    }

    return null;
  }, [getMessageAndStatus, filterBarOrientation]);

  const InfoTooltip = useCallback(() => {
    const { message, status } = getMessageAndStatus();

    return (
      <Tooltip title={message} placement="top">
        <Icons.InfoCircleOutlined
          iconSize="m"
          iconColor={status === 'error' ? theme.colorError : theme.colorIcon}
          className="tooltip-icon"
        />
      </Tooltip>
    );
  }, [getMessageAndStatus]);

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

  const renderSlider = () => {
    if (enableSingleValue !== undefined) {
      return (
        <SliderWrapper>
          <Slider
            min={min}
            max={max}
            value={Array.isArray(sliderValue) ? sliderValue[0] : sliderValue}
            onChange={handleSliderChange}
            tooltip={{
              formatter: val => (val !== null ? numberFormatter(val) : ''),
            }}
          />
        </SliderWrapper>
      );
    }
    return (
      <SliderWrapper data-test="range-filter-slider">
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
  };

  const renderInputs = () => (
    <Wrapper
      tabIndex={-1}
      onFocus={setFocusedFilter}
      onBlur={unsetFocusedFilter}
      onMouseEnter={setHoveredFilter}
      onMouseLeave={unsetHoveredFilter}
      onMouseDown={() => setFilterActive(true)}
      onMouseUp={() => setFilterActive(false)}
    >
      {/* Conditionally render based on enableSingleValue */}
      {(enableSingleValue === undefined ||
        enableSingleValue === SingleValueType.Minimum ||
        enableSingleValue === SingleValueType.Exact) && (
        <InputNumber
          value={inputValue[minIndex]}
          onChange={val => handleChange(val, minIndex)}
          onKeyDown={handleKeyDown}
          placeholder={`${min}`}
          style={{ width: '100%' }}
          status={filterState.validateStatus}
          data-test="range-filter-from-input"
        />
      )}

      {enableSingleValue === undefined && <StyledDivider>-</StyledDivider>}

      {(enableSingleValue === undefined ||
        enableSingleValue === SingleValueType.Maximum) && (
        <InputNumber
          value={inputValue[maxIndex]}
          onChange={val => handleChange(val, maxIndex)}
          onKeyDown={handleKeyDown}
          placeholder={`${max}`}
          style={{ width: '100%' }}
          data-test="range-filter-to-input"
          status={filterState.validateStatus}
        />
      )}
    </Wrapper>
  );

  return (
    <FilterPluginStyle height={height} width={width}>
      {Number.isNaN(Number(min)) || Number.isNaN(Number(max)) ? (
        <h4>{t('Chosen non-numeric column')}</h4>
      ) : (
        <FormItem aria-labelledby={`filter-name-${formData.nativeFilterId}`}>
          {filterBarOrientation === FilterBarOrientation.Horizontal &&
          !isOverflowingFilterBar ? (
            <FocusContainer ref={inputRef} tabIndex={-1}>
              <HorizontalLayout>
                <InfoTooltip />
                {(rangeDisplayMode === RangeDisplayMode.Slider ||
                  rangeDisplayMode === RangeDisplayMode.SliderAndInput) && (
                  <div className="slider-wrapper">
                    <div className="slider-container">{renderSlider()}</div>
                  </div>
                )}
                {(rangeDisplayMode === RangeDisplayMode.Input ||
                  rangeDisplayMode === RangeDisplayMode.SliderAndInput) && (
                  <div className="inputs-container">{renderInputs()}</div>
                )}
              </HorizontalLayout>
            </FocusContainer>
          ) : (
            <>
              <div style={{ position: 'relative' }}>
                {isOverflowingFilterBar && (
                  <TooltipContainer>
                    <InfoTooltip />
                  </TooltipContainer>
                )}
                <FocusContainer
                  ref={inputRef}
                  tabIndex={-1}
                  css={css`
                    padding-top: 1px;
                    margin-top: -1px;
                  `}
                >
                  {(rangeDisplayMode === RangeDisplayMode.Slider ||
                    rangeDisplayMode === RangeDisplayMode.SliderAndInput) &&
                    renderSlider()}
                  {(rangeDisplayMode === RangeDisplayMode.Input ||
                    rangeDisplayMode === RangeDisplayMode.SliderAndInput) &&
                    renderInputs()}
                </FocusContainer>

                <MessageDisplay />
              </div>
            </>
          )}
        </FormItem>
      )}
    </FilterPluginStyle>
  );
}
