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

type Option = {
  label: string;
  value: string;
};

type SelectOptions = {
  isDisabled?: boolean;
  isLoading?: boolean;
  name: string;
  onChange: (arg0: Option) => void;
  options: Array<Option>;
  placeholder: string;
  title: string;
  value: Option;
};
interface DatasetModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onHide: () => void;
  show: boolean;
}

interface DatasetModalState {
  datasource: Option;
  datasourceOptions: Array<Option>;
  disableSave: boolean;
  disableSelectSchema: boolean;
  disableSelectTable: boolean;
  isSchemaLoading: boolean;
  isTableLoading: boolean;
  schema: Option;
  schemaOptions: Array<Option>;
  table: Option;
  tableOptions: Array<Option>;
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

const SelectOptions = ({
  name,
  onChange,
  options,
  placeholder,
  title,
  value,
  isDisabled,
}: SelectOptions) => (
  <>
    <FieldTitle>{title}</FieldTitle>
    <Select
      clearable={false}
      ignoreAccents={false}
      isDisabled={isDisabled}
      name={name}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      value={value}
      width={500}
    />
  </>
);

const defaultSchema = { label: t('Select Schema'), value: t('Select Schema') };
const defaultTable = { label: t('Select Table'), value: t('Select Table') };

class DatasetModal extends React.PureComponent<
  DatasetModalProps,
  DatasetModalState
> {
  constructor(props: DatasetModalProps) {
    super(props);
    this.onDatabaseChange = this.onDatabaseChange.bind(this);
    this.onSave = this.onSave.bind(this);
    this.onSchemaChange = this.onSchemaChange.bind(this);
    this.onTableChange = this.onTableChange.bind(this);
  }

  state: DatasetModalState = {
    datasource: {
      label: t('Select Datasource'),
      value: t('Select Datasource'),
    },
    datasourceOptions: [],
    disableSave: true,
    disableSelectSchema: true,
    disableSelectTable: true,
    isSchemaLoading: false,
    isTableLoading: false,
    schema: defaultSchema,
    schemaOptions: [],
    table: defaultTable,
    tableOptions: [],
  };

  componentDidMount() {
    this.fetchDatabase();
  }

  onDatabaseChange(datasource: Option) {
    this.setState({
      disableSave: true,
      disableSelectSchema: true,
      disableSelectTable: true,
      schemaOptions: [],
      tableOptions: [],
    });
    this.fetchSchemaOptions(`${datasource.value}`);
    this.setState({
      datasource,
      schema: defaultSchema,
      table: defaultTable,
    });
  }

  onSchemaChange(schema: Option) {
    this.setState({
      tableOptions: [],
      disableSelectTable: true,
      disableSave: true,
    });
    this.fetchTables(`${schema.value}`);
    this.setState({ schema });
  }

  onTableChange(table: Option) {
    const { disableSelectSchema, disableSelectTable } = this.state;
    const disableSave = disableSelectSchema || disableSelectTable;
    this.setState({ table, disableSave });
  }

  onSave() {
    const { datasource, schema, table } = this.state;
    const data = {
      database: datasource.value,
      schema: schema.value,
      table_name: table.label,
    };

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

  fetchDatabase() {
    SupersetClient.get({
      endpoint: '/api/v1/dataset/related/database',
    })
      .then(({ json: datasourceJson = {} }) => {
        const datasourceOptions = datasourceJson.result.map(
          ({ text, value }: { text: string; value: number }) => ({
            label: text,
            value,
          }),
        );
        this.setState({ datasourceOptions });
      })
      .catch(e => {
        this.props.addDangerToast(
          t('An error occurred while fetching datasources'),
        );
        console.error(e);
      });
  }

  fetchSchemaOptions(datasourceId: string) {
    if (datasourceId) {
      this.setState({ isSchemaLoading: true });
      const endpoint = `/superset/schemas/${datasourceId}`;
      SupersetClient.get({ endpoint })
        .then(({ json: schemaJson = {} }) => {
          const schemaOptions = schemaJson.schemas.map((schema: string) => ({
            label: schema,
            value: schema,
          }));
          this.setState({
            disableSelectSchema: false,
            isSchemaLoading: false,
            schemaOptions,
          });
        })
        .catch(e => {
          this.setState({ isSchemaLoading: false, schemaOptions: [] });
          this.props.addDangerToast(t('Error while fetching schema list'));
          console.error(e);
        });
    }
  }

  fetchTables(schema: string, substr = 'undefined') {
    const { datasource } = this.state;

    if (datasource && schema) {
      this.setState({ isTableLoading: true, tableOptions: [] });
      const encodedSchema = encodeURIComponent(schema);
      const encodedSubstr = encodeURIComponent(substr);

      const endpoint = encodeURI(
        `/superset/tables/${datasource.value}/${encodedSchema}/${encodedSubstr}`,
      );
      SupersetClient.get({ endpoint })
        .then(({ json: tableJson = {} }) => {
          const options = tableJson.options.map((option: Option) => ({
            value: option.value,
            label: option.label,
          }));
          this.setState(() => ({
            disableSelectTable: false,
            isTableLoading: false,
            tableOptions: options,
          }));
        })
        .catch(e => {
          this.setState({ isTableLoading: false, tableOptions: [] });
          this.props.addDangerToast(t('Error while fetching table list'));
          console.error(e);
        });
    }
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
        {
          <>
            <SelectOptions
              name="select-datasource"
              onChange={this.onDatabaseChange}
              options={this.state.datasourceOptions}
              placeholder={t('Select Datasource')}
              title={t('datasource')}
              value={this.state.datasource}
            />
            <SelectOptions
              isDisabled={this.state.disableSelectSchema}
              isLoading={this.state.isSchemaLoading}
              name="select-schema"
              onChange={this.onSchemaChange}
              options={this.state.schemaOptions}
              placeholder={t('Select Schema')}
              title={t('schema')}
              value={this.state.schema}
            />
            <SelectOptions
              isDisabled={this.state.disableSelectTable}
              isLoading={this.state.isTableLoading}
              name="select-table"
              onChange={this.onTableChange}
              options={this.state.tableOptions}
              placeholder={t('Select Table')}
              title={t('table')}
              value={this.state.table}
            />
          </>
        }
      </Modal>
    );
  }
}

export default withToasts(DatasetModal);
