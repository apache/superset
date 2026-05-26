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

/**
 * @fileoverview Dataset namespace for Superset extensions (P3).
 *
 * Exposes the dataset currently being viewed as a stable semantic API.
 * Aligned with backend-enforced dataset visibility and column-access semantics.
 */

import { Event } from '../common';

/**
 * Normalized dataset context exposed to extensions on the Dataset page.
 */
export interface DatasetContext {
  /** Numeric dataset id. */
  datasetId: number;
  /** Display name (table name or virtual dataset name). */
  datasetName: string;
  /** Schema the dataset belongs to, if applicable. */
  schema: string | null;
  /** Catalog the dataset belongs to, if applicable. */
  catalog: string | null;
  /** Database name backing this dataset. */
  databaseName: string | null;
  /** Whether this is a virtual (SQL-defined) dataset. */
  isVirtual: boolean;
}

/**
 * Returns the normalized dataset context for the page currently being viewed,
 * or `undefined` when the user is not on a Dataset page.
 *
 * @example
 * ```typescript
 * const ds = dataset.getCurrentDataset();
 * if (ds) {
 *   console.log(ds.datasetName, ds.schema);
 * }
 * ```
 */
export declare function getCurrentDataset(): DatasetContext | undefined;

/**
 * Event fired when the focused dataset changes (e.g. the user navigates to a
 * different dataset detail page).
 *
 * @example
 * ```typescript
 * const sub = dataset.onDidChangeDataset(ds => {
 *   chatbot.updateContext({ dataset: ds });
 * });
 * sub.dispose();
 * ```
 */
export declare const onDidChangeDataset: Event<DatasetContext>;
