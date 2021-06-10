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
import { DeleteFilled } from '@ant-design/icons';
import {
  formScrollableStyles,
  validatedFormStyles,
  CredentialInfoForm,
  toggleStyle,
  infoTooltip,
} from './styles';
import { DatabaseForm, DatabaseObject } from '../types';

enum CredentialInfoOptions {
  jsonUpload,
  copyPaste,
}

export const FormFieldOrder = [
  'host',
  'port',
  'database',
  'username',
  'password',
  'database_name',
  'query',
  'encryption',
  'credentials_info',
];

const selectedFile = document.getElementById('selectedFile');

interface FieldPropTypes {
  required: boolean;
  onParametersChange: (value: any) => string;
  onParametersUploadFileChange: (value: any) => string;
  changeMethods: { onParametersChange: (value: any) => string } & {
    onChange: (value: any) => string;
  } & { onParametersUploadFileChange: (value: any) => string };
  validationErrors: JsonObject | null;
  getValidation: () => void;
  db?: DatabaseObject;
  isEditMode?: boolean;
  sslForced?: boolean;
}

const CredentialsInfo = ({ changeMethods }: FieldPropTypes) => {
  const [uploadOption, setUploadOption] = useState<number>(0);
  const [fileToUpload, setFileToUpload] = useState<string | null | undefined>(
    null,
  );
  return (
    <CredentialInfoForm>
      <span className="label-select">
        How do you want to enter service account credentials?
      </span>
      <Select
        defaultValue={CredentialInfoOptions.jsonUpload}
        style={{ width: '100%' }}
        onChange={option => setUploadOption(option)}
      >
        <Select.Option value={CredentialInfoOptions.jsonUpload}>
          Upload JSON file
        </Select.Option>
        <Select.Option value={CredentialInfoOptions.copyPaste}>
          Copy and Paste JSON credentials
        </Select.Option>
      </Select>
      {uploadOption === CredentialInfoOptions.copyPaste ? (
        <div className="input-container" onChange={changeMethods.onChange}>
          <span className="label-select">Service Account</span>
          <textarea className="input-form" name="encrypted_extra" />
          <span className="label-paste">
            Copy and paste the entire service account .json file here
          </span>
        </div>
      ) : (
        <div className="input-container">
          <span className="label-select">Upload Credentials</span>
          {!fileToUpload && (
            <Button
              className="input-upload-btn"
              onClick={() => document?.getElementById('selectedFile')?.click()}
            >
              Choose File
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
                      name: 'encrypted_extra',
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
                  name: 'encrypted_extra',
                  value: await file?.text(),
                  checked: false,
                },
              });
              (selectedFile as HTMLInputElement).value = null as any;
            }}
          />
        </div>
      )}
    </CredentialInfoForm>
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
  <ValidatedInput
    id="port"
    name="port"
    type="number"
    required={required}
    value={db?.parameters?.port}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.port}
    placeholder="e.g. 5432"
    className="form-group-w-50"
    label="Port"
    onChange={changeMethods.onParametersChange}
  />
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
    helpText="Copy the name of the  database you are trying to connect to."
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
}: FieldPropTypes) => (
  <ValidatedInput
    id="password"
    name="password"
    required={required}
    type="password"
    value={db?.parameters?.password}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.password}
    placeholder="e.g. ********"
    label="Password"
    onChange={changeMethods.onParametersChange}
  />
);
const displayField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="database_name"
    name="database_name"
    required={required}
    value={db?.database_name}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.database_name}
    placeholder=""
    label="Display Name"
    onChange={changeMethods.onChange}
    helpText="Pick a nickname for this database to display as in Superset."
  />
);

const queryField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="query"
    name="query"
    required={required}
    value={db?.parameters?.query}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.query}
    placeholder="e.g. additional parameters"
    label="Additional Parameters"
    onChange={changeMethods.onParametersChange}
    helpText="Add additional custom parameters"
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
      tooltip={t('SSL will be enabled in the database connection')}
      placement="bottomRight"
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
};

const DatabaseConnectionForm = ({
  dbModel: { parameters },
  onParametersChange,
  onChange,
  onParametersUploadFileChange,
  validationErrors,
  getValidation,
  db,
  isEditMode = false,
  sslForced,
}: {
  isEditMode?: boolean;
  sslForced: boolean;
  dbModel: DatabaseForm;
  db: Partial<DatabaseObject> | null;
  onParametersChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onParametersUploadFileChange?: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
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
              onParametersUploadFileChange,
            },
            validationErrors,
            getValidation,
            db,
            key: field,
            isEditMode,
            sslForced,
          }),
        )}
    </div>
  </>
);
export const FormFieldMap = FORM_FIELD_MAP;

export default DatabaseConnectionForm;
