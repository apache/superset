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
import { Row, Col, Button, Modal, FormControl } from 'react-bootstrap';
import Dialog from 'react-bootstrap-dialog';
import Select from 'react-select';
import AceEditor from 'react-ace';
import { t } from '@superset-ui/translation';
import { SupersetClient } from '@superset-ui/connection';
import '../stylesheets/buttons.less';

import getClientErrorObject from '../../utils/getClientErrorObject';
import withToasts from '../../messageToasts/enhancers/withToasts';

const propTypes = {
  dashboardId: PropTypes.number.isRequired,
  show: PropTypes.bool.isRequired,
  onHide: PropTypes.func,
  onDashboardSave: PropTypes.func,
  addSuccessToast: PropTypes.func.isRequired,
};

const defaultProps = {
  onHide: () => {},
  onDashboardSave: () => {},
  show: false,
};

class PropertiesModal extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      errors: [],
      values: {
        dashboard_title: '',
        slug: '',
        owners: [],
        json_metadata: '',
      },
      isDashboardLoaded: false,
      ownerOptions: null,
      isAdvancedOpen: false,
    };
    this.onChange = this.onChange.bind(this);
    this.onMetadataChange = this.onMetadataChange.bind(this);
    this.onOwnersChange = this.onOwnersChange.bind(this);
    this.save = this.save.bind(this);
    this.toggleAdvanced = this.toggleAdvanced.bind(this);
  }

  componentDidMount() {
    this.fetchOwnerOptions();
    this.fetchDashboardDetails();
  }

  onOwnersChange(value) {
    this.updateFormState('owners', value);
  }

  onMetadataChange(metadata) {
    this.updateFormState('json_metadata', metadata);
  }

  onChange(e) {
    const { name, value } = e.target;
    this.updateFormState(name, value);
  }

  fetchDashboardDetails() {
    // We fetch the dashboard details because not all code
    // that renders this component have all the values we need.
    // At some point when we have a more consistent frontend
    // datamodel, the dashboard could probably just be passed as a prop.
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/${this.props.dashboardId}`,
    })
      .then(response => {
        const dashboard = response.json.result;
        this.setState(state => ({
          isDashboardLoaded: true,
          values: {
            ...state.values,
            dashboard_title: dashboard.dashboard_title || '',
            slug: dashboard.slug || '',
            json_metadata: dashboard.json_metadata || '',
          },
        }));
        const initialSelectedValues = dashboard.owners.map(owner => ({
          value: owner.id,
          label: owner.username,
        }));
        this.onOwnersChange(initialSelectedValues);
      })
      .catch(err => console.error(err));
  }

  fetchOwnerOptions() {
    SupersetClient.get({
      endpoint: `/api/v1/dashboard/related/owners`,
    })
      .then(response => {
        const options = response.json.result.map(item => ({
          value: item.value,
          label: item.text,
        }));
        this.setState({
          ownerOptions: options,
        });
      })
      .catch(err => console.error(err));
  }

  updateFormState(name, value) {
    this.setState(state => ({
      values: {
        ...state.values,
        [name]: value,
      },
    }));
  }

  toggleAdvanced() {
    this.setState(state => ({
      isAdvancedOpen: !state.isAdvancedOpen,
    }));
  }

  save(e) {
    e.preventDefault();
    e.stopPropagation();
    const { values } = this.state;
    const owners = values.owners.map(o => o.value);

    SupersetClient.put({
      endpoint: `/api/v1/dashboard/${this.props.dashboardId}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dashboard_title: values.dashboard_title,
        slug: values.slug || null,
        json_metadata: values.json_metadata || null,
        owners,
      }),
    })
      .then(({ json }) => {
        this.props.addSuccessToast(t('The dashboard has been saved'));
        this.props.onDashboardSave({
          id: this.props.dashboardId,
          title: json.result.dashboard_title,
          slug: json.result.slug,
          jsonMetadata: json.result.json_metadata,
          ownerIds: json.result.owners,
        });
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

  render() {
    const {
      ownerOptions,
      values,
      isDashboardLoaded,
      isAdvancedOpen,
    } = this.state;
    return (
      <Modal show={this.props.show} onHide={this.props.onHide} bsSize="lg">
        <form onSubmit={this.save}>
          <Modal.Header closeButton>
            <Modal.Title>
              <div>
                <span className="float-left">{t('Dashboard Properties')}</span>
              </div>
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row>
              <Col md={12}>
                <h3>{t('Basic Information')}</h3>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <label className="control-label" htmlFor="embed-height">
                  {t('Title')}
                </label>
                <FormControl
                  name="dashboard_title"
                  type="text"
                  bsSize="sm"
                  value={values.dashboard_title}
                  onChange={this.onChange}
                  disabled={!isDashboardLoaded}
                />
              </Col>
              <Col md={6}>
                <label className="control-label" htmlFor="embed-height">
                  {t('URL Slug')}
                </label>
                <FormControl
                  name="slug"
                  type="text"
                  bsSize="sm"
                  value={values.slug || ''}
                  onChange={this.onChange}
                  disabled={!isDashboardLoaded}
                />
                <p className="help-block">
                  {t('A readable URL for your dashboard')}
                </p>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <h3 style={{ marginTop: '1em' }}>{t('Access')}</h3>
                <label className="control-label" htmlFor="owners">
                  {t('Owners')}
                </label>
                <Select
                  name="owners"
                  multi
                  isLoading={!ownerOptions}
                  value={values.owners}
                  options={ownerOptions || []}
                  onChange={this.onOwnersChange}
                  disabled={!ownerOptions || !isDashboardLoaded}
                />
                <p className="help-block">
                  {t('Owners is a list of users who can alter the dashboard.')}
                </p>
              </Col>
            </Row>
            <Row>
              <Col md={12}>
                <h3 style={{ marginTop: '1em' }}>
                  <button
                    type="button"
                    className="text-button"
                    onClick={this.toggleAdvanced}
                  >
                    <i
                      className={`fa fa-angle-${
                        isAdvancedOpen ? 'down' : 'right'
                      }`}
                      style={{ minWidth: '1em' }}
                    />
                    {t('Advanced')}
                  </button>
                </h3>
                {isAdvancedOpen && (
                  <>
                    <label className="control-label" htmlFor="json_metadata">
                      {t('JSON Metadata')}
                    </label>
                    <AceEditor
                      mode="json"
                      name="json_metadata"
                      defaultValue={this.defaultMetadataValue}
                      value={values.json_metadata}
                      onChange={this.onMetadataChange}
                      theme="textmate"
                      tabSize={2}
                      width="100%"
                      height="200px"
                    />
                    <p className="help-block">
                      {t(
                        'This JSON object is generated dynamically when clicking the save or overwrite button in the dashboard view. It is exposed here for reference and for power users who may want to alter specific parameters.',
                      )}
                    </p>
                  </>
                )}
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <span className="float-right">
              <Button
                type="submit"
                bsSize="sm"
                bsStyle="primary"
                className="m-r-5"
                disabled={this.state.errors.length > 0}
              >
                {t('Save')}
              </Button>
              <Button type="button" bsSize="sm" onClick={this.props.onHide}>
                {t('Cancel')}
              </Button>
              <Dialog
                ref={ref => {
                  this.dialog = ref;
                }}
              />
            </span>
          </Modal.Footer>
        </form>
      </Modal>
    );
  }
}

PropertiesModal.propTypes = propTypes;
PropertiesModal.defaultProps = defaultProps;

export default withToasts(PropertiesModal);
