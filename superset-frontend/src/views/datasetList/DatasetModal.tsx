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
import Icon from 'src/components/Icon';
import Select from 'src/components/Select';
import Modal from './Modal';

import withToasts from '../../messageToasts/enhancers/withToasts';

type option = {
  label: string;
  value: string;
};

interface Props {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onChange: any;
  onDatasourceSave: any;
  onHide: any;
  show: boolean;
}

interface State {
  datasource: option;
  datasources: Array<option>;
  disableSave: boolean;
  disableSelectSchema: boolean;
  disableSelectTable: boolean;
  schema: option;
  schemaLoading: boolean;
  schemas: Array<option>;
  table: option;
  tableLoading: boolean;
  tables: Array<option>;
}

const FieldTitle = styled.p`
  color: ${({ theme }) => theme.colors.secondary.light2};
  font-size: ${({ theme }) => theme.typography.sizes.s};
  margin: 20px 0 10px 0;
  text-transform: uppercase;
`;

const StyledIcon = styled(Icon)`
  margin: auto 10px auto 0;
`;

class DatasetModal extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.onDatabaseChange = this.onDatabaseChange.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onSchemaChange = this.onSchemaChange.bind(this);
    this.onTableChange = this.onTableChange.bind(this);
    this.renderFields = this.renderFields.bind(this);
    this.renderTitle = this.renderTitle.bind(this);
  }

  state: State = {
    datasource: { label: 'Select Datasource', value: 'Select Datasource' },
    datasources: [],
    disableSave: true,
    disableSelectSchema: true,
    disableSelectTable: true,
    schema: { label: 'Select Schema', value: 'Select Schema' },
    schemaLoading: false,
    schemas: [],
    table: { label: 'Select Table', value: 'Select Table' },
    tableLoading: false,
    tables: [],
  };

  componentDidMount() {
    this.fetchDatabase();
  }

  onDatabaseChange(datasource: option) {
    this.setState({
      disableSave: true,
      disableSelectSchema: true,
      disableSelectTable: true,
      schemas: [],
      tables: [],
    });
    this.fetchSchemas(`${datasource.value}`);
    this.setState({
      datasource,
      schema: { label: 'Select Schema', value: 'Select Schema' },
      table: { label: 'Select Table', value: 'Select Table' },
    });
  }

  onSchemaChange(schema: option) {
    this.setState({ tables: [], disableSelectTable: true, disableSave: true });
    this.fetchTables(`${schema.value}`);
    this.setState({ schema });
  }

  onTableChange(table: option) {
    const { disableSelectSchema, disableSelectTable } = this.state;
    const disableSave = disableSelectSchema || disableSelectTable;
    this.setState({ table, disableSave });
  }

  onSave() {
    const { datasource, schema, table } = this.state;
    const { onHide, addSuccessToast, addDangerToast } = this.props;
    const data = {
      database: datasource.value,
      schema: schema.value,
      table_name: table.label,
    };

    SupersetClient.post({
      endpoint: '/api/v1/dataset/',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      parseMethod: 'text',
    })
      .then(() => {
        addSuccessToast(t('The dataset has been saved'));
        onHide();
      })
      .catch(e => {
        addDangerToast(t('Error while saving dataset'));
        if (e) {
          console.error(e);
        }
      });
  }

  fetchDatabase() {
    SupersetClient.get({
      endpoint: `/api/v1/dataset/related/database`,
    })
      .then(({ json: datasourcesJson = {} }) => {
        const datasources = datasourcesJson.result.map(
          ({ text, value }: { text: string; value: number }) => ({
            label: text,
            value: `${value}`,
          }),
        );
        this.setState({ datasources });
      })
      .catch(e => {
        this.props.addDangerToast(
          t('An error occurred while fetching datasources'),
        );
        if (e) {
          console.error(e);
        }
      });
  }

  fetchSchemas(datasourceId: string) {
    if (datasourceId) {
      this.setState({ schemaLoading: true });
      const endpoint = `/superset/schemas/${datasourceId}/false/`;
      SupersetClient.get({ endpoint })
        .then(({ json: schemaJson = {} }) => {
          const schemas = schemaJson.schemas.map((s: string) => ({
            value: s,
            label: s,
          }));
          this.setState({
            disableSelectSchema: false,
            schemaLoading: false,
            schemas,
          });
        })
        .catch(e => {
          this.setState({ schemaLoading: false, schemas: [] });
          this.props.addDangerToast(t('Error while fetching schema list'));
          if (e) {
            console.error(e);
          }
        });
    }
  }

  fetchTables(schema: string) {
    const { datasource } = this.state;

    if (datasource && schema) {
      this.setState(() => ({ tableLoading: true, tables: [] }));
      const endpoint = encodeURI(
        `/superset/tables/${datasource.value}/` +
          `${encodeURIComponent(schema)}/undefined/false/`,
      );
      SupersetClient.get({ endpoint })
        .then(({ json: tableJson = {} }) => {
          const options = tableJson.options.map((o: option) => ({
            value: o.value,
            label: o.label,
          }));
          this.setState(() => ({
            disableSelectTable: false,
            tableLoading: false,
            tables: options,
          }));
        })
        .catch(e => {
          this.setState(() => ({ tableLoading: false, tables: [] }));
          this.props.addDangerToast(t('Error while fetching table list'));
          if (e) {
            console.error(e);
          }
        });
    }
  }

  renderFields() {
    const {
      datasource,
      datasources,
      disableSelectSchema,
      disableSelectTable,
      schema,
      schemaLoading,
      schemas,
      table,
      tableLoading,
      tables,
    } = this.state;
    const { onDatabaseChange, onSchemaChange, onTableChange } = this;

    return (
      <>
        <FieldTitle>{t('datasource')}</FieldTitle>
        <Select
          clearable={false}
          ignoreAccents={false}
          name="select-datasource"
          onChange={onDatabaseChange}
          options={datasources}
          placeholder={t('Select Datasource')}
          value={datasource}
          width={500}
        />
        <FieldTitle>{t('schema')}</FieldTitle>
        <Select
          clearable={false}
          ignoreAccents={false}
          isDisabled={disableSelectSchema}
          isLoading={schemaLoading}
          name="select-schema"
          onChange={onSchemaChange}
          options={schemas}
          placeholder={t('Select Schema')}
          value={schema}
          width={500}
        />
        <FieldTitle>{t('table')}</FieldTitle>
        <Select
          clearable={false}
          ignoreAccents={false}
          isDisabled={disableSelectTable}
          isLoading={tableLoading}
          name="select-table"
          onChange={onTableChange}
          options={tables}
          placeholder={t('Select Table')}
          value={table}
          width={500}
        />
      </>
    );
  }

  renderTitle() {
    return (
      <>
        <StyledIcon name="warning" />
        {t('Add Dataset')}
      </>
    );
  }

  render() {
    const { disableSave } = this.state;
    const { show, onHide } = this.props;
    const { onSave, renderFields, renderTitle } = this;
    return (
      <Modal
        disableSave={disableSave}
        onHide={onHide}
        onSave={onSave}
        show={show}
        title={renderTitle()}
      >
        {renderFields()}
      </Modal>
    );
  }
}

export default withToasts(DatasetModal);
