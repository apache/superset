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
import memoizeOne from 'memoize-one';
import { DataRecord } from '@superset-ui/core';
import { UrlLinkConfig } from '../types';

const parseLinkSchema = (schema: string) => schema.match(/(?<=\$\{).*?(?=\})/g);

const genLinkHref = (values: DataRecord, schema: string) => {
  let result = schema;
  parseLinkSchema(schema)?.forEach(name => {
    const val = values[name]?.toString() || '';
    result = result.replace(`$\{${name}}`, val);
  });
  return result;
};

export const getTextFromValues = memoizeOne(
  (columnConfig: UrlLinkConfig[] | undefined) =>
    columnConfig?.map(({ columnName, linkText, linkSchema }) => ({
      column: columnName!,
      linkText: linkText!,
      getTextFromValues: (_val: number, values: DataRecord) =>
        genLinkHref(values, linkSchema!),
    })),
);
