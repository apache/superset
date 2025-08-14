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
import { Row, Col } from '@superset-ui/core/components';
import {
  ControlSection,
  SingleControlRow,
  TwoColumnRow,
  ThreeColumnRow,
} from './ControlPanelLayout';
import {
  GroupBy,
  Metrics,
  AdhocFilters,
  ColorScheme,
} from './ReactControlWrappers';

/**
 * Example of a modern control panel that uses React components directly
 * instead of the legacy controlSetRows structure.
 *
 * This demonstrates how to:
 * 1. Use Ant Design's Row/Col for layout
 * 2. Use our layout utility components
 * 3. Structure sections with React components
 * 4. Avoid the nested array structure of controlSetRows
 */

interface ModernControlPanelProps {
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  datasource?: any;
}

export const ModernControlPanelExample: FC<ModernControlPanelProps> = ({
  values,
  onChange,
  datasource,
}) => (
  <div className="modern-control-panel">
    {/* Query Section - Always expanded */}
    <ControlSection label={t('Query')} expanded>
      {/* Single control in full width */}
      <SingleControlRow>
        <GroupBy value={values.groupby} onChange={onChange} />
      </SingleControlRow>

      {/* Two controls side by side */}
      <TwoColumnRow
        left={<Metrics value={values.metrics} onChange={onChange} />}
        right={
          <AdhocFilters value={values.adhoc_filters} onChange={onChange} />
        }
      />

      {/* Three controls in a row */}
      <ThreeColumnRow
        left={
          <div>
            <label>{t('Row Limit')}</label>
            <input
              type="number"
              value={values.row_limit || 100}
              onChange={e =>
                onChange('row_limit', parseInt(e.target.value, 10))
              }
            />
          </div>
        }
        center={
          <div>
            <label>{t('Sort By')}</label>
            <select
              value={values.sort_by || 'metric'}
              onChange={e => onChange('sort_by', e.target.value)}
            >
              <option value="metric">Metric</option>
              <option value="alpha">Alphabetical</option>
            </select>
          </div>
        }
        right={
          <div>
            <label>{t('Order')}</label>
            <select
              value={values.order || 'desc'}
              onChange={e => onChange('order', e.target.value)}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        }
      />
    </ControlSection>

    {/* Appearance Section - Collapsible */}
    <ControlSection
      label={t('Appearance')}
      description={t('Customize chart appearance')}
      expanded={false}
    >
      {/* Using Row/Col directly for custom layouts */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <ColorScheme value={values.color_scheme} onChange={onChange} />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={8}>
          <label>{t('Opacity')}</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={values.opacity || 1}
            onChange={e => onChange('opacity', parseFloat(e.target.value))}
          />
        </Col>
        <Col span={8}>
          <label>{t('Show Legend')}</label>
          <input
            type="checkbox"
            checked={values.show_legend ?? true}
            onChange={e => onChange('show_legend', e.target.checked)}
          />
        </Col>
        <Col span={8}>
          <label>{t('Show Labels')}</label>
          <input
            type="checkbox"
            checked={values.show_labels ?? false}
            onChange={e => onChange('show_labels', e.target.checked)}
          />
        </Col>
      </Row>

      {/* Conditional controls */}
      {values.show_labels && (
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <label>{t('Label Type')}</label>
            <select
              value={values.label_type || 'value'}
              onChange={e => onChange('label_type', e.target.value)}
            >
              <option value="value">Value</option>
              <option value="percent">Percentage</option>
              <option value="key">Category</option>
            </select>
          </Col>
          <Col span={12}>
            <label>{t('Label Position')}</label>
            <select
              value={values.label_position || 'inside'}
              onChange={e => onChange('label_position', e.target.value)}
            >
              <option value="inside">Inside</option>
              <option value="outside">Outside</option>
            </select>
          </Col>
        </Row>
      )}
    </ControlSection>

    {/* Advanced Section */}
    <ControlSection label={t('Advanced')} expanded={false}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <label>{t('Custom CSS')}</label>
          <textarea
            value={values.custom_css || ''}
            onChange={e => onChange('custom_css', e.target.value)}
            rows={4}
            style={{ width: '100%' }}
            placeholder={t('Enter custom CSS styles')}
          />
        </Col>
      </Row>
    </ControlSection>
  </div>
);

/**
 * Alternative approach using a configuration object
 * This could be used to generate the UI dynamically
 */
export const modernPanelConfig = {
  sections: [
    {
      id: 'query',
      label: t('Query'),
      expanded: true,
      rows: [
        {
          type: 'single',
          control: { type: 'groupby', name: 'groupby' },
        },
        {
          type: 'double',
          left: { type: 'metrics', name: 'metrics' },
          right: { type: 'adhoc_filters', name: 'adhoc_filters' },
        },
        {
          type: 'triple',
          left: { type: 'row_limit', name: 'row_limit' },
          center: { type: 'sort_by', name: 'sort_by' },
          right: { type: 'order', name: 'order' },
        },
      ],
    },
    {
      id: 'appearance',
      label: t('Appearance'),
      description: t('Customize chart appearance'),
      expanded: false,
      rows: [
        {
          type: 'single',
          control: { type: 'color_scheme', name: 'color_scheme' },
        },
        {
          type: 'custom',
          render: (values: any, onChange: any) => (
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <label>{t('Opacity')}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={values.opacity || 1}
                  onChange={e =>
                    onChange('opacity', parseFloat(e.target.value))
                  }
                />
              </Col>
              <Col span={8}>
                <label>{t('Show Legend')}</label>
                <input
                  type="checkbox"
                  checked={values.show_legend ?? true}
                  onChange={e => onChange('show_legend', e.target.checked)}
                />
              </Col>
              <Col span={8}>
                <label>{t('Show Labels')}</label>
                <input
                  type="checkbox"
                  checked={values.show_labels ?? false}
                  onChange={e => onChange('show_labels', e.target.checked)}
                />
              </Col>
            </Row>
          ),
        },
      ],
    },
  ],
};

export default ModernControlPanelExample;
