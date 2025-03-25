import React, {useEffect, useState} from 'react';

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
  message,
  Modal,
  Select,
  Space,
  Tabs,
  Tooltip,
  Typography,
} from 'antd';
import ControlHeader from '../../../../../src/explore/components/ControlHeader';
import {
  BellOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  PlusOutlined,
  RightOutlined,
  TagOutlined,
} from '@ant-design/icons';
import {Controlled as CodeMirror} from 'react-codemirror2';
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
                      showVisibilityCondition,
                      setShowVisibilityCondition,
                      validateUniqueKey,
                      validateUniqueLabel,
                    }) => {
  return (
    <>
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
      <Form.Item name="publishEvent" valuePropName="checked">
        <Checkbox onChange={(e) => setIsPublishEvent(e.target.checked)}>
          Publish Event
        </Checkbox>
      </Form.Item>
      {!isPublishEvent && (
        <Form.Item
          name="actionUrl"
          label="Action URL"
          rules={[{required: true, message: 'Please enter an action URL'}]}
        >
          <Input placeholder="Enter action URL"/>
        </Form.Item>
      )}
      <Form.Item name="showVisibilityCondition" valuePropName="checked">
        <Checkbox onChange={(e) => setShowVisibilityCondition(e.target.checked)}>
          Add Visibility Condition
        </Checkbox>
      </Form.Item>
      {showVisibilityCondition && (
        <>
          <Form.Item
            name={['visibilityCondition', 'column']}
            label="Visibility Condition Column"
            rules={[
              {
                required: showVisibilityCondition,
                message: 'Please select a column',
              },
            ]}
          >
            <Select placeholder="Select a column">
              {columns.map((column) => (
                <Option key={column} value={column}>
                  {column}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name={['visibilityCondition', 'operator']}
            label="Visibility Condition Operator"
            rules={[
              {
                required: showVisibilityCondition,
                message: 'Please select an operator',
              },
            ]}
          >
            <Select placeholder="Select an operator">
              <Option value="==">Equals</Option>
              <Option value="!=">Not Equals</Option>
              <Option value=">">Greater Than</Option>
              <Option value="<">Less Than</Option>
              <Option value=">=">Greater Than or Equal</Option>
              <Option value="<=">Less Than or Equal</Option>
              <Option value="IS NULL">Is Null</Option>
              <Option value="IS NOT NULL">Is Not Null</Option>
              <Option value="IN">In List</Option>
              <Option value="NOT IN">Not In List</Option>
            </Select>
          </Form.Item>
          {/* Use Form.Item with shouldUpdate to re-render when operator changes */}
          <Form.Item
            shouldUpdate={(prevValues, curValues) =>
              prevValues.visibilityCondition?.operator !==
              curValues.visibilityCondition?.operator
            }
          >
            {() => {
              const operator = form.getFieldValue(['visibilityCondition', 'operator']);
              return operator !== 'IS NULL' && operator !== 'IS NOT NULL' ? (
                <Form.Item
                  name={['visibilityCondition', 'value']}
                  label="Visibility Condition Value"
                  rules={[
                    {
                      required: true,
                      message: 'Please enter a value',
                    },
                  ]}
                >
                  <Input
                    placeholder={
                      operator === 'IN' || operator === 'NOT IN'
                        ? 'Enter comma-separated values (e.g., active,pending)'
                        : 'Enter value'
                    }
                  />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>
        </>
      )}
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

  const columns = rest.columns;
  const valueColumn = rest.valueColumn;
  const [actions, setActions] = useState(() =>
    parseInitialValue(rest.value || initialValue, valueColumn)
  );
  const [editingIndex, setEditingIndex] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [isPublishEvent, setIsPublishEvent] = useState(false);
  const [showVisibilityCondition, setShowVisibilityCondition] = useState(false);
  const [activeTab, setActiveTab] = useState('simple');
  const [advancedJson, setAdvancedJson] = useState('');

  useEffect(() => {
    if (modalVisible && activeTab === 'advanced') {
      if (editingIndex !== null) {
        setAdvancedJson(JSON.stringify(actions[editingIndex], null, 2));
      } else {
        setAdvancedJson(JSON.stringify(actions, null, 2));
      }
    }
  }, [modalVisible, activeTab, actions, editingIndex]);

  const closeModal = () => {
    setModalVisible(false);
    setEditingIndex(null);
    setShowAddForm(false);
    form.resetFields();
  };

  const openModal = () => {
    setModalVisible(true);
    setEditingIndex(null);
    setShowAddForm(actions.length === 0);
    form.resetFields();
  };

  const openAddModal = () => {
    openModal();
  };

  const revealAddForm = () => {
    setShowAddForm(true);
    setEditingIndex(null);
    form.resetFields();
  };

  const handleAddAction = (values) => {
    const newAction = {
      key: values.key,
      valueColumn: valueColumn,
      label: values.label,
      publishEvent: values.publishEvent || false,
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
      style: values.style,
      visibilityCondition: showVisibilityCondition ? values.visibilityCondition : null,
    };
    const updatedActions = [...actions, newAction];
    setActions(updatedActions);
    onChange(JSON.stringify(updatedActions));
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
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
      style: values.style,
      visibilityCondition: showVisibilityCondition ? values.visibilityCondition : null,
    };
    const updatedActions = actions.map((action, idx) =>
      idx === editingIndex ? updatedAction : action
    );
    setActions(updatedActions);
    onChange(JSON.stringify(updatedActions));
    form.resetFields();
    setEditingIndex(null);
  };

  const handleRemoveAction = (index) => {
    const updatedActions = actions.filter((_, idx) => idx !== index);
    setActions(updatedActions);
    onChange(JSON.stringify(updatedActions));
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
        expandIconPosition="right" // Ensures the arrow is positioned on the right
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
          {action.visibilityCondition && (
            <Tooltip
              title={`Visibility Condition: ${action.visibilityCondition.column} ${action.visibilityCondition.operator} ${action.visibilityCondition.value}`}
            >
              <EyeOutlined style={{fontSize: '0.8rem'}}/>
            </Tooltip>
          )}
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
      style: action.style,
      visibilityCondition: action.visibilityCondition || null,
      showVisibilityCondition: !!action.visibilityCondition,
    });
    setIsPublishEvent(action.publishEvent);
    setShowVisibilityCondition(!!action.visibilityCondition);
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
        onChange(JSON.stringify(parsed));
        message.success('Actions imported successfully');
      } catch (err) {
        message.error('Invalid JSON file');
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
      }
    };

    const advancedTabPlaceholder = JSON.stringify(
      [
        {
          key: 'view',
          label: 'View',
          publishEvent: false,
          actionUrl: '/slice/1',
          style: 'default',
          visibilityCondition: {
            column: 'status',
            operator: 'IN',
            value: 'active,pending',
          },
        },
        {
          key: 'delete',
          label: 'Delete',
          publishEvent: false,
          actionUrl: '/slice/2',
          style: 'danger',
          visibilityCondition: {
            column: 'deleted_at',
            operator: 'IS NULL',
          },
        },
      ],
      null,
      2
    );

    const schemaInfo = (
      <Collapse defaultActiveKey={[]} ghost>
        <Panel header="JSON Schema Information" key="1">
          <div style={{marginBottom: '8px'}}>
            <p>The JSON configuration should follow this structure:</p>
            <pre>
              {`
[
  {
    "key": "action_key", // Unique identifier for the action
    "label": "Action Label", // Display name for the action
    "publishEvent": false, // Whether the action publishes an event
    "actionUrl": "/action-url", // URL to navigate to (if publishEvent is false)
    "style": "default", // Style of the action (default, primary, danger, success, warning)
    "visibilityCondition": { // Optional visibility condition
      "column": "column_name", // Column to evaluate
      "operator": "IN", // Operator (e.g., ==, !=, >, <, IN, NOT IN, etc.)
      "value": "value" // Value to compare against
    }
  }
]
              `}
            </pre>
            <p>
              <strong>Note:</strong> The <code>visibilityCondition</code> is optional.
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
                  showVisibilityCondition={showVisibilityCondition}
                  setShowVisibilityCondition={setShowVisibilityCondition}
                  validateUniqueKey={validateUniqueKey}
                  validateUniqueLabel={validateUniqueLabel}
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
          <CodeMirror
            value={actions.length === 0 ? '' : advancedJson}
            placeholder={actions.length === 0 ? advancedTabPlaceholder : ''}
            options={{
              mode: 'javascript',
              theme: 'material',
              lineNumbers: true,
              readOnly: false,
            }}
            onBeforeChange={(editor, data, value) => {
              setAdvancedJson(value);
            }}
          />
          <Space style={{marginTop: 8}}>
            <Button
              type="primary"
              onClick={() => {
                try {
                  const parsed = JSON.parse(advancedJson);
                  if (editingIndex !== null) {
                    const updatedActions = actions.map((action, idx) =>
                      idx === editingIndex ? parsed : action
                    );
                    setActions(updatedActions);
                    onChange(JSON.stringify(updatedActions));
                  } else {
                    setActions(parsed);
                    onChange(JSON.stringify(parsed));
                  }
                } catch (err) {
                  message.error('Invalid JSON');
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
      <ControlHeader onChange={onChange}/>
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
          <Modal
            title="Manage Table Row Actions"
            visible={modalVisible}
            onCancel={closeModal}
            footer={<Button size="small" onClick={closeModal}>Done</Button>}
            width="600px"
            bodyStyle={{padding: '12px'}}
          >
            {renderModalContent()}
          </Modal>
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
