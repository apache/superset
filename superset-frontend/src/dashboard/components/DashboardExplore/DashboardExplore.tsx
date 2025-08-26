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
import { useState, useCallback, useMemo, useEffect } from 'react';
import { t, SupersetClient, styled } from '@superset-ui/core';
import {
  Modal,
  AsyncSelect,
  EmptyState,
  Tooltip,
  Button,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { fetchExploreData } from 'src/pages/Chart';
import { useDispatch, useSelector } from 'react-redux';
import { bindActionCreators } from 'redux';
import { hydratePortableExplore } from 'src/explore/actions/hydrateExplore';
import * as exploreActions from 'src/explore/actions/exploreActions';
import { datasourcesActions } from 'src/explore/actions/datasourcesActions';
import * as saveModalActions from 'src/explore/actions/saveModalActions';
import * as chartActions from 'src/components/Chart/chartAction';
import * as logActions from 'src/logger/actions';
import SaveModalPortable from 'src/explore/components/SaveModalPortable';
import PortableExplore from '../PortableExplore';
import {
  toggleDashboardExploreModal,
  addSliceToDashboard,
} from '../../actions/dashboardState';
import { updateEasyChartMeta } from '../../actions/dashboardLayout';
import { fetchSlices } from '../../actions/sliceEntities';
import { updatePortableChartId } from '../../../components/Chart/chartAction';

interface DatasourceOption {
  value: string;
  label: string;
  id: string;
  customLabel?: string;
  explore_url?: string;
}

let existingChartId: null | number = null;

const StyledModalContent = styled.div`
  ${({ theme }) => `
    display: flex;
    flex-direction: column;
    height: 700px;
    padding: ${theme.paddingLG}px;
    gap: ${theme.paddingLG}px;

    .dataset-header {
      display: flex;
      align-items: center;
      gap: ${theme.paddingLG}px;
      padding: ${theme.paddingSM}px 0;
      border-bottom: 1px solid ${theme.colorBorderSecondary};
      flex-shrink: 0;
    }

    .dataset-label {
      font-weight: ${theme.fontWeightStrong};
      color: ${theme.colorTextHeading};
      font-size: ${theme.fontSizeLG}px;
      min-width: 80px;
    }

    .dataset-select {
      flex: 1;
      max-width: 400px;
    }

    .chart-preview-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: ${theme.colorBgContainer};
      border: 1px solid ${theme.colorBorderSecondary};
      border-radius: ${theme.borderRadius}px;
      overflow: hidden;
      min-height: 0; /* Important for flex child to shrink */
    }

    .chart-preview-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0; /* Important for flex child to shrink */
    }
  `}
`;

