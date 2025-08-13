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
import React from 'react';
import { t } from '@superset-ui/core';
import { useFormData } from 'src/explore/hooks/useFormData';
import {
  ControlPanelSection,
  ControlRow,
  DndMetricSelect,
  AdhocFilterControl,
  SimpleTextControl as TextControl,
  SimpleSelectControl as SelectControl,
} from '@superset-ui/chart-controls';

/**
 * Big Number Total Control Panel
 * A simple React-based control panel
 */
const BigNumberControlPanel: React.FC = () => {
  console.log('BigNumberControlPanel - Rendering');
  const { formData, updateControl } = useFormData();
  console.log('BigNumberControlPanel - formData:', formData);

  return (
    <div className="control-panel">
      <ControlPanelSection title={t('Query')} expanded>
        <ControlRow>
          <DndMetricSelect
            name="metric"
            label={t('Metric')}
            description={t('The metric to display')}
            value={formData.metric}
            onChange={value => updateControl('metric', value)}
            multi={false}
            required
          />
        </ControlRow>

        <ControlRow>
          <AdhocFilterControl
            name="adhoc_filters"
            label={t('Filters')}
            value={formData.adhoc_filters || []}
            onChange={value => updateControl('adhoc_filters', value)}
          />
        </ControlRow>
      </ControlPanelSection>

      <ControlPanelSection title={t('Chart Options')} expanded>
        <ControlRow>
          <TextControl
            name="header_font_size"
            label={t('Header Font Size')}
            description={t('Font size for the header')}
            value={formData.header_font_size || '0.4'}
            onChange={value => updateControl('header_font_size', value)}
            renderTrigger
          />
        </ControlRow>

        <ControlRow>
          <TextControl
            name="subheader"
            label={t('Subheader')}
            description={t('Text to display under the main value')}
            value={formData.subheader || ''}
            onChange={value => updateControl('subheader', value)}
            renderTrigger
          />
        </ControlRow>

        <ControlRow>
          <SelectControl
            name="time_format"
            label={t('Date Format')}
            description={t('D3 time format for dates')}
            value={formData.time_format || 'smart_date'}
            onChange={value => updateControl('time_format', value)}
            choices={[
              ['smart_date', t('Adaptive Formatting')],
              ['%Y-%m-%d', 'YYYY-MM-DD'],
              ['%m/%d/%Y', 'MM/DD/YYYY'],
              ['%Y-%m-%d %H:%M:%S', 'YYYY-MM-DD HH:MM:SS'],
            ]}
            clearable={false}
            renderTrigger
          />
        </ControlRow>
      </ControlPanelSection>
    </div>
  );
};

// Export the component directly as the control panel
export default BigNumberControlPanel;
