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
import React, { FormEvent } from 'react';
import { SupersetTheme, JsonObject } from '@superset-ui/core';
import { InputProps } from 'antd/lib/input';
import { Form } from 'src/components/Form';
import {
  accessTokenField,
  databaseField,
  displayField,
  forceSSLField,
  hostField,
  httpPath,
  passwordField,
  portField,
  queryField,
  usernameField,
} from './CommonParameters';
import { validatedInputField } from './ValidatedInputField';
import { EncryptedField } from './EncryptedField';
import { TableCatalog } from './TableCatalog';
import { formScrollableStyles, validatedFormStyles } from '../styles';
import { DatabaseForm, DatabaseObject } from '../../types';

export const FormFieldOrder = [
  'host',
  'port',
  'database',
  'username',
  'password',
  'access_token',
  'http_path',
  'database_name',
  'credentials_info',
  'service_account_info',
  'catalog',
  'query',
  'encryption',
  'account',
  'warehouse',
  'role',
];

export interface FieldPropTypes {
  required: boolean;
  hasTooltip?: boolean;
  tooltipText?: (value: any) => string;
  placeholder?: string;
  onParametersChange: (value: any) => string;
  onParametersUploadFileChange: (value: any) => string;
  changeMethods: { onParametersChange: (value: any) => string } & {
    onChange: (value: any) => string;
  } & {
    onQueryChange: (value: any) => string;
  } & { onParametersUploadFileChange: (value: any) => string } & {
    onAddTableCatalog: () => void;
    onRemoveTableCatalog: (idx: number) => void;
  } & {
    onExtraInputChange: (value: any) => void;
    onSSHTunnelParametersChange: (value: any) => string;
  };
  validationErrors: JsonObject | null;
  getValidation: () => void;
  db?: DatabaseObject;
  field: string;
  isEditMode?: boolean;
  sslForced?: boolean;
  defaultDBName?: string;
  editNewDb?: boolean;
}

const FORM_FIELD_MAP = {
  host: hostField,
  http_path: httpPath,
  port: portField,
  database: databaseField,
  username: usernameField,
  password: passwordField,
  access_token: accessTokenField,
  database_name: displayField,
  query: queryField,
  encryption: forceSSLField,
  credentials_info: EncryptedField,
  service_account_info: EncryptedField,
  catalog: TableCatalog,
  warehouse: validatedInputField,
  role: validatedInputField,
  account: validatedInputField,
};

interface DatabaseConnectionFormProps {
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
  onExtraInputChange: (
    event: FormEvent<InputProps> | { target: HTMLInputElement },
  ) => void;
  onAddTableCatalog: () => void;
  onRemoveTableCatalog: (idx: number) => void;
  validationErrors: JsonObject | null;
  getValidation: () => void;
  getPlaceholder?: (field: string) => string | undefined;
}

const DatabaseConnectionForm = ({
  dbModel: { parameters },
  db,
  editNewDb,
  getPlaceholder,
  getValidation,
  isEditMode = false,
  onAddTableCatalog,
  onChange,
  onExtraInputChange,
  onParametersChange,
  onParametersUploadFileChange,
  onQueryChange,
  onRemoveTableCatalog,
  sslForced,
  validationErrors,
}: DatabaseConnectionFormProps) => (
  <Form>
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
              onExtraInputChange,
            },
            validationErrors,
            getValidation,
            db,
            key: field,
            field,
            isEditMode,
            sslForced,
            editNewDb,
            placeholder: getPlaceholder ? getPlaceholder(field) : undefined,
          }),
        )}
    </div>
  </Form>
);
export const FormFieldMap = FORM_FIELD_MAP;

export default DatabaseConnectionForm;
