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
import { Modal, Tooltip, Flex, Select } from 'antd';
import { Button, JsonEditor } from '@superset-ui/core/components';
import {
  themeObject,
  exampleThemes,
  logging,
  SerializableThemeConfig,
  Theme,
  AnyThemeConfig,
} from '@superset-ui/core';
import { useState } from 'react';
import { Icons } from '@superset-ui/core/components/Icons';

interface ThemeEditorProps {
  tooltipTitle?: string;
  modalTitle?: string;
  theme?: Theme;
  setTheme?: (config: AnyThemeConfig) => void;
}

const ThemeEditor: React.FC<ThemeEditorProps> = ({
  tooltipTitle = 'Edit Theme',
  modalTitle = 'Theme Editor',
  theme,
  setTheme,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const jsonTheme =
    JSON.stringify(theme?.toSerializedConfig(), null, 2) || '{}';
  const [jsonMetadata, setJsonMetadata] = useState<string>(jsonTheme);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  // Get theme names for the Select options
  const themeOptions: { value: string; label: string }[] = Object.keys(
    exampleThemes,
  ).map(key => ({
    value: key,
    label: key,
  }));

  const handleOpenModal = (): void => {
    setIsModalOpen(true);
    setJsonMetadata(JSON.stringify(theme?.toSerializedConfig(), null, 2));
  };

  const handleCancel = (): void => {
    setIsModalOpen(false);
  };

  const handleSave = (): void => {
    try {
      const parsedTheme = JSON.parse(jsonMetadata);
      setTheme?.(parsedTheme);
      setIsModalOpen(false);
    } catch (error) {
      logging.error('Invalid JSON in theme editor:', error);
      alert('Error parsing JSON. Please check your input.');
    }
  };

  const handleThemeChange = (value: string): void => {
    setSelectedTheme(value);
    // When a theme is selected, update the JSON editor with the theme definition
    const themeData = exampleThemes[value] || ({} as SerializableThemeConfig);
    setJsonMetadata(JSON.stringify(themeData, null, 2));
  };

  return (
    <>
      <Tooltip title={tooltipTitle} placement="bottom">
        <Button
          buttonStyle="link"
          icon={
            <Icons.BgColorsOutlined
              iconSize="l"
              iconColor={themeObject.theme.colorPrimary}
            />
          }
          onClick={handleOpenModal}
          aria-label="Edit theme"
          size="large"
        />
      </Tooltip>
      <Modal
        title={modalTitle}
        open={isModalOpen}
        onCancel={handleCancel}
        width={800}
        centered
        styles={{
          body: {
            padding: '24px',
          },
        }}
        footer={
          <Flex justify="end" gap="small">
            <Button onClick={handleCancel} buttonStyle="secondary">
              Cancel
            </Button>
            <Button type="primary" onClick={handleSave}>
              Apply Theme
            </Button>
          </Flex>
        }
      >
        <Flex vertical gap="middle">
          <div>
            Select a theme template:
            <Select
              placeholder="Choose a theme"
              style={{ width: '100%', marginTop: '8px' }}
              options={themeOptions}
              onChange={handleThemeChange}
              value={selectedTheme}
            />
          </div>
          <JsonEditor
            showLoadingForImport
            name="json_metadata"
            value={jsonMetadata}
            onChange={setJsonMetadata}
            tabSize={2}
            width="100%"
            height="200px"
            wrapEnabled
          />
        </Flex>
      </Modal>
    </>
  );
};

export default ThemeEditor;
