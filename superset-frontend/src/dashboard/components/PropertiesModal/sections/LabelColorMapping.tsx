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
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';

const Container = styled.div`
  margin-bottom: ${({ theme }: any) => (theme?.gridUnit || 4) * 4}px;
  padding: ${({ theme }: any) => (theme?.gridUnit || 4) * 4}px;
  background-color: ${({ theme }: any) => theme?.colors?.grayscale?.light4 || "#f6f6f6"};
  border-radius: ${({ theme }: any) => theme?.borderRadius || 4}px;
`;

const HeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }: any) => (theme?.gridUnit || 4) * 4}px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: ${({ theme }: any) => (theme?.gridUnit || 4) * 2}px;
  gap: ${({ theme }: any) => (theme?.gridUnit || 4) * 4}px;
`;

const SelectContainer = styled.div`
  flex: 1;
`;

const StyledInput = styled.input`
  width: 100%;
  height: 32px;
  padding: 4px 11px;
  border: 1px solid
    ${({ theme }: any) => theme?.colors?.grayscale?.light2 || "#e0e0e0"};
  border-radius: ${({ theme }: any) => theme?.borderRadius || 4}px;
  color: ${({ theme }: any) => theme?.colors?.grayscale?.dark1 || "#333333"};
  outline: none;
  &:focus {
    border-color: ${({ theme }: any) => theme?.colors?.primary?.base || "#20a7c9"};
  }
`;

const ColorContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }: any) => theme?.gridUnit || 4}px;
`;

const StyledColorInput = styled.input`
  cursor: pointer;
  height: 34px;
  width: 40px;
  padding: 0;
  border: 1px solid
    ${({ theme }: any) => theme?.colors?.grayscale?.light2 || "#e0e0e0"};
  border-radius: ${({ theme }: any) => theme?.borderRadius || 4}px;
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

const ActionButton = styled.button`
  background: transparent;
  border: none;
  color: ${({ theme }: any) => theme?.colors?.grayscale?.base || "#666666"};
  cursor: pointer;
  padding: 0;
  font-size: 16px;
  transition: color 0.2s;

  &:hover {
    color: ${({ theme }: any) => theme?.colors?.error?.base || "#e04355"};
  }
`;

const AddMoreLink = styled.div`
  color: ${({ theme }: any) => theme?.colors?.primary?.dark1 || "#1a85a0"};
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  margin-top: ${({ theme }: any) => (theme?.gridUnit || 4) * 2}px;
  display: inline-block;

  &:hover {
    text-decoration: underline;
  }
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

const DEFAULT_NEW_COLOR = "#000000";

const generateId = () => Math.random().toString(36).substring(2, 9);
const isValidHex = (color: string) => /^#[0-9A-Fa-f]{6}$/i.test(color);

const LabelColorMapping: React.FC<LabelColorMappingProps> = ({
  jsonMetadata,
  onJsonMetadataChange,
}) => {
  const metadataObj = useMemo<Record<string, unknown>>(() => {
    try {
      const parsed = jsonMetadata ? JSON.parse(jsonMetadata) : {};
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch (error: unknown) {
      if (error instanceof SyntaxError) {
        return {};
      }
      throw error;
    }
  }, [jsonMetadata]);

  const labelColors = useMemo(() => 
    metadataObj.label_colors &&
      typeof metadataObj.label_colors === "object" &&
      !Array.isArray(metadataObj.label_colors)
      ? (metadataObj.label_colors as Record<string, string>)
      : {}
  , [metadataObj]);

  const [rows, setRows] = useState<ColorMapping[]>([]);
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
    currentRows.forEach((row) => {
      if (row.label.trim() !== "") {
        newLabelColors[row.label.trim()] = row.color;
      }
    });

    const updatedMetadata = {
      ...metadataObj,
      label_colors: newLabelColors,
    };

    const newMetadataString = JSON.stringify(updatedMetadata, null, 2);
    lastSyncMetadata.current = newMetadataString;
    onJsonMetadataChange(newMetadataString);
  };

  const handleAddRow = () => {
    const newRows = [
      ...rows,
      { id: generateId(), label: "", color: DEFAULT_NEW_COLOR },
    ];
    setRows(newRows);
  };

  const handleUpdateRow = (id: string, newLabel: string, newColor: string) => {
    const newRows = rows.map((r) =>
      r.id === id ? { ...r, label: newLabel, color: newColor } : r,
    );
    setRows(newRows);
    syncToJson(newRows);
  };

  const handleDeleteRow = (id: string) => {
    const newRows = rows.filter((r) => r.id !== id);
    setRows(newRows);
    syncToJson(newRows);
  };

  const allKnownLabels = Array.from(
    new Set(rows.map((r) => r.label).filter(Boolean)),
  );

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
            {t("Label Colors")}
          </h4>
          <p
            css={(theme: any) => ({
              margin: 0,
              fontSize: 12,
              color: theme?.colors?.grayscale?.base || "#666666",
            })}
          >
            {t(
              "Map specific labels to colors. This automatically updates the JSON below.",
            )}
          </p>
        </div>
      </HeaderRow>

      {rows.length === 0 && (
        <p
          css={(theme: any) => ({
            fontStyle: "italic",
            color: theme?.colors?.grayscale?.light1 || "#B2B2B2",
          })}
        >
          {t('No color mappings defined. Click "+ Add more" to get started.')}
        </p>
      )}

      {rows.map((row) => {
        const availableOptions = allKnownLabels
          .filter(
            (label) =>
              label === row.label ||
              !rows.some((r) => r.label === label && r.id !== row.id),
          )
          .map((label) => ({ label, value: label }));

        return (
          <Row key={row.id}>
            <SelectContainer>
              <StyledInput
                list={`label-options-${row.id}`}
                value={row.label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleUpdateRow(row.id, e.target.value, row.color)
                }
                placeholder={t("Select or type a label")}
              />
              <datalist id={`label-options-${row.id}`}>
                {availableOptions.map((opt) => (
                  <option
                    key={opt.value}
                    value={opt.value}
                    aria-label={opt.value}
                  />
                ))}
              </datalist>
            </SelectContainer>

            <ColorContainer>
              <StyledColorInput
                type="color"
                value={row.color}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleUpdateRow(row.id, row.label, e.target.value)
                }
              />
            </ColorContainer>

            <ActionButton
              onClick={() => handleDeleteRow(row.id)}
              type="button"
              title={t("Remove color mapping")}
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

      <AddMoreLink onClick={handleAddRow}>+ {t("Add more")}</AddMoreLink>
    </Container>
  );
};

export default LabelColorMapping;
