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
 * Host-internal implementation of the `dataset` namespace.
 *
 * Dataset page components call `setCurrentDataset` to publish context as they
 * load. Extensions consume the stable `DatasetContext` contract; they are
 * isolated from the page's internal data-fetching implementation.
 */

import type { dataset as datasetApi } from '@apache-superset/core';
import { Disposable } from '../models';

type DatasetContext = datasetApi.DatasetContext;

let currentDataset: DatasetContext | undefined;
const listeners = new Set<(ctx: DatasetContext) => void>();

/**
 * Host-internal: called by the Dataset page when its entity loads or changes.
 * Not part of the public `@apache-superset/core` API.
 */
export const setCurrentDataset = (ctx: DatasetContext | undefined): void => {
  currentDataset = ctx;
  if (ctx) {
    listeners.forEach(fn => fn(ctx));
  }
};

const getCurrentDataset: typeof datasetApi.getCurrentDataset = () =>
  currentDataset ? { ...currentDataset } : undefined;

const onDidChangeDataset: typeof datasetApi.onDidChangeDataset = (
  listener: (ctx: DatasetContext) => void,
  thisArgs?: any,
): Disposable => {
  const bound = thisArgs ? listener.bind(thisArgs) : listener;
  listeners.add(bound);
  return new Disposable(() => listeners.delete(bound));
};

export const dataset: typeof datasetApi = {
  getCurrentDataset,
  onDidChangeDataset,
};
