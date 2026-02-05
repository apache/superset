import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import rison from 'rison';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tabs,
  Typography,
  Collapse,
  Badge,
  Tag,
} from 'antd';
import { Tooltip } from '@superset-ui/core/components';
import { SupersetClient } from '@superset-ui/core';
import { ControlHeader } from '@superset-ui/chart-controls';
import {
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  KeyOutlined,
  LinkOutlined,
  PlusOutlined,
  MoreOutlined,
  BarsOutlined,
  SendOutlined,
  ExportOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import {Controlled as CodeMirror} from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/javascript/javascript';

const { Option } = Select;
const { Title } = Typography;
const { TabPane } = Tabs;
const { Panel } = Collapse; // Destructure Panel from Collapse

const VISIBILITY_CONDITION_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'selected', label: 'Selected' },
  { value: 'unselected', label: 'UnSelected' },
]

// Local icon options used for validation in Advanced tab
const ICON_OPTIONS = [
  { value: 'plus', label: 'Plus' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'eye', label: 'Eye' },
  { value: 'link', label: 'Link' },
  { value: 'check', label: 'Check' },
  { value: 'key', label: 'Key' },
  { value: 'tag', label: 'Tag' },
  { value: 'more', label: 'More' },
];

const renderingStyles = `
    .remita-action-setup .ant-collapse-content-box {
      padding: 0;
    }
    .remita-action-setup .ant-card-head-wrapper {
      max-height: 1rem;
    }
    .remita-action-setup .ant-card-head {
      min-height: 2rem;
      padding: 5px 4px !important;
    }
  `;

const parseInitialValue = (value, valueColumn) => {
  if (!value) return []; // Return empty array if value is null or undefined

  let actions = [];

  // Parse the value if it's a string
  if (typeof value === 'string') {
    try {
      actions = JSON.parse(value);
    } catch (error) {
      actions = []; // Return empty array if parsing fails
    }
  } else if (Array.isArray(value)) {
    actions = value; // Use the value directly if it's already an array
  } else if (value instanceof Set) {
    actions = Array.from(value); // Convert Set to array
  } else {
    actions = []; // Return empty array for other cases
  }

  // Update valueColumn property if valueColumn is provided and not empty
  if (valueColumn && actions.length > 0) {
    actions = actions.map((action) => ({
      ...action,
      valueColumn: valueColumn, // Update valueColumn property
    }));
  }
  return actions;
};

