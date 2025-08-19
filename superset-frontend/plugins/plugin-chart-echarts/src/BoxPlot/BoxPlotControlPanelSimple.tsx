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
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';

interface BoxPlotControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Box Plot charts.
 */
export const BoxPlotControlPanel: FC<BoxPlotControlPanelProps> = ({
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

  // Helper to check if time_grain_sqla should be visible
  const shouldShowTimeGrain = () => {
    return (formValues.columns || []).some((col: any) => {
      if (typeof col === 'string') {
        const column = safeColumns.find(c => c.column_name === col);
        return column?.is_dttm;
      }
      return col?.is_dttm || col?.sqlExpression?.includes('date') || col?.sqlExpression?.includes('time');
    });
  };

  // Data tab content
  const dataTabContent = (
    <div>
      {/* Distribute across (Columns) */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Distribute across')}
          description={t('Columns to calculate distribution across.')}
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
            ghostButtonText={t('Add column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available. Please select a dataset first.')}
          </div>
        )}
      </div>

      {/* Time Grain - Only show if temporal columns are selected */}
      {shouldShowTimeGrain() && (
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
      )}

      {/* Dimensions (Group by) */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Dimensions')}
          description={t('Categories to group by on the x-axis.')}
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
            {t('No columns available for grouping.')}
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

      {/* Row and Series Limits */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <ControlHeader
            label={t('Series limit')}
            description={t('Limit number of series that are displayed')}
            hovered
          />
          <TextControl
            value={formValues.series_limit}
            onChange={handleChange('series_limit')}
            isInt
            placeholder="25"
            controlId="series_limit"
          />
        </div>
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
            placeholder="1000"
            controlId="row_limit"
          />
        </div>
      </div>

      {/* Series limit metric */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Series limit metric')}
          description={t('Metric used to order the series in the limit')}
          hovered
        />
        {safeDataSource && safeDataSource.columns ? (
          <DndMetricSelect
            value={formValues.series_limit_metric}
            onChange={handleChange('series_limit_metric')}
            datasource={safeDataSource}
            name="series_limit_metric"
            label=""
            multi={false}
            savedMetrics={safeMetrics}
          />
        ) : (
          <div style={{ padding: '10px' }}>{t('No metrics available.')}</div>
        )}
      </div>

      {/* Whisker Options */}
      <div style={{ marginBottom: 16 }}>
        <SelectControl
          label={t('Whisker/outlier options')}
          description={t('Determines how whiskers and outliers are calculated.')}
          value={formValues.whiskerOptions || 'Tukey'}
          onChange={handleChange('whiskerOptions')}
          choices={[
            ['Tukey', t('Tukey')],
            ['Min/max (no outliers)', t('Min/max (no outliers)')],
            ['2/98 percentiles', t('2/98 percentiles')],
            ['5/95 percentiles', t('5/95 percentiles')],
            ['9/91 percentiles', t('9/91 percentiles')],
            ['10/90 percentiles', t('10/90 percentiles')],
          ]}
          clearable={false}
          renderTrigger
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

        {/* X Tick Layout */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('X Tick Layout')}
            description={t('The way the ticks are laid out on the X-axis')}
            value={formValues.x_ticks_layout || 'auto'}
            onChange={handleChange('x_ticks_layout')}
            choices={[
              ['auto', t('auto')],
              ['flat', t('flat')],
              ['45°', '45°'],
              ['90°', '90°'],
              ['staggered', t('staggered')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Number Format */}
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

        {/* Date Format */}
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
          {t('Box Plot')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Compare distributions across multiple groups with quartiles, median, and outliers')}
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
(BoxPlotControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[BoxPlotControlPanel as any]],
    },
  ],
  controlOverrides: {
    columns: {
      default: [],
      label: t('Distribute across'),
      multi: true,
    },
    time_grain_sqla: {
      default: null,
      label: t('Time Grain'),
    },
    groupby: {
      default: [],
      label: t('Dimensions'),
    },
    metrics: {
      default: [],
      label: t('Metrics'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    series_limit: {
      default: 25,
      label: t('Series limit'),
    },
    row_limit: {
      default: 1000,
      label: t('Row limit'),
    },
    series_limit_metric: {
      default: null,
      label: t('Series limit metric'),
    },
    whiskerOptions: {
      default: 'Tukey',
      label: t('Whisker/outlier options'),
      renderTrigger: true,
    },
    color_scheme: {
      default: 'supersetColors',
      label: t('Color scheme'),
      renderTrigger: true,
    },
    x_ticks_layout: {
      default: 'auto',
      label: t('X Tick Layout'),
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
  },
};

export default config;
