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
import { Component } from 'react';
import PropTypes from 'prop-types';
import { Tabs, Form, Input, Button, Space, Alert } from 'antd';
import { t } from '@superset-ui/core';
import ControlHeader from 'src/explore/components/ControlHeader';
import ModalTrigger from 'src/components/ModalTrigger';

const { TabPane } = Tabs;

class TableActionFormControl extends Component {
  constructor(props) {
    super(props);
    this.state = {
      actions: props.initialValue || [],
      jsonInput: JSON.stringify(props.initialValue || { view: { label: 'View', action: 'view' } }, null, 2),
      activeTab: 'simple',
    };
  }

  handleAddAction = (values) => {
    const { actions } = this.state;
    const newAction = {
      label: values.label,
      action: values.action,
    };
    const updatedActions = [...actions, newAction];
    this.setState({ actions: updatedActions });
    this.props.onChange(updatedActions);
  };

  handleRemoveAction = (index) => {
    const { actions } = this.state;
    const updatedActions = actions.filter((_, i) => i !== index);
    this.setState({ actions: updatedActions });
    this.props.onChange(updatedActions);
  };

  handleJsonChange = (value) => {
    this.setState({ jsonInput: value });
    try {
      const parsedJson = JSON.parse(value);
      this.props.onChange(parsedJson);
    } catch (error) {
      // Invalid JSON, do nothing
    }
  };

  handleTabChange = (key) => {
    const { actions, jsonInput } = this.state;
    if (key === 'simple') {
      try {
        const parsedJson = JSON.parse(jsonInput);
        const actionsArray = Object.values(parsedJson);
        this.setState({ actions: actionsArray });
      } catch (error) {
        // Invalid JSON, do nothing
      }
    } else if (key === 'advanced') {
      const jsonOutput = actions.reduce((acc, action) => {
        acc[action.action] = action;
        return acc;
      }, {});
      this.setState({ jsonInput: JSON.stringify(jsonOutput, null, 2) });
    }
    this.setState({ activeTab: key });
  };

  renderSimpleMode() {
    const { actions } = this.state;
    const [form] = Form.useForm();

    return (
      <div>
        {actions.map((action, index) => (
          <div key={index} style={{ marginBottom: '8px' }}>
            <Space>
              <Input value={action.label} disabled />
              <Input value={action.action} disabled />
              <Button type="link" danger onClick={() => this.handleRemoveAction(index)}>
                Remove
              </Button>
            </Space>
          </div>
        ))}

        <Form form={form} onFinish={this.handleAddAction} layout="inline">
          <Form.Item
            name="label"
            label="Label"
            rules={[{ required: true, message: 'Please enter a label' }]}
          >
            <Input placeholder="Action label (e.g., Edit)" />
          </Form.Item>
          <Form.Item
            name="action"
            label="Action"
            rules={[{ required: true, message: 'Please enter an action' }]}
          >
            <Input placeholder="Action type (e.g., edit)" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              Add Action
            </Button>
          </Form.Item>
        </Form>

        {actions.length === 0 && (
          <Alert
            message="No actions added yet."
            type="info"
            showIcon
            style={{ marginTop: '16px' }}
          />
        )}
      </div>
    );
  }

  renderAdvancedMode() {
    const { jsonInput } = this.state;

    return (
      <div>
        <Input.TextArea
          rows={10}
          value={jsonInput}
          onChange={(e) => this.handleJsonChange(e.target.value)}
          placeholder="Enter actions in JSON format"
        />
        {jsonInput && (
          <Alert
            message="Make sure the JSON is valid."
            type="warning"
            showIcon
            style={{ marginTop: '16px' }}
          />
        )}
      </div>
    );
  }

  renderModalBody() {
    return (
      <Tabs activeKey={this.state.activeTab} onChange={this.handleTabChange}>
        <TabPane tab="Simple" key="simple">
          {this.renderSimpleMode()}
        </TabPane>
        <TabPane tab="Advanced" key="advanced">
          {this.renderAdvancedMode()}
        </TabPane>
      </Tabs>
    );
  }

  render() {
    const controlHeader = <ControlHeader {...this.props} />;
    return (
      <div>
        {controlHeader}
        <Tabs activeKey={this.state.activeTab} onChange={this.handleTabChange}>
          <TabPane tab="Simple" key="simple">
            {this.renderSimpleMode()}
          </TabPane>
          <TabPane tab="Advanced" key="advanced">
            {this.renderAdvancedMode()}
          </TabPane>
        </Tabs>
        {this.props.offerEditInModal && (
          <ModalTrigger
            modalTitle={controlHeader}
            triggerNode={
              <Button buttonSize="small" className="m-t-5">
                {t('Edit')} <strong>{this.props.language}</strong> {t('in modal')}
              </Button>
            }
            modalBody={this.renderModalBody()}
            responsive
          />
        )}
      </div>
    );
  }
}

TableActionFormControl.propTypes = {
  name: PropTypes.string,
  onChange: PropTypes.func,
  initialValue: PropTypes.array,
  offerEditInModal: PropTypes.bool,
  language: PropTypes.string,
  readOnly: PropTypes.bool,
};

TableActionFormControl.defaultProps = {
  onChange: () => {},
  initialValue: [],
  offerEditInModal: true,
  language: 'json',
  readOnly: false,
};

export default TableActionFormControl;
