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
import { SupersetTheme, JsonObject } from '@superset-ui/core';
import { InputProps } from 'antd/lib/input';
import { Select, Button } from 'src/common/components';
import ValidatedInput from 'src/components/Form/LabeledErrorBoundInput';
import { DeleteFilled } from '@ant-design/icons';
import {
  StyledFormHeader,
  formScrollableStyles,
  validatedFormStyles,
  CredentialInfoForm,
} from './styles';
import { DatabaseForm } from '../types';

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
  'credentials_info',
];

interface FieldPropTypes {
  required: boolean;
  changeMethods: { onParametersChange: (value: any) => string } & {
    onChange: (value: any) => string;
  } & { onParametersUploadFileChange: (value: any) => string };
  validationErrors: JsonObject | null;
  getValidation: () => void;
}

const credentialsInfo = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
}: FieldPropTypes) => {
  const [uploadOption, setUploadOption] = useState<string>('upload');
  const [fileToUpload, setFileToUpload] = useState<string>(null);
  return (
    <CredentialInfoForm>
      <label className="label-select">
        How do you want to enter service account credentials?
      </label>
      <Select
        defaultValue={CredentialInfoOptions.jsonUpload}
        style={{ width: '100%' }}
        onChange={setUploadOption}
      >
        <Select.Option value={CredentialInfoOptions.jsonUpload}>
          Upload JSON file
        </Select.Option>
        <Select.Option value={CredentialInfoOptions.copyPaste}>
          Copy and Paste JSON credentials
        </Select.Option>
      </Select>
      {uploadOption === 'paste' ? (
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
              onClick={() => document.getElementById('selectedFile').click()}
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
                  changeMethods.onParametersUploadFileChange({
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
              const file = event?.target?.files[0];
              setFileToUpload(file.name);
              changeMethods.onParametersUploadFileChange({
                target: {
                  name: 'encrypted_extra',
                  value: await file.text(),
                },
              });
              document.getElementById('selectedFile').value = null;
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
}: FieldPropTypes) => (
  <ValidatedInput
    id="host"
    name="host"
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
}: FieldPropTypes) => (
  <ValidatedInput
    id="port"
    name="port"
    required={required}
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
}: FieldPropTypes) => (
  <ValidatedInput
    id="database"
    name="database"
    required={required}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.database}
    placeholder="e.g. world_population"
    label="Database name"
    onChange={changeMethods.onParametersChange}
    helpText="Copy the name of the PostgreSQL database you are trying to connect to."
  />
);
const usernameField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
}: FieldPropTypes) => (
  <ValidatedInput
    id="username"
    name="username"
    required={required}
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
}: FieldPropTypes) => (
  <ValidatedInput
    id="password"
    name="password"
    required={required}
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
}: FieldPropTypes) => (
  <ValidatedInput
    id="database_name"
    name="database_name"
    required={required}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.database_name}
    placeholder=""
    label="Display Name"
    onChange={changeMethods.onChange}
    helpText="Pick a nickname for this database to display as in Superset."
  />
);

const FORM_FIELD_MAP = {
  host: hostField,
  port: portField,
  database: databaseField,
  username: usernameField,
  password: passwordField,
  database_name: displayField,
  credentials_info: credentialsInfo,
};

const DatabaseConnectionForm = ({
  dbModel: { name, parameters },
  onParametersChange,
  onChange,
  onParametersUploadFileChange,
  validationErrors,
  getValidation,
}: {
  dbModel: DatabaseForm;
  onParametersChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onParametersUploadFileChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  validationErrors: JsonObject | null;
  getValidation: () => void;
}) => (
  <>
    <StyledFormHeader>
      <h4>Enter the required {name} credentials</h4>
      <p className="helper">
        Need help? Learn more about connecting to {name}.
      </p>
    </StyledFormHeader>
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
            required: parameters.required.includes(field),
            changeMethods: {
              onParametersChange,
              onChange,
              onParametersUploadFileChange,
            },
            validationErrors,
            getValidation,
            key: field,
          }),
        )}
    </div>
  </>
);
export const FormFieldMap = FORM_FIELD_MAP;

export default DatabaseConnectionForm;
