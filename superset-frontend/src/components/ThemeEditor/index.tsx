import { Modal, Button, Tooltip, App, Flex, Typography } from 'antd-v5';
import { t, themeObject } from '@superset-ui/core';
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

  const handleEditorChange = newValue => {
    setThemeContent(newValue);
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
