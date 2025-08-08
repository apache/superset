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
import { Input, Select, Switch, InputNumber } from 'antd';

export interface AxisControlSectionProps {
  axis: 'x' | 'y';
  showTitle?: boolean;
  showFormat?: boolean;
  showRotation?: boolean;
  showBounds?: boolean;
  showLogarithmic?: boolean;
  showMinorTicks?: boolean;
  showTruncate?: boolean;
  timeFormat?: boolean;
  values?: Record<string, any>;
  onChange?: (name: string, value: any) => void;
}

const D3_FORMAT_OPTIONS = [
  ['SMART_NUMBER', t('Adaptive formatting')],
  ['~g', t('Original value')],
  ['d', t('Signed integer')],
  ['.1f', t('1 decimal place')],
  ['.2f', t('2 decimal places')],
  ['.3f', t('3 decimal places')],
  ['+,', t('Positive integer')],
  ['$,.2f', t('Currency (2 decimals)')],
  [',.0%', t('Percentage')],
  ['.1%', t('Percentage (1 decimal)')],
];

const D3_TIME_FORMAT_OPTIONS = [
  ['smart_date', t('Adaptive formatting')],
  ['%Y-%m-%d', t('2023-01-01')],
  ['%Y-%m-%d %H:%M', t('2023-01-01 10:30')],
  ['%m/%d/%Y', t('01/01/2023')],
  ['%d/%m/%Y', t('01/01/2023')],
  ['%Y', t('2023')],
  ['%B %Y', t('January 2023')],
  ['%b %Y', t('Jan 2023')],
  ['%B %-d, %Y', t('January 1, 2023')],
];

const ROTATION_OPTIONS = [
  [0, '0°'],
  [45, '45°'],
  [90, '90°'],
  [-45, '-45°'],
  [-90, '-90°'],
];

export const AxisControlSection: FC<AxisControlSectionProps> = ({
  axis,
  showTitle = true,
  showFormat = true,
  showRotation = false,
  showBounds = false,
  showLogarithmic = false,
  showMinorTicks = false,
  showTruncate = false,
  timeFormat = false,
  values = {},
  onChange = () => {},
}) => {
  const isXAxis = axis === 'x';
  const axisUpper = axis.toUpperCase();
  const titleKey = `${axis}_axis_title`;
  const formatKey = timeFormat
    ? `${axis}_axis_time_format`
    : `${axis}_axis_format`;
  const rotationKey = `${axis}_axis_label_rotation`;
  const boundsMinKey = `${axis}_axis_bounds_min`;
  const boundsMaxKey = `${axis}_axis_bounds_max`;
  const logScaleKey = `log_scale`;
  const minorTicksKey = `${axis}_axis_minor_ticks`;
  const truncateKey = `truncate_${axis}axis`;
  const truncateLabelsKey = `${axis}_axis_truncate_labels`;

  return (
    <div className="axis-control-section">
      {showTitle && (
        <div className="control-row" style={{ marginBottom: 16 }}>
          <label>{t(`${axisUpper} Axis Title`)}</label>
          <Input
            value={values[titleKey] || ''}
            onChange={e => onChange(titleKey, e.target.value)}
            placeholder={t(`Enter ${axis} axis title`)}
          />
          <small className="text-muted">
            {t(
              'Overrides the axis title derived from the metric or column name',
            )}
          </small>
        </div>
      )}

      {showFormat && (
        <div className="control-row" style={{ marginBottom: 16 }}>
          <label>{t(`${axisUpper} Axis Format`)}</label>
          <Select
            value={
              values[formatKey] || (timeFormat ? 'smart_date' : 'SMART_NUMBER')
            }
            onChange={value => onChange(formatKey, value)}
            style={{ width: '100%' }}
            showSearch
            placeholder={t('Select or type a format')}
            options={(timeFormat
              ? D3_TIME_FORMAT_OPTIONS
              : D3_FORMAT_OPTIONS
            ).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <small className="text-muted">
            {timeFormat
              ? t('D3 time format for x axis')
              : t('D3 format for axis values')}
          </small>
        </div>
      )}

      {showRotation && isXAxis && (
        <div className="control-row" style={{ marginBottom: 16 }}>
          <label>{t('Label Rotation')}</label>
          <Select
            value={values[rotationKey] || 0}
            onChange={value => onChange(rotationKey, value)}
            style={{ width: '100%' }}
            options={ROTATION_OPTIONS.map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <small className="text-muted">
            {t('Rotation angle for axis labels')}
          </small>
        </div>
      )}

      {showBounds && (
        <div className="control-row" style={{ marginBottom: 16 }}>
          <label>{t(`${axisUpper} Axis Bounds`)}</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <InputNumber
              value={values[boundsMinKey]}
              onChange={value => onChange(boundsMinKey, value)}
              placeholder={t('Min')}
              style={{ flex: 1 }}
            />
            <InputNumber
              value={values[boundsMaxKey]}
              onChange={value => onChange(boundsMaxKey, value)}
              placeholder={t('Max')}
              style={{ flex: 1 }}
            />
          </div>
          <small className="text-muted">
            {t('Bounds for axis values. Leave empty for automatic scaling.')}
          </small>
        </div>
      )}

      {showLogarithmic && !isXAxis && (
        <div className="control-row" style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={values[logScaleKey] || false}
              onChange={checked => onChange(logScaleKey, checked)}
            />
            {t('Logarithmic Scale')}
          </label>
          <small className="text-muted">
            {t('Use a logarithmic scale for the Y-axis')}
          </small>
        </div>
      )}

      {showMinorTicks && !isXAxis && (
        <div className="control-row" style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={values[minorTicksKey] || false}
              onChange={checked => onChange(minorTicksKey, checked)}
            />
            {t('Show Minor Ticks')}
          </label>
          <small className="text-muted">
            {t('Show minor grid lines on the axis')}
          </small>
        </div>
      )}

      {showTruncate && (
        <div className="control-row" style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch
              checked={
                values[truncateKey] || values[truncateLabelsKey] || false
              }
              onChange={checked => {
                onChange(truncateKey, checked);
                onChange(truncateLabelsKey, checked);
              }}
            />
            {t(`Truncate ${axisUpper} Axis Labels`)}
          </label>
          <small className="text-muted">
            {t('Truncate long axis labels to prevent overlap')}
          </small>
        </div>
      )}
    </div>
  );
};

export default AxisControlSection;
