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
import React, { FunctionComponent, useState, useCallback } from 'react';
import { t, styled } from '@superset-ui/core';
import Button from 'src/components/Button';
import {
  FlashServiceObject,
  FlashUpdateQuery,
} from 'src/views/CRUD/flash/types';
import Modal from 'src/components/Modal';
import { createErrorHandler } from 'src/views/CRUD/utils';
import Editor from '@monaco-editor/react';
import withToasts from 'src/components/MessageToasts/withToasts';
import { UPDATE_TYPES } from '../../constants';
import { updateFlash, validateSqlQuery } from '../../services/flash.service';

interface FlashQueryButtonProps {
  flash: FlashServiceObject;
  show: boolean;
  onHide: () => void;
  refreshData: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const StyledModal = styled(Modal)`
  .ant-modal-content {
  }

  .ant-modal-body {
    padding: 24px;
  }

  pre {
    font-size: ${({ theme }) => theme.typography.sizes.xs}px;
    font-weight: ${({ theme }) => theme.typography.weights.normal};
    line-height: ${({ theme }) => theme.typography.sizes.l}px;
    height: 375px;
    border: none;
  }
`;

const FlashQuery: FunctionComponent<FlashQueryButtonProps> = ({
  flash,
  onHide,
  show,
  refreshData,
  addDangerToast,
  addSuccessToast,
}) => {
  const [formData, setFormData] = useState<FlashUpdateQuery>({
    sqlQuery: flash?.sqlQuery,
  });

  const handleEditorChange = (value: string) => {
    const formValues = { ...formData };
    formValues.sqlQuery = value || flash?.sqlQuery;
    setFormData(formValues);
  };

  const handleEditorValidation = (markers: any) => {
    markers.forEach((marker: any) =>
      console.log('onValidate:', marker.message),
    );
  };

  const onFlashUpdation = (formData: FlashUpdateQuery) => {
    const payload = { ...formData };
    validateQueryService(payload.sqlQuery);
  };

  const flashSqlQueryService = useCallback(
    (id, type, payload) => {
      updateFlash(id, type, payload).then(
        () => {
          addSuccessToast(t('Your sql query has been modified.'));
          onHide();
          refreshData();
        },
        createErrorHandler(errMsg =>
          addDangerToast(
            t(
              'There was an issue updating the sql query of the Flash %s',
              errMsg,
            ),
          ),
        ),
      );
    },
    [addSuccessToast, addDangerToast],
  );

  const validateQueryService = (sql: string): Promise<any> => {
    let payload = {
      sql: sql,
    };
    return validateSqlQuery(payload)
      .then(({ data }) => {
        if (Boolean(data.valid) === true) {
          flashSqlQueryService(Number(flash?.id), UPDATE_TYPES.SQL, payload);
        } else {
          addDangerToast(t('Please Add a valid Sql Query', data.message));
        }
      })
      .catch(error => {
        addDangerToast(t(error?.data?.message));
      });
  };
  const renderModalBody = () => (
    <div>
      <Editor
        height="40vh"
        defaultLanguage="sql"
        defaultValue={flash?.sqlQuery}
        value={formData?.sqlQuery}
        onChange={handleEditorChange}
        onValidate={handleEditorValidation}
        saveViewState
      />
    </div>
  );

  return (
    <div role="none">
      <StyledModal
        draggable
        onHide={onHide}
        show={show}
        title={t('Update SQL Query')}
        footer={
          <>
            <Button
              data-test="sql-query-update"
              key="sql-query-update"
              buttonStyle="primary"
              onClick={() => onFlashUpdation(formData)}
            >
              {t('Update')}
            </Button>
          </>
        }
      >
        {renderModalBody()}
      </StyledModal>
    </div>
  );
};

export default withToasts(FlashQuery);
