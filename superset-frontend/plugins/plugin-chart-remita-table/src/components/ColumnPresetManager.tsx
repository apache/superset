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

import React, { useState, useCallback, useMemo } from 'react';
import { styled } from '@apache-superset/core/ui';
import { t } from '@apache-superset/core';
import { Dropdown, Menu } from '@superset-ui/chart-controls';
import { Button, Modal, Input, Tooltip } from '@superset-ui/core/components';
import {
  SaveOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  StarOutlined,
  StarFilled,
  CopyOutlined,
  DownloadOutlined,
  UploadOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import {
  ColumnPreset,
  PresetMetadata,
  loadPresets,
  createPreset,
  updatePreset,
  deletePreset,
  setDefaultPreset,
  duplicatePreset,
  exportPresets,
  importPresets,
  validatePresetName,
  isPresetNameAvailable,
  ColumnConfiguration,
} from '../utils/columnPresets';

const PresetButton = styled(Button)`
  ${({ theme }) => `
    display: inline-flex;
    align-items: center;
    gap: ${theme.marginXXS}px;
    padding: ${theme.paddingXXS}px ${theme.paddingXS}px;
    height: 28px;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const PresetList = styled.div`
  ${({ theme }) => `
    max-height: 400px;
    overflow-y: auto;
    min-width: 280px;

    .preset-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.paddingXS}px ${theme.paddingSM}px;
      cursor: pointer;
      border-bottom: 1px solid ${theme.colorSplit};

      &:hover {
        background: ${theme.colorBgLayout};
      }

      &.active {
        background: ${theme.colorPrimaryBgHover};
      }

      &.default {
        background: ${theme.colorSuccessBgHover};
      }
    }

    .preset-info {
      flex: 1;
      min-width: 0;
    }

    .preset-name {
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
      display: flex;
      align-items: center;
      gap: ${theme.marginXXS}px;
    }

    .preset-description {
      font-size: ${theme.fontSizeXS}px;
      color: ${theme.colorTextTertiary};
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .preset-meta {
      font-size: ${theme.fontSizeXS}px;
      color: ${theme.colorTextSecondary};
      margin-top: ${theme.marginXXS}px;
    }

    .preset-actions {
      display: flex;
      align-items: center;
      gap: ${theme.marginXXS}px;
      opacity: 0;
      transition: opacity 0.2s;
    }

    .preset-item:hover .preset-actions {
      opacity: 1;
    }

    .action-icon {
      cursor: pointer;
      color: ${theme.colorTextTertiary};
      padding: ${theme.paddingXXS}px;
      border-radius: ${theme.borderRadius}px;

      &:hover {
        color: ${theme.colorText};
        background: ${theme.colorBgContainer};
      }
    }

    .empty-state {
      padding: ${theme.paddingLG}px;
      text-align: center;
      color: ${theme.colorTextTertiary};
    }
  `}
`;

const ModalContent = styled.div`
  ${({ theme }) => `
    .form-group {
      margin-bottom: ${theme.marginMD}px;
    }

    .form-label {
      display: block;
      margin-bottom: ${theme.marginXS}px;
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorText};
    }

    .form-help {
      font-size: ${theme.fontSizeXS}px;
      color: ${theme.colorTextTertiary};
      margin-top: ${theme.marginXXS}px;
    }

    .form-error {
      color: ${theme.colorError};
      font-size: ${theme.fontSizeSM}px;
      margin-top: ${theme.marginXXS}px;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: ${theme.marginXS}px;
    }
  `}
`;

export interface ColumnPresetManagerProps {
  tableId: string;
  currentConfiguration: ColumnConfiguration;
  activePresetId?: string | null;
  onApplyPreset: (preset: ColumnPreset) => void;
  onSaveComplete?: () => void;
}

