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

import { SupersetClient, JsonValue } from '@superset-ui/core';
import { Dataset } from '@superset-ui/chart-controls';
import { AsyncVerify, ControlPropsWithExtras } from './withAsyncVerification';

/**
 * Utility to extract current form fields from form data
 */
export function collectQueryFields(formData: any): {
  dimensions: string[];
  metrics: string[];
} {
  console.log('collectQueryFields input:', formData);
  const dimensions: string[] = [];
  const metrics: string[] = [];

  // Extract dimensions from various field types
  if (formData.groupby) {
    dimensions.push(
      ...(Array.isArray(formData.groupby)
        ? formData.groupby
        : [formData.groupby]),
    );
  }
  if (formData.columns) {
    dimensions.push(
      ...(Array.isArray(formData.columns)
        ? formData.columns
        : [formData.columns]),
    );
  }

  // Extract metrics from various field types
  if (formData.metrics) {
    metrics.push(
      ...(Array.isArray(formData.metrics)
        ? formData.metrics
        : [formData.metrics]),
    );
  }
  if (formData.metric) {
    metrics.push(formData.metric);
  }
  if (formData.percent_metrics) {
    metrics.push(
      ...(Array.isArray(formData.percent_metrics)
        ? formData.percent_metrics
        : [formData.percent_metrics]),
    );
  }

  // Filter out null/undefined values and convert objects to strings if needed
  const cleanDimensions = dimensions
    .filter(dim => dim != null)
    .map(dim =>
      typeof dim === 'string' ? dim : (dim as any)?.column_name || String(dim),
    );

  const cleanMetrics = metrics
    .filter(metric => metric != null)
    .map(metric =>
      typeof metric === 'string'
        ? metric
        : (metric as any)?.metric_name || String(metric),
    );

  const result = {
    dimensions: [...new Set(cleanDimensions)], // Remove duplicates
    metrics: [...new Set(cleanMetrics)], // Remove duplicates
  };
  
  console.log('collectQueryFields output:', result);
  return result;
}

/**
 * Check if a datasource supports semantic layer verification
 */
function supportsSemanticLayerVerification(datasource: Dataset): boolean {
  if (!datasource || !('database' in datasource) || !datasource.database) {
    return false;
  }

  const database = datasource.database as any;
  return Boolean(database.engine_information?.supports_dynamic_columns);
}

// Cache for API calls to prevent duplicates
const apiCallCache = new Map<string, Promise<{ dimensions: string[]; metrics: string[] } | null>>();

/**
 * Call the validation API
 */
async function callValidationAPI(
  datasource: Dataset,
  selectedDimensions: string[],
  selectedMetrics: string[],
): Promise<{ dimensions: string[]; metrics: string[] } | null> {
  const databaseId = (datasource.database as any)?.id;
  if (!datasource?.id || !databaseId) {
    return null;
  }

  // Create cache key based on the request parameters
  const cacheKey = JSON.stringify({
    datasource_id: datasource.id,
    dimensions: selectedDimensions.sort(),
    metrics: selectedMetrics.sort(),
  });

  // Check if we already have a pending request for the same parameters
  if (apiCallCache.has(cacheKey)) {
    return apiCallCache.get(cacheKey)!;
  }

  try {
    const apiPromise = SupersetClient.post({
      endpoint: `/api/v1/database/${databaseId}/valid_metrics_and_dimensions/`,
      jsonPayload: {
        datasource_id: datasource.id,
        dimensions: selectedDimensions,
        metrics: selectedMetrics,
      },
    }).then(response => response.json as { dimensions: string[]; metrics: string[] });

    // Cache the promise
    apiCallCache.set(cacheKey, apiPromise);

    // Remove from cache after a short delay to allow for immediate duplicates
    // Increased timeout to handle rapid successive calls from multiple controls
    setTimeout(() => {
      apiCallCache.delete(cacheKey);
    }, 500);

    return await apiPromise;
  } catch (error) {
    console.warn('Failed to fetch valid metrics and dimensions:', error);
    apiCallCache.delete(cacheKey);
    return null;
  }
}

/**
 * Create verification function for metrics controls
 */
