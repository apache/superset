import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
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
  Tooltip,
  Typography,
} from 'antd';
import ControlHeader from '../../../../../src/explore/components/ControlHeader';
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
} from '@ant-design/icons';

const { Option } = Select;
const { Title } = Typography;
const { TabPane } = Tabs;

const VISIBILITY_CONDITION_OPTIONS = [
  { value: 'selected', label: 'Selected' },
  { value: 'all', label: 'All' },
];
const parseInitialValue = (value) => {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (value instanceof Set) {
    return Array.from(value);
  }
  return [];
};


const SplitActionsControl = ({
                               initialValue = [],
                               onChange = () => {},
                               language = 'json',
                               readOnly = false,
                               offerEditInModal = true,
                               ...rest
                             }) => {
  const [actions, setActions] = useState(() => parseInitialValue(rest.value||rest.default));
  const [editingIndex, setEditingIndex] = useState(null); // if null, then adding new action
  const [showAddForm, setShowAddForm] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [isPublishEvent, setIsPublishEvent] = useState(false);
  // Tab state for modal mode
  const [activeTab, setActiveTab] = useState('simple');
  // advancedJson holds the JSON text in advanced tab.
  const [advancedJson, setAdvancedJson] = useState('');

  // When modal opens, if advanced tab is active, update the advanced JSON text.
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
    // If there are no actions, default to showing the add form in simple tab.
    setShowAddForm(actions.length === 0);
    form.resetFields();
  };

  const openAddModal = () => {
    openModal();
  };

  // Reveal add form in modal mode (only in Simple tab)
  const revealAddForm = () => {
    setShowAddForm(true);
    setEditingIndex(null);
    form.resetFields();
  };

  const handleAddAction = (values) => {
    const newAction = {
      key: values.key,
      label: values.label,
      boundToSelection: values.boundToSelection,
      visibilityCondition: values.visibilityCondition,
      publishEvent: values.publishEvent || false,
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
    };
    const updatedActions = [...actions, newAction];
    setActions(updatedActions);
    onChange(JSON.stringify(updatedActions));
    form.resetFields();
    setShowAddForm(false);
    setEditingIndex(null);
    // In simple tab mode, do not close the modal automatically.
  };

  const handleEditAction = (values) => {
    const updatedAction = {
      key: values.key,
      label: values.label,
      boundToSelection: values.boundToSelection,
      visibilityCondition: values.visibilityCondition,
      publishEvent: values.publishEvent || false,
      actionUrl: !values.publishEvent ? values.actionUrl : undefined,
    };
    const updatedActions = actions.map((action, idx) =>
      idx === editingIndex ? updatedAction : action
    );
    setActions(updatedActions);
    onChange(JSON.stringify(updatedActions));
    form.resetFields();
    setEditingIndex(null);
    // In simple tab mode, modal remains open.
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
      <Form.Item
        name="boundToSelection"
        label="Bound to Selection"
        valuePropName="checked"
      >
        <Checkbox>Bound to Selection</Checkbox>
      </Form.Item>
      <Form.Item
        name="visibilityCondition"
        label="Visibility Condition"
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
        label="Publish Event"
        valuePropName="checked"
      >
        <Checkbox onChange={(e) => setIsPublishEvent(e.target.checked)}>
          Publish Event
        </Checkbox>
      </Form.Item>
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
          <Tooltip title={`Bound: ${action.boundToSelection ? 'Yes' : 'No'}`}>
            {action.boundToSelection ? (
              <CheckOutlined style={{ color: 'green', fontSize: '0.8rem' }} />
            ) : (
              <CloseOutlined style={{ color: 'red', fontSize: '0.8rem' }} />
            )}
          </Tooltip>
          <Tooltip title={`Visibility: ${action.visibilityCondition}`}>
            <EyeOutlined style={{ fontSize: '0.8rem' }} />
          </Tooltip>
          <Tooltip title={`Publish Event: ${action.publishEvent ? 'Yes' : 'No'}`}>
            <BellOutlined style={{ color: action.publishEvent ? 'blue' : 'grey', fontSize: '0.8rem' }} />
          </Tooltip>
          {(!action.publishEvent) && (
            <Tooltip title={`Action URL: ${action.actionUrl}`}>
              <LinkOutlined style={{ fontSize: '0.8rem' }} />
            </Tooltip>
          )}
          <Tooltip title={`Show In Slice: ${action.showInSliceHeader ? 'Yes' : 'No'}`}>
            <MoreOutlined style={{color: action.showInSliceHeader ? 'blue' : 'grey', fontSize: '0.8rem'}}/>
          </Tooltip>
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
      boundToSelection: action.boundToSelection,
      actionUrl: action.actionUrl,
      visibilityCondition: action.visibilityCondition,
      publishEvent: action.publishEvent,
      showInSliceHeader:action.showInSliceHeader,
    });
    setIsPublishEvent(action.publishEvent);
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
      }
    };

    // State for active tab and advanced JSON text.
    const [activeTab, setActiveTab] = useState('simple');
    const [advancedJson, setAdvancedJson] = useState(
      editingIndex !== null
        ? JSON.stringify(actions[editingIndex], null, 2)
        : JSON.stringify(actions, null, 2)
    );

    const handleAdvancedSave = () => {
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
                style={{ marginBottom: '16px' }}
              >
                {renderFormFields()}
                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" htmlType="submit">
                    {editingIndex === null ? 'Add Action' : 'Save Changes'}
                  </Button>
                  <Button onClick={closeModal}>Cancel</Button>
                </Space>
              </Form>
              <Divider style={{ margin: '16px 0' }} />
            </>
          )}
          <Space direction="vertical" style={{ width: '100%' }}>
            {actions.length === 0 ? (
              <Alert
                message="No split table header actions added yet."
                type="info"
                showIcon
                style={{ marginBottom: '16px' }}
              />
            ) : (
              actions.map((action, index) => renderCard(action, index))
            )}
          </Space>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={revealAddForm}>
              Add New Action
            </Button>
          </div>
        </TabPane>
        <TabPane tab="Advanced" key="advanced">
          <Input.TextArea
            rows={10}
            value={advancedJson}
            onChange={(e) => setAdvancedJson(e.target.value)}
          />
          <Space style={{ marginTop: 16 }}>
            <Button type="primary" onClick={handleAdvancedSave}>
              Save JSON
            </Button>
            <Button onClick={closeModal}>Cancel</Button>
          </Space>
        </TabPane>
      </Tabs>
    );
  };

  const renderInlineContent = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      {actions.length === 0 ? (
        <>
          <Alert
            message="No split table header actions added yet."
            type="info"
            showIcon
            style={{ marginBottom: '16px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
              Add New Action
            </Button>
          </div>
        </>
      ) : (
        <Collapse accordion>
          <Panel
            header={
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                Actions <Badge count={actions.length} style={{ marginLeft: 8 }} />
              </div>
            }
            key="1"
          >
            {actions.map((action, index) => renderCard(action, index))}
          </Panel>
        </Collapse>
      )}
    </Space>
  );

  return (
    <div>
      <ControlHeader onChange={onChange} />
      {offerEditInModal ? (
        <>
          <div style={{ marginBottom: '16px' }}>
            {actions.length === 0 ? (
              <>
                <Alert
                  message="No split table header actions added yet."
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
                    Add New Action
                  </Button>
                </div>
              </>
            ) : (
              actions.map((action, index) => renderCard(action, index))
            )}
          </div>
          {!readOnly && actions.length>0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Button size="small" type="primary" onClick={openAddModal} icon={<EditOutlined />}>
                Edit Actions
              </Button>
            </div>
          )}
          <Modal
            title="Manage Split Table Header Actions"
            visible={modalVisible}
            onCancel={closeModal}
            footer={<Button size="small" onClick={closeModal}>Done</Button>}
            width="500px"
            bodyStyle={{ padding: '12px' }}
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

SplitActionsControl.propTypes = {
  initialValue: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
  onChange: PropTypes.func,
  language: PropTypes.string,
  readOnly: PropTypes.bool,
  offerEditInModal: PropTypes.bool,
};

export default SplitActionsControl;
