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
import React, { ReactNode } from 'react';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { InfoTooltipWithTrigger } from '@superset-ui/chart-controls';
import {
  css,
  t,
  styled,
  DatasourceType,
  SupersetTheme,
  withTheme,
} from '@superset-ui/core';
import { Input } from 'src/components/Input';
import { Form, FormItem } from 'src/components/Form';
import Alert from 'src/components/Alert';
import Modal from 'src/components/Modal';
import { Radio } from 'src/components/Radio';
import Button from 'src/components/Button';
import { Select } from 'src/components';
import Loading from 'src/components/Loading';
import { ExplorePageState, SaveActionType } from 'src/explore/types';
import { Tag } from 'src/components/Select/CustomTag';
import Icons from 'src/components/Icons';
import { CustomTagProps, SelectOptionsType } from 'src/components/Select/types';
import { Tooltip } from 'src/components/Tooltip';

interface SaveModalProps extends RouteComponentProps {
  addDangerToast: (msg: string) => void;
  actions: Record<string, any>;
  form_data?: Record<string, any>;
  userId: number;
  dashboards: Array<any>;
  alert?: ReactNode;
  sliceName?: string;
  slice?: Record<string, any>;
  datasource?: Record<string, any>;
  dashboardId: '' | number | null;
  isVisible: boolean;
  dashboardsAddedTo: { id: number; dashboard_title: string }[];
  dispatch: Dispatch;
  theme: SupersetTheme;
  onClose: () => void;
}

type SaveModalState = {
  saveToDashboardIds: (number | string)[] | null;
  navigateToDashboardId?: number;
  newSliceName?: string;
  newDashboardName?: string;
  datasetName: string;
  alert: ReactNode | null;
  action: SaveActionType;
  isLoading: boolean;
  saveStatus?: string | null;
  isNavigationModalVisible: boolean;
  dashboardOptions: SelectOptionsType;
};

export const StyledModal = styled(Modal)`
  .ant-modal-body {
    overflow: visible;
  }
  i {
    position: absolute;
    top: -${({ theme }) => theme.gridUnit * 5.25}px;
    left: ${({ theme }) => theme.gridUnit * 26.75}px;
  }
`;

const deselectionNotAllowedTooltipText = t(
  'You cannot deselect this dashboard, because you are not the owner.',
);

const newDashboardTooltipText = t(
  'This is a new dashboard that will be created after you save the chart.',
);

class SaveModal extends React.Component<SaveModalProps, SaveModalState> {
  dashboardRemovedAlertShowed = false;

  constructor(props: SaveModalProps) {
    super(props);
    this.state = {
      saveToDashboardIds: this.canOverwriteSlice()
        ? props.dashboardsAddedTo.map(dashboard => dashboard.id)
        : [],
      navigateToDashboardId: undefined,
      newSliceName: props.sliceName,
      datasetName: props.datasource?.name,
      alert: null,
      action: this.canOverwriteSlice() ? 'overwrite' : 'saveas',
      isLoading: false,
      isNavigationModalVisible: false,
      dashboardOptions: [],
    };
    this.onDashboardSaveSelectChange =
      this.onDashboardSaveSelectChange.bind(this);
    this.onDashboardNavigationSelectChange =
      this.onDashboardNavigationSelectChange.bind(this);
    this.onSliceNameChange = this.onSliceNameChange.bind(this);
    this.changeAction = this.changeAction.bind(this);
    this.saveOrOverwrite = this.saveOrOverwrite.bind(this);
    this.isNewDashboard = this.isNewDashboard.bind(this);
    this.removeAlert = this.removeAlert.bind(this);
    this.handleNavigation = this.handleNavigation.bind(this);
    this.onHideSaveModal = this.onHideSaveModal.bind(this);
    this.onHideNavigationModal = this.onHideNavigationModal.bind(this);
    this.getNavigationModalProps = this.getNavigationModalProps.bind(this);
    this.getSaveModalProps = this.getSaveModalProps.bind(this);
    this.tagRenderer = this.tagRenderer.bind(this);
  }

  isNewDashboard(): boolean {
    return !!(!this.state.saveToDashboardIds && this.state.newDashboardName);
  }

