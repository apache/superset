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

import { DatasourceType } from '@superset-ui/core';
import type { DashboardInfo } from 'src/dashboard/types';

export type SemanticDataset = NonNullable<
  DashboardInfo['semanticDatasets']
>['datasets'][number];

const SEMANTIC_SOURCE_KEY_RE = new RegExp(
  `^([1-9]\\d*)__${DatasourceType.SemanticView}$`,
);

/**
 * Normalizes a metadata response into a dashboard semantic dataset, or null
 * when it cannot be proven to describe `sourceKey`.
 */
export function provenSemanticDataset(
  value: unknown,
  sourceKey: string,
): SemanticDataset | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SemanticDataset> & { id?: number };
  const sourceId = SEMANTIC_SOURCE_KEY_RE.exec(sourceKey)?.[1];
  if (
    !sourceId ||
    candidate.type !== DatasourceType.SemanticView ||
    !Array.isArray(candidate.columns) ||
    !candidate.columns.every(
      (column: unknown) =>
        column !== null &&
        typeof column === 'object' &&
        'column_name' in column &&
        typeof column.column_name === 'string',
    ) ||
    (candidate.id !== undefined && candidate.id !== Number(sourceId)) ||
    (candidate.uid !== sourceKey && candidate.id === undefined)
  ) {
    return null;
  }
  // The metadata endpoint uses provider identity for uid; dashboard charts
  // use the integer datasource key. A matching id proves this normalization.
  return { ...candidate, uid: sourceKey } as SemanticDataset;
}

/** Keeps only the entries of a datasets response that prove a semantic view. */
export function provenSemanticDatasets(
  value: unknown,
): SemanticDataset[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .map((candidate: unknown) => {
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        !('uid' in candidate)
      ) {
        return null;
      }
      return provenSemanticDataset(candidate, String(candidate.uid));
    })
    .filter((candidate): candidate is SemanticDataset => candidate !== null);
}
