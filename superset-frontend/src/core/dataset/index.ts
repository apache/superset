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
import { createEmitter } from '../utils';

type DatasetContext = datasetApi.DatasetContext;

const emitter = createEmitter<DatasetContext | undefined>(undefined);

/**
 * Host-internal: called by the Dataset page when its entity loads or changes.
 * Not part of the public `@apache-superset/core` API.
 */
export const setCurrentDataset = (ctx: DatasetContext | undefined): void => {
  emitter.fire(ctx);
};

const getCurrentDataset: typeof datasetApi.getCurrentDataset = () => {
  const current = emitter.getCurrent();
  return current ? { ...current } : undefined;
};

const onDidChangeDataset: typeof datasetApi.onDidChangeDataset = (
  listener: (ctx: DatasetContext) => void,
  thisArgs?: unknown,
) => {
  const bound = thisArgs ? listener.bind(thisArgs) : listener;
  // The public contract only emits a concrete context; skip `undefined` clears
  // so subscribers are never handed an empty value.
  return emitter.event(ctx => {
    if (ctx) bound(ctx);
  });
};

export const dataset: typeof datasetApi = {
  getCurrentDataset,
  onDidChangeDataset,
};
