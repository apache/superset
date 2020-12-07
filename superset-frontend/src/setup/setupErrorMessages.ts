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
import getErrorMessageComponentRegistry from 'src/components/ErrorMessage/getErrorMessageComponentRegistry';
import { ErrorTypeEnum } from 'src/components/ErrorMessage/types';
import TimeoutErrorMessage from 'src/components/ErrorMessage/TimeoutErrorMessage';
import DatabaseErrorMessage from 'src/components/ErrorMessage/DatabaseErrorMessage';

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
    ErrorTypeEnum.GENERIC_DB_ENGINE_ERROR,
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
  setupErrorMessagesExtra();
}
