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
import { QueryObject } from './types/Query';

const ALLOWED_OVERRIDES = ['time_grain_sqla', 'time_range', 'since', 'until'];
const ALLOWED_APPENDS = ['adhoc_filters', 'filters', 'groupby'];

export function overrideExtraFormData(
  queryObject: QueryObject,
  overrideFormData: Partial<QueryObject>,
): QueryObject {
  const overriddenFormData = { ...queryObject };
  ALLOWED_OVERRIDES.forEach(key => {
    if (key in overrideFormData) {
      overriddenFormData[key] = overrideFormData[key];
    }
  });
  return overriddenFormData;
}

export function appendExtraFormData(
  queryObject: QueryObject,
  appendFormData: Partial<QueryObject>,
): QueryObject {
  const appendedFormData = { ...queryObject };
  ALLOWED_APPENDS.forEach(key => {
    if (key in appendFormData) {
      const append = appendFormData[key];
      const currentValue = appendedFormData[key] || [];
      // @ts-ignore
      currentValue.push(...append);
      appendedFormData[key] = currentValue;
    }
  });

  // Add freeform where
  const { extras = {} } = appendedFormData;
  const { where = '' } = extras;
  extras.where = where;

  const { extras: appendExtras = {} } = appendFormData;
  let { where: appendWhere } = appendExtras;

  if (appendWhere) {
    appendedFormData.extras = extras;
    appendWhere = `(${appendWhere})`;
  }
  if (where) {
    appendWhere = `(${where}) AND ${appendWhere}`;
  }
  extras.where = appendWhere;

  return appendedFormData;
}
