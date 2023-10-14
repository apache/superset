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
import {
  Registry,
  makeSingleton,
  OverwritePolicy,
  ErrorTypeEnum,
  ErrorLevel,
} from '@superset-ui/core';
import { ErrorMessageComponent } from './types';

/* Generic error to be returned when the backend returns an error response that is not
 * SIP-41 compliant. */
const genericSupersetError = (extra: object) => ({
  error_type: ErrorTypeEnum.GENERIC_BACKEND_ERROR,
  extra,
  level: 'error' as ErrorLevel,
  message: 'An error occurred',
});
class ErrorMessageComponentRegistry extends Registry<
  ErrorMessageComponent,
  ErrorMessageComponent
> {
  constructor() {
    super({
      name: 'ErrorMessageComponent',
      overwritePolicy: OverwritePolicy.ALLOW,
      defaultValue: genericSupersetError,
    });
  }
}

const getErrorMessageComponentRegistry = makeSingleton(
  ErrorMessageComponentRegistry,
);

export default getErrorMessageComponentRegistry;
