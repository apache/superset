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

  return {
    dimensions: [...new Set(cleanDimensions)], // Remove duplicates
    metrics: [...new Set(cleanMetrics)], // Remove duplicates
  };
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

  try {
    const response = await SupersetClient.post({
      endpoint: `/api/v1/database/${databaseId}/valid_metrics_and_dimensions/`,
      jsonPayload: {
        datasource_id: datasource.id,
        dimensions: selectedDimensions,
        metrics: selectedMetrics,
      },
    });

    return response.json as { dimensions: string[]; metrics: string[] };
  } catch (error) {
    console.warn('Failed to fetch valid metrics and dimensions:', error);
    return null;
  }
}

/**
 * Create verification function for metrics controls
 */
export function createMetricsVerification(): AsyncVerify {
  return async (props: ControlPropsWithExtras) => {
    const { datasource, form_data, savedMetrics = [], actions } = props;

    // Only verify for semantic layer datasources
    if (!supportsSemanticLayerVerification(datasource as Dataset)) {
      return null;
    }

    // Extract current form fields
    const queryFields = collectQueryFields(form_data || {});

    // Call validation API
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

    // Also filter the datasource metrics (for left panel) if this is a Dataset
    const dataset = datasource as Dataset;
    let filteredDatasourceMetrics = dataset.metrics;
    let filteredDatasourceColumns = dataset.columns;
    
    if (dataset.metrics) {
      filteredDatasourceMetrics = dataset.metrics.filter((metric: any) =>
        validMetricNames.has(metric.metric_name || metric),
      );
    }
    
    // Also filter columns using the same validation result
    const validDimensionNames = new Set(validationResult.dimensions);
    if (dataset.columns) {
      filteredDatasourceColumns = dataset.columns.filter((column: any) =>
        validDimensionNames.has(column.column_name || column),
      );
    }

    // Create filtered datasource for left panel
    const filteredDatasource = {
      ...dataset,
      metrics: filteredDatasourceMetrics,
      columns: filteredDatasourceColumns,
    };

    // Update the Redux store's datasource to affect the left panel
    if (actions && typeof actions.syncDatasourceMetadata === 'function') {
      actions.syncDatasourceMetadata(filteredDatasource);
    }

    return {
      savedMetrics: filteredSavedMetrics,
      datasource: filteredDatasource,
    };
  };
}

/**
 * Create verification function for dimensions controls
 */
export function createColumnsVerification(): AsyncVerify {
  return async (props: ControlPropsWithExtras) => {
    const { datasource, form_data, options = [], actions } = props;

    // Only verify for semantic layer datasources
    if (!supportsSemanticLayerVerification(datasource as Dataset)) {
      return null;
    }

    // Extract current form fields
    const queryFields = collectQueryFields(form_data || {});

    // Call validation API
    const validationResult = await callValidationAPI(
      datasource as Dataset,
      queryFields.dimensions,
      queryFields.metrics,
    );

    if (!validationResult) {
      return null;
    }

    // Filter dimension options to only include valid ones
    const validDimensionNames = new Set(validationResult.dimensions);
    const filteredOptions = options.filter((option: any) =>
      validDimensionNames.has(option.column_name || option),
    );

    // Also filter the datasource columns (for left panel) if this is a Dataset
    const dataset = datasource as Dataset;
    let filteredDatasourceColumns = dataset.columns;
    let filteredDatasourceMetrics = dataset.metrics;
    
    if (dataset.columns) {
      filteredDatasourceColumns = dataset.columns.filter((column: any) =>
        validDimensionNames.has(column.column_name || column),
      );
    }
    
    // Also filter metrics using the same validation result
    const validMetricNames = new Set(validationResult.metrics);
    if (dataset.metrics) {
      filteredDatasourceMetrics = dataset.metrics.filter((metric: any) =>
        validMetricNames.has(metric.metric_name || metric),
      );
    }

    // Create filtered datasource for left panel
    const filteredDatasource = {
      ...dataset,
      columns: filteredDatasourceColumns,
      metrics: filteredDatasourceMetrics,
    };

    // Update the Redux store's datasource to affect the left panel
    if (actions && typeof actions.syncDatasourceMetadata === 'function') {
      actions.syncDatasourceMetadata(filteredDatasource);
    }

    return {
      options: filteredOptions,
      datasource: filteredDatasource,
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
