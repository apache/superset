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
import { Alert, Modal } from 'react-bootstrap';
import Button from 'src/components/Button';
import Dialog from 'react-bootstrap-dialog';
import { styled, t, SupersetClient } from '@superset-ui/core';
import AsyncEsmComponent from 'src/components/AsyncEsmComponent';

import getClientErrorObject from 'src/utils/getClientErrorObject';
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
  const dialog = useRef<any>(null);

  const onConfirmSave = () => {
    // Pull out extra fields into the extra object

    SupersetClient.post({
      endpoint: '/datasource/save/',
      postPayload: {
        data: {
          ...currentDatasource,
          schema:
            currentDatasource.databaseSelector?.schema ||
            currentDatasource.tableSelector?.schema,
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
      .catch(response =>
        getClientErrorObject(response).then(({ error }) => {
          dialog.current.show({
            title: 'Error',
            bsSize: 'medium',
            bsStyle: 'danger',
            actions: [Dialog.DefaultAction('Ok', () => {}, 'btn-danger')],
            body: error || t('An error has occurred'),
          });
        }),
      );
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
        bsStyle="warning"
        className="pointer"
        onClick={dialog.current.hideAlert}
      >
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
    dialog.current.show({
      title: t('Confirm save'),
      bsSize: 'medium',
      actions: [Dialog.CancelAction(), Dialog.OKAction(onConfirmSave)],
      body: renderSaveDialog(),
    });
  };

  return (
    <StyledDatasourceModal show={show} onHide={onHide} bsSize="large">
      <Modal.Header closeButton>
        <Modal.Title>
          <div>
            <span className="float-left">
              {t('Edit Dataset ')}
              <strong>{currentDatasource.table_name}</strong>
            </span>
          </div>
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {show && (
          <DatasourceEditor
            showLoadingForImport
            height={500}
            datasource={currentDatasource}
            onChange={onDatasourceChange}
          />
        )}
      </Modal.Body>
      <Modal.Footer>
        <span className="float-left">
          <Button
            buttonSize="sm"
            buttonStyle="default"
            target="_blank"
            href={currentDatasource.edit_url || currentDatasource.url}
          >
            {t('Use Legacy Datasource Editor')}
          </Button>
        </span>

        <span className="float-right">
          <Button
            buttonSize="sm"
            buttonStyle="primary"
            className="m-r-5"
            data-test="datasource-modal-save"
            onClick={onClickSave}
            disabled={errors.length > 0}
          >
            {t('Save')}
          </Button>
          <Button buttonSize="sm" onClick={onHide}>
            {t('Cancel')}
          </Button>
          <Dialog ref={dialog} />
        </span>
      </Modal.Footer>
    </StyledDatasourceModal>
  );
};

export default withToasts(DatasourceModal);
