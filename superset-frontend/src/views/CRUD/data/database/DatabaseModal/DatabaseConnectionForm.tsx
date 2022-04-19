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
import React, { FormEvent, useState } from 'react';
import { SupersetTheme, JsonObject, t } from '@superset-ui/core';
import { InputProps } from 'antd/lib/input';
import { Switch, Select, Button } from 'src/common/components';
import InfoTooltip from 'src/components/InfoTooltip';
import ValidatedInput from 'src/components/Form/LabeledErrorBoundInput';
import FormLabel from 'src/components/Form/FormLabel';
import { DeleteFilled, CloseOutlined } from '@ant-design/icons';
import {
  formScrollableStyles,
  validatedFormStyles,
  CredentialInfoForm,
  toggleStyle,
  infoTooltip,
  StyledFooterButton,
  StyledCatalogTable,
  labelMarginBotton,
} from './styles';
import { CatalogObject, DatabaseForm, DatabaseObject } from '../types';

// These are the columns that are going to be added to encrypted extra, they differ in name based
// on the engine, however we want to use the same component for each of them. Make sure to add the
// the engine specific name here.
export const encryptedCredentialsMap = {
  gsheets: 'service_account_info',
  bigquery: 'credentials_info',
};

enum CredentialInfoOptions {
  jsonUpload,
  copyPaste,
}

const castStringToBoolean = (optionValue: string) => optionValue === 'true';

export const FormFieldOrder = [
  'host',
  'port',
  'database',
  'username',
  'password',
  'database_name',
  'credentials_info',
  'service_account_info',
  'catalog',
  'query',
  'encryption',
];

interface FieldPropTypes {
  required: boolean;
  hasTooltip?: boolean;
  tooltipText?: (value: any) => string;
  onParametersChange: (value: any) => string;
  onParametersUploadFileChange: (value: any) => string;
  changeMethods: { onParametersChange: (value: any) => string } & {
    onChange: (value: any) => string;
  } & {
    onQueryChange: (value: any) => string;
  } & { onParametersUploadFileChange: (value: any) => string } & {
    onAddTableCatalog: () => void;
    onRemoveTableCatalog: (idx: number) => void;
  };
  validationErrors: JsonObject | null;
  getValidation: () => void;
  db?: DatabaseObject;
  isEditMode?: boolean;
  sslForced?: boolean;
  defaultDBName?: string;
  editNewDb?: boolean;
}

const CredentialsInfo = ({
  changeMethods,
  isEditMode,
  db,
  editNewDb,
}: FieldPropTypes) => {
  const [uploadOption, setUploadOption] = useState<number>(
    CredentialInfoOptions.jsonUpload.valueOf(),
  );
  const [fileToUpload, setFileToUpload] = useState<string | null | undefined>(
    null,
  );
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const showCredentialsInfo =
    db?.engine === 'gsheets' ? !isEditMode && !isPublic : !isEditMode;
  // a database that has an optional encrypted field has an encrypted_extra that is an empty object, this checks for that.
  const isEncrypted = isEditMode && db?.encrypted_extra !== '{}';
  const encryptedField = db?.engine && encryptedCredentialsMap[db.engine];
  const encryptedValue =
    typeof db?.parameters?.[encryptedField] === 'object'
      ? JSON.stringify(db?.parameters?.[encryptedField])
      : db?.parameters?.[encryptedField];
  return (
    <CredentialInfoForm>
      {db?.engine === 'gsheets' && (
        <div className="catalog-type-select">
          <FormLabel
            css={(theme: SupersetTheme) => labelMarginBotton(theme)}
            required
          >
            {t('Type of Google Sheets allowed')}
          </FormLabel>
          <Select
            style={{ width: '100%' }}
            defaultValue={isEncrypted ? 'false' : 'true'}
            onChange={(value: string) =>
              setIsPublic(castStringToBoolean(value))
            }
          >
            <Select.Option value="true" key={1}>
              {t('Publicly shared sheets only')}
            </Select.Option>
            <Select.Option value="false" key={2}>
              {t('Public and privately shared sheets')}
            </Select.Option>
          </Select>
        </div>
      )}
      {showCredentialsInfo && (
        <>
          <FormLabel required>
            {t('How∂ do you want to enter service account credentials?')}
          </FormLabel>
          <Select
            defaultValue={uploadOption}
            style={{ width: '100%' }}
            onChange={option => setUploadOption(option)}
          >
            <Select.Option value={CredentialInfoOptions.jsonUpload}>
              {t('Upload JSON file')}
            </Select.Option>

            <Select.Option value={CredentialInfoOptions.copyPaste}>
              {t('Copy and Paste JSON credentials')}
            </Select.Option>
          </Select>
        </>
      )}
      {uploadOption === CredentialInfoOptions.copyPaste ||
      isEditMode ||
      editNewDb ? (
        <div className="input-container">
          <FormLabel required>{t('Service Account')}</FormLabel>
          <textarea
            className="input-form"
            name={encryptedField}
            value={encryptedValue}
            onChange={changeMethods.onParametersChange}
            placeholder="Paste content of service credentials JSON file here"
          />
          <span className="label-paste">
            {t('Copy and paste the entire service account .json file here')}
          </span>
        </div>
      ) : (
        showCredentialsInfo && (
          <div
            className="input-container"
            css={(theme: SupersetTheme) => infoTooltip(theme)}
          >
            <div css={{ display: 'flex', alignItems: 'center' }}>
              <FormLabel required>{t('Upload Credentials')}</FormLabel>
              <InfoTooltip
                tooltip={t(
                  'Use the JSON file you automatically downloaded when creating your service account.',
                )}
                viewBox="0 0 24 24"
              />
            </div>

            {!fileToUpload && (
              <Button
                className="input-upload-btn"
                onClick={() =>
                  document?.getElementById('selectedFile')?.click()
                }
              >
                {t('Choose File')}
              </Button>
            )}
            {fileToUpload && (
              <div className="input-upload-current">
                {fileToUpload}
                <DeleteFilled
                  onClick={() => {
                    setFileToUpload(null);
                    changeMethods.onParametersChange({
                      target: {
                        name: encryptedField,
                        value: '',
                      },
                    });
                  }}
                />
              </div>
            )}

            <input
              id="selectedFile"
              className="input-upload"
              type="file"
              onChange={async event => {
                let file;
                if (event.target.files) {
                  file = event.target.files[0];
                }
                setFileToUpload(file?.name);
                changeMethods.onParametersChange({
                  target: {
                    type: null,
                    name: encryptedField,
                    value: await file?.text(),
                    checked: false,
                  },
                });
                (document.getElementById(
                  'selectedFile',
                ) as HTMLInputElement).value = null as any;
              }}
            />
          </div>
        )
      )}
    </CredentialInfoForm>
  );
};

