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
  LinearColorSchemeControl,
  formatSelectOptionsForRange,
  D3_TIME_FORMAT_OPTIONS,
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SliderControl from '../../../../src/explore/components/controls/SliderControl';
import ColorPickerControl from '../../../../src/explore/components/controls/ColorPickerControl';
import CurrencyControl from '../../../../src/explore/components/controls/CurrencyControl';
import BoundsControl from '../../../../src/explore/components/controls/BoundsControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';

interface HeatmapControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Heatmap charts.
 */
export const HeatmapControlPanel: FC<HeatmapControlPanelProps> = ({
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

  // Helper for single column selection
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

  // Sort axis choices
  const sortAxisChoices = [
    ['alpha_asc', t('Axis ascending')],
    ['alpha_desc', t('Axis descending')],
    ['value_asc', t('Metric ascending')],
    ['value_desc', t('Metric descending')],
  ];

  // Data tab content
  const dataTabContent = (
    <div>
      {/* X-Axis */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('X-Axis')}
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
        <ControlHeader
          label={t('Time Grain')}
          description={t('Time granularity for temporal grouping')}
          hovered
        />
        <SelectControl
          value={formValues.time_grain_sqla || null}
          onChange={handleChange('time_grain_sqla')}
          choices={[
            ['PT1S', t('Second')],
            ['PT1M', t('Minute')],
            ['PT5M', t('5 minute')],
            ['PT10M', t('10 minute')],
            ['PT15M', t('15 minute')],
            ['PT30M', t('30 minute')],
            ['PT1H', t('Hour')],
            ['P1D', t('Day')],
            ['P1W', t('Week')],
            ['P1M', t('Month')],
            ['P3M', t('Quarter')],
            ['P1Y', t('Year')],
          ]}
          clearable
          renderTrigger
          hovered
        />
      </div>

      {/* Y-Axis */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Y-Axis')}
          description={t('Dimension to use on y-axis.')}
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
            ghostButtonText={t('Select Y-axis column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available for Y-axis.')}
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
          placeholder="1000"
          controlId="row_limit"
        />
      </div>

      {/* Sort Axes */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <SelectControl
            label={t('Sort X Axis')}
            value={formValues.sort_x_axis || null}
            onChange={handleChange('sort_x_axis')}
            choices={sortAxisChoices}
            clearable
            renderTrigger={false}
            hovered
          />
        </div>
        <div style={{ flex: 1 }}>
          <SelectControl
            label={t('Sort Y Axis')}
            value={formValues.sort_y_axis || null}
            onChange={handleChange('sort_y_axis')}
            choices={sortAxisChoices}
            clearable
            renderTrigger={false}
            hovered
          />
        </div>
      </div>

      {/* Normalize Across */}
      <div style={{ marginBottom: 16 }}>
        <SelectControl
          label={t('Normalize Across')}
          description={
            <div>
              <div>
                {t(
                  'Color will be shaded based the normalized (0% to 100%) value of a given cell against the other cells in the selected range: ',
                )}
              </div>
              <ul>
                <li>{t('x: values are normalized within each column')}</li>
                <li>{t('y: values are normalized within each row')}</li>
                <li>
                  {t('heatmap: values are normalized across the entire heatmap')}
                </li>
              </ul>
            </div>
          }
          value={formValues.normalize_across || 'heatmap'}
          onChange={handleChange('normalize_across')}
          choices={[
            ['heatmap', t('heatmap')],
            ['x', t('x')],
            ['y', t('y')],
          ]}
          clearable={false}
          renderTrigger={false}
          hovered
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

        {/* Legend Type */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Legend Type')}
            value={formValues.legend_type || 'continuous'}
            onChange={handleChange('legend_type')}
            choices={[
              ['continuous', t('Continuous')],
              ['piecewise', t('Piecewise')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Linear Color Scheme */}
        <div style={{ marginBottom: 16 }}>
          {(() => {
            const linearColorSchemeControl = LinearColorSchemeControl();
            const { hidden, ...cleanConfig } = linearColorSchemeControl.config || {};
            return (
              <Control
                {...cleanConfig}
                name="linear_color_scheme"
                value={formValues.linear_color_scheme}
                actions={{
                  ...actions,
                  setControlValue: (field: string, val: any) => {
                    handleChange('linear_color_scheme')(val);
                  },
                }}
                renderTrigger
              />
            );
          })()}
        </div>

        {/* Border Color and Width */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('Border color')}
              description={t('The color of the elements border')}
              hovered
            />
            <ColorPickerControl
              value={formValues.border_color || { r: 0, g: 0, b: 0, a: 1 }}
              onChange={handleChange('border_color')}
              renderTrigger
            />
          </div>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('Border width')}
              description={t('The width of the elements border')}
              renderTrigger
              hovered
            />
            <SliderControl
              value={formValues.border_width || 0}
              onChange={handleChange('border_width')}
              {...{ min: 0, max: 2, step: 0.1 }}
            />
          </div>
        </div>

        {/* Scale Intervals */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <SelectControl
              label={t('XScale Interval')}
              description={t('Number of steps to take between ticks when displaying the X scale')}
              value={formValues.xscale_interval ?? -1}
              onChange={handleChange('xscale_interval')}
              choices={[[-1, t('Auto')]].concat(formatSelectOptionsForRange(1, 50))}
              clearable={false}
              renderTrigger
              hovered
            />
          </div>
          <div style={{ flex: 1 }}>
            <SelectControl
              label={t('YScale Interval')}
              description={t('Number of steps to take between ticks when displaying the Y scale')}
              value={formValues.yscale_interval ?? -1}
              onChange={handleChange('yscale_interval')}
              choices={[[-1, t('Auto')]].concat(formatSelectOptionsForRange(1, 50))}
              clearable={false}
              renderTrigger
              hovered
            />
          </div>
        </div>

        {/* Margins */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <SelectControl
              label={t('Left Margin')}
              description={t('Left margin, in pixels, allowing for more room for axis labels')}
              value={formValues.left_margin || 'auto'}
              onChange={handleChange('left_margin')}
              choices={[
                ['auto', t('Auto')],
                [50, '50'],
                [75, '75'],
                [100, '100'],
                [125, '125'],
                [150, '150'],
                [200, '200'],
              ]}
              freeForm
              clearable={false}
              renderTrigger
              hovered
            />
          </div>
          <div style={{ flex: 1 }}>
            <SelectControl
              label={t('Bottom Margin')}
              description={t('Bottom margin, in pixels, allowing for more room for axis labels')}
              value={formValues.bottom_margin || 'auto'}
              onChange={handleChange('bottom_margin')}
              choices={[
                ['auto', t('Auto')],
                [50, '50'],
                [75, '75'],
                [100, '100'],
                [125, '125'],
                [150, '150'],
                [200, '200'],
              ]}
              freeForm
              clearable={false}
              renderTrigger
              hovered
            />
          </div>
        </div>

        {/* Value bounds */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Value bounds')}
            description={t('Hard value bounds applied for color coding.')}
            renderTrigger
            hovered
          />
          <BoundsControl
            value={formValues.value_bounds || [null, null]}
            onChange={handleChange('value_bounds')}
          />
        </div>

        {/* Format Controls */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Value Format')}
            value={formValues.y_axis_format || null}
            onChange={handleChange('y_axis_format')}
            choices={[
              ['.1f', '.1f (12345.432 => 12345.4)'],
              ['.2f', '.2f (12345.432 => 12345.43)'],
              ['.3f', '.3f (12345.432 => 12345.432)'],
              ['.1%', '.1% (0.432 => 43.2%)'],
              ['.2%', '.2% (0.432 => 43.20%)'],
              ['.3%', '.3% (0.432 => 43.200%)'],
              [',.1f', ',.1f (12345.432 => 12,345.4)'],
              [',.2f', ',.2f (12345.432 => 12,345.43)'],
              [',.3f', ',.3f (12345.432 => 12,345.432)'],
              ['.1s', '.1s (12345.432 => 10k)'],
              ['.2s', '.2s (12345.432 => 12k)'],
              ['.3s', '.3s (12345.432 => 12.3k)'],
            ]}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* Date Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('X-axis time format')}
            value={formValues.x_axis_time_format || null}
            onChange={handleChange('x_axis_time_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
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

        {/* Display Options */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Legend')}
              description={t('Whether to display the legend (toggles)')}
              value={formValues.show_legend ?? true}
              onChange={handleChange('show_legend')}
              renderTrigger
              hovered
            />
          </div>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Show percentage')}
              description={t('Whether to include the percentage in the tooltip')}
              value={formValues.show_percentage ?? true}
              onChange={handleChange('show_percentage')}
              renderTrigger
              hovered
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Show Values')}
              description={t('Whether to display the numerical values within the cells')}
              value={formValues.show_values ?? false}
              onChange={handleChange('show_values')}
              renderTrigger
              hovered
            />
          </div>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Normalized')}
              description={t('Whether to apply a normal distribution based on rank on the color scale')}
              value={formValues.normalized ?? false}
              onChange={handleChange('normalized')}
              renderTrigger
              hovered
            />
          </div>
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
          {t('Heatmap')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Visualize correlations and patterns across two dimensions with color intensity')}
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
(HeatmapControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[HeatmapControlPanel as any]],
    },
  ],
  controlOverrides: {
    x_axis: {
      default: null,
      label: t('X-Axis'),
    },
    time_grain_sqla: {
      default: null,
      label: t('Time Grain'),
    },
    groupby: {
      default: null,
      label: t('Y-Axis'),
      multi: false,
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
      default: 1000,
      label: t('Row limit'),
    },
    sort_x_axis: {
      default: null,
      label: t('Sort X Axis'),
    },
    sort_y_axis: {
      default: null,
      label: t('Sort Y Axis'),
    },
    normalize_across: {
      default: 'heatmap',
      label: t('Normalize Across'),
    },
    legend_type: {
      default: 'continuous',
      label: t('Legend Type'),
      renderTrigger: true,
    },
    linear_color_scheme: {
      default: 'blue_white_yellow',
      label: t('Linear Color Scheme'),
      renderTrigger: true,
    },
    border_color: {
      default: { r: 0, g: 0, b: 0, a: 1 },
      label: t('Border color'),
      renderTrigger: true,
    },
    border_width: {
      default: 0,
      label: t('Border width'),
      renderTrigger: true,
    },
    xscale_interval: {
      default: -1,
      label: t('XScale Interval'),
      renderTrigger: true,
    },
    yscale_interval: {
      default: -1,
      label: t('YScale Interval'),
      renderTrigger: true,
    },
    left_margin: {
      default: 'auto',
      label: t('Left Margin'),
      renderTrigger: true,
    },
    bottom_margin: {
      default: 'auto',
      label: t('Bottom Margin'),
      renderTrigger: true,
    },
    value_bounds: {
      default: [null, null],
      label: t('Value bounds'),
      renderTrigger: true,
    },
    y_axis_format: {
      default: null,
      label: t('Value Format'),
      renderTrigger: true,
    },
    x_axis_time_format: {
      default: null,
      label: t('X-axis time format'),
      renderTrigger: true,
    },
    currency_format: {
      default: null,
      label: t('Currency format'),
      renderTrigger: true,
    },
    show_legend: {
      default: true,
      label: t('Legend'),
      renderTrigger: true,
    },
    show_percentage: {
      default: true,
      label: t('Show percentage'),
      renderTrigger: true,
    },
    show_values: {
      default: false,
      label: t('Show Values'),
      renderTrigger: true,
    },
    normalized: {
      default: false,
      label: t('Normalized'),
      renderTrigger: true,
    },
  },
};

export default config;
