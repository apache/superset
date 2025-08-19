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
import { GenericDataType, SMART_DATE_ID, t } from '@superset-ui/core';
import { Tabs } from 'antd';
import {
  D3_FORMAT_DOCS,
  D3_TIME_FORMAT_OPTIONS,
  Dataset,
} from '@superset-ui/chart-controls';
import { DndMetricSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../../src/explore/components/controls/CheckboxControl';
import SelectControl from '../../../../../src/explore/components/controls/SelectControl';
import CurrencyControl from '../../../../../src/explore/components/controls/CurrencyControl';
import ControlHeader from '../../../../../src/explore/components/ControlHeader';
import Control from '../../../../../src/explore/components/Control';
import ConditionalFormattingControl from '../../../../../src/explore/components/controls/ConditionalFormattingControl';

interface BigNumberTotalControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for BigNumber Total charts.
 */
export const BigNumberTotalControlPanel: FC<BigNumberTotalControlPanelProps> = ({
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

      {/* Time Column */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Time Column')}
          description={t('Select the time column for temporal filtering')}
          hovered
        />
        <SelectControl
          value={formValues.granularity || null}
          onChange={handleChange('granularity')}
          choices={safeColumns
            .filter((col: any) => col.is_dttm)
            .map((col: any) => [col.column_name, col.verbose_name || col.column_name])}
          clearable
          placeholder={t('Select time column')}
          renderTrigger
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

        {/* Conditional Formatting */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Conditional Formatting')}
            description={t('Apply conditional color formatting to metric')}
            hovered
          />
          <ConditionalFormattingControl
            value={formValues.conditional_formatting || []}
            onChange={handleChange('conditional_formatting')}
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
          {t('Big Number')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Displays a single metric value in a large font')}
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
(BigNumberTotalControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[BigNumberTotalControlPanel as any]],
    },
  ],
  controlOverrides: {
    metric: {
      default: null,
      label: t('Metric'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    granularity: {
      default: null,
      label: t('Time Column'),
    },
    header_font_size: {
      default: 0.4,
      label: t('Big Number Font Size'),
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
    conditional_formatting: {
      default: [],
      label: t('Conditional Formatting'),
      renderTrigger: true,
    },
  },
  formDataOverrides: (formData: any) => ({
    ...formData,
    metric: formData.metric,
  }),
};

export default config;
