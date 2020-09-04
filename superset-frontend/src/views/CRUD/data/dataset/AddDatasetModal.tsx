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
import React, { FunctionComponent, useState } from 'react';
import { styled, SupersetClient, t } from '@superset-ui/core';
import { isEmpty, isNil } from 'lodash';
import Icon from 'src/components/Icon';
import Modal from 'src/components/Modal';
import TableSelector from 'src/components/TableSelector';
import withToasts from 'src/messageToasts/enhancers/withToasts';
import { createErrorHandler } from 'src/views/CRUD/utils';

type DatasetAddObject = {
  id: number;
  databse: number;
  schema: string;
  table_name: string;
};
interface DatasetModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onDatasetAdd?: (dataset: DatasetAddObject) => void;
  onHide: () => void;
  show: boolean;
}

const StyledIcon = styled(Icon)`
  margin: auto ${({ theme }) => theme.gridUnit * 2}px auto 0;
`;

const TableSelectorContainer = styled.div`
  .TableSelector {
    padding-bottom: 340px;
    width: 65%;
  }
`;

const DatasetModal: FunctionComponent<DatasetModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onDatasetAdd,
  onHide,
  show,
}) => {
  const [currentSchema, setSchema] = useState('');
  const [currentTableName, setTableName] = useState('');
  const [datasourceId, setDatasourceId] = useState<number | null>(null);
  const [disableSave, setDisableSave] = useState(true);

  const onChange = ({
    dbId,
    schema,
    tableName,
  }: {
    dbId: number;
    schema: string;
    tableName: string;
  }) => {
    setDatasourceId(dbId);
    setDisableSave(isNil(dbId) || isEmpty(tableName));
    setSchema(schema);
    setTableName(tableName);
  };

  const onSave = () => {
    SupersetClient.post({
      endpoint: '/api/v1/dataset/',
      body: JSON.stringify({
        database: datasourceId,
        ...(currentSchema ? { schema: currentSchema } : {}),
        table_name: currentTableName,
      }),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(({ json = {} }) => {
        if (onDatasetAdd) {
          onDatasetAdd({ id: json.id, ...json.result });
        }
        addSuccessToast(t('The dataset has been saved'));
        onHide();
      })
      .catch(
        createErrorHandler((errMsg: unknown) =>
          addDangerToast(
            t(
              'Error while saving dataset: %s',
              (errMsg as { table_name?: string }).table_name,
            ),
          ),
        ),
      );
  };

  return (
    <Modal
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={onHide}
      primaryButtonName={t('Add')}
      show={show}
      title={
        <>
          <StyledIcon name="warning" />
          {t('Add Dataset')}
        </>
      }
    >
      <TableSelectorContainer>
        <TableSelector
          clearable={false}
          dbId={datasourceId}
          formMode
          handleError={addDangerToast}
          onChange={onChange}
          schema={currentSchema}
          sqlLabMode={false}
          tableName={currentTableName}
        />
      </TableSelectorContainer>
    </Modal>
  );
};

export default withToasts(DatasetModal);
