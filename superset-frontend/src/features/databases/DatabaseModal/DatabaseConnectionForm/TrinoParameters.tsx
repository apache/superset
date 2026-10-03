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
import { SupersetTheme } from '@apache-superset/core/theme';
import { Switch } from '@superset-ui/core/components/Switch';
import {
  InfoTooltip,
  LabeledErrorBoundInput as ValidatedInput,
} from '@superset-ui/core/components';
import { FieldPropTypes } from '../../types';
import { toggleStyle, infoTooltip } from '../styles';

/**
 * Trino-specific variants of the common connection form fields.
 *
 * In a Trino SQLAlchemy URI (``trino://user@host:port/<catalog>[/schema]``)
 * the ``database`` component is the Trino catalog, the coordinator listens on
 * 8080 by default (443 behind HTTPS), and the encryption toggle switches the
 * client to HTTPS rather than setting a Postgres-style SSL mode.
 */
export const TRINO_ENGINE = 'trino';

export const trinoCatalogField = ({
  required,
  changeMethods,
  getValidation,
  validationErrors,
  description,
  db,
  isValidating,
}: FieldPropTypes) => (
  <ValidatedInput
    isValidating={isValidating}
    id="database"
    name="database"
    required={required}
    value={db?.parameters?.database}
    validationMethods={{ onBlur: getValidation }}
    errorMessage={validationErrors?.database}
    placeholder={t('e.g. hive')}
    label={description || t('Catalog name')}
    onChange={changeMethods.onParametersChange}
    helpText={t(
      'The Trino catalog to connect to (e.g. hive, iceberg). It is used as the database in the SQLAlchemy URI.',
    )}
  />
);

export const trinoPortField = ({
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
    placeholder={t('e.g. 8080 (443 for HTTPS)')}
    className="form-group-w-50"
    label={t('Port')}
    onChange={changeMethods.onParametersChange}
  />
);

export const trinoEncryptionField = ({
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
    <span css={toggleStyle}>{t('SSL')}</span>
    <InfoTooltip
      tooltip={t('HTTPS will be used to connect to the Trino coordinator.')}
      placement="right"
    />
  </div>
);

export const TRINO_FORM_FIELD_MAP = {
  database: trinoCatalogField,
  port: trinoPortField,
  encryption: trinoEncryptionField,
};
