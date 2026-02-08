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
import { ChangeEvent, FormEvent, Component } from 'react';
import { Dispatch } from 'redux';
import { nanoid } from 'nanoid';
import rison from 'rison';
import { connect } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import {
  InfoTooltip,
  Button,
  AsyncSelect,
  Form,
  FormItem,
  Modal,
  Input,
  Loading,
  Divider,
  TreeSelect,
} from '@superset-ui/core/components';
import { t, logging } from '@apache-superset/core';
import { DatasourceType, isDefined, SupersetClient } from '@superset-ui/core';
import { css, styled, Alert } from '@apache-superset/core/ui';
import { Radio } from '@superset-ui/core/components/Radio';
import { GRID_COLUMN_COUNT } from 'src/dashboard/util/constants';
import { canUserEditDashboard } from 'src/dashboard/util/permissionUtils';
import { setSaveChartModalVisibility } from 'src/explore/actions/saveModalActions';
import { SaveActionType, ChartStatusType } from 'src/explore/types';
import { UserWithPermissionsAndRoles } from 'src/types/bootstrapTypes';
import {
  removeChartState,
  updateChartState,
} from 'src/dashboard/actions/dashboardState';
import { Dashboard } from 'src/types/Dashboard';
import { TabNode, TabTreeNode } from '../types';
import { CHART_WIDTH, CHART_HEIGHT } from 'src/dashboard/constants';

// Session storage key for recent dashboard
const SK_DASHBOARD_ID = 'save_chart_recent_dashboard';

interface SaveModalProps extends RouteComponentProps {
  addDangerToast: (msg: string) => void;
  actions: Record<string, any>;
  form_data?: Record<string, any>;
  user: UserWithPermissionsAndRoles;
  alert?: string;
  sliceName?: string;
  slice?: Record<string, any>;
  datasource?: Record<string, any>;
  dashboardId: '' | number | null;
  isVisible: boolean;
  dispatch: Dispatch;
}

type SaveModalState = {
  newSliceName?: string;
  datasetName: string;
  action: SaveActionType;
  isLoading: boolean;
  saveStatus?: string | null;
  dashboard?: { label: string; value: string | number };
  selectedTab?: { label: string; value: string | number };
  tabsData: TabTreeNode[];
};

export const StyledModal = styled(Modal)`
  .ant-modal-body {
    overflow: visible;
  }
  i {
    position: absolute;
    top: -${({ theme }) => theme.sizeUnit * 5.25}px;
    left: ${({ theme }) => theme.sizeUnit * 26.75}px;
  }
`;

class SaveModal extends Component<SaveModalProps, SaveModalState> {
  constructor(props: SaveModalProps) {
    super(props);
    this.state = {
      newSliceName: props.sliceName,
      datasetName: props.datasource?.name,
      action: this.canOverwriteSlice()
        ? ChartStatusType.overwrite
        : ChartStatusType.saveas,
      isLoading: false,
      dashboard: undefined,
      tabsData: [],
      selectedTab: undefined,
    };
    this.onDashboardChange = this.onDashboardChange.bind(this);
    this.onSliceNameChange = this.onSliceNameChange.bind(this);
    this.changeAction = this.changeAction.bind(this);
    this.saveOrOverwrite = this.saveOrOverwrite.bind(this);
    this.isNewDashboard = this.isNewDashboard.bind(this);
    this.onHide = this.onHide.bind(this);
  }

  isNewDashboard(): boolean {
    const { dashboard } = this.state;
    return typeof dashboard?.value === 'string';
  }

  canOverwriteSlice(): boolean {
    return (
      this.props.slice?.owners?.includes(this.props.user.userId) &&
      !this.props.slice?.is_managed_externally
    );
  }

  async componentDidMount() {
    let { dashboardId } = this.props;
    if (!dashboardId) {
      let lastDashboard = null;
      try {
        lastDashboard = sessionStorage.getItem(SK_DASHBOARD_ID);
      } catch (error) {
        // continue regardless of error
      }
      dashboardId = lastDashboard && parseInt(lastDashboard, 10);
    }
    if (dashboardId) {
      try {
        const result = (await this.loadDashboard(dashboardId)) as Dashboard;
        if (canUserEditDashboard(result, this.props.user)) {
          this.setState({
            dashboard: { label: result.dashboard_title, value: result.id },
          });
          await this.loadTabs(dashboardId);
        }
      } catch (error) {
        logging.warn(error);
        this.props.addDangerToast(
          t('An error occurred while loading dashboard information.'),
        );
      }
    }
  }

