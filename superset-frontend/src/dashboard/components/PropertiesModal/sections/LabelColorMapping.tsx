/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import React, { useMemo } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';

const Container = styled.div`
  margin-bottom: ${({ theme }) => (theme?.gridUnit || 4) * 4}px;
  padding: ${({ theme }) => (theme?.gridUnit || 4) * 4}px;
  background-color: ${({ theme }) =>
    theme?.colors?.grayscale?.light4 || '#f6f6f6'};
  border-radius: ${({ theme }) => theme?.borderRadius || 4}px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: ${({ theme }) => (theme?.gridUnit || 4) * 2}px;
  gap: ${({ theme }) => (theme?.gridUnit || 4) * 2}px;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => (theme?.gridUnit || 4) * 4}px;
`;

const StyledInput = styled.input`
  flex: 1;
  width: 100%;
  padding: ${({ theme }) => (theme?.gridUnit || 4) * 1.5}px
    ${({ theme }) => (theme?.gridUnit || 4) * 2}px;
  font-size: 14px;
  border-radius: ${({ theme }) => theme?.borderRadius || 4}px;
  border: 1px solid
    ${({ theme }) => theme?.colors?.grayscale?.light2 || '#e0e0e0'};
  color: ${({ theme }) => theme?.colors?.grayscale?.dark1 || '#333333'};
  outline: none;

  &:focus {
    border-color: ${({ theme }) => theme?.colors?.primary?.base || '#20a7c9'};
  }
`;

const StyledColorInput = styled.input`
  cursor: pointer;
  height: 34px;
  width: 40px;
  padding: 0;
  border: 1px solid
    ${({ theme }) => theme?.colors?.grayscale?.light2 || '#e0e0e0'};
  border-radius: ${({ theme }) => theme?.borderRadius || 4}px;
  outline: none;
  background: none;

  &::-webkit-color-swatch-wrapper {
    padding: 2px;
  }
  &::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }
`;

const StyledButton = styled.button<{ variant?: 'danger' | 'primary' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme?.gridUnit || 4}px
    ${({ theme }) => (theme?.gridUnit || 4) * 3}px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  border: none;
  border-radius: ${({ theme }) => theme?.borderRadius || 4}px;
  background-color: ${({ theme, variant }) =>
    variant === 'danger'
      ? theme?.colors?.error?.base || '#e04355'
      : theme?.colors?.primary?.base || '#20a7c9'};
  color: #ffffff;
  transition: opacity 0.2s;

  &:hover {
    opacity: 0.8;
  }
`;

interface LabelColorMappingProps {
  jsonMetadata: string;
  onJsonMetadataChange: (value: string) => void;
}

const DEFAULT_NEW_COLOR = '#000000';

const LabelColorMapping: React.FC<LabelColorMappingProps> = ({
  jsonMetadata,
  onJsonMetadataChange,
}) => {
  const metadataObj = useMemo<Record<string, unknown>>(() => {
    try {
      const parsed = jsonMetadata ? JSON.parse(jsonMetadata) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        return {};
      }
      throw error;
    }
  }, [jsonMetadata]);

  const labelColors =
    metadataObj.label_colors &&
    typeof metadataObj.label_colors === 'object' &&
    !Array.isArray(metadataObj.label_colors)
      ? (metadataObj.label_colors as Record<string, string>)
      : {};

  const colorEntries = Object.entries(labelColors);

  const updateLabelColors = (newLabelColors: Record<string, string>) => {
    const updatedMetadata = {
      ...metadataObj,
      label_colors: newLabelColors,
    };
    onJsonMetadataChange(JSON.stringify(updatedMetadata, null, 2));
  };

  const handleUpdate = (
    oldLabel: string,
    newLabel: string,
    newColor: string,
  ) => {
    const newColors = { ...labelColors };
    if (oldLabel !== newLabel) {
      delete newColors[oldLabel];
    }
    newColors[newLabel] = newColor;
    updateLabelColors(newColors);
  };

  const handleDelete = (label: string) => {
    const newColors = { ...labelColors };
    delete newColors[label];
    updateLabelColors(newColors);
  };

  const handleAdd = () => {
    let labelIndex = 1;
    let newLabel = 'New Label';
    while (Object.prototype.hasOwnProperty.call(labelColors, newLabel)) {
      labelIndex += 1;
      newLabel = `New Label ${labelIndex}`;
    }
    const newColors = { ...labelColors, [newLabel]: DEFAULT_NEW_COLOR };
    updateLabelColors(newColors);
  };

  return (
    <Container>
      <HeaderRow>
        <div>
          <h4
            css={(theme: any) => ({
              marginBottom: theme?.gridUnit || 4,
              marginTop: 0,
            })}
          >
            {t('Label Colors')}
          </h4>
          <p
            css={(theme: any) => ({
              margin: 0,
              fontSize: 12,
              color: theme?.colors?.grayscale?.base || '#666666',
            })}
          >
            {t(
              'Map specific labels to colors. This automatically updates the JSON below.',
            )}
          </p>
        </div>
        <StyledButton variant="primary" onClick={handleAdd} type="button">
          <i className="fa fa-plus" css={{ marginRight: 8 }} />
          {t('Add Mapping')}
        </StyledButton>
      </HeaderRow>

      {colorEntries.length === 0 && (
        <p
          css={(theme: any) => ({
            fontStyle: 'italic',
            color: theme?.colors?.grayscale?.light1 || '#B2B2B2',
          })}
        >
          {t('No color mappings defined. Click "Add Mapping" to get started.')}
        </p>
      )}

      {colorEntries.map(([label, color], index) => (
        <Row key={`mapping-${index}`}>
          <StyledInput
            type="text"
            value={label}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleUpdate(label, e.target.value, color)
            }
            placeholder={t('Label (e.g., Revenue)')}
          />
          <StyledColorInput
            type="color"
            value={color}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleUpdate(label, label, e.target.value)
            }
          />
          <StyledButton
            variant="danger"
            onClick={() => handleDelete(label)}
            type="button"
            title={t('Remove color mapping')}
          >
            <i className="fa fa-trash" />
          </StyledButton>
        </Row>
      ))}
    </Container>
  );
};

export default LabelColorMapping;
