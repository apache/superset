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
import { useState, useCallback, useMemo } from 'react';
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
import {
  createSlice,
  setSaveChartModalVisibility,
} from 'src/explore/actions/saveModalActions';
import { hydratePortableExplore } from 'src/explore/actions/hydrateExplore';
import SaveModal from 'src/explore/components/SaveModal';
import PortableExplore from '../PortableExplore';

interface DatasourceOption {
  value: string;
  label: string;
  id: string;
  customLabel?: string;
  explore_url?: string;
}

interface AddChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (chartId: number) => void;
}

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

const AddChartModal: React.FC<AddChartModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const dispatch = useDispatch();

  const [selectedDatasource, setSelectedDatasource] =
    useState<DatasourceOption | null>(null);

  // Get state from Redux for validation and save modal
  const chart = useSelector((state: any) => state.charts?.[0] || {});
  const sliceName = useSelector(
    (state: any) => state.explore?.form_data?.slice_name || 'New Chart',
  );
  const isSaveModalVisible = useSelector(
    (state: any) => state.saveModal?.isVisible || false,
  );
  const user = useSelector((state: any) => state.user);
  const formData = useSelector((state: any) => state.explore?.form_data || {});
  const datasource = useSelector((state: any) => state.explore?.datasource);
  const controls = useSelector((state: any) => state.explore?.controls || {});
  const exploreState = useSelector((state: any) => state.explore);

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
  const saveDisabled = errorMessage || chart.chartStatus === 'loading';

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

  const handleShowSaveModal = useCallback(() => {
    if (!selectedDatasource || saveDisabled) return;

    // Show the save modal instead of directly saving
    dispatch(setSaveChartModalVisibility(true));
  }, [selectedDatasource, saveDisabled, dispatch]);

  const handleSaveComplete = useCallback(
    (chartId: number) => {
      // Call the onSave callback passed from parent and close modal
      onSave(chartId);
      onClose();
    },
    [onSave, onClose],
  );

  const renderChartPreview = () => {
    if (!selectedDatasource) {
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

    return <PortableExplore />;
  };

  return (
    <>
      <Modal
        show={isOpen}
        onHide={onClose}
        title={t('Add Chart')}
        width="1600px"
        footer={
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}
          >
            <Button onClick={onClose}>{t('Cancel')}</Button>
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
                  {t('Save Chart')}
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

      {/* Render SaveModal when visible */}
      {isSaveModalVisible && (
        <SaveModal
          addDangerToast={(_msg: string) => {}} // You might want to connect this to proper toast system
          actions={{}} // This will need to be connected properly
          form_data={formData}
          sliceName={sliceName}
          dashboardId={getDashboardId()}
          onSaveComplete={handleSaveComplete}
        />
      )}
    </>
  );
};

export default AddChartModal;
