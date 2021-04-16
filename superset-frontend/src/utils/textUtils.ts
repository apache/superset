/* Licensed to the Apache Software Foundation (ASF) under one
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

/* eslint-disable global-require */
import { t } from '@superset-ui/core';

const loadModule = () => {
  let module;
  try {
    // eslint-disable-next-line import/no-unresolved
    // @ts-ignore
    module = require('../../../superset_text');
  } catch (e) {
    module = {};
  }
  return module;
};

const supersetText = loadModule();

// if the translation is the same as the string passed in
// then the translation doesn't exist, so return the value
// params: overwrite key, overwrite value, default value
export const st = (oKey, oValue, dValue) =>
  t(oKey) === oKey ? oValue || dValue : t(oKey);

export type SupersetTextType = {
  DATABASE_MODAL?: {
    SQLALCHEMY_DISPLAY_TEXT?: string;
    SQLALCHEMY_DOCS_URL?: string;
  };
};

export default supersetText;
