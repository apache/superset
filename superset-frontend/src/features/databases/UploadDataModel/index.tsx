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
import React, { FunctionComponent, useEffect, useMemo, useState } from 'react';
import {
  getClientErrorObject,
  SupersetClient,
  SupersetTheme,
  t,
} from '@superset-ui/core';
import Modal from 'src/components/Modal';
import Button from 'src/components/Button';
import { Switch, SwitchProps } from 'src/components/Switch';
import Collapse from 'src/components/Collapse';
import {
  AntdForm,
  AsyncSelect,
  Col,
  Row,
  Select,
  Upload,
} from 'src/components';
import { UploadOutlined } from '@ant-design/icons';
import { Input, InputNumber } from 'src/components/Input';
import rison from 'rison';
import { UploadChangeParam, UploadFile } from 'antd/lib/upload/interface';
import withToasts from 'src/components/MessageToasts/withToasts';
import * as XLSX from 'xlsx';
import {
  antdCollapseStyles,
  antDModalNoPaddingStyles,
  antDModalStyles,
  formStyles,
  StyledFormItem,
  StyledSwitchContainer,
} from './styles';
import ColumnsPreview from './ColumnsPreview';
import StyledFormItemWithTip from './StyledFormItemWithTip';

type UploadType = 'csv' | 'excel' | 'columnar';

interface UploadDataModalProps {
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
  onHide: () => void;
  show: boolean;
  allowedExtensions: string[];
  type: UploadType;
}

const CSVSpecificFields = [
  'delimiter',
  'skip_initial_space',
  'skip_blank_lines',
  'day_first',
  'column_data_types',
];

const ExcelSpecificFields = ['sheet_name'];

const ColumnarSpecificFields: string[] = [];

const NonNullFields = ['rows_to_read', 'index_column'];

const AllSpecificFields = [
  ...CSVSpecificFields,
  ...ExcelSpecificFields,
  ...ColumnarSpecificFields,
];

const UploadTypeToSpecificFields: Record<UploadType, string[]> = {
  csv: CSVSpecificFields,
  excel: ExcelSpecificFields,
  columnar: ColumnarSpecificFields,
};

interface UploadInfo {
  table_name: string;
  schema: string;
  sheet_name?: string;
  delimiter: string;
  already_exists: string;
  skip_initial_space: boolean;
  skip_blank_lines: boolean;
  day_first: boolean;
  decimal_character: string;
  null_values: Array<string>;
  header_row: string;
  rows_to_read: string | null;
  skip_rows: string;
  column_dates: Array<string>;
  index_column: string | null;
  dataframe_index: boolean;
  column_labels: string;
  columns_read: Array<string>;
  column_data_types: string;
}

const defaultUploadInfo: UploadInfo = {
  table_name: '',
  schema: '',
  sheet_name: undefined,
  delimiter: ',',
  already_exists: 'fail',
  skip_initial_space: false,
  skip_blank_lines: false,
  day_first: false,
  decimal_character: '.',
  null_values: [],
  header_row: '0',
  rows_to_read: null,
  skip_rows: '0',
  column_dates: [],
  index_column: null,
  dataframe_index: false,
  column_labels: '',
  columns_read: [],
  column_data_types: '',
};

// Allowed extensions to accept for file upload, users can always override this
// by selecting all file extensions on the OS file picker. Also ".txt" will
// allow all files to be selected.
const READ_HEADER_SIZE = 10000;

export const validateUploadFileExtension = (
  file: UploadFile<any>,
  allowedExtensions: string[],
) => {
  const extensionMatch = file.name.match(/.+\.([^.]+)$/);
  if (!extensionMatch) {
    return false;
  }

  const fileType = extensionMatch[1];
  return allowedExtensions.includes(fileType);
};

interface StyledSwitchContainerProps extends SwitchProps {
  label: string;
  dataTest: string;
  children?: React.ReactNode;
}

const SwitchContainer = ({
  label,
  dataTest,
  children,
  ...switchProps
}: StyledSwitchContainerProps) => (
  <StyledSwitchContainer>
    <Switch data-test={dataTest} {...switchProps} />
    <div className="switch-label">{label}</div>
    {children}
  </StyledSwitchContainer>
);

