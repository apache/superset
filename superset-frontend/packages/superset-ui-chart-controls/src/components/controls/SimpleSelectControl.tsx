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
import React from 'react';
import { Select } from '@superset-ui/core/components';
import { ControlHeader } from '../ControlHeader';

export interface SelectControlProps {
  name: string;
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  choices: Array<[string, string]>;
  clearable?: boolean;
  multiple?: boolean;
  renderTrigger?: boolean;
  required?: boolean;
}

export const SelectControl: React.FC<SelectControlProps> = ({
  name,
  value,
  onChange,
  label,
  description,
  placeholder,
  disabled,
  choices,
  clearable = true,
  multiple = false,
  renderTrigger,
  required,
}) => {
  const options = choices.map(([val, label]) => ({
    value: val,
    label,
  }));

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
      <Select
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        options={options}
        allowClear={clearable}
        mode={multiple ? 'multiple' : undefined}
        css={{ width: '100%' }}
      />
    </div>
  );
};
