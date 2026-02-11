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
import {
  ChangeEvent,
  FormEvent,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { Dispatch } from 'redux';
import { nanoid } from 'nanoid';
import rison from 'rison';
import { connect, useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
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

/**
 * Creates URLSearchParams with save action and slice ID, removing form_data_key.
 * Exported for testing purposes.
 */
export const createRedirectParams = (
  windowLocationSearch: string,
  chart: { id: number },
  action: string,
): URLSearchParams => {
  const searchParams = new URLSearchParams(windowLocationSearch);
  searchParams.set('save_action', action);
  searchParams.delete('form_data_key');
  searchParams.set('slice_id', chart.id.toString());
  return searchParams;
};

/**
 * Adds a chart to a dashboard tab by updating the position_json.
 * Exported for testing purposes.
 */
export const addChartToDashboard = async (
  dashboardId: number,
  chartId: number,
  tabId: string,
  sliceNameParam: string | undefined,
): Promise<void> => {
  const dashboardResponse = await SupersetClient.get({
    endpoint: `/api/v1/dashboard/${dashboardId}`,
  });

  const dashboardData = dashboardResponse.json.result;

  let positionJson = dashboardData.position_json;
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
      sliceName: sliceNameParam ?? `Chart ${chartId}`,
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

  await SupersetClient.put({
    endpoint: `/api/v1/dashboard/${dashboardId}`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      position_json: JSON.stringify(updatedPositionJson),
    }),
  });
};

