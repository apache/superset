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
import React, { useCallback } from 'react';
import { Input } from '@superset-ui/core/components';
import { ControlHeader } from '../ControlHeader';

export interface TextControlProps {
  name: string;
  value?: string | number;
  onChange: (value: string | number) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  isInt?: boolean;
  isFloat?: boolean;
  min?: number;
  max?: number;
  renderTrigger?: boolean;
  required?: boolean;
}

export const TextControl: React.FC<TextControlProps> = ({
  name,
  value,
  onChange,
  label,
  description,
  placeholder,
  disabled,
  isInt,
  isFloat,
  min,
  max,
  renderTrigger,
  required,
}) => {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue: string | number = e.target.value;

      if (isInt) {
        newValue = parseInt(newValue, 10) || 0;
      } else if (isFloat) {
        newValue = parseFloat(newValue) || 0;
      }

      onChange(newValue);
    },
    [onChange, isInt, isFloat],
  );

  const inputType = isInt || isFloat ? 'number' : 'text';

  return (
    <div className="control-wrapper">
      {label && (
        <ControlHeader
          label={label}
          description={description}
          renderTrigger={renderTrigger}
          required={required}
        />
      )}
      <Input
        name={name}
        type={inputType}
        value={value ?? ''}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        css={{ width: '100%' }}
      />
    </div>
  );
};
