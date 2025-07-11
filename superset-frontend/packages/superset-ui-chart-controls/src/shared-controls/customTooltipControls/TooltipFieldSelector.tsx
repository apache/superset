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
import { useDrop } from 'react-dnd';
import { styled, SupersetTheme, t } from '@superset-ui/core';

export interface TooltipField {
  name: string;
  type: string;
  label: string;
  column_name?: string;
  metric_name?: string;
  verbose_name?: string;
}

interface DragItem {
  type: 'column' | 'metric';
  column_name?: string;
  metric_name?: string;
  label?: string;
  verbose_name?: string;
}

const DndContainer = styled.div<{ isOver: boolean }>`
  border: 2px dashed
    ${({ theme, isOver }: { theme: SupersetTheme; isOver: boolean }) =>
      isOver ? theme.colors.primary.base : theme.colors.grayscale.light2};
  border-radius: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit}px;
  padding: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit * 4}px;
  background-color: ${({
    theme,
    isOver,
  }: {
    theme: SupersetTheme;
    isOver: boolean;
  }) => (isOver ? theme.colors.primary.light5 : theme.colors.grayscale.light5)};
  min-height: 120px;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
`;

const DndLabel = styled.div`
  color: ${({ theme }: { theme: SupersetTheme }) =>
    theme.colors.grayscale.base};
  font-size: ${({ theme }: { theme: SupersetTheme }) => theme.fontSizeSM}px;
  margin-bottom: ${({ theme }: { theme: SupersetTheme }) =>
    theme.sizeUnit * 2}px;
  font-weight: 600;
`;

const DndPlaceholder = styled.div`
  color: ${({ theme }: { theme: SupersetTheme }) =>
    theme.colors.grayscale.light1};
  font-size: ${({ theme }: { theme: SupersetTheme }) => theme.fontSizeSM}px;
  font-style: italic;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
`;

const SelectedItems = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit}px;
`;

const SelectedItem = styled.div`
  display: flex;
  align-items: center;
  background-color: ${({ theme }: { theme: SupersetTheme }) =>
    theme.colors.primary.light4};
  border: 1px solid
    ${({ theme }: { theme: SupersetTheme }) => theme.colors.primary.base};
  border-radius: ${({ theme }: { theme: SupersetTheme }) =>
    theme.sizeUnit / 2}px;
  padding: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit}px
    ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit * 2}px;
  font-size: ${({ theme }: { theme: SupersetTheme }) => theme.fontSizeSM}px;
  color: ${({ theme }: { theme: SupersetTheme }) => theme.colors.primary.dark1};
  cursor: move;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }: { theme: SupersetTheme }) =>
    theme.colors.grayscale.base};
  cursor: pointer;
  margin-left: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit}px;
  padding: 0;

  &:hover {
    color: ${({ theme }: { theme: SupersetTheme }) => theme.colors.error.base};
  }
`;

const TypeIcon = styled.span`
  margin-right: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit}px;
`;

const GhostButton = styled.button`
  background: none;
  border: 2px dashed
    ${({ theme }: { theme: SupersetTheme }) => theme.colors.grayscale.light2};
  border-radius: ${({ theme }: { theme: SupersetTheme }) =>
    theme.sizeUnit / 2}px;
  padding: ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit}px
    ${({ theme }: { theme: SupersetTheme }) => theme.sizeUnit * 2}px;
  color: ${({ theme }: { theme: SupersetTheme }) =>
    theme.colors.grayscale.light1};
  cursor: pointer;
  font-size: ${({ theme }: { theme: SupersetTheme }) => theme.fontSizeSM}px;
  display: flex;
  align-items: center;

  &:hover {
    border-color: ${({ theme }: { theme: SupersetTheme }) =>
      theme.colors.primary.base};
    color: ${({ theme }: { theme: SupersetTheme }) =>
      theme.colors.primary.base};
  }
`;

interface TooltipFieldSelectorProps {
  availableColumns: Array<{ column_name: string; type: string }>;
  availableMetrics: Array<{ metric_name: string; type: string }>;
  selectedFields: TooltipField[];
  onFieldsChange: (fields: TooltipField[]) => void;
}

const TooltipFieldSelector = ({
  selectedFields,
  onFieldsChange,
}: TooltipFieldSelectorProps) => {
  const handleDrop = useCallback(
    (item: DragItem) => {
      // Handle both column and metric drops
      let newField: TooltipField;

      if (item.type === 'column' && item.column_name) {
        newField = {
          name: item.column_name,
          type: 'column',
          label: item.verbose_name || item.column_name,
          column_name: item.column_name,
          verbose_name: item.verbose_name,
        };
      } else if (item.type === 'metric' && (item.metric_name || item.label)) {
        const name = item.metric_name || item.label || '';
        newField = {
          name,
          type: 'metric',
          label: item.verbose_name || item.metric_name || item.label || '',
          metric_name: item.metric_name || item.label,
          verbose_name: item.verbose_name,
        };
      } else {
        return; // Unknown item type
      }

      // Check if field already exists
      const exists = selectedFields.some(f => f.name === newField.name);
      if (!exists) {
        onFieldsChange([...selectedFields, newField]);
      }
    },
    [selectedFields, onFieldsChange],
  );

  const [{ isOver }, drop] = useDrop({
    accept: ['column', 'metric'], // Accept both columns and metrics
    drop: handleDrop,
    collect: monitor => ({
      isOver: monitor.isOver(),
    }),
  });

  const handleRemoveField = useCallback(
    (index: number) => {
      const newFields = selectedFields.filter((_, i) => i !== index);
      onFieldsChange(newFields);
    },
    [selectedFields, onFieldsChange],
  );

  const getTypeIcon = (type: string) => (type === 'metric' ? '📊' : '📝');

  return (
    <div>
      <DndLabel>{t('Tooltip contents')}</DndLabel>
      <DndContainer ref={drop} isOver={isOver}>
        {selectedFields.length > 0 ? (
          <SelectedItems>
            {selectedFields.map((field, index) => (
              <SelectedItem key={`${field.type}-${field.name}`}>
                <TypeIcon>{getTypeIcon(field.type)}</TypeIcon>
                {field.label}
                <RemoveButton
                  onClick={() => handleRemoveField(index)}
                  title="Remove field"
                >
                  ×
                </RemoveButton>
              </SelectedItem>
            ))}
            <GhostButton title="Drop columns here or click">
              + {t('Drop columns here or click')}
            </GhostButton>
          </SelectedItems>
        ) : (
          <DndPlaceholder>
            {isOver
              ? t('Drop to add fields to tooltip')
              : t('Drop columns here or click')}
          </DndPlaceholder>
        )}
      </DndContainer>
    </div>
  );
};

export default TooltipFieldSelector;
