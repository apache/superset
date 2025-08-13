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
import { getCategoricalSchemeRegistry } from '@superset-ui/core';
import { SelectControl } from './SimpleSelectControl';

export interface ColorSchemeControlProps {
  name: string;
  value?: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  required?: boolean;
  renderTrigger?: boolean;
  clearable?: boolean;
}

/**
 * Color scheme selector control
 */
export const ColorSchemeControl: React.FC<ColorSchemeControlProps> = ({
  name,
  value,
  onChange,
  label,
  description,
  required,
  renderTrigger,
  clearable = false,
}) => {
  // Get available color schemes from the categorical scheme registry
  const colorSchemes = getCategoricalSchemeRegistry().keys();
  const choices: [string, string][] = colorSchemes.map((scheme: string) => [
    scheme,
    scheme,
  ]);

  return (
    <SelectControl
      name={name}
      value={value}
      onChange={onChange as (value: string | string[]) => void}
      label={label}
      description={description}
      required={required}
      renderTrigger={renderTrigger}
      choices={choices}
      clearable={clearable}
      multiple={false}
    />
  );
};
