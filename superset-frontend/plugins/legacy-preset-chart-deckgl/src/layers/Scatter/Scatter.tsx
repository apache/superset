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
import { ScatterplotLayer } from '@deck.gl/layers';
import {
  Datasource,
  getMetricLabel,
  JsonObject,
  QueryFormData,
  t,
} from '@superset-ui/core';
import { commonLayerProps } from '../common';
import { createCategoricalDeckGLComponent } from '../../factory';
import TooltipRow from '../../TooltipRow';
import { unitToRadius } from '../../utils/geo';
import { TooltipProps } from '../../components/Tooltip';
import { createTooltipContent } from '../../utilities/tooltipUtils';

type TooltipContentItem =
  | string
  | {
      item_type?: 'column' | 'metric';
      column?: string;
      alias?: string;
      column_name?: string;
      metric_name?: string;
      label?: string;
      verbose_name?: string;
    };

interface ScatterDataItem {
  color: number[];
  radius: number;
  position: number[];
  [key: string]: unknown;
}

export function getPoints(data: JsonObject[]) {
  return data.map(d => d.position);
}

function setTooltipContent(
  formData: QueryFormData,
  verboseMap?: Record<string, string>,
) {
  return (o: JsonObject) => {
    // Check if tooltip contents are configured
    if (formData.tooltip_contents && formData.tooltip_contents.length > 0) {
      const tooltipItems: JSX.Element[] = [];

      // Add selected fields from tooltip_contents
      formData.tooltip_contents.forEach(
        (item: TooltipContentItem, index: number) => {
          let label = '';
          let value = '';

          if (typeof item === 'string') {
            // Handle simple string format (column name)
            label = item;
            // Look for the aggregated tooltip metric first, then fallback to direct column
            value =
              o.object?.[`tooltip_${item}`] ||
              o.object?.extraProps?.[item] ||
              o.object?.[item] ||
              '';

            // Format datetime values for better readability
            if (
              item.toLowerCase().includes('date') ||
              item.toLowerCase().includes('time')
            ) {
              if (typeof value === 'number' && value > 1000000000) {
                // Convert Unix timestamp to readable date
                value = new Date(value).toLocaleString();
              }
            }
          } else if (item.item_type === 'column' && item.column_name) {
            // Handle object format for columns
            label = item.verbose_name || item.column_name || item.label || '';
            value =
              o.object?.[`tooltip_${item.column_name}`] ||
              o.object?.extraProps?.[item.column_name] ||
              o.object?.[item.column_name] ||
              '';

            // Format datetime values
            if (
              item.column_name.toLowerCase().includes('date') ||
              item.column_name.toLowerCase().includes('time')
            ) {
              if (typeof value === 'number' && value > 1000000000) {
                value = new Date(value).toLocaleString();
              }
            }
          } else if (
            item.item_type === 'metric' &&
            (item.metric_name || item.label)
          ) {
            // Handle object format for metrics
            const metricKey = item.metric_name || item.label || '';
            label = item.verbose_name || item.metric_name || item.label || '';
            value = o.object?.[metricKey] || o.object?.metric || '';
          }

          if (label && value !== '' && value !== null && value !== undefined) {
            tooltipItems.push(
              <TooltipRow
                key={`tooltip-${index}`}
                label={`${label}: `}
                value={`${value}`}
              />,
            );
          }
        },
      );

      // Add default location if not already included
      const hasLocation = formData.tooltip_contents.some(
        (item: TooltipContentItem) => {
          if (typeof item === 'string') {
            return item === 'longitude' || item === 'latitude';
          }
          return (
            item.column_name === 'longitude' || item.column_name === 'latitude'
          );
        },
      );

      if (!hasLocation) {
        tooltipItems.unshift(
          <TooltipRow
            key="location"
            // eslint-disable-next-line prefer-template
            label={t('Longitude and Latitude') + ': '}
            value={`${o.object?.position?.[0]}, ${o.object?.position?.[1]}`}
          />,
        );
      }

      return <div className="deckgl-tooltip">{tooltipItems}</div>;
    }

    // Default tooltip
    const label =
      verboseMap?.[formData.point_radius_fixed.value] ||
      getMetricLabel(formData.point_radius_fixed?.value);
    return (
      <div className="deckgl-tooltip">
        <TooltipRow
          // eslint-disable-next-line prefer-template
          label={t('Longitude and Latitude') + ': '}
          value={`${o.object?.position?.[0]}, ${o.object?.position?.[1]}`}
        />
        {o.object?.cat_color && (
          <TooltipRow
            // eslint-disable-next-line prefer-template
            label={t('Category') + ': '}
            value={`${o.object?.cat_color}`}
          />
        )}
        {o.object?.metric && (
          <TooltipRow label={`${label}: `} value={`${o.object?.metric}`} />
        )}
      </div>
    );
  };

  // Use the enhanced tooltip content generator with Handlebars support
  return createTooltipContent(formData, defaultTooltipGenerator, verboseMap);
}

export function getLayer(
  formData: QueryFormData,
  payload: JsonObject,
  onAddFilter: () => void,
  setTooltip: (tooltip: TooltipProps['tooltip']) => void,
  datasource: Datasource,
) {
  const fd = formData;
  const dataWithRadius = payload.data.features.map((d: JsonObject) => {
    let radius = unitToRadius(fd.point_unit, d.radius) || 10;
    if (fd.multiplier) {
      radius *= fd.multiplier;
    }
    if (d.color) {
      return { ...d, radius };
    }
    const c = fd.color_picker || { r: 0, g: 0, b: 0, a: 1 };
    const color = [c.r, c.g, c.b, c.a * 255];

    return { ...d, radius, color };
  });

  return new ScatterplotLayer({
    id: `scatter-layer-${fd.slice_id}` as const,
    data: dataWithRadius,
    fp64: true,
    getFillColor: (d: ScatterDataItem): [number, number, number, number] =>
      d.color as [number, number, number, number],
    getRadius: (d: ScatterDataItem): number => d.radius,
    radiusMinPixels: Number(fd.min_radius) || undefined,
    radiusMaxPixels: Number(fd.max_radius) || undefined,
    stroked: false,
    ...commonLayerProps(
      fd,
      setTooltip,
      setTooltipContent(fd, datasource?.verboseMap),
    ),
  });
}

export default createCategoricalDeckGLComponent(getLayer, getPoints);
