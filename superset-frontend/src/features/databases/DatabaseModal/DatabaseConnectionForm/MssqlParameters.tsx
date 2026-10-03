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
 * SQL Server listens on port 1433 by default. The mssql engine covers both
 * Microsoft SQL Server and Azure Synapse, which share that default.
 */
export const MSSQL_ENGINE = 'mssql';

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
  port: mssqlPortField,
};
