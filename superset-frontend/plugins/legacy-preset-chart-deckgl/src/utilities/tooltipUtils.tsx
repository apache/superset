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
      const tooltipItems = buildFieldBasedTooltipItems(o, formData);
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
  position: (o: JsonObject, position?: [number, number]) => (
    <TooltipRow
      label={`${t('Longitude and Latitude')}: `}
      value={`${position?.[0] || o.object?.position?.[0]}, ${position?.[1] || o.object?.position?.[1]}`}
    />
  ),

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

  centroid: (o: JsonObject) => (
    <TooltipRow
      label={t('Centroid (Longitude and Latitude): ')}
      value={`(${o.coordinate?.[0]}, ${o.coordinate?.[1]})`}
    />
  ),

  category: (o: JsonObject) =>
    o.object?.cat_color ? (
      <TooltipRow
        label={`${t('Category')}: `}
        value={`${o.object.cat_color}`}
      />
    ) : null,

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

function extractValue(
  o: JsonObject,
  fieldName: string,
  checkPoints = true,
): any {
  let value =
    o.object?.[fieldName] ||
    o.object?.properties?.[fieldName] ||
    o.object?.data?.[fieldName] ||
    '';

  if (!value && checkPoints && Array.isArray(o.object?.points)) {
    const allVals = o.object.points
      .map((pt: any) => pt[fieldName])
      .filter((v: any) => v !== undefined && v !== null);
    if (allVals.length > 0) {
      value = allVals[0];
      return { value, allValues: allVals };
    }
  }

  return { value, allValues: [] };
}

function formatValue(value: any): string {
  if (value === '') return '';

  if (
    typeof value === 'string' &&
    value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  ) {
    return new Date(value).toLocaleString();
  }

  return `${value}`;
}

function buildFieldBasedTooltipItems(
  o: JsonObject,
  formData: QueryFormData,
): JSX.Element[] {
  const tooltipItems: JSX.Element[] = [];

  formData.tooltip_contents.forEach((item: any, index: number) => {
    let label = '';
    let fieldName = '';

    if (typeof item === 'string') {
      label = item;
      fieldName = item;
    } else if (item.item_type === 'column') {
      label = item.verbose_name || item.column_name || item.label;
      fieldName = item.column_name;
    } else if (item.item_type === 'metric') {
      label = item.verbose_name || item.metric_name || item.label;
      fieldName = item.metric_name || item.label;
    }

    if (!label || !fieldName) return;

    let { value } = extractValue(o, fieldName);
    if (!value && item.item_type === 'metric') {
      value = o.object?.metric || '';
    }

    if (
      formData.viz_type === 'deck_screengrid' &&
      !value &&
      Array.isArray(o.object?.points)
    ) {
      const { allValues } = extractValue(o, fieldName);
      if (allValues.length > 0) {
        value = allValues.join(', ');
      }
    }

    if (value !== '') {
      const formattedValue = formatValue(value);
      tooltipItems.push(
        <TooltipRow
          key={`tooltip-${index}`}
          label={`${label}: `}
          value={formattedValue}
        />,
      );
    }
  });

  return tooltipItems;
}

function createScreenGridData(
  o: JsonObject,
  fieldName: string,
  extractResult: { value: any; allValues: any[] },
): Record<string, any> {
  const result: Record<string, any> = {};

  if (extractResult.allValues.length > 0) {
    result[fieldName] = extractResult.value;
    result[`${fieldName}s`] = extractResult.allValues.join(', ');
    result[`${fieldName}_count`] = extractResult.allValues.length;
  } else {
    const count = o.object?.count || 0;
    const value = o.object?.value || 0;
    const aggregatedValue = `Aggregated: ${count} points, total value: ${value}`;
    result[fieldName] = aggregatedValue;
    result[`${fieldName}_aggregated`] = aggregatedValue;
  }

  return result;
}

function processTooltipContentItem(
  item: any,
  o: JsonObject,
  formData: QueryFormData,
): Record<string, any> {
  let fieldName = '';

  if (typeof item === 'string') {
    fieldName = item;
  } else if (item?.item_type === 'column') {
    fieldName = item.column_name;
  } else if (item?.item_type === 'metric') {
    fieldName = item.metric_name || item.label;
  }

  if (!fieldName) return {};

  const extractResult = extractValue(o, fieldName);
  let { value } = extractResult;

  if (item?.item_type === 'metric' && !value) {
    value = o.object?.metric || '';
  }

  if (formData.viz_type === 'deck_screengrid' && !value) {
    return createScreenGridData(o, fieldName, extractResult);
  }

  if (extractResult.allValues.length > 0) {
    return {
      [fieldName]: value,
      [`${fieldName}s`]: extractResult.allValues.join(', '),
      [`${fieldName}_count`]: extractResult.allValues.length,
    };
  }

  if (value !== '') {
    return { [fieldName]: value };
  }

  return {};
}

/**
 * Helper to create Handlebars-compatible tooltip data from deck.gl object
 */
export function createHandlebarsTooltipData(
  o: JsonObject,
  formData: QueryFormData,
): Record<string, any> {
  const initialData: Record<string, any> = {
    ...o.object,
    coordinate: o.coordinate,
    index: o.index,
    picked: o.picked,
    title: formData.viz_type || 'Chart',
    position: o.object?.position,
    sourcePosition: o.object?.sourcePosition,
    targetPosition: o.object?.targetPosition,
    coordinateString: o.coordinate
      ? `${o.coordinate[0]}, ${o.coordinate[1]}`
      : '',
    positionString: o.object?.position
      ? `${o.object.position[0]}, ${o.object.position[1]}`
      : '',
    threshold: o.object?.contour?.threshold,
    contourThreshold: o.object?.contour?.threshold,
    nearbyPoints: o.object?.nearbyPoints,
    totalPoints: o.object?.totalPoints,
  };

  let data = { ...initialData };

  if (
    formData.viz_type === 'deck_heatmap' ||
    formData.viz_type === 'deck_contour'
  ) {
    if (o.object?.position) {
      data = {
        ...data,
        LON: o.object.position[0],
        LAT: o.object.position[1],
      };
    }
    if (o.coordinate) {
      data = {
        ...data,
        LON: o.coordinate[0],
        LAT: o.coordinate[1],
      };
    }

    if (!o.object && formData.viz_type === 'deck_heatmap') {
      data = {
        ...data,
        aggregated: true,
        note: 'Aggregated cell - individual point data not available',
      };
    }
  }

  if (formData.tooltip_contents && formData.tooltip_contents.length > 0) {
    const tooltipData = formData.tooltip_contents.reduce(
      (acc: any, item: any) => {
        const itemData = processTooltipContentItem(item, o, formData);
        return { ...acc, ...itemData };
      },
      {},
    );

    data = { ...data, ...tooltipData };
  }

  return data;
}
