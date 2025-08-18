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
import SliderControl from '../../../../src/explore/components/controls/SliderControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import CurrencyControl from '../../../../src/explore/components/controls/CurrencyControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';

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

        {/* Threshold for Other */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Threshold for Other')}
            description={t(
              'Values less than this percentage will be grouped into the Other category.',
            )}
            renderTrigger
            hovered
          />
          <TextControl
            value={formValues.threshold_for_other ?? 0}
            onChange={handleChange('threshold_for_other')}
            isFloat
            placeholder="0"
            controlId="threshold_for_other"
          />
        </div>

        {/* Rose Type (Nightingale chart) */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Rose Type')}
            description={t('Whether to show as Nightingale chart.')}
            value={formValues.roseType || null}
            onChange={handleChange('roseType')}
            choices={[
              ['area', t('Area')],
              ['radius', t('Radius')],
              [null, t('None')],
            ]}
            clearable={false}
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

      {/* Labels Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Labels')}</h4>

        {/* Label Type */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Label Type')}
            description={t('What should be shown on the label?')}
            value={formValues.label_type || 'key'}
            onChange={handleChange('label_type')}
            choices={[
              ['key', t('Category Name')],
              ['value', t('Value')],
              ['percent', t('Percentage')],
              ['key_value', t('Category and Value')],
              ['key_percent', t('Category and Percentage')],
              ['key_value_percent', t('Category, Value and Percentage')],
              ['value_percent', t('Value and Percentage')],
              ['template', t('Template')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Label Template - CONDITIONAL */}
        {formValues.label_type === 'template' && (
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Label Template')}
              description={t(
                'Format data labels. Use variables: {name}, {value}, {percent}. \\n represents a new line. ECharts compatibility: {a} (series), {b} (name), {c} (value), {d} (percentage)',
              )}
              renderTrigger
              hovered
            />
            <TextControl
              value={formValues.label_template || ''}
              onChange={handleChange('label_template')}
              placeholder="{name}: {value}"
              controlId="label_template"
            />
          </div>
        )}

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
            value={formValues.date_format || 'smart_date'}
            onChange={handleChange('date_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>

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

        {/* Put labels outside - CONDITIONAL */}
        {formValues.show_labels && (
          <>
            <div style={{ marginBottom: 16 }}>
              <CheckboxControl
                label={t('Put labels outside')}
                description={t('Put the labels outside of the pie?')}
                value={formValues.labels_outside ?? true}
                onChange={handleChange('labels_outside')}
                renderTrigger
                hovered
              />
            </div>

            {/* Label Line - CONDITIONAL */}
            <div style={{ marginBottom: 16 }}>
              <CheckboxControl
                label={t('Label Line')}
                description={t(
                  'Draw line from Pie to label when labels outside?',
                )}
                value={formValues.label_line ?? false}
                onChange={handleChange('label_line')}
                renderTrigger
                hovered
              />
            </div>
          </>
        )}

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
      </div>

      {/* Pie shape Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Pie shape')}</h4>

        {/* Outer Radius Slider */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Outer Radius')}
            description={t('Outer edge of Pie chart')}
            renderTrigger
            hovered
          />
          <SliderControl
            value={formValues.outerRadius || 70}
            onChange={handleChange('outerRadius')}
            {...{ min: 10, max: 100, step: 1 }}
          />
        </div>

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

        {/* Inner Radius Slider - CONDITIONAL */}
        {formValues.donut && (
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Inner Radius')}
              description={t('Inner radius of donut hole')}
              renderTrigger
              hovered
            />
            <SliderControl
              value={formValues.innerRadius || 30}
              onChange={handleChange('innerRadius')}
              {...{ min: 0, max: 100, step: 1 }}
            />
          </div>
        )}
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
    show_labels_threshold: {
      default: 5,
      label: t('Percentage threshold'),
      renderTrigger: true,
    },
    threshold_for_other: {
      default: 0,
      label: t('Threshold for Other'),
      renderTrigger: true,
    },
    roseType: {
      default: null,
      label: t('Rose Type'),
      renderTrigger: true,
    },
    label_type: {
      default: 'key',
      label: t('Label Type'),
      renderTrigger: true,
    },
    label_template: {
      default: '',
      label: t('Label Template'),
      renderTrigger: true,
    },
    number_format: {
      default: 'SMART_NUMBER',
      label: t('Number format'),
      renderTrigger: true,
    },
    currency_format: {
      default: undefined,
      label: t('Currency format'),
      renderTrigger: true,
    },
    date_format: {
      default: 'smart_date',
      label: t('Date format'),
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
    label_line: {
      default: false,
      label: t('Label Line'),
      renderTrigger: true,
    },
    show_total: {
      default: false,
      label: t('Show Total'),
      renderTrigger: true,
    },
    outerRadius: {
      default: 70,
      label: t('Outer Radius'),
      renderTrigger: true,
    },
    donut: {
      default: false,
      label: t('Donut'),
      renderTrigger: true,
    },
    innerRadius: {
      default: 30,
      label: t('Inner Radius'),
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
