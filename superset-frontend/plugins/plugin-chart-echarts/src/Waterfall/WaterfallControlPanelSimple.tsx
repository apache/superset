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
import { Tabs } from 'antd';
import {
  D3_TIME_FORMAT_OPTIONS,
  D3_TIME_FORMAT_DOCS,
  DEFAULT_TIME_FORMAT,
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import ColorPickerControl from '../../../../src/explore/components/controls/ColorPickerControl';
import CurrencyControl from '../../../../src/explore/components/controls/CurrencyControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';

interface WaterfallControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Waterfall charts.
 */
export const WaterfallControlPanel: FC<WaterfallControlPanelProps> = ({
  onChange,
  value,
  datasource,
  form_data,
  actions,
  controls,
}) => {
  // State for active tab - must be before any early returns
  const [activeTab, setActiveTab] = useState('data');

  // If no valid data yet, show loading state
  if (!datasource || !form_data) {
    return <div>Loading control panel...</div>;
  }

  // Ensure datasource has the expected structure with arrays
  const safeColumns = Array.isArray(datasource?.columns)
    ? datasource.columns
    : [];
  const safeMetrics = Array.isArray(datasource?.metrics)
    ? datasource.metrics
    : [];

  const safeDataSource = {
    ...datasource,
    columns: safeColumns,
    metrics: safeMetrics,
  };

  // Helper to handle control changes
  const handleChange = (field: string) => (val: any) => {
    if (actions?.setControlValue) {
      actions.setControlValue(field, val);
    } else if (onChange) {
      onChange(field, val);
    }
  };

  // Helper for single column selection (not array)
  const handleSingleColumnChange = (field: string) => (val: any) => {
    const singleValue = Array.isArray(val) ? val[0] : val;
    if (actions?.setControlValue) {
      actions.setControlValue(field, singleValue);
    } else if (onChange) {
      onChange(field, singleValue);
    }
  };

  // Get form values
  const formValues = form_data || value || {};

  // Data tab content
  const dataTabContent = (
    <div>
      {/* X Axis */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('X Axis')}
          description={t('Dimension to use on x-axis.')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.x_axis ? [formValues.x_axis] : []}
            onChange={handleSingleColumnChange('x_axis')}
            options={safeColumns}
            name="x_axis"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select X-axis column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available. Please select a dataset first.')}
          </div>
        )}
      </div>

      {/* Time Grain */}
      <div style={{ marginBottom: 16 }}>
        <SelectControl
          label={t('Time Grain')}
          description={t('Time grain')}
          value={formValues.time_grain_sqla || 'P1D'}
          onChange={handleChange('time_grain_sqla')}
          choices={[
            ['PT1S', 'second'],
            ['PT1M', 'minute'],
            ['PT1H', 'hour'],
            ['P1D', 'day'],
            ['P1W', 'week'],
            ['P1M', 'month'],
            ['P3M', 'quarter'],
            ['P1Y', 'year'],
          ]}
          clearable={false}
          renderTrigger
          hovered
        />
      </div>

      {/* Group by (Breakdowns) */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Breakdowns')}
          description={t(
            'Breaks down the series by the category specified in this control. ' +
              'This can help viewers understand how each category affects the overall value.',
          )}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.groupby ? [formValues.groupby] : []}
            onChange={handleSingleColumnChange('groupby')}
            options={safeColumns}
            name="groupby"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select breakdown column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available for breakdown.')}
          </div>
        )}
      </div>

      {/* Metric */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Metric')}
          description={t('Metric to display')}
          hovered
        />
        {safeDataSource && safeDataSource.columns ? (
          <DndMetricSelect
            value={formValues.metric}
            onChange={handleChange('metric')}
            datasource={safeDataSource}
            name="metric"
            label=""
            multi={false}
            savedMetrics={safeMetrics}
          />
        ) : (
          <div style={{ padding: '10px' }}>{t('No metrics available.')}</div>
        )}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Filters')}
          description={t('Filters to apply to the data')}
          hovered
        />
        {safeDataSource && safeColumns.length > 0 ? (
          <DndFilterSelect
            value={formValues.adhoc_filters || []}
            onChange={handleChange('adhoc_filters')}
            datasource={safeDataSource}
            columns={safeColumns}
            formData={formValues}
            name="adhoc_filters"
            savedMetrics={safeMetrics}
            selectedMetrics={formValues.metric ? [formValues.metric] : []}
            type="DndFilterSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available for filtering.')}
          </div>
        )}
      </div>

      {/* Row limit */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Row limit')}
          description={t('Limit the number of rows that are returned')}
          hovered
        />
        <TextControl
          value={formValues.row_limit}
          onChange={handleChange('row_limit')}
          isInt
          placeholder="10000"
          controlId="row_limit"
        />
      </div>
    </div>
  );

  // Customize tab content
  const customizeTabContent = (
    <div>
      {/* Chart Options Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Chart Options')}</h4>

        {/* Show Value */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Values')}
            description={t('Show the value on top of the bar')}
            value={formValues.show_value ?? false}
            onChange={handleChange('show_value')}
            renderTrigger
            hovered
          />
        </div>

        {/* Show Legend */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Legend')}
            description={t('Whether to display a legend for the chart')}
            value={formValues.show_legend ?? false}
            onChange={handleChange('show_legend')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Series Colors Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Series colors')}</h4>

        {/* Increase Color */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Increase')}
            description={t('Color for positive changes')}
            hovered
          />
          <ColorPickerControl
            value={formValues.increase_color || { r: 90, g: 193, b: 137, a: 1 }}
            onChange={handleChange('increase_color')}
            name="increase_color"
            renderTrigger
          />
        </div>

        {/* Decrease Color */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Decrease')}
            description={t('Color for negative changes')}
            hovered
          />
          <ColorPickerControl
            value={formValues.decrease_color || { r: 224, g: 67, b: 85, a: 1 }}
            onChange={handleChange('decrease_color')}
            name="decrease_color"
            renderTrigger
          />
        </div>

        {/* Total Color */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Total')}
            description={t('Color for total values')}
            hovered
          />
          <ColorPickerControl
            value={formValues.total_color || { r: 102, g: 102, b: 102, a: 1 }}
            onChange={handleChange('total_color')}
            name="total_color"
            renderTrigger
          />
        </div>
      </div>

      {/* X Axis Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('X Axis')}</h4>

        {/* X Axis Label */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('X Axis Label')}
            description={t('Label for the X-axis')}
            hovered
          />
          <TextControl
            value={formValues.x_axis_label || ''}
            onChange={handleChange('x_axis_label')}
            placeholder=""
            controlId="x_axis_label"
          />
        </div>

        {/* X Axis Time Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Time format')}
            description={`${D3_TIME_FORMAT_DOCS}.`}
            value={formValues.x_axis_time_format || DEFAULT_TIME_FORMAT}
            onChange={handleChange('x_axis_time_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* X Ticks Layout */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('X Tick Layout')}
            description={t('The way the ticks are laid out on the X-axis')}
            value={formValues.x_ticks_layout || 'auto'}
            onChange={handleChange('x_ticks_layout')}
            choices={[
              ['auto', 'auto'],
              ['flat', 'flat'],
              ['45°', '45°'],
              ['90°', '90°'],
              ['staggered', 'staggered'],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Y Axis Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Y Axis')}</h4>

        {/* Y Axis Label */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Y Axis Label')}
            description={t('Label for the Y-axis')}
            hovered
          />
          <TextControl
            value={formValues.y_axis_label || ''}
            onChange={handleChange('y_axis_label')}
            placeholder=""
            controlId="y_axis_label"
          />
        </div>

        {/* Y Axis Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Y Axis Format')}
            description={t('D3 format syntax: https://github.com/d3/d3-format')}
            value={formValues.y_axis_format || 'SMART_NUMBER'}
            onChange={handleChange('y_axis_format')}
            choices={[
              ['SMART_NUMBER', 'SMART_NUMBER'],
              ['.1f', '.1f'],
              ['.2f', '.2f'],
              ['.3f', '.3f'],
              ['.1%', '.1%'],
              ['.2%', '.2%'],
              [',d', ',d'],
              [',.2f', ',.2f'],
            ]}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* Currency Format */}
        <div style={{ marginBottom: 16 }}>
          <CurrencyControl
            value={formValues.currency_format}
            onChange={handleChange('currency_format')}
          />
        </div>
      </div>
    </div>
  );

  // Tab items
  const tabItems = [
    {
      key: 'data',
      label: t('Data'),
      children: dataTabContent,
    },
    {
      key: 'customize',
      label: t('Customize'),
      children: customizeTabContent,
    },
  ];

  return (
    <div style={{ padding: '16px' }}>
      {/* Chart/Viz Type Picker */}
      <div style={{ marginBottom: 16, padding: '12px', borderRadius: '4px' }}>
        <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
          {t('Waterfall Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t(
            'Visualize cumulative effect of sequentially introduced positive or negative values',
          )}
        </div>
      </div>

      {/* Tabs for Data and Customize */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </div>
  );
};

// Mark this component as a modern panel
(WaterfallControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[WaterfallControlPanel as any]],
    },
  ],
  controlOverrides: {
    x_axis: {
      default: null,
      label: t('X Axis'),
    },
    time_grain_sqla: {
      default: 'P1D',
      label: t('Time Grain'),
    },
    groupby: {
      default: null,
      label: t('Breakdowns'),
    },
    metric: {
      default: null,
      label: t('Metric'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    row_limit: {
      default: 10000,
      label: t('Row limit'),
    },
    show_value: {
      default: false,
      label: t('Show Values'),
      renderTrigger: true,
    },
    show_legend: {
      default: false,
      label: t('Show legend'),
      renderTrigger: true,
    },
    increase_color: {
      default: { r: 90, g: 193, b: 137, a: 1 },
      label: t('Increase'),
      renderTrigger: true,
    },
    decrease_color: {
      default: { r: 224, g: 67, b: 85, a: 1 },
      label: t('Decrease'),
      renderTrigger: true,
    },
    total_color: {
      default: { r: 102, g: 102, b: 102, a: 1 },
      label: t('Total'),
      renderTrigger: true,
    },
    x_axis_label: {
      default: '',
      label: t('X Axis Label'),
      renderTrigger: true,
    },
    x_axis_time_format: {
      default: DEFAULT_TIME_FORMAT,
      label: t('Time format'),
      renderTrigger: true,
    },
    x_ticks_layout: {
      default: 'auto',
      label: t('X Tick Layout'),
      renderTrigger: true,
    },
    y_axis_label: {
      default: '',
      label: t('Y Axis Label'),
      renderTrigger: true,
    },
    y_axis_format: {
      default: 'SMART_NUMBER',
      label: t('Y Axis Format'),
      renderTrigger: true,
    },
    currency_format: {
      default: undefined,
      label: t('Currency format'),
      renderTrigger: true,
    },
  },
};

export default config;
