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
import React, { FunctionComponent, useState, useRef } from 'react';
import { Alert } from 'react-bootstrap';
import Button from 'src/components/Button';
import { styled, t, SupersetClient } from '@superset-ui/core';

import Modal from 'src/common/components/Modal';
import AsyncEsmComponent from 'src/components/AsyncEsmComponent';
import { isFeatureEnabled, FeatureFlag } from 'src/featureFlags';

import { getClientErrorObject } from 'src/utils/getClientErrorObject';
import withToasts from 'src/messageToasts/enhancers/withToasts';

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

function buildMetricExtraJsonObject(metric: Record<string, unknown>) {
  if (metric?.certified_by || metric?.certification_details) {
    return JSON.stringify({
      certification: {
        certified_by: metric?.certified_by ?? null,
        details: metric?.certification_details ?? null,
      },
    });
  }
  return null;
}

const DatasourceModal: FunctionComponent<DatasourceModalProps> = ({
  addSuccessToast,
  datasource,
  onDatasourceSave,
  onHide,
  show,
}) => {
  const [currentDatasource, setCurrentDatasource] = useState(datasource);
  const [errors, setErrors] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const dialog = useRef<any>(null);
  const [modal, contextHolder] = Modal.useModal();

  const onConfirmSave = () => {
    // Pull out extra fields into the extra object
    const schema =
      currentDatasource.tableSelector?.schema ||
      currentDatasource.databaseSelector?.schema ||
      currentDatasource.schema;

    setIsSaving(true);

    SupersetClient.post({
      endpoint: '/datasource/save/',
      postPayload: {
        data: {
          ...currentDatasource,
          schema,
          metrics: currentDatasource?.metrics?.map(
            (metric: Record<string, unknown>) => ({
              ...metric,
              extra: buildMetricExtraJsonObject(metric),
            }),
          ),
          type: currentDatasource.type || currentDatasource.datasource_type,
        },
      },
    })
      .then(({ json }) => {
        addSuccessToast(t('The dataset has been saved'));
        onDatasourceSave(json);
        onHide();
      })
      .catch(response => {
        setIsSaving(false);
        getClientErrorObject(response).then(({ error }) => {
          modal.error({
            title: 'Error',
            content: error || t('An error has occurred'),
            okButtonProps: { danger: true, className: 'btn-danger' },
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

  const closeDialog = () => {
    dialog.current?.destroy();
  };

  const renderSaveDialog = () => (
    <div>
      <Alert bsStyle="warning" className="pointer" onClick={closeDialog}>
        <div>
          <i className="fa fa-exclamation-triangle" />{' '}
          {t(`The dataset configuration exposed here
                affects all the charts using this dataset.
                Be mindful that changing settings
                here may affect other charts
                in undesirable ways.`)}
        </div>
      </Alert>
      {t('Are you sure you want to save and apply changes?')}
    </div>
  );

  const onClickSave = () => {
    dialog.current = modal.confirm({
      title: t('Confirm save'),
      content: renderSaveDialog(),
      onOk: onConfirmSave,
      icon: null,
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
      footer={
        <>
          {isFeatureEnabled(FeatureFlag.ENABLE_REACT_CRUD_VIEWS) && (
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
            disabled={isSaving || errors.length > 0}
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
      />
      {contextHolder}
    </StyledDatasourceModal>
  );
};

export default withToasts(DatasourceModal);