const TableCatalog = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => {
  const tableCatalog = db?.catalog || [];
  const catalogError = validationErrors || {};

  return (
    <StyledCatalogTable>
      <h4 className="gsheet-title">
        {t('Connect Google Sheets as tables to this database')}
      </h4>
      <div>
        {tableCatalog?.map((sheet: CatalogObject, idx: number) => (
          <>
            <FormLabel className="catalog-label" required>
              {t('Google Sheet Name and URL')}
            </FormLabel>
            <div className="catalog-name">
              <ValidatedInput
                className="catalog-name-input"
                required={required}
                validationMethods={{ onBlur: getValidation }}
                errorMessage={catalogError[idx]?.name}
                placeholder={t('Enter a name for this sheet')}
                onChange={(e: { target: { value: any } }) => {
                  changeMethods.onParametersChange({
                    target: {
                      type: `catalog-${idx}`,
                      name: 'name',
                      value: e.target.value,
                    },
                  });
                }}
                value={sheet.name}
              />
              {tableCatalog?.length > 1 && (
                <CloseOutlined
                  className="catalog-delete"
                  onClick={() => changeMethods.onRemoveTableCatalog(idx)}
                />
              )}
            </div>
            <ValidatedInput
              className="catalog-name-url"
              required={required}
              validationMethods={{ onBlur: getValidation }}
              errorMessage={catalogError[idx]?.url}
              placeholder={t('Paste the shareable Google Sheet URL here')}
              onChange={(e: { target: { value: any } }) =>
                changeMethods.onParametersChange({
                  target: {
                    type: `catalog-${idx}`,
                    name: 'value',
                    value: e.target.value,
                  },
                })
              }
              value={sheet.value}
            />
          </>
        ))}
        <StyledFooterButton
          className="catalog-add-btn"
          onClick={() => {
            changeMethods.onAddTableCatalog();
          }}
        >
          + {t('Add sheet')}
        </StyledFooterButton>
      </div>
    </StyledCatalogTable>
  );
};

