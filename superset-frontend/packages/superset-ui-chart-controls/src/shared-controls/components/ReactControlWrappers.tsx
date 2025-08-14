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

/**
 * React component wrappers for control panel controls.
 * These components wrap the underlying control implementations
 * to provide a React component interface for modern control panels.
 */

interface ControlProps {
  value?: any;
  onChange: (name: string, value: any) => void;
  datasource?: any;
  [key: string]: any;
}

/**
 * GroupBy control component
 */
export const GroupBy: FC<ControlProps> = ({ value, onChange, ...props }) => (
  // This would normally render the actual DndColumnSelect component
  // For now, return a placeholder
  <div className="control-wrapper">
    <label>{t('Group by')}</label>
    <div className="groupby-control">
      {/* DndColumnSelect would go here */}
      <input
        type="text"
        value={JSON.stringify(value || [])}
        onChange={e => {
          try {
            onChange('groupby', JSON.parse(e.target.value));
          } catch {
            // Invalid JSON
          }
        }}
        placeholder={t('Select columns')}
      />
    </div>
    <small className="text-muted">{t('One or many columns to group by')}</small>
  </div>
);

/**
 * Metrics control component
 */
export const Metrics: FC<ControlProps> = ({ value, onChange, ...props }) => (
  <div className="control-wrapper">
    <label>{t('Metrics')}</label>
    <div className="metrics-control">
      {/* DndMetricSelect would go here */}
      <input
        type="text"
        value={JSON.stringify(value || [])}
        onChange={e => {
          try {
            onChange('metrics', JSON.parse(e.target.value));
          } catch {
            // Invalid JSON
          }
        }}
        placeholder={t('Select metrics')}
      />
    </div>
    <small className="text-muted">{t('One or many metrics to display')}</small>
  </div>
);

/**
 * AdhocFilters control component
 */
export const AdhocFilters: FC<ControlProps> = ({
  value,
  onChange,
  ...props
}) => (
  <div className="control-wrapper">
    <label>{t('Filters')}</label>
    <div className="adhoc-filters-control">
      {/* AdhocFilterControl would go here */}
      <input
        type="text"
        value={JSON.stringify(value || [])}
        onChange={e => {
          try {
            onChange('adhoc_filters', JSON.parse(e.target.value));
          } catch {
            // Invalid JSON
          }
        }}
        placeholder={t('Add filters')}
      />
    </div>
    <small className="text-muted">{t('Filters to apply to the data')}</small>
  </div>
);

/**
 * RowLimit control component
 */
export const RowLimit: FC<ControlProps> = ({ value, onChange, ...props }) => (
  <div className="control-wrapper">
    <label>{t('Row limit')}</label>
    <input
      type="number"
      value={value || 100}
      onChange={e => onChange('row_limit', parseInt(e.target.value, 10))}
      min={1}
      max={100000}
    />
    <small className="text-muted">
      {t('Maximum number of rows to display')}
    </small>
  </div>
);

/**
 * ColorScheme control component
 */
export const ColorScheme: FC<ControlProps> = ({
  value,
  onChange,
  ...props
}) => (
  // This would normally render the actual ColorSchemeControlWrapper
  <div className="control-wrapper">
    <label>{t('Color scheme')}</label>
    <select
      value={value || 'supersetColors'}
      onChange={e => onChange('color_scheme', e.target.value)}
    >
      <option value="supersetColors">Superset Colors</option>
      <option value="googleCategory10c">Google Category 10c</option>
      <option value="d3Category10">D3 Category 10</option>
      <option value="d3Category20">D3 Category 20</option>
      <option value="d3Category20b">D3 Category 20b</option>
      <option value="d3Category20c">D3 Category 20c</option>
    </select>
    <small className="text-muted">{t('Color scheme for the chart')}</small>
  </div>
);

/**
 * CurrencyFormat control component
 */