  handleDatasetNameChange = (e: FormEvent<HTMLInputElement>) => {
    // @ts-expect-error
    this.setState({ datasetName: e.target.value });
  };

  onSliceNameChange(event: ChangeEvent<HTMLInputElement>) {
    this.setState({ newSliceName: event.target.value });
  }

  onDashboardChange = async (dashboard: {
    label: string;
    value: string | number;
  }) => {
    this.setState({
      dashboard,
      tabsData: [],
      selectedTab: undefined,
    });

    if (typeof dashboard.value === 'number') {
      await this.loadTabs(dashboard.value);
    }
  };
  changeAction(action: SaveActionType) {
    this.setState({ action });
  }

  onHide() {
    this.props.dispatch(setSaveChartModalVisibility(false));
  }

  handleRedirect = (windowLocationSearch: string, chart: any) => {
    const searchParams = new URLSearchParams(windowLocationSearch);
    searchParams.set('save_action', this.state.action);

    searchParams.delete('form_data_key');

    searchParams.set('slice_id', chart.id.toString());
    return searchParams;
  };

  async saveOrOverwrite(gotodash: boolean) {
    this.setState({ isLoading: true });
    const tableState = this.props.form_data?.table_state;
    const sliceId = this.props.slice?.slice_id;
    const vizType = this.props.form_data?.viz_type;
    if (sliceId && vizType && tableState) {
      this.props.dispatch(updateChartState(sliceId, vizType, tableState));
    }

    //  Create or retrieve dashboard
    type DashboardGetResponse = {
      id: number;
      url: string;
      dashboard_title: string;
    };

    try {
      if (this.props.datasource?.type === DatasourceType.Query) {
        const { schema, sql, database } = this.props.datasource;
        const { templateParams } = this.props.datasource;

        await this.props.actions.saveDataset({
          schema,
          sql,
          database,
          templateParams,
          datasourceName: this.state.datasetName,
        });
      }

      //  Get chart dashboards
      let sliceDashboards: number[] = [];
      if (this.props.slice && this.state.action === 'overwrite') {
        sliceDashboards = await this.props.actions.getSliceDashboards(
          this.props.slice,
        );
      }

      const formData = this.props.form_data || {};
      delete formData.url_params;

      let dashboard: DashboardGetResponse | null = null;
      let selectedTabId: string | undefined;
      if (this.state.dashboard) {
        let validId = this.state.dashboard.value;
        if (this.isNewDashboard()) {
          const response = await this.props.actions.createDashboard(
            this.state.dashboard.label,
          );
          validId = response.id;
        }

        try {
          dashboard = await this.loadDashboard(validId as number);
        } catch (error) {
          this.props.actions.saveSliceFailed();
          return;
        }

        if (isDefined(dashboard) && isDefined(dashboard?.id)) {
          sliceDashboards = sliceDashboards.includes(dashboard.id)
            ? sliceDashboards
            : [...sliceDashboards, dashboard.id];
          formData.dashboards = sliceDashboards;
          if (
            this.state.action === ChartStatusType.saveas &&
            this.state.selectedTab?.value !== 'OUT_OF_TAB'
          ) {
            selectedTabId = this.state.selectedTab?.value as string;
          }
        }
      }

      // Sets the form data
      this.props.actions.setFormData({ ...formData });

      //  Update or create slice
      let value: { id: number };
      if (this.state.action === 'overwrite') {
        value = await this.props.actions.updateSlice(
          this.props.slice,
          this.state.newSliceName,
          sliceDashboards,
          dashboard
            ? {
                title: dashboard.dashboard_title,
                new: this.isNewDashboard(),
              }
            : null,
        );
      } else {
        value = await this.props.actions.createSlice(
          this.state.newSliceName,
          sliceDashboards,
          dashboard
            ? {
                title: dashboard.dashboard_title,
                new: this.isNewDashboard(),
              }
            : null,
        );
        if (dashboard && selectedTabId) {
          try {
            await this.addChartToDashboardTab(
              dashboard.id,
              value.id,
              selectedTabId,
              this.state.newSliceName,
            );
          } catch (error) {
            logging.error('Error adding chart to dashboard tab:', error);
            this.props.addDangerToast(
              t('Chart was saved but could not be added to the selected tab.'),
            );
          }
        }
      }

      try {
        if (dashboard) {
          sessionStorage.setItem(SK_DASHBOARD_ID, `${dashboard.id}`);
        } else {
          sessionStorage.removeItem(SK_DASHBOARD_ID);
        }
      } catch (error) {
        // continue regardless of error
      }

      // Go to new dashboard url
      if (gotodash && dashboard) {
        let { url } = dashboard;
        if (this.state.selectedTab?.value) {
          url += `#${this.state.selectedTab.value}`;
        }
        this.props.dispatch(removeChartState(value.id));
        this.props.history.push(url);
        return;
      }
      const searchParams = this.handleRedirect(window.location.search, value);
      this.props.history.replace(`/explore/?${searchParams.toString()}`);

      this.setState({ isLoading: false });
      this.onHide();
    } finally {
      this.setState({ isLoading: false });
    }
  }

