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

import { useCallback } from 'react';
import { styled, t } from '@superset-ui/core';
import { ColumnMeta, Metric } from '@superset-ui/chart-controls';
import { TooltipField } from './CustomTooltipControl';

export interface TooltipFieldSelectorProps {
  value: TooltipField[];
  onChange: (fields: TooltipField[]) => void;
  columns: ColumnMeta[];
  metrics: Metric[];
  name: string;
}

const StyledFieldSelector = styled.div`
  ${({ theme }) => `
    .field-item {
      margin-bottom: ${theme.sizeUnit}px;
      display: flex;
      align-items: center;
      padding: ${theme.sizeUnit * 2}px;
      border: 1px solid ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      background-color: ${theme.colorBgLayout};

      .field-type-indicator {
        display: inline-block;
        width: ${theme.sizeUnit * 2}px;
        height: ${theme.sizeUnit * 2}px;
        border-radius: 50%;
        margin-right: ${theme.sizeUnit}px;

        &.column {
          background-color: ${theme.colorPrimary};
        }

        &.metric {
          background-color: ${theme.colorSuccess};
        }
      }

      .field-label {
        flex: 1;
        font-size: ${theme.fontSizeSM}px;
        color: ${theme.colorText};
      }
    }

    .drop-zone {
      border: 2px dashed ${theme.colorBorder};
      border-radius: ${theme.borderRadius}px;
      padding: ${theme.sizeUnit * 4}px;
      text-align: center;
      color: ${theme.colorTextLabel};
      margin-bottom: ${theme.sizeUnit * 2}px;
      min-height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .field-list {
      margin-bottom: ${theme.sizeUnit * 2}px;
    }
  `}
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.colors.grayscale.light1};
  cursor: pointer;
  margin-left: ${({ theme }) => theme.sizeUnit}px;
  padding: ${({ theme }) => theme.sizeUnit / 2}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.borderRadius}px;
  width: ${({ theme }) => theme.sizeUnit * 6}px;
  height: ${({ theme }) => theme.sizeUnit * 6}px;
  font-size: 16px;
  font-weight: bold;
  line-height: 1;

  &:hover {
    color: ${({ theme }) => theme.colorError};
    background-color: ${({ theme }) => theme.colorErrorBg};
  }

  &:focus {
    outline: 2px solid ${({ theme }) => theme.colorPrimary};
    outline-offset: 2px;
  }
`;

export function TooltipFieldSelector({
  value,
  onChange,
  columns,
  metrics,
}: TooltipFieldSelectorProps) {
  const handleRemoveField = useCallback(
    (fieldId: string) => {
      onChange(value.filter(field => field.id !== fieldId));
    },
    [value, onChange],
  );

  // Placeholder implementation - will be enhanced with DnD in next iteration
  const handleAddColumn = useCallback(() => {
    if (columns.length > 0) {
      const firstColumn = columns[0];
      const newField: TooltipField = {
        id: firstColumn.column_name,
        name: firstColumn.column_name,
        type: 'column',
        label: firstColumn.verbose_name || firstColumn.column_name,
        originalValue: firstColumn,
      };

      if (!value.some(field => field.id === newField.id)) {
        onChange([...value, newField]);
      }
    }
  }, [columns, value, onChange]);

  const handleAddMetric = useCallback(() => {
    if (metrics.length > 0) {
      const firstMetric = metrics[0];
      const newField: TooltipField = {
        id: firstMetric.metric_name,
        name: firstMetric.metric_name,
        type: 'metric',
        label: firstMetric.verbose_name || firstMetric.metric_name,
        originalValue: firstMetric,
      };

      if (!value.some(field => field.id === newField.id)) {
        onChange([...value, newField]);
      }
    }
  }, [metrics, value, onChange]);

  return (
    <StyledFieldSelector>
      <div className="field-list">
        {value.map(field => (
          <div key={field.id} className="field-item">
            <span className={`field-type-indicator ${field.type}`} />
            <span className="field-label">{field.label}</span>
            <RemoveButton
              type="button"
              onClick={() => handleRemoveField(field.id)}
              title={t('Remove field')}
              data-test="remove-tooltip-field"
            >
              ×
            </RemoveButton>
          </div>
        ))}
      </div>

      <div className="drop-zone">
        <div>
          <p>{t('Drop columns/metrics here or use buttons below')}</p>
          <button type="button" onClick={handleAddColumn}>
            {t('Add Column')}
          </button>{' '}
          <button type="button" onClick={handleAddMetric}>
            {t('Add Metric')}
          </button>
        </div>
      </div>
    </StyledFieldSelector>
  );
}
