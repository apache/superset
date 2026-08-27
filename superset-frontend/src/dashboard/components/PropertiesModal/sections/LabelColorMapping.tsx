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

import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import type { SupersetTheme } from '@apache-superset/core/theme';
import stringify from 'json-stringify-pretty-compact';
import ColorPickerControl from 'src/explore/components/controls/ColorPickerControl';

const Container = styled.div`
  ${({ theme }: { theme: SupersetTheme }) => `
    margin-bottom: ${(theme.gridUnit || 4) * 4}px;
    padding: ${(theme.gridUnit || 4) * 4}px;
    background-color: ${theme.colors?.grayscale?.light4 || '#f6f6f6'};
    border-radius: ${theme.borderRadius || 4}px;
  `}
`;

const HeaderRow = styled.div`
  ${({ theme }: { theme: SupersetTheme }) => `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${(theme.gridUnit || 4) * 4}px;
  `}
`;

const Row = styled.div`
  ${({ theme }: { theme: SupersetTheme }) => `
    display: flex;
    align-items: center;
    margin-bottom: ${(theme.gridUnit || 4) * 2}px;
    gap: ${(theme.gridUnit || 4) * 4}px;
  `}
`;

const InputGroup = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
`;

const StyledInput = styled.input`
  ${({ theme }: { theme: SupersetTheme }) => `
    flex: 1;
    width: 100%;
    min-width: 0;
    height: 32px;
    padding: 4px 11px;
    border: 1px solid ${theme.colors?.grayscale?.light2 || '#e0e0e0'};
    border-right: none;
    border-radius: ${theme.borderRadius || 4}px 0 0 ${theme.borderRadius || 4}px;
    color: ${theme.colors?.grayscale?.dark1 || '#333333'};
    background-color: ${theme.colors?.grayscale?.light5 || '#ffffff'};
    outline: none;

    &:focus {
      border-color: ${theme.colors?.primary?.base || '#20a7c9'};
    }
  `}
`;

const ColorPickerWrapper = styled.div`
  ${({ theme }: { theme: SupersetTheme }) => `
    display: flex;
    align-items: center;
    padding-left: ${(theme.gridUnit || 4) * 2}px;
  `}
`;

const ActionButton = styled.button`
  ${({ theme }: { theme: SupersetTheme }) => `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: ${theme.colors?.grayscale?.base || '#666666'};
    cursor: pointer;
    padding: 0;
    border-radius: ${theme.borderRadius || 4}px;
    transition:
      color 0.2s,
      background-color 0.2s;

    &:hover {
      color: ${theme.colors?.error?.base || '#e04355'};
      background-color: ${theme.colors?.grayscale?.light4 || '#f6f6f6'};
    }

    &:focus-visible {
      outline: 2px solid ${theme.colors?.primary?.base || '#20a7c9'};
      outline-offset: 2px;
    }
  `}
`;

const AddMoreLink = styled.button`
  ${({ theme }: { theme: SupersetTheme }) => `
    background: transparent;
    border: none;
    padding: 0;
    color: ${theme.colors?.primary?.dark1 || '#1a85a0'};
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    margin-top: ${(theme.gridUnit || 4) * 2}px;
    display: inline-block;

    &:hover {
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid ${theme.colors?.primary?.base || '#20a7c9'};
      outline-offset: 2px;
    }
  `}