interface SaveModalProps {
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

const SaveModal = ({
  addDangerToast,
  actions,
  form_data,
  user,
  alert: alertProp,
  sliceName = '',
  slice,
  datasource,
  dashboardId: dashboardIdProp,
  isVisible,
}: SaveModalProps) => {
  const dispatch = useDispatch();
  const history = useHistory();

  const canOverwriteSlice = useCallback(
    (): boolean =>
      slice?.owners?.includes(user.userId) && !slice?.is_managed_externally,
    [slice, user.userId],
  );

  const [newSliceName, setNewSliceName] = useState<string | undefined>(
    sliceName,
  );
  const [datasetName, setDatasetName] = useState<string>(datasource?.name);
  const [action, setAction] = useState<SaveActionType>(
    canOverwriteSlice() ? ChartStatusType.overwrite : ChartStatusType.saveas,
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dashboard, setDashboard] = useState<
    { label: string; value: string | number } | undefined
  >(undefined);
  const [tabsData, setTabsData] = useState<TabTreeNode[]>([]);
  const [selectedTab, setSelectedTab] = useState<
    { label: string; value: string | number } | undefined
  >(undefined);

  const isNewDashboard = useCallback(
    (): boolean => typeof dashboard?.value === 'string',
    [dashboard?.value],
  );

  const loadDashboard = useCallback(async (id: number) => {
    const response = await SupersetClient.get({
      endpoint: `/api/v1/dashboard/${id}`,
    });
    return response.json.result;
  }, []);

  const loadTabs = useCallback(
    async (dashboardId: number) => {
      try {
        const response = await SupersetClient.get({
          endpoint: `/api/v1/dashboard/${dashboardId}/tabs`,
        });

        const { result } = response.json;
        if (!result || !Array.isArray(result.tab_tree)) {
          logging.warn('Invalid tabs response format');
          setTabsData([]);
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

          setTabsData(tabsDataWithOutOfTab);
          setSelectedTab({ value: 'OUT_OF_TAB', label: 'Out of tab' });
        } else {
          const firstTab = treeData[0];
          setTabsData(treeData);
          setSelectedTab({ value: firstTab.value, label: firstTab.title });
        }

        return treeData;
      } catch (error) {
        logging.error('Error loading tabs:', error);
        setTabsData([]);
        return [];
      }
    },
    [setTabsData, setSelectedTab],
  );

  useEffect(() => {
    const initializeDashboard = async () => {
      let dashboardId = dashboardIdProp;
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
          const result = (await loadDashboard(dashboardId)) as Dashboard;
          if (canUserEditDashboard(result, user)) {
            setDashboard({ label: result.dashboard_title, value: result.id });
            await loadTabs(dashboardId);
          }
        } catch (error) {
          logging.warn(error);
          addDangerToast(
            t('An error occurred while loading dashboard information.'),
          );
        }
      }
    };
    initializeDashboard();
  }, [dashboardIdProp, user, loadDashboard, loadTabs, addDangerToast]);

  const handleDatasetNameChange = useCallback(
    (e: FormEvent<HTMLInputElement>) => {
      // @ts-expect-error
      setDatasetName(e.target.value);
    },
    [],
  );

  const onSliceNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setNewSliceName(event.target.value);
    },
    [],
  );

  const onDashboardChange = useCallback(
    async (newDashboard: { label: string; value: string | number }) => {
      setDashboard(newDashboard);
      setTabsData([]);
      setSelectedTab(undefined);

      if (typeof newDashboard.value === 'number') {
        await loadTabs(newDashboard.value);
      }
    },
    [loadTabs],
  );

  const changeAction = useCallback((newAction: SaveActionType) => {
    setAction(newAction);
  }, []);

  const onHide = useCallback(() => {
    dispatch(setSaveChartModalVisibility(false));
  }, [dispatch]);

  const handleRedirect = useCallback(
    (windowLocationSearch: string, chart: { id: number }) =>
      createRedirectParams(windowLocationSearch, chart, action),
    [action],
  );

  const addChartToDashboardTab = useCallback(
    async (
      dashboardId: number,
      chartId: number,
      tabId: string,
      sliceNameParam: string | undefined,
    ) => {
      try {
        await addChartToDashboard(dashboardId, chartId, tabId, sliceNameParam);
      } catch (error) {
        throw new Error(`Error adding chart to dashboard tab: ${error}`);
      }
    },
    [],
  );

  const saveOrOverwrite = useCallback(
    async (gotodash: boolean) => {
      setIsLoading(true);
      const tableState = form_data?.table_state;
      const sliceId = slice?.slice_id;
      const vizType = form_data?.viz_type;
      if (sliceId && vizType && tableState) {
        dispatch(updateChartState(sliceId, vizType, tableState));
      }

      //  Create or retrieve dashboard
      type DashboardGetResponse = {
        id: number;
        url: string;
        dashboard_title: string;
      };

      try {
        if (datasource?.type === DatasourceType.Query) {
          const { schema, sql, database } = datasource;
          const { templateParams } = datasource;

          await actions.saveDataset({
            schema,
            sql,
            database,
            templateParams,
            datasourceName: datasetName,
          });
        }

        //  Get chart dashboards
        let sliceDashboards: number[] = [];
        if (slice && action === 'overwrite') {
          sliceDashboards = await actions.getSliceDashboards(slice);
        }

        const formData = form_data || {};
        delete formData.url_params;

        let dashboardResult: DashboardGetResponse | null = null;
        let selectedTabId: string | undefined;
        if (dashboard) {
          let validId = dashboard.value;
          if (isNewDashboard()) {
            const response = await actions.createDashboard(dashboard.label);
            validId = response.id;
          }

          try {
            dashboardResult = await loadDashboard(validId as number);
          } catch (error) {
            actions.saveSliceFailed();
            return;
          }

          if (isDefined(dashboardResult) && isDefined(dashboardResult?.id)) {
            sliceDashboards = sliceDashboards.includes(dashboardResult.id)
              ? sliceDashboards
              : [...sliceDashboards, dashboardResult.id];
            formData.dashboards = sliceDashboards;
            if (
              action === ChartStatusType.saveas &&
              selectedTab?.value !== 'OUT_OF_TAB'
            ) {
              selectedTabId = selectedTab?.value as string;
            }
          }
        }

        // Sets the form data
        actions.setFormData({ ...formData });

        //  Update or create slice
        let value: { id: number };
        if (action === 'overwrite') {
          value = await actions.updateSlice(
            slice,
            newSliceName,
            sliceDashboards,
            dashboardResult
              ? {
                  title: dashboardResult.dashboard_title,
                  new: isNewDashboard(),
                }
              : null,
          );
        } else {
          value = await actions.createSlice(
            newSliceName,
            sliceDashboards,
            dashboardResult
              ? {
                  title: dashboardResult.dashboard_title,
                  new: isNewDashboard(),
                }
              : null,
          );
          if (dashboardResult && selectedTabId) {
            try {
              await addChartToDashboardTab(
                dashboardResult.id,
                value.id,
                selectedTabId,
                newSliceName,
              );
            } catch (error) {
              logging.error('Error adding chart to dashboard tab:', error);
              addDangerToast(
                t(
                  'Chart was saved but could not be added to the selected tab.',
                ),
              );
            }
          }
        }

        try {
          if (dashboardResult) {
            sessionStorage.setItem(SK_DASHBOARD_ID, `${dashboardResult.id}`);
          } else {
            sessionStorage.removeItem(SK_DASHBOARD_ID);
          }
        } catch (error) {
          // continue regardless of error
        }

        // Go to new dashboard url
        if (gotodash && dashboardResult) {
          let { url } = dashboardResult;
          if (selectedTab?.value) {
            url += `#${selectedTab.value}`;
          }
          dispatch(removeChartState(value.id));
          history.push(url);
          return;
        }
        const searchParams = handleRedirect(window.location.search, value);
        history.replace(`/explore/?${searchParams.toString()}`);

        setIsLoading(false);
        onHide();
      } finally {
        setIsLoading(false);
      }
    },
    [
      form_data,
      slice,
      dispatch,
      datasource,
      datasetName,
      actions,
      action,
      dashboard,
      isNewDashboard,
      loadDashboard,
      selectedTab,
      newSliceName,
      addChartToDashboardTab,
      addDangerToast,
      history,
      handleRedirect,
      onHide,
    ],
  );

  const loadDashboards = useCallback(
    async (search: string, page: number, pageSize: number) => {
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
            value: user.userId,
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
          (dashboardItem: { id: number; dashboard_title: string }) => ({
            value: dashboardItem.id,
            label: dashboardItem.dashboard_title,
          }),
        ),
        totalCount: count,
      };
    },
    [user.userId],
  );

  const onTabChange = useCallback(
    (value: string) => {
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

        const foundTab = findTabInTree(tabsData);
        if (foundTab) {
          setSelectedTab({
            value: foundTab.value,
            label: foundTab.title,
          });
        }
      } else {
        setSelectedTab(undefined);
      }
    },
    [tabsData],
  );

  const info = useMemo(() => {
    const newDashboard = isNewDashboard();
    let chartWillBeCreated = false;
    if (slice && (action !== 'overwrite' || !canOverwriteSlice())) {
      chartWillBeCreated = true;
    }
    if (chartWillBeCreated && newDashboard) {
      return t('A new chart and dashboard will be created.');
    }
    if (chartWillBeCreated) {
      return t('A new chart will be created.');
    }
    if (newDashboard) {
      return t('A new dashboard will be created.');
    }
    return null;
  }, [isNewDashboard, slice, action, canOverwriteSlice]);

  const renderSaveChartModal = () => (
    <Form data-test="save-modal-body" layout="vertical">
      <FormItem data-test="radio-group">
        <Radio
          id="overwrite-radio"
          disabled={!canOverwriteSlice()}
          checked={action === 'overwrite'}
          onChange={() => changeAction('overwrite')}
          data-test="save-overwrite-radio"
        >
          {t('Save (Overwrite)')}
        </Radio>
        <Radio
          id="saveas-radio"
          data-test="saveas-radio"
          checked={action === ChartStatusType.saveas}
          onChange={() => changeAction('saveas')}
        >
          {t('Save as...')}
        </Radio>
      </FormItem>
      <Divider />
      <FormItem label={t('Chart name')} required>
        <Input
          name="new_slice_name"
          type="text"
          placeholder="Name"
          value={newSliceName}
          onChange={onSliceNameChange}
          data-test="new-chart-name"
        />
      </FormItem>
      {datasource?.type === 'query' && (
        <FormItem label={t('Dataset Name')} required>
          <InfoTooltip
            tooltip={t('A reusable dataset will be saved with your chart.')}
            placement="right"
          />
          <Input
            name="dataset_name"
            type="text"
            placeholder="Dataset Name"
            value={datasetName}
            onChange={handleDatasetNameChange}
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
          options={loadDashboards}
          onChange={onDashboardChange}
          value={dashboard}
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
      {action === ChartStatusType.saveas && (
        <FormItem
          label={t('Add to tabs')}
          data-test="save-chart-modal-select-tabs-form"
        >
          <TreeSelect
            showSearch
            allowClear
            treeDefaultExpandAll
            treeData={tabsData}
            onChange={onTabChange}
            value={selectedTab?.value}
            disabled={
              !dashboard ||
              typeof dashboard.value === 'string' ||
              tabsData.length === 0
            }
            placeholder={t('Select a tab')}
          />
        </FormItem>
      )}
      {info && <Alert type="info" message={info} closable={false} />}
      {alertProp && (
        <Alert
          css={{ marginTop: info ? 16 : undefined }}
          type="warning"
          message={alertProp}
          closable={false}
        />
      )}
    </Form>
  );

  const renderFooter = () => (
    <div data-test="save-modal-footer">
      <Button
        id="btn_cancel"
        buttonSize="small"
        onClick={onHide}
        buttonStyle="secondary"
      >
        {t('Cancel')}
      </Button>
      <Button
        id="btn_modal_save_goto_dash"
        buttonSize="small"
        disabled={
          isLoading ||
          !newSliceName ||
          !dashboard ||
          (datasource?.type !== DatasourceType.Table && !datasetName)
        }
        onClick={() => saveOrOverwrite(true)}
      >
        {t('Save & go to dashboard')}
      </Button>
      <Button
        id="btn_modal_save"
        buttonSize="small"
        buttonStyle="primary"
        onClick={() => saveOrOverwrite(false)}
        disabled={
          isLoading ||
          !newSliceName ||
          (datasource?.type !== DatasourceType.Table && !datasetName)
        }
        data-test="btn-modal-save"
      >
        {t('Save')}
      </Button>
    </div>
  );

  return (
    <StyledModal
      show={isVisible}
      onHide={onHide}
      title={t('Save chart')}
      footer={renderFooter()}
    >
      {isLoading ? (
        <div
          css={css`
            display: flex;
            justify-content: center;
          `}
        >
          <Loading position="normal" />
        </div>
      ) : (
        renderSaveChartModal()
      )}
    </StyledModal>
  );
};

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

export default connect(mapStateToProps)(SaveModal);

// User for testing purposes need to revisit once we convert this to functional component
export { SaveModal as PureSaveModal };
