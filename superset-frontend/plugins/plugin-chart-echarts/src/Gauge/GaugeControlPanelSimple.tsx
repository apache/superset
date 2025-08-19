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
  ColorSchemeControl,
  D3_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SliderControl from '../../../../src/explore/components/controls/SliderControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import CurrencyControl from '../../../../src/explore/components/controls/CurrencyControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';
import { DEFAULT_FORM_DATA } from './types';

interface GaugeControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Gauge charts.
 */
export const GaugeControlPanel: FC<GaugeControlPanelProps> = ({
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

  // Get form values
  const formValues = form_data || value || {};

  // Data tab content
  const dataTabContent = (
    <div>
      {/* Group by */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Columns to group by')}
          description={t('Columns to group by')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.groupby || []}
            onChange={handleChange('groupby')}
            options={safeColumns}
            name="groupby"
            label=""
            multi
            canDelete
            ghostButtonText={t('Add dimension')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available. Please select a dataset first.')}
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

      {/* Row limit and Sort by metric */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <ControlHeader
            label={t('Row limit')}
            description={t('Limit the number of rows that are returned')}
            hovered
          />
          <SelectControl
            value={formValues.row_limit || DEFAULT_FORM_DATA.rowLimit}
            onChange={handleChange('row_limit')}
            choices={[...Array(10).keys()].map(n => [n + 1, n + 1])}
            clearable={false}
            hovered
          />
        </div>
        <div style={{ flex: 1 }}>
          <ControlHeader
            label={t('Sort by metric')}
            description={t('Sort by metric in descending order')}
            hovered
          />
          <CheckboxControl
            label=""
            description=""
            value={formValues.sort_by_metric ?? true}
            onChange={handleChange('sort_by_metric')}
            hovered
          />
        </div>
      </div>
    </div>
  );

  // Customize tab content
  const customizeTabContent = (
    <div>
      {/* General Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('General')}</h4>

        {/* Min and Max Values */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('Min')}
              description={t('Minimum value on the gauge axis')}
              hovered
            />
            <TextControl
              value={formValues.min_val ?? DEFAULT_FORM_DATA.minVal}
              onChange={handleChange('min_val')}
              isInt
              placeholder="0"
              controlId="min_val"
            />
          </div>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('Max')}
              description={t('Maximum value on the gauge axis')}
              hovered
            />
            <TextControl
              value={formValues.max_val ?? DEFAULT_FORM_DATA.maxVal}
              onChange={handleChange('max_val')}
              isInt
              placeholder="100"
              controlId="max_val"
            />
          </div>
        </div>

        {/* Start and End Angles */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('Start angle')}
              description={t('Angle at which to start progress axis')}
              hovered
            />
            <TextControl
              value={formValues.start_angle ?? DEFAULT_FORM_DATA.startAngle}
              onChange={handleChange('start_angle')}
              placeholder="225"
              controlId="start_angle"
            />
          </div>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('End angle')}
              description={t('Angle at which to end progress axis')}
              hovered
            />
            <TextControl
              value={formValues.end_angle ?? DEFAULT_FORM_DATA.endAngle}
              onChange={handleChange('end_angle')}
              placeholder="-45"
              controlId="end_angle"
            />
          </div>
        </div>

        {/* Color Scheme */}
        <div style={{ marginBottom: 16 }}>
          {(() => {
            const colorSchemeControl = ColorSchemeControl();
            const { hidden, ...cleanConfig } = colorSchemeControl.config || {};
            return (
              <Control
                {...cleanConfig}
                name="color_scheme"
                value={formValues.color_scheme}
                actions={{
                  ...actions,
                  setControlValue: (field: string, val: any) => {
                    handleChange('color_scheme')(val);
                  },
                }}
                renderTrigger
              />
            );
          })()}
        </div>

        {/* Font Size */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Font size')}
            description={t('Font size for axis labels, detail value and other text elements')}
            renderTrigger
            hovered
          />
          <SliderControl
            value={formValues.font_size ?? DEFAULT_FORM_DATA.fontSize}
            onChange={handleChange('font_size')}
            {...{ min: 10, max: 20 }}
          />
        </div>

        {/* Number Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Number format')}
            description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
            value={formValues.number_format || DEFAULT_FORM_DATA.numberFormat}
            onChange={handleChange('number_format')}
            choices={D3_FORMAT_OPTIONS}
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

        {/* Value Format */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Value format')}
            description={t('Additional text to add before or after the value, e.g. unit')}
            hovered
          />
          <TextControl
            value={formValues.value_formatter ?? DEFAULT_FORM_DATA.valueFormatter}
            onChange={handleChange('value_formatter')}
            placeholder="{value}"
            controlId="value_formatter"
          />
        </div>

        {/* Show Pointer and Animation */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Show pointer')}
              description={t('Whether to show the pointer')}
              value={formValues.show_pointer ?? DEFAULT_FORM_DATA.showPointer}
              onChange={handleChange('show_pointer')}
              renderTrigger
              hovered
            />
          </div>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Animation')}
              description={t('Whether to animate the progress and the value or just display them')}
              value={formValues.animation ?? DEFAULT_FORM_DATA.animation}
              onChange={handleChange('animation')}
              renderTrigger
              hovered
            />
          </div>
        </div>
      </div>

      {/* Axis Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Axis')}</h4>

        {/* Axis Options */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Show axis line ticks')}
              description={t('Whether to show minor ticks on the axis')}
              value={formValues.show_axis_tick ?? DEFAULT_FORM_DATA.showAxisTick}
              onChange={handleChange('show_axis_tick')}
              renderTrigger
              hovered
            />
          </div>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Show split lines')}
              description={t('Whether to show the split lines on the axis')}
              value={formValues.show_split_line ?? DEFAULT_FORM_DATA.showSplitLine}
              onChange={handleChange('show_split_line')}
              renderTrigger
              hovered
            />
          </div>
        </div>

        {/* Split Number */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Split number')}
            description={t('Number of split segments on the axis')}
            renderTrigger
            hovered
          />
          <SliderControl
            value={formValues.split_number ?? DEFAULT_FORM_DATA.splitNumber}
            onChange={handleChange('split_number')}
            {...{ min: 3, max: 30 }}
          />
        </div>
      </div>

      {/* Progress Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Progress')}</h4>

        {/* Progress Options */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Show progress')}
              description={t('Whether to show the progress of gauge chart')}
              value={formValues.show_progress ?? DEFAULT_FORM_DATA.showProgress}
              onChange={handleChange('show_progress')}
              renderTrigger
              hovered
            />
          </div>
          <div style={{ flex: 1 }}>
            <CheckboxControl
              label={t('Overlap')}
              description={t('Whether the progress bar overlaps when there are multiple groups of data')}
              value={formValues.overlap ?? DEFAULT_FORM_DATA.overlap}
              onChange={handleChange('overlap')}
              renderTrigger
              hovered
            />
          </div>
        </div>

        {/* Round Cap */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Round cap')}
            description={t('Style the ends of the progress bar with a round cap')}
            value={formValues.round_cap ?? DEFAULT_FORM_DATA.roundCap}
            onChange={handleChange('round_cap')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Intervals Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Intervals')}</h4>

        {/* Interval Bounds */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Interval bounds')}
            description={t('Comma-separated interval bounds, e.g. 2,4,5 for intervals 0-2, 2-4 and 4-5. Last number should match the value provided for MAX.')}
            hovered
          />
          <TextControl
            value={formValues.intervals ?? DEFAULT_FORM_DATA.intervals}
            onChange={handleChange('intervals')}
            placeholder="2,4,5"
            controlId="intervals"
          />
        </div>

        {/* Interval Colors */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Interval colors')}
            description={t('Comma-separated color picks for the intervals, e.g. 1,2,4. Integers denote colors from the chosen color scheme and are 1-indexed. Length must be matching that of interval bounds.')}
            hovered
          />
          <TextControl
            value={formValues.interval_color_indices ?? DEFAULT_FORM_DATA.intervalColorIndices}
            onChange={handleChange('interval_color_indices')}
            placeholder="1,2,4"
            controlId="interval_color_indices"
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
          {t('Gauge Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Visualize metrics as gauge charts showing progress towards a goal')}
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
(GaugeControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[GaugeControlPanel as any]],
    },
  ],
  controlOverrides: {
    groupby: {
      default: [],
      label: t('Group by'),
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
      default: DEFAULT_FORM_DATA.rowLimit,
      label: t('Row limit'),
    },
    sort_by_metric: {
      default: true,
      label: t('Sort by metric'),
    },
    min_val: {
      default: DEFAULT_FORM_DATA.minVal,
      label: t('Min'),
      renderTrigger: true,
    },
    max_val: {
      default: DEFAULT_FORM_DATA.maxVal,
      label: t('Max'),
      renderTrigger: true,
    },
    start_angle: {
      default: DEFAULT_FORM_DATA.startAngle,
      label: t('Start angle'),
      renderTrigger: true,
    },
    end_angle: {
      default: DEFAULT_FORM_DATA.endAngle,
      label: t('End angle'),
      renderTrigger: true,
    },
    color_scheme: {
      default: 'supersetColors',
      label: t('Color scheme'),
      renderTrigger: true,
    },
    font_size: {
      default: DEFAULT_FORM_DATA.fontSize,
      label: t('Font size'),
      renderTrigger: true,
    },
    number_format: {
      default: DEFAULT_FORM_DATA.numberFormat,
      label: t('Number format'),
      renderTrigger: true,
    },
    currency_format: {
      default: undefined,
      label: t('Currency format'),
      renderTrigger: true,
    },
    value_formatter: {
      default: DEFAULT_FORM_DATA.valueFormatter,
      label: t('Value format'),
      renderTrigger: true,
    },
    show_pointer: {
      default: DEFAULT_FORM_DATA.showPointer,
      label: t('Show pointer'),
      renderTrigger: true,
    },
    animation: {
      default: DEFAULT_FORM_DATA.animation,
      label: t('Animation'),
      renderTrigger: true,
    },
    show_axis_tick: {
      default: DEFAULT_FORM_DATA.showAxisTick,
      label: t('Show axis line ticks'),
      renderTrigger: true,
    },
    show_split_line: {
      default: DEFAULT_FORM_DATA.showSplitLine,
      label: t('Show split lines'),
      renderTrigger: true,
    },
    split_number: {
      default: DEFAULT_FORM_DATA.splitNumber,
      label: t('Split number'),
      renderTrigger: true,
    },
    show_progress: {
      default: DEFAULT_FORM_DATA.showProgress,
      label: t('Show progress'),
      renderTrigger: true,
    },
    overlap: {
      default: DEFAULT_FORM_DATA.overlap,
      label: t('Overlap'),
      renderTrigger: true,
    },
    round_cap: {
      default: DEFAULT_FORM_DATA.roundCap,
      label: t('Round cap'),
      renderTrigger: true,
    },
    intervals: {
      default: DEFAULT_FORM_DATA.intervals,
      label: t('Interval bounds'),
      renderTrigger: true,
    },
    interval_color_indices: {
      default: DEFAULT_FORM_DATA.intervalColorIndices,
      label: t('Interval colors'),
      renderTrigger: true,
    },
  },
};

export default config;
