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
import { ErrorTypeEnum } from '@superset-ui/core';
import getErrorMessageComponentRegistry from 'src/components/ErrorMessage/getErrorMessageComponentRegistry';
import TimeoutErrorMessage from 'src/components/ErrorMessage/TimeoutErrorMessage';
import DatabaseErrorMessage from 'src/components/ErrorMessage/DatabaseErrorMessage';
import MarshmallowErrorMessage from 'src/components/ErrorMessage/MarshmallowErrorMessage';
import ParameterErrorMessage from 'src/components/ErrorMessage/ParameterErrorMessage';
import DatasetNotFoundErrorMessage from 'src/components/ErrorMessage/DatasetNotFoundErrorMessage';
import OAuth2RedirectMessage from 'src/components/ErrorMessage/OAuth2RedirectMessage';

import setupErrorMessagesExtra from './setupErrorMessagesExtra';

export default function setupErrorMessages() {
  const errorMessageComponentRegistry = getErrorMessageComponentRegistry();

  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.FRONTEND_TIMEOUT_ERROR,
    TimeoutErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.BACKEND_TIMEOUT_ERROR,
    TimeoutErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.DATABASE_NOT_FOUND_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.GENERIC_DB_ENGINE_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.GENERIC_BACKEND_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.COLUMN_DOES_NOT_EXIST_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.TABLE_DOES_NOT_EXIST_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.MISSING_TEMPLATE_PARAMS_ERROR,
    ParameterErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.INVALID_TEMPLATE_PARAMS_ERROR,
    ParameterErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.RESULTS_BACKEND_NOT_CONFIGURED_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.DML_NOT_ALLOWED_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.INVALID_CTAS_QUERY_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.INVALID_CVAS_QUERY_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.QUERY_SECURITY_ACCESS_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.CONNECTION_INVALID_HOSTNAME_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.RESULTS_BACKEND_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.ASYNC_WORKERS_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.SQLLAB_TIMEOUT_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.CONNECTION_PORT_CLOSED_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.CONNECTION_HOST_DOWN_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.CONNECTION_INVALID_USERNAME_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.CONNECTION_INVALID_PASSWORD_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.CONNECTION_ACCESS_DENIED_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.CONNECTION_UNKNOWN_DATABASE_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.SCHEMA_DOES_NOT_EXIST_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.OBJECT_DOES_NOT_EXIST_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.SYNTAX_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.CONNECTION_DATABASE_PERMISSIONS_ERROR,
    DatabaseErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.FAILED_FETCHING_DATASOURCE_INFO_ERROR,
    DatasetNotFoundErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.MARSHMALLOW_ERROR,
    MarshmallowErrorMessage,
  );
  errorMessageComponentRegistry.registerValue(
    ErrorTypeEnum.OAUTH2_REDIRECT,
    OAuth2RedirectMessage,
  );
  setupErrorMessagesExtra();
}
