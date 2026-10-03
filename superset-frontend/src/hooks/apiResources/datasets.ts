/* eslint-disable no-underscore-dangle */
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
import {
  Column,
  DatasourceType,
  Metric,
  ensureIsArray,
  getExtensionsRegistry,
  QueryFormData,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { useEffect, useState } from 'react';
import { Dataset } from 'src/components/Chart/types';
import {
  cachedSupersetGet,
  supersetGetCache,
} from 'src/utils/cachedSupersetGet';
import {
  fetchSemanticViewStructure,
  semanticViewDimensionsToColumns,
} from 'src/utils/semanticViewStructure';
import { Resource, ResourceStatus } from './apiResources';

/**
 * Utility function to extract numeric dataset ID from datasource string
 */
export const getDatasetId = (datasetId: string | number): number =>
  typeof datasetId === 'string'
    ? Number(datasetId.split('__')[0])
    : Number(datasetId);

/**
 * Extract the datasource type from an `<id>__<type>` datasource string.
 * Semantic views and regular datasets have independent numeric-id
 * sequences, so the type is load-bearing: resolving by id alone reads
 * whatever regular dataset shares the number (sc-111089). Absent or
 * unrecognized suffixes fall back to a regular dataset, preserving
 * legacy behaviour.
 */
export const getDatasourceTypeFromDatasourceId = (
  datasetId: string | number,
): DatasourceType => {
  if (typeof datasetId !== 'string') {
    return DatasourceType.Table;
  }
  const suffix = datasetId.split('__')[1];
  return suffix === DatasourceType.SemanticView
    ? DatasourceType.SemanticView
    : DatasourceType.Table;
};

/**
 * Helper function to create verbose_map from a dataset
 */
export const createVerboseMap = (dataset?: Dataset): Record<string, string> => {
  const verbose_map: Record<string, string> = {};
  // A name can appear in both lists -- uniqueness is only enforced within each
  // one -- so metrics are written first and columns overwrite them. That matches
  // `SqlaTable.data_for_slices`, which builds the verbose map the dashboard's own
  // charts already render with, and keeps an unused metric from relabelling a
  // column the chart actually selected.
  ensureIsArray(dataset?.metrics).forEach((metric: Metric) => {
    verbose_map[metric.metric_name] = metric.verbose_name || metric.metric_name;
  });
  ensureIsArray(dataset?.columns).forEach((column: Column) => {
    verbose_map[column.column_name] = column.verbose_name || column.column_name;
  });
  return verbose_map;
};

/**
 * Hook to fetch dataset drill info with extension support and verbose_map
 * Handles both extension and standard API cases internally
 */
export const useDatasetDrillInfo = (
  datasetId: string | number,
  dashboardId: number,
  formData?: QueryFormData,
  skip: boolean = false,
): Resource<Dataset> => {
  const [resource, setResource] = useState<Resource<Dataset>>({
    status: ResourceStatus.Loading,
    result: null,
    error: null,
  });

  useEffect(() => {
    if (skip) {
      // short circuit if `skip` is `true`
      setResource({
        status: ResourceStatus.Complete,
        result: {} as Dataset,
        error: null,
      });
      return;
    }
    const numericDatasetId = getDatasetId(datasetId);
    if (Number.isNaN(numericDatasetId)) {
      // datasetId isn't resolved yet (e.g. the dashboard's slice entity hasn't
      // hydrated after a client-side navigation back from Explore). Reset to
      // Loading rather than firing a request for dataset "NaN" -- and rather
      // than leaving a previous id's Complete/Error result in place, which
      // would let the context menu expose drill metadata for the wrong
      // dataset until this one resolves. The effect reruns once datasetId
      // settles to a real value.
      setResource({
        status: ResourceStatus.Loading,
        result: null,
        error: null,
      });
      return;
    }

    // `bestEffort` callers recover from a failure themselves, so it is not worth
    // logging: a deployment that registers the drill-by extension because this
    // endpoint is unreachable would otherwise log on every dashboard load.
    const fetchDrillInfo = async ({ bestEffort = false } = {}) => {
      const endpoint = `/api/v1/dataset/${numericDatasetId}/drill_info/?q=(dashboard_id:${dashboardId})`;
      try {
        const { json } = await cachedSupersetGet({ endpoint });
        return json.result;
      } catch (error) {
        if (!bestEffort) {
          logging.error('Failed to load dataset: ', error);
        }
        supersetGetCache.delete(endpoint);
        throw error;
      }
    };

    const fetchDataset = async () => {
      try {
        const loadDrillByOptionsExtension = getExtensionsRegistry().get(
          'load.drillby.options',
        );
        let result: Dataset | undefined;
        let labelSource;

        if (
          getDatasourceTypeFromDatasourceId(datasetId) ===
          DatasourceType.SemanticView
        ) {
          // Semantic views short-circuit BEFORE the extension check: the
          // extension receives only the numeric id, which would resolve
          // the colliding regular dataset (sc-111089 review consensus).
          // The structure payload carries no changed_on/owners metadata —
          // those metadata-bar rows render their not-available state, an
          // accepted degradation. Columns are derived from semantic-view
          // dimensions with groupby: true, making them drillable through
          // ChartContextMenu; unavailable metadata is not fabricated.
          const structure = await fetchSemanticViewStructure(numericDatasetId);
          // Built as a partial Dataset (the declaration is typed, so
          // table_name/columns are genuinely checked): no id or
          // datasource_type is fabricated, and verbose_name is omitted rather
          // than null — consumers only falsy-check it. The metrics are the one
          // narrowing: the structure payload carries no uuid or full metric
          // metadata, so each is asserted to Metric with only the fields
          // consumers read (metric_name for verbose_map; expression for
          // parity). Fabricating a uuid would be worse than the assertion.
          result = {
            table_name: structure.name,
            columns: semanticViewDimensionsToColumns(structure.dimensions),
            metrics: structure.metrics.map(
              metric =>
                ({
                  metric_name: metric.name,
                  expression: metric.definition,
                }) as Metric,
            ),
          };
          // The structure payload is the only label source for a semantic
          // view -- there is no drill_info endpoint behind it -- so it is
          // also the verbose_map source, as it was before labelSource was
          // split out from result.
          labelSource = result;
        } else if (loadDrillByOptionsExtension && formData) {
          const response = await loadDrillByOptionsExtension(
            numericDatasetId,
            formData,
          );
          result = response?.json?.result;
          // The extension contract only covers drill-by options, so a conforming
          // implementation may omit metrics and non-dimension columns. Labels
          // come from the API, which is the only source that promises the whole
          // dataset. If it is unreachable -- a deployment may register the
          // extension precisely because it is -- fall back to what the extension
          // returned rather than breaking drill-by, which works there today.
          try {
            labelSource = await fetchDrillInfo({ bestEffort: true });
          } catch {
            labelSource = result;
          }
        } else {
          result = await fetchDrillInfo();
          labelSource = result;
        }

        const verbose_map = createVerboseMap(labelSource);

        setResource({
          status: ResourceStatus.Complete,
          result: { ...result, verbose_map },
          error: null,
        });
      } catch (error) {
        setResource({
          status: ResourceStatus.Error,
          result: null,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    };

    fetchDataset();
  }, [datasetId, dashboardId, formData, skip]);

  return resource;
};