export const CurrencyFormat: FC<ControlProps> = ({
  value,
  onChange,
  ...props
}) => (
  <div className="control-wrapper">
    <label>{t('Currency format')}</label>
    <select
      value={value || 'USD'}
      onChange={e => onChange('currency_format', e.target.value)}
    >
      <option value="USD">USD ($)</option>
      <option value="EUR">EUR (€)</option>
      <option value="GBP">GBP (£)</option>
      <option value="JPY">JPY (¥)</option>
      <option value="CNY">CNY (¥)</option>
      <option value="INR">INR (₹)</option>
    </select>
    <small className="text-muted">{t('Currency to use for formatting')}</small>
  </div>
);

/**
 * CheckboxControl component
 */
export const CheckboxControl: FC<{
  name: string;
  label: string;
  value?: boolean;
  onChange: (name: string, value: any) => void;
  description?: string;
  disabled?: boolean;
}> = ({ name, label, value, onChange, description, disabled }) => (
  <div className="control-wrapper">
    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="checkbox"
        checked={value ?? false}
        onChange={e => onChange(name, e.target.checked)}
        disabled={disabled}
      />
      {label}
    </label>
    {description && <small className="text-muted">{description}</small>}
  </div>
);

/**
 * NumberControl component
 */
export const NumberControl: FC<{
  name: string;
  label: string;
  value?: number;
  onChange: (name: string, value: any) => void;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
}> = ({ name, label, value, onChange, description, min, max, step }) => (
  <div className="control-wrapper">
    <label>{label}</label>
    <input
      type="number"
      value={value ?? 0}
      onChange={e => onChange(name, parseFloat(e.target.value))}
      min={min}
      max={max}
      step={step}
    />
    {description && <small className="text-muted">{description}</small>}
  </div>
);

/**
 * SelectControl component
 */
export const SelectControl: FC<{
  name: string;
  label: string;
  value?: any;
  onChange: (name: string, value: any) => void;
  description?: string;
  choices?: Array<[any, string]>;
  freeForm?: boolean;
  tokenSeparators?: string[];
  disabled?: boolean;
}> = ({
  name,
  label,
  value,
  onChange,
  description,
  choices = [],
  disabled,
}) => (
  <div className="control-wrapper">
    <label>{label}</label>
    <select
      value={value ?? ''}
      onChange={e => onChange(name, e.target.value)}
      disabled={disabled}
    >
      <option value="">Select...</option>
      {choices.map(([val, text]) => (
        <option key={val} value={val}>
          {text}
        </option>
      ))}
    </select>
    {description && <small className="text-muted">{description}</small>}
  </div>
);

/**
 * SliderControl component
 */
export const SliderControl: FC<{
  name: string;
  label: string;
  value?: number;
  onChange: (name: string, value: any) => void;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
}> = ({
  name,
  label,
  value,
  onChange,
  description,
  min = 0,
  max = 100,
  step = 1,
}) => (
  <div className="control-wrapper">
    <label>
      {label}: {value ?? min}
    </label>
    <input
      type="range"
      value={value ?? min}
      onChange={e => onChange(name, parseFloat(e.target.value))}
      min={min}
      max={max}
      step={step}
      style={{ width: '100%' }}
    />
    {description && <small className="text-muted">{description}</small>}
  </div>
);

/**
 * TextControl component
 */
export const TextControl: FC<{
  name: string;
  label: string;
  value?: string;
  onChange: (name: string, value: any) => void;
  description?: string;
  placeholder?: string;
  isFloat?: boolean;
  disabled?: boolean;
}> = ({
  name,
  label,
  value,
  onChange,
  description,
  placeholder,
  isFloat,
  disabled,
}) => (
  <div className="control-wrapper">
    <label>{label}</label>
    <input
      type="text"
      value={value ?? ''}
      onChange={e => {
        const val = e.target.value;
        onChange(name, isFloat ? parseFloat(val) || val : val);
      }}
      placeholder={placeholder}
      disabled={disabled}
    />
    {description && <small className="text-muted">{description}</small>}
  </div>
);

/**
 * Export all control components
 */
export default {
  GroupBy,
  Metrics,
  AdhocFilters,
  RowLimit,
  ColorScheme,
  CurrencyFormat,
  CheckboxControl,
  NumberControl,
  SelectControl,
  SliderControl,
  TextControl,
};