const hostField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="host"
    name="host"
    value={db?.parameters?.host}
    required={required}
    hasTooltip
    tooltipText={t(
      'This can be either an IP address (e.g. 127.0.0.1) or a domain name (e.g. mydatabase.com).',
    )}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.host}
    placeholder="e.g. 127.0.0.1"
    className="form-group-w-50"
    label="Host"
    onChange={changeMethods.onParametersChange}
  />
);
const portField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <>
    <ValidatedInput
      id="port"
      name="port"
      type="number"
      required={required}
      value={db?.parameters?.port as number}
      validationMethods={{ onBlur: getValidation }}
      errorMessage={validationErrors?.port}
      placeholder="e.g. 5432"
      className="form-group-w-50"
      label="Port"
      onChange={changeMethods.onParametersChange}
    />
  </>
);
const databaseField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="database"
    name="database"
    required={required}
    value={db?.parameters?.database}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.database}
    placeholder="e.g. world_population"
    label="Database name"
    onChange={changeMethods.onParametersChange}
    helpText={t('Copy the name of the  database you are trying to connect to.')}
  />
);
const usernameField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="username"
    name="username"
    required={required}
    value={db?.parameters?.username}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.username}
    placeholder="e.g. Analytics"
    label="Username"
    onChange={changeMethods.onParametersChange}
  />
);
const passwordField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
  isEditMode,
}: FieldPropTypes) => (
  <ValidatedInput
    id="password"
    name="password"
    required={required}
    type={isEditMode && 'password'}
    value={db?.parameters?.password}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.password}
    placeholder="e.g. ********"
    label="Password"
    onChange={changeMethods.onParametersChange}
  />
);
const displayField = ({
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <>
    <ValidatedInput
      id="database_name"
      name="database_name"
      required
      value={db?.database_name}
      validationMethods={{ onBlur: getValidation }}
      errorMessage={validationErrors?.database_name}
      placeholder=""
      label={t('Display Name')}
      onChange={changeMethods.onChange}
      helpText={t(
        'Pick a nickname for this database to display as in Superset.',
      )}
    />
  </>
);

const queryField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="query_input"
    name="query_input"
    required={required}
    value={db?.query_input || ''}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.query}
    placeholder="e.g. param1=value1&param2=value2"
    label="Additional Parameters"
    onChange={changeMethods.onQueryChange}
    helpText={t('Add additional custom parameters')}
  />
);

const forceSSLField = ({
  isEditMode,
  changeMethods,
  db,
  sslForced,
}: FieldPropTypes) => (
  <div css={(theme: SupersetTheme) => infoTooltip(theme)}>
    <Switch
      disabled={sslForced && !isEditMode}
      checked={db?.parameters?.encryption || sslForced}
      onChange={changed => {
        changeMethods.onParametersChange({
          target: {
            type: 'toggle',
            name: 'encryption',
            checked: true,
            value: changed,
          },
        });
      }}
    />
    <span css={toggleStyle}>SSL</span>
    <InfoTooltip
      tooltip={t('SSL Mode "require" will be used.')}
      placement="right"
      viewBox="0 -5 24 24"
    />
  </div>
);

const FORM_FIELD_MAP = {
  host: hostField,
  port: portField,
  database: databaseField,
  username: usernameField,
  password: passwordField,
  database_name: displayField,
  query: queryField,
  encryption: forceSSLField,
  credentials_info: CredentialsInfo,
  service_account_info: CredentialsInfo,
  catalog: TableCatalog,
};

const DatabaseConnectionForm = ({
  dbModel: { parameters },
  onParametersChange,
  onChange,
  onQueryChange,
  onParametersUploadFileChange,
  onAddTableCatalog,
  onRemoveTableCatalog,
  validationErrors,
  getValidation,
  db,
  isEditMode = false,
  sslForced,
  editNewDb,
}: {
  isEditMode?: boolean;
  sslForced: boolean;
  editNewDb?: boolean;
  dbModel: DatabaseForm;
  db: Partial<DatabaseObject> | null;
  onParametersChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onQueryChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onParametersUploadFileChange?: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onAddTableCatalog: () => void;
  onRemoveTableCatalog: (idx: number) => void;
  validationErrors: JsonObject | null;
  getValidation: () => void;
}) => (
  <>
    <div
      // @ts-ignore
      css={(theme: SupersetTheme) => [
        formScrollableStyles,
        validatedFormStyles(theme),
      ]}
    >
      {parameters &&
        FormFieldOrder.filter(
          (key: string) =>
            Object.keys(parameters.properties).includes(key) ||
            key === 'database_name',
        ).map(field =>
          FORM_FIELD_MAP[field]({
            required: parameters.required?.includes(field),
            changeMethods: {
              onParametersChange,
              onChange,
              onQueryChange,
              onParametersUploadFileChange,
              onAddTableCatalog,
              onRemoveTableCatalog,
            },
            validationErrors,
            getValidation,
            db,
            key: field,
            isEditMode,
            sslForced,
            editNewDb,
          }),
        )}
    </div>
  </>
);
export const FormFieldMap = FORM_FIELD_MAP;

export default DatabaseConnectionForm;
