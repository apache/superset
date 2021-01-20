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
import { Alert, FormControl, FormGroup, Radio } from 'react-bootstrap';
import { JsonObject, t, styled } from '@superset-ui/core';
import ReactMarkdown from 'react-markdown';
import Modal from 'src/common/components/Modal';
import Button from 'src/components/Button';
import FormLabel from 'src/components/FormLabel';
import { CreatableSelect } from 'src/components/Select/SupersetStyledSelect';
import { connect } from 'react-redux';

// Session storage key for recent dashboard
const SK_DASHBOARD_ID = 'save_chart_recent_dashboard';
const SELECT_PLACEHOLDER = t('**Select** a dashboard OR **create** a new one');

type SaveModalProps = {
  can_overwrite?: boolean;
  onHide: () => void;
  actions: Record<string, any>;
  form_data?: Record<string, any>;
  userId: string;
  dashboards: Array<any>;
  alert?: string;
  sliceName?: string;
  slice?: Record<string, any>;
  datasource?: Record<string, any>;
  dashboardId: '' | number | null;
};

type ActionType = 'overwrite' | 'saveas';

type SaveModalState = {
  saveToDashboardId: number | string | null;
  newSliceName?: string;
  newDashboardName?: string;
  alert: string | null;
  action: ActionType;
};

export const StyledModal = styled(Modal)`
  .ant-modal-body {
    overflow: visible;
  }
`;

class SaveModal extends React.Component<SaveModalProps, SaveModalState> {
  constructor(props: SaveModalProps) {
    super(props);
    this.state = {
      saveToDashboardId: null,
      newSliceName: props.sliceName,
      alert: null,
      action: props.can_overwrite ? 'overwrite' : 'saveas',
    };
    this.onDashboardSelectChange = this.onDashboardSelectChange.bind(this);
    this.onSliceNameChange = this.onSliceNameChange.bind(this);
    this.changeAction = this.changeAction.bind(this);
    this.saveOrOverwrite = this.saveOrOverwrite.bind(this);
  }

  componentDidMount() {
    this.props.actions.fetchDashboards(this.props.userId).then(() => {
      const dashboardIds = this.props.dashboards.map(
        dashboard => dashboard.value,
      );
      const lastDashboard = sessionStorage.getItem(SK_DASHBOARD_ID);
      let recentDashboard = lastDashboard && parseInt(lastDashboard, 10);

      if (!recentDashboard && this.props.dashboardId) {
        recentDashboard = this.props.dashboardId;
      }

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

  onSliceNameChange(
    event: React.FormEvent<FormControl> & { target: HTMLInputElement },
  ) {
    this.setState({ newSliceName: event.target.value });
  }

  onDashboardSelectChange(event: Record<string, any>) {
    const newDashboardName = event ? event.label : null;
    const saveToDashboardId =
      event && typeof event.value === 'number' ? event.value : null;
    this.setState({ saveToDashboardId, newDashboardName });
  }

  changeAction(action: ActionType) {
    this.setState({ action });
  }

  saveOrOverwrite(gotodash: boolean) {
    this.setState({ alert: null });
    this.props.actions.removeSaveModalAlert();
    const sliceParams: Record<string, any> = {};

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
      .then((data: JsonObject) => {
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
    const dashboardSelectValue =
      this.state.saveToDashboardId || this.state.newDashboardName;
    const valueObj = dashboardSelectValue
      ? { value: dashboardSelectValue }
      : null;
    return (
      <StyledModal
        show
        onHide={this.props.onHide}
        title={t('Save Chart')}
        footer={
          <div data-test="save-modal-footer">
            <Button id="btn_cancel" buttonSize="sm" onClick={this.props.onHide}>
              {t('Cancel')}
            </Button>
            <Button
              id="btn_modal_save_goto_dash"
              buttonSize="sm"
              disabled={
                !this.state.newSliceName ||
                (!this.state.saveToDashboardId && !this.state.newDashboardName)
              }
              onClick={() => this.saveOrOverwrite(true)}
            >
              {t('Save & go to dashboard')}
            </Button>
            <Button
              id="btn_modal_save"
              buttonSize="sm"
              buttonStyle="primary"
              onClick={() => this.saveOrOverwrite(false)}
              disabled={!this.state.newSliceName}
              data-test="btn-modal-save"
            >
              {!this.props.can_overwrite && this.props.slice
                ? t('Save as new chart')
                : t('Save')}
            </Button>
          </div>
        }
      >
        <div data-test="save-modal-body">
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
          <FormGroup data-test="radio-group">
            <Radio
              id="overwrite-radio"
              inline
              disabled={!(this.props.can_overwrite && this.props.slice)}
              checked={this.state.action === 'overwrite'}
              onChange={() => this.changeAction('overwrite')}
              data-test="save-overwrite-radio"
            >
              {t('Save (Overwrite)')}
            </Radio>
            <Radio
              id="saveas-radio"
              data-test="saveas-radio"
              inline
              checked={this.state.action === 'saveas'}
              onChange={() => this.changeAction('saveas')}
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
              data-test="new-chart-name"
            />
          </FormGroup>
          <FormGroup data-test="save-chart-modal-select-dashboard-form">
            <FormLabel>{t('Add to dashboard')}</FormLabel>
            <CreatableSelect
              id="dashboard-creatable-select"
              className="save-modal-selector"
              menuPosition="fixed"
              options={this.props.dashboards}
              clearable
              creatable
              onChange={this.onDashboardSelectChange}
              autoSize={false}
              value={valueObj}
              placeholder={
                // Using markdown to allow for good i18n
                <ReactMarkdown
                  source={SELECT_PLACEHOLDER}
                  renderers={{ paragraph: 'span' }}
                />
              }
            />
          </FormGroup>
        </div>
      </StyledModal>
    );
  }
}

function mapStateToProps({
  explore,
  saveModal,
}: Record<string, any>): Partial<SaveModalProps> {
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
