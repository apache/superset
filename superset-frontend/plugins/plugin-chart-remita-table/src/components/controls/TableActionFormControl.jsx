import React, {useEffect, useRef, useState} from 'react';
import rison from 'rison';
import PropTypes from 'prop-types';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Collapse,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tabs,
  Typography,
} from 'antd';
import { Tooltip } from '@superset-ui/core/components';
import { ControlHeader } from '@superset-ui/chart-controls';
import { useTheme } from '@apache-superset/core/ui';
import {
  BellOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  PlusOutlined,
  RightOutlined,
  TagOutlined,
  SendOutlined,
  ExportOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import {Controlled as CodeMirror} from 'react-codemirror2';
import { SupersetClient } from '@superset-ui/core';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/javascript/javascript';
// import CompactCollapse from '../../Styles'
import styled from '@emotion/styled';

const {Option} = Select;
const {Title} = Typography;
const {TabPane} = Tabs;
const {Panel} = Collapse;

const STYLE_OPTIONS = [
  {value: 'default', label: 'Default'},
  {value: 'primary', label: 'Primary'},
  {value: 'danger', label: 'Danger'},
  {value: 'success', label: 'Success'},
  {value: 'warning', label: 'Warning'},
];
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

// ----------------------------------------------------------------
// Extracted FormFields component using dependency-based updates
// ----------------------------------------------------------------
const FormFields = ({
                      form,
                      columns,
                      isPublishEvent,
                      setIsPublishEvent,
                      validateUniqueKey,
                      validateUniqueLabel,
                      ensureDashboardsLoaded,
                      dashboards,
                      loadingDashboards,
                      buildDashboardUrl,
                    }) => {
  const theme = useTheme();
  const [bulkEditModalVisible, setBulkEditModalVisible] = useState(false);
  const [bulkEditJson, setBulkEditJson] = useState('');
  const [bulkEditError, setBulkEditError] = useState('');

  const openBulkEdit = () => {
    const currentConditions = form.getFieldValue('rlsVisibilityConditions') || [];
    setBulkEditJson(JSON.stringify(currentConditions, null, 2));
    setBulkEditError('');
    setBulkEditModalVisible(true);
  };

  const handleBulkEditSave = () => {
    try {
      const parsed = JSON.parse(bulkEditJson);
      if (!Array.isArray(parsed)) {
        setBulkEditError('JSON must be an array of condition groups');
        return;
      }
      // Validate each group
      for (let i = 0; i < parsed.length; i++) {
        const group = parsed[i];
        if (!group.joinOperator || (group.joinOperator !== 'AND' && group.joinOperator !== 'OR')) {
          setBulkEditError(`Group ${i + 1}: Must have a valid "joinOperator" field (AND or OR)`);
          return;
        }
        if (!Array.isArray(group.conditions)) {
          setBulkEditError(`Group ${i + 1}: Must have a "conditions" array`);
          return;
        }
        // Validate each condition in the group
        for (let j = 0; j < group.conditions.length; j++) {
          const condition = group.conditions[j];
          if (!condition.source || (condition.source !== 'rls' && condition.source !== 'column')) {
            setBulkEditError(`Group ${i + 1}, Condition ${j + 1}: Must have a valid "source" field (rls or column)`);
            return;
          }
          if (condition.source === 'rls' && !condition.rlsKey) {
            setBulkEditError(`Group ${i + 1}, Condition ${j + 1}: RLS conditions must have an "rlsKey" field`);
            return;
          }
          if (condition.source === 'column' && !condition.column) {
            setBulkEditError(`Group ${i + 1}, Condition ${j + 1}: Column conditions must have a "column" field`);
            return;
          }
          if (!condition.operator) {
            setBulkEditError(`Group ${i + 1}, Condition ${j + 1}: Must have an "operator" field`);
            return;
          }
          if (condition.value === undefined || condition.value === null) {
            setBulkEditError(`Group ${i + 1}, Condition ${j + 1}: Must have a "value" field`);
            return;
          }
        }
        // Validate groupJoinOperator for groups that aren't the last
        if (i < parsed.length - 1) {
          if (group.groupJoinOperator && group.groupJoinOperator !== 'AND' && group.groupJoinOperator !== 'OR') {
            setBulkEditError(`Group ${i + 1}: "groupJoinOperator" must be AND or OR`);
            return;
          }
        }
      }
      form.setFieldsValue({ rlsVisibilityConditions: parsed });
      setBulkEditModalVisible(false);
      setBulkEditError('');
    } catch (error) {
      setBulkEditError(`Invalid JSON: ${error.message}`);
    }
  };

  const loadExampleTemplate = () => {
    const exampleTemplate = [
      {
        joinOperator: 'AND',
        groupJoinOperator: 'OR',
        conditions: [
          {
            source: 'rls',
            rlsKey: 'department',
            operator: '==',
            value: 'sales',
          },
          {
            source: 'rls',
            rlsKey: 'user_role',
            operator: 'IN',
            value: 'manager,admin',
          },
        ],
      },
      {
        joinOperator: 'AND',
        conditions: [
          {
            source: 'column',
            column: 'status',
            operator: 'IN',
            value: 'active,pending',
          },
          {
            source: 'column',
            column: 'is_deleted',
            operator: '!=',
            value: 'true',
          },
        ],
      },
    ];
    setBulkEditJson(JSON.stringify(exampleTemplate, null, 2));
  };

  return (
    <>
      <Modal
        title="Bulk Edit Visibility Conditions"
        open={bulkEditModalVisible}
        onCancel={() => setBulkEditModalVisible(false)}
        onOk={handleBulkEditSave}
        width={700}
      >
        <div style={{ marginBottom: 8 }}>
          <Typography.Text type="secondary">
            Edit visibility conditions as JSON array of condition groups. Each group should have:
            <br />- <code>joinOperator</code>: "AND" (all conditions in group must match) or "OR" (any condition must match)
            <br />- <code>conditions</code>: array of condition objects, each with:
            <br />&nbsp;&nbsp;• <code>source</code>: "rls" or "column"
            <br />&nbsp;&nbsp;• <code>rlsKey</code> (if source is "rls") or <code>column</code> (if source is "column")
            <br />&nbsp;&nbsp;• <code>operator</code>: "==", "!=", "IN", or "NOT IN"
            <br />&nbsp;&nbsp;• <code>value</code>: the value to compare against
            <br />- <code>groupJoinOperator</code>: "AND" or "OR" to join with the next group (optional, not needed for last group)
            <br /><br />
            <strong>Logic:</strong> Groups are evaluated separately, then joined using groupJoinOperator.
            <br />Example: (Group1 conditions joined by AND) OR (Group2 conditions joined by AND)
          </Typography.Text>
          <Button
            size="small"
            type="link"
            onClick={loadExampleTemplate}
            style={{ padding: '0 4px', marginTop: 4 }}
          >
            Load Example Template
          </Button>
        </div>
        {bulkEditError && (
          <Alert message={bulkEditError} type="error" style={{ marginBottom: 8 }} />
        )}
        <Input.TextArea
          value={bulkEditJson}
          onChange={(e) => setBulkEditJson(e.target.value)}
          rows={15}
          style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            backgroundColor: theme.colorBgContainer,
            color: theme.colorText,
          }}
        />
      </Modal>

      <Form.Item
        name="key"
        label="Key"
        rules={[
          {required: true, message: 'Please enter a key'},
          {validator: validateUniqueKey},
        ]}
      >
        <Input placeholder="Action key"/>
      </Form.Item>
      <Form.Item
        name="label"
        label="Label"
        rules={[
          {required: true, message: 'Please enter a label'},
          {validator: validateUniqueLabel},
        ]}
      >
        <Input placeholder="Action label"/>
      </Form.Item>
      <Form.Item
        name="style"
        label="Style"
        rules={[{required: true, message: 'Please select a style'}]}
      >
        <Select placeholder="Select a style">
          {STYLE_OPTIONS.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
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
          <Form.Item
            name="actionUrl"
            label="Action URL"
            rules={[{required: true, message: 'Please enter an action URL'}]}
          >
            <Input placeholder="Enter action URL"/>
          </Form.Item>
        </>
      )}

      {/* Visibility Conditions - Row Column and RLS Token with AND/OR grouping */}
      <Divider style={{ margin: '12px 0' }} />
      <Form.Item
        label={
          <Space>
            <span>Visibility Conditions</span>
            <Button
              size="small"
              type="link"
              icon={<EditOutlined />}
              onClick={openBulkEdit}
              style={{ padding: '0 4px' }}
            >
              Bulk Edit
            </Button>
          </Space>
        }
      >
        <Form.List name="rlsVisibilityConditions">
          {(groupFields, { add: addGroup, remove: removeGroup }) => (
            <>
              {groupFields.map(({ key: groupKey, name: groupName, ...groupRestField }) => (
                <Card
                  key={groupKey}
                  size="small"
                  style={{
                    marginBottom: 8,
                    backgroundColor: theme.colorBgLayout,
                    borderColor: theme.colorBorderSecondary,
                  }}
                  extra={
                    <DeleteOutlined
                      onClick={() => removeGroup(groupName)}
                      style={{ color: theme.colorError }}
                    />
                  }
                >
                  <Form.Item
                    {...groupRestField}
                    name={[groupName, 'joinOperator']}
                    label="Conditions within this group"
                    initialValue="AND"
                    style={{ marginBottom: 8 }}
                  >
                    <Select size="small" style={{ width: 100 }}>
                      <Option value="AND">All must match (AND)</Option>
                      <Option value="OR">Any must match (OR)</Option>
                    </Select>
                  </Form.Item>
                  <Form.List name={[groupName, 'conditions']}>
                    {(condFields, { add: addCond, remove: removeCond }) => (
                      <>
                        {condFields.map(({ key: condKey, name: condName, ...condRestField }) => (
                          <Space key={condKey} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item
                              {...condRestField}
                              name={[condName, 'source']}
                              initialValue="rls"
                              rules={[{ required: true, message: 'Required' }]}
                              style={{ marginBottom: 0, width: 100 }}
                            >
                              <Select placeholder="Source" size="small">
                                <Option value="rls">RLS Token</Option>
                                <Option value="column">Row Column</Option>
                              </Select>
                            </Form.Item>
                            <Form.Item
                              shouldUpdate={(prevValues, curValues) => {
                                const prevSource = prevValues.rlsVisibilityConditions?.[groupName]?.conditions?.[condName]?.source;
                                const curSource = curValues.rlsVisibilityConditions?.[groupName]?.conditions?.[condName]?.source;
                                return prevSource !== curSource;
                              }}
                              noStyle
                            >
                              {({ getFieldValue }) => {
                                const source = getFieldValue(['rlsVisibilityConditions', groupName, 'conditions', condName, 'source']) || 'rls';
                                return source === 'rls' ? (
                                  <Form.Item
                                    {...condRestField}
                                    name={[condName, 'rlsKey']}
                                    rules={[{ required: true, message: 'RLS key required' }]}
                                    style={{ marginBottom: 0, width: 150 }}
                                  >
                                    <Input placeholder="RLS key" size="small" />
                                  </Form.Item>
                                ) : (
                                  <Form.Item
                                    {...condRestField}
                                    name={[condName, 'column']}
                                    rules={[{ required: true, message: 'Column required' }]}
                                    style={{ marginBottom: 0, width: 150 }}
                                  >
                                    <Select placeholder="Column" size="small" showSearch>
                                      {columns.map((column) => (
                                        <Option key={column} value={column}>
                                          {column}
                                        </Option>
                                      ))}
                                    </Select>
                                  </Form.Item>
                                );
                              }}
                            </Form.Item>
                            <Form.Item
                              {...condRestField}
                              name={[condName, 'operator']}
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
                              {...condRestField}
                              name={[condName, 'value']}
                              rules={[{ required: true, message: 'Value required' }]}
                              style={{ marginBottom: 0, flex: 1 }}
                            >
                              <Input placeholder="Value" size="small" />
                            </Form.Item>
                            <DeleteOutlined onClick={() => removeCond(condName)} style={{ color: theme.colorError }} />
                          </Space>
                        ))}
                        <Button
                          type="dashed"
                          onClick={() => addCond({ source: 'rls' })}
                          block
                          size="small"
                          icon={<PlusOutlined />}
                        >
                          Add Condition to Group
                        </Button>
                      </>
                    )}
                  </Form.List>
                  {groupName < groupFields.length - 1 && (
                    <Form.Item
                      {...groupRestField}
                      name={[groupName, 'groupJoinOperator']}
                      label="Join with next group using"
                      initialValue="OR"
                      style={{ marginTop: 8, marginBottom: 0 }}
                    >
                      <Select size="small" style={{ width: 80 }}>
                        <Option value="AND">AND</Option>
                        <Option value="OR">OR</Option>
                      </Select>
                    </Form.Item>
                  )}
                </Card>
              ))}
              <Button
                type="dashed"
                onClick={() => addGroup({ joinOperator: 'AND', conditions: [], groupJoinOperator: 'OR' })}
                block
                icon={<PlusOutlined />}
              >
                Add Condition Group
              </Button>
            </>
          )}
        </Form.List>
      </Form.Item>
    </>
  );
};
// ----------------------------------------------------------------

