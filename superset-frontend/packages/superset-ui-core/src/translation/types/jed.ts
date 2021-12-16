/*
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

/**
 * Translations for a language in the format of { key: [singular, plural, ...]}.
 */
export type Translations = {
  [key: string]: ReadonlyArray<string>;
};

export interface DomainConfig {
  domain: string;
  lang: string;
  // eslint-disable-next-line camelcase
  plural_forms: string;
}

export type DomainData = { '': DomainConfig } & {
  [key: string]: ReadonlyArray<string> | DomainConfig;
};

export interface JedOptions {
  domain: string;
  // eslint-disable-next-line camelcase
  locale_data: {
    [domain: string]: DomainData;
  };
}

export interface Jed {
  translate(input: string): Jed;

  ifPlural(value: number, plural: string): Jed;

  fetch(...args: unknown[]): string;

  options: JedOptions;
}

export default {};
