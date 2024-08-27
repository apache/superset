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
import Alert from 'src/components/Alert';
import Button from 'src/components/Button';
import {
  FeatureFlag,
  isDefined,
  isFeatureEnabled,
  Metric,
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
import { useSelector } from 'react-redux';

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
  datasource: any;
  onChange: () => {};
  onDatasourceSave: (datasource: object, errors?: Array<any>) => {};
  onHide: () => {};
  show: boolean;
}

function buildExtraJsonObject(item: Record<string, unknown>) {
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
  datasource,
  onDatasourceSave,
  onHide,
  show,
}) => {
  const [currentDatasource, setCurrentDatasource] = useState({
    ...datasource,
    metrics: datasource?.metrics?.map((metric: Metric) => ({
      ...metric,
      currency: JSON.parse(metric.currency || 'null'),
    })),
  });
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

  const onConfirmSave = () => {
    // Pull out extra fields into the extra object
    const schema =
      currentDatasource.tableSelector?.schema ||
      currentDatasource.databaseSelector?.schema ||
      currentDatasource.schema;

    setIsSaving(true);
    SupersetClient.put({
      endpoint: `/api/v1/dataset/${currentDatasource.id}`,
      jsonPayload: {
        table_name: currentDatasource.table_name,
        database_id: currentDatasource.database?.id,
        sql: currentDatasource.sql,
        filter_select_enabled: currentDatasource.filter_select_enabled,
        fetch_values_predicate: currentDatasource.fetch_values_predicate,
        schema,
        description: currentDatasource.description,
        main_dttm_col: currentDatasource.main_dttm_col,
        normalize_columns: currentDatasource.normalize_columns,
        always_filter_main_dttm: currentDatasource.always_filter_main_dttm,
        offset: currentDatasource.offset,
        default_endpoint: currentDatasource.default_endpoint,
        cache_timeout:
          currentDatasource.cache_timeout === ''
            ? null
            : currentDatasource.cache_timeout,
        is_sqllab_view: currentDatasource.is_sqllab_view,
        template_params: currentDatasource.template_params,
        extra: currentDatasource.extra,
        is_managed_externally: currentDatasource.is_managed_externally,
        external_url: currentDatasource.external_url,
        metrics: currentDatasource?.metrics?.map(
          (metric: Record<string, unknown>) => {
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
          },
        ),
        columns: currentDatasource?.columns?.map(
          (column: Record<string, unknown>) => ({
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
        owners: currentDatasource.owners.map(
          (o: Record<string, number>) => o.value || o.id,
        ),
      },
    })
      .then(() => {
        addSuccessToast(t('The dataset has been saved'));
        return SupersetClient.get({
          endpoint: `/api/v1/dataset/${currentDatasource?.id}`,
        });
      })
      .then(({ json }) => {
        // eslint-disable-next-line no-param-reassign
        json.result.type = 'table';
        onDatasourceSave({
          ...json.result,
          owners: currentDatasource.owners,
        });
        onHide();
      })
      .catch(response => {
        setIsSaving(false);
        getClientErrorObject(response).then(error => {
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
        });
      });
  };

  const onDatasourceChange = (data: Record<string, any>, err: Array<any>) => {
    setCurrentDatasource({
      ...data,
      metrics: data?.metrics.map((metric: Record<string, unknown>) => ({
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

  const showLegacyDatasourceEditor = !isFeatureEnabled(
    FeatureFlag.DisableLegacyDatasourceEditor,
  );

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
          {showLegacyDatasourceEditor && (
            <Button
              buttonSize="small"
              buttonStyle="default"
              data-test="datasource-modal-legacy-edit"
              className="m-r-5"
              onClick={() => {
                window.location.href =
                  currentDatasource.edit_url || currentDatasource.url;
              }}
            >
              {t('Use legacy datasource editor')}
            </Button>
          )}
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
