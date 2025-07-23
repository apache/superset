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

import { t, JsonObject, QueryFormData } from '@superset-ui/core';
import { HandlebarsRenderer } from './HandlebarsRenderer';
import TooltipRow from '../TooltipRow';
import CustomTooltipWrapper from '../components/CustomTooltipWrapper';

/**
 * Enhanced tooltip content generator that supports both custom tooltip templates (Handlebars)
 * and custom tooltip_contents with fallback to default tooltips for deck.gl charts
 */
export function createTooltipContent(
  formData: QueryFormData,
  defaultTooltipGenerator: (o: JsonObject) => JSX.Element,
) {
  return (o: JsonObject) => {
    // Priority 1: Custom Handlebars Template
    if (
      formData.tooltip_template?.trim() &&
      !formData.tooltip_template.includes(
        'Drop columns/metrics in "Tooltip contents" above',
      )
    ) {
      const tooltipData = createHandlebarsTooltipData(o, formData);
      return (
        <CustomTooltipWrapper>
          <div className="deckgl-tooltip">
            <HandlebarsRenderer
              templateSource={formData.tooltip_template}
              data={tooltipData}
            />
          </div>
        </CustomTooltipWrapper>
      );
    }

    // Priority 2: Field-based Tooltips
    if (formData.tooltip_contents && formData.tooltip_contents.length > 0) {
      const tooltipItems: JSX.Element[] = [];

      // Add selected fields from tooltip_contents
      formData.tooltip_contents.forEach((item: any, index: number) => {
        let label = '';
        let value = '';

        if (item.item_type === 'column') {
          label = item.verbose_name || item.column_name || item.label;
          value =
            o.object?.[item.column_name] ||
            o.object?.properties?.[item.column_name] ||
            o.object?.data?.[item.column_name] ||
            '';
        } else if (item.item_type === 'metric') {
          label = item.verbose_name || item.metric_name || item.label;
          value =
            o.object?.[item.metric_name || item.label] ||
            o.object?.properties?.[item.metric_name || item.label] ||
            o.object?.data?.[item.metric_name || item.label] ||
            o.object?.metric ||
            '';
        } else if (typeof item === 'string') {
          label = item;
          value =
            o.object?.[item] ||
            o.object?.properties?.[item] ||
            o.object?.data?.[item] ||
            '';
          // Special handling for ScreenGridLayer - check if we have individual points data
          if (
            formData.viz_type === 'deck_screengrid' &&
            !value &&
            Array.isArray(o.object?.points)
          ) {
            const allVals = o.object.points
              .map((pt: any) => pt[item])
              .filter((v: any) => v !== undefined && v !== null);
            if (allVals.length > 0) {
              value = allVals.join(', ');
            }
          }
        }

        if (label && value !== '') {
          // Format datetime values
          if (
            typeof value === 'string' &&
            value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
          ) {
            value = new Date(value).toLocaleString();
          }

          tooltipItems.push(
            <TooltipRow
              key={`tooltip-${index}`}
              label={`${label}: `}
              value={`${value}`}
            />,
          );
        }
      });

      return <div className="deckgl-tooltip">{tooltipItems}</div>;
    }

    // Priority 3: Default Tooltip
    return defaultTooltipGenerator(o);
  };
}

/**
 * Common tooltip components that can be reused across charts
 */
export const CommonTooltipRows = {
  // Longitude and Latitude position
  position: (o: JsonObject, position?: [number, number]) => (
    <TooltipRow
      label={`${t('Longitude and Latitude')}: `}
      value={`${position?.[0] || o.object?.position?.[0]}, ${position?.[1] || o.object?.position?.[1]}`}
    />
  ),

  // Start and End positions for Arc charts
  arcPositions: (o: JsonObject) => (
    <>
      <TooltipRow
        label={t('Start (Longitude, Latitude): ')}
        value={`${o.object?.sourcePosition?.[0]}, ${o.object?.sourcePosition?.[1]}`}
      />
      <TooltipRow
        label={t('End (Longitude, Latitude): ')}
        value={`${o.object?.targetPosition?.[0]}, ${o.object?.targetPosition?.[1]}`}
      />
    </>
  ),

  // Centroid position for aggregated charts
  centroid: (o: JsonObject) => (
    <TooltipRow
      label={t('Centroid (Longitude and Latitude): ')}
      value={`(${o.coordinate?.[0]}, ${o.coordinate?.[1]})`}
    />
  ),

  // Category color dimension
  category: (o: JsonObject) =>
    o.object?.cat_color ? (
      <TooltipRow
        label={`${t('Category')}: `}
        value={`${o.object.cat_color}`}
      />
    ) : null,

  // Metric value
  metric: (
    o: JsonObject,
    formData: QueryFormData,
    verboseMap?: Record<string, string>,
  ) => {
    const metricConfig =
      formData.point_radius_fixed || formData.size || formData.metric;
    if (!metricConfig) return null;

    const label =
      verboseMap?.[metricConfig.value] ||
      metricConfig?.value ||
      metricConfig?.label ||
      'Metric';
    return o.object?.metric ? (
      <TooltipRow label={`${label}: `} value={`${o.object.metric}`} />
    ) : null;
  },
};

