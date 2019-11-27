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
import { FormControl, FormGroup, Row, Col } from 'react-bootstrap';
import { t } from '@superset-ui/translation';

import Button from '../../components/Button';
import ModalTrigger from '../../components/ModalTrigger';

const propTypes = {
  query: PropTypes.object,
  defaultLabel: PropTypes.string,
  animation: PropTypes.bool,
  onSave: PropTypes.func,
  onUpdate: PropTypes.func,
  saveQueryWarning: PropTypes.string,
};
const defaultProps = {
  defaultLabel: t('Undefined'),
  animation: true,
  onSave: () => {},
  saveQueryWarning: null,
};

class SaveQuery extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      description: '',
      label: props.defaultLabel,
      showSave: false,
    };
    this.toggleSave = this.toggleSave.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onUpdate = this.onUpdate.bind(this);
    this.onCancel = this.onCancel.bind(this);
    this.onLabelChange = this.onLabelChange.bind(this);
    this.onDescriptionChange = this.onDescriptionChange.bind(this);
  }
  onSave() {
    this.props.onSave(this.queryPayload());
    this.close();
  }
  onUpdate() {
    this.props.onUpdate(this.queryPayload());
    this.close();
  }
  onCancel() {
    this.close();
  }
  onLabelChange(e) {
    this.setState({ label: e.target.value });
  }
  onDescriptionChange(e) {
    this.setState({ description: e.target.value });
  }
  queryPayload() {
    return {
      ...this.props.query,
      title: this.state.label,
      description: this.state.description,
    };
  }
  close() {
    if (this.saveModal) this.saveModal.close();
  }
  toggleSave(e) {
    this.setState({ target: e.target, showSave: !this.state.showSave });
  }
  renderModalBody() {
    const isSaved = !!this.props.query.remoteId;
    return (
      <FormGroup bsSize="small">
        <Row>
          <Col md={12}>
            <small>
              <label className="control-label" htmlFor="embed-height">
                {t('Label')}
              </label>
            </small>
            <FormControl
              type="text"
              placeholder={t('Label for your query')}
              value={this.state.label}
              onChange={this.onLabelChange}
            />
          </Col>
        </Row>
        <br />
        <Row>
          <Col md={12}>
            <small>
              <label className="control-label" htmlFor="embed-height">
                {t('Description')}
              </label>
            </small>
            <FormControl
              componentClass="textarea"
              placeholder={t('Write a description for your query')}
              value={this.state.description}
              onChange={this.onDescriptionChange}
            />
          </Col>
        </Row>
        <br />
        {this.props.saveQueryWarning && (
          <div>
            <Row>
              <Col md={12}>
                <small>{this.props.saveQueryWarning}</small>
              </Col>
            </Row>
            <br />
          </div>
        )}
        <Row>
          <Col md={12}>
            {isSaved && (
              <Button
                bsStyle="primary"
                onClick={this.onUpdate}
                className="m-r-3"
              >
                {t('Update')}
              </Button>
            )}
            <Button
              bsStyle={isSaved ? undefined : 'primary'}
              onClick={this.onSave}
              className="m-r-3"
            >
              {isSaved ? t('Save New') : t('Save')}
            </Button>
            <Button onClick={this.onCancel} className="cancelQuery">
              {t('Cancel')}
            </Button>
          </Col>
        </Row>
      </FormGroup>
    );
  }
  render() {
    return (
      <span className="SaveQuery">
        <ModalTrigger
          ref={ref => {
            this.saveModal = ref;
          }}
          modalTitle={t('Save Query')}
          modalBody={this.renderModalBody()}
          backdrop="static"
          triggerNode={
            <Button
              bsSize="small"
              className="toggleSave"
              onClick={this.toggleSave}
            >
              <i className="fa fa-save" /> {t('Save Query')}
            </Button>
          }
          bsSize="small"
        />
      </span>
    );
  }
}
SaveQuery.propTypes = propTypes;
SaveQuery.defaultProps = defaultProps;

export default SaveQuery;
