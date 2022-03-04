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
import { Input } from 'src/components/Input';
import { Form, FormItem } from 'src/components/Form';
import Alert from 'src/components/Alert';
import { JsonObject, t, styled } from '@superset-ui/core';
import ReactMarkdown from 'react-markdown';
import Modal from 'src/components/Modal';
import { Radio } from 'src/components/Radio';
import Button from 'src/components/Button';
import { Select } from 'src/components';
import { SelectValue } from 'antd/lib/select';
import { connect } from 'react-redux';

// Session storage key for recent dashboard
const SK_DASHBOARD_ID = 'save_chart_recent_dashboard';
const SELECT_PLACEHOLDER = t('**Select** a dashboard OR **create** a new one');

type SaveModalProps = {
  onHide: () => void;
  actions: Record<string, any>;
  form_data?: Record<string, any>;
  userId: number;
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
      action: this.canOverwriteSlice() ? 'overwrite' : 'saveas',
    };
    this.onDashboardSelectChange = this.onDashboardSelectChange.bind(this);
    this.onSliceNameChange = this.onSliceNameChange.bind(this);
    this.changeAction = this.changeAction.bind(this);
    this.saveOrOverwrite = this.saveOrOverwrite.bind(this);
  }

  canOverwriteSlice(): boolean {
    return this.props.slice?.owners?.includes(this.props.userId);
  }

  componentDidMount() {
    this.props.actions.fetchDashboards(this.props.userId).then(() => {
      const dashboardIds = this.props.dashboards.map(
        dashboard => dashboard.value,
      );
      const lastDashboard = sessionStorage.getItem(SK_DASHBOARD_ID);
      let recentDashboard = lastDashboard && parseInt(lastDashboard, 10);

      if (this.props.dashboardId) {
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

  onSliceNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ newSliceName: event.target.value });
  }

  onDashboardSelectChange(selected: SelectValue) {
    const newDashboardName = selected ? String(selected) : undefined;
    const saveToDashboardId =
      selected && typeof selected === 'number' ? selected : null;
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
    const { url_params, ...formData } = this.props.form_data || {};

    this.props.actions
      .saveSlice(formData, sliceParams)
      .then((data: JsonObject) => {
        if (data.dashboard_id === null) {
          sessionStorage.removeItem(SK_DASHBOARD_ID);
        } else {
          sessionStorage.setItem(SK_DASHBOARD_ID, data.dashboard_id);
        }
        // Go to new slice url or dashboard url
        let url = gotodash ? data.dashboard_url : data.slice.slice_url;
        if (url_params) {
          const prefix = url.includes('?') ? '&' : '?';
          url = `${url}${prefix}${new URLSearchParams(url_params).toString()}`;
        }
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
    return (
      <StyledModal
        show
        onHide={this.props.onHide}
        title={t('Save chart')}
        footer={
          <div data-test="save-modal-footer">
            <Button
              id="btn_cancel"
              buttonSize="small"
              onClick={this.props.onHide}
            >
              {t('Cancel')}
            </Button>
            <Button
              id="btn_modal_save_goto_dash"
              buttonSize="small"
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
              buttonSize="small"
              buttonStyle="primary"
              onClick={() => this.saveOrOverwrite(false)}
              disabled={!this.state.newSliceName}
              data-test="btn-modal-save"
            >
              {!this.canOverwriteSlice() && this.props.slice
                ? t('Save as new chart')
                : t('Save')}
            </Button>
          </div>
        }
      >
        <Form data-test="save-modal-body" layout="vertical">
          {(this.state.alert || this.props.alert) && (
            <Alert
              type="warning"
              message={
                <>
                  {this.state.alert ? this.state.alert : this.props.alert}
                  <i
                    role="button"
                    aria-label="Remove alert"
                    tabIndex={0}
                    className="fa fa-close pull-right"
                    onClick={this.removeAlert.bind(this)}
                    style={{ cursor: 'pointer' }}
                  />
                </>
              }
            />
          )}
          <FormItem data-test="radio-group">
            <Radio
              id="overwrite-radio"
              disabled={!this.canOverwriteSlice()}
              checked={this.state.action === 'overwrite'}
              onChange={() => this.changeAction('overwrite')}
              data-test="save-overwrite-radio"
            >
              {t('Save (Overwrite)')}
            </Radio>
            <Radio
              id="saveas-radio"
              data-test="saveas-radio"
              checked={this.state.action === 'saveas'}
              onChange={() => this.changeAction('saveas')}
            >
              {' '}
              {t('Save as ...')} &nbsp;
            </Radio>
          </FormItem>
          <hr />
          <FormItem label={t('Chart name')} required>
            <Input
              name="new_slice_name"
              type="text"
              placeholder="Name"
              value={this.state.newSliceName}
              onChange={this.onSliceNameChange}
              data-test="new-chart-name"
            />
          </FormItem>
          <FormItem
            label={t('Add to dashboard')}
            data-test="save-chart-modal-select-dashboard-form"
          >
            <Select
              allowClear
              allowNewOptions
              ariaLabel={t('Select a dashboard')}
              options={this.props.dashboards}
              onChange={this.onDashboardSelectChange}
              value={dashboardSelectValue || undefined}
              placeholder={
                // Using markdown to allow for good i18n
                <ReactMarkdown
                  source={SELECT_PLACEHOLDER}
                  renderers={{ paragraph: 'span' }}
                />
              }
            />
          </FormItem>
        </Form>
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
    userId: explore.user?.userId,
    dashboards: saveModal.dashboards,
    alert: saveModal.saveModalAlert,
  };
}

export default connect(mapStateToProps, () => ({}))(SaveModal);