const DashboardExplore: React.FC = () => {
  const dispatch = useDispatch();

  // Get Redux state for modal visibility and editing chart id
  const isDashboardExploreOpen = useSelector(
    (state: any) => state.dashboardState.isDashboardExploreOpen,
  );
  const dashboardExploreSliceId = useSelector(
    (state: any) => state.dashboardState.dashboardExploreSliceId,
  );

  const [selectedDatasource, setSelectedDatasource] =
    useState<DatasourceOption | null>(null);
  const [isLoadingEditChart, setIsLoadingEditChart] = useState(false);
  const [isSaveModalVisible, setIsSaveModalVisible] = useState(false);

  // Get the editing chart ID - when it's provided, we're editing an existing chart
  const editingChartId = dashboardExploreSliceId;

  // Initialize loading state immediately when modal opens for editing
  useEffect(() => {
    if (isDashboardExploreOpen && editingChartId) {
      setIsLoadingEditChart(true);
      setSelectedDatasource(null); // Clear any previous selection
    } else if (isDashboardExploreOpen && !editingChartId) {
      setIsLoadingEditChart(false);
      setSelectedDatasource(null); // Clear for new chart creation
    }
  }, [isDashboardExploreOpen, editingChartId]);

  // Get state from Redux for validation and save modal
  const charts = useSelector((state: any) => state.charts || {});
  const chart = charts[0] || {}; // Chart for portable explore is always at key 0
  const sliceName = useSelector(
    (state: any) => state.explore?.form_data?.slice_name || 'New Chart',
  );
  const formData = useSelector((state: any) => state.explore?.form_data || {});
  const controls = useSelector((state: any) => state.explore?.controls || {});
  const exploreState = useSelector((state: any) => state.explore);
  const datasource = useSelector((state: any) => state.explore?.datasource);
  const slice = useSelector((state: any) => state.explore?.slice);
  const user = useSelector((state: any) => state.user);
  const datasources = useSelector((state: any) => state.datasources);

  // Bind action creators like ExploreViewContainer does
  const actions = useMemo(
    () =>
      bindActionCreators(
        {
          ...exploreActions,
          ...datasourcesActions,
          ...saveModalActions,
          ...chartActions,
          ...logActions,
        } as any,
        dispatch,
      ),
    [dispatch],
  );

  // Calculate errorMessage exactly like ExploreViewContainer does
  const errorMessage = useMemo(() => {
    const controlsWithErrors = Object.values(controls).filter(
      (control: any) =>
        control.validationErrors && control.validationErrors.length > 0,
    );
    if (controlsWithErrors.length === 0) {
      return null;
    }

    const errorMessages = controlsWithErrors.map(
      (control: any) => control.validationErrors,
    );
    const uniqueErrorMessages = [...new Set(errorMessages.flat())];

    const errors = uniqueErrorMessages
      .map(message => {
        const matchingLabels = controlsWithErrors
          .filter((control: any) => control.validationErrors?.includes(message))
          .map((control: any) =>
            typeof control.label === 'function'
              ? control.label(exploreState)
              : control.label,
          );
        return [matchingLabels, message];
      })
      .map(([labels, message]) => (
        <div key={message as string}>
          {(labels as string[]).length > 1
            ? t('Controls labeled ')
            : t('Control labeled ')}
          <strong>{` ${(labels as string[]).join(', ')}`}</strong>
          <span>: {message}</span>
        </div>
      ));

    let errorMessage;
    if (errors.length > 0) {
      errorMessage = <div style={{ textAlign: 'left' }}>{errors}</div>;
    }
    return errorMessage;
  }, [controls, exploreState]);

  // Calculate save disabled state similar to ExploreViewContainer
  const saveDisabled = !!errorMessage || chart.chartStatus === 'loading';

  const getDashboardId = useCallback((): number | null => {
    if (window.location.pathname.includes('/dashboard/')) {
      const dashboardIdStr = window.location.pathname
        .split('/dashboard/')[1]
        ?.split('/')[0];
      return dashboardIdStr ? parseInt(dashboardIdStr, 10) : null;
    }
    return null;
  }, []);

  const fetchDatasourceExploreData = useCallback(
    async (datasource: DatasourceOption) => {
      if (!datasource?.value) return null;

      try {
        const exploreUrlParams = new URLSearchParams({
          viz_type: 'pie', // Default to pie chart
          datasource_id: datasource.value,
          datasource_type: 'table',
        });

        const response = await fetchExploreData(exploreUrlParams);
        const result = response?.result;

        if (result?.dataset) {
          // Hydrate Redux store with portable explore data
          dispatch(
            hydratePortableExplore({
              dataset: result.dataset,
              vizType: 'pie',
              dashboardId: getDashboardId(),
              form_data: {
                viz_type: 'pie',
                datasource: `${result.dataset.id}__table`,
              },
              slice: null, // Empty slice object for new chart
            }),
          );
        }

        return result;
      } catch (error) {
        return null;
      }
    },
    [dispatch, getDashboardId],
  );

  const handleDatasourceChange = useCallback(
    async (value: any) => {
      const datasource = value as DatasourceOption | null;
      setSelectedDatasource(datasource);

      if (datasource?.value) {
        await fetchDatasourceExploreData(datasource);
      }
    },
    [fetchDatasourceExploreData],
  );

  const loadDatasources = useCallback(
    async (search: string, page: number, pageSize: number) => {
      try {
        const queryParams = new URLSearchParams({
          q: search,
          page_size: pageSize.toString(),
          page: page.toString(),
        });

        const response = await SupersetClient.get({
          endpoint: `/api/v1/dataset/?${queryParams}`,
        });

        const options = response.json.result.map((dataset: any) => ({
          value: dataset.id.toString(),
          label: dataset.table_name,
          id: dataset.id.toString(),
          customLabel: `${dataset.database.database_name}: ${dataset.table_name}`,
          explore_url: dataset.explore_url,
        }));

        return {
          data: options,
          totalCount: response.json.count,
        };
      } catch (error) {
        return {
          data: [],
          totalCount: 0,
        };
      }
    },
    [],
  );

  const handleClose = useCallback(() => {
    dispatch(toggleDashboardExploreModal(false, null));
  }, [dispatch]);

  const handleShowSaveModal = useCallback(() => {
    if (!selectedDatasource || saveDisabled) return;

    // Show the save modal instead of directly saving
    setIsSaveModalVisible(true);
  }, [selectedDatasource, saveDisabled]);

  // Get dashboard layout outside of callback
  const dashboardLayout = useSelector(
    (state: any) => state.dashboardLayout.present,
  );

  const handleSaveComplete = useCallback(
    (chartId: number) => {
      // Update the EasyChart with the new chart ID
      // Find the appropriate EasyChart component to update
      const easyChartComponents = Object.values(dashboardLayout).filter(
        (component: any) => component.type === 'EASY_CHART',
      );

      // For now, find an empty EasyChart or create logic to identify which one triggered this
      const targetComponent = easyChartComponents.find(
        (component: any) => !component.meta?.chartId,
      );

      if (targetComponent) {
        dispatch(updatePortableChartId(chartId, 0));
        dispatch(fetchSlices());
        setTimeout(() => {
          dispatch(addSliceToDashboard(chartId));
        }, 500);
        setTimeout(() => {
          dispatch(updateEasyChartMeta((targetComponent as any).id, chartId));
        }, 500);
      }

      // Close the modal
      handleClose();
    },
    [dispatch, handleClose, dashboardLayout],
  );

  // Handle editing existing chart
  useEffect(() => {
    if (isDashboardExploreOpen && editingChartId) {
      const existingChart = charts[editingChartId];
      const existingFormData = existingChart?.form_data;

      if (existingChart && existingFormData?.datasource) {
        const [datasourceId] = existingFormData.datasource.split('__');
        const datasourceKey = existingFormData.datasource;

        // Use fetchExploreData to get complete chart information including ownership
        const exploreUrlParams = new URLSearchParams({
          slice_id: editingChartId.toString(),
        });
        fetchExploreData(exploreUrlParams)
          .then(({ result }) => {
            const { dataset: freshDatasourceMeta, metadata, slice } = result;
            const datasourceOption = {
              value: datasourceId,
              label: freshDatasourceMeta?.table_name || 'Dataset',
              id: datasourceId,
              customLabel:
                `${freshDatasourceMeta?.database?.database_name}: ${freshDatasourceMeta?.table_name}` ||
                'Dataset',
            };

            setSelectedDatasource(datasourceOption);

            // Check if explore state is empty or doesn't match the editing chart
            const currentExploreFormData = exploreState?.form_data;
            const isExploreEmpty =
              !currentExploreFormData ||
              Object.keys(currentExploreFormData).length === 0;
            const isExploreForDifferentChart =
              existingChartId !== editingChartId;

            if (isExploreEmpty || isExploreForDifferentChart) {
              existingChartId = editingChartId;
              // Rehydrate portable explore with complete chart data from API
              dispatch(
                hydratePortableExplore({
                  dataset: freshDatasourceMeta,
                  vizType: result.form_data.viz_type || 'table',
                  dashboardId: getDashboardId(),
                  form_data: {
                    ...result.form_data,
                    slice_id: editingChartId, // Keep the original chart ID for editing
                  },
                  metadata,
                  slice,
                }),
              );
            } else {
              // Explore state is already ready
              setIsLoadingEditChart(false);
            }
          })
          .catch(error => {
            console.error('Failed to fetch chart data:', error);
            // Fallback to cached datasource if API fails
            const cachedDatasourceMeta = datasources?.[datasourceKey];
            if (cachedDatasourceMeta) {
              const datasourceOption = {
                value: datasourceId,
                label: cachedDatasourceMeta?.table_name || 'Dataset',
                id: datasourceId,
                customLabel: cachedDatasourceMeta?.name || 'Dataset',
              };
              setSelectedDatasource(datasourceOption);
            }
            setIsLoadingEditChart(false);
          });
      }
    }
  }, [isDashboardExploreOpen, editingChartId, datasource]);

  // Monitor explore state hydration completion for editing mode
  useEffect(() => {
    if (isLoadingEditChart && editingChartId && exploreState?.form_data) {
      // Check if explore state matches the editing chart
      if (exploreState.form_data.slice_id === editingChartId) {
        setIsLoadingEditChart(false);
      }
    }
  }, [isLoadingEditChart, editingChartId, exploreState]);

  const renderChartPreview = () => {
    // Show dataset selection for new chart creation (not editing)
    if (!editingChartId && !selectedDatasource) {
      return (
        <EmptyState
          size="large"
          title={t('Select a dataset to start')}
          description={t(
            'Choose a dataset from the dropdown above to begin building your chart',
          )}
          image="chart.svg"
        />
      );
    }

    // Show explore interface when datasource is selected or editing is ready
    return <PortableExplore />;
  };

  return (
    <>
      <Modal
        show={isDashboardExploreOpen}
        onHide={handleClose}
        destroyOnHidden
        title={editingChartId ? t('Edit Chart') : t('Add Chart')}
        width="1600px"
        footer={
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}
          >
            <Button onClick={handleClose}>{t('Cancel')}</Button>
            <Tooltip
              title={
                saveDisabled || !selectedDatasource
                  ? t('Add required control values to save chart')
                  : null
              }
            >
              <div>
                <Button
                  buttonStyle="primary"
                  onClick={handleShowSaveModal}
                  disabled={saveDisabled || !selectedDatasource}
                  data-test="save-chart-button"
                  icon={<Icons.SaveOutlined />}
                >
                  {t('Save chart')}
                </Button>
              </div>
            </Tooltip>
          </div>
        }
      >
        <StyledModalContent>
          <div className="dataset-header">
            <div className="dataset-label">{t('Dataset')}</div>
            <div className="dataset-select">
              <AsyncSelect
                css={{}}
                ariaLabel={t('Dataset')}
                name="select-datasource"
                onChange={handleDatasourceChange}
                options={loadDatasources}
                optionFilterProps={['id', 'customLabel']}
                placeholder={t('Choose a dataset to get started')}
                value={selectedDatasource}
                allowClear
                showSearch
              />
            </div>
          </div>

          <div className="chart-preview-container">
            <div className="chart-preview-content">{renderChartPreview()}</div>
          </div>
        </StyledModalContent>
      </Modal>

      {/* Render SaveModalPortable when visible */}
      {isSaveModalVisible && (
        <SaveModalPortable
          isVisible={isSaveModalVisible}
          onHide={() => setIsSaveModalVisible(false)}
          addDangerToast={(msg: string) => console.log('Toast:', msg)}
          actions={actions}
          form_data={formData}
          sliceName={sliceName}
          datasource={datasource}
          slice={slice}
          user={user}
          onSaveComplete={handleSaveComplete}
        />
      )}
    </>
  );
};

export default DashboardExplore;
