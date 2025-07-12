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
      const tooltipData = {
        ...o.object,
        coordinate: o.coordinate,
        index: o.index,
        picked: o.picked,
        title: formData.viz_type || 'Chart',
        position: o.object?.position,
        sourcePosition: o.object?.sourcePosition,
        targetPosition: o.object?.targetPosition,
      };

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
          value = o.object?.[item.column_name] || '';
        } else if (item.item_type === 'metric') {
          label = item.verbose_name || item.metric_name || item.label;
          value =
            o.object?.[item.metric_name || item.label] ||
            o.object?.metric ||
            '';
        } else if (typeof item === 'string') {
          label = item;
          value = o.object?.[item] || '';
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
    // Base object data
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
  };

  if (formData.tooltip_contents && formData.tooltip_contents.length > 0) {
    formData.tooltip_contents.forEach((item: any) => {
      let fieldName = '';
      let rawValue = '';

      if (typeof item === 'string') {
        fieldName = item;
        rawValue = o.object?.[item] || '';
      } else if (item?.item_type === 'column') {
        fieldName = item.column_name;
        rawValue = o.object?.[item.column_name] || '';
      } else if (item?.item_type === 'metric') {
        const metricName = item.metric_name || item.label;
        fieldName = metricName;
        rawValue = o.object?.[metricName] || o.object?.metric || '';
      }

      if (fieldName && rawValue !== '') {
        data[fieldName] = rawValue;
      }
    });
  }

  return data;
}
