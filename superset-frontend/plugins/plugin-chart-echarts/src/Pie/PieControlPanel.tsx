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
}) => {
  // Get control components from controlMap
  const DndColumnSelect = controlMap.DndColumnSelect;
  const DndMetricSelect = controlMap.DndMetricSelect;
  const AdhocFilterControl = controlMap.AdhocFilterControl;
  const CheckboxControl = controlMap.CheckboxControl;
  const SelectControl = controlMap.SelectControl;
  const TextControl = controlMap.TextControl;
  const SliderControl = controlMap.SliderControl;
  const ColorSchemeControl = controlMap.ColorSchemeControl;
  
  // Helper to handle control changes
  const handleChange = (field: string) => (val: any) => {
    onChange(field, val);
  };

  return (
    <div style={{ padding: '16px' }}>
      <Collapse defaultActiveKey={['query', 'chart', 'labels', 'pie', 'legend']} ghost>
        {/* Query Section */}
        <Panel header={<Title level={5}>{t('Query')}</Title>} key="query">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <DndColumnSelect
                name="groupby"
                label={t('Group by')}
                onChange={handleChange('groupby')}
                value={value.groupby || []}
                datasource={datasource}
                multi
              />
            </Col>
          </Row>
          
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <DndMetricSelect
                name="metric"
                label={t('Metric')}
                onChange={handleChange('metric')}
                value={value.metric}
                datasource={datasource}
                multi={false}
              />
            </Col>
          </Row>
          
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={24}>
              <AdhocFilterControl
                name="adhoc_filters"
                label={t('Filters')}
                onChange={handleChange('adhoc_filters')}
                value={value.adhoc_filters || []}
                datasource={datasource}
              />
            </Col>
          </Row>
          
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <TextControl
                label={t('Row limit')}
                onChange={handleChange('row_limit')}
                value={value.row_limit || 100}
                controlId="row_limit"
                renderTrigger
              />
            </Col>
            <Col span={12}>
              <CheckboxControl
                label={t('Sort by metric')}
                onChange={handleChange('sort_by_metric')}
                value={value.sort_by_metric ?? true}
                controlId="sort_by_metric"
                renderTrigger
              />
            </Col>
          </Row>
        </Panel>
        
        {/* Chart Options */}
        <Panel header={<Title level={5}>{t('Chart Options')}</Title>} key="chart">
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <ColorSchemeControl
                name="color_scheme"
                label={t('Color scheme')}
                onChange={handleChange('color_scheme')}
                value={value.color_scheme || 'supersetColors'}
                schemes={() => {}}
                isLinear={false}
              />
            </Col>
          </Row>
          
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <TextControl
                label={t('Percentage threshold')}
                
                onChange={handleChange('show_labels_threshold')}
                value={value.show_labels_threshold ?? 5}
                controlId="show_labels_threshold"
                renderTrigger
                
              />
            </Col>
            <Col span={12}>
              <TextControl
                label={t('Threshold for Other')}
                
                onChange={handleChange('threshold_for_other')}
                value={value.threshold_for_other ?? 0}
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
                value={value.roseType || null}
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
                value={value.label_type || 'key'}
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
          
          {value.label_type === 'template' && (
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={24}>
                <TextControl
                  label={t('Label Template')}
                  onChange={handleChange('label_template')}
                  value={value.label_template || ''}
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
                value={value.number_format || 'SMART_NUMBER'}
                choices={D3_FORMAT_OPTIONS}
                freeForm
              />
            </Col>
            <Col span={12}>
              <SelectControl
                label={t('Date format')}
                
                onChange={handleChange('date_format')}
                value={value.date_format || 'smart_date'}
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
                value={value.show_labels ?? DEFAULT_FORM_DATA.showLabels}
                controlId="show_labels"
                renderTrigger
              />
            </Col>
            <Col span={8}>
              <CheckboxControl
                label={t('Put labels outside')}
                
                onChange={handleChange('labels_outside')}
                value={value.labels_outside ?? DEFAULT_FORM_DATA.labelsOutside}
                controlId="labels_outside"
                renderTrigger
              />
            </Col>
            <Col span={8}>
              <CheckboxControl
                label={t('Label Line')}
                
                onChange={handleChange('label_line')}
                value={value.label_line ?? DEFAULT_FORM_DATA.labelLine}
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
                value={value.show_total ?? false}
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
                value={value.outerRadius ?? DEFAULT_FORM_DATA.outerRadius}
              />
            </Col>
          </Row>
          
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={12}>
              <CheckboxControl
                label={t('Donut')}
                
                onChange={handleChange('donut')}
                value={value.donut ?? DEFAULT_FORM_DATA.donut}
                controlId="donut"
                renderTrigger
              />
            </Col>
          </Row>
          
          {value.donut && (
            <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
              <Col span={24}>
                <SliderControl
                  label={t('Inner Radius')}
                  onChange={handleChange('innerRadius')}
                  value={value.innerRadius ?? DEFAULT_FORM_DATA.innerRadius}
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
                value={value.show_legend ?? true}
                controlId="show_legend"
                renderTrigger
              />
            </Col>
          </Row>
          
          {value.show_legend && (
            <>
              <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <SelectControl
                    label={t('Legend type')}
                    
                    onChange={handleChange('legendType')}
                    value={value.legendType || 'scroll'}
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
                    value={value.legendOrientation || 'top'}
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
                    value={value.legendMargin || 0}
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
 * Export as a ControlPanelConfig that just contains our React component.
 * This is the bridge between the old system and our new approach.
 */
const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('React Control Panel'),
      expanded: true,
      controlSetRows: [
        [
          <PieControlPanel
            onChange={() => {}}
            value={{}}
            datasource={{}}
          />,
        ],
      ],
    },
  ],
};

export default config;