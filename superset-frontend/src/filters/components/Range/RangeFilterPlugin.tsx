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
import { rgba } from 'emotion-rgba';
import { AntdSlider } from 'src/components';
import { FilterBarOrientation } from 'src/dashboard/types';
import { PluginFilterRangeProps } from './types';
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

const Wrapper = styled.div<{
  validateStatus?: 'error' | 'warning' | 'info';
  orientation?: FilterBarOrientation;
  isOverflowing?: boolean;
}>`
  ${({ theme, validateStatus, orientation, isOverflowing }) => `
    border: 1px solid transparent;
    &:focus {
      border: 1px solid
        ${theme.colors[validateStatus || 'primary']?.base};
      outline: 0;
      box-shadow: 0 0 0 3px
        ${rgba(theme.colors[validateStatus || 'primary']?.base, 0.2)};
    }
    & .ant-slider {
      margin-top: ${
        orientation === FilterBarOrientation.HORIZONTAL ? 0 : theme.gridUnit
      }px;
      margin-bottom: ${
        orientation === FilterBarOrientation.HORIZONTAL ? 0 : theme.gridUnit * 5
      }px;

      ${
        orientation === FilterBarOrientation.HORIZONTAL &&
        !isOverflowing &&
        `line-height: 1.2;`
      }

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
      & .ant-slider-mark {
        font-size: ${theme.typography.sizes.s}px;
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

const tipFormatter = (value: number) => numberFormatter(value);

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

const getMarks = (
  lower: number | null,
  upper: number | null,
): { [key: number]: string } => {
  const newMarks: { [key: number]: string } = {};
  if (lower !== null) {
    newMarks[lower] = numberFormatter(lower);
  }
  if (upper !== null) {
    newMarks[upper] = numberFormatter(upper);
  }
  return newMarks;
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
  const rangeValue = enableSingleValue === undefined;

  const [col = ''] = ensureIsArray(groupby).map(getColumnLabel);
  const [value, setValue] = useState<[number, number]>(
    defaultValue ?? [min, enableSingleExactValue ? min : max],
  );
  const [marks, setMarks] = useState<{ [key: number]: string }>({});
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
      setValue(value);
      const { lower, upper } = getBounds(value);
      setMarks(getMarks(lower, upper));

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

  const handleChange = useCallback((value: [number, number]) => {
    setValue(value);
  }, []);

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
        <StyledFormItem extra={formItemExtra}>
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
            {enableSingleMaxValue && (
              <AntdSlider
                min={min}
                max={max}
                value={minMax[maxIndex]}
                tipFormatter={tipFormatter}
                marks={marks}
                onAfterChange={value => handleAfterChange([min, value])}
                onChange={value => handleChange([min, value])}
              />
            )}
            {enableSingleMinValue && (
              <StyledMinSlider
                validateStatus={filterState.validateStatus}
                min={min}
                max={max}
                value={minMax[minIndex]}
                tipFormatter={tipFormatter}
                marks={marks}
                onAfterChange={value => handleAfterChange([value, max])}
                onChange={value => handleChange([value, max])}
              />
            )}
            {enableSingleExactValue && (
              <AntdSlider
                min={min}
                max={max}
                included={false}
                value={minMax[minIndex]}
                tipFormatter={tipFormatter}
                marks={marks}
                onAfterChange={value => handleAfterChange([value, value])}
                onChange={value => handleChange([value, value])}
              />
            )}
            {rangeValue && (
              <AntdSlider
                range
                min={min}
                max={max}
                value={minMax}
                onAfterChange={handleAfterChange}
                onChange={handleChange}
                tipFormatter={tipFormatter}
                marks={marks}
              />
            )}
          </Wrapper>
        </StyledFormItem>
      )}
    </FilterPluginStyle>
  );
}
