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

export interface SupersetTextConfig {
  DB_IMAGES?: Record<string, string>;
  DB_CONNECTION_ALERTS?: {
    DEFAULT?: {
      message?: string;
      description?: string;
    };
    ADD_DATABASE?: {
      message?: string;
      description?: string;
      contact_link?: string;
      contact_description_link?: string;
    };
    REGIONAL_IPS?: Record<string, string>;
    [key: string]: unknown;
  };
  DB_CONNECTION_DOC_LINKS?: Record<string, string> & {
    default?: string;
    support?: string;
  };
  DB_MODAL_SQLALCHEMY_FORM?: {
    SQLALCHEMY_DOCS_URL?: string;
    SQLALCHEMY_DISPLAY_TEXT?: string;
  };
  THEME_MODAL?: {
    THEME_EDITOR_URL?: string;
    DOCUMENTATION_URL?: string;
  };
  ERRORS?: Record<string, string>;
  [key: string]: unknown;
}

const loadModule = (): SupersetTextConfig => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, import/no-dynamic-require
    const config = require('../../../superset_text.yml') as SupersetTextConfig;
    return config || {};
  } catch (e) {
    return {};
  }
};

const supersetText: SupersetTextConfig = loadModule();

export default supersetText;
