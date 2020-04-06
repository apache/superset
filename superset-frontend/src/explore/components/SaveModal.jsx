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
import { Modal, Alert, Button, Radio } from 'react-bootstrap';
import Select from 'react-select';
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

class SaveModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      saveToDashboardId: null,
      newDashboardName: '',
      newSliceName: '',
      dashboards: [],
      alert: null,
      action: props.can_overwrite ? 'overwrite' : 'saveas',
      addToDash: 'noSave',
      vizType: props.form_data.viz_type,
    };
  }
  componentDidMount() {
    this.props.actions.fetchDashboards(this.props.userId).then(() => {
      const dashboardIds = this.props.dashboards.map(
        dashboard => dashboard.value,
      );
      let recentDashboard = sessionStorage.getItem(
        'save_chart_recent_dashboard',
      );
      recentDashboard = recentDashboard && parseInt(recentDashboard, 10);
      if (
        recentDashboard !== null &&
        dashboardIds.indexOf(recentDashboard) !== -1
      ) {
        this.setState({
          saveToDashboardId: recentDashboard,
          addToDash: 'existing',
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
        this.setState({ saveToDashboardId: event.value });
        this.changeDash('existing');
        break;
      case 'newDashboardName':
        this.setState({ newDashboardName: event.target.value });
        break;
      default:
        break;
    }
  }
  changeAction(action) {
    this.setState({ action });
  }
  changeDash(dash) {
    this.setState({ addToDash: dash });
  }
  saveOrOverwrite(gotodash) {
    this.setState({ alert: null });
    this.props.actions.removeSaveModalAlert();
    const sliceParams = {};

    let sliceName = null;
    sliceParams.action = this.state.action;
    if (this.props.slice && this.props.slice.slice_id) {
      sliceParams.slice_id = this.props.slice.slice_id;
    }
    if (sliceParams.action === 'saveas') {
      sliceName = this.state.newSliceName;
      if (sliceName === '') {
        this.setState({ alert: t('Please enter a chart name') });
        return;
      }
      sliceParams.slice_name = sliceName;
    } else {
      sliceParams.slice_name = this.props.slice.slice_name;
    }

    const addToDash = this.state.addToDash;
    sliceParams.add_to_dash = addToDash;
    let dashboard = null;
    switch (addToDash) {
      case 'existing':
        dashboard = this.state.saveToDashboardId;
        if (!dashboard) {
          this.setState({ alert: t('Please select a dashboard') });
          return;
        }
        sliceParams.save_to_dashboard_id = dashboard;
        break;
      case 'new':
        dashboard = this.state.newDashboardName;
        if (dashboard === '') {
          this.setState({ alert: t('Please enter a dashboard name') });
          return;
        }
        sliceParams.new_dashboard_name = dashboard;
        break;
      default:
        dashboard = null;
    }
    sliceParams.goto_dash = gotodash;

    this.props.actions
      .saveSlice(this.props.form_data, sliceParams)
      .then(({ data }) => {
        if (data.dashboard_id === null) {
          sessionStorage.removeItem('save_chart_recent_dashboard');
        } else {
          sessionStorage.setItem(
            'save_chart_recent_dashboard',
            data.dashboard_id,
          );
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
      <Modal show onHide={this.props.onHide} bsStyle="large">
        <Modal.Header closeButton>
          <Modal.Title>{t('Save A Chart')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {(this.state.alert || this.props.alert) && (
            <Alert>
              {this.state.alert ? this.state.alert : this.props.alert}
              <i
                className="fa fa-close pull-right"
                onClick={this.removeAlert.bind(this)}
                style={{ cursor: 'pointer' }}
              />
            </Alert>
          )}
          {this.props.slice && (
            <Radio
              id="overwrite-radio"
              disabled={!this.props.can_overwrite}
              checked={this.state.action === 'overwrite'}
              onChange={this.changeAction.bind(this, 'overwrite')}
            >
              {t('Overwrite chart %s', this.props.slice.slice_name)}
            </Radio>
          )}

          <Radio
            id="saveas-radio"
            inline
            checked={this.state.action === 'saveas'}
            onChange={this.changeAction.bind(this, 'saveas')}
          >
            {' '}
            {t('Save as')} &nbsp;
          </Radio>
          <input
            name="new_slice_name"
            placeholder={t('[chart name]')}
            onChange={this.onChange.bind(this, 'newSliceName')}
            onFocus={this.changeAction.bind(this, 'saveas')}
          />

          <br />
          <hr />

          <Radio
            checked={this.state.addToDash === 'noSave'}
            onChange={this.changeDash.bind(this, 'noSave')}
          >
            {t('Do not add to a dashboard')}
          </Radio>

          <Radio
            inline
            disabled={canNotSaveToDash}
            checked={this.state.addToDash === 'existing'}
            onChange={this.changeDash.bind(this, 'existing')}
            data-test="add-to-existing-dashboard"
          >
            {t('Add chart to existing dashboard')}
          </Radio>
          <Select
            className="save-modal-selector"
            disabled={canNotSaveToDash}
            options={this.props.dashboards}
            onChange={this.onChange.bind(this, 'saveToDashboardId')}
            autoSize={false}
            value={this.state.saveToDashboardId}
            placeholder="Select Dashboard"
          />

          <Radio
            inline
            checked={this.state.addToDash === 'new'}
            onChange={this.changeDash.bind(this, 'new')}
            disabled={canNotSaveToDash}
            data-test="add-to-new-dashboard"
          >
            {t('Add to new dashboard')} &nbsp;
          </Radio>
          <input
            onChange={this.onChange.bind(this, 'newDashboardName')}
            disabled={canNotSaveToDash}
            onFocus={this.changeDash.bind(this, 'new')}
            placeholder={t('[dashboard name]')}
          />
        </Modal.Body>

        <Modal.Footer>
          <Button
            type="button"
            id="btn_modal_save"
            className="btn pull-left"
            onClick={this.saveOrOverwrite.bind(this, false)}
          >
            {t('Save')}
          </Button>
          <Button
            type="button"
            id="btn_modal_save_goto_dash"
            className="btn btn-primary pull-left gotodash"
            disabled={this.state.addToDash === 'noSave' || canNotSaveToDash}
            onClick={this.saveOrOverwrite.bind(this, true)}
          >
            {t('Save & go to dashboard')}
          </Button>
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
