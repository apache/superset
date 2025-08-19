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
  D3_TIME_FORMAT_OPTIONS,
  D3_FORMAT_OPTIONS,
  D3_TIME_FORMAT_DOCS,
  TimeShiftColorControl,
  YAxisFormatControl,
  CurrencyFormatControl,
  ZoomableControl,
} from '@superset-ui/chart-controls';

// Direct component imports
import { DndColumnSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../../src/explore/components/controls/TextControl';
import CheckboxControl from '../../../../../src/explore/components/controls/CheckboxControl';
import SliderControl from '../../../../../src/explore/components/controls/SliderControl';
import SelectControl from '../../../../../src/explore/components/controls/SelectControl';
import ControlHeader from '../../../../../src/explore/components/ControlHeader';
import Control from '../../../../../src/explore/components/Control';

import { TIME_SERIES_DESCRIPTION_TEXT } from '../../constants';

interface ScatterControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

export const ScatterControlPanel: FC<ScatterControlPanelProps> = ({
  onChange,
  value,
  datasource,
  form_data,
  actions,
  controls,
}) => {
  // State hooks must be called before any early returns
  const [activeTab, setActiveTab] = useState('data');

  // Safety checks for datasource
  if (!datasource || !form_data) {
    return <div>Loading control panel...</div>;
  }

  // Ensure safe data structures
  const safeColumns = Array.isArray(datasource?.columns) ? datasource.columns : [];
  const safeMetrics = Array.isArray(datasource?.metrics) ? datasource.metrics : [];

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
      {/* Query section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Query')}</h4>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('X-axis')}
            description={t('Dimension to use on x-axis.')}
            hovered
          />
          <DndColumnSelect
            value={formValues.x_axis ? [formValues.x_axis] : []}
            onChange={(val: any) => handleChange('x_axis')(Array.isArray(val) ? val[0] : val)}
            options={safeColumns}
            name="x_axis"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Time column')}
            type="DndColumnSelect"
            actions={actions}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Metrics')}
            description={t('One or many metrics to display')}
            hovered
          />
          <DndMetricSelect
            value={formValues.metrics || []}
            onChange={handleChange('metrics')}
            datasource={datasource}
            name="metrics"
            label=""
            multi
            savedMetrics={safeMetrics}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Group by')}
            description={t('One or many columns to group by')}
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

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Filters')}
            description={t('Filters to apply to the chart')}
            hovered
          />
          <DndFilterSelect
            value={formValues.adhoc_filters || []}
            onChange={handleChange('adhoc_filters')}
            datasource={datasource}
            columns={safeColumns}
            formData={formValues}
            name="adhoc_filters"
            savedMetrics={safeMetrics}
            selectedMetrics={formValues.metrics ? formValues.metrics : []}
            type="DndFilterSelect"
            actions={actions}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Row limit')}
            description={t('Limits the number of rows that get displayed.')}
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
      </div>

      {/* Time options */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Time Options')}</h4>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Time grain')}
            description={t('The time granularity for the visualization')}
            hovered
          />
          <SelectControl
            value={formValues.time_grain_sqla}
            onChange={handleChange('time_grain_sqla')}
            choices={datasource?.time_grain_sqla_choices || []}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Time range')}
            description={t('The time range for the visualization')}
            hovered
          />
          <TextControl
            value={formValues.time_range}
            onChange={handleChange('time_range')}
            placeholder="Last week"
            controlId="time_range"
          />
        </div>
      </div>
    </div>
  );

  const customizeTabContent = (
    <div>
      {/* Chart Options */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Chart Options')}</h4>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Color scheme')}
            description={t('Color scheme for the chart')}
            hovered
          />
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

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Time shift color')}
            description={t('Color scheme for time shift comparison')}
            hovered
          />
          {(() => {
            const timeShiftColorControl = TimeShiftColorControl();
            const { hidden, ...cleanConfig } = timeShiftColorControl.config || {};
            return (
              <Control
                {...cleanConfig}
                name="time_shift_color"
                value={formValues.time_shift_color}
                actions={{
                  ...actions,
                  setControlValue: (field: string, val: any) => {
                    handleChange('time_shift_color')(val);
                  },
                }}
                renderTrigger
              />
            );
          })()}
        </div>

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

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Marker')}
            description={t('Draw a marker on data points. Only applicable for line types.')}
            value={formValues.markerEnabled ?? true}
            onChange={handleChange('markerEnabled')}
            renderTrigger
            hovered
          />
        </div>

        {formValues.markerEnabled && (
          <div style={{ marginBottom: 16 }}>
            <SliderControl
              label={t('Marker Size')}
              description={t('Size of marker. Also applies to forecast observations.')}
              value={formValues.markerSize ?? 6}
              onChange={handleChange('markerSize')}
              {...{ min: 0, max: 100, step: 1 }}
              renderTrigger
            />
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Minor Ticks')}
            description={t('Show minor ticks on axes')}
            value={formValues.minorTicks ?? false}
            onChange={handleChange('minorTicks')}
            renderTrigger
            hovered
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Zoomable')}
            description={t('Enable zooming')}
            value={formValues.zoomable ?? false}
            onChange={handleChange('zoomable')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Legend */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Legend')}</h4>

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

        {formValues.show_legend && (
          <>
            <div style={{ marginBottom: 16 }}>
              <SelectControl
                label={t('Type')}
                description={t('Legend type')}
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

            <div style={{ marginBottom: 16 }}>
              <SelectControl
                label={t('Orientation')}
                description={t('Legend Orientation')}
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

            <div style={{ marginBottom: 16 }}>
              <TextControl
                label={t('Margin')}
                description={t('Additional padding for legend.')}
                value={formValues.legendMargin}
                onChange={handleChange('legendMargin')}
                isInt
                controlId="legendMargin"
              />
            </div>
          </>
        )}
      </div>

      {/* X Axis */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('X Axis')}</h4>

        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Time format')}
            description={`${D3_TIME_FORMAT_DOCS}. ${TIME_SERIES_DESCRIPTION_TEXT}`}
            value={formValues.x_axis_time_format || 'smart_date'}
            onChange={handleChange('x_axis_time_format')}
            choices={D3_TIME_FORMAT_OPTIONS}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <SliderControl
            label={t('Label rotation')}
            description={t('Rotation angle for axis labels')}
            value={formValues.xAxisLabelRotation ?? 0}
            onChange={handleChange('xAxisLabelRotation')}
            {...{ min: -90, max: 90, step: 15 }}
            renderTrigger
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <TextControl
            label={t('Label interval')}
            description={t('Interval for axis labels')}
            value={formValues.xAxisLabelInterval}
            onChange={handleChange('xAxisLabelInterval')}
            controlId="xAxisLabelInterval"
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Truncate X Axis')}
            description={t('Truncate X Axis. Can be overridden by specifying a min or max bound.')}
            value={formValues.truncateXAxis ?? true}
            onChange={handleChange('truncateXAxis')}
            renderTrigger
            hovered
          />
        </div>

        {formValues.truncateXAxis && (
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('X Axis Bounds')}
              description={t('Bounds for the X-axis. When left empty, the bounds are dynamically defined based on the min/max of the data.')}
              hovered
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <TextControl
                value={formValues.x_axis_bounds?.[0]}
                onChange={(val: any) => {
                  const bounds = formValues.x_axis_bounds || [null, null];
                  handleChange('x_axis_bounds')([val, bounds[1]]);
                }}
                placeholder="Min"
                controlId="x_axis_bounds_min"
              />
              <TextControl
                value={formValues.x_axis_bounds?.[1]}
                onChange={(val: any) => {
                  const bounds = formValues.x_axis_bounds || [null, null];
                  handleChange('x_axis_bounds')([bounds[0], val]);
                }}
                placeholder="Max"
                controlId="x_axis_bounds_max"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tooltip */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Tooltip')}</h4>

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Rich tooltip')}
            description={t('Shows a list of all series available at that point in time')}
            value={formValues.rich_tooltip ?? true}
            onChange={handleChange('rich_tooltip')}
            renderTrigger
            hovered
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Tooltip time format')}
            description={t('Time format for tooltip')}
            value={formValues.tooltipTimeFormat || 'smart_date'}
            onChange={handleChange('tooltipTimeFormat')}
            choices={D3_TIME_FORMAT_OPTIONS}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show total')}
            description={t('Display total value in tooltip')}
            value={formValues.showTooltipTotal ?? false}
            onChange={handleChange('showTooltipTotal')}
            renderTrigger
            hovered
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Show percentage')}
            description={t('Show percentage in tooltip')}
            value={formValues.showTooltipPercentage ?? false}
            onChange={handleChange('showTooltipPercentage')}
            renderTrigger
            hovered
          />
        </div>
      </div>

      {/* Y Axis */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Y Axis')}</h4>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Y axis format')}
            description={t('Format for Y axis values')}
            hovered
          />
          {(() => {
            const yAxisFormatControl = YAxisFormatControl();
            const { hidden, ...cleanConfig } = yAxisFormatControl.config || {};
            return (
              <Control
                {...cleanConfig}
                name="y_axis_format"
                value={formValues.y_axis_format}
                actions={{
                  ...actions,
                  setControlValue: (field: string, val: any) => {
                    handleChange('y_axis_format')(val);
                  },
                }}
                renderTrigger
              />
            );
          })()}
        </div>

        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Currency format')}
            description={t('Format for currency values')}
            hovered
          />
          {(() => {
            const currencyFormatControl = CurrencyFormatControl();
            const { hidden, ...cleanConfig } = currencyFormatControl.config || {};
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

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Logarithmic y-axis')}
            description={t('Logarithmic y-axis')}
            value={formValues.logAxis ?? false}
            onChange={handleChange('logAxis')}
            renderTrigger
            hovered
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Minor Split Line')}
            description={t('Draw split lines for minor y-axis ticks')}
            value={formValues.minorSplitLine ?? false}
            onChange={handleChange('minorSplitLine')}
            renderTrigger
            hovered
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <CheckboxControl
            label={t('Truncate Y Axis')}
            description={t('Truncate Y Axis. Can be overridden by specifying a min or max bound.')}
            value={formValues.truncateYAxis ?? false}
            onChange={handleChange('truncateYAxis')}
            renderTrigger
            hovered
          />
        </div>

        {formValues.truncateYAxis && (
          <div style={{ marginBottom: 16 }}>
            <ControlHeader
              label={t('Y Axis Bounds')}
              description={t('Bounds for the Y-axis. When left empty, the bounds are dynamically defined based on the min/max of the data.')}
              hovered
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <TextControl
                value={formValues.y_axis_bounds?.[0]}
                onChange={(val: any) => {
                  const bounds = formValues.y_axis_bounds || [null, null];
                  handleChange('y_axis_bounds')([val, bounds[1]]);
                }}
                placeholder="Min"
                controlId="y_axis_bounds_min"
              />
              <TextControl
                value={formValues.y_axis_bounds?.[1]}
                onChange={(val: any) => {
                  const bounds = formValues.y_axis_bounds || [null, null];
                  handleChange('y_axis_bounds')([bounds[0], val]);
                }}
                placeholder="Max"
                controlId="y_axis_bounds_max"
              />
            </div>
          </div>
        )}
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
(ScatterControlPanel as any).isModernPanel = true;

// Export wrapper config for compatibility
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[ScatterControlPanel as any]],
    },
  ],
  controlOverrides: {
    row_limit: {
      default: 10000,
      label: t('Row limit'),
      renderTrigger: true,
    },
    markerEnabled: {
      default: true,
      label: t('Marker'),
      renderTrigger: true,
    },
    markerSize: {
      default: 6,
      label: t('Marker Size'),
      renderTrigger: true,
    },
    show_value: {
      default: false,
      label: t('Show Value'),
      renderTrigger: true,
    },
    logAxis: {
      default: false,
      label: t('Logarithmic y-axis'),
      renderTrigger: true,
    },
    minorSplitLine: {
      default: false,
      label: t('Minor Split Line'),
      renderTrigger: true,
    },
    truncateXAxis: {
      default: true,
      label: t('Truncate X Axis'),
      renderTrigger: true,
    },
    truncateYAxis: {
      default: false,
      label: t('Truncate Y Axis'),
      renderTrigger: true,
    },
    x_axis_time_format: {
      default: 'smart_date',
      label: t('Time format'),
      renderTrigger: true,
    },
    rich_tooltip: {
      default: true,
      label: t('Rich tooltip'),
      renderTrigger: true,
    },
    tooltipTimeFormat: {
      default: 'smart_date',
      label: t('Tooltip time format'),
      renderTrigger: true,
    },
    zoomable: {
      default: false,
      label: t('Zoomable'),
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
    minorTicks: {
      default: false,
      label: t('Minor Ticks'),
      renderTrigger: true,
    },
  },
};

export default config;
