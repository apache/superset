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
  D3_TIME_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
  formatSelectOptions,
  sections,
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SliderControl from '../../../../src/explore/components/controls/SliderControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';
import { defaultXAxis } from '../defaults';

interface BubbleControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Bubble charts.
 */
export const BubbleControlPanel: FC<BubbleControlPanelProps> = ({
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

  // Helper for single column selection (series, entity)
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
      {/* Series */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Series')}
          description={t('Columns to group by')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.series ? [formValues.series] : []}
            onChange={handleSingleColumnChange('series')}
            options={safeColumns}
            name="series"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Add series')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available. Please select a dataset first.')}
          </div>
        )}
      </div>

      {/* Entity */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Entity')}
          description={t('Entity ID column')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.entity ? [formValues.entity] : []}
            onChange={handleSingleColumnChange('entity')}
            options={safeColumns}
            name="entity"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Add entity')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available.')}
          </div>
        )}
      </div>

      {/* X Axis */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('X Axis')}
          description={t('Metric for X axis')}
          hovered
        />
        {safeDataSource && safeDataSource.columns ? (
          <DndMetricSelect
            value={formValues.x}
            onChange={handleChange('x')}
            datasource={safeDataSource}
            name="x"
            label=""
            multi={false}
            savedMetrics={safeMetrics}
          />
        ) : (
          <div style={{ padding: '10px' }}>{t('No metrics available.')}</div>
        )}
      </div>

      {/* Y Axis */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Y Axis')}
          description={t('Metric for Y axis')}
          hovered
        />
        {safeDataSource && safeDataSource.columns ? (
          <DndMetricSelect
            value={formValues.y}
            onChange={handleChange('y')}
            datasource={safeDataSource}
            name="y"
            label=""
            multi={false}
            savedMetrics={safeMetrics}
          />
        ) : (
          <div style={{ padding: '10px' }}>{t('No metrics available.')}</div>
        )}
      </div>

      {/* Size */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Bubble Size')}
          description={t('Metric for bubble size')}
          hovered
        />
        {safeDataSource && safeDataSource.columns ? (
          <DndMetricSelect
            value={formValues.size}
            onChange={handleChange('size')}
            datasource={safeDataSource}
            name="size"
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
            selectedMetrics={[formValues.x, formValues.y, formValues.size].filter(Boolean)}
            type="DndFilterSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available for filtering.')}
          </div>
        )}
      </div>

      {/* Row limit and Order by */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <ControlHeader
            label={t('Row limit')}
            description={t('Limit the number of rows that are returned')}
            hovered
          />
          <TextControl
            value={formValues.row_limit}
            onChange={handleChange('row_limit')}
            isInt
            placeholder="100"
            controlId="row_limit"
          />
        </div>
        <div style={{ flex: 1 }}>
          <CheckboxControl
            label={t('Order descending')}
            description={t('Sort results by order by descending')}
            value={formValues.order_desc ?? true}
            onChange={handleChange('order_desc')}
            hovered
          />
        </div>
      </div>
    </div>
  );

  // Customize tab content
  const customizeTabContent = (
    <div>
      {/* Chart Options Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Chart Options')}</h4>

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

        {/* Show Legend checkbox */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Legend')}
            description={t('Whether to display a legend for the chart')}
            value={formValues.show_legend ?? true}
            onChange={handleChange('show_legend')}
            renderTrigger
            hovered
          />
        </div>

        {/* Max Bubble Size */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Max Bubble Size')}
            description={t('Maximum size of bubbles')}
            value={formValues.max_bubble_size || '25'}
            onChange={handleChange('max_bubble_size')}
            choices={formatSelectOptions([
              '5',
              '10',
              '15',
              '25',
              '50',
              '75',
              '100',
            ])}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* Bubble Opacity */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Bubble Opacity')}
            description={t('Opacity of bubbles, 0 means completely transparent, 1 means opaque')}
            renderTrigger
            hovered
          />
          <SliderControl
            value={formValues.opacity || 0.6}
            onChange={handleChange('opacity')}
            {...{ min: 0, max: 1, step: 0.1 }}
          />
        </div>

        {/* Tooltip Size Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Bubble size number format')}
            description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
            value={formValues.tooltipSizeFormat || 'SMART_NUMBER'}
            onChange={handleChange('tooltipSizeFormat')}
            choices={D3_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* X Axis Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('X Axis')}</h4>

        {/* X Axis Title */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('X Axis Title')}
            description={t('Title for the X axis')}
            hovered
          />
          <TextControl
            value={formValues.x_axis_label || ''}
            onChange={handleChange('x_axis_label')}
            placeholder={t('X Axis Title')}
            controlId="x_axis_label"
          />
        </div>

        {/* X Axis Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('X Axis Format')}
            description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
            value={formValues.xAxisFormat || 'SMART_NUMBER'}
            onChange={handleChange('xAxisFormat')}
            choices={D3_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* Logarithmic X-axis */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Logarithmic x-axis')}
            description={t('Use logarithmic scale for X axis')}
            value={formValues.logXAxis ?? false}
            onChange={handleChange('logXAxis')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Y Axis Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Y Axis')}</h4>

        {/* Y Axis Title */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Y Axis Title')}
            description={t('Title for the Y axis')}
            hovered
          />
          <TextControl
            value={formValues.y_axis_label || ''}
            onChange={handleChange('y_axis_label')}
            placeholder={t('Y Axis Title')}
            controlId="y_axis_label"
          />
        </div>

        {/* Y Axis Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Y Axis Format')}
            description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
            value={formValues.yAxisFormat || 'SMART_NUMBER'}
            onChange={handleChange('yAxisFormat')}
            choices={D3_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* Logarithmic Y-axis */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Logarithmic y-axis')}
            description={t('Use logarithmic scale for Y axis')}
            value={formValues.logYAxis ?? false}
            onChange={handleChange('logYAxis')}
            renderTrigger
            hovered
          />
        </div>

        {/* Truncate Y Axis */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Truncate Y Axis')}
            description={t('Truncate Y Axis. Can be overridden by specifying a min or max bound.')}
            value={formValues.truncateYAxis ?? false}
            onChange={handleChange('truncateYAxis')}
            renderTrigger
            hovered
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
          {t('Bubble Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Visualizes a metric across three dimensions of data in a single chart (X axis, Y axis, and bubble size). Bubbles from the same group can be showcased using bubble color.')}
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
(BubbleControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[BubbleControlPanel as any]],
    },
  ],
  controlOverrides: {
    series: {
      default: null,
      label: t('Series'),
    },
    entity: {
      default: null,
      label: t('Entity'),
    },
    x: {
      default: null,
      label: t('X Axis'),
    },
    y: {
      default: null,
      label: t('Y Axis'),
    },
    size: {
      default: null,
      label: t('Bubble Size'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    row_limit: {
      default: 100,
      label: t('Row limit'),
    },
    order_desc: {
      default: true,
      label: t('Order descending'),
    },
    color_scheme: {
      default: 'supersetColors',
      label: t('Color scheme'),
      renderTrigger: true,
    },
    show_legend: {
      default: true,
      label: t('Show legend'),
      renderTrigger: true,
    },
    max_bubble_size: {
      default: '25',
      label: t('Max Bubble Size'),
      renderTrigger: true,
    },
    opacity: {
      default: 0.6,
      label: t('Bubble Opacity'),
      renderTrigger: true,
    },
    tooltipSizeFormat: {
      default: 'SMART_NUMBER',
      label: t('Bubble size number format'),
      renderTrigger: true,
    },
    x_axis_label: {
      default: '',
      label: t('X Axis Title'),
      renderTrigger: true,
    },
    y_axis_label: {
      default: '',
      label: t('Y Axis Title'),
      renderTrigger: true,
    },
    xAxisFormat: {
      default: 'SMART_NUMBER',
      label: t('X Axis Format'),
      renderTrigger: true,
    },
    yAxisFormat: {
      default: 'SMART_NUMBER',
      label: t('Y Axis Format'),
      renderTrigger: true,
    },
    logXAxis: {
      default: false,
      label: t('Logarithmic x-axis'),
      renderTrigger: true,
    },
    logYAxis: {
      default: false,
      label: t('Logarithmic y-axis'),
      renderTrigger: true,
    },
    truncateYAxis: {
      default: false,
      label: t('Truncate Y Axis'),
      renderTrigger: true,
    },
  },
};

export default config;
