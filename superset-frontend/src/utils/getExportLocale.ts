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
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';

/**
 * Read the number-format locale from the page URL for chart exports.
 * Supported values: en_US, en_GB, de_DE, es_ES, fr_FR, it_IT, nl_NL, pl_PL.
 * Returns undefined when absent.
 */
export function getExportLocale(): string | undefined {
  return getUrlParam(URL_PARAMS.locale) || undefined;
}