const SplitActionsControl = ({
                               initialValue = [],
                               onChange = () => {},
                               language = 'json',
                               readOnly = false,
                               offerEditInModal = true,
                               ...rest
                             }) => {

  const toastSuccess = msg => (rest?.actions?.addSuccessToast ? rest.actions.addSuccessToast(msg) : null);
  const toastDanger = msg => (rest?.actions?.addDangerToast ? rest.actions.addDangerToast(msg) : null);

  const [actions, setActions] = useState(() => parseInitialValue(rest.value||rest.default,rest.valueColumn));
  const valueColumn = rest.valueColumn;
  const [editingIndex, setEditingIndex] = useState(null); // if null, then adding new action
  const [showAddForm, setShowAddForm] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [isPublishEvent, setIsPublishEvent] = useState(true);

  // Tab state for modal mode
  const [activeTab, setActiveTab] = useState('simple');
  // advancedJson holds the JSON text in advanced tab.
  const [advancedJson, setAdvancedJson] = useState('');
  const cmRef = useRef(null);
  const [validationError, setValidationError] = useState('');
  const [dashboards, setDashboards] = useState([]);
  const [loadingDashboards, setLoadingDashboards] = useState(false);

  const buildDashboardUrl = (dash, preselect) => {
    const slugOrId = dash ? (dash.slug || dash.id) : '';
    const base = `/superset/dashboard/${slugOrId}`;
    const pre = (preselect && String(preselect).trim()) || '';
    return pre ? `${base}?preselect_filters=${encodeURIComponent(pre)}` : base;
  };

  const ensureDashboardsLoaded = async () => {
    if (dashboards.length || loadingDashboards) return;
    try {
      setLoadingDashboards(true);
      const queryParams = rison.encode({
        columns: ['id', 'dashboard_title', 'slug'],
        page: 0,
        page_size: 5000,
      });
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/?q=${queryParams}`,
      });
      const result = Array.isArray(json?.result) ? json.result : [];
      setDashboards(
        result.map(d => ({
          id: d.id,
          title: d.dashboard_title || d.title || String(d.id),
          slug: d.slug || d.uuid || '',
        })),
      );
    } catch (e) {
      // ignore fetch errors in control UI
      console.error('[SplitActionsControl] Failed to load dashboards:', e);
    } finally {
      setLoadingDashboards(false);
    }
  };

  // Attempt to load dashboards on initial mount so the dropdown is not empty
  useEffect(() => {
    ensureDashboardsLoaded();
  }, []);

  // When modal opens, if advanced tab is active, update the advanced JSON text.
  useEffect(() => {
    if (modalVisible && activeTab === 'advanced') {
      if (editingIndex !== null) {
        setAdvancedJson(JSON.stringify(actions[editingIndex], null, 2));
      } else {
        setAdvancedJson(JSON.stringify(actions, null, 2));
      }
      setValidationError('');
      setTimeout(() => { if (cmRef.current) cmRef.current.refresh(); }, 50);
    }
  }, [modalVisible, activeTab, actions, editingIndex]);

  const closeModal = () => {
    setModalVisible(false);
    setEditingIndex(null);
    setShowAddForm(false);
    // Don't reset on close - will reset on next open when form is ready
  };

  const openModal = () => {
    setModalVisible(true);
    setEditingIndex(null);
    // If there are no actions, default to showing the add form in simple tab.
    setShowAddForm(actions.length === 0);
    ensureDashboardsLoaded();
    setIsPublishEvent(true);
  };

  // Reset form when modal opens
  useEffect(() => {
    if (modalVisible && (showAddForm || editingIndex === null)) {
      form.resetFields();
    }
  }, [modalVisible, showAddForm, editingIndex, form]);

  const openAddModal = () => {
    openModal();
    // Set sensible defaults for new actions (form is mounted with modal)
    form.setFieldsValue({
      boundToSelection: false,
      visibilityCondition: 'all',
      publishEvent: true,
    });
  };

  // Reveal add form in modal mode (only in Simple tab)
  const revealAddForm = () => {
    setShowAddForm(true);
    setEditingIndex(null);
    // Form will be reset by the useEffect above
  };

  const handleAddAction = (values) => {
    const newAction = {
      key: values.key,
      label: values.label,
      icon: values.icon,
      tooltip: values.tooltip,
      valueColumn: valueColumn,
      boundToSelection: values.boundToSelection,
      visibilityCondition: values.visibilityCondition,
      openInNewTab: Boolean(values.openInNewTab),
      includeDashboardFilters: Boolean(values.includeDashboardFilters),
      publishEvent: values.publishEvent || false,
      navigateTo: !values.publishEvent ? (values.navigateTo || 'url') : undefined,
      dashboardId: !values.publishEvent && values.navigateTo === 'dashboard' ? values.dashboardId : undefined,
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
    };
    const updatedActions = [...actions, newAction];
    setActions(updatedActions);
    onChange(updatedActions);
    toastSuccess('Action added');
    form.resetFields();
    setShowAddForm(false);
    setEditingIndex(null);
    // In simple tab mode, do not close the modal automatically.
  };

  const handleEditAction = (values) => {
    const updatedAction = {
      key: values.key,
      label: values.label,
      icon: values.icon,
      tooltip: values.tooltip,
      valueColumn: valueColumn,
      boundToSelection: values.boundToSelection,
      visibilityCondition: values.visibilityCondition,
      openInNewTab: Boolean(values.openInNewTab),
      includeDashboardFilters: Boolean(values.includeDashboardFilters),
      publishEvent: values.publishEvent || false,
      navigateTo: !values.publishEvent ? (values.navigateTo || 'url') : undefined,
      dashboardId: !values.publishEvent && values.navigateTo === 'dashboard' ? values.dashboardId : undefined,
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
    };
    const updatedActions = actions.map((action, idx) =>
      idx === editingIndex ? updatedAction : action
    );
    setActions(updatedActions);
    onChange(updatedActions);
    toastSuccess('Action updated');
    form.resetFields();
    setEditingIndex(null);
    // In simple tab mode, modal remains open.
  };

  const handleRemoveAction = (index) => {
    const updatedActions = actions.filter((_, idx) => idx !== index);
    setActions(updatedActions);
    onChange(updatedActions);
  };

  const validateUniqueKey = (_, value) => {
    if (!value) return Promise.resolve();
    const duplicate = actions.some(
      (action, idx) => idx !== editingIndex && action.key === value
    );
    return duplicate
      ? Promise.reject(new Error('Action key must be unique'))
      : Promise.resolve();
  };

  const validateUniqueLabel = (_, value) => {
    if (!value) return Promise.resolve();
    const duplicate = actions.some(
      (action, idx) => idx !== editingIndex && action.label === value
    );
    return duplicate
      ? Promise.reject(new Error('Action label must be unique'))
      : Promise.resolve();
  };

  const selectionEnabled = Boolean(rest?.selectionEnabled);

  // Render form fields used for both adding and editing in Simple tab.
  const renderFormFields = () => (
    <>
      <Form.Item
        name="key"
        label="Key"
        rules={[
          { required: true, message: 'Please enter a key' },
          { validator: validateUniqueKey },
        ]}
      >
        <Input placeholder="Action key" />
      </Form.Item>
      <Form.Item
        name="label"
        label="Label"
        rules={[
          { required: true, message: 'Please enter a label' },
          { validator: validateUniqueLabel },
        ]}
      >
        <Input placeholder="Action label" />
      </Form.Item>
      {selectionEnabled && (
        <Form.Item name="boundToSelection" valuePropName="checked">
          <Checkbox>Bound to Selection</Checkbox>
        </Form.Item>
      )}
      <Form.Item
        name="visibilityCondition"
        label="Visibility Condition"
        initialValue="all"
        rules={[{ required: true, message: 'Please select a visibility condition' }]}
      >
        <Select placeholder="Select a visibility condition">
          {VISIBILITY_CONDITION_OPTIONS.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        name="publishEvent"
        valuePropName="checked"
        initialValue
      >
        <Checkbox onChange={(e) => setIsPublishEvent(e.target.checked)}>
          Publish Event
        </Checkbox>
      </Form.Item>
      {/* Navigation helpers when not publishing an event */}
      {!isPublishEvent && (
        <>
          <Form.Item name="openInNewTab" valuePropName="checked">
            <Checkbox>Open in new tab</Checkbox>
          </Form.Item>
          <Form.Item name="includeDashboardFilters" valuePropName="checked" initialValue>
            <Checkbox>Include dashboard filters</Checkbox>
          </Form.Item>
          <Form.Item name="navigateTo" label="Navigate To" initialValue="url">
            <Select onChange={(val) => { if (val === 'dashboard') ensureDashboardsLoaded(); }}>
              <Option value="url">URL</Option>
              <Option value="dashboard">Dashboard</Option>
            </Select>
          </Form.Item>
          <Form.Item shouldUpdate={(prev, cur) => prev.navigateTo !== cur.navigateTo || prev.dashboardPreselect !== cur.dashboardPreselect} noStyle>
            {({ getFieldValue, setFieldsValue }) => getFieldValue('navigateTo') === 'dashboard' ? (
              <>
                <Form.Item name="dashboardId" label="Dashboard">
                  <Select
                    placeholder={loadingDashboards ? 'Loading dashboards...' : 'Select dashboard'}
                    loading={loadingDashboards}
                    onChange={(val) => {
                      const d = dashboards.find(x => String(x.id) === String(val));
                      const built = buildDashboardUrl(d, getFieldValue('dashboardPreselect'));
                      setFieldsValue({ actionUrl: built });
                    }}
                    showSearch
                    filterOption={(input, option) => {
                      try {
                        const d = dashboards.find(x => String(x.id) === String(option?.key));
                        const hay = `${option?.children || ''} ${(d?.slug || '')}`.toLowerCase();
                        return hay.includes(String(input).toLowerCase());
                      } catch { return true; }
                    }}
                  >
                    {dashboards.map(d => (
                      <Option key={String(d.id)} value={String(d.id)}>{d.title}</Option>
                    ))}
                  </Select>
                </Form.Item>
                <Form.Item name="dashboardPreselect" label="Preselect Filters (JSON)">
                  <Input.TextArea rows={2} placeholder='e.g. {"region":["East"]}' onChange={(e) => {
                    const val = getFieldValue('dashboardId');
                    const d = dashboards.find(x => String(x.id) === String(val));
                    const built = buildDashboardUrl(d, e?.target?.value || '');
                    setFieldsValue({ actionUrl: built });
                  }} />
                </Form.Item>
              </>
            ) : null}
          </Form.Item>
        </>
      )}
      {/* Show Action URL field when publish event is false */}
      {!isPublishEvent && (
        <Form.Item
          name="actionUrl"
          label="Action URL"
          rules={[{ required: true, message: 'Please enter an action URL' }]}
        >
          <Input placeholder="Enter action URL" />
        </Form.Item>
      )}
    </>
  );

  // Render a single action card. The card header (using title) shows the key floated left.
  // The extra prop shows compact action buttons (edit and delete) floated right.
  const renderCard = (action, index) => (
    <Card
      key={index}
      title={
        <div style={{ fontWeight: 'bold', fontSize: '0.8rem', padding: '2px 4px' }}>
          {action.key}
        </div>
      }
      headStyle={{ padding: '2px 4px' }}
      extra={
        !readOnly && (
          <div style={{ display: 'flex', gap: 4 }}>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => openModalWithEdit(index)}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRemoveAction(index)}
            />
          </div>
        )
      }
      style={{ marginBottom: '4px' }}
      bodyStyle={{ padding: '4px' }}
    >

      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space>
          {selectionEnabled && (
            <Tooltip title={`Bound: ${action.boundToSelection ? 'Yes' : 'No'}`}>
              {action.boundToSelection ? (
                <CheckOutlined style={{ color: 'green', fontSize: '0.8rem' }} />
              ) : (
                <CloseOutlined style={{ color: 'red', fontSize: '0.8rem' }} />
              )}
            </Tooltip>
          )}
          <Tooltip title={`Visibility: ${action.visibilityCondition}`}>
            <EyeOutlined style={{ fontSize: '0.8rem' }} />
          </Tooltip>
          <Tooltip title={`Publish Event: ${action.publishEvent ? 'Yes' : 'No'}`}>
            <BellOutlined style={{ color: action.publishEvent ? 'green' : 'grey', fontSize: '0.8rem' }} />
          </Tooltip>
          {(!action.publishEvent) && (
            <Tooltip title={`Action URL: ${action.actionUrl}`}>
              <LinkOutlined style={{ fontSize: '0.8rem' }} />
            </Tooltip>
          )}
          {/* Inline badges for quick glance */}
          <Tooltip title={action.publishEvent ? 'Publishes Event' : 'Navigates to URL/Dashboard'}>
            {action.publishEvent ? (
              <SendOutlined style={{ color: '#1890ff', fontSize: '0.8rem' }} />
            ) : (
              <GlobalOutlined style={{ color: '#1890ff', fontSize: '0.8rem' }} />
            )}
          </Tooltip>
          {action.openInNewTab ? (
            <Tooltip title="Opens in New Tab">
              <ExportOutlined style={{ color: '#faad14', fontSize: '0.8rem' }} />
            </Tooltip>
          ) : null}
          {selectionEnabled && action.boundToSelection ? (
            <Tooltip title="Bound to Selection">
              <LinkOutlined style={{ color: '#722ed1', fontSize: '0.8rem' }} />
            </Tooltip>
          ) : null}
          {action.visibilityCondition ? (() => {
            const v = String(action.visibilityCondition).toLowerCase();
            const color = v === 'selected' ? '#52c41a' : v === 'unselected' ? '#f5222d' : '#8c8c8c';
            const label = v.charAt(0).toUpperCase() + v.slice(1);
            const title = `Visibility: ${label}`;
            return (
              <Tooltip title={title}>
                <EyeOutlined style={{ color: color, fontSize: '0.8rem' }} />
              </Tooltip>
            );
          })() : null}
        </Space>
      </Space>
    </Card>
  );

  const openModalWithEdit = (index) => {
    const action = actions[index];
    setEditingIndex(index);
    form.setFieldsValue({
      key: action.key,
      label: action.label,
      icon: action.icon,
      tooltip: action.tooltip,
      boundToSelection: action.boundToSelection,
      actionUrl: action.actionUrl,
      visibilityCondition: action.visibilityCondition,
      publishEvent: action.publishEvent,
      openInNewTab: Boolean(action.openInNewTab),
      navigateTo: action.navigateTo || (action.actionUrl && String(action.actionUrl).includes('/superset/dashboard/') ? 'dashboard' : 'url'),
      dashboardId: action.dashboardId,
      dashboardPreselect: (() => {
        try {
          const url = String(action.actionUrl || '');
          const idx = url.indexOf('preselect_filters=');
          if (idx >= 0) {
            const val = url.substring(idx + 'preselect_filters='.length);
            return decodeURIComponent(val);
          }
        } catch {}
        return undefined;
      })(),
    });
    setIsPublishEvent(Boolean(action.publishEvent ?? true));
    try { form.setFieldsValue({ includeDashboardFilters: Boolean(action.includeDashboardFilters ?? true) }); } catch {}
    try {
      const nav = action.navigateTo || (action.actionUrl && String(action.actionUrl).includes('/superset/dashboard/') ? 'dashboard' : 'url');
      if (nav === 'dashboard') ensureDashboardsLoaded();
    } catch {}
    setModalVisible(true);
  };

  // Modal content now uses Tabs: "Simple" for single object editing UI and "Advanced" for JSON editing.
  const renderModalContent = () => {
    const handleTabChange = (key) => {
      setActiveTab(key);
      if (key === 'advanced') {
        // When switching to advanced, if editing a single action, show its JSON, else show full array.
        if (editingIndex !== null) {
          setAdvancedJson(JSON.stringify(actions[editingIndex], null, 2));
        } else {
          setAdvancedJson(JSON.stringify(actions, null, 2));
        }
        setValidationError('');
        setTimeout(() => { if (cmRef.current) cmRef.current.refresh(); }, 50);
      }
    };

    const schemaInfo = (
      <Collapse defaultActiveKey={[]} ghost>
        <Panel header="JSON Schema Information" key="1">
          <div style={{ marginBottom: '8px' }}>
            <p>
              The JSON configuration should follow this structure:
            </p>
            <pre>
          {`
[
  {
    "key": "action_key", // Unique identifier for the action
    "label": "Action Label", // Display name for the action
    "icon": "plus", // Optional icon (plus, edit, delete, eye, link, check, key, tag, more)
    "tooltip": "Optional tooltip",
    "boundToSelection": false, // Whether the action is bound to row selection
    "visibilityCondition": "all", // Visibility: "selected", "all" (default), or "unselected"
    "openInNewTab": false, // Open target in a new tab
    "publishEvent": true, // Default is true; when false, a URL is required
    "navigateTo": "url", // "url" | "dashboard"; used when publishEvent is false
    "dashboardId": 12, // Dashboard to navigate to (when navigateTo = "dashboard")
    "actionUrl": "/path-or-dashboard-url", // Required when publishEvent is false
    "showInSliceHeader": true // Whether to show in slice header (dropdown actions are hidden here when true)
  }
]
          `}
        </pre>
            <p>
              <strong>Notes:</strong>
              <br />- <code>visibilityCondition</code>: "selected" | "all" (default) | "unselected"
              <br />- <code>publishEvent</code>: default true. If set to false, a valid <code>actionUrl</code> (or dashboard target) is required.
            </p>
          </div>
        </Panel>
      </Collapse>
    );
    // Define a placeholder for the Advanced Tab
    const advancedTabPlaceholder = JSON.stringify(
      [
        {
          key: 'delete',
          label: 'Delete',
          style: 'danger',
          boundToSelection: true,
          visibilityCondition: 'selected',
          publishEvent : false,
          actionUrl: "/slice/1",
          showInSliceHeader: true
        },
      ],
      null,
      2
    );

    // use top-level activeTab and advancedJson state for consistency

    const handleAdvancedSave = () => {
      try {
        const parsed = JSON.parse(advancedJson);
        if (editingIndex !== null) {
                  const updatedActions = actions.map((action, idx) =>
                      idx === editingIndex ? parsed : action
                    );
                    setActions(updatedActions);
                    onChange(updatedActions);
        } else {
          setActions(parsed);
          onChange(JSON.stringify(parsed));
        }
      } catch (err) {
      }
    };

    return (
      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane tab="Simple" key="simple">
          { (showAddForm || editingIndex !== null) && (
            <>
              <Form
                form={form}
                onFinish={editingIndex === null ? handleAddAction : handleEditAction}
                layout="vertical"
                style={{ marginBottom: '8px' }}
              >
                {renderFormFields()}
                <Space style={{ marginTop: 8 }}>
                  <Button type="primary" htmlType="submit">
                    {editingIndex === null ? 'Add Action' : 'Save Changes'}
                  </Button>
                  <Button onClick={closeModal}>Cancel</Button>
                </Space>
              </Form>
              <Divider style={{ margin: '8px 0' }} />
            </>
          )}
          <Space direction="vertical" style={{ width: '100%' }}>
            {actions.length === 0 ? (
              <Alert
                message="No split table header actions added yet."
                type="info"
                showIcon
                style={{ marginBottom: '8px' }}
              />
            ) : (
              actions.map((action, index) => renderCard(action, index))
            )}
          </Space>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={revealAddForm}>
              Add New Action
            </Button>
          </div>
        </TabPane>
        <TabPane tab="Advanced" key="advanced">
          {schemaInfo} {/* Display schema information inside an accordion */}
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, minHeight: 220 }}>
            <CodeMirror
              value={actions.length === 0 ? '' : advancedJson}
              placeholder={actions.length === 0 ? advancedTabPlaceholder : ''}
              options={{
                mode: 'javascript',
                theme: 'material',
                lineNumbers: true,
                readOnly: false,
                lineWrapping: true,
                viewportMargin: Infinity,
              }}
              editorDidMount={(editor) => { cmRef.current = editor; setTimeout(() => editor.refresh(), 0); }}
              onBeforeChange={(editor, data, value) => {
                setAdvancedJson(value);
                if (validationError) setValidationError('');
              }}
            />
          </div>
          {validationError ? (
            <Alert type="error" showIcon style={{ marginTop: 8 }} message={validationError} />
          ) : null}
          <Space style={{ marginTop: 8 }}>
            <Button
              onClick={() => {
                try {
                  const parsed = JSON.parse(advancedJson);
                  setAdvancedJson(JSON.stringify(parsed, null, 2));
                  toastSuccess('JSON formatted');
                } catch (_) {
                  const msg = 'Invalid JSON';
                  setValidationError(msg);
                  toastDanger(msg);
                }
              }}
            >
              Prettify
            </Button>
            <Button
              type="primary"
              onClick={() => {
                try {
                  const parsed = JSON.parse(advancedJson);
                  const allowed = new Set(ICON_OPTIONS.map(o => o.value));
                  const invalid = (Array.isArray(parsed) ? parsed : [parsed]).some(a => a.icon && !allowed.has(a.icon));
                  if (invalid) {
                    const msg = 'Invalid icon specified in JSON.';
                    setValidationError(msg);
                    toastDanger(msg);
                    return;
                  }
                  const arr = Array.isArray(parsed) ? parsed : [parsed];
                  for (const a of arr) {
                    if (!a || typeof a !== 'object') { const msg='Each action must be an object'; setValidationError(msg); toastDanger(msg); return; }
                    if (!a.key || typeof a.key !== 'string') { const msg='Each action must have a non-empty "key"'; setValidationError(msg); toastDanger(msg); return; }
                    if (!a.label || typeof a.label !== 'string') { const msg=`Action "${a.key}": missing "label"`; setValidationError(msg); toastDanger(msg); return; }
                    if (a.publishEvent === false && (!a.actionUrl || typeof a.actionUrl !== 'string')) { const msg=`Action "${a.key}": "actionUrl" is required when publishEvent is false`; setValidationError(msg); toastDanger(msg); return; }
                  }
                  if (editingIndex !== null) {
                    const updatedActions = actions.map((action, idx) =>
                      idx === editingIndex ? parsed : action
                    );
                    setActions(updatedActions);
                    onChange(JSON.stringify(updatedActions));
                    const count = Array.isArray(parsed) ? parsed.length : 1;
                    toastSuccess(`JSON saved (${count} action${count !== 1 ? 's' : ''})`);
                  } else {
                    setActions(parsed);
                    onChange(parsed);
                    const count = Array.isArray(parsed) ? parsed.length : 1;
                    toastSuccess(`JSON saved (${count} action${count !== 1 ? 's' : ''})`);
                  }
                } catch (err) {
                  const msg = 'Invalid JSON';
                  setValidationError(msg);
                  toastDanger(msg);
                }
              }}
            >
              Save JSON
            </Button>
            <Button onClick={closeModal}>Cancel</Button>
          </Space>
        </TabPane>
      </Tabs>
    );
  };

  const renderInlineContent = () => (
<>
  <style>{renderingStyles}</style>
  <Collapse
    defaultActiveKey={['1']}
    ghost
    className={'remita-action-setup'}
    expandIconPosition="end" // Ensures the arrow is positioned on the right
    expandIcon={({ isActive }) => (
      <span
        style={{
          display: 'inline-block',
          transform: isActive ? 'rotate(90deg)' : 'rotate(-90deg)',
          transition: 'transform 0.2s ease',
        }}
      >
        <svg viewBox="64 64 896 896" focusable="false" data-icon="right" width="1em" height="1em" fill="currentColor"
             aria-hidden="true" ><path
          d="M765.7 486.8L314.9 134.7A7.97 7.97 0 00302 141v77.3c0 4.9 2.3 9.6 6.1 12.6l360 281.1-360 281.1c-3.9 3-6.1 7.7-6.1 12.6V883c0 6.7 7.7 10.4 12.9 6.3l450.8-352.1a31.96 31.96 0 000-50.4z"></path></svg>
      </span>

    )}
    style={{width: '100%', padding: 0}}
  >
    <Collapse.Panel
      key="1"
      style={{padding: 0}}
      header={
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <span>Table Split Actions</span>
          <Badge
            count={actions.length}
            style={{
              padding: '0 8px',
              marginLeft: '8px',
              borderRadius: '4px',
              fontSize: '12px',
              backgroundColor: '#eee',
              color: '#666',
              fontWeight: 500,
            }}
          />
        </div>
      }
    >
      <div direction="vertical" style={{ width: '100%', padding: 0 }}>
        {actions.length === 0 ? (
          <>
            <Alert
              message="No split table header actions added yet."
              type="info"
              showIcon
              style={{ marginBottom: '8px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAddModal}
              >
                Add New Action
              </Button>
            </div>
          </>
        ) : (
          actions.map((action, index) => renderCard(action, index))
        )}
      </div>
    </Collapse.Panel>
  </Collapse>
</>
  );

  return (
    <div>
      <ControlHeader />
      {offerEditInModal ? (
        <>
          <div style={{ marginBottom: '8px' }}>
            {actions.length === 0 ? (
              <>
                <Alert
                  message="No split table header actions added yet."
                  type="info"
                  showIcon
                  style={{ marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                    Add New Split Action
                  </Button>
                </div>
              </>
            ) : (
              renderInlineContent()
            )}
          </div>
          {!readOnly && actions.length>0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button size="small" type="primary" onClick={openAddModal} icon={<EditOutlined />}>
                Edit Split Actions
              </Button>
            </div>
          )}
          {modalVisible && (
            <Modal
              title="Manage Split Table Header Actions"
              open={true}
              onCancel={closeModal}
              footer={<Button size="small" onClick={closeModal}>Done</Button>}
              width="500px"
              bodyStyle={{ padding: '12px' }}
              zIndex={10000}
              maskStyle={{ zIndex: 9999 }}
              getContainer={() => document.body}
            >
              {renderModalContent()}
            </Modal>
          )}
        </>
      ) : (
        renderInlineContent()
      )}
    </div>
  );
};

SplitActionsControl.propTypes = {
  initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  onChange: PropTypes.func,
  language: PropTypes.string,
  readOnly: PropTypes.bool,
  offerEditInModal: PropTypes.bool,
};

export default SplitActionsControl;
