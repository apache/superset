import React, {useEffect, useState} from 'react';
import PropTypes from 'prop-types';
import {Alert, Button, Card, Checkbox, Divider, Form, Input, Modal, Select, Space, Tabs, Tooltip,} from 'antd';
import {
  BellOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import ControlHeader from '../../../../../src/explore/components/ControlHeader';

const {Option} = Select;
const {TabPane} = Tabs;

const STYLE_OPTIONS = [
  {value: 'default', label: 'Default'},
  {value: 'primary', label: 'Primary'},
  {value: 'danger', label: 'Danger'},
  {value: 'success', label: 'Success'},
  {value: 'warning', label: 'Warning'},
];

const VISIBILITY_CONDITION_OPTIONS = [
  {value: 'selected', label: 'Selected'},
  {value: 'all', label: 'All'},
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


const NonSplitActionsControl = ({
                                  initialValue = [],
                                  onChange = () => {
                                  },
                                  language = 'json',
                                  readOnly = false,
                                  offerEditInModal = true,
                                  ...rest
                                }) => {
  const [actions, setActions] = useState(() => parseInitialValue(rest.value ||
    rest.default))
  ;
  const [editingIndex, setEditingIndex] = useState(null); // if null, then adding a new action
  const [showAddForm, setShowAddForm] = useState(false);
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [isPublishEvent, setIsPublishEvent] = useState(false);
  const [activeTab, setActiveTab] = useState('simple');
  const [advancedJson, setAdvancedJson] = useState('');

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

  const closeModal = () => {
    setModalVisible(false);
    setEditingIndex(null);
    setShowAddForm(false);
    form.resetFields();
  };

  const openModal = () => {
    setModalVisible(true);
    setEditingIndex(null);
    // If no actions exist, default to showing the add form
    setShowAddForm(actions.length === 0);
    form.resetFields();
  };

  const openAddModal = () => {
    openModal();
  };

  // In modal Simple tab, reveal the add form
  const revealAddForm = () => {
    setShowAddForm(true);
    setEditingIndex(null);
    form.resetFields();
  };

  const handleAddAction = (values) => {
    const newAction = {
      key: values.key,
      label: values.label,
      style: values.style,
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
  };

  const handleEditAction = (values) => {
    const updatedAction = {
      key: values.key,
      label: values.label,
      style: values.style,
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

  // Render form fields used for adding/editing in the Simple tab
  const renderFormFields = () => (
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
        rules={[{required: true, message: 'Please select a visibility condition'}]}
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
      <Form.Item shouldUpdate={(prev, cur) => prev.publishEvent !== cur.publishEvent} noStyle>
        {({getFieldValue}) =>
          !getFieldValue('publishEvent') && (
            <Form.Item
              name="actionUrl"
              label="Action URL"
              rules={[{required: true, message: 'Please enter an action URL'}]}
            >
              <Input placeholder="Enter action URL"/>
            </Form.Item>
          )
        }
      </Form.Item>
    </>
  );

  // Render a single action card (mirroring the Split UI)
  const renderCard = (action, index) => (
    <Card
      key={index}
      title={
        <div style={{fontWeight: 'bold', fontSize: '0.8rem', padding: '2px 4px'}}>
          {action.key}
        </div>
      }
      headStyle={{padding: '2px 4px'}}
      extra={
        !readOnly && (
          <div style={{display: 'flex', gap: 4}}>
            <Button
              size="small"
              type="text"
              icon={<EditOutlined/>}
              onClick={() => openModalWithEdit(index)}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined/>}
              onClick={() => handleRemoveAction(index)}
            />
          </div>
        )
      }
      style={{marginBottom: '4px'}}
      bodyStyle={{padding: '4px'}}
    >
      <div style={{fontSize: '0.8rem', marginBottom: '2px'}}>
        <strong>Label:</strong> {action.label}
      </div>
      <div style={{fontSize: '0.8rem', marginBottom: '2px'}}>
        <strong>Style:</strong> {action.style}
      </div>
      <Space style={{width: '100%', justifyContent: 'space-between'}}>
        <Space>
          <Tooltip title={`Bound: ${action.boundToSelection ? 'Yes' : 'No'}`}>
            {action.boundToSelection ? (
              <CheckOutlined style={{color: 'green', fontSize: '0.8rem'}}/>
            ) : (
              <CloseOutlined style={{color: 'red', fontSize: '0.8rem'}}/>
            )}
          </Tooltip>
          <Tooltip title={`Visibility: ${action.visibilityCondition}`}>
            <EyeOutlined style={{fontSize: '0.8rem'}}/>
          </Tooltip>
          <Tooltip title={`Publish Event: ${action.publishEvent ? 'Yes' : 'No'}`}>
            <BellOutlined style={{color: action.publishEvent ? 'blue' : 'grey', fontSize: '0.8rem'}}/>
          </Tooltip>
          {(!action.publishEvent) && action.actionUrl && (
            <Tooltip title={`Action URL: ${action.actionUrl}`}>
              <LinkOutlined style={{fontSize: '0.8rem'}}/>
            </Tooltip>
          )}
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
      publishEvent: action.publishEvent,
      actionUrl: action.actionUrl,
    });
    setIsPublishEvent(action.publishEvent);
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
      }
    };

    return (
      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane tab="Simple" key="simple">
          {(showAddForm || editingIndex !== null) && (
            <>
              <Form
                form={form}
                onFinish={editingIndex === null ? handleAddAction : handleEditAction}
                layout="vertical"
                style={{marginBottom: '16px'}}
              >
                {renderFormFields()}
                <Space style={{marginTop: 16}}>
                  <Button type="primary" htmlType="submit">
                    {editingIndex === null ? 'Add Action' : 'Save Changes'}
                  </Button>
                  <Button onClick={closeModal}>Cancel</Button>
                </Space>
              </Form>
              <Divider style={{margin: '16px 0'}}/>
            </>
          )}
          <Space direction="vertical" style={{width: '100%'}}>
            {actions.length === 0 ? (
              <Alert
                message="No actions added yet."
                type="info"
                showIcon
                style={{marginBottom: '16px'}}
              />
            ) : (
              actions.map((action, index) => renderCard(action, index))
            )}
          </Space>
          <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: 16}}>
            <Button size="small" type="primary" icon={<PlusOutlined/>} onClick={revealAddForm}>
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
          <Space style={{marginTop: 16}}>
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

  // Inline view if modal editing is not used
  const renderInlineContent = () => (
    <Space direction="vertical" style={{width: '100%'}}>
      {actions.length === 0 ? (
        <>
          <Alert
            message="No actions added yet."
            type="info"
            showIcon
            style={{marginBottom: '16px'}}
          />
          <div style={{display: 'flex', justifyContent: 'flex-end'}}>
            <Button size="small" type="primary" icon={<PlusOutlined/>} onClick={openAddModal}>
              Add New Action
            </Button>
          </div>
        </>
      ) : (
        actions.map((action, index) => renderCard(action, index))
      )}
    </Space>
  );

  return (
    <div>
      <ControlHeader onChange={onChange}/>
      {offerEditInModal ? (
        <>
          <div style={{marginBottom: '16px'}}>
            {actions.length === 0 ? (
              <>
                <Alert
                  message="No actions added yet."
                  type="info"
                  showIcon
                  style={{marginBottom: '16px'}}
                />
                <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                  <Button size="small" type="primary" icon={<PlusOutlined/>} onClick={openAddModal}>
                    Add New Action
                  </Button>
                </div>
              </>
            ) : (
              actions.map((action, index) => renderCard(action, index))
            )}
          </div>
          {!readOnly && actions.length > 0 && (
            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '16px'}}>
              <Button size="small" type="primary" onClick={openAddModal} icon={<EditOutlined/>}>
                Edit Actions
              </Button>
            </div>
          )}
          <Modal
            title="Manage Actions"
            visible={modalVisible}
            onCancel={closeModal}
            footer={<Button size="small" onClick={closeModal}>Done</Button>}
            width="500px"
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

NonSplitActionsControl.propTypes = {
  initialValue: PropTypes.array,
  onChange: PropTypes.func,
  language: PropTypes.string,
  readOnly: PropTypes.bool,
  offerEditInModal: PropTypes.bool,
};

export default NonSplitActionsControl;
