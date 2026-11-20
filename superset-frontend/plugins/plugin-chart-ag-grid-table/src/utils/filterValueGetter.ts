/* eslint-disable camelcase */
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
import { ValueGetterParams } from '@superset-ui/core/components/ThemedAgGridReact';

// Reads the raw value rather than parsing the formatted text back, which
// carries the locale's separators and SI suffixes. A percent format shows the
// value scaled by 100, so the filter compares against that scaled number,
// shifted in decimal notation to avoid binary noise (0.07 * 100).
const filterValueGetter = (params: ValueGetterParams, percent: boolean) => {
  // `field` has "Main " stripped on time comparison columns, row data does not
  const key = params.colDef.context?.dataKey ?? params.colDef.field;
  const raw = params.data?.[key as string];
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !raw.trim())) {
    return null;
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return null;
  if (!percent) return numeric;
  const [coefficient, exponent = '0'] = String(numeric).split('e');
  return Number(`${coefficient}e${Number(exponent) + 2}`);
};

export default filterValueGetter;
