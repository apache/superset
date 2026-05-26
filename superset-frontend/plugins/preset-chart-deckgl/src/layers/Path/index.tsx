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
import { t } from '@apache-superset/core/translation';
import {
  Behavior,
  buildQueryContext,
  ChartProps,
  DTTM_ALIAS,
  ensureIsArray,
  QueryFormColumn,
  SqlaFormData,
} from '@superset-ui/core';
import { defineChart } from '@superset-ui/glyph-core';
import PathComponent from './Path';
import { addJsColumnsToExtraProps, DataRecord } from '../spatialUtils';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
  getMetricLabelFromFormData,
  parseMetricValue,
  addPropertiesToFeature,
} from '../transformUtils';
import { addNullFilters, addTooltipColumnsToQuery } from '../buildQueryUtils';
import {
  filterNulls,
  autozoom,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  viewport,
  lineWidth,
  lineType,
  reverseLongLat,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  tooltipContents,
  tooltipTemplate,
} from '../../utilities/Shared_DeckGL';
import { dndLineColumn } from '../../utilities/sharedDndControls';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeckPathFormData extends SqlaFormData {
  line_column?: string;
  line_type?: 'polyline' | 'json' | 'geohash';
  metric?: string;
  reverse_long_lat?: boolean;
  js_columns?: string[];
  tooltip_contents?: unknown[];
  tooltip_template?: string;
}

export interface DeckPathTransformPropsFormData extends DeckPathFormData {
  js_data_mutator?: string;
  js_tooltip?: string;
  js_onclick_href?: string;
}

interface PathFeature {
  path: [number, number][];
  metric?: number;
  timestamp?: unknown;
  extraProps?: Record<string, unknown>;
  [key: string]: unknown;
}

declare global {
  interface Window {
    polyline?: {
      decode: (data: string) => [number, number][];
    };
    geohash?: {
      decode: (data: string) => { longitude: number; latitude: number };
    };
  }
}

// ─── buildQuery ──────────────────────────────────────────────────────────────

export function buildQuery(formData: DeckPathFormData) {
  const { line_column, metric, js_columns, tooltip_contents } = formData;

  if (!line_column) {
    throw new Error('Line column is required for Path charts');
  }

  return buildQueryContext(formData, {
    buildQuery: baseQueryObject => {
      const columns = ensureIsArray(
        baseQueryObject.columns || [],
      ) as QueryFormColumn[];
      const metrics = ensureIsArray(baseQueryObject.metrics || []);
      const groupby = ensureIsArray(
        baseQueryObject.groupby || [],
      ) as QueryFormColumn[];
      const jsCols = ensureIsArray(js_columns || []);

      if (baseQueryObject.metrics?.length || metric) {
        if (metric && !metrics.includes(metric)) {
          metrics.push(metric);
        }
        if (!groupby.includes(line_column)) {
          groupby.push(line_column);
        }
      } else if (!columns.includes(line_column)) {
        columns.push(line_column);
      }

      jsCols.forEach(col => {
        if (!columns.includes(col) && !groupby.includes(col)) {
          columns.push(col);
        }
      });

      const finalColumns = addTooltipColumnsToQuery(columns, tooltip_contents);
      const finalGroupby = addTooltipColumnsToQuery(groupby, tooltip_contents);

      const filters = addNullFilters(
        ensureIsArray(baseQueryObject.filters || []),
        [line_column],
      );

      const isTimeseries = Boolean(formData.time_grain_sqla);

      return [
        {
          ...baseQueryObject,
          columns: finalColumns,
          metrics,
          groupby: finalGroupby,
          filters,
          is_timeseries: isTimeseries,
          row_limit: baseQueryObject.row_limit,
        },
      ];
    },
  });
}

// ─── transformProps ──────────────────────────────────────────────────────────

const decoders = {
  json: (data: string): [number, number][] => {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  },
  polyline: (data: string): [number, number][] => {
    try {
      if (typeof window !== 'undefined' && window.polyline) {
        return window.polyline.decode(data);
      }
      return [];
    } catch (error) {
      return [];
    }
  },
  geohash: (data: string): [number, number][] => {
    try {
      if (typeof window !== 'undefined' && window.geohash) {
        const decoded = window.geohash.decode(data);
        return [[decoded.longitude, decoded.latitude]];
      }
      return [];
    } catch (error) {
      return [];
    }
  },
};

