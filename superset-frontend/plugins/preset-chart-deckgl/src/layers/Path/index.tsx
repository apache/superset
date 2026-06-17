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
  getMetricLabel,
  QueryFormColumn,
  QueryFormMetric,
  SqlaFormData,
  validateNonEmpty,
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
import {
  isMetricValue,
  isFixedValue,
  getFixedValue,
} from '../utils/metricUtils';
import { addNullFilters, addTooltipColumnsToQuery } from '../buildQueryUtils';
import {
  filterNulls,
  autozoom,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  viewport,
  lineType,
  reverseLongLat,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  tooltipContents,
  tooltipTemplate,
  pathLineWidthFixedOrMetric,
  generateDeckGLColorSchemeControls,
} from '../../utilities/Shared_DeckGL';
import { dndLineColumn } from '../../utilities/sharedDndControls';
import { COLOR_SCHEME_TYPES } from '../../utilities/utils';
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
  line_width?:
    | string
    | { type?: 'fix' | 'metric'; value?: QueryFormMetric | number };
  line_width_multiplier?: number;
  min_width?: number;
  max_width?: number;
  dimension?: string;
  breakpoint_metric?: QueryFormMetric;
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
  width?: number;
  cat_color?: string;
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
  const {
    line_column,
    metric,
    js_columns,
    tooltip_contents,
    line_width,
    dimension,
    breakpoint_metric,
  } = formData;

  if (!line_column) {
    throw new Error('Line column is required for Path charts');
  }

  return buildQueryContext(formData, {
    buildQuery: baseQueryObject => {
      const columns = ensureIsArray(
        baseQueryObject.columns || [],
      ) as QueryFormColumn[];
      let metrics = ensureIsArray(baseQueryObject.metrics || []);
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

      // Include dimension column for categorical color mode
      if (dimension && !columns.includes(dimension)) {
        columns.push(dimension);
      }

      // Add metric if line_width is a metric type
      const isMetric = isMetricValue(line_width);
      const rawWidthValue =
        typeof line_width === 'string'
          ? line_width
          : typeof line_width === 'number'
            ? undefined
            : line_width?.value;
      const widthMetric: QueryFormMetric | null =
        isMetric &&
        rawWidthValue !== undefined &&
        typeof rawWidthValue !== 'number'
          ? (rawWidthValue as QueryFormMetric)
          : null;

      // ensure metric is not added to metric array twice
      const existingLabels = new Set(metrics.map(m => getMetricLabel(m)));
      if (widthMetric && !existingLabels.has(getMetricLabel(widthMetric))) {
        metrics = [...metrics, widthMetric];
      }

      // ensure line_column is in groupby when aggregating by width metric
      if (widthMetric && !groupby.includes(line_column)) {
        groupby.push(line_column);
      }

      if (breakpoint_metric) {
        const breakpointLabel = getMetricLabel(breakpoint_metric);
        const currentLabels = new Set(metrics.map(m => getMetricLabel(m)));
        if (!currentLabels.has(breakpointLabel)) {
          metrics = [...metrics, breakpoint_metric];
        }
        // ensure line_column is in groupby when aggregating
        if (!groupby.includes(line_column)) {
          groupby.push(line_column);
        }
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
  widthMetricLabel?: string,
  fixedWidthValue?: number | string | null,
  categoryColumn?: string,
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
      widthMetricLabel,
      categoryColumn,
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

    // Set width from metric or fixed value
    if (fixedWidthValue != null) {
      // Use fixed width
      const parsedFixedWidth = parseMetricValue(fixedWidthValue);
      if (parsedFixedWidth !== undefined) {
        feature.width = parsedFixedWidth;
      }
    } else if (widthMetricLabel && record[widthMetricLabel] != null) {
      // Use metric value for width
      const widthValue = parseMetricValue(record[widthMetricLabel]);
      if (widthValue !== undefined) {
        feature.width = widthValue;
      }
    }

    if (categoryColumn && record[categoryColumn] != null) {
      feature.cat_color = String(record[categoryColumn]);
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
    line_width,
    dimension,
    reverse_long_lat = false,
    js_columns,
    breakpoint_metric,
  } = formData as DeckPathTransformPropsFormData;

  // Check so legacy values still work
  const fixedWidthValue =
    typeof line_width === 'number'
      ? line_width
      : isFixedValue(line_width)
        ? getFixedValue(line_width)
        : undefined;

  const widthMetricLabel = getMetricLabelFromFormData(line_width);

  const breakpointMetricLabel = breakpoint_metric
    ? getMetricLabel(breakpoint_metric)
    : undefined;
  const baseMetricLabel = getMetricLabelFromFormData(metric);
  const metricLabel = breakpointMetricLabel || baseMetricLabel;

  // ensure all metric labels are included
  const metricLabels = [
    ...(metricLabel ? [metricLabel] : []),
    ...(widthMetricLabel && widthMetricLabel !== metricLabel
      ? [widthMetricLabel]
      : []),
  ];

  const records = getRecordsFromQuery(chartProps.queriesData);
  const features = processPathData(
    records,
    line_column || '',
    line_type,
    reverse_long_lat,
    metricLabel,
    js_columns,
    widthMetricLabel,
    fixedWidthValue,
    dimension,
  ).reverse();

  return createBaseTransformResult(chartProps, features, metricLabels);
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
        [reverseLongLat],
        [autozoom],
      ],
    },
    {
      label: t('Path Size'),
      expanded: true,
      controlSetRows: [
        [pathLineWidthFixedOrMetric],
        [
          {
            name: 'line_width_unit',
            config: {
              type: 'SelectControl',
              label: t('Line width unit'),
              default: 'pixels',
              choices: [
                ['meters', t('meters')],
                ['pixels', t('pixels')],
              ],
            },
          },
        ],
        [
          {
            name: 'min_width',
            config: {
              type: 'TextControl',
              label: t('Minimum Width'),
              isFloat: true,
              validators: [validateNonEmpty],
              renderTrigger: true,
              default: 1,
              description: t(
                'Minimum width size of the path, in pixels or meters.',
              ),
            },
          },
          {
            name: 'max_width',
            config: {
              type: 'TextControl',
              label: t('Maximum Width'),
              isFloat: true,
              validators: [validateNonEmpty],
              renderTrigger: true,
              default: 20,
              description: t(
                'Maximum width size of the path, in pixels or meters.',
              ),
            },
          },
        ],
        [
          {
            name: 'line_width_multiplier',
            config: {
              type: 'TextControl',
              label: t('Width scale multiplier'),
              renderTrigger: true,
              isFloat: true,
              default: 1,
              description: t(
                'Scale factor applied to metric-driven line widths',
              ),
            },
          },
        ],
      ],
    },
    {
      label: t('Path Color'),
      expanded: true,
      controlSetRows: [
        ...generateDeckGLColorSchemeControls({
          defaultSchemeType: COLOR_SCHEME_TYPES.fixed_color,
        }),
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
