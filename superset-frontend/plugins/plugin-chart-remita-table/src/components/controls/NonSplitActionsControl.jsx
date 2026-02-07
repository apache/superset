import React, { useEffect, useState } from 'react';
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
import { useTheme } from '@apache-superset/core/ui';
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
  TagOutlined,
  BarsOutlined,
  SendOutlined,
  ExportOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { ControlHeader } from '@superset-ui/chart-controls';
import {Controlled as CodeMirror} from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/javascript/javascript';

const { Option } = Select;
const { TabPane } = Tabs;
const { Panel } = Collapse; // Destructure Panel from Collapse

const STYLE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'primary', label: 'Primary' },
  { value: 'danger', label: 'Danger' },
  { value: 'success', label: 'Success' },
  { value: 'warning', label: 'Warning' },
];

const VISIBILITY_CONDITION_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'selected', label: 'Selected' },
  { value: 'unselected', label: 'UnSelected' },
];

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

// Map style values to colors
const STYLE_COLORS = {
  default: 'grey',
  primary: 'blue',
  danger: 'red',
  success: 'green',
  warning: 'orange',
};

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
const NonSplitActionsControl = ({
                                  initialValue = [],
                                  onChange = () => {},
                                  language = 'json',
                                  readOnly = false,
                                  offerEditInModal = true,
                                  ...rest
                                }) => {
  const theme = useTheme();
  const toastSuccess = msg => (rest?.actions?.addSuccessToast ? rest.actions.addSuccessToast(msg) : null);
  const toastDanger = msg => (rest?.actions?.addDangerToast ? rest.actions.addDangerToast(msg) : null);

  const valueColumn = rest.valueColumn;
  const [actions, setActions] = useState(() => parseInitialValue(rest.value || rest.default,valueColumn));

  const [editingIndex, setEditingIndex] = useState(null); // if null, then adding a new action
  const [showAddForm, setShowAddForm] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [isPublishEvent, setIsPublishEvent] = useState(true);
  const [activeTab, setActiveTab] = useState('simple');

  const [advancedJson, setAdvancedJson] = useState('');
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
      setDashboards(result.map(d => ({ id: d.id, title: d.dashboard_title, slug: d.slug })));
    } catch (e) {
      console.error('[NonSplitActionsControl] Failed to load dashboards:', e);
    } finally {
      setLoadingDashboards(false);
    }
  };

  // When modal opens and Advanced tab is active, update JSON text
  useEffect(() => {
    if (modalVisible && activeTab === 'advanced') {
      if (editingIndex !== null) {
        setAdvancedJson(JSON.stringify(actions[editingIndex], null, 2));
      } else {
        setAdvancedJson(JSON.stringify(actions, null, 2));
      }
    }
  }, [modalVisible, activeTab, actions, editingIndex]);

  // Preload dashboards for dropdown
  useEffect(() => {
    ensureDashboardsLoaded();
  }, []);

  const closeModal = () => {
    setModalVisible(false);
    setEditingIndex(null);
    setShowAddForm(false);
    // Don't reset on close - will reset on next open when form is ready
  };

  const openModal = () => {
    setModalVisible(true);
    setEditingIndex(null);
    // If no actions exist, default to showing the add form
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

  // In modal Simple tab, reveal the add form
  const revealAddForm = () => {
    setShowAddForm(true);
    setEditingIndex(null);
    // Form will be reset by the useEffect above
  };

  const handleAddAction = (values) => {
    const newAction = {
      key: values.key,
      valueColumn: valueColumn,
      label: values.label,
      icon: values.icon,
      tooltip: values.tooltip,
      style: values.style,
      boundToSelection: values.boundToSelection,
      visibilityCondition: values.visibilityCondition,
      rlsVisibilityConditions: values.rlsVisibilityConditions || [],
      publishEvent: values.publishEvent || false,
      openInNewTab: Boolean(values.openInNewTab),
      includeDashboardFilters: Boolean(values.includeDashboardFilters),
      navigateTo: !values.publishEvent ? (values.navigateTo || 'url') : undefined,
      dashboardId: !values.publishEvent && values.navigateTo === 'dashboard' ? values.dashboardId : undefined,
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
      showInSliceHeader: values.showInSliceHeader || false,
    };
    const updatedActions = [...actions, newAction];
    setActions(updatedActions);
    onChange(updatedActions);
    toastSuccess('Action added');
    form.resetFields();
    setShowAddForm(false);
    setEditingIndex(null);
  };

  const handleEditAction = (values) => {
    const updatedAction = {
      key: values.key,
      label: values.label,
      valueColumn: valueColumn,
      icon: values.icon,
      tooltip: values.tooltip,
      style: values.style,
      boundToSelection: values.boundToSelection,
      visibilityCondition: values.visibilityCondition,
      rlsVisibilityConditions: values.rlsVisibilityConditions || [],
      publishEvent: values.publishEvent || false,
      openInNewTab: Boolean(values.openInNewTab),
      includeDashboardFilters: Boolean(values.includeDashboardFilters),
      navigateTo: !values.publishEvent ? (values.navigateTo || 'url') : undefined,
      dashboardId: !values.publishEvent && values.navigateTo === 'dashboard' ? values.dashboardId : undefined,
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
      showInSliceHeader: values.showInSliceHeader || false,
    };
    const updatedActions = actions.map((action, idx) =>
      idx === editingIndex ? updatedAction : action
    );
    setActions(updatedActions);
    onChange(updatedActions);
    toastSuccess('Action updated');
    form.resetFields();
    setEditingIndex(null);
  };

  const handleRemoveAction = (index) => {
    const updatedActions = actions.filter((_, idx) => idx !== index);
    setActions(updatedActions);
    onChange(updatedActions);
    toastSuccess('Action removed');
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

  // Component to render the TagOutlined icon with dynamic styles
  const TagIcon = ({ action }) => {
    // Determine the color based on the action.style value
    const color = STYLE_COLORS[action.style] || STYLE_COLORS.default;

    return (
      <TagOutlined
        style={{
          color: color,
          fontSize: '0.8rem',
        }}
      />
    );
  };

  // Render form fields used for adding/editing in the Simple tab
  const selectionEnabled = Boolean(rest?.selectionEnabled);

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
      <Form.Item
        name="style"
        label="Style"
        rules={[{ required: true, message: 'Please select a style' }]}
      >
        <Select placeholder="Select a style">
          {STYLE_OPTIONS.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="icon" label="Icon">
        <Select placeholder="Optional icon">
          {ICON_OPTIONS.map(opt => (
            <Option key={opt.value} value={opt.value}>
              {opt.label}
            </Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="tooltip" label="Tooltip">
        <Input placeholder="Optional tooltip text" />
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

      {/* RLS Visibility Conditions - AND logic only */}
      <Divider style={{ margin: '12px 0' }} />
      <Form.Item label="RLS Token Visibility Conditions (All must match - AND)">
        <Form.List name="rlsVisibilityConditions">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                  <Form.Item
                    {...restField}
                    name={[name, 'rlsKey']}
                    rules={[{ required: true, message: 'RLS key required' }]}
                    style={{ marginBottom: 0, width: 150 }}
                  >
                    <Input placeholder="RLS key" size="small" />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'operator']}
                    rules={[{ required: true, message: 'Required' }]}
                    style={{ marginBottom: 0, width: 100 }}
                  >
                    <Select placeholder="Operator" size="small">
                      <Option value="==">==</Option>
                      <Option value="!=">!=</Option>
                      <Option value="IN">IN</Option>
                      <Option value="NOT IN">NOT IN</Option>
                    </Select>
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'value']}
                    rules={[{ required: true, message: 'Value required' }]}
                    style={{ marginBottom: 0, flex: 1 }}
                  >
                    <Input placeholder="Value" size="small" />
                  </Form.Item>
                  <DeleteOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                </Space>
              ))}
              <Button
                type="dashed"
                onClick={() => add()}
                block
                size="small"
                icon={<PlusOutlined />}
                style={{ marginTop: fields.length > 0 ? 8 : 0 }}
              >
                Add RLS Condition
              </Button>
            </>
          )}
        </Form.List>
      </Form.Item>

      <Form.Item name="publishEvent" valuePropName="checked" initialValue>
        <Checkbox onChange={(e) => setIsPublishEvent(e.target.checked)}>
          Publish Event
        </Checkbox>
      </Form.Item>
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
      <Form.Item shouldUpdate={(prev, cur) => prev.publishEvent !== cur.publishEvent} noStyle>
        {({ getFieldValue }) =>
          !getFieldValue('publishEvent') && (
            <Form.Item
              name="actionUrl"
              label="Action URL"
              rules={[{ required: true, message: 'Please enter an action URL' }]}
            >
              <Input placeholder="Enter action URL" />
            </Form.Item>
          )}
      </Form.Item>
      <Form.Item name="showInSliceHeader" valuePropName="checked">
        <Checkbox>Show In Slice Header</Checkbox>
      </Form.Item>
    </>
  );

  // Render a single action card (mirroring the Split UI)
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
          <Tooltip title={`Style: ${action.style}`}>
            <TagIcon action={action} />
          </Tooltip>
          <span style={{ color: STYLE_COLORS[action.style] || STYLE_COLORS.default, fontWeight: 500 }}>
            {action.label}
          </span>
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
          {!action.publishEvent && action.actionUrl && (
            <Tooltip title={`Action URL: ${action.actionUrl}`}>
              <LinkOutlined style={{ fontSize: '0.8rem' }} />
            </Tooltip>
          )}
          <Tooltip title={`Show In Slice Header: ${action.showInSliceHeader ? 'Yes' : 'No'}`}>
            <BarsOutlined style={{ color: action.showInSliceHeader ? 'green' : 'grey', fontSize: '0.8rem' }} />
          </Tooltip>
          {/* Inline badges */}
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

  // Open modal in edit mode for a selected action
  const openModalWithEdit = (index) => {
    const action = actions[index];
    setEditingIndex(index);
    form.setFieldsValue({
      key: action.key,
      label: action.label,
      style: action.style,
      boundToSelection: action.boundToSelection,
      visibilityCondition: action.visibilityCondition,
      rlsVisibilityConditions: action.rlsVisibilityConditions || [],
      publishEvent: action.publishEvent,
      actionUrl: action.actionUrl,
      openInNewTab: Boolean(action.openInNewTab),
      includeDashboardFilters: Boolean(action.includeDashboardFilters ?? true),
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
      showInSliceHeader: action.showInSliceHeader,
    });
    setIsPublishEvent(Boolean(action.publishEvent ?? true));
    try {
      const nav = action.navigateTo || (action.actionUrl && String(action.actionUrl).includes('/superset/dashboard/') ? 'dashboard' : 'url');
      if (nav === 'dashboard') ensureDashboardsLoaded();
    } catch {}
    setModalVisible(true);
  };

  // Render modal content with tabs for Simple (form and list) and Advanced (JSON)
  const renderModalContent = () => {
    const handleTabChange = (key) => {
      setActiveTab(key);
      if (key === 'advanced') {
        if (editingIndex !== null) {
          setAdvancedJson(JSON.stringify(actions[editingIndex], null, 2));
        } else {
          setAdvancedJson(JSON.stringify(actions, null, 2));
        }
        setValidationError('');
      }
    };

    const loadSchemaTemplate = () => {
      const template = advancedTabPlaceholder;
      cmRef.current?.setValue(template);
      setAdvancedJson(template);
    };

    const schemaInfo = (
      <Collapse defaultActiveKey={[]} ghost>
        <Panel
          header="JSON Schema Information"
          key="1"
          extra={
            <Button
              size="small"
              type="primary"
              onClick={(e) => {
                e.stopPropagation();
                loadSchemaTemplate();
              }}
            >
              Load from Template
            </Button>
          }
        >
          <div style={{ marginBottom: '8px', maxWidth: '100%', overflow: 'auto' }}>
            <p>The JSON configuration should follow this structure:</p>
            <pre
              style={{
                maxWidth: '100%',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                backgroundColor: theme.colorBgLayout,
                color: theme.colorText,
                padding: '8px',
                borderRadius: '4px',
                fontSize: '11px',
              }}
            >
              {`[
  {
    "key": "action_key",
    "label": "Action Label",
    "style": "default",
    "icon": "plus",
    "tooltip": "Optional tooltip",
    "boundToSelection": false,
    "visibilityCondition": "all",
    "rlsVisibilityConditions": [
      {
        "rlsKey": "department",
        "operator": "==",
        "value": "sales"
      },
      {
        "rlsKey": "user_role",
        "operator": "IN",
        "value": "manager,admin"
      }
    ],
    "openInNewTab": false,
    "publishEvent": true,
    "navigateTo": "url",
    "dashboardId": 12,
    "actionUrl": "/path-or-dashboard-url",
    "showInSliceHeader": false
  }
]`}
            </pre>
            <p style={{ fontSize: '12px' }}>
              <strong>Notes:</strong>
              <br />
              - <code>visibilityCondition</code>: "selected" | "all" | "unselected"
              <br />
              - <code>rlsVisibilityConditions</code>: Array of RLS conditions (ALL match - AND). Operators: ==, !=, IN, NOT IN
              <br />
              - <code>publishEvent</code>: Default true; set false to navigate
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

    return (
      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane tab="Simple" key="simple">
          {(showAddForm || editingIndex !== null) && (
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
                message="No actions added yet."
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
                    setValidationError('');
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
                  // basic structure validation
                  const arr = Array.isArray(parsed) ? parsed : [parsed];
                  for (const a of arr) {
                    if (!a || typeof a !== 'object') { toastDanger('Each action must be an object'); return; }
                    if (!a.key || typeof a.key !== 'string') { toastDanger('Each action must have a non-empty "key"'); return; }
                    if (!a.label || typeof a.label !== 'string') { toastDanger(`Action "${a.key}": missing "label"`); return; }
                    if (a.publishEvent === false && (!a.actionUrl || typeof a.actionUrl !== 'string')) { toastDanger(`Action "${a.key}": "actionUrl" is required when publishEvent is false`); return; }
                  }
                  if (editingIndex !== null) {
                  const updatedActions = actions.map((action, idx) =>
                      idx === editingIndex ? parsed : action
                    );
                    setActions(updatedActions);
                    onChange(updatedActions);
                    const count = Array.isArray(parsed) ? parsed.length : 1;
                    toastSuccess(`JSON saved (${count} action${count !== 1 ? 's' : ''})`);
                  } else {
                    setActions(parsed);
                    onChange(parsed);
                    const count = Array.isArray(parsed) ? parsed.length : 1;
                    toastSuccess(`JSON saved (${count} action${count !== 1 ? 's' : ''})`);
                  }
                  setValidationError('');
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
            <span>Table Non-Split Actions</span>
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
                message="No table header actions added yet."
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
                  message="No actions added yet."
                  type="info"
                  showIcon
                  style={{ marginBottom: '8px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                    Add New Action
                  </Button>
                </div>
              </>
            ) : (
              renderInlineContent()
            )}
          </div>
          {!readOnly && actions.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button size="small" type="primary" onClick={openAddModal} icon={<EditOutlined />}>
                Edit Actions
              </Button>
            </div>
          )}
          {modalVisible && (
            <Modal
              title="Manage Actions"
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

NonSplitActionsControl.propTypes = {
  initialValue: PropTypes.array,
  onChange: PropTypes.func,
  language: PropTypes.string,
  readOnly: PropTypes.bool,
  offerEditInModal: PropTypes.bool,
};

export default NonSplitActionsControl;
