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
/* eslint camelcase: 0 */
import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Alert, FormControl, FormGroup, Modal, Radio } from 'react-bootstrap';
import Button from 'src/components/Button';
import FormLabel from 'src/components/FormLabel';
import { CreatableSelect } from 'src/components/Select/SupersetStyledSelect';
import { t } from '@superset-ui/core';
import ReactMarkdown from 'react-markdown';

const propTypes = {
  can_overwrite: PropTypes.bool,
  onHide: PropTypes.func.isRequired,
  actions: PropTypes.object.isRequired,
  form_data: PropTypes.object,
  userId: PropTypes.string.isRequired,
  dashboards: PropTypes.array.isRequired,
  alert: PropTypes.string,
  slice: PropTypes.object,
  datasource: PropTypes.object,
};

// Session storage key for recent dashboard
const SK_DASHBOARD_ID = 'save_chart_recent_dashboard';
const SELECT_PLACEHOLDER = t('**Select** a dashboard OR **create** a new one');

class SaveModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      saveToDashboardId: null,
      newSliceName: props.sliceName,
      alert: null,
      action: props.can_overwrite ? 'overwrite' : 'saveas',
    };
    this.onDashboardSelectChange = this.onDashboardSelectChange.bind(this);
    this.onSliceNameChange = this.onSliceNameChange.bind(this);
  }

  componentDidMount() {
    this.props.actions.fetchDashboards(this.props.userId).then(() => {
      const dashboardIds = this.props.dashboards.map(
        dashboard => dashboard.value,
      );
      let recentDashboard = sessionStorage.getItem(SK_DASHBOARD_ID);
      recentDashboard = recentDashboard && parseInt(recentDashboard, 10);
      if (
        recentDashboard !== null &&
        dashboardIds.indexOf(recentDashboard) !== -1
      ) {
        this.setState({
          saveToDashboardId: recentDashboard,
        });
      }
    });
  }

  onSliceNameChange(event) {
    this.setState({ newSliceName: event.target.value });
  }

  onDashboardSelectChange(event) {
    const newDashboardName = event ? event.label : null;
    const saveToDashboardId =
      event && typeof event.value === 'number' ? event.value : null;
    this.setState({ saveToDashboardId, newDashboardName });
  }

  changeAction(action) {
    this.setState({ action });
  }

  saveOrOverwrite(gotodash) {
    this.setState({ alert: null });
    this.props.actions.removeSaveModalAlert();
    const sliceParams = {};

    if (this.props.slice && this.props.slice.slice_id) {
      sliceParams.slice_id = this.props.slice.slice_id;
    }
    if (sliceParams.action === 'saveas') {
      if (this.state.newSliceName === '') {
        this.setState({ alert: t('Please enter a chart name') });
        return;
      }
    }
    sliceParams.action = this.state.action;
    sliceParams.slice_name = this.state.newSliceName;
    sliceParams.save_to_dashboard_id = this.state.saveToDashboardId;
    sliceParams.new_dashboard_name = this.state.newDashboardName;

    this.props.actions
      .saveSlice(this.props.form_data, sliceParams)
      .then(({ data }) => {
        if (data.dashboard_id === null) {
          sessionStorage.removeItem(SK_DASHBOARD_ID);
        } else {
          sessionStorage.setItem(SK_DASHBOARD_ID, data.dashboard_id);
        }
        // Go to new slice url or dashboard url
        const url = gotodash ? data.dashboard_url : data.slice.slice_url;
        window.location.assign(url);
      });
    this.props.onHide();
  }

  removeAlert() {
    if (this.props.alert) {
      this.props.actions.removeSaveModalAlert();
    }
    this.setState({ alert: null });
  }

  render() {
    return (
      <Modal show onHide={this.props.onHide}>
        <Modal.Header closeButton>
          <Modal.Title>{t('Save Chart')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {(this.state.alert || this.props.alert) && (
            <Alert>
              {this.state.alert ? this.state.alert : this.props.alert}
              <i
                role="button"
                aria-label="Remove alert"
                tabIndex={0}
                className="fa fa-close pull-right"
                onClick={this.removeAlert.bind(this)}
                style={{ cursor: 'pointer' }}
              />
            </Alert>
          )}
          <FormGroup>
            <Radio
              id="overwrite-radio"
              inline
              disabled={!(this.props.can_overwrite && this.props.slice)}
              checked={this.state.action === 'overwrite'}
              onChange={this.changeAction.bind(this, 'overwrite')}
            >
              {t('Save (Overwrite)')}
            </Radio>
            <Radio
              id="saveas-radio"
              inline
              checked={this.state.action === 'saveas'}
              onChange={this.changeAction.bind(this, 'saveas')}
            >
              {' '}
              {t('Save as ...')} &nbsp;
            </Radio>
          </FormGroup>
          <hr />
          <FormGroup>
            <FormLabel required>{t('Chart name')}</FormLabel>
            <FormControl
              name="new_slice_name"
              type="text"
              bsSize="sm"
              placeholder="Name"
              value={this.state.newSliceName}
              onChange={this.onSliceNameChange}
            />
          </FormGroup>
          <FormGroup>
            <FormLabel required>{t('Add to dashboard')}</FormLabel>
            <CreatableSelect
              id="dashboard-creatable-select"
              className="save-modal-selector"
              options={this.props.dashboards}
              clearable
              creatable
              onChange={this.onDashboardSelectChange}
              autoSize={false}
              value={
                this.state.saveToDashboardId || this.state.newDashboardName
              }
              placeholder={
                // Using markdown to allow for good i18n
                <ReactMarkdown
                  source={SELECT_PLACEHOLDER}
                  renderers={{ paragraph: 'span' }}
                />
              }
            />
          </FormGroup>
        </Modal.Body>

        <Modal.Footer>
          <div className="float-right">
            <Button id="btn_cancel" buttonSize="sm" onClick={this.props.onHide}>
              {t('Cancel')}
            </Button>
            <Button
              id="btn_modal_save_goto_dash"
              buttonSize="sm"
              disabled={
                !this.state.newSliceName || !this.state.newDashboardName
              }
              onClick={this.saveOrOverwrite.bind(this, true)}
            >
              {t('Save & go to dashboard')}
            </Button>
            <Button
              id="btn_modal_save"
              buttonSize="sm"
              buttonStyle="primary"
              onClick={this.saveOrOverwrite.bind(this, false)}
              disabled={!this.state.newSliceName}
            >
              {t('Save')}
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    );
  }
}

SaveModal.propTypes = propTypes;

function mapStateToProps({ explore, saveModal }) {
  return {
    datasource: explore.datasource,
    slice: explore.slice,
    can_overwrite: explore.can_overwrite,
    userId: explore.user_id,
    dashboards: saveModal.dashboards,
    alert: saveModal.saveModalAlert,
  };
}

export default connect(mapStateToProps, () => ({}))(SaveModal);