/**
 * Helper to create Handlebars-compatible tooltip data from deck.gl object
 */
export function createHandlebarsTooltipData(
  o: JsonObject,
  formData: QueryFormData,
): Record<string, any> {
  const data: Record<string, any> = {
    ...o.object,

    // Deck.gl specific properties
    coordinate: o.coordinate,
    index: o.index,
    picked: o.picked,

    // Chart context
    title: formData.viz_type || 'Chart',

    // Common position properties
    position: o.object?.position,
    sourcePosition: o.object?.sourcePosition,
    targetPosition: o.object?.targetPosition,

    // Add formatted coordinate strings for convenience
    coordinateString: o.coordinate
      ? `${o.coordinate[0]}, ${o.coordinate[1]}`
      : '',
    positionString: o.object?.position
      ? `${o.object.position[0]}, ${o.object.position[1]}`
      : '',
    // For ContourLayer, add contour-specific data
    threshold: o.object?.contour?.threshold,
    contourThreshold: o.object?.contour?.threshold,
    // Add nearby points data for aggregation layers
    nearbyPoints: o.object?.nearbyPoints,
    totalPoints: o.object?.totalPoints,
  };

  // Targeted fallback for Heatmap and Contour: add LON/LAT if possible
  if (
    formData.viz_type === 'deck_heatmap' ||
    formData.viz_type === 'deck_contour'
  ) {
    if (o.object?.position) {
      data.LON = o.object.position[0];
      data.LAT = o.object.position[1];
    }
    if (o.coordinate) {
      data.LON = o.coordinate[0];
      data.LAT = o.coordinate[1];
    }

    // For Heatmap layers where o.object is undefined,
    // we can't access individual data points from the hover event
    // The tooltip will only show coordinate-based information
    if (!o.object && formData.viz_type === 'deck_heatmap') {
      // Add a note that detailed data isn't available for aggregated cells
      // eslint-disable-next-line no-underscore-dangle
      data._aggregated = true;
      // eslint-disable-next-line no-underscore-dangle
      data._note = 'Aggregated cell - individual point data not available';
    }
  }

  if (formData.tooltip_contents && formData.tooltip_contents.length > 0) {
    formData.tooltip_contents.forEach((item: any) => {
      let fieldName = '';
      let rawValue = '';

      if (typeof item === 'string') {
        fieldName = item;
        // For aggregation layers, try different possible field locations
        rawValue =
          o.object?.[item] ||
          o.object?.properties?.[item] ||
          o.object?.data?.[item] ||
          '';

        // Special handling for ScreenGridLayer which doesn't have points array
        if (formData.viz_type === 'deck_screengrid' && !rawValue) {
          // Check if we have individual points data available
          if (Array.isArray(o.object?.points)) {
            const allVals = o.object.points
              .map((pt: any) => pt[item])
              .filter((v: any) => v !== undefined && v !== null);
            if (allVals.length > 0) {
              // Show only the first value instead of all values
              rawValue = allVals[0];
              // Also add a pluralized field for convenience (e.g., LONs) with all values
              data[`${item}s`] = allVals.join(', ');
              // Add count information
              data[`${item}_count`] = allVals.length;
            } else {
              // Fallback to aggregated information if no individual values found
              const count = o.object?.count || 0;
              const value = o.object?.value || 0;
              rawValue = `Aggregated: ${count} points, total value: ${value}`;
              data[`${item}_aggregated`] = rawValue;
            }
          } else {
            // Fallback to aggregated information if no points array available
            const count = o.object?.count || 0;
            const value = o.object?.value || 0;
            rawValue = `Aggregated: ${count} points, total value: ${value}`;
            data[`${item}_aggregated`] = rawValue;
          }
        } else if (!rawValue && Array.isArray(o.object?.points)) {
          const allVals = o.object.points
            .map((pt: any) => pt[item])
            .filter((v: any) => v !== undefined && v !== null);
          if (allVals.length > 0) {
            // Show only the first value for aggregation layers
            rawValue = allVals[0];
            // Also add a pluralized field for convenience (e.g., LONs) with all values
            data[`${item}s`] = allVals.join(', ');
            // Add count information
            data[`${item}_count`] = allVals.length;
          }
        }
      } else if (item?.item_type === 'column') {
        fieldName = item.column_name;
        rawValue =
          o.object?.[item.column_name] ||
          o.object?.properties?.[item.column_name] ||
          o.object?.data?.[item.column_name] ||
          '';
        // Special handling for ScreenGridLayer which doesn't have points array
        if (formData.viz_type === 'deck_screengrid' && !rawValue) {
          // Check if we have individual points data available
          if (Array.isArray(o.object?.points)) {
            const allVals = o.object.points
              .map((pt: any) => pt[item.column_name])
              .filter((v: any) => v !== undefined && v !== null);
            if (allVals.length > 0) {
              // Show only the first value instead of all values
              rawValue = allVals[0];
              // Also add a pluralized field for convenience (e.g., LONs) with all values
              data[`${item.column_name}s`] = allVals.join(', ');
              // Add count information
              data[`${item.column_name}_count`] = allVals.length;
            } else {
              // Fallback to aggregated information if no individual values found
              const count = o.object?.count || 0;
              const value = o.object?.value || 0;
              rawValue = `Aggregated: ${count} points, total value: ${value}`;
              data[`${item.column_name}_aggregated`] = rawValue;
            }
          } else {
            // Fallback to aggregated information if no points array available
            const count = o.object?.count || 0;
            const value = o.object?.value || 0;
            rawValue = `Aggregated: ${count} points, total value: ${value}`;
            data[`${item.column_name}_aggregated`] = rawValue;
          }
        } else if (!rawValue && Array.isArray(o.object?.points)) {
          const allVals = o.object.points
            .map((pt: any) => pt[item.column_name])
            .filter((v: any) => v !== undefined && v !== null);
          if (allVals.length > 0) {
            rawValue = allVals.join(', ');
            data[`${item.column_name}s`] = rawValue;
          }
        }
      } else if (item?.item_type === 'metric') {
        const metricName = item.metric_name || item.label;
        fieldName = metricName;
        rawValue =
          o.object?.[metricName] ||
          o.object?.properties?.[metricName] ||
          o.object?.data?.[metricName] ||
          o.object?.metric ||
          '';
        // Special handling for ScreenGridLayer which doesn't have points array
        if (formData.viz_type === 'deck_screengrid' && !rawValue) {
          // Check if we have individual points data available
          if (Array.isArray(o.object?.points)) {
            const allVals = o.object.points
              .map((pt: any) => pt[metricName])
              .filter((v: any) => v !== undefined && v !== null);
            if (allVals.length > 0) {
              rawValue = allVals.join(', ');
              // Also add a pluralized field for convenience (e.g., LONs)
              data[`${metricName}s`] = rawValue;
            } else {
              // Fallback to aggregated information if no individual values found
              const count = o.object?.count || 0;
              const value = o.object?.value || 0;
              rawValue = `Aggregated: ${count} points, total value: ${value}`;
              data[`${metricName}_aggregated`] = rawValue;
            }
          } else {
            // Fallback to aggregated information if no points array available
            const count = o.object?.count || 0;
            const value = o.object?.value || 0;
            rawValue = `Aggregated: ${count} points, total value: ${value}`;
            data[`${metricName}_aggregated`] = rawValue;
          }
        } else if (!rawValue && Array.isArray(o.object?.points)) {
          const allVals = o.object.points
            .map((pt: any) => pt[metricName])
            .filter((v: any) => v !== undefined && v !== null);
          if (allVals.length > 0) {
            rawValue = allVals.join(', ');
            data[`${metricName}s`] = rawValue;
          }
        }
      }

      if (fieldName && rawValue !== '') {
        data[fieldName] = rawValue;
      }
    });
  }

  return data;
}
