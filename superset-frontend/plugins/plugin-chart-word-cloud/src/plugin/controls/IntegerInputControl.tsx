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
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { t, legacyValidateInteger } from '@superset-ui/core';
import {
  Input,
  FormLabel,
  Tooltip,
  InfoTooltip,
  Constants,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { debounce } from 'lodash';
import { useTheme } from '@apache-superset/core/ui';
import { ExtendedControlComponentProps } from './types';

/**
 * Configuration for IntegerInputControl component.
 */
export interface IntegerInputControlConfig {
  /** Default control name */
  defaultName: string;
  /** Default label text */
  defaultLabel: string;
  /** Default description text */
  defaultDescription: string;
  /** Default numeric value */
  defaultValue: number;
}

/**
 * Props for IntegerInputControl component.
 */
export interface IntegerInputControlProps
  extends ExtendedControlComponentProps {
  /** Default numeric value */
  default?: number;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Configuration for default values (used when props are not provided) */
  config?: IntegerInputControlConfig;
}

/**
 * Reusable integer input control component with validation.
 * This component handles integer input with debouncing, validation, and error display.
 */
export const IntegerInputControl: React.FC<IntegerInputControlProps> = ({
  name,
  label,
  description,
  value,
  onChange,
  validationErrors,
  renderTrigger = true,
  hovered,
  default: defaultValue,
  placeholder,
  disabled,
  config,
}) => {
  const safeStringify = (val?: string | number | null) =>
    val == null ? '' : String(val);

  const theme = useTheme();
  const finalName = name || config?.defaultName || '';
  const finalLabel = label || config?.defaultLabel || '';
  const finalDescription = description || config?.defaultDescription || '';
  const finalDefaultValue = defaultValue ?? config?.defaultValue ?? 0;
  const labelText = typeof finalLabel === 'string' ? finalLabel : '';
  const safeValue =
    typeof value === 'number' || typeof value === 'string'
      ? value
      : finalDefaultValue;

  const [inputValue, setInputValue] = useState(safeStringify(safeValue));

  useEffect(() => {
    if (
      value !== undefined &&
      value !== null &&
      (typeof value === 'number' || typeof value === 'string')
    ) {
      setInputValue(safeStringify(value));
    }
  }, [value]);

  const handleChange = useCallback(
    (inputVal: string) => {
      let parsedValue: string | number = inputVal;
      const errors: string[] = [];

      if (inputVal !== '') {
        const error = legacyValidateInteger(inputVal);
        if (error) {
          errors.push(error);
        } else {
          parsedValue = parseInt(inputVal, 10);
        }
      }

      onChange?.(parsedValue, errors);
    },
    [onChange],
  );

  const debouncedOnChange = useMemo(
    () => debounce(handleChange, Constants.FAST_DEBOUNCE),
    [handleChange],
  );

  const onChangeWrapper = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setInputValue(newValue);
      debouncedOnChange(newValue);
    },
    [debouncedOnChange],
  );

  return (
    <div>
      {finalLabel && (
        <div className="ControlHeader" data-test={`${finalName}-header`}>
          <FormLabel htmlFor={finalName}>
            {labelText}
            {finalDescription && hovered && (
              <Tooltip
                id={`${finalName}-tooltip`}
                title={finalDescription}
                placement="top"
              >
                <Icons.InfoCircleOutlined />
              </Tooltip>
            )}
            {renderTrigger && hovered && (
              <InfoTooltip
                label={t('bolt')}
                tooltip={t('Changing this control takes effect instantly')}
                placement="top"
                type="notice"
              />
            )}
            {validationErrors && validationErrors.length > 0 && (
              <Tooltip
                id="error-tooltip"
                placement="top"
                title={
                  Array.isArray(validationErrors)
                    ? validationErrors.join(' ')
                    : String(validationErrors)
                }
              >
                <Icons.ExclamationCircleOutlined iconColor={theme.colorError} />
              </Tooltip>
            )}
          </FormLabel>
        </div>
      )}
      <Input
        type="text"
        data-test="inline-name"
        placeholder={placeholder}
        onChange={onChangeWrapper}
        value={inputValue}
        disabled={disabled}
        aria-label={labelText}
      />
    </div>
  );
};
