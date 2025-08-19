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
import {
  t,
  GenericDataType,
  validateInteger,
  validateNonEmpty,
} from '@superset-ui/core';
import { Tabs } from 'antd';
import {
  ColorSchemeControl,
  formatSelectOptionsForRange,
  columnsByType,
  D3_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';

interface HistogramControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Histogram charts.
 */
export const HistogramControlPanel: FC<HistogramControlPanelProps> = ({
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

  // Get numeric columns for the histogram column selection
  const numericColumns = columnsByType(datasource, GenericDataType.Numeric);

  // Data tab content
  const dataTabContent = (
    <div>
      {/* Column (Primary metric column) */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Column')}
          description={t('Numeric column used to calculate the histogram.')}
          hovered
        />
        {numericColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.column ? [formValues.column] : []}
            onChange={(val: any) => {
              const singleValue = Array.isArray(val) ? val[0] : val;
              handleChange('column')(singleValue);
            }}
            options={numericColumns}
            name="column"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select a numeric column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t(
              'No numeric columns available. Please select a dataset with numeric data.',
            )}
          </div>
        )}
      </div>

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
            selectedMetrics={[]}
            type="DndFilterSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available for filtering.')}
          </div>
        )}
      </div>

      {/* Row limit and Bins */}
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
          <ControlHeader
            label={t('Bins')}
            description={t('The number of bins for the histogram')}
            hovered
          />
          <SelectControl
            value={formValues.bins || 5}
            onChange={handleChange('bins')}
            choices={formatSelectOptionsForRange(5, 20, 5)}
            freeForm
            clearable={false}
            hovered
          />
        </div>
      </div>

      {/* Normalize and Cumulative */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        <div style={{ flex: 1 }}>
          <CheckboxControl
            label={t('Normalize')}
            description={t(`
              The normalize option transforms the histogram values into proportions or
              probabilities by dividing each bin's count by the total count of data points.
              This normalization process ensures that the resulting values sum up to 1,
              enabling a relative comparison of the data's distribution and providing a
              clearer understanding of the proportion of data points within each bin.`)}
            value={formValues.normalize ?? false}
            onChange={handleChange('normalize')}
            hovered
          />
        </div>
        <div style={{ flex: 1 }}>
          <CheckboxControl
            label={t('Cumulative')}
            description={t(`
              The cumulative option allows you to see how your data accumulates over different
              values. When enabled, the histogram bars represent the running total of frequencies
              up to each bin. This helps you understand how likely it is to encounter values
              below a certain point. Keep in mind that enabling cumulative doesn't change your
              original data, it just changes the way the histogram is displayed.`)}
            value={formValues.cumulative ?? false}
            onChange={handleChange('cumulative')}
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

        {/* Show Value */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Value')}
            description={t('Show series values on the chart')}
            value={formValues.show_value ?? false}
            onChange={handleChange('show_value')}
            renderTrigger
            hovered
          />
        </div>

        {/* Show Legend */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show legend')}
            description={t('Whether to display a legend for the chart')}
            value={formValues.show_legend ?? true}
            onChange={handleChange('show_legend')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Axis Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Axis')}</h4>

        {/* X Axis Title and Format */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <ControlHeader label={t('X Axis Title')} hovered />
            <TextControl
              value={formValues.x_axis_title || ''}
              onChange={handleChange('x_axis_title')}
              placeholder={t('X Axis Title')}
              controlId="x_axis_title"
            />
          </div>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('X Axis Format')}
              description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
              hovered
            />
            <SelectControl
              value={formValues.x_axis_format || 'SMART_NUMBER'}
              onChange={handleChange('x_axis_format')}
              choices={D3_FORMAT_OPTIONS}
              freeForm
              renderTrigger
              hovered
            />
          </div>
        </div>

        {/* Y Axis Title and Format */}
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <ControlHeader label={t('Y Axis Title')} hovered />
            <TextControl
              value={formValues.y_axis_title || ''}
              onChange={handleChange('y_axis_title')}
              placeholder={t('Y Axis Title')}
              controlId="y_axis_title"
            />
          </div>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('Y Axis Format')}
              description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
              hovered
            />
            <SelectControl
              value={formValues.y_axis_format || 'SMART_NUMBER'}
              onChange={handleChange('y_axis_format')}
              choices={D3_FORMAT_OPTIONS}
              freeForm
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
          {t('Histogram')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t(
            'Display the distribution of a dataset by representing the frequency or count of values within different ranges or bins',
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
(HistogramControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[HistogramControlPanel as any]],
    },
  ],
  controlOverrides: {
    column: {
      default: null,
      label: t('Column'),
      validators: [validateNonEmpty],
    },
    groupby: {
      default: [],
      label: t('Group by'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    row_limit: {
      default: 100,
      label: t('Row limit'),
    },
    bins: {
      default: 5,
      label: t('Bins'),
      validators: [validateInteger],
    },
    normalize: {
      default: false,
      label: t('Normalize'),
    },
    cumulative: {
      default: false,
      label: t('Cumulative'),
    },
    color_scheme: {
      default: 'supersetColors',
      label: t('Color scheme'),
      renderTrigger: true,
    },
    show_value: {
      default: false,
      label: t('Show Value'),
      renderTrigger: true,
    },
    show_legend: {
      default: true,
      label: t('Show legend'),
      renderTrigger: true,
    },
    x_axis_title: {
      default: '',
      label: t('X Axis Title'),
      renderTrigger: true,
    },
    x_axis_format: {
      default: 'SMART_NUMBER',
      label: t('X Axis Format'),
      renderTrigger: true,
    },
    y_axis_title: {
      default: '',
      label: t('Y Axis Title'),
      renderTrigger: true,
    },
    y_axis_format: {
      default: 'SMART_NUMBER',
      label: t('Y Axis Format'),
      renderTrigger: true,
    },
  },
};

export default config;
