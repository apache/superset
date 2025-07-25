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

import { QueryFormData } from '@superset-ui/core';

/**
 * Deck.gl chart types that perform aggregation and can have multiple values in tooltips
 */
export const AGGREGATED_DECK_GL_CHART_TYPES = [
  'deck_screengrid',
  'deck_heatmap',
  'deck_contour',
  'deck_hex',
  'deck_grid',
];

/**
 * Chart types that do NOT aggregate data (each tooltip shows single data point)
 */
export const NON_AGGREGATED_DECK_GL_CHART_TYPES = [
  'deck_scatter',
  'deck_arc',
  'deck_path',
  'deck_polygon',
  'deck_geojson',
];

/**
 * Determines if a deck.gl chart type aggregates data points
 */
export function isAggregatedDeckGLChart(vizType: string): boolean {
  return AGGREGATED_DECK_GL_CHART_TYPES.includes(vizType);
}

/**
 * Determines if a tooltip content field might contain multiple values
 * for the given chart configuration
 */
export function fieldHasMultipleValues(
  item: any,
  formData: QueryFormData,
): boolean {
  // Only aggregated deck.gl charts can have multiple values
  if (!isAggregatedDeckGLChart(formData.viz_type)) {
    return false;
  }

  // Skip metrics for now - they are typically aggregated already
  if (item?.item_type === 'metric') {
    return false;
  }

  // Only screengrid reliably supports multi-value fields with individual point access
  // Other aggregated charts (hex, grid, heatmap, contour) use different aggregation methods
  const supportsMultiValue = ['deck_screengrid'].includes(formData.viz_type);

  if (!supportsMultiValue) {
    return false;
  }

  // Columns in aggregated charts can have multiple values
  if (item?.item_type === 'column') {
    return true;
  }

  // String columns can have multiple values
  if (typeof item === 'string') {
    return true;
  }

  return false;
}

/**
 * Creates a default template that limits multi-value fields
 */
export function createDefaultTemplateWithLimits(
  tooltipContents: any[],
  formData: QueryFormData,
): string {
  if (!tooltipContents?.length) {
    return '';
  }

  const getFieldName = (item: any): string | null => {
    if (typeof item === 'string') return item;
    if (item?.item_type === 'column') return item.column_name;
    if (item?.item_type === 'metric') return item.metric_name || item.label;
    return null;
  };

  const getFieldLabel = (item: any): string => {
    if (typeof item === 'string') return item;
    if (item?.item_type === 'column') {
      return item.verbose_name || item.column_name || 'Column';
    }
    if (item?.item_type === 'metric') {
      return item.verbose_name || item.metric_name || item.label || 'Metric';
    }
    return 'Field';
  };

  const templateLines: string[] = [];

  tooltipContents.forEach(item => {
    const fieldName = getFieldName(item);
    const fieldLabel = getFieldLabel(item);

    if (!fieldName) return;

    const hasMultipleValues = fieldHasMultipleValues(item, formData);

    if (hasMultipleValues) {
      // For multi-value fields, use the plural field name and limit helper
      const pluralFieldName = `${fieldName}s`;
      templateLines.push(
        `<div><strong>${fieldLabel}:</strong> {{#if ${pluralFieldName}}}{{limit ${pluralFieldName} 10}}{{#if ${fieldName}_count}} ({{${fieldName}_count}} total){{/if}}{{else}}N/A{{/if}}</div>`,
      );
    } else {
      // For single-value fields, show normally
      templateLines.push(
        `<div><strong>${fieldLabel}:</strong> {{#if ${fieldName}}}{{${fieldName}}}{{else}}N/A{{/if}}</div>`,
      );
    }
  });

  return templateLines.join('\n');
}

/**
 * Warning message for multi-value tooltip fields
 */
export const MULTI_VALUE_WARNING_MESSAGE =
  'This metric or column contains many values, they may not be able to be all displayed in the tooltip';
