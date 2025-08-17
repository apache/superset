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
// Import the real drag-and-drop controls
import { ColorSchemeControl as SharedColorSchemeControl } from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SliderControl from '../../../../src/explore/components/controls/SliderControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';

console.log('PieControlPanelSimple.tsx - Loading file');

interface PieControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A TRUE React component-based control panel for Pie charts.
 * This uses the real drag-and-drop controls from Superset.
 */
export const PieControlPanel: FC<PieControlPanelProps> = ({
  onChange,
  value,
  datasource,
  form_data,
  actions,
  controls,
}) => {
  console.log('PieControlPanel rendering with:', {
    value,
    datasource,
    form_data,
    controls,
  });
  console.log('Datasource type:', typeof datasource);
  console.log('Datasource columns:', datasource?.columns);
  console.log('Datasource metrics:', datasource?.metrics);

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

  console.log('Safe datasource:', safeDataSource);

  // Helper to handle control changes using actions if available
  const handleChange =
    (field: string, renderTrigger = false) =>
    (val: any) => {
      console.log(
        'Control change:',
        field,
        val,
        'renderTrigger:',
        renderTrigger,
      );
      if (actions?.setControlValue) {
        actions.setControlValue(field, val);
        // If renderTrigger is true and we have chart update capability, trigger it
        if (renderTrigger && actions?.updateQueryFormData) {
          actions.updateQueryFormData({ [field]: val }, false);
        }
      } else if (onChange) {
        onChange(field, val);
      }
    };

  // Make sure we have valid values or defaults
  const formValues = form_data || value || {};

  return (
    <div style={{ padding: '16px', width: '100%' }}>
      <div>
        {/* Query Section */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ marginBottom: 16 }}>{t('Query')}</h4>
          <div style={{ marginBottom: 16 }}>
            <div>
              <div style={{ marginBottom: '8px' }}>
                <strong>{t('Group by')}</strong>
              </div>
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
                <div
                  style={{
                    padding: '10px',
                    borderRadius: '4px',
                  }}
                >
                  {t('No columns available. Please select a dataset first.')}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>{t('Metric')}</strong>
              </div>
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
                <div
                  style={{
                    padding: '10px',
                    borderRadius: '4px',
                  }}
                >
                  {t('No metrics available.')}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>{t('Filters')}</strong>
              </div>
              {safeDataSource && safeColumns.length > 0 ? (
                <DndFilterSelect
                  value={formValues.adhoc_filters || []}
                  onChange={handleChange('adhoc_filters')}
                  datasource={safeDataSource}
                  columns={safeColumns}
                  formData={formValues}
                  name="adhoc_filters"
                  savedMetrics={safeMetrics}
                  selectedMetrics={[]}
                  type="DndFilterSelect"
                  actions={actions}
                />
              ) : (
                <div
                  style={{
                    padding: '10px',
                    borderRadius: '4px',
                  }}
                >
                  {t('No columns available for filtering.')}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
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

        {/* Chart Options */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ marginBottom: 16 }}>{t('Chart Options')}</h4>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              {(() => {
                const colorSchemeControl = SharedColorSchemeControl();
                const { hidden, ...cleanConfig } = colorSchemeControl.config || {};
                return (
                  <Control
                    {...cleanConfig}
                    name="color_scheme"
                    value={formValues.color_scheme}
                    actions={{
                      ...actions,
                      setControlValue: (field: string, val: any) => {
                        handleChange('color_scheme', true)(val);
                      },
                    }}
                    renderTrigger
                    label={t('Color Scheme')}
                    description={t('Select color scheme for the chart')}
                  />
                );
              })()}
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <ControlHeader
                label={t('Outer Radius')}
                description={t('Outer edge of the pie/donut')}
                renderTrigger
                hovered
              />
              <SliderControl
                value={formValues.outerRadius || 70}
                onChange={handleChange('outerRadius', true)}
                name="outerRadius"
                renderTrigger
                {...{ min: 10, max: 100, step: 1 }}
              />
            </div>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <CheckboxControl
                label={t('Donut')}
                description={t('Do you want a donut or a pie?')}
                value={formValues.donut || false}
                onChange={handleChange('donut', true)}
                renderTrigger
                hovered
              />
            </div>
          </div>

          {formValues.donut && (
            <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <ControlHeader
                  label={t('Inner Radius')}
                  description={t('Inner radius of donut hole')}
                  renderTrigger
                  hovered
                />
                <SliderControl
                  value={formValues.innerRadius || 30}
                  onChange={handleChange('innerRadius', true)}
                  name="innerRadius"
                  renderTrigger
                  {...{ min: 0, max: 100, step: 1 }}
                />
            )}

          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <CheckboxControl
                label={t('Show Labels')}
                description={t('Whether to display labels on the pie slices')}
                value={formValues.show_labels ?? true}
                onChange={handleChange('show_labels', true)}
                renderTrigger
                hovered
              />
            </div>
          </div>

          {formValues.show_labels && (
            <>
              <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <CheckboxControl
                    label={t('Put Labels Outside')}
                    description={t('Put the labels outside of the pie slices')}
                    value={formValues.labels_outside ?? true}
                    onChange={handleChange('labels_outside', true)}
                    renderTrigger
                    hovered
                  />

              <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <CheckboxControl
                    label={t('Label Line')}
                    description={t('Draw a line from the label to the slice')}
                    value={formValues.label_line ?? false}
                    onChange={handleChange('label_line', true)}
                    renderTrigger
                    hovered
                  />
                  </>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <CheckboxControl
                label={t('Show Legend')}
                description={t('Whether to display a legend for the chart')}
                value={formValues.show_legend ?? true}
                onChange={handleChange('show_legend', true)}
                renderTrigger
                hovered
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Mark this component as a modern panel so the renderer knows how to handle it
 */
(PieControlPanel as any).isModernPanel = true;

console.log(
  'PieControlPanelSimple.tsx - Component defined, isModernPanel:',
  (PieControlPanel as any).isModernPanel,
);

// For now, we need to provide a minimal config structure to prevent errors
// This is a temporary bridge until the system fully supports pure React panels
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[PieControlPanel as any]],
    },
  ],
  // Provide default control overrides to prevent undefined errors
  controlOverrides: {
    groupby: {
      default: [],
      label: t('Group by'),
      description: t('Columns to group by'),
    },
    metric: {
      default: null,
      label: t('Metric'),
      description: t('Metric to calculate'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
      description: t('Filters to apply'),
    },
    row_limit: {
      default: 100,
      label: t('Row limit'),
      description: t('Number of rows to display'),
    },
    sort_by_metric: {
      default: true,
      label: t('Sort by metric'),
      description: t('Sort results by metric value'),
    },
    color_scheme: {
      default: 'supersetColors',
      label: t('Color scheme'),
      description: t('Color scheme for the chart'),
      renderTrigger: true,
    },
    // Add more control defaults that Pie chart might expect
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
    labels_outside: {
      default: true,
      label: t('Put labels outside'),
      renderTrigger: true,
    },
    label_type: {
      default: 'key',
      label: t('Label type'),
      renderTrigger: true,
    },
    label_line: {
      default: false,
      label: t('Label line'),
      renderTrigger: true,
    },
    show_legend: {
      default: true,
      label: t('Show legend'),
      renderTrigger: true,
    },
    legendType: {
      default: 'scroll',
      label: t('Legend type'),
      renderTrigger: true,
    },
    legendOrientation: {
      default: 'top',
      label: t('Legend orientation'),
      renderTrigger: true,
    },
    outerRadius: {
      default: 70,
      label: t('Outer radius'),
      renderTrigger: true,
    },
    innerRadius: {
      default: 30,
      label: t('Inner radius'),
      renderTrigger: true,
    },
  },
};

// Export the config with the component embedded
export default config;
