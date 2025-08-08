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
import { Select, Switch, InputNumber, Input } from 'antd';

export interface LabelControlGroupProps {
  chartType?: 'pie' | 'sunburst' | 'treemap' | 'funnel' | 'gauge';
  showLabelType?: boolean;
  showTemplate?: boolean;
  showThreshold?: boolean;
  showOutside?: boolean;
  showLabelLine?: boolean;
  showRotation?: boolean;
  showUpperLabels?: boolean;
  values?: Record<string, any>;
  onChange?: (name: string, value: any) => void;
}

const LABEL_TYPE_OPTIONS = [
  ['key', t('Category Name')],
  ['value', t('Value')],
  ['percent', t('Percentage')],
  ['key_value', t('Category and Value')],
  ['key_percent', t('Category and Percentage')],
  ['key_value_percent', t('Category, Value and Percentage')],
  ['value_percent', t('Value and Percentage')],
  ['template', t('Template')],
];

const LABEL_ROTATION_OPTIONS = [
  ['0', t('Horizontal')],
  ['45', t('45°')],
  ['90', t('Vertical')],
  ['-45', t('-45°')],
];

const LabelControlGroup: FC<LabelControlGroupProps> = ({
  chartType = 'pie',
  showLabelType = true,
  showTemplate = true,
  showThreshold = true,
  showOutside = false,
  showLabelLine = false,
  showRotation = false,
  showUpperLabels = false,
  values = {},
  onChange = () => {},
}) => {
  const showLabels = values.show_labels ?? true;
  const labelType = values.label_type || 'key';

  return (
    <div className="label-control-group">
      {/* Show Labels Toggle */}
      <div className="control-row" style={{ marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch
            checked={showLabels}
            onChange={checked => onChange('show_labels', checked)}
          />
          {t('Show Labels')}
        </label>
        <small className="text-muted">
          {t('Whether to display the labels')}
        </small>
      </div>

      {showLabels && (
        <>
          {/* Label Type */}
          {showLabelType && (
            <div className="control-row" style={{ marginBottom: 16 }}>
              <label>{t('Label Type')}</label>
              <Select
                value={labelType}
                onChange={value => onChange('label_type', value)}
                style={{ width: '100%' }}
                options={LABEL_TYPE_OPTIONS.map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              <small className="text-muted">
                {t('What should be shown on the label?')}
              </small>
            </div>
          )}

          {/* Label Template */}
          {showTemplate && labelType === 'template' && (
            <div className="control-row" style={{ marginBottom: 16 }}>
              <label>{t('Label Template')}</label>
              <Input.TextArea
                value={values.label_template || ''}
                onChange={e => onChange('label_template', e.target.value)}
                placeholder="{name}: {value} ({percent}%)"
                rows={3}
              />
              <small className="text-muted">
                {t(
                  'Format data labels. Use variables: {name}, {value}, {percent}. \\n represents a new line.',
                )}
              </small>
            </div>
          )}

          {/* Label Threshold */}
          {showThreshold && (
            <div className="control-row" style={{ marginBottom: 16 }}>
              <label>{t('Label Threshold')}</label>
              <InputNumber
                value={values.show_labels_threshold ?? 5}
                onChange={value => onChange('show_labels_threshold', value)}
                min={0}
                max={100}
                step={0.5}
                formatter={value => `${value}%`}
                parser={value => Number((value as string).replace('%', ''))}
                style={{ width: '100%' }}
              />
              <small className="text-muted">
                {t('Minimum threshold in percentage points for showing labels')}
              </small>
            </div>
          )}

          {/* Labels Outside (Pie specific) */}
          {showOutside && chartType === 'pie' && (
            <div className="control-row" style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch
                  checked={values.labels_outside || false}
                  onChange={checked => onChange('labels_outside', checked)}
                />
                {t('Put labels outside')}
              </label>
              <small className="text-muted">
                {t('Put the labels outside of the pie?')}
              </small>
            </div>
          )}

          {/* Label Line (Pie specific) */}
          {showLabelLine && chartType === 'pie' && values.labels_outside && (
            <div className="control-row" style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch
                  checked={values.label_line || false}
                  onChange={checked => onChange('label_line', checked)}
                />
                {t('Label Line')}
              </label>
              <small className="text-muted">
                {t('Draw a line from the label to the slice')}
              </small>
            </div>
          )}

          {/* Label Rotation */}
          {showRotation && (
            <div className="control-row" style={{ marginBottom: 16 }}>
              <label>{t('Label Rotation')}</label>
              <Select
                value={values.label_rotation || '0'}
                onChange={value => onChange('label_rotation', value)}
                style={{ width: '100%' }}
                options={LABEL_ROTATION_OPTIONS.map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              <small className="text-muted">
                {t('Rotation angle of labels')}
              </small>
            </div>
          )}

          {/* Show Upper Labels (Treemap specific) */}
          {showUpperLabels && chartType === 'treemap' && (
            <div className="control-row" style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch
                  checked={values.show_upper_labels || false}
                  onChange={checked => onChange('show_upper_labels', checked)}
                />
                {t('Show Upper Labels')}
              </label>
              <small className="text-muted">
                {t('Show labels for parent nodes')}
              </small>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LabelControlGroup;
