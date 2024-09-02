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
import { getExtensionsRegistry } from '@superset-ui/core';
import {
  accessTokenField,
  databaseField,
  defaultCatalogField,
  defaultSchemaField,
  displayField,
  forceSSLField,
  hostField,
  httpPath,
  httpPathField,
  passwordField,
  portField,
  queryField,
  usernameField,
} from './CommonParameters';
import { OAuth2ClientField } from './OAuth2ClientField';
import { validatedInputField } from './ValidatedInputField';
import { EncryptedField } from './EncryptedField';
import { TableCatalog } from './TableCatalog';
import SSHTunnelSwitch from '../SSHTunnelSwitch';

export const FormFieldOrder = [
  'host',
  'port',
  'database',
  'default_catalog',
  'default_schema',
  'username',
  'password',
  'access_token',
  'http_path',
  'http_path_field',
  'database_name',
  'credentials_info',
  'service_account_info',
  'catalog',
  'query',
  'encryption',
  'account',
  'warehouse',
  'role',
  'ssh',
  'oauth2_client',
];

const extensionsRegistry = getExtensionsRegistry();

const SSHTunnelSwitchComponent =
  extensionsRegistry.get('ssh_tunnel.form.switch') ?? SSHTunnelSwitch;

export const FORM_FIELD_MAP = {
  host: hostField,
  http_path: httpPath,
  http_path_field: httpPathField,
  port: portField,
  database: databaseField,
  default_catalog: defaultCatalogField,
  default_schema: defaultSchemaField,
  username: usernameField,
  password: passwordField,
  oauth2_client: OAuth2ClientField,
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
  ssh: SSHTunnelSwitchComponent,
};
