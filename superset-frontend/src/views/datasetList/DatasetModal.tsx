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
import React from 'react';
import styled from '@superset-ui/style';
import { SupersetClient } from '@superset-ui/connection';
import { t } from '@superset-ui/translation';
import { isEmpty, isNil } from 'lodash';
import Icon from 'src/components/Icon';
import TableSelector from 'src/components/TableSelector';
import Modal from './Modal';
import withToasts from '../../messageToasts/enhancers/withToasts';

interface DatasetModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onHide: () => void;
  show: boolean;
}

interface DatasetModalState {
  datasourceId?: number;
  disableSave: boolean;
  schema: string;
  tableName: string;
}

const StyledIcon = styled(Icon)`
  margin: auto 10px auto 0;
`;

class DatasetModal extends React.PureComponent<
  DatasetModalProps,
  DatasetModalState
> {
  constructor(props: DatasetModalProps) {
    super(props);
    this.onSave = this.onSave.bind(this);
    this.onChange = this.onChange.bind(this);
  }

  state: DatasetModalState = {
    datasourceId: undefined,
    disableSave: true,
    schema: '',
    tableName: '',
  };

  onChange({
    dbId,
    schema,
    tableName,
  }: {
    dbId: number;
    schema: string;
    tableName: string;
  }) {
    const disableSave = isNil(dbId) || isEmpty(schema) || isEmpty(tableName);
    this.setState({
      datasourceId: dbId,
      disableSave,
      schema,
      tableName,
    });
  }

  onSave() {
    const { datasourceId, schema, tableName } = this.state;
    const data = { database: datasourceId, schema, table_name: tableName };
    SupersetClient.post({
      endpoint: '/api/v1/dataset/',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(() => {
        this.props.addSuccessToast(t('The dataset has been saved'));
        this.props.onHide();
      })
      .catch(e => {
        this.props.addDangerToast(t('Error while saving dataset'));
        console.error(e);
      });
  }

  render() {
    return (
      <Modal
        disableSave={this.state.disableSave}
        onHide={this.props.onHide}
        onSave={this.onSave}
        show={this.props.show}
        title={
          <>
            <StyledIcon name="warning" />
            {t('Add Dataset')}
          </>
        }
      >
        <TableSelector
          clearable={false}
          dbId={this.state.datasourceId}
          formMode
          handleError={this.props.addDangerToast}
          onChange={this.onChange}
          schema={this.state.schema}
          sqlLabMode={false}
          tableName={this.state.tableName}
        />
      </Modal>
    );
  }
}

export default withToasts(DatasetModal);
