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
import { t, GenericDataType } from '@superset-ui/core';
import { Tabs } from 'antd';
import { DndMetricSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../../src/explore/components/controls/CheckboxControl';
import SelectControl from '../../../../../src/explore/components/controls/SelectControl';
import CurrencyControl from '../../../../../src/explore/components/controls/CurrencyControl';
import ControlHeader from '../../../../../src/explore/components/ControlHeader';
import Control from '../../../../../src/explore/components/Control';
import ColumnConfigControl from '../../../../../src/explore/components/controls/ColumnConfigControl';
import { ColorSchemeEnum } from './types';

interface BigNumberPeriodOverPeriodControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for BigNumber Period-over-Period charts.
 */
export const BigNumberPeriodOverPeriodControlPanel: FC<BigNumberPeriodOverPeriodControlPanelProps> = ({
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

      {/* Row Limit */}
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
          placeholder="100"
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

        {/* Percent Difference format */}
        <div style={{ marginBottom: 16 }}>
          <TextControl
            label={t('Percent Difference format')}
            value={formValues.percentDifferenceFormat || ''}
            onChange={handleChange('percentDifferenceFormat')}
            placeholder="SMART_NUMBER"
            controlId="percentDifferenceFormat"
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

        {/* Header Font Size */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Big Number Font Size')}
            value={formValues.header_font_size || 0.2}
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

        {/* Comparison font size */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Comparison font size')}
            value={formValues.subheader_font_size || 0.125}
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

        {/* Add color for positive/negative change */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Add color for positive/negative change')}
            description={t('Add color for positive/negative change')}
            value={formValues.comparison_color_enabled ?? false}
            onChange={handleChange('comparison_color_enabled')}
            renderTrigger
            hovered
          />
        </div>

        {/* Color scheme for comparison - CONDITIONAL */}
        {formValues.comparison_color_enabled && (
          <div style={{ marginBottom: 16 }}>
            <SelectControl
              label={t('color scheme for comparison')}
              description={t(
                'Adds color to the chart symbols based on the positive or ' +
                  'negative change from the comparison value.',
              )}
              value={formValues.comparison_color_scheme || ColorSchemeEnum.Green}
              onChange={handleChange('comparison_color_scheme')}
              choices={[
                [ColorSchemeEnum.Green, 'Green for increase, red for decrease'],
                [ColorSchemeEnum.Red, 'Red for increase, green for decrease'],
              ]}
              clearable={false}
              renderTrigger
              hovered
            />
          </div>
        )}

        {/* Column Configuration */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Customize columns')}
            description={t('Further customize how to display each column')}
            hovered
          />
          <ColumnConfigControl
            value={formValues.column_config || {}}
            onChange={handleChange('column_config')}
            configFormLayout={{
              [GenericDataType.Numeric]: [
                {
                  tab: t('General'),
                  children: [
                    ['customColumnName'],
                    ['displayTypeIcon'],
                    ['visible'],
                  ],
                },
              ],
            }}
            columnsPropsObject={{
              colnames: ['Previous value', 'Delta', 'Percent change'],
              coltypes: [
                GenericDataType.Numeric,
                GenericDataType.Numeric,
                GenericDataType.Numeric,
              ],
            }}
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
          {t('Big Number with Period-over-Period')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Displays a metric value with comparison to previous period')}
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
(BigNumberPeriodOverPeriodControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[BigNumberPeriodOverPeriodControlPanel as any]],
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
    row_limit: {
      default: 100,
      label: t('Row limit'),
    },
    y_axis_format: {
      default: '',
      label: t('Number format'),
      renderTrigger: true,
    },
    percentDifferenceFormat: {
      default: '',
      label: t('Percent Difference format'),
      renderTrigger: true,
    },
    currency_format: {
      default: undefined,
      label: t('Currency format'),
      renderTrigger: true,
    },
    header_font_size: {
      default: 0.2,
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
    subheader_font_size: {
      default: 0.125,
      label: t('Comparison font size'),
      renderTrigger: true,
    },
    comparison_color_enabled: {
      default: false,
      label: t('Add color for positive/negative change'),
      renderTrigger: true,
    },
    comparison_color_scheme: {
      default: ColorSchemeEnum.Green,
      label: t('color scheme for comparison'),
      renderTrigger: true,
    },
    column_config: {
      default: {},
      label: t('Customize columns'),
      renderTrigger: true,
    },
  },
  formDataOverrides: (formData: any) => ({
    ...formData,
    metric: formData.metric,
  }),
};

export default config;
