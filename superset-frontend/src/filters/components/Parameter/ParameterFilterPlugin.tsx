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
import { useCallback, useEffect, useState } from 'react';
import { ExtraFormData } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import {
  Input,
  InputNumber,
  FormItem,
  Select,
} from '@superset-ui/core/components';
import { StatusMessage, FilterPluginStyle } from '../common';
import { PluginFilterParameterProps } from './types';

const StyledContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;

  .ant-input,
  .ant-input-number {
    width: 100%;
  }
`;

export default function ParameterFilterPlugin(
  props: PluginFilterParameterProps,
) {
  const {
    formData,
    setDataMask,
    filterState,
    width,
    height,
    setHoveredFilter,
    unsetHoveredFilter,
    setFocusedFilter,
    unsetFocusedFilter,
  } = props;
  const {
    parameter_name: explicitName,
    parameterName,
    name,
    defaultValue,
    native_filter_id,
  } = formData as any;

  let parameter_type =
    formData.parameter_type ||
    formData.parameterType ||
    'string';
  if ((parameter_type as string) === 'decimal') parameter_type = 'float';
  if ((parameter_type as string) === 'number') parameter_type = 'integer';

  const parameter_name =
    explicitName || parameterName || name || native_filter_id || '';

  const isUsableDefaultValue =
    defaultValue !== undefined &&
    defaultValue !== null &&
    (parameter_type === 'boolean' || typeof defaultValue !== 'boolean');

  const [currentValue, setCurrentValue] = useState<any>(
    filterState.value !== undefined
      ? filterState.value
      : isUsableDefaultValue
      ? defaultValue
      : null,
  );

  const handleValueChange = useCallback(
    (val: any) => {
      setCurrentValue(val);
      const extraFormData: ExtraFormData = {};
      const key = parameter_name || name || native_filter_id || '';
      if (key) {
        extraFormData.parameters = {
          [key]: val !== undefined ? val : null,
        };
      }
      setDataMask({
        extraFormData,
        filterState: {
          value: val !== undefined ? val : null,
        },
      });
    },
    [name, native_filter_id, parameter_name, setDataMask],
  );

  useEffect(() => {
    if (filterState.value !== undefined) {
      setCurrentValue(filterState.value);
    } else if (isUsableDefaultValue) {
      handleValueChange(defaultValue);
    }
  }, [defaultValue, filterState.value, handleValueChange, isUsableDefaultValue]);

  const renderControl = () => {
    if (parameter_type === 'boolean') {
      const boolVal =
        currentValue === true || currentValue === 'true'
          ? 'true'
          : currentValue === false || currentValue === 'false'
          ? 'false'
          : undefined;

      return (
        <Select
          ariaLabel={parameter_name}
          data-test="parameter-boolean-select"
          allowClear
          value={boolVal}
          options={[
            { label: t('True'), value: 'true' },
            { label: t('False'), value: 'false' },
          ]}
          onChange={val =>
            handleValueChange(
              val === 'true' ? true : val === 'false' ? false : null,
            )
          }
        />
      );
    }

    if (parameter_type === 'integer') {
      return (
        <InputNumber
          data-test="parameter-integer-input"
          precision={0}
          step={1}
          value={
            currentValue !== null &&
            currentValue !== undefined &&
            currentValue !== ''
              ? Math.round(Number(currentValue))
              : null
          }
          onChange={(val: number | null) =>
            handleValueChange(
              val !== null && val !== undefined ? Math.round(Number(val)) : null,
            )
          }
        />
      );
    }

    if (parameter_type === 'float') {
      return (
        <InputNumber
          data-test="parameter-float-input"
          step={0.1}
          value={
            currentValue !== null &&
            currentValue !== undefined &&
            currentValue !== ''
              ? Number(currentValue)
              : null
          }
          onChange={(val: number | null) =>
            handleValueChange(
              val !== null && val !== undefined ? Number(val) : null,
            )
          }
        />
      );
    }

    return (
      <Input
        data-test="parameter-text-input"
        value={
          typeof currentValue === 'string' || typeof currentValue === 'number'
            ? currentValue
            : ''
        }
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          e.stopPropagation();
          handleValueChange(e.target.value);
        }}
      />
    );
  };

  return (
    <FilterPluginStyle height={height} width={width}>
      <StyledContainer
        data-test="parameter-container"
        tabIndex={-1}
        onFocus={setFocusedFilter}
        onBlur={unsetFocusedFilter}
        onMouseEnter={setHoveredFilter}
        onMouseLeave={unsetHoveredFilter}
        onChange={(e: React.SyntheticEvent) => {
          e.stopPropagation();
        }}
      >
        <FormItem
          validateStatus={
            filterState.validateStatus === 'error' ||
            filterState.validateStatus === 'warning' ||
            filterState.validateStatus === 'success' ||
            filterState.validateStatus === 'validating'
              ? filterState.validateStatus
              : undefined
          }
          extra={
            filterState.validateMessage ? (
              <StatusMessage
                status={
                  filterState.validateStatus === 'error' ||
                  filterState.validateStatus === 'warning' ||
                  filterState.validateStatus === 'info' ||
                  filterState.validateStatus === 'help'
                    ? filterState.validateStatus
                    : undefined
                }
              >
                {filterState.validateMessage}
              </StatusMessage>
            ) : null
          }
        >
          {renderControl()}
        </FormItem>
      </StyledContainer>
    </FilterPluginStyle>
  );
}
