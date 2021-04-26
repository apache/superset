/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { QueryParamConfig } from 'use-query-params';

// Query parameters intended for use with the use-query-params hook

/** A query param config for Superset's specific boolean query param implementation.
 * See also:
 * https://github.com/apache/superset/blob/d7fc2031b12c040a4655b329de085aa0cf30d911/superset/utils/core.py#L283
 */
export const SupersetTruthyParam: QueryParamConfig<boolean, any> = {
  encode: (data?: any | null) => (data ? 'true' : undefined),
  decode: (dataStr?: string | string[]) =>
    dataStr !== 'false' && dataStr !== '0',
};
