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
import { Input, FormLabel, Tooltip, InfoTooltip, Constants } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { debounce } from 'lodash';
import { ControlComponentProps } from '@superset-ui/chart-controls';
import { useTheme } from '@apache-superset/core/ui';

/**
 * React component-based control for Word Cloud minimum font size.
 * This is a proper React functional component that renders actual UI,
 * replacing the legacy configuration object approach.
 */
interface SizeFromControlProps extends ControlComponentProps {
  default?: number;
  placeholder?: string;
  disabled?: boolean;
}

export const SizeFromControl: React.FC<SizeFromControlProps> = ({
  name = 'size_from',
  label = t('Minimum Font Size'),
  description = t('Font size for the smallest value in the list'),
  value,
  onChange,
  validationErrors,
  renderTrigger = true,
  hovered,
  default: defaultValue = 10,
  placeholder,
  disabled,
}) => {
  const safeStringify = (val?: string | number | null) =>
    val == null ? '' : String(val);

  const theme = useTheme();
  const labelText = typeof label === 'string' ? label : '';
  const safeValue = typeof value === 'number' || typeof value === 'string' ? value : defaultValue;
  
  const [inputValue, setInputValue] = useState(safeStringify(safeValue));

  useEffect(() => {
    if (value !== undefined && value !== null && (typeof value === 'number' || typeof value === 'string')) {
      setInputValue(safeStringify(value));
    }
  }, [value]);

  const handleChange = useCallback((inputVal: string) => {
    let parsedValue: string | number = inputVal;
    const errors: any[] = [];

    if (inputVal !== '') {
      const error = legacyValidateInteger(inputVal);
      if (error) {
        errors.push(error);
      } else {
        parsedValue = parseInt(inputVal, 10);
      }
    }

    // ControlComponentProps onChange signature is (value: JsonValue) => void
    // but we need to pass errors, so we use type assertion
    (onChange as any)?.(parsedValue, errors);
  }, [onChange]);

  const debouncedOnChange = useMemo(
    () => debounce(handleChange, Constants.FAST_DEBOUNCE),
    [handleChange],
  );

  const onChangeWrapper = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    debouncedOnChange(newValue);
  }, [debouncedOnChange]);

  return (
    <div>
      {label && (
        <div className="ControlHeader" data-test={`${name}-header`}>
          <FormLabel htmlFor={name}>
            {labelText}
            {description && hovered && (
              <Tooltip id={`${name}-tooltip`} title={description} placement="top">
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
                title={Array.isArray(validationErrors) ? validationErrors.join(' ') : String(validationErrors)}
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

// Set default props for control name extraction
SizeFromControl.defaultProps = {
  name: 'size_from',
};

