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
import { FC } from 'react';
import { t } from '@superset-ui/core';
import { Select } from '@superset-ui/core/components';
import { ControlHeader } from '@superset-ui/chart-controls';

export interface FontSizeOption {
  label: string;
  value: number;
}

export interface FontSizeControlProps {
  name: string;
  label?: string;
  description?: string;
  value?: number;
  onChange?: (value: number) => void;
  options?: FontSizeOption[];
  defaultValue?: number;
  clearable?: boolean;
  renderTrigger?: boolean;
  validationErrors?: string[];
}

export const FONT_SIZE_OPTIONS_SMALL: FontSizeOption[] = [
  { label: t('Tiny'), value: 0.125 },
  { label: t('Small'), value: 0.15 },
  { label: t('Normal'), value: 0.2 },
  { label: t('Large'), value: 0.3 },
  { label: t('Huge'), value: 0.4 },
];

export const FONT_SIZE_OPTIONS_LARGE: FontSizeOption[] = [
  { label: t('Tiny'), value: 0.2 },
  { label: t('Small'), value: 0.3 },
  { label: t('Normal'), value: 0.4 },
  { label: t('Large'), value: 0.5 },
  { label: t('Huge'), value: 0.6 },
];

const FontSizeControl: FC<FontSizeControlProps> = ({
  name,
  label,
  description,
  value,
  onChange,
  options = FONT_SIZE_OPTIONS_SMALL,
  defaultValue,
  clearable = false,
  renderTrigger,
  validationErrors,
}) => (
  <div>
    <ControlHeader
      name={name}
      label={label || t('Font Size')}
      description={description}
      validationErrors={validationErrors}
      renderTrigger={renderTrigger}
    />
    <Select
      value={value ?? defaultValue}
      onChange={(val: any) => onChange?.(val)}
      options={options}
      allowClear={clearable}
      css={{ width: '100%' }}
    />
  </div>
);

export default FontSizeControl;
