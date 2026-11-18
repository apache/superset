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
import { getBootstrapDataFromDocument } from './mapStyles';

export interface ConstantLabelMap {
  [key: string]: string;
}

type BootstrapData = {
  common?: {
    constant_labels: ConstantLabelMap;
  };
};

export const bootstrapData: ConstantLabelMap =
  (getBootstrapDataFromDocument() as BootstrapData | undefined)?.common
    ?.constant_labels || {};

export const getConstantLabel = (value: string): string =>
  bootstrapData[value] ?? value;

// Keep in sync with superset/constants.py.

// Note: All *_STRING constants are dynamically mocked inside
// superset-frontend/spec/helpers/setup.ts to inject dummy labels automatically
// across all frontend unit tests.
export const EMPTY_STRING = '<empty string>';
export const FALSE_STRING = 'FALSE';
export const NULL_STRING = '<NULL>';
export const TRUE_STRING = 'TRUE';

export const EMPTY_FILTER_SQL_EXPRESSION = '1 = 0';
