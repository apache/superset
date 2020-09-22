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
import React from 'react';
import PropTypes from 'prop-types';
import Form from 'react-jsonschema-form';
import chrono from 'chrono-node';
import { Col, FormControl, FormGroup, Row } from 'react-bootstrap';
import { t } from '@superset-ui/core';

import Button from 'src/components/Button';
import ModalTrigger from 'src/components/ModalTrigger';
import FormLabel from 'src/components/FormLabel';
import './ScheduleQueryButton.less';

const validators = {
  greater: (a, b) => a > b,
  greater_equal: (a, b) => a >= b,
  less: (a, b) => a < b,
  less_equal: (a, b) => a <= b,
};

function getJSONSchema() {
  const jsonSchema = window.featureFlags.SCHEDULED_QUERIES.JSONSCHEMA;
  // parse date-time into usable value (eg, 'today' => `new Date()`)
  Object.entries(jsonSchema.properties).forEach(([key, properties]) => {
    if (properties.default && properties.format === 'date-time') {
      jsonSchema.properties[key] = {
        ...properties,
        default: chrono.parseDate(properties.default).toISOString(),
      };
    }
  });
  return jsonSchema;
}

function getUISchema() {
  return window.featureFlags.SCHEDULED_QUERIES.UISCHEMA;
}

function getValidationRules() {
  return window.featureFlags.SCHEDULED_QUERIES.VALIDATION || [];
}

function getValidator() {
  const rules = getValidationRules();
  return (formData, errors) => {
    rules.forEach(rule => {
      const test = validators[rule.name];
      const args = rule.arguments.map(name => formData[name]);
      const container = rule.container || rule.arguments.slice(-1)[0];
      if (!test(...args)) {
        errors[container].addError(rule.message);
      }
    });
    return errors;
  };
}

const propTypes = {
  defaultLabel: PropTypes.string,
  sql: PropTypes.string.isRequired,
  schema: PropTypes.string.isRequired,
  dbId: PropTypes.number.isRequired,
  animation: PropTypes.bool,
  onSchedule: PropTypes.func,
  scheduleQueryWarning: PropTypes.string,
  disabled: PropTypes.bool,
  tooltip: PropTypes.string,
};
const defaultProps = {
  defaultLabel: t('Undefined'),
  animation: true,
  onSchedule: () => {},
  scheduleQueryWarning: null,
  disabled: false,
  tooltip: null,
};

class ScheduleQueryButton extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      description: '',
      label: props.defaultLabel,
      showSchedule: false,
    };
    this.toggleSchedule = this.toggleSchedule.bind(this);
    this.onSchedule = this.onSchedule.bind(this);
    this.onCancel = this.onCancel.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.onDescriptionChange = this.onDescriptionChange.bind(this);
  }

  onSchedule({ formData }) {
    const query = {
      label: this.state.label,
      description: this.state.description,
      db_id: this.props.dbId,
      schema: this.props.schema,
      sql: this.props.sql,
      extra_json: JSON.stringify({ schedule_info: formData }),
    };
    this.props.onSchedule(query);
    this.saveModal.close();
  }

  onCancel() {
    this.saveModal.close();
  }

  onLabelChange(e) {
    this.setState({ label: e.target.value });
  }

  onDescriptionChange(e) {
    this.setState({ description: e.target.value });
  }

  toggleSchedule() {
    this.setState(prevState => ({ showSchedule: !prevState.showSchedule }));
  }

  renderModalBody() {
    return (
      <FormGroup>
        <Row style={{ paddingBottom: '10px' }}>
          <Col md={12}>
            <FormLabel className="control-label" htmlFor="embed-height">
              {t('Label')}
            </FormLabel>
            <FormControl
              type="text"
              placeholder={t('Label for your query')}
              value={this.state.label}
              onChange={this.onLabelChange}
            />
          </Col>
        </Row>
        <Row style={{ paddingBottom: '10px' }}>
          <Col md={12}>
            <FormLabel className="control-label" htmlFor="embed-height">
              {t('Description')}
            </FormLabel>
            <FormControl
              componentClass="textarea"
              placeholder={t('Write a description for your query')}
              value={this.state.description}
              onChange={this.onDescriptionChange}
            />
          </Col>
        </Row>
        <Row>
          <Col md={12}>
            <div className="json-schema">
              <Form
                schema={getJSONSchema()}
                uiSchema={getUISchema()}
                onSubmit={this.onSchedule}
                validate={getValidator()}
              />
            </div>
          </Col>
        </Row>
        {this.props.scheduleQueryWarning && (
          <Row>
            <Col md={12}>
              <small>{this.props.scheduleQueryWarning}</small>
            </Col>
          </Row>
        )}
      </FormGroup>
    );
  }

  render() {
    return (
      <span className="ScheduleQueryButton">
        <ModalTrigger
          ref={ref => {
            this.saveModal = ref;
          }}
          modalTitle={t('Schedule Query')}
          modalBody={this.renderModalBody()}
          triggerNode={
            <Button
              buttonSize="small"
              className="toggleSchedule"
              onClick={this.toggleSchedule}
              disabled={this.props.disabled}
              tooltip={this.props.tooltip}
            >
              <i className="fa fa-calendar" /> {t('Schedule')}
            </Button>
          }
        />
      </span>
    );
  }
}
ScheduleQueryButton.propTypes = propTypes;
ScheduleQueryButton.defaultProps = defaultProps;

export default ScheduleQueryButton;