export function createMetricsVerification(controlName?: string): AsyncVerify {
  return async (props: ControlPropsWithExtras) => {
    const { datasource, form_data, savedMetrics = [], actions, value } = props;

    // Only verify for semantic layer datasources
    if (!supportsSemanticLayerVerification(datasource as Dataset)) {
      return null;
    }

    // Create updated form data with the current value
    const updatedFormData = { ...form_data };
    
    // Update the appropriate field based on the control name
    // Handle both addition and removal of values (including empty arrays)
    if (controlName) {
      updatedFormData[controlName] = value;
    }

    // Extract current form fields from updated form data
    const queryFields = collectQueryFields(updatedFormData || {});

    // Call validation API
    console.log('Metrics verification API call:', {
      controlName,
      originalFormData: form_data,
      updatedFormData,
      value,
      valueType: typeof value,
      isArray: Array.isArray(value),
      valueLength: Array.isArray(value) ? value.length : 'N/A',
      dimensions: queryFields.dimensions,
      metrics: queryFields.metrics,
    });
    
    const validationResult = await callValidationAPI(
      datasource as Dataset,
      queryFields.dimensions,
      queryFields.metrics,
    );

    if (!validationResult) {
      return null;
    }

    // Filter saved metrics to only include valid ones
    const validMetricNames = new Set(validationResult.metrics);
    const filteredSavedMetrics = savedMetrics.filter((metric: any) =>
      validMetricNames.has(metric.metric_name || metric),
    );

    // Mark datasource metrics and columns as disabled if invalid (for left panel)
    const dataset = datasource as Dataset;
    let updatedDatasourceMetrics = dataset.metrics;
    let updatedDatasourceColumns = dataset.columns;

    // Filter valid names to only include those that exist in the original datasource
    const originalDimensionNames = new Set(dataset.columns?.map((col: any) => col.column_name) || []);
    const originalMetricNames = new Set(dataset.metrics?.map((metric: any) => metric.metric_name) || []);
    
    const filteredValidMetricNames = new Set(
      validationResult.metrics.filter(metric => originalMetricNames.has(metric))
    );
    const filteredValidDimensionNames = new Set(
      validationResult.dimensions.filter(dim => originalDimensionNames.has(dim))
    );

    console.log('Metrics verification filtering:', {
      controlName,
      originalMetricCount: originalMetricNames.size,
      apiValidMetricCount: validationResult.metrics.length,
      filteredValidMetricCount: filteredValidMetricNames.size,
      originalDimensionCount: originalDimensionNames.size,
      apiValidDimensionCount: validationResult.dimensions.length,
      filteredValidDimensionCount: filteredValidDimensionNames.size,
    });

    if (dataset.metrics) {
      updatedDatasourceMetrics = dataset.metrics.map((metric: any) => ({
        ...metric,
        isDisabled: !filteredValidMetricNames.has(metric.metric_name || metric),
      }));
    }

    // Also update columns using the same validation result
    if (dataset.columns) {
      updatedDatasourceColumns = dataset.columns.map((column: any) => ({
        ...column,
        isDisabled: !filteredValidDimensionNames.has(column.column_name || column),
      }));
    }

    // Create updated datasource for left panel
    const updatedDatasource = {
      ...dataset,
      metrics: updatedDatasourceMetrics,
      columns: updatedDatasourceColumns,
    };

    // Update the Redux store's datasource to affect the left panel
    if (actions && typeof actions.syncDatasourceMetadata === 'function') {
      actions.syncDatasourceMetadata(updatedDatasource);
    }

    return {
      savedMetrics: filteredSavedMetrics,
      datasource: updatedDatasource,
    };
  };
}

/**
 * Create verification function for dimensions controls
 */