  canOverwriteSlice(): boolean {
    return (
      this.props.slice?.owners?.includes(this.props.userId) &&
      !this.props.slice?.is_managed_externally
    );
  }

  componentDidMount() {
    this.props.actions.fetchDashboards(this.props.userId).then(() => {
      const dashboardOptions = [
        ...this.props.dashboardsAddedTo
          .filter(
            dashboardAddedTo =>
              !this.props.dashboards.some(
                dashboard => dashboard.value === dashboardAddedTo.id,
              ),
          )
          .map(dashboard => ({
            label: dashboard.dashboard_title,
            value: dashboard.id,
            customLabel: (
              <Tooltip title={deselectionNotAllowedTooltipText}>
                {dashboard.dashboard_title}
              </Tooltip>
            ),
            disabled: true,
          })),
        ...this.props.dashboards,
      ];
      this.setState({ dashboardOptions });
    });
  }

  handleDatasetNameChange = (e: React.FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    this.setState({ datasetName: e.target.value });
  };

  onSliceNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    this.setState({ newSliceName: event.target.value });
  }

  onDashboardSaveSelectChange(selected: (string | number)[]) {
    this.setState({ saveToDashboardIds: selected });
    if (
      this.props.dashboardsAddedTo.some(
        dashboard => !selected.includes(dashboard.id),
      ) &&
      !this.dashboardRemovedAlertShowed
    ) {
      this.setState({
        alert: (
          <div
            css={css`
              p {
                margin-bottom: ${this.props.theme.gridUnit}px;
                line-height: 1.4;
              }
            `}
          >
            <p
              css={css`
                font-weight: ${this.props.theme.typography.weights.bold};
              `}
            >
              {t('You removed dashboards this chart is already added to')}
            </p>
            <p>
              {t(
                'When you save the selection, chart will be removed from those dashboards.',
              )}
            </p>
          </div>
        ),
      });
      this.dashboardRemovedAlertShowed = true;
    }
  }

  onDashboardNavigationSelectChange(selected: number) {
    this.setState({ navigateToDashboardId: selected });
  }

  changeAction(action: SaveActionType) {
    this.setState({ action });
  }

  onHideSaveModal() {
    this.props.onClose();
  }

  onHideNavigationModal() {
    this.setState({ isNavigationModalVisible: false });
    this.props.onClose();
  }

  tagRenderer(customTagProps: CustomTagProps) {
    const onPreventMouseDown = (event: React.MouseEvent<HTMLElement>) => {
      // if close icon is clicked, stop propagation to avoid opening the dropdown
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'svg' ||
        target.tagName === 'path' ||
        (target.tagName === 'span' &&
          target.className.includes('ant-tag-close-icon'))
      ) {
        event.stopPropagation();
      }
    };

    let closable = true;
    let { label } = customTagProps;

    if (
      typeof customTagProps.value === 'number' &&
      !this.props.dashboards.some(
        dashboard => dashboard.value === customTagProps.value,
      )
    ) {
      closable = false;
      label = (
        <Tooltip title={deselectionNotAllowedTooltipText}>
          {this.props.dashboardsAddedTo.find(
            dashboard => dashboard.id === customTagProps.value,
          )?.dashboard_title ?? customTagProps.label}
        </Tooltip>
      );
    }

    if (typeof customTagProps.value === 'string') {
      label = (
        <Tooltip title={newDashboardTooltipText}>
          <Icons.AppstoreAddOutlined
            iconSize="xs"
            iconColor={this.props.theme.colors.grayscale.base}
            css={css`
              margin-right: ${this.props.theme.gridUnit}px;
              vertical-align: middle;
              & > * {
                line-height: 0;
              }
            `}
          />
          {customTagProps.label}
        </Tooltip>
      );
    }

    return (
      <Tag
        {...customTagProps}
        onMouseDown={onPreventMouseDown}
        closable={closable}
      >
        {label}
      </Tag>
    );
  }

  async saveOrOverwrite(gotodash: boolean) {
    this.setState({ alert: null, isLoading: true });
    this.props.actions.removeSaveModalAlert();

    try {
      if (this.props.datasource?.type === DatasourceType.Query) {
        const { schema, sql, database } = this.props.datasource;
        const { templateParams } = this.props.datasource;
        const columns = this.props.datasource?.columns || [];

        await this.props.actions.saveDataset({
          schema,
          sql,
          database,
          templateParams,
          datasourceName: this.state.datasetName,
          columns,
        });
      }

      //  Get chart dashboards
      let sliceDashboards: number[] = [];
      if (this.props.slice && this.state.action === 'overwrite') {
        sliceDashboards = await this.props.actions.getSliceDashboards(
          this.props.slice,
        );
      }

      // let dashboard: DashboardGetResponse | null = null;
      if (this.state.saveToDashboardIds) {
        const newDashboardNames = this.state.saveToDashboardIds.filter(
          id => typeof id === 'string',
        );
        const newDashboardIds = (
          await Promise.all(
            newDashboardNames.map(id => this.props.actions.createDashboard(id)),
          )
        ).map(response => response.id);
        sliceDashboards = this.state.saveToDashboardIds.map(id => {
          if (typeof id === 'number') {
            return id;
          }
          return newDashboardIds[newDashboardNames.indexOf(id)];
        });
        const { url_params, ...formData } = this.props.form_data || {};

        this.props.actions.setFormData({
          ...formData,
          dashboards: sliceDashboards,
        });
      }

      //  Update or create slice
      let value: { id: number };
      if (this.state.action === 'overwrite') {
        value = await this.props.actions.updateSlice(
          this.props.slice,
          this.state.newSliceName,
          sliceDashboards,
          null,
        );
      } else {
        value = await this.props.actions.createSlice(
          this.state.newSliceName,
          sliceDashboards,
          null,
        );
      }

      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set('save_action', this.state.action);
      searchParams.delete('form_data_key');
      if (this.state.action === 'saveas') {
        searchParams.set('slice_id', value.id.toString());
      }
      this.props.history.replace(`/explore/?${searchParams.toString()}`);

      this.setState({ saveToDashboardIds: sliceDashboards, isLoading: false });
      if (gotodash) {
        this.setState({ isNavigationModalVisible: true });
      } else {
        this.onHideSaveModal();
      }
    } finally {
      this.setState({ isLoading: false });
    }
  }

  renderSaveChartModal = () => (
    <Form data-test="save-modal-body" layout="vertical">
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
          {t('Save as...')}
        </Radio>
      </FormItem>
      {(this.state.alert || this.props.alert) && (
        <Alert
          type="warning"
          message={this.state.alert || this.props.alert}
          onClose={this.removeAlert}
          roomBelow
        />
      )}
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
      {this.props.datasource?.type === 'query' && (
        <FormItem label={t('Dataset Name')} required>
          <InfoTooltipWithTrigger
            tooltip={t('A reusable dataset will be saved with your chart.')}
            placement="right"
          />
          <Input
            name="dataset_name"
            type="text"
            placeholder="Dataset Name"
            value={this.state.datasetName}
            onChange={this.handleDatasetNameChange}
            data-test="new-dataset-name"
          />
        </FormItem>
      )}
      <FormItem
        label={t('Added to dashboards')}
        tooltip={
          <div
            css={css`
              font-size: ${this.props.theme.typography.sizes.s}px;
            `}
          >
            <div>
              <span>
                {t('You can add your chart to multiple dashboards at once.')}
              </span>
              {this.state.action === 'overwrite' && (
                <span>
                  {t(
                    'If there are already some dashboards visible it means that this chart is already added to them.',
                  )}
                </span>
              )}
            </div>
            <div
              css={css`
                margin-top: ${this.props.theme.gridUnit * 2}px;
              `}
            >
              {t(
                'You can create a new dashboard by typing the name and hitting enter.',
              )}
            </div>
          </div>
        }
        data-test="save-chart-modal-select-dashboard-form"
      >
        <Select
          allowClear
          allowNewOptions
          mode="multiple"
          ariaLabel={t('Select a dashboard')}
          options={this.state.dashboardOptions}
          onChange={this.onDashboardSaveSelectChange}
          value={this.state.saveToDashboardIds || undefined}
          placeholder={
            <div>
              <b>{t('Select')}</b>
              {t(' a dashboard OR ')}
              <b>{t('create')}</b>
              {t(' a new one')}
            </div>
          }
          tagRender={this.tagRenderer}
          helperText={
            <div>
              {t('Select dashboard or create a')}{' '}
              <strong>{t('new dashboard')}</strong>{' '}
              {t('by typing name and clicking enter')}
            </div>
          }
        />
      </FormItem>
    </Form>
  );

  renderFooter = () => (
    <div data-test="save-modal-footer">
      <Button id="btn_cancel" buttonSize="small" onClick={this.onHideSaveModal}>
        {t('Cancel')}
      </Button>
      <Button
        id="btn_modal_save_goto_dash"
        buttonSize="small"
        disabled={
          !this.state.newSliceName ||
          (!this.state.saveToDashboardIds && !this.state.newDashboardName) ||
          (this.props.datasource?.type !== DatasourceType.Table &&
            !this.state.datasetName)
        }
        onClick={() => this.saveOrOverwrite(true)}
      >
        {this.isNewDashboard()
          ? t('Save & go to new dashboard')
          : t('Save & go to dashboard')}
      </Button>
      <Button
        id="btn_modal_save"
        buttonSize="small"
        buttonStyle="primary"
        onClick={() => this.saveOrOverwrite(false)}
        disabled={
          this.state.isLoading ||
          !this.state.newSliceName ||
          (this.props.datasource?.type !== DatasourceType.Table &&
            !this.state.datasetName)
        }
        data-test="btn-modal-save"
      >
        {!this.canOverwriteSlice() && this.props.slice
          ? t('Save as new chart')
          : this.isNewDashboard()
          ? t('Save to new dashboard')
          : t('Save')}
      </Button>
    </div>
  );

  removeAlert() {
    if (this.props.alert) {
      this.props.actions.removeSaveModalAlert();
    }
    this.setState({ alert: null });
  }

  async handleNavigation() {
    const response = await this.props.actions.getDashboard(
      this.state.navigateToDashboardId,
    );
    const dashboard = response.result;
    this.setState({ isNavigationModalVisible: false });
    this.props.history.push(dashboard.url);
  }

  getSaveModalProps() {
    return {
      show: this.props.isVisible,
      onHide: this.onHideSaveModal,
      title: t('Save chart'),
      footer: this.renderFooter(),
      children: this.state.isLoading ? (
        <div
          css={css`
            display: flex;
            justify-content: center;
          `}
        >
          <Loading position="normal" />
        </div>
      ) : (
        this.renderSaveChartModal()
      ),
    };
  }

  getNavigationModalProps() {
    return {
      show: this.state.isNavigationModalVisible,
      primaryButtonName: t('Go'),
      disablePrimaryButton: !this.state.navigateToDashboardId,
      onHandledPrimaryAction: this.handleNavigation,
      onHide: this.onHideNavigationModal,
      title: t('You added your chart to multiple dashboards'),
      children: (
        <Form data-test="navigation-modal-body" layout="vertical">
          <FormItem label={t('Select a dashboard you want to open')}>
            <Select
              allowClear
              ariaLabel={t('Select a dashboard')}
              options={this.props.dashboardsAddedTo.map(dashboard => ({
                value: dashboard.id,
                label: dashboard.dashboard_title,
              }))}
              onChange={this.onDashboardNavigationSelectChange}
              value={this.state.navigateToDashboardId}
              placeholder={t('Select a dashboard')}
            />
          </FormItem>
        </Form>
      ),
    };
  }

  render() {
    return (
      <StyledModal
        {...(this.state.isNavigationModalVisible
          ? this.getNavigationModalProps()
          : this.getSaveModalProps())}
      />
    );
  }
}

interface StateProps {
  datasource: any;
  slice: any;
  userId: any;
  dashboards: any;
  dashboardsAddedTo: { id: number; dashboard_title: string }[];
  alert: any;
}

function mapStateToProps({
  explore,
  saveModal,
  user,
}: ExplorePageState): StateProps {
  return {
    datasource: explore.datasource,
    slice: explore.slice,
    userId: user?.userId,
    dashboards: saveModal.dashboards,
    dashboardsAddedTo: explore.metadata?.dashboards,
    alert: saveModal.saveModalAlert,
  };
}

export default withRouter(withTheme(connect(mapStateToProps)(SaveModal)));
