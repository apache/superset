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
  getNumberFormatter,
  NumberFormats,
  styled,
  t,
} from '@superset-ui/core';
import React, { useEffect, useState } from 'react';
import { Slider } from 'src/common/components';
import { rgba } from 'emotion-rgba';
import { PluginFilterRangeProps } from './types';
import { StyledFormItem, Styles } from '../common';
import { getRangeExtraFormData } from '../../utils';

const Error = styled.div`
  color: ${({ theme }) => theme.colors.error.base};
`;

const Wrapper = styled.div<{ validateStatus?: string }>`
  border: 1px solid transparent;
  &:focus {
    border: 1px solid
      ${({ theme, validateStatus }) =>
        theme.colors[validateStatus ? 'error' : 'primary'].base};
    outline: 0;
    box-shadow: 0 0 0 3px
      ${({ theme, validateStatus }) =>
        rgba(theme.colors[validateStatus ? 'error' : 'primary'].base, 0.2)};
  }
  & .ant-slider {
    & .ant-slider-track {
      background-color: ${({ theme, validateStatus }) =>
        validateStatus && theme.colors.error.light1};
    }
    & .ant-slider-handle {
      border: ${({ theme, validateStatus }) =>
        validateStatus && `2px solid ${theme.colors.error.light1}`};
      &:focus {
        box-shadow: 0 0 0 3px
          ${({ theme, validateStatus }) =>
            rgba(theme.colors[validateStatus ? 'error' : 'primary'].base, 0.2)};
      }
    }
    &:hover {
      & .ant-slider-track {
        background-color: ${({ theme, validateStatus }) =>
          validateStatus && theme.colors.error.base};
      }
      & .ant-slider-handle {
        border: ${({ theme, validateStatus }) =>
          validateStatus && `2px solid ${theme.colors.error.base}`};
      }
    }
  }
`;

export default function RangeFilterPlugin(props: PluginFilterRangeProps) {
  const {
    data,
    formData,
    height,
    width,
    setDataMask,
    setFocusedFilter,
    unsetFocusedFilter,
    filterState,
  } = props;
  const numberFormatter = getNumberFormatter(NumberFormats.SMART_NUMBER);

  const [row] = data;
  // @ts-ignore
  const { min, max }: { min: number; max: number } = row;
  const { groupby, defaultValue, inputRef } = formData;
  const [col = ''] = groupby || [];
  const [value, setValue] = useState<[number, number]>(
    defaultValue ?? [min, max],
  );
  const [marks, setMarks] = useState<{ [key: number]: string }>({});

  const getBounds = (
    value: [number, number],
  ): { lower: number | null; upper: number | null } => {
    const [lowerRaw, upperRaw] = value;
    return {
      lower: lowerRaw > min ? lowerRaw : null,
      upper: upperRaw < max ? upperRaw : null,
    };
  };

  const getLabel = (lower: number | null, upper: number | null): string => {
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

  const handleAfterChange = (value: [number, number]): void => {
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
  };

  const handleChange = (value: [number, number]) => {
    setValue(value);
  };

  useEffect(() => {
    handleAfterChange(filterState.value ?? [min, max]);
  }, [JSON.stringify(filterState.value)]);

  return (
    <Styles height={height} width={width}>
      {Number.isNaN(Number(min)) || Number.isNaN(Number(max)) ? (
        <h4>{t('Chosen non-numeric column')}</h4>
      ) : (
        <StyledFormItem
          validateStatus={filterState.validateMessage && 'error'}
          extra={<Error>{filterState.validateMessage}</Error>}
        >
          <Wrapper
            tabIndex={-1}
            ref={inputRef}
            validateStatus={filterState.validateMessage}
            onFocus={setFocusedFilter}
            onBlur={unsetFocusedFilter}
            onMouseEnter={setFocusedFilter}
            onMouseLeave={unsetFocusedFilter}
          >
            <Slider
              range
              min={min}
              max={max}
              value={value ?? [min, max]}
              onAfterChange={handleAfterChange}
              onChange={handleChange}
              tipFormatter={value => numberFormatter(value)}
              marks={marks}
            />
          </Wrapper>
        </StyledFormItem>
      )}
    </Styles>
  );
}
