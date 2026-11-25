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
import { FieldPropTypes } from '../../types';
import {
  forceSSLField as ForceSSLField,
  portField as PortField,
} from './CommonParameters';

/**
 * Druid-specific variants of the common connection form fields.
 *
 * Superset connects to Druid's SQL endpoint on the broker (port 8082 by
 * default) or the router (8888), and the encryption toggle switches the pydruid
 * dialect from `druid://` (HTTP) to `druid+https://` rather than setting a
 * Postgres-style SSL mode. Only the text differs, so these render the common
 * fields rather than duplicating them.
 */
export const DRUID_ENGINE = 'druid';

export const druidPortField = (props: FieldPropTypes) => (
  <PortField
    {...props}
    portPlaceholder={t('e.g. 8082 (8888 for the router)')}
  />
);

export const druidEncryptionField = (props: FieldPropTypes) => (
  <ForceSSLField
    {...props}
    sslTooltip={t('HTTPS will be used to connect to the Druid SQL endpoint.')}
  />
);

export const DRUID_FORM_FIELD_MAP = {
  port: druidPortField,
  encryption: druidEncryptionField,
};
