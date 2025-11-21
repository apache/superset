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
import React, { useMemo } from 'react';
import { t } from '@superset-ui/core';
import { Select, FormLabel, Tooltip, InfoTooltip } from '@superset-ui/core/components';
import { ControlComponentProps } from '@superset-ui/chart-controls';
import { Icons } from '@superset-ui/core/components/Icons';
import { useTheme } from '@apache-superset/core/ui';

/**
 * React component-based control for Word Cloud rotation setting.
 * This is a proper React functional component that renders actual UI,
 * replacing the legacy configuration object approach.
 */
export const RotationControl: React.FC<ControlComponentProps> = ({
  name = 'rotation',
  label = t('Word Rotation'),
  description = t('Rotation to apply to words in the cloud'),
  value,
  onChange,
  validationErrors,
  renderTrigger = true,
  hovered,
  ...restProps
}) => {
  const choices = useMemo(
    () => [
      ['random', t('random')],
      ['flat', t('flat')],
      ['square', t('square')],
    ],
    [],
  );

  const options = useMemo(
    () =>
      choices.map(([val, label]) => ({
        label,
        value: val,
      })),
    [choices],
  );

  const currentValue = value ?? 'square';

  const theme = useTheme();
  const labelText = typeof label === 'string' ? label : '';

  const handleChange = (selectedValue: string | string[]) => {
    const value = Array.isArray(selectedValue) ? selectedValue[0] : selectedValue;
    // ControlComponentProps onChange signature is (value: JsonValue) => void
    // but we need to pass errors, so we use type assertion
    (onChange as any)?.(value, []);
  };

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
                title={validationErrors.join(' ')}
              >
                <Icons.ExclamationCircleOutlined iconColor={theme.colorError} />
              </Tooltip>
            )}
          </FormLabel>
        </div>
      )}
      <Select
        name={`select-${name}`}
        options={options}
        value={currentValue as string}
        onChange={handleChange}
        allowClear={false}
        ariaLabel={labelText || t('Select ...')}
      />
    </div>
  );
};

// Set default props for control name extraction
RotationControl.defaultProps = {
  name: 'rotation',
};

