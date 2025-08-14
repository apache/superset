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
import { ensureIsInt, t, validateNonEmpty } from '@superset-ui/core';
import { Row, Col, Collapse } from '@superset-ui/core/components';
import {
  ControlPanelConfig,
  D3_FORMAT_DOCS,
  D3_FORMAT_OPTIONS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  D3_TIME_FORMAT_OPTIONS,
  getStandardizedControls,
  sharedControls,
  // Import the actual React components
  CheckboxControl,
  NumberControl,
  SelectControl,
  SliderControl,
  TextControl,
  // Import React control wrappers
  GroupBy,
  Metrics,
  AdhocFilters,
  RowLimit,
  ColorScheme,
  CurrencyFormat,
} from '@superset-ui/chart-controls';
import { DEFAULT_FORM_DATA } from './types';

const {
  donut,
  innerRadius,
  labelsOutside,
  labelType,
  labelLine,
  outerRadius,
  numberFormat,
  showLabels,
  roseType,
} = DEFAULT_FORM_DATA;

/**
 * Modern React-based control panel configuration
 */
interface ModernPieControlPanelProps {
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  datasource?: any;
  formData?: any;
  validationErrors?: Record<string, string[]>;
}

/**
 * Query Section Component
 */
const QuerySection: FC<ModernPieControlPanelProps> = ({ values, onChange }) => (
  <>
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <GroupBy value={values.groupby} onChange={onChange} />
      </Col>
    </Row>
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Metrics value={values.metrics} onChange={onChange} />
      </Col>
    </Row>
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <AdhocFilters value={values.adhoc_filters} onChange={onChange} />
      </Col>
    </Row>
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <RowLimit value={values.row_limit} onChange={onChange} />
      </Col>
      <Col span={12}>
        <CheckboxControl
          name="sort_by_metric"
          label={t('Sort by Metric')}
          value={values.sort_by_metric ?? true}
          onChange={onChange}
          description={t('Sort series by metric values')}
        />
      </Col>
    </Row>
  </>
);

/**
 * Chart Options Section Component
 */
const ChartOptionsSection: FC<ModernPieControlPanelProps> = ({
  values,
  onChange,
}) => (
  <>
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <ColorScheme value={values.color_scheme} onChange={onChange} />
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col span={12}>
        <TextControl
          name="show_labels_threshold"
          label={t('Percentage threshold')}
          value={values.show_labels_threshold ?? 5}
          onChange={onChange}
          description={t(
            'Minimum threshold in percentage points for showing labels.',
          )}
          isFloat
        />
      </Col>
      <Col span={12}>
        <NumberControl
          name="threshold_for_other"
          label={t('Threshold for Other')}
          value={values.threshold_for_other ?? 0}
          onChange={onChange}
          min={0}
          max={100}
          step={0.5}
          description={t(
            'Values less than this percentage will be grouped into the Other category.',
          )}
        />
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col span={12}>
        <SelectControl
          name="roseType"
          label={t('Rose Type')}
          value={values.roseType ?? roseType}
          onChange={onChange}
          choices={[
            ['area', t('Area')],
            ['radius', t('Radius')],
            [null, t('None')],
          ]}
          description={t('Whether to show as Nightingale chart.')}
        />
      </Col>
    </Row>
  </>
);

/**
 * Legend Section Component
 */
const LegendSection: FC<ModernPieControlPanelProps> = ({
  values,
  onChange,
}) => (
  <>
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <CheckboxControl
          name="show_legend"
          label={t('Show legend')}
          value={values.show_legend}
          onChange={onChange}
          description={t('Whether to display a legend for the chart')}
        />
      </Col>
    </Row>

    {values.show_legend && (
      <>
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <SelectControl
              name="legendType"
              label={t('Legend type')}
              value={values.legendType}
              onChange={onChange}
              choices={[
                ['scroll', t('Scroll')],
                ['plain', t('Plain')],
              ]}
              description={t('Legend type')}
            />
          </Col>
          <Col span={12}>
            <SelectControl
              name="legendOrientation"
              label={t('Legend orientation')}
              value={values.legendOrientation}
              onChange={onChange}
              choices={[
                ['top', t('Top')],
                ['bottom', t('Bottom')],
                ['left', t('Left')],
                ['right', t('Right')],
              ]}
              description={t('Legend orientation')}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <NumberControl
              name="legendMargin"
              label={t('Legend margin')}
              value={values.legendMargin}
              onChange={onChange}
              min={0}
              max={100}
              description={t(
                'Additional margin to add between legend and chart',
              )}
            />
          </Col>
        </Row>
      </>
    )}
  </>
);

/**
 * Labels Section Component
 */
