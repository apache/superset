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
import { t } from '@apache-superset/core/translation';
import { LabeledErrorBoundInput as ValidatedInput } from '@superset-ui/core/components';
import { FieldPropTypes } from '../../types';

/**
 * Microsoft SQL Server-specific variants of the common connection form fields.
 *
 * SQL Server listens on port 1433 by default. A named instance
 * (``host\INSTANCE``) is reached through its own TCP port, which the host
 * tooltip points out since the form has no separate instance field.
 */
export const MSSQL_ENGINE = 'mssql';

export const mssqlHostField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
  isValidating,
}: FieldPropTypes) => (
  <ValidatedInput
    isValidating={isValidating}
    id="host"
    name="host"
    value={db?.parameters?.host}
    required={required}
    hasTooltip
    tooltipText={t(
      'This can be either an IP address (e.g. 127.0.0.1) or a domain name (e.g. mydatabase.com). For a named instance (host\\INSTANCE), enter only the host here and the port the instance listens on below, or connect with a SQLAlchemy URI instead.',
    )}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.host}
    placeholder={t('e.g. 127.0.0.1')}
    className="form-group-w-50"
    label={t('Host')}
    onChange={changeMethods.onParametersChange}
  />
);

export const mssqlPortField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  db,
  isValidating,
}: FieldPropTypes) => (
  <ValidatedInput
    id="port"
    name="port"
    type="number"
    isValidating={isValidating}
    required={required}
    value={db?.parameters?.port as number}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.port}
    placeholder={t('e.g. 1433')}
    className="form-group-w-50"
    label={t('Port')}
    onChange={changeMethods.onParametersChange}
  />
);

export const MSSQL_FORM_FIELD_MAP = {
  host: mssqlHostField,
  port: mssqlPortField,
};
