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
import React, { FunctionComponent, useState, useEffect } from 'react';
import { styled, t } from '@superset-ui/core';
import { useSingleViewResource } from 'src/views/CRUD/hooks';
import { isEmpty, isNil } from 'lodash';
import Modal from 'src/components/Modal';
import TableSelector from 'src/components/TableSelector';
import withToasts from 'src/components/MessageToasts/withToasts';

type DatasetAddObject = {
  id: number;
  database: number;
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

const TableSelectorContainer = styled.div`
  padding-bottom: 340px;
  width: 65%;
`;

const DatasetModal: FunctionComponent<DatasetModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onDatasetAdd,
  onHide,
  show,
}) => {
  const [currentSchema, setSchema] = useState<string | undefined>('');
  const [currentTableName, setTableName] = useState('');
  const [datasourceId, setDatasourceId] = useState<number>(0);
  const [disableSave, setDisableSave] = useState(true);
  const { createResource } = useSingleViewResource<Partial<DatasetAddObject>>(
    'dataset',
    t('dataset'),
    addDangerToast,
  );

  useEffect(() => {
    setDisableSave(isNil(datasourceId) || isEmpty(currentTableName));
  }, [currentTableName, datasourceId]);

  const onDbChange = (db: {
    id: number;
    database_name: string;
    backend: string;
  }) => {
    setDatasourceId(db.id);
  };

  const onSchemaChange = (schema?: string) => {
    setSchema(schema);
  };

  const onTableChange = (tableName: string) => {
    setTableName(tableName);
  };

  const onSave = () => {
    const data = {
      database: datasourceId,
      ...(currentSchema ? { schema: currentSchema } : {}),
      table_name: currentTableName,
    };
    createResource(data).then(response => {
      if (!response) {
        return;
      }
      if (onDatasetAdd) {
        onDatasetAdd({ id: response.id, ...response });
      }
      addSuccessToast(t('The dataset has been saved'));
      onHide();
    });
  };

  return (
    <Modal
      disablePrimaryButton={disableSave}
      onHandledPrimaryAction={onSave}
      onHide={onHide}
      primaryButtonName={t('Add')}
      show={show}
      title={t('Add dataset')}
    >
      <TableSelectorContainer>
        <TableSelector
          clearable={false}
          dbId={datasourceId}
          formMode
          handleError={addDangerToast}
          onDbChange={onDbChange}
          onSchemaChange={onSchemaChange}
          onTableChange={onTableChange}
          schema={currentSchema}
          tableName={currentTableName}
        />
      </TableSelectorContainer>
    </Modal>
  );
};

export default withToasts(DatasetModal);
