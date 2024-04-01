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
import React, {
  FunctionComponent,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { SupersetClient, SupersetTheme, t } from '@superset-ui/core';
import Modal from 'src/components/Modal';
import Collapse from 'src/components/Collapse';
import {
  Upload,
  AntdForm,
  Col,
  Row,
  AntdButton as Button,
  AsyncSelect,
  Select,
} from 'src/components';
import {
  antDModalStyles,
  antDModalNoPaddingStyles,
  antdCollapseStyles,
  StyledFormItem,
} from './styles';
import withToasts from '../../../components/MessageToasts/withToasts';
import { Divider, InputNumber, Switch } from 'antd';
import { CollapsePanelProps, CollapseProps } from 'antd/lib/collapse';
import { UploadOutlined } from '@ant-design/icons';
import { Input } from 'src/components/Input';
import rison from 'rison';
import { UploadChangeParam, UploadFile } from 'antd/lib/upload/interface';

interface CSVUploadModalProps {
  onHide: () => void;
  show: boolean;
}

interface UploadInfo {
  database_id: number;
  table_name: string;
  schema: string;
  delimiter: string;
  already_exists: string;
  skip_initial_space: boolean;
  skip_blank_lines: boolean;
  day_first: boolean;
  decimal_character: string;
  null_values: string;
  header_row: string;
  rows_to_read: string;
  skip_rows: string;
  column_dates: string;
  index_column: string;
  dataframe_index: boolean;
  column_labels: string;
  columns_read: string;
  overwrite_duplicates: boolean;
  column_data_types: string;
}

const defaultUploadInfo: UploadInfo = {
  database_id: 0,
  table_name: '',
  schema: '',
  delimiter: ',',
  already_exists: 'fail',
  skip_initial_space: false,
  skip_blank_lines: false,
  day_first: false,
  decimal_character: '.',
  null_values: '',
  header_row: '0',
  rows_to_read: '0',
  skip_rows: '0',
  column_dates: '',
  index_column: '',
  dataframe_index: false,
  column_labels: '',
  columns_read: '',
  overwrite_duplicates: false,
  column_data_types: '',
};

export interface CustomCollapsePanelProps extends CollapsePanelProps {
  children?: React.ReactNode;
}

export interface CustomCollapseProps extends CollapseProps {
  children?: React.ReactNode;
}

// const StyledPanel = (props: CustomCollapsePanelProps) => (
//   <AntdCollapse.Panel
//     css={(theme: SupersetTheme) => antdPanelStyles(theme)}
//     {...props}
//   />
// );
//
// const StyledCollapse = (props: CustomCollapseProps) => (
//   <Collapse
//     expandIconPosition="right"
//     accordion
//     defaultActiveKey="general"
//     css={(theme: SupersetTheme) => antdCollapseStyles(theme)}
//   />
// )

const CSVUploadModal: FunctionComponent<CSVUploadModalProps> = ({
  onHide,
  show,
}) => {
  const [form] = AntdForm.useForm();
  // Declare states here
  const [databaseId, setDatabaseId] = useState<number>(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const delimiterOptions = [
    {
      value: ',',
      label: 'Comma ","',
    },
    {
      value: ';',
      label: 'Semicolon ";"',
    },
    {
      value: '\t',
      label: 'Tab "\\t"',
    },
    {
      value: '|',
      label: 'Pipe',
    },
  ];

  const tableAlreadyExistsOptions = [
    {
      value: 'fail',
      label: 'Fail',
    },
    {
      value: 'replace',
      label: 'Replace',
    },
    {
      value: 'append',
      label: 'Append',
    },
  ];

  const onChangeDatabase = (database: { value: number; label: string }) => {
    setDatabaseId(database?.value);
  };

  const clearModal = () => {
    setFileList([]);
    form.resetFields();
  };

  const loadDatabaseOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode_uri({
          filter: {},
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/database?q=${query}`,
        }).then(response => {
          const list = response.json.result.map(
            (item: { id: number; database_name: string }) => ({
              value: item.id,
              label: item.database_name,
            }),
          );
          return { data: list, totalCount: response.json.count };
        });
      },
    [],
  );

  const onClose = () => {
    clearModal();
    onHide();
  };

  const onFinish = () => {
    const formData = form.getFieldsValue();
    formData.database_id = databaseId;
    const mergedValues = { ...defaultUploadInfo, ...formData };
    console.log(mergedValues);
  };

  const onRemoveFile = (removedFile: UploadFile) => {
    setFileList(fileList.filter(file => file.uid !== removedFile.uid));
    return false;
  };

  const onChangeFile = (info: UploadChangeParam) => {
    setFileList([
      {
        ...info.file,
        status: 'done',
      },
    ]);
  };

  const validateUpload = (_: any, value: string) => {
    if (fileList.length === 0) {
      return Promise.reject(t('Uploading a file is required'));
    }
    return Promise.resolve();
  };

  const validateDatabase = (_: any, value: string) => {
    if (!databaseId) {
      return Promise.reject(t('Selecting a database is required'));
    }
    return Promise.resolve();
  };

  return (
    <Modal
      css={(theme: SupersetTheme) => [
        antDModalNoPaddingStyles,
        antDModalStyles(theme),
      ]}
      name="database"
      data-test="database-modal"
      onHandledPrimaryAction={form.submit}
      onHide={onClose}
      primaryButtonName="Save"
      centered
      show={show}
      title={<h4>CSV Upload</h4>}
    >
      <AntdForm
        form={form}
        onFinish={onFinish}
        data-test="dashboard-edit-properties-form"
        layout="vertical"
        initialValues={defaultUploadInfo}
      >
        <Collapse
          expandIconPosition="right"
          accordion
          defaultActiveKey="general"
          css={(theme: SupersetTheme) => antdCollapseStyles(theme)}
        >
          <Collapse.Panel
            header={
              <div>
                <h4>{t('General information')}</h4>
                <p className="helper">
                  {t('Upload a CSV file to a database.')}
                </p>
              </div>
            }
            key="general"
          >
            <Row>
              <Col>
                <StyledFormItem
                  label={t('CSV File')}
                  name="upload"
                  required
                  rules={[{ validator: validateUpload }]}
                >
                  <Upload
                    name="modelFile"
                    id="modelFile"
                    data-test="model-file-input"
                    accept=".csv"
                    fileList={fileList}
                    onChange={onChangeFile}
                    onRemove={onRemoveFile}
                    // upload is handled by hook
                    customRequest={() => {}}
                  >
                    <Button icon={<UploadOutlined />}>Upload</Button>
                  </Upload>
                </StyledFormItem>
              </Col>
            </Row>
            <Divider orientation="left">Basic</Divider>
            <Row justify="space-between">
              <Col span={11}>
                <StyledFormItem
                  label={t('Database')}
                  name="database"
                  required
                  rules={[{ validator: validateDatabase }]}
                >
                  <AsyncSelect
                    ariaLabel={t('Select a database')}
                    options={loadDatabaseOptions}
                    onChange={onChangeDatabase}
                    allowClear
                  />
                </StyledFormItem>
                <p className="help-block">
                  {t('Select a database to upload the file to')}
                </p>
              </Col>
              <Col span={11}>
                <StyledFormItem
                  label={t('Table Name')}
                  name="table_name"
                  required
                  rules={[
                    { required: true, message: 'Table name is required' },
                  ]}
                >
                  <Input
                    aria-label={t('Table Name')}
                    name="table_name"
                    data-test="properties-modal-name-input"
                    type="text"
                  />
                </StyledFormItem>
                <p className="help-block">
                  {t('Name of table to be created with CSV file')}
                </p>
              </Col>
            </Row>
            <Row justify="space-between">
              <Col span={11}>
                <StyledFormItem label={t('Schema')} name="schema">
                  <Input type="text" />
                </StyledFormItem>
                <p className="help-block">
                  {t('Select a schema if the database supports this')}
                </p>
              </Col>
              <Col span={11}>
                <StyledFormItem label={t('Delimiter')} name="Delimiter">
                  <Select options={delimiterOptions} allowNewOptions={true} />
                </StyledFormItem>
                <p className="help-block">
                  {t('Select a delimiter for this data')}
                </p>
              </Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel
            header={
              <div>
                <h4>{t('File Settings')}</h4>
                <p className="helper">
                  {t('Adjust how the file will be imported.')}
                </p>
              </div>
            }
            key="2"
          >
            <Row>
              <Col>
                <StyledFormItem
                  label={t('If Table Already Exists')}
                  name="already_exists"
                >
                  <Select options={tableAlreadyExistsOptions} />
                </StyledFormItem>
                <p className="help-block">
                  {t('What should happen if the table already exists')}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem
                  label={t('Skip Initial Space')}
                  name="skip_initial_space"
                >
                  <Switch />
                </StyledFormItem>
                <p className="help-block">{t('Skip spaces after delimiter')}</p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem
                  label={t('Skip Blank Lines')}
                  name="skip_blank_lines"
                >
                  <Switch />
                </StyledFormItem>
                <p className="help-block">
                  {t(
                    'Skip blank lines rather than interpreting them as Not A Number values',
                  )}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem
                  label={t('Columns To Be Parsed as Dates')}
                  name="column_dates"
                >
                  <Input type="text" />
                </StyledFormItem>
                <p className="help-block">
                  {t(
                    'A comma separated list of columns that should be parsed as dates',
                  )}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem label={t('Day First')} name="day_first">
                  <Switch />
                </StyledFormItem>
                <p className="help-block">
                  {t('DD/MM format dates, international and European format')}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem
                  label={t('Decimal Character')}
                  name="decimal_character"
                >
                  <Input type="text" defaultValue={'.'} />
                </StyledFormItem>
                <p className="help-block">
                  {t('Character to interpret as decimal point')}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem label={t('Null Values')} name="null_values">
                  <Input type="text" />
                </StyledFormItem>
                <p className="help-block">
                  {t(
                    'Json list of the values that should be treated as null. Examples: [""] for empty strings, ["None", "N/A"], ["nan", "null"]. Warning: Hive database supports only a single value',
                  )}
                </p>
              </Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel
            header={
              <div>
                <h4>{t('Columns')}</h4>
                <p className="helper">{t('Adjust column settings.')}</p>
              </div>
            }
            key="3"
          >
            <Row>
              <Col>
                <StyledFormItem label={t('Index Column')} name="index_column">
                  <Input type="text" />
                </StyledFormItem>
                <p className="help-block">
                  {t(
                    'Column to use as the row labels of the dataframe. Leave empty if no index column',
                  )}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem
                  label={t('Dataframe Index')}
                  name="dataframe_index"
                >
                  <Switch />
                </StyledFormItem>
                <p className="help-block">
                  {t('Write dataframe index as a column')}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem
                  label={t('Column Label(s)')}
                  name="column_labels"
                >
                  <Input type="text" />
                </StyledFormItem>
                <p className="help-block">
                  {t(
                    'Column label for index column(s). If None is given and Dataframe Index is checked, Index Names are used',
                  )}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem
                  label={t('Columns To Read')}
                  name="columns_read"
                >
                  <Input type="text" />
                </StyledFormItem>
                <p className="help-block">
                  {t('Json list of the column names that should be read')}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem
                  label={t('Overwrite Duplicate Columns')}
                  name="overwrite_duplicates"
                >
                  <Switch />
                </StyledFormItem>
                <p className="help-block">
                  {t(
                    'If duplicate columns are not overridden, they will be presented as "X.1, X.2 ...X.x"',
                  )}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem
                  label={t('Column Data Types')}
                  name="column_data_types"
                >
                  <Input type="text" />
                </StyledFormItem>
                <p className="help-block">
                  {t(
                    'A dictionary with column names and their data types if you need to change the defaults. Example: {"user_id":"int"}. Check Python\'s Pandas library for supported data types.',
                  )}
                </p>
              </Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel
            header={
              <div>
                <h4>{t('Rows')}</h4>
                <p className="helper">{t('Adjust row settings.')}</p>
              </div>
            }
            key="4"
          >
            <Row>
              <Col>
                <StyledFormItem label={t('Header Row')} name="header_row">
                  <Input type="text" defaultValue={0} />
                </StyledFormItem>
                <p className="help-block">
                  {t(
                    'Row containing the headers to use as column names (0 is first line of data). Leave empty if there is no header row.',
                  )}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem label={t('Rows to Read')} name="rows_to_read">
                  <InputNumber min={0} />
                </StyledFormItem>
                <p className="help-block">
                  {t('Number of rows of file to read.')}
                </p>
              </Col>
            </Row>
            <Row>
              <Col>
                <StyledFormItem label={t('Skip Rows')} name="skip_rows">
                  <InputNumber min={0} />
                </StyledFormItem>
                <p className="help-block">
                  {t('Number of rows to skip at start of file.')}
                </p>
              </Col>
            </Row>
          </Collapse.Panel>
        </Collapse>
      </AntdForm>
    </Modal>
  );
};

export default withToasts(CSVUploadModal);
