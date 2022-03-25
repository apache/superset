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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AntdSlider } from 'src/components';
import { rgba } from 'emotion-rgba';

// could add in scalePow and others
// import { scaleLog, scaleLinear } from 'd3-scale';
import {
  PluginFilterRangeProps,
  PluginFilterRangeScalingFunctions,
  SCALING_FUNCTION_ENUM_TO_SCALING_FUNCTION,
} from './types';

import { StatusMessage, StyledFormItem, FilterPluginStyle } from '../common';
import { getRangeExtraFormData } from '../../utils';
import { SingleValueType } from './SingleValueType';

const LIGHT_BLUE = '#99e7f0';
const DARK_BLUE = '#6dd3e3';
const LIGHT_GRAY = '#f5f5f5';
const DARK_GRAY = '#e1e1e1';

const StyledMinSlider = styled(AntdSlider)<{
  validateStatus?: 'error' | 'warning' | 'info';
}>`
  ${({ theme, validateStatus }) => `
  .ant-slider-rail {
    background-color: ${
      validateStatus ? theme.colors[validateStatus]?.light1 : LIGHT_BLUE
    };
  }

  .ant-slider-track {
    background-color: ${LIGHT_GRAY};
  }

  &:hover {
    .ant-slider-rail {
      background-color: ${
        validateStatus ? theme.colors[validateStatus]?.base : DARK_BLUE
      };
    }

    .ant-slider-track {
      background-color: ${DARK_GRAY};
    }
  }
  `}
`;

const Wrapper = styled.div<{ validateStatus?: 'error' | 'warning' | 'info' }>`
  ${({ theme, validateStatus }) => `
    border: 1px solid transparent;
    &:focus {
      border: 1px solid
        ${theme.colors[validateStatus || 'primary']?.base};
      outline: 0;
      box-shadow: 0 0 0 3px
        ${rgba(theme.colors[validateStatus || 'primary']?.base, 0.2)};
    }
    & .ant-slider {
      margin-top: ${theme.gridUnit}px;
      margin-bottom: ${theme.gridUnit * 5}px;

      & .ant-slider-track {
        background-color: ${
          validateStatus && theme.colors[validateStatus]?.light1
        };
      }
      & .ant-slider-handle {
        border: ${
          validateStatus && `2px solid ${theme.colors[validateStatus]?.light1}`
        };
        &:focus {
          box-shadow: 0 0 0 3px
            ${rgba(theme.colors[validateStatus || 'primary']?.base, 0.2)};
        }
      }
      &:hover {
        & .ant-slider-track {
          background-color: ${
            validateStatus && theme.colors[validateStatus]?.base
          };
        }
        & .ant-slider-handle {
          border: ${
            validateStatus && `2px solid ${theme.colors[validateStatus]?.base}`
          };
        }
      }
    }
  `}
`;

const numberFormatter = getNumberFormatter(NumberFormats.SMART_NUMBER);

