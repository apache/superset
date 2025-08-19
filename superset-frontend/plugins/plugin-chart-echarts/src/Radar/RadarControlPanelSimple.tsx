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
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';
import { LABEL_POSITION } from '../constants';

interface RadarControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Radar charts.
 */
export const RadarControlPanel: FC<RadarControlPanelProps> = ({
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
          label={t('Group by')}
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

      {/* Metrics */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Metrics')}
          description={t('Metrics to display')}
          hovered
        />
        {safeDataSource && safeDataSource.columns ? (
          <DndMetricSelect
            value={formValues.metrics || []}
            onChange={handleChange('metrics')}
            datasource={safeDataSource}
            name="metrics"
            label=""
            multi={true}
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
            selectedMetrics={formValues.metrics || []}
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
          value={formValues.row_limit || 10}
          onChange={handleChange('row_limit')}
          isInt
          placeholder="10"
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

        {/* Circle radar shape */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Circle radar shape')}
            description={t("Radar render type, whether to display 'circle' shape.")}
            value={formValues.is_circle ?? false}
            onChange={handleChange('is_circle')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Labels Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Labels')}</h4>

        {/* Show Labels checkbox */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Labels')}
            description={t('Whether to display the labels.')}
            value={formValues.show_labels ?? true}
            onChange={handleChange('show_labels')}
            renderTrigger
            hovered
          />
        </div>

        {/* Label Type */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Label Type')}
            description={t('What should be shown on the label?')}
            value={formValues.label_type || 'value'}
            onChange={handleChange('label_type')}
            choices={[
              ['value', t('Value')],
              ['key_value', t('Category and Value')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Label Position */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Label position')}
            description={t('Position of the labels')}
            value={formValues.label_position || 'top'}
            onChange={handleChange('label_position')}
            choices={LABEL_POSITION}
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
            value={formValues.number_format || 'SMART_NUMBER'}
            onChange={handleChange('number_format')}
            choices={D3_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* Date format */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Date format')}
            description={D3_FORMAT_DOCS}
            value={formValues.date_format || 'smart_date'}
            onChange={handleChange('date_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Metrics Configuration Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Metrics Configuration')}</h4>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Metric Min Value')}
            description={t('The minimum value of metrics. It is an optional configuration. If not set, it will be the minimum value of the data')}
            hovered
          />
          <TextControl
            value={formValues.radarMetricMinValue || 0}
            onChange={handleChange('radarMetricMinValue')}
            isFloat
            placeholder="auto"
            controlId="radarMetricMinValue"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Metric Max Value')}
            description={t('The maximum value of metrics. It is an optional configuration')}
            hovered
          />
          <TextControl
            value={formValues.radarMetricMaxValue}
            onChange={handleChange('radarMetricMaxValue')}
            isFloat
            placeholder="auto"
            controlId="radarMetricMaxValue"
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
          {t('Radar Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Visualize a parallel set of metrics across multiple groups. Each group is visualized using its own line of points and each metric is represented as an edge in the chart.')}
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
(RadarControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[RadarControlPanel as any]],
    },
  ],
  controlOverrides: {
    groupby: {
      default: [],
      label: t('Group by'),
    },
    metrics: {
      default: [],
      label: t('Metrics'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    row_limit: {
      default: 10,
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
    show_labels: {
      default: true,
      label: t('Show labels'),
      renderTrigger: true,
    },
    label_type: {
      default: 'value',
      label: t('Label Type'),
      renderTrigger: true,
    },
    label_position: {
      default: 'top',
      label: t('Label position'),
      renderTrigger: true,
    },
    number_format: {
      default: 'SMART_NUMBER',
      label: t('Number format'),
      renderTrigger: true,
    },
    date_format: {
      default: 'smart_date',
      label: t('Date format'),
      renderTrigger: true,
    },
    is_circle: {
      default: false,
      label: t('Circle radar shape'),
      renderTrigger: true,
    },
    radarMetricMinValue: {
      default: 0,
      label: t('Metric Min Value'),
      renderTrigger: true,
    },
    radarMetricMaxValue: {
      default: null,
      label: t('Metric Max Value'),
      renderTrigger: true,
    },
  },
};

export default config;
