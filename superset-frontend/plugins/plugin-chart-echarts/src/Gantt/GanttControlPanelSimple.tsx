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
  D3_TIME_FORMAT_OPTIONS,
  D3_TIME_FORMAT_DOCS,
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';
import { ColumnSelectControl } from '../controls';

interface GanttControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Gantt charts.
 */
export const GanttControlPanel: FC<GanttControlPanelProps> = ({
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
      {/* Start Time */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Start Time')}
          description={t('Column representing the start time of tasks')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.start_time ? [formValues.start_time] : []}
            onChange={handleSingleColumnChange('start_time')}
            options={safeColumns.filter(col => col.is_dttm)}
            name="start_time"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select start time column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No temporal columns available. Please select a dataset first.')}
          </div>
        )}
      </div>

      {/* End Time */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('End Time')}
          description={t('Column representing the end time of tasks')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.end_time ? [formValues.end_time] : []}
            onChange={handleSingleColumnChange('end_time')}
            options={safeColumns.filter(col => col.is_dttm)}
            name="end_time"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select end time column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No temporal columns available.')}
          </div>
        )}
      </div>

      {/* Y-axis */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Y-axis')}
          description={t('Dimension to use on y-axis.')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.y_axis ? [formValues.y_axis] : []}
            onChange={handleSingleColumnChange('y_axis')}
            options={safeColumns}
            name="y_axis"
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

      {/* Series */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Series')}
          description={t('Columns to group by')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.series || []}
            onChange={handleChange('series')}
            options={safeColumns}
            name="series"
            label=""
            multi
            canDelete
            ghostButtonText={t('Add dimension')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available for series.')}
          </div>
        )}
      </div>

      {/* Subcategories - Conditional */}
      {formValues.series && formValues.series.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Subcategories')}
            description={t(
              'Divides each category into subcategories based on the values in ' +
                'the dimension. It can be used to exclude intersections.',
            )}
            value={formValues.subcategories ?? false}
            onChange={handleChange('subcategories')}
            renderTrigger
            hovered
          />
        </div>
      )}

      {/* Tooltip Metrics */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Tooltip Metrics')}
          description={t('Metrics to display in tooltip')}
          hovered
        />
        {safeDataSource && safeDataSource.columns ? (
          <DndMetricSelect
            value={formValues.tooltip_metrics || []}
            onChange={handleChange('tooltip_metrics')}
            datasource={safeDataSource}
            name="tooltip_metrics"
            label=""
            multi
            savedMetrics={safeMetrics}
          />
        ) : (
          <div style={{ padding: '10px' }}>{t('No metrics available.')}</div>
        )}
      </div>

      {/* Tooltip Columns */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Tooltip Columns')}
          description={t('Additional columns to display in tooltip')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.tooltip_columns || []}
            onChange={handleChange('tooltip_columns')}
            options={safeColumns}
            name="tooltip_columns"
            label=""
            multi
            canDelete
            ghostButtonText={t('Add column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>{t('No columns available.')}</div>
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
            selectedMetrics={formValues.tooltip_metrics || []}
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

        {/* Show Legend */}
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

        {/* Zoomable */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Zoomable')}
            description={t('Whether to enable zoom and pan in the chart')}
            value={formValues.zoomable ?? true}
            onChange={handleChange('zoomable')}
            renderTrigger
            hovered
          />
        </div>

        {/* Show extra controls */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Extra Controls')}
            description={t('Whether to show extra controls')}
            value={formValues.show_extra_controls ?? false}
            onChange={handleChange('show_extra_controls')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* X Axis Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('X Axis')}</h4>

        {/* X Axis Time Bounds */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Bounds')}
            description={t(
              'Bounds for the X-axis. Selected time merges with ' +
                'min/max date of the data. When left empty, bounds ' +
                'dynamically defined based on the min/max of the data.',
            )}
            renderTrigger
            hovered
          />
          <TextControl
            value={formValues.x_axis_time_bounds || ''}
            onChange={handleChange('x_axis_time_bounds')}
            placeholder="Time range"
            controlId="x_axis_time_bounds"
          />
        </div>

        {/* X Axis Time Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Time format')}
            description={D3_TIME_FORMAT_DOCS}
            value={formValues.x_axis_time_format || 'smart_date'}
            onChange={handleChange('x_axis_time_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Tooltip Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Tooltip')}</h4>

        {/* Tooltip Time Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Tooltip time format')}
            description={D3_TIME_FORMAT_DOCS}
            value={formValues.tooltip_time_format || 'smart_date'}
            onChange={handleChange('tooltip_time_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* Tooltip Values Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Tooltip values format')}
            description={t('Format for tooltip values')}
            value={formValues.tooltip_values_format || 'SMART_NUMBER'}
            onChange={handleChange('tooltip_values_format')}
            choices={[
              ['SMART_NUMBER', 'SMART_NUMBER'],
              ['.1f', '.1f'],
              ['.2f', '.2f'],
              ['.3f', '.3f'],
            ]}
            freeForm
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
          {t('Gantt Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Visualize project schedules and task timelines')}
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
(GanttControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[GanttControlPanel as any]],
    },
  ],
  controlOverrides: {
    start_time: {
      default: null,
      label: t('Start Time'),
    },
    end_time: {
      default: null,
      label: t('End Time'),
    },
    y_axis: {
      default: null,
      label: t('Y-axis'),
    },
    series: {
      default: [],
      label: t('Series'),
    },
    subcategories: {
      default: false,
      label: t('Subcategories'),
      renderTrigger: true,
    },
    tooltip_metrics: {
      default: [],
      label: t('Tooltip Metrics'),
    },
    tooltip_columns: {
      default: [],
      label: t('Tooltip Columns'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    row_limit: {
      default: 10000,
      label: t('Row limit'),
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
    zoomable: {
      default: true,
      label: t('Zoomable'),
      renderTrigger: true,
    },
    show_extra_controls: {
      default: false,
      label: t('Extra Controls'),
      renderTrigger: true,
    },
    x_axis_time_bounds: {
      default: '',
      label: t('Bounds'),
      renderTrigger: true,
    },
    x_axis_time_format: {
      default: 'smart_date',
      label: t('Time format'),
      renderTrigger: true,
    },
    tooltip_time_format: {
      default: 'smart_date',
      label: t('Tooltip time format'),
      renderTrigger: true,
    },
    tooltip_values_format: {
      default: 'SMART_NUMBER',
      label: t('Tooltip values format'),
      renderTrigger: true,
    },
  },
};

export default config;
