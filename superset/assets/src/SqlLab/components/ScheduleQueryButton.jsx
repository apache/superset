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
import { t } from '@superset-ui/translation';

import Button from '../../components/Button';
import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  defaultLabel: PropTypes.string,
  sql: PropTypes.string.isRequired,
  schema: PropTypes.string.isRequired,
  dbId: PropTypes.number.isRequired,
  animation: PropTypes.bool,
  onSchedule: PropTypes.func,
};
const defaultProps = {
  defaultLabel: t('Undefined'),
  animation: true,
  onSchedule: () => {},
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
  toggleSchedule(e) {
    this.setState({ target: e.target, showSchedule: !this.state.showSchedule });
  }
  renderModalBody() {
    return (
      <Form
        schema={window.featureFlags.SCHEDULED_QUERIES.JSONSCHEMA}
        uiSchema={window.featureFlags.SCHEDULED_QUERIES.UISCHEMA}
        onSubmit={this.onSchedule}
      />
    );
  }
  render() {
    return (
      <span className="ScheduleQueryButton">
        <ModalTrigger
          ref={(ref) => { this.saveModal = ref; }}
          modalTitle={t('Schedule Query')}
          modalBody={this.renderModalBody()}
          triggerNode={
            <Button bsSize="small" className="toggleSchedule" onClick={this.toggleSchedule}>
              <i className="fa fa-calendar" /> {t('Schedule Query')}
            </Button>
          }
          bsSize="medium"
        />
      </span>
    );
  }
}
ScheduleQueryButton.propTypes = propTypes;
ScheduleQueryButton.defaultProps = defaultProps;

export default ScheduleQueryButton;
