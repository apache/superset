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
import { Alert, Button, Modal } from 'react-bootstrap';
import Dialog from 'react-bootstrap-dialog';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';

import getClientErrorObject from '../utils/getClientErrorObject';
import DatasourceEditor from '../datasource/DatasourceEditor';
import withToasts from '../messageToasts/enhancers/withToasts';

const propTypes = {
  onChange: PropTypes.func,
  datasource: PropTypes.object.isRequired,
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func,
  onDatasourceSave: PropTypes.func,
  addSuccessToast: PropTypes.func.isRequired,
};

const defaultProps = {
  onChange: () => {},
  onHide: () => {},
  onDatasourceSave: () => {},
  show: false,
};

class DatasourceModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      errors: [],
      datasource: props.datasource,
    };
    this.setSearchRef = this.setSearchRef.bind(this);
    this.onDatasourceChange = this.onDatasourceChange.bind(this);
    this.onClickSave = this.onClickSave.bind(this);
    this.onConfirmSave = this.onConfirmSave.bind(this);
    this.setDialogRef = this.setDialogRef.bind(this);
  }

  onClickSave() {
    this.dialog.show({
      title: t('Confirm save'),
      bsSize: 'medium',
      actions: [Dialog.CancelAction(), Dialog.OKAction(this.onConfirmSave)],
      body: this.renderSaveDialog(),
    });
  }

  onConfirmSave() {
    SupersetClient.post({
      endpoint: '/datasource/save/',
      postPayload: {
        data: this.state.datasource,
      },
    })
      .then(({ json }) => {
        this.props.addSuccessToast(t('The datasource has been saved'));
        this.props.onDatasourceSave(json);
        this.props.onHide();
      })
      .catch(response =>
        getClientErrorObject(response).then(({ error, statusText }) => {
          this.dialog.show({
            title: 'Error',
            bsSize: 'medium',
            bsStyle: 'danger',
            actions: [Dialog.DefaultAction('Ok', () => {}, 'btn-danger')],
            body: error || statusText || t('An error has occurred'),
          });
        }),
      );
  }

  onDatasourceChange(datasource, errors) {
    this.setState({ datasource, errors });
  }

  setSearchRef(searchRef) {
    this.searchRef = searchRef;
  }

  setDialogRef(ref) {
    this.dialog = ref;
  }

  renderSaveDialog() {
    return (
      <div>
        <Alert bsStyle="warning" className="pointer" onClick={this.hideAlert}>
          <div>
            <i className="fa fa-exclamation-triangle" />{' '}
            {t(`The data source configuration exposed here
                affects all the charts using this datasource.
                Be mindful that changing settings
                here may affect other charts
                in undesirable ways.`)}
          </div>
        </Alert>
        {t('Are you sure you want to save and apply changes?')}
      </div>
    );
  }

  render() {
    return (
      <Modal show={this.props.show} onHide={this.props.onHide} bsSize="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <div>
              <span className="float-left">
                {t('Datasource Editor for ')}
                <strong>{this.props.datasource.name}</strong>
              </span>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {this.props.show && (
            <DatasourceEditor
              datasource={this.props.datasource}
              onChange={this.onDatasourceChange}
            />
          )}
        </Modal.Body>
        <Modal.Footer>
          <span className="float-left">
            <Button
              bsSize="sm"
              bsStyle="default"
              target="_blank"
              href={this.props.datasource.edit_url}
            >
              {t('Use Legacy Datasource Editor')}
            </Button>
          </span>

          <span className="float-right">
            <Button
              bsSize="sm"
              bsStyle="primary"
              className="m-r-5"
              onClick={this.onClickSave}
              disabled={this.state.errors.length > 0}
            >
              {t('Save')}
            </Button>
            <Button bsSize="sm" onClick={this.props.onHide}>
              {t('Cancel')}
            </Button>
            <Dialog ref={this.setDialogRef} />
          </span>
        </Modal.Footer>
      </Modal>
    );
  }
}

DatasourceModal.propTypes = propTypes;
DatasourceModal.defaultProps = defaultProps;

export default withToasts(DatasourceModal);