const LabelsSection: FC<ModernPieControlPanelProps> = ({
  values,
  onChange,
}) => (
  <>
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <SelectControl
          name="label_type"
          label={t('Label Type')}
          value={values.label_type ?? labelType}
          onChange={onChange}
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
          description={t('What should be shown on the label?')}
        />
      </Col>
    </Row>

    {values.label_type === 'template' && (
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <TextControl
            name="label_template"
            label={t('Label Template')}
            value={values.label_template}
            onChange={onChange}
            description={t(
              'Format data labels. ' +
                'Use variables: {name}, {value}, {percent}. ' +
                '\\n represents a new line. ' +
                'ECharts compatibility:\n' +
                '{a} (series), {b} (name), {c} (value), {d} (percentage)',
            )}
          />
        </Col>
      </Row>
    )}

    <Row gutter={[16, 16]}>
      <Col span={12}>
        <SelectControl
          name="number_format"
          label={t('Number format')}
          value={values.number_format ?? numberFormat}
          onChange={onChange}
          choices={D3_FORMAT_OPTIONS}
          freeForm
          tokenSeparators={['\n', '\t', ';']}
          description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
        />
      </Col>
      <Col span={12}>
        <CurrencyFormat value={values.currency_format} onChange={onChange} />
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col span={12}>
        <SelectControl
          name="date_format"
          label={t('Date format')}
          value={values.date_format ?? 'smart_date'}
          onChange={onChange}
          choices={D3_TIME_FORMAT_OPTIONS}
          freeForm
          description={D3_FORMAT_DOCS}
        />
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col span={8}>
        <CheckboxControl
          name="show_labels"
          label={t('Show Labels')}
          value={values.show_labels ?? showLabels}
          onChange={onChange}
          description={t('Whether to display the labels.')}
        />
      </Col>
      <Col span={8}>
        <CheckboxControl
          name="labels_outside"
          label={t('Put labels outside')}
          value={values.labels_outside ?? labelsOutside}
          onChange={onChange}
          description={t('Put the labels outside of the pie?')}
          disabled={!values.show_labels}
        />
      </Col>
      <Col span={8}>
        <CheckboxControl
          name="label_line"
          label={t('Label Line')}
          value={values.label_line ?? labelLine}
          onChange={onChange}
          description={t('Draw line from Pie to label when labels outside?')}
          disabled={!values.show_labels}
        />
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col span={12}>
        <CheckboxControl
          name="show_total"
          label={t('Show Total')}
          value={values.show_total ?? false}
          onChange={onChange}
          description={t('Whether to display the aggregate count')}
        />
      </Col>
    </Row>
  </>
);

/**
 * Pie Shape Section Component
 */
const PieShapeSection: FC<ModernPieControlPanelProps> = ({
  values,
  onChange,
}) => (
  <>
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <SliderControl
          name="outerRadius"
          label={t('Outer Radius')}
          value={values.outerRadius ?? outerRadius}
          onChange={onChange}
          min={10}
          max={100}
          step={1}
          description={t('Outer edge of Pie chart')}
        />
      </Col>
    </Row>

    <Row gutter={[16, 16]}>
      <Col span={12}>
        <CheckboxControl
          name="donut"
          label={t('Donut')}
          value={values.donut ?? donut}
          onChange={onChange}
          description={t('Do you want a donut or a pie?')}
        />
      </Col>
    </Row>

    {values.donut && (
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <SliderControl
            name="innerRadius"
            label={t('Inner Radius')}
            value={values.innerRadius ?? innerRadius}
            onChange={onChange}
            min={0}
            max={100}
            step={1}
            description={t('Inner radius of donut hole')}
          />
        </Col>
      </Row>
    )}
  </>
);

/**
 * Main Modern Pie Control Panel Component
 */
export const ModernPieControlPanel: FC<ModernPieControlPanelProps> = props => (
  <div className="modern-pie-control-panel">
    <Collapse defaultActiveKey={['query', 'chart-options']} ghost>
      <Collapse.Panel header={t('Query')} key="query">
        <QuerySection {...props} />
      </Collapse.Panel>

      <Collapse.Panel header={t('Chart Options')} key="chart-options">
        <ChartOptionsSection {...props} />

        <div style={{ marginTop: 24 }}>
          <h4>{t('Legend')}</h4>
          <LegendSection {...props} />
        </div>

        <div style={{ marginTop: 24 }}>
          <h4>{t('Labels')}</h4>
          <LabelsSection {...props} />
        </div>

        <div style={{ marginTop: 24 }}>
          <h4>{t('Pie shape')}</h4>
          <PieShapeSection {...props} />
        </div>
      </Collapse.Panel>
    </Collapse>
  </div>
);

/**
 * Create a backward-compatible control panel config
 * This allows the modern panel to work with the existing system
 */
export const createBackwardCompatibleConfig = (): ControlPanelConfig => ({
  controlPanelSections: [
    {
      label: t('Modern Control Panel'),
      expanded: true,
      controlSetRows: [
        [
          // Wrap the entire modern panel as a single React element
          <ModernPieControlPanel values={{}} onChange={() => {}} />,
        ],
      ],
    },
  ],
  controlOverrides: {
    series: {
      validators: [validateNonEmpty],
      clearable: false,
    },
    row_limit: {
      default: 100,
    },
  },
  formDataOverrides: formData => ({
    ...formData,
    metric: getStandardizedControls().shiftMetric(),
    groupby: getStandardizedControls().popAllColumns(),
    row_limit:
      ensureIsInt(formData.row_limit, 100) >= 100 ? 100 : formData.row_limit,
  }),
});

export default createBackwardCompatibleConfig();
