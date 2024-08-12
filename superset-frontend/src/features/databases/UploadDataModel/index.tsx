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
import {
  FunctionComponent,
  useEffect,
  useMemo,
  useState,
  ReactNode,
  FC,
} from 'react';

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
  'column_dates',
  'decimal_character',
  'null_values',
  'index_column',
  'header_row',
  'rows_to_read',
  'skip_rows',
];

const ExcelSpecificFields = [
  'sheet_name',
  'column_dates',
  'decimal_character',
  'null_values',
  'index_column',
  'header_row',
  'rows_to_read',
  'skip_rows',
];

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

const isFieldATypeSpecificField = (field: string, type: UploadType) =>
  UploadTypeToSpecificFields[type].includes(field);

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
  index_label: string;
  columns_read: Array<string>;
  column_data_types: string;
}

interface SheetColumnNames {
  sheet_name: string;
  column_names: string[];
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
  index_label: '',
  columns_read: [],
  column_data_types: '',
};

// Allowed extensions to accept for file upload, users can always override this
// by selecting all file extensions on the OS file picker. Also ".txt" will
// allow all files to be selected.
const allowedExtensionsToAccept = {
  csv: '.csv, .tsv',
  excel: '.xls, .xlsx',
  columnar: '.parquet, .zip',
};

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
  children?: ReactNode;
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
  const [columns, setColumns] = useState<string[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheetsColumnNames, setSheetsColumnNames] = useState<
    SheetColumnNames[]
  >([]);
  const [delimiter, setDelimiter] = useState<string>(',');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentSchema, setCurrentSchema] = useState<string | undefined>();
  const [currentDataframeIndex, setCurrentDataframeIndex] =
    useState<boolean>(false);
  const [previewUploadedFile, setPreviewUploadedFile] = useState<boolean>(true);
  const [fileLoading, setFileLoading] = useState<boolean>(false);

  const createTypeToEndpointMap = (
    databaseId: number,
  ): { [key: string]: string } => ({
    csv: `/api/v1/database/${databaseId}/csv_upload/`,
    excel: `/api/v1/database/${databaseId}/excel_upload/`,
    columnar: `/api/v1/database/${databaseId}/columnar_upload/`,
  });

  const typeToFileMetadataEndpoint = {
    csv: '/api/v1/database/csv_metadata/',
    excel: '/api/v1/database/excel_metadata/',
    columnar: '/api/v1/database/columnar_metadata/',
  };

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
    setSheetNames([]);
    setIsLoading(false);
    setDelimiter(',');
    setPreviewUploadedFile(true);
    setFileLoading(false);
    setSheetsColumnNames([]);
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

  const loadFileMetadata = (file: File) => {
    const fields = form.getFieldsValue();
    const mergedValues = { ...defaultUploadInfo, ...fields };
    const formData = new FormData();
    formData.append('file', file);
    if (type === 'csv') {
      formData.append('delimiter', mergedValues.delimiter);
    }
    setFileLoading(true);
    return SupersetClient.post({
      endpoint: typeToFileMetadataEndpoint[type],
      body: formData,
      headers: { Accept: 'application/json' },
    })
      .then(response => {
        const { items } = response.json.result;
        if (items && type !== 'excel') {
          setColumns(items[0].column_names);
        } else {
          const { allSheetNames, sheetColumnNamesMap } = items.reduce(
            (
              acc: {
                allSheetNames: any[];
                sheetColumnNamesMap: Record<string, string[]>;
              },
              item: { sheet_name: any; column_names: any },
            ) => {
              acc.allSheetNames.push(item.sheet_name);
              acc.sheetColumnNamesMap[item.sheet_name] = item.column_names;
              return acc;
            },
            { allSheetNames: [], sheetColumnNamesMap: {} },
          );
          setColumns(items[0].column_names);
          setSheetNames(allSheetNames);
          form.setFieldsValue({ sheet_name: allSheetNames[0] });
          setSheetsColumnNames(sheetColumnNamesMap);
        }
      })
      .catch(response =>
        getClientErrorObject(response).then(error => {
          addDangerToast(error.error || 'Error');
          setColumns([]);
          form.setFieldsValue({ sheet_name: undefined });
          setSheetNames([]);
        }),
      )
      .finally(() => {
        setFileLoading(false);
      });
  };

  const getAllFieldsNotInType = (): string[] => {
    const specificFields = UploadTypeToSpecificFields[type] || [];
    return [...AllSpecificFields].filter(
      field => !specificFields.includes(field),
    );
  };

  const appendFormData = (formData: FormData, data: Record<string, any>) => {
    const allFieldsNotInType = getAllFieldsNotInType();
    Object.entries(data).forEach(([key, value]) => {
      if (
        !(
          allFieldsNotInType.includes(key) ||
          (NonNullFields.includes(key) &&
            (value === undefined || value === null))
        )
      ) {
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
    form.setFieldsValue({ sheet_name: undefined });
    return false;
  };

  const onSheetNameChange = (value: string) => {
    setColumns(sheetsColumnNames[value] ?? []);
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
    await loadFileMetadata(info.file.originFileObj);
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
      loadFileMetadata(fileList[0].originFileObj).then(r => r);
    }
  }, [delimiter]);

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

  const UploadTitle: FC = () => {
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
            {isFieldATypeSpecificField('delimiter', type) && (
              <Row>
                <Col span={24}>
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
                </Col>
              </Row>
            )}
            {isFieldATypeSpecificField('sheet_name', type) && (
              <Row>
                <Col span={24}>
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
                </Col>
              </Row>
            )}
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
            {isFieldATypeSpecificField('column_dates', type) && (
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
            )}
            {isFieldATypeSpecificField('decimal_character', type) && (
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
            )}
            {isFieldATypeSpecificField('null_values', type) && (
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
            )}
            {isFieldATypeSpecificField('skip_initial_space', type) && (
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
            )}
            {isFieldATypeSpecificField('skip_blank_lines', type) && (
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
            )}
            {isFieldATypeSpecificField('day_first', type) && (
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
            {isFieldATypeSpecificField('column_data_types', type) && (
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
                    label={t('Create dataframe index')}
                    dataTest="dataFrameIndex"
                    onChange={setCurrentDataframeIndex}
                  />
                </StyledFormItem>
              </Col>
            </Row>
            {currentDataframeIndex &&
              isFieldATypeSpecificField('index_column', type) && (
                <Row>
                  <Col span={24}>
                    <StyledFormItemWithTip
                      label={t('Index Column')}
                      tip={t(
                        'Column to use as the index of the dataframe. If None is given, Index label is used.',
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
              )}
            {currentDataframeIndex && (
              <Row>
                <Col span={24}>
                  <StyledFormItemWithTip
                    label={t('Index Label')}
                    tip={t(
                      "Label for the index column. Don't use an existing column name.",
                    )}
                    name="index_label"
                  >
                    <Input aria-label={t('Index label')} type="text" />
                  </StyledFormItemWithTip>
                </Col>
              </Row>
            )}
          </Collapse.Panel>
          {isFieldATypeSpecificField('header_row', type) &&
            isFieldATypeSpecificField('rows_to_read', type) &&
            isFieldATypeSpecificField('skip_rows', type) && (
              <Collapse.Panel
                header={
                  <div>
                    <h4>{t('Rows')}</h4>
                    <p className="helper">
                      {t(
                        'Set header rows and the number of rows to read or skip.',
                      )}
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
                      rules={[
                        { required: true, message: 'Skip rows is required' },
                      ]}
                    >
                      <InputNumber aria-label={t('Skip rows')} min={0} />
                    </StyledFormItemWithTip>
                  </Col>
                </Row>
              </Collapse.Panel>
            )}
        </Collapse>
      </AntdForm>
    </Modal>
  );
};

export default withToasts(UploadDataModal);
