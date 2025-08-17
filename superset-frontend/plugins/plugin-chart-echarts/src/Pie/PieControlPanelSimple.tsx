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
import { FC } from 'react';
import { t } from '@superset-ui/core';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';

interface PieControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Pie charts.
 */
export const PieControlPanel: FC<PieControlPanelProps> = ({
  onChange,
  value,
  datasource,
  form_data,
  actions,
  controls,
}) => {
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

  return (
    <div style={{ padding: '16px' }}>
      {/* Query Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Query')}</h4>

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
              label={t('Group by')}
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
              label={t('Metric')}
              multi={false}
              savedMetrics={safeMetrics}
            />
          ) : (
            <div style={{ padding: '10px' }}>{t('No metrics available.')}</div>
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
              placeholder="10000"
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

      {/* Chart Options Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Chart Options')}</h4>

        {/* Donut checkbox */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Donut')}
            description={t('Do you want a donut or a pie?')}
            value={formValues.donut || false}
            onChange={handleChange('donut')}
            renderTrigger
            hovered
          />
        </div>

        {/* Show Labels checkbox */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Labels')}
            description={t('Whether to display labels on the pie slices')}
            value={formValues.show_labels ?? true}
            onChange={handleChange('show_labels')}
            renderTrigger
            hovered
          />
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
      </div>
    </div>
  );
};

// Mark this component as a modern panel
(PieControlPanel as any).isModernPanel = true;

// Provide a minimal config structure to prevent errors
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[PieControlPanel as any]],
    },
  ],
  // Provide default control overrides
  controlOverrides: {
    groupby: {
      default: [],
      label: t('Group by'),
    },
    metric: {
      default: null,
      label: t('Metric'),
    },
    row_limit: {
      default: 100,
      label: t('Row limit'),
    },
    sort_by_metric: {
      default: true,
      label: t('Sort by metric'),
    },
    donut: {
      default: false,
      label: t('Donut'),
      renderTrigger: true,
    },
    show_labels: {
      default: true,
      label: t('Show labels'),
      renderTrigger: true,
    },
    show_legend: {
      default: true,
      label: t('Show legend'),
      renderTrigger: true,
    },
  },
};

export default config;
