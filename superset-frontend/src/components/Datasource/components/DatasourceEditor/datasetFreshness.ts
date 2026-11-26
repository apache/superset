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
import { isJsonObject, parseExtra } from './datasetCertification';

/** Where a dataset's source-data timestamp comes from. */
export type FreshnessMode = 'none' | 'column' | 'sql';

/** The `freshness` object stored in a dataset's `extra` JSON. */
export type DatasetFreshnessSetting = {
  column?: string;
  sql?: string;
  warn_after_minutes?: number;
};

/** The freshness setting stored in `extra`, or `{}` when there is none. */
export const getDatasetFreshness = (
  extra?: string,
): DatasetFreshnessSetting => {
  const freshness = parseExtra(extra)?.freshness;
  if (!isJsonObject(freshness)) {
    return {};
  }
  return {
    column: typeof freshness.column === 'string' ? freshness.column : undefined,
    sql: typeof freshness.sql === 'string' ? freshness.sql : undefined,
    warn_after_minutes:
      typeof freshness.warn_after_minutes === 'number'
        ? freshness.warn_after_minutes
        : undefined,
  };
};

export const getFreshnessMode = (
  setting: DatasetFreshnessSetting,
): FreshnessMode => {
  if (setting.sql !== undefined) {
    return 'sql';
  }
  if (setting.column !== undefined) {
    return 'column';
  }
  return 'none';
};

/**
 * Write a freshness setting into `extra`, keeping every other key. An empty
 * setting (no column or SQL yet) removes `freshness` instead, so a half-filled
 * form never stores something the server would reject.
 */
export const setDatasetFreshness = (
  extra: string | undefined,
  setting: DatasetFreshnessSetting,
): string | undefined => {
  const parsedExtra = parseExtra(extra);
  // Leave malformed raw JSON alone while the user fixes it in the Extra field.
  if (!parsedExtra) {
    return extra;
  }

  const column = setting.column?.trim() ? setting.column : undefined;
  const sql = setting.sql?.trim() ? setting.sql : undefined;
  if (!column && !sql) {
    if (!('freshness' in parsedExtra)) {
      return extra;
    }
    delete parsedExtra.freshness;
  } else {
    parsedExtra.freshness = {
      ...(sql ? { sql } : { column }),
      ...(setting.warn_after_minutes
        ? { warn_after_minutes: setting.warn_after_minutes }
        : {}),
    };
  }
  return JSON.stringify(parsedExtra);
};
