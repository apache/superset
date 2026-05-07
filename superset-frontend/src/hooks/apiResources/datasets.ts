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
  logging,
  Metric,
  ensureIsArray,
  getExtensionsRegistry,
  QueryFormData,
} from '@superset-ui/core';
import { useEffect, useState } from 'react';
import { Dataset } from 'src/components/Chart/types';
import {
  cachedSupersetGet,
  supersetGetCache,
} from 'src/utils/cachedSupersetGet';
import { Resource, ResourceStatus } from './apiResources';

/**
 * Utility function to extract numeric dataset ID from datasource string
 */
export const getDatasetId = (datasetId: string | number): number =>
  typeof datasetId === 'string'
    ? Number(datasetId.split('__')[0])
    : Number(datasetId);

/**
 * Helper function to create verbose_map from a dataset
 */
export const createVerboseMap = (dataset?: Dataset): Record<string, string> => {
  const verbose_map: Record<string, string> = {};
  ensureIsArray(dataset?.columns).forEach((column: Column) => {
    verbose_map[column.column_name] = column.verbose_name || column.column_name;
  });
  ensureIsArray(dataset?.metrics).forEach((metric: Metric) => {
    verbose_map[metric.metric_name] = metric.verbose_name || metric.metric_name;
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
    const fetchDataset = async () => {
      try {
        const numericDatasetId = getDatasetId(datasetId);
        const loadDrillByOptionsExtension = getExtensionsRegistry().get(
          'load.drillby.options',
        );
        let result;

        if (loadDrillByOptionsExtension && formData) {
          const response = await loadDrillByOptionsExtension(
            numericDatasetId,
            formData,
          );
          result = response?.json?.result;
        } else {
          const endpoint = `/api/v1/dataset/${numericDatasetId}/drill_info/?q=(dashboard_id:${dashboardId})`;
          try {
            const { json } = await cachedSupersetGet({ endpoint });
            const { result: datasetResult } = json;
            result = datasetResult;
          } catch (error) {
            logging.error('Failed to load dataset: ', error);
            supersetGetCache.delete(endpoint);
            throw error;
          }
        }

        const verbose_map = createVerboseMap(result);

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
