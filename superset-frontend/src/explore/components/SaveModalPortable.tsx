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
import { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Form,
  FormItem,
  Modal,
  Input,
  Loading,
  Divider,
} from '@superset-ui/core/components';
import { css, DatasourceType, styled, t } from '@superset-ui/core';
import { Radio } from '@superset-ui/core/components/Radio';
import { SaveActionType } from 'src/explore/types';

interface SaveModalPortableProps {
  isVisible: boolean;
  onHide: () => void;
  addDangerToast: (msg: string) => void;
  actions: Record<string, any>;
  form_data?: Record<string, any>;
  sliceName?: string;
  datasource?: Record<string, any>;
  slice?: Record<string, any>;
  user?: any;
  onSaveComplete?: (chartId: number, overwrite: boolean) => void;
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

const SaveModalPortable: React.FC<SaveModalPortableProps> = ({
  isVisible,
  onHide,
  addDangerToast,
  actions,
  form_data,
  sliceName,
  datasource,
  slice,
  user,
  onSaveComplete,
}) => {
  // Get the current slice name from Redux state (updated by chart header)
  const currentSliceName = useSelector(
    (state: any) => state.explore?.sliceName,
  );
  // Get the original chart ID for editing in portable explore
  const dashboardExploreSliceId = useSelector(
    (state: any) => state.dashboardState?.dashboardExploreSliceId,
  );
  // Use the Redux slice name if available, otherwise fall back to prop
  const effectiveSliceName = currentSliceName || sliceName || 'New Chart';
  const canOverwriteSlice = useCallback(
    (): boolean =>
      slice?.owners?.includes(user?.userId) && !slice?.is_managed_externally,
    [slice, user],
  );

  const [newSliceName, setNewSliceName] = useState(effectiveSliceName);
  const [datasetName, setDatasetName] = useState(datasource?.name || '');
  const [action, setAction] = useState<SaveActionType>(
    canOverwriteSlice() ? 'overwrite' : 'saveas',
  );
  const [isLoading, setIsLoading] = useState(false);

  // Update slice name when it changes in Redux state
  useEffect(() => {
    if (currentSliceName && currentSliceName !== newSliceName) {
      setNewSliceName(currentSliceName);
    }
  }, [currentSliceName, newSliceName]);

  const handleSliceNameChange = useCallback((event: any) => {
    setNewSliceName(event.target.value);
  }, []);

  const handleDatasetNameChange = useCallback((event: any) => {
    setDatasetName(event.target.value);
  }, []);

  const handleActionChange = useCallback((newAction: SaveActionType) => {
    setAction(newAction);
  }, []);

  const saveOrOverwrite = useCallback(async () => {
    setIsLoading(true);

    try {
      // Handle dataset saving for query type datasources
      if (datasource?.type === DatasourceType.Query) {
        const { schema, sql, database, templateParams } = datasource;
        await actions.saveDataset({
          schema,
          sql,
          database,
          templateParams,
          datasourceName: datasetName,
        });
      }

      // Prepare form data
      const formData = form_data || {};
      delete formData.url_params;

      // Get existing chart dashboards when overwriting to preserve associations
      let sliceDashboards: number[] = [];
      if (slice && action === 'overwrite') {
        try {
          sliceDashboards = await actions.getSliceDashboards(slice);
        } catch (error) {
          sliceDashboards = [];
        }
      }

      // Set form data in Redux
      actions.setFormData({ ...formData });

      // Create or update slice
      let result: { id: number };
      if (action === 'overwrite') {
        result = await actions.updateSlice(
          slice,
          newSliceName,
          sliceDashboards, // Preserve existing dashboard associations
          null, // No new dashboard being added in portable explore
          dashboardExploreSliceId, // Pass original slice ID for portable explore editing
        );
      } else {
        result = await actions.createSlice(
          newSliceName,
          [], // No dashboard associations for new charts in portable explore
          null, // No dashboard being added in portable explore
        );
      }

      // Call the completion callback with appropriate chart ID
      const chartId =
        action === 'overwrite' && dashboardExploreSliceId
          ? dashboardExploreSliceId // For editing existing charts, use original ID
          : result.id; // For new charts, use returned ID

      if (onSaveComplete && chartId) {
        onSaveComplete(chartId, action === 'overwrite');
      }

      setIsLoading(false);
      onHide();
    } catch (error) {
      addDangerToast(
        t('An error occurred while saving the chart. Please try again.'),
      );
      setIsLoading(false);
    }
  }, [
    action,
    actions,
    addDangerToast,
    datasetName,
    datasource,
    form_data,
    newSliceName,
    onHide,
    onSaveComplete,
    slice,
  ]);

  const renderSaveChartModal = () => (
    <Form data-test="save-modal-body" layout="vertical">
      <FormItem data-test="radio-group">
        <Radio
          id="overwrite-radio"
          disabled={!canOverwriteSlice()}
          checked={action === 'overwrite'}
          onChange={() => handleActionChange('overwrite')}
          data-test="save-overwrite-radio"
        >
          {t('Save (Overwrite)')}
        </Radio>
        <Radio
          id="saveas-radio"
          data-test="saveas-radio"
          checked={action === 'saveas'}
          onChange={() => handleActionChange('saveas')}
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
          onChange={handleSliceNameChange}
          data-test="new-chart-name"
        />
      </FormItem>
      {datasource?.type === 'query' && (
        <FormItem label={t('Dataset Name')} required>
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
        id="btn_modal_save"
        buttonSize="small"
        buttonStyle="primary"
        onClick={saveOrOverwrite}
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

export default SaveModalPortable;
