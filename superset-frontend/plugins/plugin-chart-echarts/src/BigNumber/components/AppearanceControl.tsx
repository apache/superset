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
import { Switch, Input } from '@superset-ui/core/components';
import { ControlSubSectionHeader } from '@superset-ui/chart-controls';
import FontSizeControl, {
  FONT_SIZE_OPTIONS_SMALL,
  FONT_SIZE_OPTIONS_LARGE,
} from './FontSizeControl';

export interface AppearanceControlsProps {
  values: {
    header_font_size?: number;
    subtitle?: string;
    subtitle_font_size?: number;
    subheader?: string;
    subheader_font_size?: number;
    show_metric_name?: boolean;
    metric_name_font_size?: number;
    show_timestamp?: boolean;
    show_trend_line?: boolean;
  };
  onChange: (name: string, value: any) => void;
  variant?: 'total' | 'trendline' | 'period';
}

const AppearanceControls: FC<AppearanceControlsProps> = ({
  values,
  onChange,
  variant = 'total',
}) => (
  <div className="appearance-controls">
    {/* Main Number Section */}
    <div style={{ marginBottom: '24px' }}>
      <ControlSubSectionHeader>{t('Main Number')}</ControlSubSectionHeader>
      <FontSizeControl
        name="header_font_size"
        label={t('Big Number Font Size')}
        value={values.header_font_size}
        onChange={val => onChange('header_font_size', val)}
        options={FONT_SIZE_OPTIONS_LARGE}
        defaultValue={0.4}
      />
    </div>

    {/* Subtitle Section */}
    <div style={{ marginBottom: '24px' }}>
      <ControlSubSectionHeader>{t('Subtitle')}</ControlSubSectionHeader>
      <div style={{ marginBottom: '16px' }}>
        <label>{t('Subtitle Text')}</label>
        <Input
          value={values.subtitle || ''}
          onChange={(e: any) => onChange('subtitle', e.target.value)}
          placeholder={t(
            'Description text that shows up below your Big Number',
          )}
        />
      </div>
      {values.subtitle && (
        <FontSizeControl
          name="subtitle_font_size"
          label={t('Subtitle Font Size')}
          value={values.subtitle_font_size}
          onChange={val => onChange('subtitle_font_size', val)}
          options={FONT_SIZE_OPTIONS_SMALL}
          defaultValue={0.15}
        />
      )}
    </div>

    {/* Metric Name Section */}
    <div style={{ marginBottom: '24px' }}>
      <ControlSubSectionHeader>{t('Metric Name')}</ControlSubSectionHeader>
      <div style={{ marginBottom: '16px' }}>
        <Switch
          checked={values.show_metric_name || false}
          onChange={val => onChange('show_metric_name', val)}
        />
        <span style={{ marginLeft: '8px' }}>{t('Show Metric Name')}</span>
      </div>
      {values.show_metric_name && (
        <FontSizeControl
          name="metric_name_font_size"
          label={t('Metric Name Font Size')}
          value={values.metric_name_font_size}
          onChange={val => onChange('metric_name_font_size', val)}
          options={FONT_SIZE_OPTIONS_SMALL}
          defaultValue={0.15}
        />
      )}
    </div>

    {/* Additional Options for specific variants */}
    {variant === 'trendline' && (
      <div style={{ marginBottom: '24px' }}>
        <ControlSubSectionHeader>
          {t('Trendline Options')}
        </ControlSubSectionHeader>
        <div style={{ marginBottom: '8px' }}>
          <Switch
            checked={values.show_timestamp || false}
            onChange={val => onChange('show_timestamp', val)}
          />
          <span style={{ marginLeft: '8px' }}>{t('Show Timestamp')}</span>
        </div>
        <div>
          <Switch
            checked={values.show_trend_line !== false}
            onChange={val => onChange('show_trend_line', val)}
          />
          <span style={{ marginLeft: '8px' }}>{t('Show Trend Line')}</span>
        </div>
      </div>
    )}

    {variant === 'period' && values.subheader !== undefined && (
      <div style={{ marginBottom: '24px' }}>
        <ControlSubSectionHeader>{t('Subheader')}</ControlSubSectionHeader>
        <div style={{ marginBottom: '16px' }}>
          <label>{t('Subheader Text')}</label>
          <Input
            value={values.subheader || ''}
            onChange={(e: any) => onChange('subheader', e.target.value)}
            placeholder={t('Text to show as subheader')}
          />
        </div>
        {values.subheader && (
          <FontSizeControl
            name="subheader_font_size"
            label={t('Subheader Font Size')}
            value={values.subheader_font_size}
            onChange={val => onChange('subheader_font_size', val)}
            options={FONT_SIZE_OPTIONS_SMALL}
            defaultValue={0.15}
          />
        )}
      </div>
    )}
  </div>
);

export default AppearanceControls;