const TableActionFormControl = ({
                                  initialValue = [],
                                  onChange = () => {
                                  },
                                  language = 'json',
                                  readOnly = false,
                                  offerEditInModal = true,
                                  ...rest
                                }) => {
  const theme = useTheme();
  const columns = rest.columns;
  const valueColumn = rest.valueColumn;

  // Toast notification helpers
  const toastSuccess = msg => (rest?.actions?.addSuccessToast ? rest.actions.addSuccessToast(msg) : null);
  const toastDanger = msg => (rest?.actions?.addDangerToast ? rest.actions.addDangerToast(msg) : null);
  const [actions, setActions] = useState(() =>
    parseInitialValue(rest.value || initialValue, valueColumn)
  );
  const [editingIndex, setEditingIndex] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [isPublishEvent, setIsPublishEvent] = useState(true);
  const [activeTab, setActiveTab] = useState('simple');
  const [advancedJson, setAdvancedJson] = useState('');
  const [validationError, setValidationError] = useState('');
  const cmRef = useRef(null);
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
      console.error('[TableActionFormControl] Failed to load dashboards:', e);
    } finally {
      setLoadingDashboards(false);
    }
  };

  useEffect(() => {
    if (modalVisible && activeTab === 'advanced') {
      if (editingIndex !== null) {
        setAdvancedJson(JSON.stringify(actions[editingIndex], null, 2));
      } else {
        setAdvancedJson(JSON.stringify(actions, null, 2));
      }
      // ensure editor refresh after becoming visible
      setValidationError('');
      setTimeout(() => {
        if (cmRef.current) cmRef.current.refresh();
      }, 50);
    }
  }, [modalVisible, activeTab, actions, editingIndex]);

  // Basic schema validation for actions JSON
  const validateActionsJson = (data) => {
    const arr = Array.isArray(data) ? data : [data];
    const allowedStyles = new Set(['default','primary','danger','success','warning']);
    for (const a of arr) {
      if (!a || typeof a !== 'object') return 'Each action must be an object';
      if (typeof a.key !== 'string' || !a.key) return 'Each action must have a non-empty "key" (string)';
      if (typeof a.label !== 'string' || !a.label) return `Action "${a.key}": missing "label" (string)`;
      if (a.style && !allowedStyles.has(String(a.style))) return `Action "${a.key}": invalid style`; 
      if (a.publishEvent === false && (!a.actionUrl || typeof a.actionUrl !== 'string')) {
        return `Action "${a.key}": "actionUrl" is required when publishEvent is false`;
      }
    }
    return null;
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingIndex(null);
    setShowAddForm(false);
    // Don't reset fields on close - let them persist until next open
  };

  const openModal = () => {
    setModalVisible(true);
    setEditingIndex(null);
    setShowAddForm(actions.length === 0);
    ensureDashboardsLoaded();
  };

  const openAddModal = () => {
    openModal();
  };

  const revealAddForm = () => {
    setShowAddForm(true);
    setEditingIndex(null);
  };

  // Reset form fields when modal opens
  useEffect(() => {
    if (modalVisible && (showAddForm || editingIndex === null)) {
      // Form is mounted with modal, reset immediately
      form.resetFields();
    }
  }, [modalVisible, showAddForm, editingIndex, form]);

  const handleAddAction = (values) => {
    const newAction = {
      key: values.key,
      valueColumn: valueColumn,
      label: values.label,
      publishEvent: values.publishEvent || false,
      navigateTo: !values.publishEvent ? (values.navigateTo || 'url') : undefined,
      dashboardId: !values.publishEvent && values.navigateTo === 'dashboard' ? values.dashboardId : undefined,
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
      openInNewTab: Boolean(values.openInNewTab),
      includeDashboardFilters: Boolean(values.includeDashboardFilters),
      style: values.style,
      rlsVisibilityConditions: values.rlsVisibilityConditions || [],
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
      valueColumn: valueColumn,
      label: values.label,
      publishEvent: values.publishEvent || false,
      navigateTo: !values.publishEvent ? (values.navigateTo || 'url') : undefined,
      dashboardId: !values.publishEvent && values.navigateTo === 'dashboard' ? values.dashboardId : undefined,
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
      openInNewTab: Boolean(values.openInNewTab),
      includeDashboardFilters: Boolean(values.includeDashboardFilters),
      style: values.style,
      rlsVisibilityConditions: values.rlsVisibilityConditions || [],
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

  const TagIcon = ({action}) => {
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
              <span>Table Row Actions</span>
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
          <div direction="vertical"  style={{ width: '100%', padding: 0 }}>
            {actions.length === 0 ? (
              <>
                <Alert
                  message="No table  actions added yet."
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
            <TagIcon action={action}/>
          </Tooltip>
          <span style={{ color: STYLE_COLORS[action.style] || STYLE_COLORS.default, fontWeight: 500 }}>
            {action.label}
          </span>
          <Tooltip title={`Publish Event: ${action.publishEvent ? 'Yes' : 'No'}`}>
            <BellOutlined
              style={{
                color: action.publishEvent ? 'blue' : 'grey',
                fontSize: '0.8rem'
              }}
            />
          </Tooltip>
          {!action.publishEvent && action.actionUrl && (
            <Tooltip title={`Action URL: ${action.actionUrl}`}>
              <LinkOutlined style={{fontSize: '0.8rem'}}/>
            </Tooltip>
          )}
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
      actionUrl: action.actionUrl,
      publishEvent: action.publishEvent,
      includeDashboardFilters: Boolean(action.includeDashboardFilters ?? true),
      openInNewTab: Boolean(action.openInNewTab),
      style: action.style,
      rlsVisibilityConditions: action.rlsVisibilityConditions || [],
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
    setIsPublishEvent(action.publishEvent);
    try {
      const nav = action.navigateTo || (action.actionUrl && String(action.actionUrl).includes('/superset/dashboard/') ? 'dashboard' : 'url');
      if (nav === 'dashboard') ensureDashboardsLoaded();
    } catch {}
    setModalVisible(true);
  };

  const handleExportActions = () => {
    const jsonString = JSON.stringify(actions, null, 2);
    const blob = new Blob([jsonString], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'actions.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportActions = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        setActions(parsed);
        onChange(parsed);
        toastSuccess('Actions imported successfully');
      } catch (err) {
        toastDanger('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    return false;
  };

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
        setTimeout(() => { if (cmRef.current) cmRef.current.refresh(); }, 50);
      }
    };

    const advancedTabPlaceholder = JSON.stringify(
      [
        {
          key: 'view',
          label: 'View',
          publishEvent: false,
          openInNewTab: false,
          actionUrl: '/slice/1',
          style: 'default',
          rlsVisibilityConditions: [
            {
              joinOperator: 'AND',
              conditions: [
                {
                  source: 'rls',
                  rlsKey: 'department',
                  operator: '==',
                  value: 'sales',
                },
              ],
            },
          ],
        },
        {
          key: 'delete',
          label: 'Delete',
          publishEvent: false,
          openInNewTab: true,
          actionUrl: '/slice/2',
          style: 'danger',
          rlsVisibilityConditions: [
            {
              joinOperator: 'AND',
              groupJoinOperator: 'OR',
              conditions: [
                {
                  source: 'column',
                  column: 'status',
                  operator: 'IN',
                  value: 'active,pending',
                },
              ],
            },
            {
              joinOperator: 'AND',
              conditions: [
                {
                  source: 'rls',
                  rlsKey: 'user_role',
                  operator: '==',
                  value: 'admin',
                },
              ],
            },
          ],
        },
      ],
      null,
      2
    );

    const loadSchemaTemplate = () => {
      // advancedTabPlaceholder is already a JSON string, so use it directly
      cmRef.current?.setValue(advancedTabPlaceholder);
      setAdvancedJson(advancedTabPlaceholder);
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
    "publishEvent": true,
    "actionUrl": "/action-url",
    "openInNewTab": false,
    "style": "default",
    "rlsVisibilityConditions": [
      {
        "joinOperator": "AND",
        "groupJoinOperator": "OR",
        "conditions": [
          {
            "source": "rls",
            "rlsKey": "department",
            "operator": "==",
            "value": "sales"
          },
          {
            "source": "rls",
            "rlsKey": "user_role",
            "operator": "IN",
            "value": "manager,admin"
          }
        ]
      },
      {
        "joinOperator": "AND",
        "conditions": [
          {
            "source": "column",
            "column": "status",
            "operator": "IN",
            "value": "active,pending"
          }
        ]
      }
    ]
  }
]`}
            </pre>
            <p style={{ fontSize: '12px' }}>
              <strong>Notes:</strong>
              <br />
              - <code>publishEvent</code>: Default true; set false to navigate to URL
              <br />
              - <code>rlsVisibilityConditions</code>: Array of groups with{' '}
              <code>joinOperator</code> (AND/OR), <code>conditions</code> array, and{' '}
              <code>groupJoinOperator</code> (AND/OR)
              <br />
              - <strong>Example:</strong> (dept==sales AND role IN [manager,admin]) OR
              (status IN [active,pending])
            </p>
          </div>
        </Panel>
      </Collapse>
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
                style={{marginBottom: '8px'}}
              >
                <FormFields
                  form={form}
                  columns={columns}
                  isPublishEvent={isPublishEvent}
                  setIsPublishEvent={setIsPublishEvent}
                  validateUniqueKey={validateUniqueKey}
                  validateUniqueLabel={validateUniqueLabel}
                  ensureDashboardsLoaded={ensureDashboardsLoaded}
                  dashboards={dashboards}
                  loadingDashboards={loadingDashboards}
                  buildDashboardUrl={buildDashboardUrl}
                />
                <Space style={{marginTop: 8}}>
                  <Button type="primary" htmlType="submit">
                    {editingIndex === null ? 'Add Action' : 'Save Changes'}
                  </Button>
                  <Button onClick={closeModal}>Cancel</Button>
                </Space>
              </Form>
              <Divider style={{margin: '8px 0'}}/>
            </>
          )}
          <Space direction="vertical" style={{width: '100%'}}>
            {actions.length === 0 ? (
              <Alert
                message="No table row actions added yet."
                type="info"
                showIcon
                style={{marginBottom: '8px'}}
              />
            ) : (
              actions.map((action, index) => renderCard(action, index))
            )}
          </Space>
          <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 8}}>
            <Button size="small" type="primary" icon={<PlusOutlined/>} onClick={revealAddForm}>
              Add New Action
            </Button>
          </div>
        </TabPane>
        <TabPane tab="Advanced" key="advanced">
          {schemaInfo}
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
          <Space style={{marginTop: 8}}>
            <Button
              onClick={() => {
                try {
                  const parsed = JSON.parse(advancedJson);
                  setAdvancedJson(JSON.stringify(parsed, null, 2));
                  toastSuccess('JSON formatted');
                  setValidationError('');
                } catch (err) {
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
                  const err = validateActionsJson(parsed);
                  if (err) { setValidationError(err); toastDanger(err); return; }
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

  return (
    <div>
      <ControlHeader />
      {offerEditInModal ? (
        <>
          <div style={{marginBottom: '8px'}}>
            {actions.length === 0 ? (
              <>
                <Alert
                  message="No table row actions added yet."
                  type="info"
                  showIcon
                  style={{marginBottom: '8px'}}
                />
                <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                  <Button size="small" type="primary" icon={<PlusOutlined/>} onClick={openAddModal}>
                    Add New Action
                  </Button>
                </div>
              </>
            ) : (
              renderInlineContent()
            )}
          </div>
          {!readOnly && actions.length > 0 && (
            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '8px'}}>
              <Button size="small" type="primary" onClick={openAddModal} icon={<EditOutlined/>}>
                Edit Table Row Actions
              </Button>
            </div>
          )}
          {modalVisible && (
            <Modal
              title="Manage Table Row Actions"
              open={true}
              onCancel={closeModal}
              footer={<Button size="small" onClick={closeModal}>Done</Button>}
              width="600px"
              bodyStyle={{padding: '12px'}}
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

TableActionFormControl.propTypes = {
  initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  onChange: PropTypes.func,
  language: PropTypes.string,
  readOnly: PropTypes.bool,
  offerEditInModal: PropTypes.bool,
  columns: PropTypes.arrayOf(PropTypes.string),
};

export default TableActionFormControl;
