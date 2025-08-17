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
import { Collapse, Row, Col, Typography } from 'antd';
import {
  ControlPanelConfig,
  D3_FORMAT_OPTIONS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  D3_TIME_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
} from '@superset-ui/chart-controls';

// Import the control map which contains all control components
import controlMap from 'src/explore/components/controls';

import { DEFAULT_FORM_DATA } from './types';

console.log('PieControlPanel.tsx - Loading file');

const { Panel } = Collapse;
const { Title } = Typography;

interface PieControlPanelProps {
  onChange: (field: string, value: any) => void;
  value: Record<string, any>;
  datasource: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A TRUE React component-based control panel for Pie charts.
 * No legacy controlPanelSections, no controlSetRows, no config objects.
 * Just pure React components with Ant Design layout.
 */
export const PieControlPanel: FC<PieControlPanelProps> = ({
  onChange,
  value,
  datasource,
  form_data,
  actions,
  controls,
}) => {
  console.log('PieControlPanel rendering with:', {
    value,
    datasource,
    form_data,
    controls,
  });

  // If no valid data yet, show loading state
  if (!datasource || !form_data) {
    return <div>Loading control panel...</div>;
  }

  // Get control components from controlMap
  const { DndColumnSelect } = controlMap;
  const { DndMetricSelect } = controlMap;
  const { AdhocFilterControl } = controlMap;
  const { CheckboxControl } = controlMap;
  const { SelectControl } = controlMap;
  const { TextControl } = controlMap;
  const { SliderControl } = controlMap;
  const { ColorSchemeControl } = controlMap;

  // Helper to handle control changes using actions if available
  const handleChange = (field: string) => (val: any) => {
    console.log('Control change:', field, val);
    if (actions?.setControlValue) {
      actions.setControlValue(field, val);
    } else if (onChange) {
      onChange(field, val);
    }
  };

  // Make sure we have valid values or defaults
  const formValues = form_data || value || {};

  return (
    <div
      style={{
        padding: '16px',
        width: '100%',
        background: '#f0f0f0',
        minHeight: '500px',
      }}
    >
      <h2>🎉 Pie Control Panel - Pure React Based! 🎉</h2>
      <p>This is a TRUE React component control panel with:</p>
      <ul>
        <li>✅ No controlPanelSections</li>
        <li>✅ No controlSetRows</li>
        <li>✅ No config objects</li>
        <li>✅ Just pure React + Ant Design</li>
      </ul>
      <Collapse
        defaultActiveKey={['query', 'chart', 'labels', 'pie', 'legend']}
        ghost
      >
        {/* Query Section */}
        <Panel header={<Title level={5}>{t('Query')}</Title>} key="query">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <div
                style={{
                  padding: '10px',
                  border: '1px dashed #999',
                  borderRadius: '4px',
                }}
              >
                <strong>Group by</strong>
                <p>Current value: {JSON.stringify(formValues.groupby)}</p>
                <button
                  onClick={() => handleChange('groupby')(['test_column'])}
                >
                  Set test value
                </button>
              </div>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <div
                style={{
                  padding: '10px',
                  border: '1px dashed #999',
                  borderRadius: '4px',
                }}
              >
                <strong>Metric</strong>
                <p>Current value: {JSON.stringify(formValues.metric)}</p>
                <button onClick={() => handleChange('metric')('COUNT(*)')}>
                  Set COUNT(*)
                </button>
              </div>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <div
                style={{
                  padding: '10px',
                  border: '1px dashed #999',
                  borderRadius: '4px',
                }}
              >
                <strong>Filters</strong>
                <p>Current value: {JSON.stringify(formValues.adhoc_filters)}</p>
              </div>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <div
                style={{
                  padding: '10px',
                  border: '1px dashed #999',
                  borderRadius: '4px',
                }}
              >
                <strong>Row limit</strong>
                <input
                  type="number"
                  value={formValues.row_limit || 100}
                  onChange={e =>
                    handleChange('row_limit')(parseInt(e.target.value))
                  }
                />
              </div>
            </Col>
            <Col span={12}>
              <div
                style={{
                  padding: '10px',
                  border: '1px dashed #999',
                  borderRadius: '4px',
                }}
              >
                <strong>Sort by metric</strong>
                <input
                  type="checkbox"
                  checked={formValues.sort_by_metric ?? true}
                  onChange={e =>
                    handleChange('sort_by_metric')(e.target.checked)
                  }
                />
              </div>
            </Col>
          </Row>
        </Panel>

        {/* Chart Options */}
        <Panel
          header={<Title level={5}>{t('Chart Options')}</Title>}
          key="chart"
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <div
                style={{
                  padding: '10px',
                  border: '1px dashed #999',
                  borderRadius: '4px',
                }}
              >
                <strong>Color scheme</strong>
                <p>
                  Current value: {formValues.color_scheme || 'supersetColors'}
                </p>
              </div>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <TextControl
                label={t('Percentage threshold')}
                onChange={handleChange('show_labels_threshold')}
                value={formValues.show_labels_threshold ?? 5}
                controlId="show_labels_threshold"
                renderTrigger
              />
            </Col>
            <Col span={12}>
              <TextControl
                label={t('Threshold for Other')}
                onChange={handleChange('threshold_for_other')}
                value={formValues.threshold_for_other ?? 0}
                controlId="threshold_for_other"
                renderTrigger
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <SelectControl
                label={t('Rose Type')}
                onChange={handleChange('roseType')}
                value={formValues.roseType || null}
                choices={[
                  ['area', t('Area')],
                  ['radius', t('Radius')],
                  [null, t('None')],
                ]}
                clearable={false}
              />
            </Col>
          </Row>
        </Panel>

        {/* Labels Section */}
        <Panel header={<Title level={5}>{t('Labels')}</Title>} key="labels">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <SelectControl
                label={t('Label Type')}
                onChange={handleChange('label_type')}
                value={formValues.label_type || 'key'}
                choices={[
                  ['key', t('Category Name')],
                  ['value', t('Value')],
                  ['percent', t('Percentage')],
                  ['key_value', t('Category and Value')],
                  ['key_percent', t('Category and Percentage')],
                  ['key_value_percent', t('Category, Value and Percentage')],
                  ['value_percent', t('Value and Percentage')],
                  ['template', t('Template')],
                ]}
                clearable={false}
              />
            </Col>
          </Row>

          {formValues.label_type === 'template' && (
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={24}>
                <TextControl
                  label={t('Label Template')}
                  onChange={handleChange('label_template')}
                  value={formValues.label_template || ''}
                  controlId="label_template"
                  renderTrigger
                />
              </Col>
            </Row>
          )}

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <SelectControl
                label={t('Number format')}
                onChange={handleChange('number_format')}
                value={formValues.number_format || 'SMART_NUMBER'}
                choices={D3_FORMAT_OPTIONS}
                freeForm
              />
            </Col>
            <Col span={12}>
              <SelectControl
                label={t('Date format')}
                onChange={handleChange('date_format')}
                value={formValues.date_format || 'smart_date'}
                choices={D3_TIME_FORMAT_OPTIONS}
                freeForm
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={8}>
              <CheckboxControl
                label={t('Show Labels')}
                onChange={handleChange('show_labels')}
                value={formValues.show_labels ?? DEFAULT_FORM_DATA.showLabels}
                controlId="show_labels"
                renderTrigger
              />
            </Col>
            <Col span={8}>
              <CheckboxControl
                label={t('Put labels outside')}
                onChange={handleChange('labels_outside')}
                value={
                  formValues.labels_outside ?? DEFAULT_FORM_DATA.labelsOutside
                }
                controlId="labels_outside"
                renderTrigger
              />
            </Col>
            <Col span={8}>
              <CheckboxControl
                label={t('Label Line')}
                onChange={handleChange('label_line')}
                value={formValues.label_line ?? DEFAULT_FORM_DATA.labelLine}
                controlId="label_line"
                renderTrigger
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <CheckboxControl
                label={t('Show Total')}
                onChange={handleChange('show_total')}
                value={formValues.show_total ?? false}
                controlId="show_total"
                renderTrigger
              />
            </Col>
          </Row>
        </Panel>

        {/* Pie Shape Section */}
        <Panel header={<Title level={5}>{t('Pie shape')}</Title>} key="pie">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <SliderControl
                label={t('Outer Radius')}
                onChange={handleChange('outerRadius')}
                value={formValues.outerRadius ?? DEFAULT_FORM_DATA.outerRadius}
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <CheckboxControl
                label={t('Donut')}
                onChange={handleChange('donut')}
                value={formValues.donut ?? DEFAULT_FORM_DATA.donut}
                controlId="donut"
                renderTrigger
              />
            </Col>
          </Row>

          {formValues.donut && (
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={24}>
                <SliderControl
                  label={t('Inner Radius')}
                  onChange={handleChange('innerRadius')}
                  value={
                    formValues.innerRadius ?? DEFAULT_FORM_DATA.innerRadius
                  }
                />
              </Col>
            </Row>
          )}
        </Panel>

        {/* Legend Section */}
        <Panel header={<Title level={5}>{t('Legend')}</Title>} key="legend">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <CheckboxControl
                label={t('Show legend')}
                onChange={handleChange('show_legend')}
                value={formValues.show_legend ?? true}
                controlId="show_legend"
                renderTrigger
              />
            </Col>
          </Row>

          {formValues.show_legend && (
            <>
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <SelectControl
                    label={t('Legend type')}
                    onChange={handleChange('legendType')}
                    value={formValues.legendType || 'scroll'}
                    choices={[
                      ['scroll', t('Scroll')],
                      ['plain', t('Plain')],
                    ]}
                    clearable={false}
                  />
                </Col>
                <Col span={12}>
                  <SelectControl
                    label={t('Legend orientation')}
                    onChange={handleChange('legendOrientation')}
                    value={formValues.legendOrientation || 'top'}
                    choices={[
                      ['top', t('Top')],
                      ['bottom', t('Bottom')],
                      ['left', t('Left')],
                      ['right', t('Right')],
                    ]}
                    clearable={false}
                  />
                </Col>
              </Row>

              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <TextControl
                    label={t('Legend margin')}
                    onChange={handleChange('legendMargin')}
                    value={formValues.legendMargin || 0}
                    controlId="legendMargin"
                    renderTrigger
                  />
                </Col>
              </Row>
            </>
          )}
        </Panel>
      </Collapse>
    </div>
  );
};

/**
 * Mark this component as a modern panel so the renderer knows how to handle it
 */
(PieControlPanel as any).isModernPanel = true;

console.log(
  'PieControlPanel.tsx - Component defined, isModernPanel:',
  (PieControlPanel as any).isModernPanel,
);

// Export the component directly as the default export
export default PieControlPanel;
