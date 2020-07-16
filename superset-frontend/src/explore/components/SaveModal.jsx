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
import { FormGroup, Modal, Alert, Button, Radio } from 'react-bootstrap';
import Checkbox from '../../components/Checkbox';
import Select from 'src/components/Select';
import { t } from '@superset-ui/translation';

import { supersetURL } from '../../utils/common';
import { EXPLORE_ONLY_VIZ_TYPE } from '../constants';

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

class SaveModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      saveToDashboardId: null,
      newSliceName: props.sliceName,
      dashboards: [],
      alert: null,
      action: props.can_overwrite ? 'overwrite' : 'saveas',
      addToDash: false,
      vizType: props.form_data.viz_type,
    };
    this.toggleDash = this.toggleDash.bind(this);
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
          addToDash: true,
        });
      }
    });
  }
  onChange(name, event) {
    switch (name) {
      case 'newSliceName':
        this.setState({ newSliceName: event.target.value });
        break;
      case 'saveToDashboardId':
        this.setState({ saveToDashboardId: event ? event.value : null });
        this.toggleDash(true);
        break;
      default:
        break;
    }
  }
  changeAction(action) {
    this.setState({ action });
  }
  toggleDash(isOn) {
    const addToDash = isOn !== undefined ? isOn : !this.state.addToDash;
    this.setState({ addToDash });
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

    const { addToDash } = this.state;
    if (addToDash) {
      sliceParams.add_to_dash = addToDash;
      if (this.state.saveToDashboardId) {
        sliceParams.save_to_dashboard_id = this.state.saveToDashboardId;
      } else {
        sliceParams.new_dashboard_name = t('Untitled dashboard');
      }
    }
    sliceParams.goto_dash = gotodash;

    this.props.actions
      .saveSlice(this.props.form_data, sliceParams)
      .then(({ data }) => {
        if (data.dashboard_id === null) {
          sessionStorage.removeItem(SK_DASHBOARD_ID);
        } else {
          sessionStorage.setItem(SK_DASHBOARD_ID, data.dashboard_id);
        }
        // Go to new slice url or dashboard url
        if (gotodash) {
          window.location.assign(supersetURL(data.dashboard));
        } else {
          window.location.assign(data.slice.slice_url);
        }
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
    const canNotSaveToDash =
      EXPLORE_ONLY_VIZ_TYPE.indexOf(this.state.vizType) > -1;
    return (
      <Modal show onHide={this.props.onHide} bsSize="medium">
        <Modal.Header closeButton>
          <Modal.Title>{t('Save A Chart')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {(this.state.alert || this.props.alert) && (
            <Alert>
              {this.state.alert ? this.state.alert : this.props.alert}
              <i
                role="button"
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
              {t('Save as')} &nbsp;
            </Radio>
          </FormGroup>
          <input
            name="new_slice_name"
            placeholder={this.state.newSliceName || t('[chart name]')}
            onChange={this.onChange.bind(this, 'newSliceName')}
            onFocus={this.changeAction.bind(this, 'saveas')}
          />
          <br />
          <hr />
          <Checkbox
            inline
            className="m-r-5"
            disabled={canNotSaveToDash}
            checked={this.state.addToDash}
            label={t('Add to dashboard')}
            onChange={this.toggleDash}
            data-test="add-to-existing-dashboard"
          />
          <Select
            className="save-modal-selector"
            options={this.props.dashboards}
            clearable
            onChange={this.onChange.bind(this, 'saveToDashboardId')}
            isDisabled={!this.state.addToDash}
            autoSize={false}
            value={this.state.saveToDashboardId}
            placeholder="Select a dashboard or leave empty to create a new one"
          />
        </Modal.Body>

        <Modal.Footer>
          <div className="float-right">
            <Button
              type="button"
              id="btn_cancel"
              bsSize="sm"
              onClick={this.props.onHide}
            >
              {t('Cancel')}
            </Button>
            <Button
              type="button"
              id="btn_modal_save_goto_dash"
              bsSize="sm"
              disabled={!this.state.addToDash || canNotSaveToDash}
              onClick={this.saveOrOverwrite.bind(this, true)}
            >
              {t('Save & go to dashboard')}
            </Button>
            <Button
              type="button"
              id="btn_modal_save"
              bsSize="sm"
              bsStyle="primary"
              onClick={this.saveOrOverwrite.bind(this, false)}
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

export { SaveModal };
export default connect(mapStateToProps, () => ({}))(SaveModal);