// lower and upper are NOT transformed!!!!
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
    setFilterActive,
    filterState,
    inputRef,
  } = props;
  const [row] = data;
  // @ts-ignore
  const { min, max }: { min: number; max: number } = row;
  const {
    groupby,
    defaultValue,
    stepSize,
    scaling = PluginFilterRangeScalingFunctions.LINEAR,
    enableSingleValue,
  } = formData;

  const enableSingleMinValue = enableSingleValue === SingleValueType.Minimum;
  const enableSingleMaxValue = enableSingleValue === SingleValueType.Maximum;
  const enableSingleExactValue = enableSingleValue === SingleValueType.Exact;
  const rangeValue = enableSingleValue === undefined;

  const [col = ''] = ensureIsArray(groupby).map(getColumnLabel);
  const transformScale = useCallback(
    SCALING_FUNCTION_ENUM_TO_SCALING_FUNCTION[scaling].transformScale,
    [scaling],
  );
  const inverseScale = useCallback(
    SCALING_FUNCTION_ENUM_TO_SCALING_FUNCTION[scaling].inverseScale,
    [scaling],
  );

  const [value, setValue] = useState<[number, number]>(
    (defaultValue ?? [min, enableSingleExactValue ? min : max]).map(
      transformScale,
    ),
  );
  const [marks, setMarks] = useState<{ [key: number]: string }>({});
  const minIndex = 0;
  const maxIndex = 1;
  const minMax = useMemo(
    () => value ?? [min ?? 0, max].map(transformScale),
    [max, min, value, transformScale],
  );

  const tipFormatter = (value: number) =>
    numberFormatter(inverseScale(Number(value)));

  // lower & upper are transformed
  const getMarks = useCallback(
    (lower: number | null, upper: number | null): { [key: number]: string } => {
      const newMarks: { [key: number]: string } = {};
      if (lower !== null) {
        newMarks[lower] = numberFormatter(inverseScale(lower));
      }
      if (upper !== null) {
        newMarks[upper] = numberFormatter(inverseScale(upper));
      }
      return newMarks;
    },
    [inverseScale, value],
  );

  // value is transformed
  const getBounds = useCallback(
    (
      value: [number, number],
    ): { lower: number | null; upper: number | null } => {
      const [lowerRaw, upperRaw] = value;

      if (enableSingleExactValue) {
        return { lower: lowerRaw, upper: upperRaw };
      }

      return {
        lower: lowerRaw > Number(transformScale(min)) ? lowerRaw : null,
        upper: upperRaw < Number(transformScale(max)) ? upperRaw : null,
      };
    },
    [max, min, transformScale, value, enableSingleExactValue],
  );

  const handleAfterChange = useCallback(
    (value: [number, number]): void => {
      let val = value;
      if (value[0] === min && value[1] === max) {
        // after a filter value reset, make sure it's a transformed value
        val = [transformScale(value[0]), transformScale(value[1])];
      }
      // antd apparently uses the floor value, not the rounded value...?
      // which causes issues like log(123) = 2.0899
      if (val[1] === Math.floor(transformScale(max) / stepSize) * stepSize) {
        val = [val[0], transformScale(max)];
      }
      if (val[0] === Math.floor(transformScale(min) / stepSize) * stepSize) {
        val = [transformScale(min), val[1]];
      }
      // value is transformed
      setValue(val);
      // lower & upper are transformed
      const { lower, upper } = getBounds(val);
      setMarks(getMarks(lower, upper));
      // removed Number
      setDataMask({
        extraFormData: getRangeExtraFormData(
          col,
          inverseScale(lower),
          inverseScale(upper),
        ),
        filterState: {
          value: lower !== null || upper !== null ? value : null,
          label: getLabel(inverseScale(lower), inverseScale(upper)),
        },
      });
    },
    [col, getBounds, setDataMask, getMarks, inverseScale, transformScale],
  );

  // value is transformed
  const handleChange = useCallback((value: [number, number]) => {
    setValue(value);
  }, []);

  // value is transformed
  useEffect(() => {
    // when switch filter type and queriesData still not updated we need ignore this case (in FilterBar)
    if (row?.min === undefined && row?.max === undefined) {
      return;
    }

    let filterStateValue = filterState.value ?? [min, max].map(transformScale);
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
      handleAfterChange([min, minMax[minIndex]]);
    }
  }, [enableSingleMaxValue]);

  useEffect(() => {
    if (enableSingleMinValue) {
      handleAfterChange([minMax[maxIndex], max]);
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
        <StyledFormItem extra={formItemExtra}>
          <Wrapper
            tabIndex={-1}
            ref={inputRef}
            validateStatus={filterState.validateStatus}
            onFocus={setFocusedFilter}
            onBlur={unsetFocusedFilter}
            onMouseEnter={setFocusedFilter}
            onMouseLeave={unsetFocusedFilter}
            onMouseDown={() => setFilterActive(true)}
            onMouseUp={() => setFilterActive(false)}
          >
            {enableSingleMaxValue && (
              <AntdSlider
                min={transformScale(min) ?? 0}
                max={transformScale(max) ?? undefined}
                value={minMax[maxIndex]}
                tipFormatter={tipFormatter}
                marks={marks}
                onAfterChange={value => handleAfterChange([min, value])}
                onChange={value => handleChange([min, value])}
                step={stepSize}
              />
            )}
            {enableSingleMinValue && (
              <StyledMinSlider
                validateStatus={filterState.validateStatus}
                min={transformScale(min) ?? 0}
                max={transformScale(max) ?? undefined}
                value={minMax[minIndex]}
                tipFormatter={tipFormatter}
                marks={marks}
                onAfterChange={value => handleAfterChange([value, max])}
                onChange={value => handleChange([value, max])}
                step={stepSize}
              />
            )}
            {enableSingleExactValue && (
              <AntdSlider
                min={transformScale(min) ?? 0}
                max={transformScale(max) ?? undefined}
                included={false}
                value={minMax[minIndex]}
                tipFormatter={tipFormatter}
                marks={marks}
                onAfterChange={value => handleAfterChange([value, value])}
                onChange={value => handleChange([value, value])}
                step={stepSize}
              />
            )}
            {rangeValue && (
              <AntdSlider
                range
                min={transformScale(min) ?? 0}
                max={transformScale(max) ?? undefined}
                value={minMax}
                onAfterChange={handleAfterChange}
                onChange={handleChange}
                tipFormatter={tipFormatter}
                marks={marks}
                step={stepSize}
              />
            )}
          </Wrapper>
        </StyledFormItem>
      )}
    </FilterPluginStyle>
  );
}
