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
import { SMART_DATE_ID, t } from '@superset-ui/core';
import { Tabs } from 'antd';
import {
  D3_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../../src/explore/components/controls/CheckboxControl';
import SelectControl from '../../../../../src/explore/components/controls/SelectControl';
import CurrencyControl from '../../../../../src/explore/components/controls/CurrencyControl';
import ColorPickerControl from '../../../../../src/explore/components/controls/ColorPickerControl';
import ControlHeader from '../../../../../src/explore/components/ControlHeader';

interface BigNumberWithTrendlineControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for BigNumber with Trendline charts.
 */
export const BigNumberWithTrendlineControlPanel: FC<BigNumberWithTrendlineControlPanelProps> = ({
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
      {/* Temporal X-Axis */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Temporal X-Axis')}
          description={t('Column used for temporal grouping')}
          hovered
        />
        <DndColumnSelect
          value={formValues.x_axis ? [formValues.x_axis] : []}
          onChange={(val: any) => {
            const singleValue = Array.isArray(val) ? val[0] : val;
            handleChange('x_axis')(singleValue);
          }}
          options={safeColumns.filter((col: any) => col.is_dttm)}
          name="x_axis"
          label=""
          multi={false}
          canDelete
          ghostButtonText={t('Add temporal column')}
          type="DndColumnSelect"
          actions={actions}
        />
      </div>

      {/* Time Grain */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Time Grain')}
          description={t('The time granularity for the visualization')}
          hovered
        />
        <SelectControl
          value={formValues.time_grain_sqla || null}
          onChange={handleChange('time_grain_sqla')}
          choices={[
            [null, t('Auto')],
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
          renderTrigger
        />
      </div>

      {/* Aggregation */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Aggregation')}
          description={t('Aggregation function to apply')}
          hovered
        />
        <SelectControl
          value={formValues.time_range_endpoints || null}
          onChange={handleChange('time_range_endpoints')}
          choices={[
            [null, t('Auto')],
            ['inclusive', t('Inclusive of both endpoints')],
            ['exclusive', t('Exclusive of both endpoints')],
          ]}
          clearable
          renderTrigger
        />
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
    </div>
  );

  // Options tab content (labeled as "Options" in original)
  const optionsTabContent = (
    <div>
      {/* Options Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Comparison Options')}</h4>

        {/* Comparison Period Lag */}
        <div style={{ marginBottom: 16 }}>
          <TextControl
            label={t('Comparison Period Lag')}
            description={t(
              'Based on granularity, number of time periods to compare against',
            )}
            value={formValues.compare_lag || ''}
            onChange={handleChange('compare_lag')}
            isInt
            controlId="compare_lag"
          />
        </div>

        {/* Comparison suffix */}
        <div style={{ marginBottom: 16 }}>
          <TextControl
            label={t('Comparison suffix')}
            description={t('Suffix to apply after the percentage display')}
            value={formValues.compare_suffix || ''}
            onChange={handleChange('compare_suffix')}
            controlId="compare_suffix"
          />
        </div>

        {/* Show Timestamp */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Timestamp')}
            description={t('Whether to display the timestamp')}
            value={formValues.show_timestamp ?? false}
            onChange={handleChange('show_timestamp')}
            renderTrigger
            hovered
          />
        </div>

        {/* Show Trend Line */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Trend Line')}
            description={t('Whether to display the trend line')}
            value={formValues.show_trend_line ?? true}
            onChange={handleChange('show_trend_line')}
            renderTrigger
            hovered
          />
        </div>

        {/* Start y-axis at 0 */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Start y-axis at 0')}
            description={t(
              'Start y-axis at zero. Uncheck to start y-axis at minimum value in the data.',
            )}
            value={formValues.start_y_axis_at_zero ?? true}
            onChange={handleChange('start_y_axis_at_zero')}
            renderTrigger
            hovered
          />
        </div>

        {/* Fix to selected Time Range - CONDITIONAL */}
        {formValues.time_range && formValues.time_range !== 'No filter' && (
          <div style={{ marginBottom: 16 }}>
            <CheckboxControl
              label={t('Fix to selected Time Range')}
              description={t(
                'Fix the trend line to the full time range specified in case filtered results do not include the start or end dates',
              )}
              value={formValues.time_range_fixed ?? false}
              onChange={handleChange('time_range_fixed')}
              renderTrigger
              hovered
            />
          </div>
        )}
      </div>
    </div>
  );

  // Customize tab content
  const customizeTabContent = (
    <div>
      {/* Chart Options Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Chart Options')}</h4>

        {/* Color Picker */}
        <div style={{ marginBottom: 16 }}>
          <ColorPickerControl
            value={formValues.color_picker}
            onChange={handleChange('color_picker')}
          />
        </div>

        {/* Header Font Size */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Big Number Font Size')}
            value={formValues.header_font_size || 0.4}
            onChange={handleChange('header_font_size')}
            choices={[
              [0.2, t('Tiny')],
              [0.3, t('Small')],
              [0.4, t('Normal')],
              [0.5, t('Large')],
              [0.6, t('Huge')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Subheader Font Size */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Subheader Font Size')}
            value={formValues.subheader_font_size || 0.15}
            onChange={handleChange('subheader_font_size')}
            choices={[
              [0.125, t('Tiny')],
              [0.15, t('Small')],
              [0.2, t('Normal')],
              [0.3, t('Large')],
              [0.4, t('Huge')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Subtitle */}
        <div style={{ marginBottom: 16 }}>
          <TextControl
            label={t('Subtitle')}
            description={t('Description text that shows up below your Big Number')}
            value={formValues.subtitle || ''}
            onChange={handleChange('subtitle')}
            controlId="subtitle"
            renderTrigger
          />
        </div>

        {/* Subtitle Font Size */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Subtitle Font Size')}
            value={formValues.subtitle_font_size || 0.15}
            onChange={handleChange('subtitle_font_size')}
            choices={[
              [0.125, t('Tiny')],
              [0.15, t('Small')],
              [0.2, t('Normal')],
              [0.3, t('Large')],
              [0.4, t('Huge')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Show Metric Name */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Metric Name')}
            description={t('Whether to display the metric name')}
            value={formValues.show_metric_name ?? false}
            onChange={handleChange('show_metric_name')}
            renderTrigger
            hovered
          />
        </div>

        {/* Metric Name Font Size - CONDITIONAL */}
        {formValues.show_metric_name && (
          <div style={{ marginBottom: 16 }}>
            <SelectControl
              label={t('Metric Name Font Size')}
              value={formValues.metric_name_font_size || 0.15}
              onChange={handleChange('metric_name_font_size')}
              choices={[
                [0.125, t('Tiny')],
                [0.15, t('Small')],
                [0.2, t('Normal')],
                [0.3, t('Large')],
                [0.4, t('Huge')],
              ]}
              clearable={false}
              renderTrigger
              hovered
            />
          </div>
        )}
      </div>

      {/* Formatting Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Formatting')}</h4>

        {/* Number format */}
        <div style={{ marginBottom: 16 }}>
          <TextControl
            label={t('Number format')}
            value={formValues.y_axis_format || ''}
            onChange={handleChange('y_axis_format')}
            placeholder="SMART_NUMBER"
            controlId="y_axis_format"
            renderTrigger
          />
        </div>

        {/* Currency format */}
        <div style={{ marginBottom: 16 }}>
          <CurrencyControl
            value={formValues.currency_format}
            onChange={handleChange('currency_format')}
          />
        </div>

        {/* Date format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Date format')}
            description={D3_FORMAT_DOCS}
            value={formValues.time_format || SMART_DATE_ID}
            onChange={handleChange('time_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* Force Date Format */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Force date format')}
            description={t(
              'Use date formatting even when metric value is not a timestamp',
            )}
            value={formValues.force_timestamp_formatting ?? false}
            onChange={handleChange('force_timestamp_formatting')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Advanced Analytics Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Advanced Analytics')}</h4>

        {/* Rolling Window subsection */}
        <div style={{ marginBottom: 16 }}>
          <h5>{t('Rolling Window')}</h5>

          {/* Rolling Function */}
          <div style={{ marginBottom: 16 }}>
            <SelectControl
              label={t('Rolling Function')}
              description={t(
                'Defines a rolling window function to apply, works along ' +
                  'with the [Periods] text box',
              )}
              value={formValues.rolling_type || 'None'}
              onChange={handleChange('rolling_type')}
              choices={[
                ['None', t('None')],
                ['mean', t('mean')],
                ['sum', t('sum')],
                ['std', t('std')],
                ['cumsum', t('cumsum')],
              ]}
              clearable={false}
              renderTrigger
              hovered
            />
          </div>

          {/* Periods */}
          <div style={{ marginBottom: 16 }}>
            <TextControl
              label={t('Periods')}
              description={t(
                'Defines the size of the rolling window function, ' +
                  'relative to the time granularity selected',
              )}
              value={formValues.rolling_periods || ''}
              onChange={handleChange('rolling_periods')}
              isInt
              controlId="rolling_periods"
            />
          </div>

          {/* Min Periods */}
          <div style={{ marginBottom: 16 }}>
            <TextControl
              label={t('Min Periods')}
              description={t(
                'The minimum number of rolling periods required to show ' +
                  'a value. For instance if you do a cumulative sum on 7 days ' +
                  'you may want your "Min Period" to be 7, so that all data points ' +
                  'shown are the total of 7 periods. This will hide the "ramp up" ' +
                  'taking place over the first 7 periods',
              )}
              value={formValues.min_periods || ''}
              onChange={handleChange('min_periods')}
              isInt
              controlId="min_periods"
            />
          </div>
        </div>

        {/* Resample subsection */}
        <div style={{ marginBottom: 16 }}>
          <h5>{t('Resample')}</h5>

          {/* Rule */}
          <div style={{ marginBottom: 16 }}>
            <SelectControl
              label={t('Rule')}
              description={t('Pandas resample rule')}
              value={formValues.resample_rule || null}
              onChange={handleChange('resample_rule')}
              choices={[
                ['1T', t('1 minutely frequency')],
                ['1H', t('1 hourly frequency')],
                ['1D', t('1 calendar day frequency')],
                ['7D', t('7 calendar day frequency')],
                ['1MS', t('1 month start frequency')],
                ['1M', t('1 month end frequency')],
                ['1AS', t('1 year start frequency')],
                ['1A', t('1 year end frequency')],
              ]}
              freeForm
              clearable
              renderTrigger
              hovered
            />
          </div>

          {/* Fill method */}
          <div style={{ marginBottom: 16 }}>
            <SelectControl
              label={t('Fill method')}
              description={t('Pandas resample method')}
              value={formValues.resample_method || null}
              onChange={handleChange('resample_method')}
              choices={[
                ['asfreq', t('Null imputation')],
                ['zerofill', t('Zero imputation')],
                ['linear', t('Linear interpolation')],
                ['ffill', t('Forward values')],
                ['bfill', t('Backward values')],
                ['median', t('Median values')],
                ['mean', t('Mean values')],
                ['sum', t('Sum values')],
              ]}
              freeForm
              clearable
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
      key: 'options',
      label: t('Options'),
      children: optionsTabContent,
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
          {t('Big Number with Trendline')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Displays a metric value with a time-series trend chart')}
        </div>
      </div>

      {/* Tabs for Data, Options, and Customize */}
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
(BigNumberWithTrendlineControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[BigNumberWithTrendlineControlPanel as any]],
    },
  ],
  controlOverrides: {
    x_axis: {
      default: null,
      label: t('Temporal X-Axis'),
    },
    time_grain_sqla: {
      default: null,
      label: t('Time Grain'),
    },
    metric: {
      default: null,
      label: t('Metric'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    compare_lag: {
      default: '',
      label: t('Comparison Period Lag'),
    },
    compare_suffix: {
      default: '',
      label: t('Comparison suffix'),
    },
    show_timestamp: {
      default: false,
      label: t('Show Timestamp'),
      renderTrigger: true,
    },
    show_trend_line: {
      default: true,
      label: t('Show Trend Line'),
      renderTrigger: true,
    },
    start_y_axis_at_zero: {
      default: true,
      label: t('Start y-axis at 0'),
      renderTrigger: true,
    },
    time_range_fixed: {
      default: false,
      label: t('Fix to selected Time Range'),
      renderTrigger: true,
    },
    color_picker: {
      default: undefined,
      label: t('Color Picker'),
      renderTrigger: true,
    },
    header_font_size: {
      default: 0.4,
      label: t('Big Number Font Size'),
      renderTrigger: true,
    },
    subheader_font_size: {
      default: 0.15,
      label: t('Subheader Font Size'),
      renderTrigger: true,
    },
    subtitle: {
      default: '',
      label: t('Subtitle'),
      renderTrigger: true,
    },
    subtitle_font_size: {
      default: 0.15,
      label: t('Subtitle Font Size'),
      renderTrigger: true,
    },
    show_metric_name: {
      default: false,
      label: t('Show Metric Name'),
      renderTrigger: true,
    },
    metric_name_font_size: {
      default: 0.15,
      label: t('Metric Name Font Size'),
      renderTrigger: true,
    },
    y_axis_format: {
      default: '',
      label: t('Number format'),
      renderTrigger: true,
    },
    currency_format: {
      default: undefined,
      label: t('Currency format'),
      renderTrigger: true,
    },
    time_format: {
      default: SMART_DATE_ID,
      label: t('Date format'),
      renderTrigger: true,
    },
    force_timestamp_formatting: {
      default: false,
      label: t('Force date format'),
      renderTrigger: true,
    },
    rolling_type: {
      default: 'None',
      label: t('Rolling Function'),
      renderTrigger: true,
    },
    rolling_periods: {
      default: '',
      label: t('Periods'),
    },
    min_periods: {
      default: '',
      label: t('Min Periods'),
    },
    resample_rule: {
      default: null,
      label: t('Rule'),
      renderTrigger: true,
    },
    resample_method: {
      default: null,
      label: t('Fill method'),
      renderTrigger: true,
    },
  },
  formDataOverrides: (formData: any) => ({
    ...formData,
    metric: formData.metric,
  }),
};

export default config;