const UploadDataModal: FunctionComponent<UploadDataModalProps> = ({
  addDangerToast,
  addSuccessToast,
  onHide,
  show,
  allowedExtensions,
  type = 'csv',
}) => {
  const [form] = AntdForm.useForm();
  const [currentDatabaseId, setCurrentDatabaseId] = useState<number>(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [columns, setColumns] = React.useState<string[]>([]);
  const [sheetNames, setSheetNames] = React.useState<string[]>([]);
  const [currentSheetName, setCurrentSheetName] = React.useState<
    string | undefined
  >();
  const [delimiter, setDelimiter] = useState<string>(',');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentSchema, setCurrentSchema] = useState<string | undefined>();
  const [previewUploadedFile, setPreviewUploadedFile] = useState<boolean>(true);
  const [fileLoading, setFileLoading] = useState<boolean>(false);

  const allowedExtensionsToAccept = {
    csv: '.csv, .tsv',
    excel: '.xls, .xlsx',
    columnar: '.parquet, .orc',
  };

  const createTypeToEndpointMap = (
    databaseId: number,
  ): { [key: string]: string } => ({
    csv: `/api/v1/database/${databaseId}/csv_upload/`,
    excel: `/api/v1/database/${databaseId}/excel_upload/`,
    columnar: `/api/v1/database/${databaseId}/columnar_upload/`,
  });

  const nullValuesOptions = [
    {
      value: '""',
      label: 'Empty Strings ""',
    },
    {
      value: 'None',
      label: 'None',
    },
    {
      value: 'nan',
      label: 'nan',
    },
    {
      value: 'null',
      label: 'null',
    },
    {
      value: 'N/A',
      label: 'N/A',
    },
  ];

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

  const onChangePreviewUploadedFile = (value: boolean) => {
    setPreviewUploadedFile(value);
  };

  const onChangeDatabase = (database: { value: number; label: string }) => {
    setCurrentDatabaseId(database?.value);
    setCurrentSchema(undefined);
    form.setFieldsValue({ schema: undefined });
  };

  const onChangeSchema = (schema: { value: string; label: string }) => {
    setCurrentSchema(schema?.value);
  };

  const onChangeDelimiter = (value: string) => {
    setDelimiter(value);
  };

  const clearModal = () => {
    setFileList([]);
    setColumns([]);
    setCurrentSchema('');
    setCurrentDatabaseId(0);
    setCurrentSheetName(undefined);
    setSheetNames([]);
    setIsLoading(false);
    setDelimiter(',');
    setPreviewUploadedFile(true);
    setFileLoading(false);
    form.resetFields();
  };

  const loadDatabaseOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        const query = rison.encode_uri({
          filters: [
            {
              col: 'allow_file_upload',
              opr: 'eq',
              value: true,
            },
          ],
          page,
          page_size: pageSize,
        });
        return SupersetClient.get({
          endpoint: `/api/v1/database/?q=${query}`,
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

  const loadSchemaOptions = useMemo(
    () =>
      (input = '', page: number, pageSize: number) => {
        if (!currentDatabaseId) {
          return Promise.resolve({ data: [], totalCount: 0 });
        }
        return SupersetClient.get({
          endpoint: `/api/v1/database/${currentDatabaseId}/schemas/`,
        }).then(response => {
          const list = response.json.result.map((item: string) => ({
            value: item,
            label: item,
          }));
          return { data: list, totalCount: response.json.count };
        });
      },
    [currentDatabaseId],
  );

  const getAllFieldsNotInType = (): string[] => {
    const specificFields = UploadTypeToSpecificFields[type] || [];
    return [...AllSpecificFields].filter(
      field => !specificFields.includes(field),
    );
  };

  const appendFormData = (formData: FormData, data: Record<string, any>) => {
    const allFieldsNotInType = getAllFieldsNotInType();
    Object.entries(data).forEach(([key, value]) => {
      if (!(allFieldsNotInType.includes(key) || NonNullFields.includes(key))) {
        formData.append(key, value);
      }
    });
  };

  const onClose = () => {
    clearModal();
    onHide();
  };

  const onFinish = () => {
    const fields = form.getFieldsValue();
    delete fields.database;
    fields.schema = currentSchema;
    const mergedValues = { ...defaultUploadInfo, ...fields };
    const formData = new FormData();
    const file = fileList[0]?.originFileObj;
    if (file) {
      formData.append('file', file);
    }
    appendFormData(formData, mergedValues);
    setIsLoading(true);
    const endpoint = createTypeToEndpointMap(currentDatabaseId)[type];
    return SupersetClient.post({
      endpoint,
      body: formData,
      headers: { Accept: 'application/json' },
    })
      .then(() => {
        addSuccessToast(t('Data Imported'));
        setIsLoading(false);
        onClose();
      })
      .catch(response =>
        getClientErrorObject(response).then(error => {
          addDangerToast(error.error || 'Error');
        }),
      )
      .finally(() => {
        setIsLoading(false);
      });
  };

  const onRemoveFile = (removedFile: UploadFile) => {
    setFileList(fileList.filter(file => file.uid !== removedFile.uid));
    setColumns([]);
    setSheetNames([]);
    setCurrentSheetName(undefined);
    form.setFieldsValue({ sheet_name: undefined });
    return false;
  };

  const onSheetNameChange = (value: string) => {
    setCurrentSheetName(value);
  };

  const columnsToOptions = () =>
    columns.map(column => ({
      value: column,
      label: column,
    }));

  const sheetNamesToOptions = () =>
    sheetNames.map(sheetName => ({
      value: sheetName,
      label: sheetName,
    }));

  const readFileContent = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        if (event.target) {
          const text = event.target.result as string;
          resolve(text);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file content'));
      };
      reader.readAsText(file.slice(0, READ_HEADER_SIZE));
    });

  const processCSVFile = async (file: File) => {
    try {
      setFileLoading(true);
      const text = await readFileContent(file);
      const firstLine = text.split('\n')[0].trim();
      const firstRow = firstLine
        .split(delimiter)
        .map(column => column.replace(/^"(.*)"$/, '$1'));
      setColumns(firstRow);
      setFileLoading(false);
    } catch (error) {
      addDangerToast('Failed to process file content');
      setFileLoading(false);
    }
  };

  const processExcelColumns = (workbook: XLSX.WorkBook, sn: string[]) => {
    if (!workbook) {
      return;
    }
    let cSheetName = currentSheetName;
    if (!currentSheetName) {
      setCurrentSheetName(sn[0]);
      cSheetName = sn[0];
    }
    cSheetName = cSheetName || sn[0];
    form.setFieldsValue({ sheet_name: cSheetName });
    const worksheet = workbook.Sheets[cSheetName];

    const worksheetRef: string = worksheet['!ref'] ? worksheet['!ref'] : '';
    const range = XLSX.utils.decode_range(worksheetRef);
    const columnNames = Array.from({ length: range.e.c + 1 }, (_, i) => {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: i });
      return worksheet[cellAddress]?.v;
    });
    setColumns(columnNames);
  };

  const processExcelFile = async (file: File) =>
    new Promise<string>((resolve, reject) => {
      setFileLoading(true);
      const reader = new FileReader();
      reader.readAsBinaryString(file);

      reader.onload = event => {
        if (!event.target && event.target == null) {
          reader.onerror = () => {
            reject(new Error('Failed to read file content'));
          };
          return;
        }
        // Read workbook
        const workbook = XLSX.read(event.target.result, { type: 'binary' });
        if (workbook == null) {
          reject(new Error('Failed to process file content'));
          addDangerToast('Failed to process file content');
          setFileLoading(false);
          return;
        }
        // Extract sheet names
        const tmpSheetNames = workbook.SheetNames;
        if (tmpSheetNames.length < 1) {
          reject(new Error('Failed to read file content'));
          addDangerToast('Failed to process file content');
          setFileLoading(false);
          return;
        }
        processExcelColumns(workbook, tmpSheetNames);
        setSheetNames(workbook.SheetNames);
        setFileLoading(false);
        resolve('success');
      };
    });

  const onChangeFile = async (info: UploadChangeParam<any>) => {
    setFileList([
      {
        ...info.file,
        status: 'done',
      },
    ]);
    if (!previewUploadedFile) {
      return;
    }
    if (type === 'csv') {
      await processCSVFile(info.file.originFileObj);
    }
    if (type === 'excel') {
      setSheetNames([]);
      setCurrentSheetName(undefined);
      await processExcelFile(info.file.originFileObj);
    }
  };

  useEffect(() => {
    if (
      columns.length > 0 &&
      fileList[0].originFileObj &&
      fileList[0].originFileObj instanceof File
    ) {
      if (!previewUploadedFile) {
        return;
      }
      processCSVFile(fileList[0].originFileObj).then(r => r);
    }
  }, [delimiter]);

  useEffect(() => {
    (async () => {
      if (
        columns.length > 0 &&
        fileList[0].originFileObj &&
        fileList[0].originFileObj instanceof File
      ) {
        if (!previewUploadedFile) {
          return;
        }
        await processExcelFile(fileList[0].originFileObj);
      }
    })();
  }, [currentSheetName]);

  const validateUpload = (_: any, value: string) => {
    if (fileList.length === 0) {
      return Promise.reject(t('Uploading a file is required'));
    }
    if (!validateUploadFileExtension(fileList[0], allowedExtensions)) {
      return Promise.reject(
        t(
          'Upload a file with a valid extension. Valid: [%s]',
          allowedExtensions.join(','),
        ),
      );
    }
    return Promise.resolve();
  };

  const validateDatabase = (_: any, value: string) => {
    if (!currentDatabaseId) {
      return Promise.reject(t('Selecting a database is required'));
    }
    return Promise.resolve();
  };

  const uploadTitles = {
    csv: t('CSV Upload'),
    excel: t('Excel Upload'),
    columnar: t('Columnar Upload'),
  };

  const UploadTitle: React.FC = () => {
    const title = uploadTitles[type] || t('Upload');
    return <h4>{title}</h4>;
  };

  return (
    <Modal
      css={(theme: SupersetTheme) => [
        antDModalNoPaddingStyles,
        antDModalStyles(theme),
        formStyles(theme),
      ]}
      primaryButtonLoading={isLoading}
      name="database"
      data-test="upload-modal"
      onHandledPrimaryAction={form.submit}
      onHide={onClose}
      width="500px"
      primaryButtonName="Upload"
      centered
      show={show}
      title={<UploadTitle />}
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
                <p className="helper">{t('Upload a file to a database.')}</p>
              </div>
            }
            key="general"
          >
            <Row>
              <Col span={12}>
                <StyledFormItem
                  label={t('%(type)s File', { type })}
                  name="file"
                  required
                  rules={[{ validator: validateUpload }]}
                >
                  <Upload
                    name="modelFile"
                    id="modelFile"
                    data-test="model-file-input"
                    accept={allowedExtensionsToAccept[type]}
                    fileList={fileList}
                    onChange={onChangeFile}
                    onRemove={onRemoveFile}
                    // upload is handled by hook
                    customRequest={() => {}}
                  >
                    <Button
                      aria-label={t('Select')}
                      icon={<UploadOutlined />}
                      loading={fileLoading}
                    >
                      {t('Select')}
                    </Button>
                  </Upload>
                </StyledFormItem>
              </Col>
              <Col span={12}>
                <StyledFormItem>
                  <SwitchContainer
                    label={t('Preview uploaded file')}
                    dataTest="previewUploadedFile"
                    onChange={onChangePreviewUploadedFile}
                    checked={previewUploadedFile}
                  />
                </StyledFormItem>
              </Col>
            </Row>
            {previewUploadedFile && (
              <Row>
                <Col span={24}>
                  <ColumnsPreview columns={columns} />
                </Col>
              </Row>
            )}
            <Row>
              <Col span={24}>
                <StyledFormItem
                  label={t('Database')}
                  required
                  name="database"
                  rules={[{ validator: validateDatabase }]}
                >
                  <AsyncSelect
                    ariaLabel={t('Select a database')}
                    options={loadDatabaseOptions}
                    onChange={onChangeDatabase}
                    allowClear
                    placeholder={t('Select a database to upload the file to')}
                  />
                </StyledFormItem>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <StyledFormItem label={t('Schema')} name="schema">
                  <AsyncSelect
                    ariaLabel={t('Select a schema')}
                    options={loadSchemaOptions}
                    onChange={onChangeSchema}
                    allowClear
                    placeholder={t(
                      'Select a schema if the database supports this',
                    )}
                  />
                </StyledFormItem>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
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
                    placeholder={t('Name of table to be created')}
                  />
                </StyledFormItem>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                {type === 'csv' && (
                  <StyledFormItemWithTip
                    label={t('Delimiter')}
                    tip={t('Select a delimiter for this data')}
                    name="delimiter"
                  >
                    <Select
                      ariaLabel={t('Choose a delimiter')}
                      options={delimiterOptions}
                      onChange={onChangeDelimiter}
                      allowNewOptions
                    />
                  </StyledFormItemWithTip>
                )}
                {type === 'excel' && (
                  <StyledFormItem label={t('Sheet name')} name="sheet_name">
                    <Select
                      ariaLabel={t('Choose sheet name')}
                      options={sheetNamesToOptions()}
                      onChange={onSheetNameChange}
                      allowNewOptions
                      placeholder={t(
                        'Select a sheet name from the uploaded file',
                      )}
                    />
                  </StyledFormItem>
                )}
              </Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel
            header={
              <div>
                <h4>{t('File Settings')}</h4>
                <p className="helper">
                  {t(
                    'Adjust how spaces, blank lines, null values are handled and other file wide settings.',
                  )}
                </p>
              </div>
            }
            key="2"
          >
            <Row>
              <Col span={24}>
                <StyledFormItemWithTip
                  label={t('If Table Already Exists')}
                  tip={t('What should happen if the table already exists')}
                  name="already_exists"
                >
                  <Select
                    ariaLabel={t('Choose already exists')}
                    options={tableAlreadyExistsOptions}
                    onChange={() => {}}
                  />
                </StyledFormItemWithTip>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <StyledFormItem
                  label={t('Columns To Be Parsed as Dates')}
                  name="column_dates"
                >
                  <Select
                    ariaLabel={t('Choose columns to be parsed as dates')}
                    mode="multiple"
                    options={columnsToOptions()}
                    allowClear
                    allowNewOptions
                    placeholder={t(
                      'A comma separated list of columns that should be parsed as dates',
                    )}
                  />
                </StyledFormItem>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <StyledFormItemWithTip
                  label={t('Decimal Character')}
                  tip={t('Character to interpret as decimal point')}
                  name="decimal_character"
                >
                  <Input type="text" />
                </StyledFormItemWithTip>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <StyledFormItemWithTip
                  label={t('Null Values')}
                  tip={t(
                    'Choose values that should be treated as null. Warning: Hive database supports only a single value',
                  )}
                  name="null_values"
                >
                  <Select
                    mode="multiple"
                    options={nullValuesOptions}
                    allowClear
                    allowNewOptions
                  />
                </StyledFormItemWithTip>
              </Col>
            </Row>
            {type === 'csv' && (
              <>
                <Row>
                  <Col span={24}>
                    <StyledFormItem name="skip_initial_space">
                      <SwitchContainer
                        label={t('Skip spaces after delimiter')}
                        dataTest="skipInitialSpace"
                      />
                    </StyledFormItem>
                  </Col>
                </Row>
                <Row>
                  <Col span={24}>
                    <StyledFormItem name="skip_blank_lines">
                      <SwitchContainer
                        label={t(
                          'Skip blank lines rather than interpreting them as Not A Number values',
                        )}
                        dataTest="skipBlankLines"
                      />
                    </StyledFormItem>
                  </Col>
                </Row>
                <Row>
                  <Col span={24}>
                    <StyledFormItem name="day_first">
                      <SwitchContainer
                        label={t(
                          'DD/MM format dates, international and European format',
                        )}
                        dataTest="dayFirst"
                      />
                    </StyledFormItem>
                  </Col>
                </Row>
              </>
            )}
          </Collapse.Panel>
          <Collapse.Panel
            header={
              <div>
                <h4>{t('Columns')}</h4>
                <p className="helper">
                  {t(
                    'Adjust column settings such as specifying the columns to read, how duplicates are handled, column data types, and more.',
                  )}
                </p>
              </div>
            }
            key="3"
          >
            <Row>
              <Col span={24}>
                <StyledFormItemWithTip
                  label={t('Index Column')}
                  tip={t(
                    'Column to use as the row labels of the dataframe. Leave empty if no index column',
                  )}
                  name="index_column"
                >
                  <Select
                    ariaLabel={t('Choose index column')}
                    options={columns.map(column => ({
                      value: column,
                      label: column,
                    }))}
                    allowClear
                    allowNewOptions
                  />
                </StyledFormItemWithTip>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <StyledFormItemWithTip
                  label={t('Column Label(s)')}
                  tip={t(
                    'Column label for index column(s). If None is given and Dataframe Index is checked, Index Names are used',
                  )}
                  name="column_labels"
                >
                  <Input aria-label={t('Column labels')} type="text" />
                </StyledFormItemWithTip>
              </Col>
            </Row>
            <Row>
              <Col span={24}>
                <StyledFormItem
                  label={t('Columns To Read')}
                  name="columns_read"
                >
                  <Select
                    ariaLabel={t('Choose columns to read')}
                    mode="multiple"
                    options={columnsToOptions()}
                    allowClear
                    allowNewOptions
                    placeholder={t(
                      'List of the column names that should be read',
                    )}
                  />
                </StyledFormItem>
              </Col>
            </Row>
            {type === 'csv' && (
              <Row>
                <Col span={24}>
                  <StyledFormItemWithTip
                    label={t('Column Data Types')}
                    tip={t(
                      'A dictionary with column names and their data types if you need to change the defaults. Example: {"user_id":"int"}. Check Python\'s Pandas library for supported data types.',
                    )}
                    name="column_data_types"
                  >
                    <Input aria-label={t('Column data types')} type="text" />
                  </StyledFormItemWithTip>
                </Col>
              </Row>
            )}
            <Row>
              <Col span={24}>
                <StyledFormItem name="dataframe_index">
                  <SwitchContainer
                    label={t('Write dataframe index as a column')}
                    dataTest="dataFrameIndex"
                  />
                </StyledFormItem>
              </Col>
            </Row>
          </Collapse.Panel>
          <Collapse.Panel
            header={
              <div>
                <h4>{t('Rows')}</h4>
                <p className="helper">
                  {t('Set header rows and the number of rows to read or skip.')}
                </p>
              </div>
            }
            key="4"
          >
            <Row>
              <Col span={8}>
                <StyledFormItemWithTip
                  label={t('Header Row')}
                  tip={t(
                    'Row containing the headers to use as column names (0 is first line of data).',
                  )}
                  name="header_row"
                  rules={[
                    { required: true, message: 'Header row is required' },
                  ]}
                >
                  <InputNumber
                    aria-label={t('Header row')}
                    type="text"
                    min={0}
                  />
                </StyledFormItemWithTip>
              </Col>
              <Col span={8}>
                <StyledFormItemWithTip
                  label={t('Rows to Read')}
                  tip={t(
                    'Number of rows of file to read. Leave empty (default) to read all rows',
                  )}
                  name="rows_to_read"
                >
                  <InputNumber aria-label={t('Rows to read')} min={1} />
                </StyledFormItemWithTip>
              </Col>
              <Col span={8}>
                <StyledFormItemWithTip
                  label={t('Skip Rows')}
                  tip={t('Number of rows to skip at start of file.')}
                  name="skip_rows"
                  rules={[{ required: true, message: 'Skip rows is required' }]}
                >
                  <InputNumber aria-label={t('Skip rows')} min={0} />
                </StyledFormItemWithTip>
              </Col>
            </Row>
          </Collapse.Panel>
        </Collapse>
      </AntdForm>
    </Modal>
  );
};

export default withToasts(UploadDataModal);
