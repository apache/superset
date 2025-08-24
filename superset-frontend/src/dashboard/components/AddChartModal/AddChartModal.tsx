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
import { useState, useCallback } from 'react';
import { t, SupersetClient, styled } from '@superset-ui/core';
import { Modal, AsyncSelect, EmptyState } from '@superset-ui/core/components';
import { fetchExploreData } from 'src/pages/Chart';
import { useDispatch } from 'react-redux';
import { createSlice } from 'src/explore/actions/saveModalActions';
import { hydratePortableExplore } from 'src/explore/actions/hydrateExplore';
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

  const handleSave = useCallback(async () => {
    if (!selectedDatasource) return;

    try {
      const dashboardId = getDashboardId();
      const dashboards = dashboardId ? [dashboardId] : [];

      // createSlice returns a thunk function that needs to be dispatched
      const action = createSlice('New Chart', dashboards);
      const result = await (dispatch(action) as any);

      if (result && result.slice_id) {
        onSave(result.slice_id);
        onClose();
      }
    } catch (error) {
      // Error handling - createSlice already dispatches error actions
      console.error('Failed to save chart:', error);
    }
  }, [selectedDatasource, onSave, onClose, dispatch, getDashboardId]);

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
    <Modal
      show={isOpen}
      onHide={onClose}
      title={t('Add Chart')}
      width="1600px"
      onHandledPrimaryAction={handleSave}
      primaryButtonName={t('Save Chart')}
      disablePrimaryButton={!selectedDatasource}
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
  );
};

export default AddChartModal;
