import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Modal, Space, Input, Typography } from 'antd';
import { ControlHeader } from '@superset-ui/chart-controls';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/markdown/markdown';
import { SafeMarkdown } from '@superset-ui/core/components';

const { TextArea } = Input;

const DescriptionMarkdownControl = ({ value = '', onChange = () => {}, rows = 4, offerEditInModal = true }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [advancedText, setAdvancedText] = useState(String(value || ''));
  const [inlineText, setInlineText] = useState(String(value || ''));

  // keep inline in sync with incoming value
  useEffect(() => {
    const v = String(value || '');
    setInlineText(v);
    setAdvancedText(v);
  }, [value]);

  const handleInlineChange = e => {
    const v = e?.target?.value ?? '';
    setInlineText(v);
    onChange(v);
    // reflect in modal editor if open
    if (modalVisible) {
      setAdvancedText(v);
    }
  };

  const openModal = () => {
    setAdvancedText(String(inlineText || ''));
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const saveModal = () => {
    onChange(advancedText);
    setInlineText(advancedText);
    setModalVisible(false);
  };

  return (
    <div>
      <ControlHeader />
      <Space direction="vertical" style={{ width: '100%' }}>
        <TextArea rows={rows} value={inlineText} onChange={handleInlineChange} placeholder="Enter Markdown description" />
        {offerEditInModal && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" onClick={openModal}>Open Markdown Editor</Button>
          </div>
        )}
      </Space>
      {offerEditInModal && (
        <Modal
          title="Edit Description (Markdown)"
          open={modalVisible}
          onCancel={closeModal}
          footer={[
            <Button key="cancel" onClick={closeModal}>Cancel</Button>,
            <Button key="save" type="primary" onClick={saveModal}>Save</Button>,
          ]}
          width={640}
          bodyStyle={{ padding: 12 }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <div style={{ flex: 1, minWidth: 0, border: '1px solid #f0f0f0', borderRadius: 4, minHeight: 240 }}>
              <CodeMirror
                value={advancedText}
                options={{
                  mode: 'markdown',
                  theme: 'material',
                  lineNumbers: true,
                  lineWrapping: true,
                }}
                onBeforeChange={(editor, data, v) => setAdvancedText(v)}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, border: '1px solid #f0f0f0', borderRadius: 4, padding: 8, overflow: 'auto' }}>
              <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>Preview</Typography.Text>
              <div>
                <SafeMarkdown source={advancedText} />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

DescriptionMarkdownControl.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  rows: PropTypes.number,
  offerEditInModal: PropTypes.bool,
};

export default DescriptionMarkdownControl;
