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
import { SupersetTheme, t } from '@superset-ui/core';
import { Switch } from 'src/components/Switch';
import InfoTooltip from 'src/components/InfoTooltip';
import ValidatedInput from 'src/components/Form/LabeledErrorBoundInput';
import { FieldPropTypes } from '../../types';
import { toggleStyle, infoTooltip } from '../styles';

export const hostField = ({
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
    placeholder={t('e.g. 127.0.0.1')}
    className="form-group-w-50"
    label={t('Host')}
    onChange={changeMethods.onParametersChange}
  />
);

export const portField = ({
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
      placeholder={t('e.g. 5432')}
      className="form-group-w-50"
      label={t('Port')}
      onChange={changeMethods.onParametersChange}
    />
  </>
);
export const httpPath = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => {
  const extraJson = JSON.parse(db?.extra || '{}');
  return (
    <ValidatedInput
      id="http_path"
      name="http_path"
      required={required}
      value={extraJson.engine_params?.connect_args?.http_path}
      validationMethods={{ onBlur: getValidation }}
      errorMessage={validationErrors?.http_path}
      placeholder={t('e.g. sql/protocolv1/o/12345')}
      label="HTTP Path"
      onChange={changeMethods.onExtraInputChange}
      helpText={t('Copy the name of the HTTP Path of your cluster.')}
    />
  );
};
export const databaseField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  placeholder,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="database"
    name="database"
    required={required}
    value={db?.parameters?.database}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.database}
    placeholder={placeholder ?? t('e.g. world_population')}
    label={t('Database name')}
    onChange={changeMethods.onParametersChange}
    helpText={t('Copy the name of the database you are trying to connect to.')}
  />
);
export const defaultCatalogField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="default_catalog"
    name="default_catalog"
    required={required}
    value={db?.parameters?.default_catalog}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.default_catalog}
    placeholder={t('e.g. hive_metastore')}
    label={t('Default Catalog')}
    onChange={changeMethods.onParametersChange}
    helpText={t('The default catalog that should be used for the connection.')}
  />
);
export const defaultSchemaField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="default_schema"
    name="default_schema"
    required={required}
    value={db?.parameters?.default_schema}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.default_schema}
    placeholder={t('e.g. default')}
    label={t('Default Schema')}
    onChange={changeMethods.onParametersChange}
    helpText={t('The default schema that should be used for the connection.')}
  />
);
export const httpPathField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <ValidatedInput
    id="http_path_field"
    name="http_path_field"
    required={required}
    value={db?.parameters?.http_path_field}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.http_path}
    placeholder={t('e.g. sql/protocolv1/o/12345')}
    label="HTTP Path"
    onChange={changeMethods.onParametersChange}
    helpText={t('Copy the name of the HTTP Path of your cluster.')}
  />
);
export const usernameField = ({
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
    placeholder={t('e.g. Analytics')}
    label={t('Username')}
    onChange={changeMethods.onParametersChange}
  />
);
export const passwordField = ({
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
    visibilityToggle={!isEditMode}
    value={db?.parameters?.password}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.password}
    placeholder={t('e.g. ********')}
    label={t('Password')}
    onChange={changeMethods.onParametersChange}
  />
);
export const accessTokenField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
  isEditMode,
  default_value,
  description,
}: FieldPropTypes) => (
  <ValidatedInput
    id="access_token"
    name="access_token"
    required={required}
    visibilityToggle={!isEditMode}
    value={db?.parameters?.access_token}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.access_token}
    placeholder={t('Paste your access token here')}
    get_url={
      typeof default_value === 'string' && default_value.includes('https://')
        ? default_value
        : null
    }
    description={description}
    label={t('Access token')}
    onChange={changeMethods.onParametersChange}
  />
);
export const displayField = ({
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
        'Pick a nickname for how the database will display in Superset.',
      )}
    />
  </>
);

export const queryField = ({
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
    placeholder={t('e.g. param1=value1&param2=value2')}
    label={t('Additional Parameters')}
    onChange={changeMethods.onQueryChange}
    helpText={t('Add additional custom parameters')}
  />
);

export const forceSSLField = ({
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

export const projectIdfield = ({
  changeMethods,
  getValidation,
  validationErrors,
  db,
}: FieldPropTypes) => (
  <>
    <ValidatedInput
      id="project_id"
      name="project_id"
      required
      value={db?.parameters?.project_id}
      validationMethods={{ onBlur: getValidation }}
      errorMessage={validationErrors?.project_id}
      placeholder="your-project-1234-a1"
      label={t('Project Id')}
      onChange={changeMethods.onParametersChange}
      helpText={t('Enter the unique project id for your database.')}
    />
  </>
);
