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
import { FC, useState } from 'react';
import { t } from '@superset-ui/core';
import { Switch, Input, Select } from '@superset-ui/core/components';
import { ControlSubSectionHeader, Dataset } from '@superset-ui/chart-controls';
import AppearanceControls from './AppearanceControl';
import FormatControl from './FormatControl';

export interface BigNumberControlPanelProps {
  variant: 'total' | 'trendline' | 'period';
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  datasource?: Dataset;
  chart?: any;
  formData?: any;
}

/**
 * Unified React-based control panel for all BigNumber variants
 */
const BigNumberControlPanel: FC<BigNumberControlPanelProps> = ({
  variant,
  values,
  onChange,
  datasource,
  chart,
  formData,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="big-number-control-panel">
      {/* Query Section - Handled by traditional controls */}
      <div style={{ marginBottom: '32px' }}>
        <h4>{t('Query')}</h4>
        <p style={{ color: '#666', fontSize: '12px' }}>
          {t(
            'Metric and filter controls are handled by the traditional control system',
          )}
        </p>
      </div>

      {/* Formatting Section */}
      <div style={{ marginBottom: '32px' }}>
        <h4>{t('Number Formatting')}</h4>

        <FormatControl
          name="y_axis_format"
          label={t('Number Format')}
          value={values.y_axis_format}
          onChange={val => onChange('y_axis_format', val)}
          formatType="number"
        />

        {variant === 'period' && (
          <div style={{ marginTop: '16px' }}>
            <FormatControl
              name="percentDifferenceFormat"
              label={t('Percent Difference Format')}
              value={values.percentDifferenceFormat}
              onChange={val => onChange('percentDifferenceFormat', val)}
              formatType="number"
            />
          </div>
        )}

        <div style={{ marginTop: '16px' }}>
          <FormatControl
            name="currency_format"
            label={t('Currency Format')}
            value={values.currency_format}
            onChange={val => onChange('currency_format', val)}
            formatType="currency"
          />
        </div>

        {(variant === 'total' || variant === 'trendline') && (
          <>
            <div style={{ marginTop: '16px' }}>
              <Switch
                checked={values.force_timestamp_formatting || false}
                onChange={val => onChange('force_timestamp_formatting', val)}
              />
              <span style={{ marginLeft: '8px' }}>
                {t('Force Date Format')}
              </span>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                {t(
                  'Use date formatting even when metric value is not a timestamp',
                )}
              </p>
            </div>

            {values.force_timestamp_formatting && (
              <div style={{ marginTop: '16px' }}>
                <FormatControl
                  name="time_format"
                  value={values.time_format}
                  onChange={val => onChange('time_format', val)}
                  formatType="time"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Appearance Section */}
      <div style={{ marginBottom: '32px' }}>
        <h4>{t('Appearance')}</h4>
        <AppearanceControls
          values={values}
          onChange={onChange}
          variant={variant}
        />
      </div>

      {/* Variant-specific sections */}
      {variant === 'trendline' && (
        <div style={{ marginBottom: '32px' }}>
          <h4>{t('Comparison Options')}</h4>

          <div style={{ marginBottom: '16px' }}>
            <label>{t('Comparison Period Lag')}</label>
            <Input
              type="number"
              value={values.compare_lag}
              onChange={(e: any) =>
                onChange('compare_lag', parseInt(e.target.value))
              }
              placeholder={t('Number of time periods to compare against')}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label>{t('Comparison Suffix')}</label>
            <Input
              value={values.compare_suffix}
              onChange={(e: any) => onChange('compare_suffix', e.target.value)}
              placeholder={t('Suffix to apply after the percentage display')}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label>{t('Start Y-axis at 0')}</label>
            <Switch
              checked={values.start_y_axis_at_zero || false}
              onChange={val => onChange('start_y_axis_at_zero', val)}
            />
            <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              {t(
                'Start y-axis at zero. Uncheck to start y-axis at minimum value in the data.',
              )}
            </p>
          </div>
        </div>
      )}

      {variant === 'period' && (
        <div style={{ marginBottom: '32px' }}>
          <h4>{t('Period Comparison')}</h4>

          <div style={{ marginBottom: '16px' }}>
            <label>{t('Color Scheme')}</label>
            <Select
              value={values.color_scheme}
              onChange={(val: any) => onChange('color_scheme', val)}
              options={[
                { value: 'Green', label: t('Green') },
                { value: 'Red', label: t('Red') },
                { value: 'Yellow', label: t('Yellow') },
                { value: 'Blue', label: t('Blue') },
                { value: 'Teal', label: t('Teal') },
                { value: 'Orange', label: t('Orange') },
                { value: 'Purple', label: t('Purple') },
              ]}
              css={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label>{t('Comparison Label')}</label>
            <Input
              value={values.comparison_label}
              onChange={(e: any) =>
                onChange('comparison_label', e.target.value)
              }
              placeholder={t('Label to use for the comparison value')}
            />
          </div>
        </div>
      )}

      {/* Advanced Options */}
      <div style={{ marginBottom: '32px' }}>
        <div
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            marginBottom: '16px',
          }}
        >
          <span style={{ marginRight: '8px' }}>
            {showAdvanced ? '▼' : '▶'}
          </span>
          <h4 style={{ margin: 0 }}>{t('Advanced Options')}</h4>
        </div>

        {showAdvanced && (
          <div style={{ paddingLeft: '20px' }}>
            {/* Conditional Formatting */}
            {variant === 'total' && (
              <div style={{ marginBottom: '16px' }}>
                <ControlSubSectionHeader>
                  {t('Conditional Formatting')}
                </ControlSubSectionHeader>
                <p
                  style={{
                    fontSize: '12px',
                    color: '#666',
                    marginBottom: '8px',
                  }}
                >
                  {t('Apply conditional color formatting to metric')}
                </p>
                <div
                  style={{
                    border: '1px solid #e0e0e0',
                    padding: '12px',
                    borderRadius: '4px',
                  }}
                >
                  {t('Conditional formatting control would be rendered here')}
                </div>
              </div>
            )}

            {/* Row Limit for Period over Period */}
            {variant === 'period' && (
              <div style={{ marginBottom: '16px' }}>
                <label>{t('Row Limit')}</label>
                <Input
                  type="number"
                  value={values.row_limit}
                  onChange={(e: any) =>
                    onChange('row_limit', parseInt(e.target.value))
                  }
                  placeholder={t('Limit the number of rows')}
                />
              </div>
            )}

            {/* Aggregation for Trendline */}
            {variant === 'trendline' && (
              <div style={{ marginBottom: '16px' }}>
                <label>{t('Time Grain')}</label>
                <Select
                  value={values.time_grain_sqla}
                  onChange={(val: any) => onChange('time_grain_sqla', val)}
                  options={[
                    { value: 'P1D', label: t('Day') },
                    { value: 'P1W', label: t('Week') },
                    { value: 'P1M', label: t('Month') },
                    { value: 'P3M', label: t('Quarter') },
                    { value: 'P1Y', label: t('Year') },
                  ]}
                  allowClear
                  placeholder={t('Select time grain')}
                  css={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BigNumberControlPanel;
