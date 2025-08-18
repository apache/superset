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
  CurrencyFormatControl,
  D3_FORMAT_OPTIONS,
  D3_FORMAT_DOCS,
  D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT,
} from '@superset-ui/chart-controls';

// Direct component imports
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';

import { EchartsFunnelLabelTypeType, PercentCalcType } from './types';

interface FunnelControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

export const FunnelControlPanel: FC<FunnelControlPanelProps> = ({
  onChange,
  value,
  datasource,
  form_data,
  actions,
  controls,
}) => {
  // Tab state - must be before any early returns
  const [activeTab, setActiveTab] = useState('data');

  // Safety checks for datasource
  if (!datasource || !form_data) {
    return <div>Loading control panel...</div>;
  }

  // Ensure safe data structures
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

  // Helper for control changes
  const handleChange = (field: string) => (val: any) => {
    if (actions?.setControlValue) {
      actions.setControlValue(field, val);
    } else if (onChange) {
      onChange(field, val);
    }
  };

  // Get form values
  const formValues = form_data || value || {};

  const dataTabContent = (
    <div>
      {/* Group By */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Group by')}
          description={t('Columns to group by')}
          hovered
        />
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
      </div>

      {/* Metric */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Metric')}
          description={t('The metric for calculation')}
          hovered
        />
        <DndMetricSelect
          value={formValues.metric}
          onChange={handleChange('metric')}
          datasource={safeDataSource}
          name="metric"
          label=""
          multi={false}
          savedMetrics={safeMetrics}
        />
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Filters')}
          description={t('Filters for the dataset')}
          hovered
        />
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
      </div>

      {/* Row Limit */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Row limit')}
          description={t('Limits the number of rows')}
          hovered
        />
        <TextControl
          value={formValues.row_limit}
          onChange={handleChange('row_limit')}
          isInt
          placeholder="10"
          controlId="row_limit"
        />
      </div>

      {/* Sort by Metric */}
      <div style={{ marginBottom: 16 }}>
        <CheckboxControl
          label={t('Sort by metric')}
          description={t(
            'Whether to sort results by the selected metric in descending order.',
          )}
          value={formValues.sort_by_metric ?? true}
          onChange={handleChange('sort_by_metric')}
          renderTrigger
          hovered
        />
      </div>

      {/* Percent Calculation Type */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('% calculation')}
          description={t(
            'Display percents in the label and tooltip as the percent of the total value, from the first step of the funnel, or from the previous step in the funnel.',
          )}
          hovered
        />
        <SelectControl
          value={
            formValues.percent_calculation_type || PercentCalcType.FirstStep
          }
          onChange={handleChange('percent_calculation_type')}
          choices={[
            [PercentCalcType.FirstStep, t('Calculate from first step')],
            [PercentCalcType.PreviousStep, t('Calculate from previous step')],
            [PercentCalcType.Total, t('Percent of total')],
          ]}
          clearable={false}
          renderTrigger
          hovered
        />
      </div>
    </div>
  );

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

      {/* Legend Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Legend')}</h4>

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

        {/* Legend Type - conditional */}
        {formValues.show_legend && (
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Legend Type')}
              description={t('Legend type')}
              hovered
            />
            <SelectControl
              value={formValues.legendType || 'scroll'}
              onChange={handleChange('legendType')}
              choices={[
                ['scroll', t('Scroll')],
                ['plain', t('Plain')],
              ]}
              clearable={false}
              renderTrigger
              hovered
            />
          </div>
        )}

        {/* Legend Orientation - conditional */}
        {formValues.show_legend && (
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Legend Orientation')}
              description={t('Legend Orientation')}
              hovered
            />
            <SelectControl
              value={formValues.legendOrientation || 'top'}
              onChange={handleChange('legendOrientation')}
              choices={[
                ['top', t('Top')],
                ['bottom', t('Bottom')],
                ['left', t('Left')],
                ['right', t('Right')],
              ]}
              clearable={false}
              renderTrigger
              hovered
            />
          </div>
        )}

        {/* Legend Margin - conditional */}
        {formValues.show_legend && (
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Legend Margin')}
              description={t('Additional padding for legend.')}
              hovered
            />
            <TextControl
              value={formValues.legendMargin}
              onChange={handleChange('legendMargin')}
              isInt
              controlId="legendMargin"
            />
          </div>
        )}
      </div>

      {/* Labels Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Labels')}</h4>

        {/* Label Contents */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Label Contents')}
            description={t('What should be shown as the label')}
            hovered
          />
          <SelectControl
            value={formValues.label_type || EchartsFunnelLabelTypeType.Key}
            onChange={handleChange('label_type')}
            choices={[
              [EchartsFunnelLabelTypeType.Key, t('Category Name')],
              [EchartsFunnelLabelTypeType.Value, t('Value')],
              [EchartsFunnelLabelTypeType.Percent, t('Percentage')],
              [EchartsFunnelLabelTypeType.KeyValue, t('Category and Value')],
              [
                EchartsFunnelLabelTypeType.KeyPercent,
                t('Category and Percentage'),
              ],
              [
                EchartsFunnelLabelTypeType.KeyValuePercent,
                t('Category, Value and Percentage'),
              ],
              [
                EchartsFunnelLabelTypeType.ValuePercent,
                t('Value and Percentage'),
              ],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Tooltip Contents */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Tooltip Contents')}
            description={t('What should be shown as the tooltip label')}
            hovered
          />
          <SelectControl
            value={
              formValues.tooltip_label_type ||
              EchartsFunnelLabelTypeType.KeyValuePercent
            }
            onChange={handleChange('tooltip_label_type')}
            choices={[
              [EchartsFunnelLabelTypeType.Key, t('Category Name')],
              [EchartsFunnelLabelTypeType.Value, t('Value')],
              [EchartsFunnelLabelTypeType.Percent, t('Percentage')],
              [EchartsFunnelLabelTypeType.KeyValue, t('Category and Value')],
              [
                EchartsFunnelLabelTypeType.KeyPercent,
                t('Category and Percentage'),
              ],
              [
                EchartsFunnelLabelTypeType.KeyValuePercent,
                t('Category, Value and Percentage'),
              ],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Number Format */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Number format')}
            description={`${D3_FORMAT_DOCS} ${D3_NUMBER_FORMAT_DESCRIPTION_VALUES_TEXT}`}
            hovered
          />
          <SelectControl
            value={formValues.number_format || 'SMART_NUMBER'}
            onChange={handleChange('number_format')}
            choices={D3_FORMAT_OPTIONS}
            freeForm
            renderTrigger
            hovered
          />
        </div>

        {/* Currency Format */}
        <div style={{ marginBottom: 16 }}>
          {(() => {
            const currencyControl = CurrencyFormatControl();
            const { hidden, ...cleanConfig } = currencyControl.config || {};
            return (
              <Control
                {...cleanConfig}
                name="currency_format"
                value={formValues.currency_format}
                actions={{
                  ...actions,
                  setControlValue: (field: string, val: any) => {
                    handleChange('currency_format')(val);
                  },
                }}
                renderTrigger
              />
            );
          })()}
        </div>

        {/* Show Labels */}
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

        {/* Show Tooltip Labels */}
        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show Tooltip Labels')}
            description={t('Whether to display the tooltip labels.')}
            value={formValues.show_tooltip_labels ?? true}
            onChange={handleChange('show_tooltip_labels')}
            renderTrigger
            hovered
          />
        </div>
      </div>
    </div>
  );

  const tabItems = [
    { key: 'data', label: t('Data'), children: dataTabContent },
    { key: 'customize', label: t('Customize'), children: customizeTabContent },
  ];

  return (
    <div style={{ padding: '16px' }}>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />
    </div>
  );
};

// CRITICAL: Mark as modern panel
(FunnelControlPanel as any).isModernPanel = true;

// Export wrapper config for compatibility
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[FunnelControlPanel as any]],
    },
  ],
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
      default: 10,
      label: t('Row limit'),
      renderTrigger: true,
    },
    sort_by_metric: {
      default: true,
      label: t('Sort by metric'),
      renderTrigger: true,
    },
    percent_calculation_type: {
      default: PercentCalcType.FirstStep,
      label: t('% calculation'),
      renderTrigger: true,
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
    legendMargin: {
      default: null,
      label: t('Legend margin'),
      renderTrigger: true,
    },
    label_type: {
      default: EchartsFunnelLabelTypeType.Key,
      label: t('Label type'),
      renderTrigger: true,
    },
    tooltip_label_type: {
      default: EchartsFunnelLabelTypeType.KeyValuePercent,
      label: t('Tooltip label type'),
      renderTrigger: true,
    },
    number_format: {
      default: 'SMART_NUMBER',
      label: t('Number format'),
      renderTrigger: true,
    },
    currency_format: {
      default: null,
      label: t('Currency format'),
      renderTrigger: true,
    },
    show_labels: {
      default: true,
      label: t('Show labels'),
      renderTrigger: true,
    },
    show_tooltip_labels: {
      default: true,
      label: t('Show tooltip labels'),
      renderTrigger: true,
    },
  },
};

export default config;
