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
  SORT_SERIES_CHOICES,
  DEFAULT_SORT_SERIES_DATA,
  CURRENCY_FORMAT_OPTIONS,
  CurrencyFormatControl,
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
import BoundsControl from '../../../../src/explore/components/controls/BoundsControl';
import { EchartsTimeseriesSeriesType } from '../Timeseries/types';

interface MixedTimeseriesControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Mixed Timeseries charts.
 * Supports dual Y-axes with independent formatting and chart types.
 */
export const MixedTimeseriesControlPanel: FC<MixedTimeseriesControlPanelProps> = ({
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

  // Series type choices
  const seriesTypeChoices = [
    [EchartsTimeseriesSeriesType.Line, t('Line')],
    [EchartsTimeseriesSeriesType.Scatter, t('Scatter')],
    [EchartsTimeseriesSeriesType.Smooth, t('Smooth Line')],
    [EchartsTimeseriesSeriesType.Bar, t('Bar')],
    [EchartsTimeseriesSeriesType.Start, t('Step - start')],
    [EchartsTimeseriesSeriesType.Middle, t('Step - middle')],
    [EchartsTimeseriesSeriesType.End, t('Step - end')],
  ];

  // Render query section for Query A or B
  const renderQuerySection = (label: string, suffix: string) => (
    <div style={{ marginBottom: 24 }}>
      <h4>{label}</h4>

      {/* Metrics */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Metrics')}
          description={t('Metrics to display')}
          hovered
        />
        {safeDataSource && safeDataSource.columns ? (
          <DndMetricSelect
            value={formValues[`metrics${suffix}`] || []}
            onChange={handleChange(`metrics${suffix}`)}
            datasource={safeDataSource}
            name={`metrics${suffix}`}
            label=""
            multi
            savedMetrics={safeMetrics}
          />
        ) : (
          <div style={{ padding: '10px' }}>{t('No metrics available.')}</div>
        )}
      </div>

      {/* Group by */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Group by')}
          description={t('Columns to group by')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues[`groupby${suffix}`] || []}
            onChange={handleChange(`groupby${suffix}`)}
            options={safeColumns}
            name={`groupby${suffix}`}
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

      {/* Filters */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Filters')}
          description={t('Filters to apply to the data')}
          hovered
        />
        {safeDataSource && safeColumns.length > 0 ? (
          <DndFilterSelect
            value={formValues[`adhoc_filters${suffix}`] || []}
            onChange={handleChange(`adhoc_filters${suffix}`)}
            datasource={safeDataSource}
            columns={safeColumns}
            formData={formValues}
            name={`adhoc_filters${suffix}`}
            savedMetrics={safeMetrics}
            selectedMetrics={formValues[`metrics${suffix}`] || []}
            type="DndFilterSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available for filtering.')}
          </div>
        )}
      </div>

      {/* Row limits and sort controls */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <ControlHeader
            label={t('Series limit')}
            description={t('Limits the number of time series that get displayed')}
            hovered
          />
          <TextControl
            value={formValues[`limit${suffix}`]}
            onChange={handleChange(`limit${suffix}`)}
            isInt
            placeholder="0"
            controlId={`limit${suffix}`}
          />
        </div>
        <div style={{ flex: 1 }}>
          <ControlHeader
            label={t('Sort by metric')}
            description={t('Metric to sort the results by')}
            hovered
          />
          {safeDataSource && safeDataSource.columns ? (
            <DndMetricSelect
              value={formValues[`timeseries_limit_metric${suffix}`]}
              onChange={handleChange(`timeseries_limit_metric${suffix}`)}
              datasource={safeDataSource}
              name={`timeseries_limit_metric${suffix}`}
              label=""
              multi={false}
              savedMetrics={safeMetrics}
            />
          ) : (
            <div style={{ padding: '10px' }}>{t('No metrics available.')}</div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <CheckboxControl
            label={t('Sort Descending')}
            description={t('Whether to sort descending or ascending')}
            value={formValues[`order_desc${suffix}`] ?? false}
            onChange={handleChange(`order_desc${suffix}`)}
            hovered
          />
        </div>
        <div style={{ flex: 1 }}>
          <ControlHeader
            label={t('Row limit')}
            description={t('Limit the number of rows that are returned')}
            hovered
          />
          <TextControl
            value={formValues[`row_limit${suffix}`]}
            onChange={handleChange(`row_limit${suffix}`)}
            isInt
            placeholder="10000"
            controlId={`row_limit${suffix}`}
          />
        </div>
      </div>

      {/* Truncate metric */}
      <div style={{ marginBottom: 16 }}>
        <CheckboxControl
          label={t('Truncate Metric')}
          description={t('Whether to truncate metric')}
          value={formValues[`truncate_metric${suffix}`] ?? true}
          onChange={handleChange(`truncate_metric${suffix}`)}
          hovered
        />
      </div>
    </div>
  );

  // Render customization section for Query A or B
  const renderCustomizeSection = (label: string, suffix: string) => (
    <div style={{ marginBottom: 24 }}>
      <h4>{label}</h4>

      {/* Series Type */}
      <div style={{ marginBottom: 16 }}>
        <SelectControl
          label={t('Series type')}
          description={t('Series chart type (line, bar etc)')}
          value={formValues[`seriesType${suffix}`] || EchartsTimeseriesSeriesType.Line}
          onChange={handleChange(`seriesType${suffix}`)}
          choices={seriesTypeChoices}
          clearable={false}
          renderTrigger
          hovered
        />
      </div>

      {/* Y-Axis Assignment */}
      <div style={{ marginBottom: 16 }}>
        <SelectControl
          label={t('Y Axis')}
          description={t('Primary or secondary y-axis')}
          value={formValues[`yAxisIndex${suffix}`] ?? 0}
          onChange={handleChange(`yAxisIndex${suffix}`)}
          choices={[
            [0, t('Primary')],
            [1, t('Secondary')],
          ]}
          clearable={false}
          renderTrigger
          hovered
        />
      </div>

      {/* Chart Style Options */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <CheckboxControl
            label={t('Stack series')}
            description={t('Stack series on top of each other')}
            value={formValues[`stack${suffix}`] ?? false}
            onChange={handleChange(`stack${suffix}`)}
            renderTrigger
            hovered
          />
        </div>
        <div style={{ flex: 1 }}>
          <CheckboxControl
            label={t('Area chart')}
            description={t('Draw area under curves. Only applicable for line types.')}
            value={formValues[`area${suffix}`] ?? false}
            onChange={handleChange(`area${suffix}`)}
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
            value={formValues[`show_value${suffix}`] ?? false}
            onChange={handleChange(`show_value${suffix}`)}
            renderTrigger
            hovered
          />
        </div>
        <div style={{ flex: 1 }}>
          <CheckboxControl
            label={t('Marker')}
            description={t('Draw a marker on data points. Only applicable for line types.')}
            value={formValues[`markerEnabled${suffix}`] ?? false}
            onChange={handleChange(`markerEnabled${suffix}`)}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Only Total checkbox - conditional on show_value and stack */}
      {formValues[`show_value${suffix}`] && formValues[`stack${suffix}`] && (
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Only Total')}
            description={t('Only show the total value on the stacked chart, and not show on the selected category')}
            value={formValues[`only_total${suffix}`] ?? true}
            onChange={handleChange(`only_total${suffix}`)}
            renderTrigger
            hovered
          />
        </div>
      )}

      {/* Sliders for opacity and marker size */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Opacity')}
          description={t('Opacity of area chart.')}
          renderTrigger
          hovered
        />
        <SliderControl
          value={formValues[`opacity${suffix}`] ?? 0.7}
          onChange={handleChange(`opacity${suffix}`)}
          {...{ min: 0, max: 1, step: 0.1 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Marker size')}
          description={t('Size of marker. Also applies to forecast observations.')}
          renderTrigger
          hovered
        />
        <SliderControl
          value={formValues[`markerSize${suffix}`] ?? 6}
          onChange={handleChange(`markerSize${suffix}`)}
          {...{ min: 0, max: 100, step: 1 }}
        />
      </div>

      {/* Series Order */}
      <div style={{ marginBottom: 16 }}>
        <h5>{t('Series Order')}</h5>
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Sort Series By')}
            description={t('Based on what should series be ordered on the chart and legend')}
            value={formValues[`sort_series_type${suffix}`] || DEFAULT_SORT_SERIES_DATA.sort_series_type}
            onChange={handleChange(`sort_series_type${suffix}`)}
            choices={SORT_SERIES_CHOICES}
            renderTrigger
            hovered
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Sort Series Ascending')}
            description={t('Sort series in ascending order')}
            value={formValues[`sort_series_ascending${suffix}`] ?? DEFAULT_SORT_SERIES_DATA.sort_series_ascending}
            onChange={handleChange(`sort_series_ascending${suffix}`)}
            renderTrigger
            hovered
          />
        </div>
      </div>
    </div>
  );

  // Data tab content
  const dataTabContent = (
    <div>
      {/* Shared query fields */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Shared query fields')}</h4>

        {/* X-Axis */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('X-Axis')}
            description={t('The column to be used as the x-axis')}
            hovered
          />
          {safeColumns.length > 0 ? (
            <DndColumnSelect
              value={formValues.x_axis ? [formValues.x_axis] : []}
              onChange={(val: any) => {
                const singleValue = Array.isArray(val) ? val[0] : val;
                handleChange('x_axis')(singleValue);
              }}
              options={safeColumns}
              name="x_axis"
              label=""
              multi={false}
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

        {/* Time Grain */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Time Grain')}
            description={t('The time granularity for the visualization')}
            value={formValues.time_grain_sqla}
            onChange={handleChange('time_grain_sqla')}
            choices={[
              [null, t('None')],
              ['PT1S', t('Second')],
              ['PT1M', t('Minute')],
              ['PT5M', t('5 Minutes')],
              ['PT10M', t('10 Minutes')],
              ['PT15M', t('15 Minutes')],
              ['PT30M', t('30 Minutes')],
              ['PT1H', t('Hour')],
              ['P1D', t('Day')],
              ['P1W', t('Week')],
              ['P1M', t('Month')],
              ['P3M', t('Quarter')],
              ['P1Y', t('Year')],
            ]}
            clearable
            hovered
          />
        </div>
      </div>

      {/* Query A and Query B */}
      {renderQuerySection(t('Query A'), '')}
      {renderQuerySection(t('Query B'), '_b')}
    </div>
  );

  // Customize tab content
  const customizeTabContent = (
    <div>
      {/* Chart Options */}
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

        {/* Zoomable */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Data Zoom')}
            description={t('Enable data zoom controls')}
            value={formValues.zoomable ?? true}
            onChange={handleChange('zoomable')}
            renderTrigger
            hovered
          />
        </div>

        {/* Minor Ticks */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Minor ticks')}
            description={t('Show minor ticks on axes')}
            value={formValues.minorTicks ?? false}
            onChange={handleChange('minorTicks')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Query A and B Customizations */}
      {renderCustomizeSection(t('Query A'), '')}
      {renderCustomizeSection(t('Query B'), 'B')}

      {/* X-Axis Controls */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('X Axis')}</h4>

        {/* X-Axis Time Format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Time format')}
            description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
            value={formValues.x_axis_time_format || 'smart_date'}
            onChange={handleChange('x_axis_time_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* X-Axis Label Rotation */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Rotate x axis label')}
            description={t('Input field supports custom rotation')}
            renderTrigger
            hovered
          />
          <TextControl
            value={formValues.xAxisLabelRotation ?? 0}
            onChange={handleChange('xAxisLabelRotation')}
            isInt
            placeholder="0"
            controlId="xAxisLabelRotation"
          />
        </div>
      </div>

      {/* Tooltip */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Tooltip')}</h4>

        {/* Show query identifiers */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show query identifiers')}
            description={t('Add Query A and Query B identifiers to tooltips to help differentiate series')}
            value={formValues.show_query_identifiers ?? false}
            onChange={handleChange('show_query_identifiers')}
            renderTrigger
            hovered
          />
        </div>

        {/* Rich tooltip */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Rich Tooltip')}
            description={t('The rich tooltip shows a table of all series values')}
            value={formValues.rich_tooltip ?? true}
            onChange={handleChange('rich_tooltip')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Y-Axis Controls */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Y Axis')}</h4>

        {/* Primary Y-Axis */}
        <div style={{ marginBottom: 16 }}>
          <h5>{t('Primary Y-Axis')}</h5>

          {/* Primary Y-axis format */}
          <div style={{ marginBottom: 16 }}>
            <SelectControl
              label={t('Primary y-axis format')}
              description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
              value={formValues.y_axis_format || 'SMART_NUMBER'}
              onChange={handleChange('y_axis_format')}
              choices={D3_FORMAT_OPTIONS}
              freeForm
              renderTrigger
              hovered
            />
          </div>

          {/* Currency format */}
          <div style={{ marginBottom: 16 }}>
            <CurrencyControl
              value={formValues.currency_format}
              onChange={handleChange('currency_format')}
            />
          </div>

          {/* Logarithmic y-axis */}
          <div style={{ marginBottom: 16 }}>
            <CheckboxControl
              label={t('Logarithmic y-axis')}
              description={t('Logarithmic scale on primary y-axis')}
              value={formValues.logAxis ?? false}
              onChange={handleChange('logAxis')}
              renderTrigger
              hovered
            />
          </div>

          {/* Primary y-axis bounds */}
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Primary y-axis Bounds')}
              description={t('Bounds for the primary Y-axis. When left empty, the bounds are dynamically defined based on the min/max of the data.')}
              hovered
            />
            <BoundsControl
              value={formValues.y_axis_bounds}
              onChange={handleChange('y_axis_bounds')}
              renderTrigger
            />
          </div>
        </div>

        {/* Secondary Y-Axis */}
        <div style={{ marginBottom: 16 }}>
          <h5>{t('Secondary Y-Axis')}</h5>

          {/* Secondary Y-axis format */}
          <div style={{ marginBottom: 16 }}>
            <SelectControl
              label={t('Secondary y-axis format')}
              description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
              value={formValues.y_axis_format_secondary}
              onChange={handleChange('y_axis_format_secondary')}
              choices={D3_FORMAT_OPTIONS}
              freeForm
              renderTrigger
              hovered
            />
          </div>

          {/* Secondary currency format */}
          <div style={{ marginBottom: 16 }}>
            <SelectControl
              label={t('Secondary currency format')}
              description={t('The currency symbol')}
              value={formValues.currency_format_secondary}
              onChange={handleChange('currency_format_secondary')}
              choices={CURRENCY_FORMAT_OPTIONS}
              freeForm
              renderTrigger
              hovered
            />
          </div>

          {/* Secondary Y-axis title */}
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Secondary y-axis title')}
              description={t('Logarithmic y-axis')}
              hovered
            />
            <TextControl
              value={formValues.yAxisTitleSecondary || ''}
              onChange={handleChange('yAxisTitleSecondary')}
              placeholder=""
              controlId="yAxisTitleSecondary"
            />
          </div>

          {/* Logarithmic secondary y-axis */}
          <div style={{ marginBottom: 16 }}>
            <CheckboxControl
              label={t('Logarithmic y-axis')}
              description={t('Logarithmic scale on secondary y-axis')}
              value={formValues.logAxisSecondary ?? false}
              onChange={handleChange('logAxisSecondary')}
              renderTrigger
              hovered
            />
          </div>

          {/* Secondary y-axis bounds */}
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Secondary y-axis Bounds')}
              description={t('Bounds for the secondary Y-axis. Only works when Independent Y-axis bounds are enabled.')}
              hovered
            />
            <BoundsControl
              value={formValues.y_axis_bounds_secondary}
              onChange={handleChange('y_axis_bounds_secondary')}
              renderTrigger
            />
          </div>
        </div>

        {/* Additional Y-Axis Controls */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Minor Split Line')}
            description={t('Draw split lines for minor y-axis ticks')}
            value={formValues.minorSplitLine ?? false}
            onChange={handleChange('minorSplitLine')}
            renderTrigger
            hovered
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Truncate Y Axis')}
            description={t('Truncate Y Axis. Can be overridden by specifying a min or max bound.')}
            value={formValues.truncateYAxis ?? true}
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
      {/* Chart Type Picker */}
      <div style={{ marginBottom: 16, padding: '12px', borderRadius: '4px' }}>
        <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
          {t('Mixed Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Visualize two different series using the same x-axis. Note that both series can be visualized with a different chart type (e.g. 1 using bars and 1 using a line).')}
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
(MixedTimeseriesControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[MixedTimeseriesControlPanel as any]],
    },
  ],
  controlOverrides: {
    // Shared controls
    x_axis: {
      default: null,
      label: t('X-Axis'),
    },
    time_grain_sqla: {
      default: null,
      label: t('Time Grain'),
    },
    color_scheme: {
      default: 'supersetColors',
      label: t('Color scheme'),
      renderTrigger: true,
    },
    zoomable: {
      default: true,
      label: t('Data Zoom'),
      renderTrigger: true,
    },
    minorTicks: {
      default: false,
      label: t('Minor ticks'),
      renderTrigger: true,
    },

    // Query A controls
    metrics: {
      default: [],
      label: t('Metrics'),
    },
    groupby: {
      default: [],
      label: t('Group by'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    limit: {
      default: 0,
      label: t('Series limit'),
    },
    timeseries_limit_metric: {
      default: null,
      label: t('Sort by metric'),
    },
    order_desc: {
      default: false,
      label: t('Sort Descending'),
    },
    row_limit: {
      default: 10000,
      label: t('Row limit'),
    },
    truncate_metric: {
      default: true,
      label: t('Truncate Metric'),
    },
    seriesType: {
      default: EchartsTimeseriesSeriesType.Line,
      label: t('Series type'),
      renderTrigger: true,
    },
    yAxisIndex: {
      default: 0,
      label: t('Y Axis'),
      renderTrigger: true,
    },
    stack: {
      default: false,
      label: t('Stack series'),
      renderTrigger: true,
    },
    area: {
      default: false,
      label: t('Area chart'),
      renderTrigger: true,
    },
    show_value: {
      default: false,
      label: t('Show Values'),
      renderTrigger: true,
    },
    markerEnabled: {
      default: false,
      label: t('Marker'),
      renderTrigger: true,
    },
    only_total: {
      default: true,
      label: t('Only Total'),
      renderTrigger: true,
    },
    opacity: {
      default: 0.7,
      label: t('Opacity'),
      renderTrigger: true,
    },
    markerSize: {
      default: 6,
      label: t('Marker size'),
      renderTrigger: true,
    },
    sort_series_type: {
      default: DEFAULT_SORT_SERIES_DATA.sort_series_type,
      label: t('Sort Series By'),
      renderTrigger: true,
    },
    sort_series_ascending: {
      default: DEFAULT_SORT_SERIES_DATA.sort_series_ascending,
      label: t('Sort Series Ascending'),
      renderTrigger: true,
    },

    // Query B controls
    metrics_b: {
      default: [],
      label: t('Metrics'),
    },
    groupby_b: {
      default: [],
      label: t('Group by'),
    },
    adhoc_filters_b: {
      default: [],
      label: t('Filters'),
    },
    limit_b: {
      default: 0,
      label: t('Series limit'),
    },
    timeseries_limit_metric_b: {
      default: null,
      label: t('Sort by metric'),
    },
    order_desc_b: {
      default: false,
      label: t('Sort Descending'),
    },
    row_limit_b: {
      default: 10000,
      label: t('Row limit'),
    },
    truncate_metric_b: {
      default: true,
      label: t('Truncate Metric'),
    },
    seriesTypeB: {
      default: EchartsTimeseriesSeriesType.Line,
      label: t('Series type'),
      renderTrigger: true,
    },
    yAxisIndexB: {
      default: 0,
      label: t('Y Axis'),
      renderTrigger: true,
    },
    stackB: {
      default: false,
      label: t('Stack series'),
      renderTrigger: true,
    },
    areaB: {
      default: false,
      label: t('Area chart'),
      renderTrigger: true,
    },
    show_valueB: {
      default: false,
      label: t('Show Values'),
      renderTrigger: true,
    },
    markerEnabledB: {
      default: false,
      label: t('Marker'),
      renderTrigger: true,
    },
    only_totalB: {
      default: true,
      label: t('Only Total'),
      renderTrigger: true,
    },
    opacityB: {
      default: 0.7,
      label: t('Opacity'),
      renderTrigger: true,
    },
    markerSizeB: {
      default: 6,
      label: t('Marker size'),
      renderTrigger: true,
    },
    sort_series_typeB: {
      default: DEFAULT_SORT_SERIES_DATA.sort_series_type,
      label: t('Sort Series By'),
      renderTrigger: true,
    },
    sort_series_ascendingB: {
      default: DEFAULT_SORT_SERIES_DATA.sort_series_ascending,
      label: t('Sort Series Ascending'),
      renderTrigger: true,
    },

    // X-Axis controls
    x_axis_time_format: {
      default: 'smart_date',
      label: t('Time format'),
      renderTrigger: true,
    },
    xAxisLabelRotation: {
      default: 0,
      label: t('Rotate x axis label'),
      renderTrigger: true,
    },

    // Tooltip controls
    show_query_identifiers: {
      default: false,
      label: t('Show query identifiers'),
      renderTrigger: true,
    },
    rich_tooltip: {
      default: true,
      label: t('Rich Tooltip'),
      renderTrigger: true,
    },

    // Y-Axis controls
    y_axis_format: {
      default: 'SMART_NUMBER',
      label: t('Primary y-axis format'),
      renderTrigger: true,
    },
    currency_format: {
      default: undefined,
      label: t('Currency format'),
      renderTrigger: true,
    },
    logAxis: {
      default: false,
      label: t('Logarithmic y-axis'),
      renderTrigger: true,
    },
    y_axis_bounds: {
      default: [null, null],
      label: t('Primary y-axis Bounds'),
      renderTrigger: true,
    },
    y_axis_format_secondary: {
      default: undefined,
      label: t('Secondary y-axis format'),
      renderTrigger: true,
    },
    currency_format_secondary: {
      default: undefined,
      label: t('Secondary currency format'),
      renderTrigger: true,
    },
    yAxisTitleSecondary: {
      default: '',
      label: t('Secondary y-axis title'),
      renderTrigger: true,
    },
    logAxisSecondary: {
      default: false,
      label: t('Logarithmic y-axis'),
      renderTrigger: true,
    },
    y_axis_bounds_secondary: {
      default: [null, null],
      label: t('Secondary y-axis Bounds'),
      renderTrigger: true,
    },
    minorSplitLine: {
      default: false,
      label: t('Minor Split Line'),
      renderTrigger: true,
    },
    truncateYAxis: {
      default: true,
      label: t('Truncate Y Axis'),
      renderTrigger: true,
    },
  },
};

export default config;
