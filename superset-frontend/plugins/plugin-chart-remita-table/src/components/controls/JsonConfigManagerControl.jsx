import React, { useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ControlHeader } from '@superset-ui/chart-controls';
import { Button, Modal, Space } from 'antd';
import { Tooltip } from '@superset-ui/core/components';
import {
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { Controlled as CodeMirror } from 'react-codemirror2';
import { isBlockedJsonKey, sanitizeImportedConfig } from '../../utils/jsonConfig';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/javascript/javascript';

// Helper: derive a plain object of current control values
function extractControlValues(controls) {
  const result = {};
  if (!controls || typeof controls !== 'object') return result;
  Object.keys(controls).forEach(key => {
    // Each control is a ControlState; capture its `value`
    const v = controls[key]?.value;
    // Avoid including undefined to keep output cleaner
    if (v !== undefined) result[key] = v;
  });
  return result;
}

// Helper: sanitize exported form data (optional noop for now)
function sanitizeExport(obj = {}) {
  // Keep as-is; callers can prune fields if desired
  return obj;
}

const JsonConfigManagerControl = props => {
  const {
    value,
    onChange,
    controls,
    form_data: formData,
    actions,
  } = props;

  const fileInputRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editorText, setEditorText] = useState('');
  const addSuccessToast = actions?.addSuccessToast || (() => {});
  const addDangerToast = actions?.addDangerToast || (() => {});

  const currentConfig = useMemo(() => {
    // Prefer full form_data if available (closest to what the chart receives)
    const base = formData && typeof formData === 'object' && Object.keys(formData).length
      ? formData
      : extractControlValues(controls);
    // Create a shallow copy to avoid exposing internal references
    return sanitizeExport({ ...base });
  }, [controls, formData]);

  const currentConfigJson = useMemo(
    () => {
      try {
        return JSON.stringify(currentConfig, null, 2);
      } catch (e) {
        return '{}';
      }
    },
    [currentConfig],
  );

  const openEditor = () => {
    // Seed editor with last value if provided; else with current config
    let seed = '';
    if (value) {
      if (typeof value === 'string') {
        seed = value;
      } else {
        try { seed = JSON.stringify(value, null, 2); } catch {
          seed = currentConfigJson;
        }
      }
    } else {
      seed = currentConfigJson;
    }
    setEditorText(seed);
    setIsModalOpen(true);
  };

  const closeEditor = () => setIsModalOpen(false);

  const applyParsedConfig = parsed => {
    // Persist JSON string in this control for formDataOverrides to pick up
    onChange?.(JSON.stringify(parsed));
    // Also propagate to individual controls so the UI reflects applied config
    try {
      if (actions && typeof actions.setControlValue === 'function' && controls) {
        Object.keys(parsed || {}).forEach(k => {
          if (!isBlockedJsonKey(k) && controls[k] !== undefined) {
            actions.setControlValue(k, parsed[k]);
          }
        });
      }
    } catch (_) {
      // Non-fatal if propagation fails
    }
  };

  const applyEditor = () => {
    try {
      const parsed = JSON.parse(editorText);
      applyParsedConfig(parsed);
      setIsModalOpen(false);
      addSuccessToast('Configuration applied');
    } catch (e) {
      addDangerToast(`Invalid JSON: ${e?.message || 'Parse error'}`);
    }
  };

  const doExport = () => {
    const blob = new Blob([currentConfigJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `remita-table-config.json`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImportClick = () => fileInputRef.current?.click();

  const onFileChange = evt => {
    const file = evt?.target?.files?.[0];
    // Reset value to allow re-upload same file
    evt.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      try {
        const parsed = sanitizeImportedConfig(JSON.parse(text));
        applyParsedConfig(parsed);
        addSuccessToast('Configuration imported and applied');
      } catch (e) {
        addDangerToast(`Invalid JSON file: ${e?.message || 'Parse error'}`);
      }
    };
    reader.onerror = () => addDangerToast('Failed to read file');
    reader.readAsText(file);
  };

  return (
    <div>
      <ControlHeader />
      <Space wrap>
        <Tooltip title="Import JSON configuration">
          <Button icon={<UploadOutlined />} onClick={onImportClick}>
            Import
          </Button>
        </Tooltip>
        <Tooltip title="Export current configuration">
          <Button icon={<DownloadOutlined />} onClick={doExport}>
            Export
          </Button>
        </Tooltip>
        <Tooltip title="Edit JSON configuration">
          <Button icon={<EditOutlined />} onClick={openEditor}>
            Edit
          </Button>
        </Tooltip>
        <input
          type="file"
          accept="application/json,.json"
          ref={fileInputRef}
          onChange={onFileChange}
          style={{ display: 'none' }}
        />
      </Space>

      <Modal
        title="Edit Configuration (JSON)"
        open={isModalOpen}
        onCancel={closeEditor}
        okText="Apply"
        onOk={applyEditor}
        width={760}
        bodyStyle={{ padding: 12 }}
        destroyOnClose
      >
        <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, minHeight: 320 }}>
          <CodeMirror
            value={editorText}
            options={{
              mode: { name: 'javascript', json: true },
              theme: 'material',
              lineNumbers: true,
              lineWrapping: true,
              tabSize: 2,
            }}
            onBeforeChange={(editor, data, value) => setEditorText(value)}
          />
        </div>
      </Modal>
    </div>
  );
};

JsonConfigManagerControl.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  onChange: PropTypes.func,
  controls: PropTypes.object,
  form_data: PropTypes.object,
  actions: PropTypes.object,
};
export default JsonConfigManagerControl;