`;

interface LabelColorMappingProps {
  jsonMetadata: string;
  onJsonMetadataChange: (value: string) => void;
}

interface ColorMapping {
  id: string;
  label: string;
  color: string;
}

type MetadataObject = Record<string, unknown>;

const DEFAULT_NEW_COLOR = '#000000';

const generateId = (): string => {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 11);
};

const isValidHex = (color: unknown): color is string =>
  typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/i.test(color);

const parseMetadata = (
  jsonMetadata: string,
): {
  metadataObj: MetadataObject;
  isValidJson: boolean;
} => {
  if (!jsonMetadata.trim()) {
    return { metadataObj: {}, isValidJson: true };
  }
  try {
    const parsed: unknown = JSON.parse(jsonMetadata);
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return { metadataObj: parsed as MetadataObject, isValidJson: true };
    }
    return { metadataObj: {}, isValidJson: false };
  } catch {
    return { metadataObj: {}, isValidJson: false };
  }
};

const getLabelColors = (
  metadataObj: MetadataObject,
): Record<string, string> => {
  const value = metadataObj.label_colors;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(([, color]) => typeof color === 'string'),
  );
};

const rowsFromLabelColors = (
  labelColors: Record<string, string>,
): ColorMapping[] =>
  Object.entries(labelColors).map(([label, color]) => ({
    id: generateId(),
    label,
    color: isValidHex(color) ? color : DEFAULT_NEW_COLOR,
  }));

const LabelColorMapping = ({
  jsonMetadata,
  onJsonMetadataChange,
}: LabelColorMappingProps) => {
  const { metadataObj, isValidJson } = useMemo(
    () => parseMetadata(jsonMetadata),
    [jsonMetadata],
  );

  const labelColors = useMemo(() => getLabelColors(metadataObj), [metadataObj]);

  const [rows, setRows] = useState<ColorMapping[]>(() =>
    rowsFromLabelColors(labelColors),
  );

  const lastSyncedMetadata = useRef(jsonMetadata);

  useEffect(() => {
    if (lastSyncedMetadata.current === jsonMetadata) {
      return;
    }
    setRows(rowsFromLabelColors(labelColors));
    lastSyncedMetadata.current = jsonMetadata;
  }, [jsonMetadata, labelColors]);

  const syncToJson = (currentRows: ColorMapping[]) => {
    const newLabelColors: Record<string, string> = {};
    const seenLabels = new Set<string>();

    currentRows.forEach(row => {
      const trimmedLabel = row.label.trim();
      if (
        trimmedLabel !== '' &&
        !seenLabels.has(trimmedLabel) &&
        isValidHex(row.color)
      ) {
        newLabelColors[trimmedLabel] = row.color;
        seenLabels.add(trimmedLabel);
      }
    });

    const updatedMetadata: MetadataObject = {
      ...metadataObj,
      label_colors: newLabelColors,
    };

    const newMetadataString = stringify(updatedMetadata);
    lastSyncedMetadata.current = newMetadataString;
    onJsonMetadataChange(newMetadataString);
  };

  const handleAddRow = () => {
    setRows(currentRows => [
      ...currentRows,
      {
        id: generateId(),
        label: '',
        color: DEFAULT_NEW_COLOR,
      },
    ]);
  };

  const handleUpdateRow = (id: string, newLabel: string, newColor: string) => {
    const newRows = rows.map(row =>
      row.id === id ? { ...row, label: newLabel, color: newColor } : row,
    );
    setRows(newRows);
    syncToJson(newRows);
  };

  const handleDeleteRow = (id: string) => {
    const newRows = rows.filter(row => row.id !== id);
    setRows(newRows);
    syncToJson(newRows);
  };

  const allKnownLabels = useMemo(
    () =>
      Array.from(new Set(rows.map(row => row.label.trim()).filter(Boolean))),
    [rows],
  );

  if (!isValidJson) {
    return (
      <Container>
        <HeaderRow>
          <div>
            <h4
              css={(theme: SupersetTheme) => ({
                marginBottom: theme.gridUnit || 4,
                marginTop: 0,
              })}
            >
              {t('Label Colors')}
            </h4>
            <p
              css={(theme: SupersetTheme) => ({
                margin: 0,
                fontSize: 12,
                color: theme.colors?.error?.base || '#e04355',
              })}
            >
              {t(
                'Invalid JSON metadata. Please resolve syntax errors in the Advanced tab to use the GUI.',
              )}
            </p>
          </div>
        </HeaderRow>
      </Container>
    );
  }

  return (
    <Container>
      <HeaderRow>
        <div>
          <h4
            css={(theme: SupersetTheme) => ({
              marginBottom: theme.gridUnit || 4,
              marginTop: 0,
            })}
          >
            {t('Label Colors')}
          </h4>
          <p
            css={(theme: SupersetTheme) => ({
              margin: 0,
              fontSize: 12,
              color: theme.colors?.grayscale?.base || '#666666',
            })}
          >
            {t(
              'Map specific labels to colors. This automatically updates the JSON below.',
            )}
          </p>
        </div>
      </HeaderRow>

      {rows.length === 0 && (
        <p
          css={(theme: SupersetTheme) => ({
            fontStyle: 'italic',
            color: theme.colors?.grayscale?.light1 || '#b2b2b2',
          })}
        >
          {t('No color mappings defined. Click "+ Add more" to get started.')}
        </p>
      )}

      {rows.map(row => {
        const currentLabel = row.label.trim();
        const availableOptions = allKnownLabels
          .filter(
            label =>
              label === currentLabel ||
              !rows.some(
                otherRow =>
                  otherRow.id !== row.id && otherRow.label.trim() === label,
              ),
          )
          .map(label => ({
            label,
            value: label,
          }));

        return (
          <Row key={row.id}>
            <InputGroup>
              <StyledInput
                list={`label-options-${row.id}`}
                value={row.label}
                onChange={event =>
                  handleUpdateRow(row.id, event.target.value, row.color)
                }
                placeholder={t('Select or type a label')}
                aria-label={t('Label')}
              />

              <datalist id={`label-options-${row.id}`}>
                {availableOptions.map(option => (
                  <option
                    key={option.value}
                    value={option.value}
                    aria-label={option.value}
                  />
                ))}
              </datalist>

              <ColorPickerWrapper>
                <ColorPickerControl
                  value={row.color}
                  outputFormat="hex"
                  onChange={color => {
                    if (typeof color === 'string' && isValidHex(color)) {
                      handleUpdateRow(row.id, row.label, color);
                    }
                  }}
                />
              </ColorPickerWrapper>
            </InputGroup>

            <ActionButton
              onClick={() => handleDeleteRow(row.id)}
              type="button"
              aria-label={t('Remove color mapping')}
              title={t('Remove color mapping')}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </ActionButton>
          </Row>
        );
      })}

      <AddMoreLink onClick={handleAddRow} type="button">
        + {t('Add more')}
      </AddMoreLink>
    </Container>
  );
};

export default LabelColorMapping;
