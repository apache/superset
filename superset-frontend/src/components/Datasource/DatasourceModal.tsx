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
import { FunctionComponent, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Alert from 'src/components/Alert';
import Button from 'src/components/Button';
import {
  isDefined,
  styled,
  SupersetClient,
  getClientErrorObject,
  t,
  SupersetError,
} from '@superset-ui/core';

import Modal from 'src/components/Modal';
import AsyncEsmComponent from 'src/components/AsyncEsmComponent';
import ErrorMessageWithStackTrace from 'src/components/ErrorMessage/ErrorMessageWithStackTrace';
import withToasts from 'src/components/MessageToasts/withToasts';
import {
  startMetaDataLoading,
  stopMetaDataLoading,
  syncDatasourceMetadata,
} from 'src/explore/actions/exploreActions';
import {
  fetchSyncedColumns,
  updateColumns,
} from 'src/components/Datasource/utils';
import { DatasetObject } from '../../features/datasets/types';

const DatasourceEditor = AsyncEsmComponent(() => import('./DatasourceEditor'));

const StyledDatasourceModal = styled(Modal)`
  .modal-content {
    height: 900px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
  }

  .modal-header {
    flex: 0 1 auto;
  }
  .modal-body {
    flex: 1 1 auto;
    overflow: auto;
  }

  .modal-footer {
    flex: 0 1 auto;
  }
`;

interface DatasourceModalProps {
  addSuccessToast: (msg: string) => void;
  addDangerToast: (msg: string) => void;
  datasource: DatasetObject;
  onChange: () => {};
  onDatasourceSave: (datasource: object, errors?: Array<any>) => {};
  onHide: () => {};
  show: boolean;
}

function buildExtraJsonObject(
  item: DatasetObject['metrics'][0] | DatasetObject['columns'][0],
) {
  const certification =
    item?.certified_by || item?.certification_details
      ? {
          certified_by: item?.certified_by,
          details: item?.certification_details,
        }
      : undefined;
  return JSON.stringify({
    certification,
    warning_markdown: item?.warning_markdown,
  });
}

const DatasourceModal: FunctionComponent<DatasourceModalProps> = ({
  addSuccessToast,
  addDangerToast,
  datasource,
  onDatasourceSave,
  onHide,
  show,
}) => {
  const dispatch = useDispatch();
  const [currentDatasource, setCurrentDatasource] = useState(datasource);
  const currencies = useSelector<
    {
      common: {
        currencies: string[];
      };
    },
    string[]
  >(state => state.common?.currencies);
  const [errors, setErrors] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const dialog = useRef<any>(null);
  const [modal, contextHolder] = Modal.useModal();
  const buildPayload = (datasource: Record<string, any>) => ({
    table_name: datasource.table_name,
    database_id: datasource.database?.id,
    sql: datasource.sql,
    filter_select_enabled: datasource.filter_select_enabled,
    fetch_values_predicate: datasource.fetch_values_predicate,
    schema:
      datasource.tableSelector?.schema ||
      datasource.databaseSelector?.schema ||
      datasource.schema,
    description: datasource.description,
    main_dttm_col: datasource.main_dttm_col,
    normalize_columns: datasource.normalize_columns,
    always_filter_main_dttm: datasource.always_filter_main_dttm,
    offset: datasource.offset,
    default_endpoint: datasource.default_endpoint,
    cache_timeout:
      datasource.cache_timeout === '' ? null : datasource.cache_timeout,
    is_sqllab_view: datasource.is_sqllab_view,
    template_params: datasource.template_params,
    extra: datasource.extra,
    is_managed_externally: datasource.is_managed_externally,
    external_url: datasource.external_url,
    metrics: datasource?.metrics?.map((metric: DatasetObject['metrics'][0]) => {
      const metricBody: any = {
        expression: metric.expression,
        description: metric.description,
        metric_name: metric.metric_name,
        metric_type: metric.metric_type,
        d3format: metric.d3format || null,
        currency: !isDefined(metric.currency)
          ? null
          : JSON.stringify(metric.currency),
        verbose_name: metric.verbose_name,
        warning_text: metric.warning_text,
        uuid: metric.uuid,
        extra: buildExtraJsonObject(metric),
      };
      if (!Number.isNaN(Number(metric.id))) {
        metricBody.id = metric.id;
      }
      return metricBody;
    }),
    columns: datasource?.columns?.map(
      (column: DatasetObject['columns'][0]) => ({
        id: typeof column.id === 'number' ? column.id : undefined,
        column_name: column.column_name,
        type: column.type,
        advanced_data_type: column.advanced_data_type,
        verbose_name: column.verbose_name,
        description: column.description,
        expression: column.expression,
        filterable: column.filterable,
        groupby: column.groupby,
        is_active: column.is_active,
        is_dttm: column.is_dttm,
        python_date_format: column.python_date_format || null,
        uuid: column.uuid,
        extra: buildExtraJsonObject(column),
      }),
    ),
    owners: datasource.owners.map(
      (o: Record<string, number>) => o.value || o.id,
    ),
  });
  const onConfirmSave = async () => {
    // Pull out extra fields into the extra object
    setIsSaving(true);
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/dataset/${currentDatasource.id}`,
        jsonPayload: buildPayload(currentDatasource),
      });
      if (datasource.sql !== currentDatasource.sql) {
        // if sql has changed, save a second time with synced columns
        dispatch(startMetaDataLoading());
        try {
          const columnJson = await fetchSyncedColumns(currentDatasource);
          const columnChanges = updateColumns(
            currentDatasource.columns,
            columnJson,
            addSuccessToast,
          );
          currentDatasource.columns = columnChanges.finalColumns;
          dispatch(syncDatasourceMetadata(currentDatasource));
          dispatch(stopMetaDataLoading());
          addSuccessToast(t('Metadata has been synced'));
        } catch (error) {
          dispatch(stopMetaDataLoading());
          addDangerToast(
            t('An error has occurred while syncing virtual dataset columns'),
          );
        }
        await SupersetClient.put({
          endpoint: `/api/v1/dataset/${currentDatasource.id}`,
          jsonPayload: buildPayload(currentDatasource),
        });
      }
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/dataset/${currentDatasource?.id}`,
      });
      addSuccessToast(t('The dataset has been saved'));
      // eslint-disable-next-line no-param-reassign
      json.result.type = 'table';
      onDatasourceSave({
        ...json.result,
        owners: currentDatasource.owners,
      });
      onHide();
    } catch (response) {
      setIsSaving(false);
      const error = await getClientErrorObject(response);
      let errorResponse: SupersetError | undefined;
      let errorText: string | undefined;
      // sip-40 error response
      if (error?.errors?.length) {
        errorResponse = error.errors[0];
      } else if (typeof error.error === 'string') {
        // backward compatible with old error messages
        errorText = error.error;
      }
      modal.error({
        title: t('Error saving dataset'),
        okButtonProps: { danger: true, className: 'btn-danger' },
        content: (
          <ErrorMessageWithStackTrace
            error={errorResponse}
            source="crud"
            fallback={errorText}
          />
        ),
      });
    }
  };

  const onDatasourceChange = (data: DatasetObject, err: Array<any>) => {
    setCurrentDatasource({
      ...data,
      metrics: data?.metrics.map((metric: DatasetObject['metrics'][0]) => ({
        ...metric,
        is_certified: metric?.certified_by || metric?.certification_details,
      })),
    });
    setErrors(err);
  };

  const renderSaveDialog = () => (
    <div>
      <Alert
        css={theme => ({
          marginTop: theme.gridUnit * 4,
          marginBottom: theme.gridUnit * 4,
        })}
        type="warning"
        showIcon
        message={t(`The dataset configuration exposed here
                affects all the charts using this dataset.
                Be mindful that changing settings
                here may affect other charts
                in undesirable ways.`)}
      />
      {t('Are you sure you want to save and apply changes?')}
    </div>
  );

  const onClickSave = () => {
    dialog.current = modal.confirm({
      title: t('Confirm save'),
      content: renderSaveDialog(),
      onOk: onConfirmSave,
      icon: null,
      okText: t('OK'),
      cancelText: t('Cancel'),
    });
  };

  return (
    <StyledDatasourceModal
      show={show}
      onHide={onHide}
      title={
        <span>
          {t('Edit Dataset ')}
          <strong>{currentDatasource.table_name}</strong>
        </span>
      }
      maskClosable={!isEditing}
      footer={
        <>
          <Button
            data-test="datasource-modal-cancel"
            buttonSize="small"
            className="m-r-5"
            onClick={onHide}
          >
            {t('Cancel')}
          </Button>
          <Button
            buttonSize="small"
            buttonStyle="primary"
            data-test="datasource-modal-save"
            onClick={onClickSave}
            disabled={
              isSaving ||
              errors.length > 0 ||
              currentDatasource.is_managed_externally
            }
            tooltip={
              currentDatasource.is_managed_externally
                ? t(
                    "This dataset is managed externally, and can't be edited in Superset",
                  )
                : ''
            }
          >
            {t('Save')}
          </Button>
        </>
      }
      responsive
    >
      <DatasourceEditor
        showLoadingForImport
        height={500}
        datasource={currentDatasource}
        onChange={onDatasourceChange}
        setIsEditing={setIsEditing}
        currencies={currencies}
      />
      {contextHolder}
    </StyledDatasourceModal>
  );
};

export default withToasts(DatasourceModal);
