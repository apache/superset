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
  LinearColorSchemeControl,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import CurrencyControl from '../../../../src/explore/components/controls/CurrencyControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';
import { DEFAULT_FORM_DATA, EchartsSunburstLabelType } from './types';

interface SunburstControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Sunburst charts.
 */
export const SunburstControlPanel: FC<SunburstControlPanelProps> = ({
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

  // Determine if secondary metric is used (for color scheme visibility)
  const hasSecondaryMetric =
    formValues.secondary_metric &&
    formValues.secondary_metric !== formValues.metric;

  // Data tab content
  const dataTabContent = (
    <div>
      {/* Hierarchy (Columns) */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Hierarchy')}
          description={t(
            'Sets the hierarchy levels of the chart. Each level is represented by one ring with the innermost circle as the top of the hierarchy.',
          )}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.columns || []}
            onChange={handleChange('columns')}
            options={safeColumns}
            name="columns"
            label=""
            multi
            canDelete
            ghostButtonText={t('Add hierarchy level')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available. Please select a dataset first.')}
          </div>
        )}
      </div>

      {/* Primary Metric */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Primary Metric')}
          description={t(
            'The primary metric is used to define the arc segment sizes',
          )}
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

      {/* Secondary Metric */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Secondary Metric')}
          description={t(
            '[optional] this secondary metric is used to define the color as a ratio against the primary metric. When omitted, the color is categorical and based on labels',
          )}
          hovered
        />
        {safeDataSource && safeDataSource.columns ? (
          <DndMetricSelect
            value={formValues.secondary_metric}
            onChange={handleChange('secondary_metric')}
            datasource={safeDataSource}
            name="secondary_metric"
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
            label={t('Sort by metric')}
            description={t(
              'Whether to sort results by the selected metric in descending order',
            )}
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
      {/* Chart Options Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Chart Options')}</h4>

        {/* Color Scheme - Categorical (when no secondary metric) */}
        {!hasSecondaryMetric && (
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Color scheme')}
              description={t(
                'When only a primary metric is provided, a categorical color scale is used.',
              )}
              hovered
            />
            {(() => {
              const colorSchemeControl = ColorSchemeControl();
              const { hidden, ...cleanConfig } =
                colorSchemeControl.config || {};
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
        )}

        {/* Linear Color Scheme - For secondary metric */}
        {hasSecondaryMetric && (
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Linear color scheme')}
              description={t(
                'When a secondary metric is provided, a linear color scale is used.',
              )}
              hovered
            />
            {(() => {
              const linearColorSchemeControl = LinearColorSchemeControl();
              const { hidden, ...cleanConfig } =
                linearColorSchemeControl.config || {};
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
        )}
      </div>

      {/* Labels Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Labels')}</h4>

        {/* Show Labels */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Labels')}
            description={t('Whether to display the labels.')}
            value={formValues.show_labels ?? DEFAULT_FORM_DATA.showLabels}
            onChange={handleChange('show_labels')}
            renderTrigger
            hovered
          />
        </div>

        {/* Percentage threshold */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Percentage threshold')}
            description={t(
              'Minimum threshold in percentage points for showing labels.',
            )}
            renderTrigger
            hovered
          />
          <TextControl
            value={formValues.show_labels_threshold ?? 5}
            onChange={handleChange('show_labels_threshold')}
            isFloat
            placeholder="5"
            controlId="show_labels_threshold"
          />
        </div>

        {/* Show Total */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Total')}
            description={t('Whether to display the aggregate count')}
            value={formValues.show_total ?? false}
            onChange={handleChange('show_total')}
            renderTrigger
            hovered
          />
        </div>

        {/* Label Type */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Label Type')}
            description={t('What should be shown on the label?')}
            value={formValues.label_type || DEFAULT_FORM_DATA.labelType}
            onChange={handleChange('label_type')}
            choices={[
              [EchartsSunburstLabelType.Key, t('Category Name')],
              [EchartsSunburstLabelType.Value, t('Value')],
              [EchartsSunburstLabelType.KeyValue, t('Category and Value')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Number format */}
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
            value={formValues.date_format || DEFAULT_FORM_DATA.dateFormat}
            onChange={handleChange('date_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
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
      {/* Chart Description */}
      <div style={{ marginBottom: 16, padding: '12px', borderRadius: '4px' }}>
        <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
          {t('Sunburst Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t(
            'Visualize flow between different entities using circles to represent different stages of a system',
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
(SunburstControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[SunburstControlPanel as any]],
    },
  ],
  controlOverrides: {
    columns: {
      default: [],
      label: t('Hierarchy'),
    },
    metric: {
      default: null,
      label: t('Primary Metric'),
    },
    secondary_metric: {
      default: null,
      label: t('Secondary Metric'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    row_limit: {
      default: 100,
      label: t('Row limit'),
    },
    sort_by_metric: {
      default: true,
      label: t('Sort by metric'),
    },
    color_scheme: {
      default: 'supersetColors',
      label: t('Color scheme'),
      renderTrigger: true,
    },
    linear_color_scheme: {
      default: 'blue_white_yellow',
      label: t('Linear color scheme'),
      renderTrigger: true,
    },
    show_labels: {
      default: DEFAULT_FORM_DATA.showLabels,
      label: t('Show labels'),
      renderTrigger: true,
    },
    show_labels_threshold: {
      default: 5,
      label: t('Percentage threshold'),
      renderTrigger: true,
    },
    show_total: {
      default: false,
      label: t('Show Total'),
      renderTrigger: true,
    },
    label_type: {
      default: DEFAULT_FORM_DATA.labelType,
      label: t('Label Type'),
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
    date_format: {
      default: DEFAULT_FORM_DATA.dateFormat,
      label: t('Date format'),
      renderTrigger: true,
    },
  },
};

export default config;