  /* Adds a chart to the specified dashboard tab. If an existing row has space, the chart is added there; otherwise, a new row is created.
   * @param {number} dashboardId - ID of the dashboard.
   * @param {number} chartId - ID of the chart to add.
   * @param {string} tabId - ID of the dashboard tab where the chart is added.
   * @param {string | undefined} sliceName - Chart name
   */
  addChartToDashboardTab = async (
    dashboardId: number,
    chartId: number,
    tabId: string,
    sliceName: string | undefined,
  ) => {
    try {
      const dashboardResponse = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboardId}`,
      });

      const dashboard = dashboardResponse.json.result;

      let positionJson = dashboard.position_json;
      if (typeof positionJson === 'string') {
        positionJson = JSON.parse(positionJson);
      }
      positionJson = positionJson || {};

      const chartKey = `CHART-${chartId}`;

      // Find a row in the tab with available space
      const tabChildren = positionJson[tabId]?.children || [];
      let targetRowKey: string | null = null;

      for (const childKey of tabChildren) {
        const child = positionJson[childKey];
        if (child?.type === 'ROW') {
          const rowChildren = child.children || [];
          const totalWidth = rowChildren.reduce((sum: number, key: string) => {
            const component = positionJson[key];
            return sum + (component?.meta?.width || 0);
          }, 0);

          if (totalWidth + CHART_WIDTH <= GRID_COLUMN_COUNT) {
            targetRowKey = childKey;
            break;
          }
        }
      }

      const updatedPositionJson = { ...positionJson };

      // Create a new row if no existing row has space
      if (!targetRowKey) {
        targetRowKey = `ROW-${nanoid()}`;
        updatedPositionJson[targetRowKey] = {
          type: 'ROW',
          id: targetRowKey,
          children: [],
          parents: ['ROOT_ID', 'GRID_ID', tabId],
          meta: {
            background: 'BACKGROUND_TRANSPARENT',
          },
        };

        if (positionJson[tabId]) {
          updatedPositionJson[tabId] = {
            ...positionJson[tabId],
            children: [...(positionJson[tabId].children || []), targetRowKey],
          };
        } else {
          throw new Error(`Tab ${tabId} not found in positionJson`);
        }
      }

      updatedPositionJson[chartKey] = {
        type: 'CHART',
        id: chartKey,
        children: [],
        parents: ['ROOT_ID', 'GRID_ID', tabId, targetRowKey],
        meta: {
          width: CHART_WIDTH,
          height: CHART_HEIGHT,
          chartId,
          sliceName: sliceName ?? `Chart ${chartId}`,
        },
      };

      // Add chart to the target row
      updatedPositionJson[targetRowKey] = {
        ...updatedPositionJson[targetRowKey],
        children: [
          ...(updatedPositionJson[targetRowKey].children || []),
          chartKey,
        ],
      };

      const response = await SupersetClient.put({
        endpoint: `/api/v1/dashboard/${dashboardId}`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          position_json: JSON.stringify(updatedPositionJson),
        }),
      });

      return response;
    } catch (error) {
      throw new Error(`Error adding chart to dashboard tab: ${error}`);
    }
  };

  loadDashboard = async (id: number) => {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/${id}`,
    });
    return response.json.result;
  };

  loadDashboards = async (search: string, page: number, pageSize: number) => {
    const queryParams = rison.encode({
      columns: ['id', 'dashboard_title'],
      filters: [
        {
          col: 'dashboard_title',
          opr: 'ct',
          value: search,
        },
        {
          col: 'owners',
          opr: 'rel_m_m',
          value: this.props.user.userId,
        },
      ],
      page,
      page_size: pageSize,
      order_column: 'dashboard_title',
    });

    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/?q=${queryParams}`,
    });
    const { result, count } = json;
    return {
      data: result.map(
        (dashboard: { id: number; dashboard_title: string }) => ({
          value: dashboard.id,
          label: dashboard.dashboard_title,
        }),
      ),
      totalCount: count,
    };
  };
  // Loads dashboard tabs and returns the tab hierarchy for display.
  loadTabs = async (dashboardId: number) => {
    try {
      const response = await SupersetClient.get({
        endpoint: `/api/v1/dashboard/${dashboardId}/tabs`,
      });

      const { result } = response.json;
      if (!result || !Array.isArray(result.tab_tree)) {
        logging.warn('Invalid tabs response format');
        this.setState({ tabsData: [] });
        return [];
      }
      const tabTree = result.tab_tree;
      const gridTabIds = new Set<string>();
      const convertToTreeData = (nodes: TabNode[]): TabTreeNode[] =>
        nodes.map(node => {
          const isGridTab =
            Array.isArray(node.parents) && node.parents.includes('GRID_ID');
          if (isGridTab) {
            gridTabIds.add(node.value);
          }
          return {
            value: node.value,
            title: node.title,
            key: node.value,
            children:
              node.children && node.children.length > 0
                ? convertToTreeData(node.children)
                : undefined,
          };
        });

      const treeData = convertToTreeData(tabTree);

      // Add "Out of tab" option at the beginning
      if (gridTabIds.size > 0) {
        const tabsDataWithOutOfTab = [
          {
            value: 'OUT_OF_TAB',
            title: 'Out of tab',
            key: 'OUT_OF_TAB',
            children: undefined,
          },
          ...treeData,
        ];

        this.setState({
          tabsData: tabsDataWithOutOfTab,
          selectedTab: { value: 'OUT_OF_TAB', label: 'Out of tab' },
        });
      } else {
        const firstTab = treeData[0];
        this.setState({
          tabsData: treeData,
          selectedTab: { value: firstTab.value, label: firstTab.title },
        });
      }

      return treeData;
    } catch (error) {
      logging.error('Error loading tabs:', error);
      this.setState({ tabsData: [] });
      return [];
    }
  };

  onTabChange = (value: string) => {
    if (value) {
      const findTabInTree = (data: TabTreeNode[]): TabTreeNode | null => {
        for (const item of data) {
          if (item.value === value) {
            return item;
          }
          if (item.children) {
            const found = findTabInTree(item.children);
            if (found) return found;
          }
        }
        return null;
      };

      const selectedTab = findTabInTree(this.state.tabsData);
      if (selectedTab) {
        this.setState({
          selectedTab: {
            value: selectedTab.value,
            label: selectedTab.title,
          },
        });
      }
    } else {
      this.setState({ selectedTab: undefined });
    }
  };

  renderSaveChartModal = () => {
    const info = this.info();
    return (
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
            checked={this.state.action === ChartStatusType.saveas}
            onChange={() => this.changeAction('saveas')}
          >
            {t('Save as...')}
          </Radio>
        </FormItem>
        <Divider />
        <FormItem label={t('Chart name')} required>
          <Input
            name="new_slice_name"
            type="text"
            placeholder={t('Name')}
            value={this.state.newSliceName}
            onChange={this.onSliceNameChange}
            data-test="new-chart-name"
          />
        </FormItem>
        {this.props.datasource?.type === 'query' && (
          <FormItem label={t('Dataset Name')} required>
            <InfoTooltip
              tooltip={t('A reusable dataset will be saved with your chart.')}
              placement="right"
            />
            <Input
              name="dataset_name"
              type="text"
              placeholder={t('Dataset Name')}
              value={this.state.datasetName}
              onChange={this.handleDatasetNameChange}
              data-test="new-dataset-name"
            />
          </FormItem>
        )}
        <FormItem
          label={t('Add to dashboard')}
          data-test="save-chart-modal-select-dashboard-form"
        >
          <AsyncSelect
            allowClear
            allowNewOptions
            ariaLabel={t('Select a dashboard')}
            options={this.loadDashboards}
            onChange={this.onDashboardChange}
            value={this.state.dashboard}
            placeholder={
              <div>
                <b>{t('Select')}</b>
                {t(' a dashboard OR ')}
                <b>{t('create')}</b>
                {t(' a new one')}
              </div>
            }
          />
        </FormItem>
        {this.state.action === ChartStatusType.saveas && (
          <FormItem
            label={t('Add to tabs')}
            data-test="save-chart-modal-select-tabs-form"
          >
            <TreeSelect
              showSearch
              allowClear
              treeDefaultExpandAll
              treeData={this.state.tabsData}
              onChange={this.onTabChange}
              value={this.state.selectedTab?.value}
              disabled={
                !this.state.dashboard ||
                typeof this.state.dashboard.value === 'string' ||
                this.state.tabsData.length === 0
              }
              placeholder={t('Select a tab')}
            />
          </FormItem>
        )}
        {info && <Alert type="info" message={info} closable={false} />}
        {this.props.alert && (
          <Alert
            css={{ marginTop: info ? 16 : undefined }}
            type="warning"
            message={this.props.alert}
            closable={false}
          />
        )}
      </Form>
    );
  };

  info = () => {
    const isNewDashboard = this.isNewDashboard();
    let chartWillBeCreated = false;
    if (
      this.props.slice &&
      (this.state.action !== 'overwrite' || !this.canOverwriteSlice())
    ) {
      chartWillBeCreated = true;
    }
    if (chartWillBeCreated && isNewDashboard) {
      return t('A new chart and dashboard will be created.');
    }
    if (chartWillBeCreated) {
      return t('A new chart will be created.');
    }
    if (isNewDashboard) {
      return t('A new dashboard will be created.');
    }
    return null;
  };

  renderFooter = () => (
    <div data-test="save-modal-footer">
      <Button
        id="btn_cancel"
        buttonSize="small"
        onClick={this.onHide}
        buttonStyle="secondary"
      >
        {t('Cancel')}
      </Button>
      <Button
        id="btn_modal_save_goto_dash"
        buttonSize="small"
        disabled={
          !this.state.newSliceName ||
          !this.state.dashboard ||
          (this.props.datasource?.type !== DatasourceType.Table &&
            !this.state.datasetName)
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
        disabled={
          this.state.isLoading ||
          !this.state.newSliceName ||
          (this.props.datasource?.type !== DatasourceType.Table &&
            !this.state.datasetName)
        }
        data-test="btn-modal-save"
      >
        {t('Save')}
      </Button>
    </div>
  );

  render() {
    return (
      <StyledModal
        show={this.props.isVisible}
        onHide={this.onHide}
        title={t('Save chart')}
        footer={this.renderFooter()}
      >
        {this.state.isLoading ? (
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
        )}
      </StyledModal>
    );
  }
}

interface StateProps {
  datasource: any;
  slice: any;
  user: UserWithPermissionsAndRoles;
  dashboards: any;
  alert: any;
  isVisible: boolean;
}

function mapStateToProps({
  explore,
  saveModal,
  user,
}: Record<string, any>): StateProps {
  return {
    datasource: explore.datasource,
    slice: explore.slice,
    user,
    dashboards: saveModal.dashboards,
    alert: saveModal.saveModalAlert,
    isVisible: saveModal.isVisible,
  };
}

export default withRouter(connect(mapStateToProps)(SaveModal));

// User for testing purposes need to revisit once we convert this to functional component
export { SaveModal as PureSaveModal };
