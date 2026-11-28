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
import { GenericDataType } from '@apache-superset/core/common';
import { t } from '@apache-superset/core/translation';
import { getTimeFormatter, TimeFormats } from '@superset-ui/core';
import { TreeTableColumn } from './types';

/** Build table columns with labels from the dataset; temporal values use the database datetime format. */
export default function buildColumns(
  keys: string[],
  colnames: string[],
  coltypes: GenericDataType[],
  verboseMap: Record<string, string> = {},
): TreeTableColumn[] {
  return [...new Set(keys)].filter(Boolean).map(key => {
    const dataType = coltypes[colnames.indexOf(key)];
    const timeFormatter = getTimeFormatter(TimeFormats.DATABASE_DATETIME);
    return {
      key,
      label: verboseMap[key] || key,
      dataType,
      formatter: (value: unknown) => {
        if (value === null || value === undefined) return t('N/A');
        return dataType === GenericDataType.Temporal &&
          typeof value === 'number'
          ? timeFormatter(value)
          : String(value);
      },
    };
  });
}
