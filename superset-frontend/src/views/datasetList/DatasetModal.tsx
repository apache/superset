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
import styled from '@superset-ui/style';
import { SupersetClient } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';
import { isEmpty, isNil } from 'lodash';
import Icon from 'src/components/Icon';
import TableSelector from 'src/components/TableSelector';
import Modal from 'src/components/Modal';
import withToasts from '../../messageToasts/enhancers/withToasts';

interface DatasetModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onHide: () => void;
  show: boolean;
}

const StyledIcon = styled(Icon)`
  margin: auto 10px auto 0;
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
  onHide,
  show,
}) => {
  const [datasourceId, setDatasourceId] = useState<number | null>(null);
  const [disableSave, setDisableSave] = useState(true);
  const [currentSchema, setSchema] = useState('');
  const [currentTableName, setTableName] = useState('');

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
    setDisableSave(isNil(dbId) || isEmpty(schema) || isEmpty(tableName));
    setSchema(schema);
    setTableName(tableName);
  };

  const onSave = () => {
    const data = {
      database: datasourceId,
      schema: currentSchema,
      table_name: currentTableName,
    };
    SupersetClient.post({
      endpoint: '/api/v1/dataset/',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(() => {
        addSuccessToast(t('The dataset has been saved'));
        onHide();
      })
      .catch(e => {
        addDangerToast(t('Error while saving dataset'));
        console.error(e);
      });
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