export function createColumnsVerification(controlName?: string): AsyncVerify {
  return async (props: ControlPropsWithExtras) => {
    const { datasource, form_data, options = [], actions, value } = props;

    // Only verify for semantic layer datasources
    if (!supportsSemanticLayerVerification(datasource as Dataset)) {
      return null;
    }

    // Create updated form data with the current value
    const updatedFormData = { ...form_data };
    
    // Update the appropriate field based on the control name
    // Handle both addition and removal of values (including empty arrays)
    if (controlName) {
      updatedFormData[controlName] = value;
    }

    // Extract current form fields from updated form data
    const queryFields = collectQueryFields(updatedFormData || {});

    // Call validation API
    console.log('Columns verification API call:', {
      controlName,
      originalFormData: form_data,
      updatedFormData,
      value,
      valueType: typeof value,
      isArray: Array.isArray(value),
      valueLength: Array.isArray(value) ? value.length : 'N/A',
      dimensions: queryFields.dimensions,
      metrics: queryFields.metrics,
    });
    
    const validationResult = await callValidationAPI(
      datasource as Dataset,
      queryFields.dimensions,
      queryFields.metrics,
    );

    if (!validationResult) {
      return null;
    }

    console.log('Columns verification API response:', {
      controlName,
      validDimensions: validationResult.dimensions,
      validMetrics: validationResult.metrics,
    });

    // Mark dimension options as disabled if invalid
    const validDimensionNames = new Set(validationResult.dimensions);
    const updatedOptions = options.map((option: any) => ({
      ...option,
      isDisabled: !validDimensionNames.has(option.column_name || option),
    }));

    // Mark datasource columns and metrics as disabled if invalid (for left panel)
    const dataset = datasource as Dataset;
    let updatedDatasourceColumns = dataset.columns;
    let updatedDatasourceMetrics = dataset.metrics;

    if (dataset.columns) {
      updatedDatasourceColumns = dataset.columns.map((column: any) => ({
        ...column,
        isDisabled: !validDimensionNames.has(column.column_name || column),
      }));
    }

    // Also update metrics using the same validation result
    const validMetricNames = new Set(validationResult.metrics);
    if (dataset.metrics) {
      updatedDatasourceMetrics = dataset.metrics.map((metric: any) => ({
        ...metric,
        isDisabled: !validMetricNames.has(metric.metric_name || metric),
      }));
    }

    // Debug: Check which dimensions are valid but not in original datasource
    const originalDimensionNames = new Set(dataset.columns?.map((col: any) => col.column_name) || []);
    const originalMetricNames = new Set(dataset.metrics?.map((metric: any) => metric.metric_name) || []);
    
    const validDimensionsNotInOriginal = validationResult.dimensions.filter(
      (dim: string) => !originalDimensionNames.has(dim)
    );
    const validMetricsNotInOriginal = validationResult.metrics.filter(
      (metric: string) => !originalMetricNames.has(metric)
    );

    console.log('Columns verification datasource update:', {
      controlName,
      originalColumns: dataset.columns?.length,
      updatedColumns: updatedDatasourceColumns?.length,
      originalMetrics: dataset.metrics?.length,
      updatedMetrics: updatedDatasourceMetrics?.length,
      validDimensionCount: validDimensionNames.size,
      validMetricCount: validMetricNames.size,
      validDimensionsNotInOriginal,
      validMetricsNotInOriginal,
    });

    // Fix: Only mark columns as disabled if they exist in the original datasource
    // This prevents the UI from trying to process valid dimensions that don't exist
    const filteredValidDimensionNames = new Set(
      validationResult.dimensions.filter(dim => originalDimensionNames.has(dim))
    );
    const filteredValidMetricNames = new Set(
      validationResult.metrics.filter(metric => originalMetricNames.has(metric))
    );

    console.log('Columns verification filtering:', {
      controlName,
      originalDimensionCount: originalDimensionNames.size,
      apiValidDimensionCount: validationResult.dimensions.length,
      filteredValidDimensionCount: filteredValidDimensionNames.size,
      originalMetricCount: originalMetricNames.size,
      apiValidMetricCount: validationResult.metrics.length,
      filteredValidMetricCount: filteredValidMetricNames.size,
    });

    // Update the disabled state logic to use filtered valid names
    if (dataset.columns) {
      updatedDatasourceColumns = dataset.columns.map((column: any) => ({
        ...column,
        isDisabled: !filteredValidDimensionNames.has(column.column_name || column),
      }));
    }

    if (dataset.metrics) {
      updatedDatasourceMetrics = dataset.metrics.map((metric: any) => ({
        ...metric,
        isDisabled: !filteredValidMetricNames.has(metric.metric_name || metric),
      }));
    }

    // Create updated datasource for left panel
    const updatedDatasource = {
      ...dataset,
      columns: updatedDatasourceColumns,
      metrics: updatedDatasourceMetrics,
    };

    // Update the Redux store's datasource to affect the left panel
    if (actions && typeof actions.syncDatasourceMetadata === 'function') {
      actions.syncDatasourceMetadata(updatedDatasource);
    }

    return {
      options: updatedOptions,
      datasource: updatedDatasource,
    };
  };
}

/**
 * Create onChange handler that triggers re-rendering of other controls when values change
 */
export function createSemanticLayerOnChange(
  controlName: string,
  affectedControls: string[],
) {
  return (value: JsonValue, props: ControlPropsWithExtras) => {
    const { actions, form_data } = props;

    // Trigger re-rendering of affected controls by updating their values
    // This forces the verification to run again
    affectedControls.forEach(controlField => {
      if (
        controlField !== controlName &&
        form_data &&
        form_data[controlField]
      ) {
        actions.setControlValue(controlField, form_data[controlField], []);
      }
    });
  };
}

/**
 * Get list of control fields that should trigger re-rendering
 */
export const SEMANTIC_LAYER_CONTROL_FIELDS = [
  'metrics',
  'metric',
  'metric_2',
  'percent_metrics',
  'timeseries_limit_metric',
  'groupby',
  'columns',
  'series_columns',
];
