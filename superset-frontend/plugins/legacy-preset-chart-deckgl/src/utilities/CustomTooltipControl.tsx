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

import { useState, useCallback } from 'react';
import { styled, t, Datasource, useTheme } from '@superset-ui/core';
import {
  ColumnMeta,
  Metric,
  ControlComponentProps,
} from '@superset-ui/chart-controls';

export interface TooltipField {
  id: string;
  name: string;
  type: 'column' | 'metric';
  label?: string;
  originalValue?: ColumnMeta | Metric;
}

export interface CustomTooltipConfig {
  enabled: boolean;
  fields: TooltipField[];
  template: string;
}

export interface CustomTooltipControlProps
  extends ControlComponentProps<CustomTooltipConfig> {
  columns: ColumnMeta[];
  metrics: Metric[];
  datasource?: Datasource;
}

const DEFAULT_TEMPLATE = `<div>
{{#each fields}}
  <div><strong>{{this.label}}:</strong> {{this.value}}</div>
{{/each}}
</div>`;

const StyledControlContainer = styled.div`
  ${({ theme }) => `
    .tooltip-toggle {
      margin-bottom: ${theme.sizeUnit * 3}px;
    }

    .tooltip-section {
      margin-bottom: ${theme.sizeUnit * 4}px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .section-header {
      font-size: ${theme.fontSizeSM}px;
      font-weight: bold;
      margin-bottom: ${theme.sizeUnit * 2}px;
      color: ${theme.colors.grayscale.base};
    }

    .disabled-section {
      opacity: 0.5;
      pointer-events: none;
    }

    .checkbox-wrapper {
      display: flex;
      align-items: center;
      margin-bottom: ${theme.sizeUnit * 2}px;

      input[type="checkbox"] {
        margin-right: ${theme.sizeUnit}px;
      }
    }
  `}
`;

const TemplateTextarea = styled.textarea`
  width: 100%;
  font-family: Monaco, monospace;
  font-size: 12px;
  padding: ${({ theme }) => theme.sizeUnit * 2}px;
  border: 1px solid ${({ theme }) => theme.colorBorder};
  border-radius: ${({ theme }) => theme.borderRadius}px;
  background-color: ${({ theme }) => theme.colorBgContainer};
  color: ${({ theme }) => theme.colorText};
  resize: vertical;

  &:focus {
    border-color: ${({ theme }) => theme.colorPrimary};
    outline: none;
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colorPrimary}15;
  }
`;

const TemplateHint = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  font-size: ${({ theme }) => theme.fontSizeXS}px;
  color: ${({ theme }) => theme.colorTextSecondary};
`;

export default function CustomTooltipControl({
  value,
  onChange,
  columns = [],
  metrics = [],
  datasource,
  name,
  label,
  description,
  ...props
}: CustomTooltipControlProps) {
  const theme = useTheme();
  const [config, setConfig] = useState<CustomTooltipConfig>({
    enabled: false,
    fields: [],
    template: DEFAULT_TEMPLATE,
    ...value,
  });

  const handleToggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const enabled = event.target.checked;
      const newConfig = { ...config, enabled };
      setConfig(newConfig);
      if (onChange) {
        onChange(newConfig);
      }
    },
    [config, onChange],
  );

  const handleTemplateChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const template = event.target.value;
      const newConfig = { ...config, template };
      setConfig(newConfig);
      if (onChange) {
        onChange(newConfig);
      }
    },
    [config, onChange],
  );

  // Available for future field selection functionality
  // const availableColumns = useMemo(
  //   () => columns?.filter(col => col.column_name) || [],
  //   [columns]
  // );

  // const availableMetrics = useMemo(
  //   () => metrics?.filter(metric => metric.metric_name) || [],
  //   [metrics]
  // );

  return (
    <StyledControlContainer>
      <div className="tooltip-toggle">
        <div className="checkbox-wrapper">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={handleToggle}
            id={`${name}_enabled`}
          />
          <label htmlFor={`${name}_enabled`}>
            {t('Enable Custom Tooltip')}
          </label>
        </div>
      </div>

      {config.enabled && (
        <>
          <div className="tooltip-section">
            <div className="section-header">{t('Template Editor')}</div>
            <div>
              <TemplateTextarea
                value={config.template}
                onChange={handleTemplateChange}
                placeholder={t('Enter your tooltip template here...')}
                rows={6}
              />
            </div>
            <TemplateHint>
              {t(
                'Use {{field_name}} to insert field values. Example: <strong>{{column_name}}</strong>',
              )}
            </TemplateHint>
          </div>
        </>
      )}
    </StyledControlContainer>
  );
}
