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
import { FunctionComponent, useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  styled,
  SupersetClient,
  getClientErrorObject,
  t,
  SupersetError,
  useTheme,
  css,
} from '@superset-ui/core';

import {
  Icons,
  Alert,
  Button,
  Checkbox,
  Modal,
  AsyncEsmComponent,
} from '@superset-ui/core/components';
import withToasts from 'src/components/MessageToasts/withToasts';
import { ErrorMessageWithStackTrace } from 'src/components';
import type { DatasetObject } from 'src/features/datasets/types';
import type { DatasourceModalProps } from './types';

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

  .ant-tabs-top {
    margin-top: -${({ theme }) => theme.sizeUnit * 4}px;
  }
`;

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
  datasource,
  onDatasourceSave,
  onHide,
  show,
}) => {
  const theme = useTheme();
  const [currentDatasource, setCurrentDatasource] = useState(datasource);
  const [syncColumns, setSyncColumns] = useState(false);
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
  const [modal, contextHolder] = Modal.useModal();
  const buildPayload = (datasource: Record<string, any>) => {
    const payload: Record<string, any> = {
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
      metrics: datasource?.metrics?.map(
        (metric: DatasetObject['metrics'][0]) => {
          const metricBody: any = {
            expression: metric.expression,
            description: metric.description,
            metric_name: metric.metric_name,
            metric_type: metric.metric_type,
            d3format: metric.d3format || null,
            currency: metric.currency,
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
    };
    // Handle catalog based on database's allow_multi_catalog setting
    // If multi-catalog is disabled, don't include catalog in payload
    // The backend will use the default catalog
    // If multi-catalog is enabled, include the selected catalog
    if (datasource.database?.allow_multi_catalog) {
      payload.catalog = datasource.catalog;
    }
    return payload;
  };
  const onConfirmSave = async () => {
    // Pull out extra fields into the extra object
    setIsSaving(true);
    try {
      await SupersetClient.put({
        endpoint: `/api/v1/dataset/${currentDatasource.id}?override_columns=${syncColumns}`,
        jsonPayload: buildPayload(currentDatasource),
      });

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

  const getSaveDialog = useCallback(
    () => (
      <div>
        <Alert
          css={theme => ({
            marginTop: theme.marginMD,
            marginBottom: theme.marginSM,
          })}
          type="warning"
          showIcon={false}
          message={t(`The dataset configuration exposed here
                affects all the charts using this dataset.
                Be mindful that changing settings
                here may affect other charts
                in undesirable ways.`)}
        />
        {datasource.sql !== currentDatasource.sql && (
          <div
            css={theme => ({
              marginBottom: theme.marginMD,
            })}
          >
            <Alert
              css={theme => ({
                marginBottom: theme.marginSM,
              })}
              type="info"
              showIcon={false}
              message={t(`The dataset columns will be automatically synced
              based on the changes in your SQL query. If your changes don't
              impact the column definitions, you might want to skip this step.`)}
            />
            <Checkbox
              checked={syncColumns}
              onChange={() => {
                setSyncColumns(!syncColumns);
              }}
            />
            <span
              css={theme => ({
                marginLeft: theme.marginXS,
              })}
            >
              {t('Automatically sync columns')}
            </span>
          </div>
        )}
        {t('Are you sure you want to save and apply changes?')}
      </div>
    ),
    [currentDatasource.sql, datasource.sql, syncColumns],
  );

  useEffect(() => {
    if (datasource.sql !== currentDatasource.sql) {
      setSyncColumns(true);
    }
  }, [datasource.sql, currentDatasource.sql]);

  const onClickSave = () => {
    modal.confirm({
      title: t('Confirm save'),
      content: getSaveDialog(),
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
          <Icons.EditOutlined
            iconSize="l"
            css={css`
              margin: auto ${theme.sizeUnit * 2}px auto 0;
            `}
            data-test="edit-alt"
          />
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
            buttonStyle="secondary"
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
