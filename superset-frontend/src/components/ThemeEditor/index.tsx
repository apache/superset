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

import { Modal, Button, Tooltip, Flex } from 'antd-v5';
import { themeObject } from '@superset-ui/core';
import { useState } from 'react';
import Icons from 'src/components/Icons';
import { JsonEditor } from 'src/components/AsyncAceEditor';

const ThemeEditor = ({
  initialTheme = {},
  tooltipTitle = 'Edit Theme',
  modalTitle = 'Theme Editor',
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jsonMetadata, setJsonMetadata] = useState('{}');

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCancel = () => {
    setIsModalOpen(false);
  };

  const handleSave = () => {
    try {
      const parsedTheme = JSON.parse(jsonMetadata);
      console.log('Parsed theme:', parsedTheme);
      themeObject.setConfig(parsedTheme);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Invalid JSON in theme editor:', error);
      alert('Error parsing JSON. Please check your input.');
    }
  };

  return (
    <>
      <Tooltip title={tooltipTitle} placement="bottom">
        <Button
          type="text"
          icon={<Icons.EditOutlined />}
          onClick={handleOpenModal}
          aria-label="Edit theme"
          size="large"
        />
      </Tooltip>

      <Modal
        title="Theme Editor"
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
            <Button onClick={handleCancel}>Cancel</Button>
            <Button type="primary" onClick={handleSave}>
              Apply Theme
            </Button>
          </Flex>
        }
      >
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
      </Modal>
    </>
  );
};

export default ThemeEditor;