export function ColumnPresetManager({
  tableId,
  currentConfiguration,
  activePresetId,
  onApplyPreset,
  onSaveComplete,
}: ColumnPresetManagerProps) {
  const [presets, setPresets] = useState<ColumnPreset[]>(() => loadPresets(tableId));
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Reload presets
  const reloadPresets = useCallback(() => {
    setPresets(loadPresets(tableId));
  }, [tableId]);

  // Validate name on change
  const handleNameChange = useCallback((value: string) => {
    setPresetName(value);
    const validation = validatePresetName(value);
    if (!validation.valid) {
      setNameError(validation.error || null);
    } else if (!isPresetNameAvailable(tableId, value)) {
      setNameError('A preset with this name already exists');
    } else {
      setNameError(null);
    }
  }, [tableId]);

  // Save new preset
  const handleSavePreset = useCallback(() => {
    const validation = validatePresetName(presetName);
    if (!validation.valid) {
      setNameError(validation.error || null);
      return;
    }

    if (!isPresetNameAvailable(tableId, presetName)) {
      setNameError('A preset with this name already exists');
      return;
    }

    const preset = createPreset(
      tableId,
      presetName,
      currentConfiguration,
      presetDescription || undefined,
      setAsDefault,
    );

    if (preset) {
      reloadPresets();
      setSaveModalOpen(false);
      setPresetName('');
      setPresetDescription('');
      setSetAsDefault(false);
      setNameError(null);
      onSaveComplete?.();
    }
  }, [tableId, presetName, presetDescription, setAsDefault, currentConfiguration, reloadPresets, onSaveComplete]);

  // Apply preset
  const handleApplyPreset = useCallback((preset: ColumnPreset) => {
    onApplyPreset(preset);
  }, [onApplyPreset]);

  // Set as default
  const handleSetDefault = useCallback((presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (setDefaultPreset(tableId, presetId)) {
      reloadPresets();
    }
  }, [tableId, reloadPresets]);

  // Delete preset
  const handleDeletePreset = useCallback((presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: t('Delete Preset'),
      content: t('Are you sure you want to delete this preset? This action cannot be undone.'),
      okText: t('Delete'),
      okType: 'danger',
      onOk: () => {
        if (deletePreset(tableId, presetId)) {
          reloadPresets();
        }
      },
    });
  }, [tableId, reloadPresets]);

  // Duplicate preset
  const handleDuplicatePreset = useCallback((presetId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    let newName = `${preset.name} (Copy)`;
    let counter = 1;
    while (!isPresetNameAvailable(tableId, newName)) {
      counter++;
      newName = `${preset.name} (Copy ${counter})`;
    }

    if (duplicatePreset(tableId, presetId, newName)) {
      reloadPresets();
    }
  }, [tableId, presets, reloadPresets]);

  // Export presets
  const handleExport = useCallback(() => {
    const json = exportPresets(tableId);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `column-presets-${tableId}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [tableId]);

  // Import presets
  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target?.result as string;
        if (importPresets(tableId, content, true)) {
          reloadPresets();
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [tableId, reloadPresets]);

  // Preset list menu
  const presetListMenu = useMemo(() => {
    if (presets.length === 0) {
      return (
        <PresetList>
          <div className="empty-state">
            {t('No presets saved yet.')}
            <br />
            {t('Click "Save Current" to create your first preset.')}
          </div>
        </PresetList>
      );
    }

    return (
      <PresetList>
        {presets.map(preset => (
          <div
            key={preset.id}
            className={`preset-item ${preset.id === activePresetId ? 'active' : ''} ${preset.isDefault ? 'default' : ''}`}
            onClick={() => handleApplyPreset(preset)}
          >
            <div className="preset-info">
              <div className="preset-name">
                {preset.isDefault && (
                  <StarFilled style={{ color: '#faad14' }} />
                )}
                {preset.name}
              </div>
              {preset.description && (
                <div className="preset-description">{preset.description}</div>
              )}
              <div className="preset-meta">
                {new Date(preset.updatedAt).toLocaleDateString()}
              </div>
            </div>
            <div className="preset-actions">
              <Tooltip title={t('Set as default')}>
                <StarOutlined
                  className="action-icon"
                  onClick={(e) => handleSetDefault(preset.id, e)}
                />
              </Tooltip>
              <Tooltip title={t('Duplicate')}>
                <CopyOutlined
                  className="action-icon"
                  onClick={(e) => handleDuplicatePreset(preset.id, e)}
                />
              </Tooltip>
              <Tooltip title={t('Delete')}>
                <DeleteOutlined
                  className="action-icon"
                  onClick={(e) => handleDeletePreset(preset.id, e)}
                />
              </Tooltip>
            </div>
          </div>
        ))}
      </PresetList>
    );
  }, [presets, activePresetId, handleApplyPreset, handleSetDefault, handleDuplicatePreset, handleDeletePreset]);

  // More actions menu
  const moreActionsMenu = (
    <Menu>
      <Menu.Item key="export" icon={<DownloadOutlined />} onClick={handleExport}>
        {t('Export Presets')}
      </Menu.Item>
      <Menu.Item key="import" icon={<UploadOutlined />} onClick={handleImport}>
        {t('Import Presets')}
      </Menu.Item>
    </Menu>
  );

  return (
    <>
      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <Dropdown
          overlay={presetListMenu}
          trigger={['click']}
          placement="bottomLeft"
        >
          <PresetButton>
            <FolderOpenOutlined />
            {t('Presets')}
          </PresetButton>
        </Dropdown>

        <PresetButton onClick={() => setSaveModalOpen(true)}>
          <SaveOutlined />
          {t('Save Current')}
        </PresetButton>

        {presets.length > 0 && (
          <Dropdown
            overlay={moreActionsMenu}
            trigger={['click']}
            placement="bottomRight"
          >
            <PresetButton>
              <MoreOutlined />
            </PresetButton>
          </Dropdown>
        )}
      </div>

      <Modal
        title={t('Save Column Preset')}
        open={saveModalOpen}
        onOk={handleSavePreset}
        onCancel={() => {
          setSaveModalOpen(false);
          setPresetName('');
          setPresetDescription('');
          setSetAsDefault(false);
          setNameError(null);
        }}
        okText={t('Save')}
        okButtonProps={{ disabled: !!nameError || !presetName.trim() }}
      >
        <ModalContent>
          <div className="form-group">
            <label className="form-label" htmlFor="preset-name">
              {t('Preset Name')} <span style={{ color: 'red' }}>*</span>
            </label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={t('e.g., Sales View, Minimal Columns, etc.')}
              status={nameError ? 'error' : undefined}
            />
            {nameError && <div className="form-error">{nameError}</div>}
            <div className="form-help">
              {t('Choose a descriptive name for this column configuration')}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="preset-description">
              {t('Description')} <span style={{ color: '#999' }}>({t('optional')})</span>
            </label>
            <Input.TextArea
              id="preset-description"
              value={presetDescription}
              onChange={(e) => setPresetDescription(e.target.value)}
              placeholder={t('Add a description to help remember this preset...')}
              rows={2}
            />
          </div>

          <div className="form-group">
            <div className="checkbox-group">
              <input
                type="checkbox"
                id="set-default"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
              />
              <label htmlFor="set-default">
                {t('Set as default preset')}
              </label>
            </div>
            <div className="form-help">
              {t('The default preset will be automatically applied when the table loads')}
            </div>
          </div>

          <div className="form-group">
            <div className="form-label">{t('What will be saved:')}</div>
            <ul style={{ paddingLeft: 20, margin: '8px 0', fontSize: 13 }}>
              <li>{t('Visible columns')}</li>
              <li>{t('Column widths')}</li>
              <li>{t('Pinned columns (left/right)')}</li>
              <li>{t('Column order')}</li>
            </ul>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
