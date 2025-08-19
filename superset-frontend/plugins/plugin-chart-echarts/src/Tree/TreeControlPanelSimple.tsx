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
import { DndColumnSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndColumnSelect';
import { DndMetricSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndMetricSelect';
import { DndFilterSelect } from '../../../../src/explore/components/controls/DndColumnSelectControl/DndFilterSelect';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import SelectControl from '../../../../src/explore/components/controls/SelectControl';
import SliderControl from '../../../../src/explore/components/controls/SliderControl';
import { RadioButtonControl } from '@superset-ui/chart-controls';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import { DEFAULT_FORM_DATA } from './constants';

interface TreeControlPanelProps {
  onChange?: (field: string, value: any) => void;
  value?: Record<string, any>;
  datasource?: any;
  actions?: any;
  controls?: any;
  form_data?: any;
}

/**
 * A modern React component-based control panel for Tree charts.
 */
export const TreeControlPanel: FC<TreeControlPanelProps> = ({
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

  // Helper to get single column value
  const getSingleColumnValue = (field: string) => {
    const val = formValues[field];
    return Array.isArray(val) ? val[0] : val;
  };

  // Helper to set single column value
  const handleSingleColumnChange = (field: string) => (val: any) => {
    const value = Array.isArray(val) ? val[0] : val;
    handleChange(field)(value);
  };

  // Data tab content
  const dataTabContent = (
    <div>
      {/* ID Column */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Id')}
          description={t('Name of the id column')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={getSingleColumnValue('id') ? [getSingleColumnValue('id')] : []}
            onChange={handleSingleColumnChange('id')}
            options={safeColumns}
            name="id"
            label=""
            multi={false}
            canDelete={false}
            ghostButtonText={t('Select column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available. Please select a dataset first.')}
          </div>
        )}
      </div>

      {/* Parent Column */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Parent')}
          description={t('Name of the column containing the id of the parent node')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={getSingleColumnValue('parent') ? [getSingleColumnValue('parent')] : []}
            onChange={handleSingleColumnChange('parent')}
            options={safeColumns}
            name="parent"
            label=""
            multi={false}
            canDelete={false}
            ghostButtonText={t('Select column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available. Please select a dataset first.')}
          </div>
        )}
      </div>

      {/* Name Column (Optional) */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Name')}
          description={t('Optional name of the data column.')}
          hovered
        />
        {safeColumns.length > 0 ? (
          <DndColumnSelect
            value={getSingleColumnValue('name') ? [getSingleColumnValue('name')] : []}
            onChange={handleSingleColumnChange('name')}
            options={safeColumns}
            name="name"
            label=""
            multi={false}
            canDelete
            ghostButtonText={t('Select column')}
            type="DndColumnSelect"
            actions={actions}
          />
        ) : (
          <div style={{ padding: '10px' }}>
            {t('No columns available. Please select a dataset first.')}
          </div>
        )}
      </div>

      {/* Root Node ID */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Root node id')}
          description={t('Id of root node of the tree.')}
          hovered
        />
        <TextControl
          value={formValues.root_node_id || formValues.rootNodeId || ''}
          onChange={handleChange('root_node_id')}
          placeholder=""
          controlId="root_node_id"
        />
      </div>

      {/* Metric (Optional) */}
      <div style={{ marginBottom: 16 }}>
        <ControlHeader
          label={t('Metric')}
          description={t('Metric for node values')}
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
          placeholder="100"
          controlId="row_limit"
        />
      </div>
    </div>
  );

  // Customize tab content
  const customizeTabContent = (
    <div>
      {/* Layout Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Layout')}</h4>

        {/* Tree Layout */}
        <div style={{ marginBottom: 16 }}>
          <RadioButtonControl
            label={t('Tree layout')}
            description={t('Layout type of tree')}
            value={formValues.layout || DEFAULT_FORM_DATA.layout}
            onChange={handleChange('layout')}
            options={[
              ['orthogonal', t('Orthogonal')],
              ['radial', t('Radial')],
            ]}
            hovered
          />
        </div>

        {/* Tree Orientation - only for orthogonal layout */}
        {(formValues.layout || DEFAULT_FORM_DATA.layout) === 'orthogonal' && (
          <div style={{ marginBottom: 16 }}>
            <RadioButtonControl
              label={t('Tree orientation')}
              description={t('Orientation of tree')}
              value={formValues.orient || DEFAULT_FORM_DATA.orient}
              onChange={handleChange('orient')}
              options={[
                ['LR', t('Left to Right')],
                ['RL', t('Right to Left')],
                ['TB', t('Top to Bottom')],
                ['BT', t('Bottom to Top')],
              ]}
              hovered
            />
          </div>
        )}

        {/* Node Label Position */}
        <div style={{ marginBottom: 16 }}>
          <RadioButtonControl
            label={t('Node label position')}
            description={t('Position of intermediate node label on tree')}
            value={formValues.node_label_position || formValues.nodeLabelPosition || DEFAULT_FORM_DATA.nodeLabelPosition}
            onChange={handleChange('node_label_position')}
            options={[
              ['left', t('left')],
              ['top', t('top')],
              ['right', t('right')],
              ['bottom', t('bottom')],
            ]}
            hovered
          />
        </div>

        {/* Child Label Position */}
        <div style={{ marginBottom: 16 }}>
          <RadioButtonControl
            label={t('Child label position')}
            description={t('Position of child node label on tree')}
            value={formValues.child_label_position || formValues.childLabelPosition || DEFAULT_FORM_DATA.childLabelPosition}
            onChange={handleChange('child_label_position')}
            options={[
              ['left', t('left')],
              ['top', t('top')],
              ['right', t('right')],
              ['bottom', t('bottom')],
            ]}
            hovered
          />
        </div>

        {/* Emphasis - only for orthogonal layout */}
        {(formValues.layout || DEFAULT_FORM_DATA.layout) === 'orthogonal' && (
          <div style={{ marginBottom: 16 }}>
            <RadioButtonControl
              label={t('Emphasis')}
              description={t('Which relatives to highlight on hover')}
              value={formValues.emphasis || DEFAULT_FORM_DATA.emphasis}
              onChange={handleChange('emphasis')}
              options={[
                ['ancestor', t('ancestor')],
                ['descendant', t('descendant')],
              ]}
              hovered
            />
          </div>
        )}
      </div>

      {/* Symbol Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Symbol')}</h4>

        {/* Symbol Type */}
        <div style={{ marginBottom: 16 }}>
          <SelectControl
            label={t('Symbol')}
            description={t('Node symbol type')}
            value={formValues.symbol || DEFAULT_FORM_DATA.symbol}
            onChange={handleChange('symbol')}
            choices={[
              { label: t('Empty circle'), value: 'emptyCircle' },
              { label: t('Circle'), value: 'circle' },
              { label: t('Rectangle'), value: 'rect' },
              { label: t('Triangle'), value: 'triangle' },
              { label: t('Diamond'), value: 'diamond' },
              { label: t('Pin'), value: 'pin' },
              { label: t('Arrow'), value: 'arrow' },
              { label: t('None'), value: 'none' },
            ]}
            clearable={false}
            renderTrigger
            hovered
          />
        </div>

        {/* Symbol Size */}
        <div style={{ marginBottom: 16 }}>
          <ControlHeader
            label={t('Symbol size')}
            description={t('Size of edge symbols')}
            renderTrigger
            hovered
          />
          <SliderControl
            value={formValues.symbolSize || formValues.symbol_size || DEFAULT_FORM_DATA.symbolSize}
            onChange={handleChange('symbolSize')}
            {...{ min: 5, max: 30, step: 2 }}
          />
        </div>
      </div>

      {/* Interaction Section */}
      <div style={{ marginBottom: 24 }}>
        <h4>{t('Interaction')}</h4>

        {/* Enable Graph Roaming */}
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
          {t('Tree Chart')}
        </div>
        <div style={{ fontSize: '12px', opacity: 0.65 }}>
          {t('Visualize hierarchical data as a tree structure')}
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
(TreeControlPanel as any).isModernPanel = true;

// Create a config that wraps our React component
const config = {
  controlPanelSections: [
    {
      label: null,
      expanded: true,
      controlSetRows: [[TreeControlPanel as any]],
    },
  ],
  controlOverrides: {
    id: {
      default: '',
      label: t('Id'),
    },
    parent: {
      default: '',
      label: t('Parent'),
    },
    name: {
      default: '',
      label: t('Name'),
    },
    root_node_id: {
      default: '',
      label: t('Root node id'),
      renderTrigger: true,
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
    layout: {
      default: DEFAULT_FORM_DATA.layout,
      label: t('Tree layout'),
      renderTrigger: true,
    },
    orient: {
      default: DEFAULT_FORM_DATA.orient,
      label: t('Tree orientation'),
      renderTrigger: true,
    },
    node_label_position: {
      default: DEFAULT_FORM_DATA.nodeLabelPosition,
      label: t('Node label position'),
      renderTrigger: true,
    },
    child_label_position: {
      default: DEFAULT_FORM_DATA.childLabelPosition,
      label: t('Child label position'),
      renderTrigger: true,
    },
    emphasis: {
      default: DEFAULT_FORM_DATA.emphasis,
      label: t('Emphasis'),
      renderTrigger: true,
    },
    symbol: {
      default: DEFAULT_FORM_DATA.symbol,
      label: t('Symbol'),
      renderTrigger: true,
    },
    symbolSize: {
      default: DEFAULT_FORM_DATA.symbolSize,
      label: t('Symbol size'),
      renderTrigger: true,
    },
    roam: {
      default: DEFAULT_FORM_DATA.roam,
      label: t('Enable graph roaming'),
      renderTrigger: true,
    },
  },
};

export default config;