export function processPathData(
  records: DataRecord[],
  lineColumn: string,
  ltype: 'polyline' | 'json' | 'geohash' = 'json',
  reverseLongLatFlag: boolean = false,
  metricLabel?: string,
  jsCols?: string[],
): PathFeature[] {
  if (!records.length || !lineColumn) {
    return [];
  }

  const decoder = decoders[ltype] || decoders.json;
  const excludeKeys = new Set(
    [
      ltype !== 'geohash' ? lineColumn : undefined,
      'timestamp',
      DTTM_ALIAS,
      metricLabel,
      ...(jsCols || []),
    ].filter(Boolean) as string[],
  );

  return records.map(record => {
    const lineData = record[lineColumn];
    let path: [number, number][] = [];

    if (lineData) {
      path = decoder(String(lineData));
      if (reverseLongLatFlag && path.length > 0) {
        path = path.map(([lng, lat]) => [lat, lng]);
      }
    }

    let feature: PathFeature = {
      path,
      timestamp: record[DTTM_ALIAS],
      extraProps: {},
    };

    if (metricLabel && record[metricLabel] != null) {
      const metricValue = parseMetricValue(record[metricLabel]);
      if (metricValue !== undefined) {
        feature.metric = metricValue;
      }
    }

    feature = addJsColumnsToExtraProps(feature, record, jsCols);
    feature = addPropertiesToFeature(feature, record, excludeKeys);
    return feature;
  });
}

function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const {
    line_column,
    line_type = 'json',
    metric,
    reverse_long_lat = false,
    js_columns,
  } = formData as DeckPathTransformPropsFormData;

  const metricLabel = getMetricLabelFromFormData(metric);
  const records = getRecordsFromQuery(chartProps.queriesData);
  const features = processPathData(
    records,
    line_column || '',
    line_type,
    reverse_long_lat,
    metricLabel,
    js_columns,
  ).reverse();

  return createBaseTransformResult(
    chartProps,
    features,
    metricLabel ? [metricLabel] : [],
  );
}

// ─── Plugin definition ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<Record<string, never>, any>({
  metadata: {
    name: t('deck.gl Path'),
    description: t('Visualizes connected points, which form a path, on a map.'),
    category: t('Map'),
    credits: ['https://uber.github.io/deck.gl'],
    behaviors: [Behavior.InteractiveChart],
    tags: [t('deckGL'), t('Web')],
    thumbnail,
    thumbnailDark,
    exampleGallery: [{ url: example, urlDark: exampleDark }],
  },
  arguments: {},
  suppressQuerySection: true,
  prependSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [dndLineColumn],
        [
          {
            ...lineType,
            config: {
              ...lineType.config,
              choices: [
                ['polyline', t('Polyline')],
                ['json', t('JSON')],
              ],
            },
          },
        ],
        ['row_limit'],
        [filterNulls],
        ['adhoc_filters'],
        [tooltipContents],
        [tooltipTemplate],
      ],
    },
    {
      label: t('Map'),
      expanded: true,
      controlSetRows: [
        [mapProvider],
        [mapboxStyle],
        [maplibreStyle],
        [viewport],
        ['color_picker'],
        [lineWidth],
        [
          {
            name: 'line_width_unit',
            config: {
              type: 'SelectControl',
              label: t('Line width unit'),
              default: 'meters',
              choices: [
                ['meters', t('meters')],
                ['pixels', t('pixels')],
              ],
              renderTrigger: true,
            },
          },
        ],
        [reverseLongLat],
        [autozoom],
      ],
    },
    {
      label: t('Advanced'),
      controlSetRows: [
        [jsColumns],
        [jsDataMutator],
        [jsTooltip],
        [jsOnclickHref],
      ],
    },
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: (formData: any) => buildQuery(formData as DeckPathFormData),
  transform: chartProps => transformProps(chartProps),
  render: props => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <PathComponent {...(props as any)} />
  ),
});
