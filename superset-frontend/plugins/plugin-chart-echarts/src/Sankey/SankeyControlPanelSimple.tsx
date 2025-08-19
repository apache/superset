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
import { t, validateNonEmpty } from '@superset-ui/core';
import { Tabs } from 'antd';
import { ColorSchemeControl } from '@superset-ui/chart-controls';

// Direct component imports
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';

interface SankeyControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Sankey charts.
 */
export const SankeyControlPanel: FC<SankeyControlPanelProps> = ({
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
      {/* Source Column */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Source')}
          description={t('The column to be used as the source of the edge.')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.source ? [formValues.source] : []}
            onChange={(val: any) => {
              // Source is single select, so take first value
              const sourceValue =
                Array.isArray(val) && val.length > 0 ? val[0] : null;
              handleChange('source')(sourceValue);
            }}
            options={safeColumns}
            name="source"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select source column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available. Please select a dataset first.')}
          </div>
        )}
      </div>

      {/* Target Column */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Target')}
          description={t('The column to be used as the target of the edge.')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.target ? [formValues.target] : []}
            onChange={(val: any) => {
              // Target is single select, so take first value
              const targetValue =
                Array.isArray(val) && val.length > 0 ? val[0] : null;
              handleChange('target')(targetValue);
            }}
            options={safeColumns}
            name="target"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select target column')}
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
          {t('Sankey Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Visualize flow data as a Sankey diagram')}
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
(SankeyControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[SankeyControlPanel as any]],
    },
  ],
  controlOverrides: {
    source: {
      default: null,
      label: t('Source'),
      validators: [validateNonEmpty],
    },
    target: {
      default: null,
      label: t('Target'),
      validators: [validateNonEmpty],
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
  },
};

export default config;
