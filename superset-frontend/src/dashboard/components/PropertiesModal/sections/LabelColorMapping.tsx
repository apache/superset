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
import { useMemo, useState, useEffect, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import stringify from 'json-stringify-pretty-compact';
import ColorPickerControl from 'src/explore/components/controls/ColorPickerControl';

// Strict typing to satisfy the tsc compiler without enforcing it as a required component prop
interface CustomTheme {
  gridUnit?: number;
  borderRadius?: number;
  colors?: {
    grayscale?: {
      light4?: string;
      light2?: string;
      light1?: string;
      dark1?: string;
      base?: string;
    };
    primary?: {
      base?: string;
      dark1?: string;
    };
    error?: {
      base?: string;
    };
  };
}

const Container = styled.div`
  ${({ theme }: { theme?: CustomTheme }) => `
    margin-bottom: ${(theme?.gridUnit || 4) * 4}px;
    padding: ${(theme?.gridUnit || 4) * 4}px;
    background-color: ${theme?.colors?.grayscale?.light4};
    border-radius: ${theme?.borderRadius || 4}px;
  `}
`;

const HeaderRow = styled.div`
  ${({ theme }: { theme?: CustomTheme }) => `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: ${(theme?.gridUnit || 4) * 4}px;
  `}
`;

const Row = styled.div`
  ${({ theme }: { theme?: CustomTheme }) => `
    display: flex;
    align-items: center;
    margin-bottom: ${(theme?.gridUnit || 4) * 2}px;
    gap: ${(theme?.gridUnit || 4) * 4}px;
  `}
`;

const InputGroup = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
`;

const StyledInput = styled.input`
  ${({ theme }: { theme?: CustomTheme }) => `
    flex: 1;
    width: 100%;
    height: 32px;
    padding: 4px 11px;
    border: 1px solid ${theme?.colors?.grayscale?.light2};
    border-right: none;
    border-radius: ${theme?.borderRadius || 4}px 0 0 ${theme?.borderRadius || 4}px;
    color: ${theme?.colors?.grayscale?.dark1};
    outline: none;
    &:focus {
      border-color: ${theme?.colors?.primary?.base};
    }
  `}
`;

const ColorPickerWrapper = styled.div`
  ${({ theme }: { theme?: CustomTheme }) => `
    display: flex;
    align-items: center;
    padding-left: ${(theme?.gridUnit || 4) * 2}px;
  `}
`;

const ActionButton = styled.button`
  ${({ theme }: { theme?: CustomTheme }) => `
    background: transparent;
    border: none;
    color: ${theme?.colors?.grayscale?.base};
    cursor: pointer;
    padding: 0;
    font-size: 16px;
    transition: color 0.2s;

    &:hover {
      color: ${theme?.colors?.error?.base};
    }
  `}
`;

const AddMoreLink = styled.button`
  ${({ theme }: { theme?: CustomTheme }) => `
    background: transparent;
    border: none;
    padding: 0;
    color: ${theme?.colors?.primary?.dark1};
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
    margin-top: ${(theme?.gridUnit || 4) * 2}px;
    display: inline-block;

    &:hover {
      text-decoration: underline;
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

const DEFAULT_NEW_COLOR = ['#0', '00000'].join('');

const generateId = () => Math.random().toString(36).substring(2, 9);
const isValidHex = (color: string) => /^#[0-9A-Fa-f]{6}$/i.test(color);

const LabelColorMapping = ({
  jsonMetadata,
  onJsonMetadataChange,
}: LabelColorMappingProps) => {
  const { metadataObj, isValidJson } = useMemo(() => {
    try {
      const parsed = jsonMetadata ? JSON.parse(jsonMetadata) : {};
      return {
        metadataObj:
          parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : {},
        isValidJson: true,
      };
    } catch (error: unknown) {
      return { metadataObj: {}, isValidJson: false };
    }
  }, [jsonMetadata]);

  const labelColors = useMemo(
    () =>
      metadataObj.label_colors &&
      typeof metadataObj.label_colors === 'object' &&
      !Array.isArray(metadataObj.label_colors)
        ? (metadataObj.label_colors as Record<string, string>)
        : {},
    [metadataObj],
  );

  const [rows, setRows] = useState<ColorMapping[]>(() =>
    Object.entries(labelColors).map(([label, color]) => ({
      id: generateId(),
      label,
      color: isValidHex(color) ? color : DEFAULT_NEW_COLOR,
    })),
  );

  const lastSyncMetadata = useRef<string>(jsonMetadata);

  useEffect(() => {
    if (lastSyncMetadata.current !== jsonMetadata) {
      const initialRows = Object.entries(labelColors).map(([label, color]) => ({
        id: generateId(),
        label,
        color: isValidHex(color) ? color : DEFAULT_NEW_COLOR,
      }));
      setRows(initialRows);
      lastSyncMetadata.current = jsonMetadata;
    }
  }, [jsonMetadata, labelColors]);

  const syncToJson = (currentRows: ColorMapping[]) => {
    const newLabelColors: Record<string, string> = {};
    const seenLabels = new Set<string>();

    currentRows.forEach(row => {
      const trimmedLabel = row.label.trim();
      if (trimmedLabel !== '' && !seenLabels.has(trimmedLabel)) {
        newLabelColors[trimmedLabel] = row.color;
        seenLabels.add(trimmedLabel);
      }
    });

    const updatedMetadata = {
      ...metadataObj,
      label_colors: newLabelColors,
    };

    const newMetadataString = stringify(updatedMetadata);
    lastSyncMetadata.current = newMetadataString;
    onJsonMetadataChange(newMetadataString);
  };

  const handleAddRow = () => {
    const newRows = [
      ...rows,
      { id: generateId(), label: '', color: DEFAULT_NEW_COLOR },
    ];
    setRows(newRows);
  };

  const handleUpdateRow = (id: string, newLabel: string, newColor: string) => {
    const newRows = rows.map(r =>
      r.id === id ? { ...r, label: newLabel, color: newColor } : r,
    );
    setRows(newRows);
    syncToJson(newRows);
  };

  const handleDeleteRow = (id: string) => {
    const newRows = rows.filter(r => r.id !== id);
    setRows(newRows);
    syncToJson(newRows);
  };

  const allKnownLabels = Array.from(
    new Set(rows.map(r => r.label).filter(Boolean)),
  );

  if (!isValidJson) {
    return (
      <Container>
        <HeaderRow>
          <div>
            <h4
              css={(theme: CustomTheme) => ({
                marginBottom: theme?.gridUnit || 4,
                marginTop: 0,
              })}
            >
              {t('Label Colors')}
            </h4>
            <p
              css={(theme: CustomTheme) => ({
                margin: 0,
                fontSize: 12,
                color: theme?.colors?.error?.base,
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
            css={(theme: CustomTheme) => ({
              marginBottom: theme?.gridUnit || 4,
              marginTop: 0,
            })}
          >
            {t('Label Colors')}
          </h4>
          <p
            css={(theme: CustomTheme) => ({
              margin: 0,
              fontSize: 12,
              color: theme?.colors?.grayscale?.base,
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
          css={(theme: CustomTheme) => ({
            fontStyle: 'italic',
            color: theme?.colors?.grayscale?.light1,
          })}
        >
          {t('No color mappings defined. Click "+ Add more" to get started.')}
        </p>
      )}

      {rows.map(row => {
        const availableOptions = allKnownLabels
          .filter(
            label =>
              label === row.label ||
              !rows.some(r => r.label === label && r.id !== row.id),
          )
          .map(label => ({ label, value: label }));

        return (
          <Row key={row.id}>
            <InputGroup>
              <StyledInput
                list={`label-options-${row.id}`}
                value={row.label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleUpdateRow(row.id, e.target.value, row.color)
                }
                placeholder={t('Select or type a label')}
              />
              <datalist id={`label-options-${row.id}`}>
                {availableOptions.map(opt => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    aria-label={opt.value}
                  />
                ))}
              </datalist>
              <ColorPickerWrapper>
                <ColorPickerControl
                  value={row.color}
                  outputFormat="hex"
                  onChange={color =>
                    handleUpdateRow(
                      row.id,
                      row.label,
                      typeof color === 'string' ? color : row.color,
                    )
                  }
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
