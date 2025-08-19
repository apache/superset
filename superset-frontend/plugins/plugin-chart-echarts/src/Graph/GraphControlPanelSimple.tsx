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
} from '@superset-ui/chart-controls';
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import RadioButtonControl from '../../../../packages/superset-ui-chart-controls/src/shared-controls/components/RadioButtonControl';
import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import SliderControl from '../../../../src/explore/components/controls/SliderControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Control from '../../../../src/explore/components/Control';
import { DEFAULT_FORM_DATA } from './types';

interface GraphControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Graph charts.
 */
export const GraphControlPanel: FC<GraphControlPanelProps> = ({
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

  // Helper for single column selection (source/target expect single values)
  const handleSingleColumnChange = (field: string) => (val: any) => {
    const singleValue = Array.isArray(val) ? val[0] : val;
    if (actions?.setControlValue) {
      actions.setControlValue(field, singleValue);
    } else if (onChange) {
      onChange(field, singleValue);
    }
  };

  // Get form values
  const formValues = form_data || value || {};

  // Check if force layout is selected
  const isForceLayout = formValues.layout === 'force' || (!formValues.layout && DEFAULT_FORM_DATA.layout === 'force');

  // Data tab content
  const dataTabContent = (
    <div>
      {/* Source */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Source')}
          description={t('Name of the source nodes')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.source ? [formValues.source] : []}
            onChange={handleSingleColumnChange('source')}
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

      {/* Target */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Target')}
          description={t('Name of the target nodes')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.target ? [formValues.target] : []}
            onChange={handleSingleColumnChange('target')}
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
            {t('No columns available for target.')}
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

      {/* Source Category */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Source category')}
          description={t('The category of source nodes used to assign colors. If a node is associated with more than one category, only the first will be used.')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.source_category ? [formValues.source_category] : []}
            onChange={handleSingleColumnChange('source_category')}
            options={safeColumns}
            name="source_category"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select source category')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available for source category.')}
          </div>
        )}
      </div>

      {/* Target Category */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Target category')}
          description={t('Category of target nodes')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={formValues.target_category ? [formValues.target_category] : []}
            onChange={handleSingleColumnChange('target_category')}
            options={safeColumns}
            name="target_category"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select target category')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available for target category.')}
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

      {/* Row limit */}
      <div style={{ marginBottom: 16 }}>
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

        {/* Show Legend */}
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

      {/* Layout Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Layout')}</h4>

        {/* Graph Layout */}
        <div style={{ marginBottom: 16 }}>
          <RadioButtonControl
            label={t('Graph layout')}
            description={t('Layout type of graph')}
            value={formValues.layout || DEFAULT_FORM_DATA.layout}
            onChange={handleChange('layout')}
            options={[
              ['force', t('Force')],
              ['circular', t('Circular')],
            ]}
            renderTrigger
            hovered
          />
        </div>

        {/* Edge Symbols */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Edge symbols')}
            description={t('Symbol of two ends of edge line')}
            value={formValues.edgeSymbol || DEFAULT_FORM_DATA.edgeSymbol}
            onChange={handleChange('edgeSymbol')}
            choices={[
              ['none,none', t('None -> None')],
              ['none,arrow', t('None -> Arrow')],
              ['circle,arrow', t('Circle -> Arrow')],
              ['circle,circle', t('Circle -> Circle')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Enable node dragging - Only for force layout */}
        {isForceLayout && (
          <div style={{ marginBottom: 16 }}>
            <CheckboxControl
              label={t('Enable node dragging')}
              description={t('Whether to enable node dragging in force layout mode.')}
              value={formValues.draggable ?? DEFAULT_FORM_DATA.draggable}
              onChange={handleChange('draggable')}
              renderTrigger
              hovered
            />
          </div>
        )}

        {/* Enable graph roaming */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Enable graph roaming')}
            description={t('Whether to enable changing graph position and scaling.')}
            value={formValues.roam ?? DEFAULT_FORM_DATA.roam}
            onChange={handleChange('roam')}
            choices={[
              [false, t('Disabled')],
              ['scale', t('Scale only')],
              ['move', t('Move only')],
              [true, t('Scale and Move')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Node select mode */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Node select mode')}
            description={t('Allow node selections')}
            value={formValues.selectedMode ?? DEFAULT_FORM_DATA.selectedMode}
            onChange={handleChange('selectedMode')}
            choices={[
              [false, t('Disabled')],
              ['single', t('Single')],
              ['multiple', t('Multiple')],
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Label threshold */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Label threshold')}
            description={t('Minimum value for label to be displayed on graph.')}
            hovered
          />
          <TextControl
            value={formValues.showSymbolThreshold ?? DEFAULT_FORM_DATA.showSymbolThreshold}
            onChange={handleChange('showSymbolThreshold')}
            isInt
            placeholder="0"
            controlId="showSymbolThreshold"
          />
        </div>

        {/* Node and Edge Sizes */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('Node size')}
              description={t('Median node size, the largest node will be 4 times larger than the smallest')}
              hovered
            />
            <TextControl
              value={formValues.baseNodeSize ?? DEFAULT_FORM_DATA.baseNodeSize}
              onChange={handleChange('baseNodeSize')}
              isFloat
              placeholder="20"
              controlId="baseNodeSize"
            />
          </div>
          <div style={{ flex: 1 }}>
            <ControlHeader
              label={t('Edge width')}
              description={t('Median edge width, the thickest edge will be 4 times thicker than the thinnest.')}
              hovered
            />
            <TextControl
              value={formValues.baseEdgeWidth ?? DEFAULT_FORM_DATA.baseEdgeWidth}
              onChange={handleChange('baseEdgeWidth')}
              isFloat
              placeholder="3"
              controlId="baseEdgeWidth"
            />
          </div>
        </div>

        {/* Force Layout Options - Only show when force layout is selected */}
        {isForceLayout && (
          <>
            {/* Edge length */}
            <div style={{ marginBottom: 16 }}>
              <ControlHeader
                label={t('Edge length')}
                description={t('Edge length between nodes')}
                renderTrigger
                hovered
              />
              <SliderControl
                value={formValues.edgeLength ?? DEFAULT_FORM_DATA.edgeLength}
                onChange={handleChange('edgeLength')}
                {...{ min: 100, max: 1000, step: 50 }}
              />
            </div>

            {/* Gravity */}
            <div style={{ marginBottom: 16 }}>
              <ControlHeader
                label={t('Gravity')}
                description={t('Strength to pull the graph toward center')}
                renderTrigger
                hovered
              />
              <SliderControl
                value={formValues.gravity ?? DEFAULT_FORM_DATA.gravity}
                onChange={handleChange('gravity')}
                {...{ min: 0.1, max: 1, step: 0.1 }}
              />
            </div>

            {/* Repulsion */}
            <div style={{ marginBottom: 16 }}>
              <ControlHeader
                label={t('Repulsion')}
                description={t('Repulsion strength between nodes')}
                renderTrigger
                hovered
              />
              <SliderControl
                value={formValues.repulsion ?? DEFAULT_FORM_DATA.repulsion}
                onChange={handleChange('repulsion')}
                {...{ min: 100, max: 3000, step: 50 }}
              />
            </div>

            {/* Friction */}
            <div style={{ marginBottom: 16 }}>
              <ControlHeader
                label={t('Friction')}
                description={t('Friction between nodes')}
                renderTrigger
                hovered
              />
              <SliderControl
                value={formValues.friction ?? DEFAULT_FORM_DATA.friction}
                onChange={handleChange('friction')}
                {...{ min: 0.1, max: 1, step: 0.1 }}
              />
            </div>
          </>
        )}
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
          {t('Graph Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Visualize connections between entities in a graph structure')}
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
(GraphControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[GraphControlPanel as any]],
    },
  ],
  controlOverrides: {
    source: {
      default: '',
      label: t('Source'),
    },
    target: {
      default: '',
      label: t('Target'),
    },
    metric: {
      default: null,
      label: t('Metric'),
    },
    source_category: {
      default: null,
      label: t('Source category'),
    },
    target_category: {
      default: null,
      label: t('Target category'),
    },
    adhoc_filters: {
      default: [],
      label: t('Filters'),
    },
    row_limit: {
      default: 1000,
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
    layout: {
      default: DEFAULT_FORM_DATA.layout,
      label: t('Graph layout'),
      renderTrigger: true,
    },
    edgeSymbol: {
      default: DEFAULT_FORM_DATA.edgeSymbol,
      label: t('Edge symbols'),
      renderTrigger: true,
    },
    draggable: {
      default: DEFAULT_FORM_DATA.draggable,
      label: t('Enable node dragging'),
      renderTrigger: true,
    },
    roam: {
      default: DEFAULT_FORM_DATA.roam,
      label: t('Enable graph roaming'),
      renderTrigger: true,
    },
    selectedMode: {
      default: DEFAULT_FORM_DATA.selectedMode,
      label: t('Node select mode'),
      renderTrigger: true,
    },
    showSymbolThreshold: {
      default: DEFAULT_FORM_DATA.showSymbolThreshold,
      label: t('Label threshold'),
      renderTrigger: true,
    },
    baseNodeSize: {
      default: DEFAULT_FORM_DATA.baseNodeSize,
      label: t('Node size'),
      renderTrigger: true,
    },
    baseEdgeWidth: {
      default: DEFAULT_FORM_DATA.baseEdgeWidth,
      label: t('Edge width'),
      renderTrigger: true,
    },
    edgeLength: {
      default: DEFAULT_FORM_DATA.edgeLength,
      label: t('Edge length'),
      renderTrigger: true,
    },
    gravity: {
      default: DEFAULT_FORM_DATA.gravity,
      label: t('Gravity'),
      renderTrigger: true,
    },
    repulsion: {
      default: DEFAULT_FORM_DATA.repulsion,
      label: t('Repulsion'),
      renderTrigger: true,
    },
    friction: {
      default: DEFAULT_FORM_DATA.friction,
      label: t('Friction'),
      renderTrigger: true,
    },
  },
};

export default config;
