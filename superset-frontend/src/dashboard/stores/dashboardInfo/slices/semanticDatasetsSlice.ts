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

import type { StateCreator } from 'zustand';
import type { DashboardInfoStore } from '../types';
import type { SemanticDataset } from '../semanticDatasets';

export interface SemanticDatasetsSlice {
  /**
   * Publishes a dashboard-wide semantic metadata snapshot. A page load passes
   * `expectedGeneration` so a response from before a save or an add cannot
   * overwrite newer metadata; a save passes `requestId` and marks the start of
   * its refresh with `isRefreshStart` so the previous snapshot stops proving
   * anything until the response arrives.
   */
  replaceSemanticDatasets: (
    dashboardId: number,
    datasets: SemanticDataset[] | null,
    requestId?: string,
    isRefreshStart?: boolean,
    expectedGeneration?: number,
  ) => void;
  /** Refreshes one source (chart add) without reloading the dashboard. */
  updateSemanticDataset: (
    dashboardId: number,
    sourceKey: string,
    dataset: SemanticDataset | null,
    requestId?: string,
    isRefreshStart?: boolean,
  ) => void;
}

export const createSemanticDatasetsSlice: StateCreator<
  DashboardInfoStore,
  [['zustand/devtools', never], ['zustand/subscribeWithSelector', never]],
  [],
  SemanticDatasetsSlice
> = set => ({
  replaceSemanticDatasets: (
    dashboardId,
    datasets,
    requestId,
    isRefreshStart = false,
    expectedGeneration,
  ) =>
    set(
      ({ dashboardInfo: state }) => {
        if (dashboardId !== state.id) return {};
        if (isRefreshStart && !requestId) return {};
        const currentGeneration = state.semanticDatasetsGeneration ?? 0;
        const pageGeneration = expectedGeneration ?? 0;
        if (
          !isRefreshStart &&
          (state.semanticDatasetsRequestId !== requestId ||
            (!requestId &&
              (pageGeneration > currentGeneration ||
                pageGeneration < (state.semanticDatasetsSaveGeneration ?? 0) ||
                (datasets === null && pageGeneration !== currentGeneration))))
        ) {
          return {};
        }
        const pageModifiedKeys = new Set(
          !requestId
            ? [
                ...Object.entries(
                  state.semanticDatasetMutationGenerations ?? {},
                )
                  .filter(([, generation]) => generation > pageGeneration)
                  .map(([sourceKey]) => sourceKey),
                ...Object.keys(state.semanticDatasetRequests ?? {}),
              ]
            : [],
        );
        const overrides = state.semanticDatasetOverrides ?? {};
        const mergedDatasets =
          datasets &&
          (requestId
            ? [
                ...datasets.filter(source => !(source.uid in overrides)),
                ...Object.values(overrides).filter(
                  (source): source is SemanticDataset => source !== null,
                ),
              ]
            : [
                ...datasets.filter(source => !pageModifiedKeys.has(source.uid)),
                ...(state.semanticDatasets?.datasets ?? []).filter(source =>
                  pageModifiedKeys.has(source.uid),
                ),
              ]);
        return {
          dashboardInfo: {
            ...state,
            semanticDatasets: mergedDatasets
              ? { dashboardId, datasets: mergedDatasets }
              : null,
            semanticDatasetsRequestId: isRefreshStart ? requestId : undefined,
            semanticDatasetRequests: isRefreshStart
              ? {}
              : state.semanticDatasetRequests,
            semanticDatasetOverrides: isRefreshStart ? {} : undefined,
            semanticDatasetsGeneration: currentGeneration + (requestId ? 1 : 0),
            semanticDatasetsSaveGeneration: requestId
              ? currentGeneration + 1
              : state.semanticDatasetsSaveGeneration,
          },
        };
      },
      false,
      'dashboardInfo/replaceSemanticDatasets',
    ),

  updateSemanticDataset: (
    dashboardId,
    sourceKey,
    dataset,
    requestId,
    isRefreshStart = false,
  ) =>
    set(
      ({ dashboardInfo: state }) => {
        if (dashboardId !== state.id || !sourceKey) return {};
        if (isRefreshStart && !requestId) return {};
        if (
          !isRefreshStart &&
          (state.semanticDatasetRequests?.[sourceKey] !== requestId ||
            (!requestId && state.semanticDatasetsRequestId !== undefined))
        ) {
          return {};
        }
        const sourceRequests = { ...state.semanticDatasetRequests };
        if (isRefreshStart && requestId) {
          sourceRequests[sourceKey] = requestId;
        } else {
          delete sourceRequests[sourceKey];
        }
        const overrides = { ...state.semanticDatasetOverrides };
        if (isRefreshStart) {
          delete overrides[sourceKey];
        } else if (state.semanticDatasetsRequestId) {
          overrides[sourceKey] = dataset ?? null;
        }
        const previous =
          state.semanticDatasets &&
          state.semanticDatasets.dashboardId === dashboardId
            ? state.semanticDatasets.datasets
            : [];
        const generation = (state.semanticDatasetsGeneration ?? 0) + 1;
        return {
          dashboardInfo: {
            ...state,
            semanticDatasets: {
              dashboardId,
              datasets: [
                ...previous.filter(source => source.uid !== sourceKey),
                ...(dataset ? [dataset] : []),
              ],
            },
            semanticDatasetRequests: sourceRequests,
            semanticDatasetOverrides: overrides,
            semanticDatasetsGeneration: generation,
            semanticDatasetMutationGenerations: {
              ...state.semanticDatasetMutationGenerations,
              [sourceKey]: generation,
            },
          },
        };
      },
      false,
      'dashboardInfo/updateSemanticDataset',
    ),
});
