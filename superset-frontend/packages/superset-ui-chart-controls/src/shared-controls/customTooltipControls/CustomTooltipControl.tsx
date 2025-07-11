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
import { useCallback, useMemo } from 'react';
import { styled, Datasource } from '@superset-ui/core';
import { ControlComponentProps } from '@superset-ui/chart-controls';
import TooltipFieldSelector, { TooltipField } from './TooltipFieldSelector';
import TooltipTemplateEditor from './TooltipTemplateEditor';

const Container = styled.div`
  min-height: ${({ theme }) => theme.sizeUnit * 10}px;
`;

const Section = styled.div`
  margin-bottom: ${({ theme }) => theme.sizeUnit * 4}px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit * 2}px;
  margin-bottom: ${({ theme }) => theme.sizeUnit * 3}px;
`;

const Toggle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.sizeUnit}px;
`;

const ToggleLabel = styled.label`
  font-weight: bold;
  color: ${({ theme }) => theme.colors.grayscale.dark1};
  cursor: pointer;
`;

const ToggleInput = styled.input`
  cursor: pointer;
`;

const Divider = styled.div`
  height: 1px;
  background-color: ${({ theme }) => theme.colors.grayscale.light2};
  margin: ${({ theme }) => theme.sizeUnit * 3}px 0;
`;

export interface CustomTooltipConfig {
  enabled: boolean;
  fields: TooltipField[];
  template: string;
}

interface CustomTooltipControlProps
  extends ControlComponentProps<CustomTooltipConfig> {
  datasource: Datasource;
}

const CustomTooltipControl = ({
  value,
  onChange,
  datasource,
}: CustomTooltipControlProps) => {
  const config = useMemo<CustomTooltipConfig>(
    () => ({
      enabled: false,
      fields: [],
      template:
        '<div class="custom-tooltip">\n  <h3>{{title}}</h3>\n  {{#if value}}\n    <p><strong>Value:</strong> {{value}}</p>\n  {{/if}}\n</div>',
      ...value,
    }),
    [value],
  );

  const handleToggleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newConfig = {
        ...config,
        enabled: event.target.checked,
      };
      onChange?.(newConfig);
    },
    [config, onChange],
  );

  const handleFieldsChange = useCallback(
    (fields: TooltipField[]) => {
      const newConfig = {
        ...config,
        fields,
      };
      onChange?.(newConfig);
    },
    [config, onChange],
  );

  const handleTemplateChange = useCallback(
    (template: string) => {
      const newConfig = {
        ...config,
        template,
      };
      onChange?.(newConfig);
    },
    [config, onChange],
  );

  const handleFieldInsert = useCallback(
    (field: TooltipField) => {
      if (!config.fields.some(f => f.name === field.name)) {
        const newFields = [...config.fields, field];
        handleFieldsChange(newFields);
      }
    },
    [config.fields, handleFieldsChange],
  );

  const availableColumns = useMemo(
    () =>
      datasource?.columns?.map(col => ({
        column_name: col.column_name,
        type: col.type || 'string',
      })) || [],
    [datasource?.columns],
  );

  const availableMetrics = useMemo(
    () =>
      datasource?.metrics?.map(metric => ({
        metric_name:
          typeof metric === 'string'
            ? metric
            : metric.metric_name || (metric as any).label,
        type: 'metric',
      })) || [],
    [datasource?.metrics],
  );

  return (
    <Container>
      <Header>
        <Toggle>
          <ToggleInput
            type="checkbox"
            id="custom-tooltip-toggle"
            checked={config.enabled}
            onChange={handleToggleChange}
          />
          <ToggleLabel htmlFor="custom-tooltip-toggle">
            Enable Custom Tooltip
          </ToggleLabel>
        </Toggle>
      </Header>

      {config.enabled && (
        <>
          <Section>
            <TooltipFieldSelector
              availableColumns={availableColumns}
              availableMetrics={availableMetrics}
              selectedFields={config.fields}
              onFieldsChange={handleFieldsChange}
            />
          </Section>

          <Divider />

          <Section>
            <TooltipTemplateEditor
              template={config.template}
              onTemplateChange={handleTemplateChange}
              availableFields={config.fields}
              onFieldInsert={handleFieldInsert}
            />
          </Section>
        </>
      )}
    </Container>
  );
};

export default CustomTooltipControl;
