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
  ensureIsArray,
  FeatureFlag,
  getColumnLabel,
  isFeatureEnabled,
  legacyValidateInteger,
  QueryFormColumn,
  QueryObject,
  QueryObjectFilterClause,
  SqlaFormData,
} from '@superset-ui/core';
import { defineChart } from '@superset-ui/glyph-core';
import GeojsonComponent from './Geojson';
import { DataRecord } from '../spatialUtils';
import {
  createBaseTransformResult,
  getRecordsFromQuery,
} from '../transformUtils';
import {
  addJsColumnsToColumns,
  addTooltipColumnsToQuery,
} from '../buildQueryUtils';
import { formatSelectOptions } from '../../utilities/utils';
import {
  filterNulls,
  jsColumns,
  jsDataMutator,
  jsTooltip,
  jsOnclickHref,
  fillColorPicker,
  strokeColorPicker,
  filled,
  stroked,
  extruded,
  viewport,
  mapboxStyle,
  maplibreStyle,
  mapProvider,
  autozoom,
  lineWidth,
  tooltipContents,
  tooltipTemplate,
  jsFunctionControl,
} from '../../utilities/Shared_DeckGL';
import { dndGeojsonColumn } from '../../utilities/sharedDndControls';
import { BLACK_COLOR } from '../../utilities/controls';
import thumbnail from './images/thumbnail.png';
import thumbnailDark from './images/thumbnail-dark.png';
import example from './images/example.png';
import exampleDark from './images/example-dark.png';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeckGeoJsonFormData extends SqlaFormData {
  geojson?: string;
  filter_nulls?: boolean;
  js_columns?: string[];
  tooltip_contents?: unknown[];
}

// ─── buildQuery ──────────────────────────────────────────────────────────────

export function buildQuery(formData: DeckGeoJsonFormData) {
  const {
    geojson,
    filter_nulls = true,
    js_columns,
    tooltip_contents,
  } = formData;

  if (!geojson) {
    throw new Error('GeoJSON column is required for GeoJSON charts');
  }

  return buildQueryContext(formData, (baseQueryObject: QueryObject) => {
    let columns: QueryFormColumn[] = [
      ...ensureIsArray(baseQueryObject.columns || []),
      geojson,
    ];

    const columnStrings = columns.map(col =>
      typeof col === 'string' ? col : col.label || col.sqlExpression || '',
    );
    const withJsColumns = addJsColumnsToColumns(columnStrings, js_columns);
    columns = withJsColumns as QueryFormColumn[];

    columns = addTooltipColumnsToQuery(columns, tooltip_contents);

    const filters: QueryObjectFilterClause[] = ensureIsArray(
      baseQueryObject.filters || [],
    );
    if (filter_nulls) {
      filters.push({ col: geojson, op: 'IS NOT NULL' });
    }

    return [
      {
        ...baseQueryObject,
        columns,
        metrics: [],
        groupby: [],
        filters,
        is_timeseries: false,
      },
    ];
  });
}

// ─── transformProps ──────────────────────────────────────────────────────────

function transformProps(chartProps: ChartProps) {
  const { rawFormData: formData } = chartProps;
  const geojsonCol = formData.geojson
    ? getColumnLabel(formData.geojson)
    : undefined;

  if (!geojsonCol) {
    return createBaseTransformResult(chartProps, []);
  }

  const records = getRecordsFromQuery(chartProps.queriesData);

  // Parse each record's geojson column value (replicates backend DeckGeoJson.get_properties)
  const features = records
    .map((record: DataRecord) => {
      const geojsonStr = record[geojsonCol];
      if (geojsonStr == null) return null;
      try {
        return JSON.parse(String(geojsonStr));
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return createBaseTransformResult(chartProps, features);
}

// ─── Default control config templates ────────────────────────────────────────

const defaultLabelConfigGenerator = `() => ({
  // Check the documentation at:
  // https://deck.gl/docs/api-reference/layers/geojson-layer#pointtype-options-2
  getText: f => f.properties.name,
  getTextColor: [0, 0, 0, 255],
  getTextSize: 24,
  textSizeUnits: 'pixels',
})`;

const defaultIconConfigGenerator = `() => ({
  // Check the documentation at:
  // https://deck.gl/docs/api-reference/layers/geojson-layer#pointtype-options-1
  getIcon: () => ({ url: '', height: 128, width: 128 }),
  getIconSize: 32,
  iconSizeUnits: 'pixels',
})`;

// ─── Plugin definition ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default defineChart<Record<string, never>, any>({
  metadata: {
    name: t('deck.gl Geojson'),
    description: t(
      'The GeoJsonLayer takes in GeoJSON formatted data and renders it as interactive polygons, lines and points (circles, icons and/or texts).',
    ),
    category: t('Map'),
    credits: ['https://uber.github.io/deck.gl'],
    behaviors: [Behavior.InteractiveChart],
    tags: [t('deckGL'), t('2D')],
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
        [dndGeojsonColumn],
        ['row_limit'],
        [filterNulls],
        ['adhoc_filters'],
        [tooltipContents],
        [tooltipTemplate],
      ],
    },
    {
      label: t('Map'),
      controlSetRows: [
        [mapProvider],
        [mapboxStyle],
        [maplibreStyle],
        [viewport, autozoom],
      ],
    },
    {
      label: t('GeoJson Settings'),
      controlSetRows: [
        [fillColorPicker, strokeColorPicker],
        [filled, stroked],
        [extruded],
        [
          {
            name: 'enable_labels',
            config: {
              type: 'CheckboxControl',
              label: t('Enable labels'),
              description: t('Enables rendering of labels for GeoJSON points'),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'enable_label_javascript_mode',
            config: {
              type: 'CheckboxControl',
              label: t('Enable label JavaScript mode'),
              description: t(
                'Enables custom label configuration via JavaScript',
              ),
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                isFeatureEnabled(FeatureFlag.EnableJavascriptControls),
              default: false,
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'label_property_name',
            config: {
              type: 'TextControl',
              label: t('Label property name'),
              description: t('The feature property to use for point labels'),
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                (!form_data.enable_label_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
              default: 'name',
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'label_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Label color'),
              description: t('The color of the point labels'),
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                (!form_data.enable_label_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
              default: BLACK_COLOR,
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'label_size',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Label size'),
              description: t('The font size of the point labels'),
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                (!form_data.enable_label_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
              validators: [legacyValidateInteger],
              choices: formatSelectOptions([8, 16, 24, 32, 64, 128]),
              default: 24,
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'label_size_unit',
            config: {
              type: 'SelectControl',
              label: t('Label size unit'),
              description: t('The unit for label size'),
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                (!form_data.enable_label_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
              choices: [
                ['meters', t('Meters')],
                ['pixels', t('Pixels')],
              ],
              default: 'pixels',
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'label_javascript_config_generator',
            config: {
              ...jsFunctionControl(
                t('Label JavaScript config generator'),
                t(
                  'A JavaScript function that generates a label configuration object',
                ),
                undefined,
                undefined,
                defaultLabelConfigGenerator,
              ),
              visibility: ({ form_data }) =>
                !!form_data.enable_labels &&
                !!form_data.enable_label_javascript_mode &&
                isFeatureEnabled(FeatureFlag.EnableJavascriptControls),
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'enable_icons',
            config: {
              type: 'CheckboxControl',
              label: t('Enable icons'),
              description: t('Enables rendering of icons for GeoJSON points'),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'enable_icon_javascript_mode',
            config: {
              type: 'CheckboxControl',
              label: t('Enable icon JavaScript mode'),
              description: t(
                'Enables custom icon configuration via JavaScript',
              ),
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                isFeatureEnabled(FeatureFlag.EnableJavascriptControls),
              default: false,
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'icon_url',
            config: {
              type: 'TextControl',
              label: t('Icon URL'),
              description: t(
                'The image URL of the icon to display for GeoJSON points. ' +
                  'Note that the image URL must conform to the content ' +
                  'security policy (CSP) in order to load correctly.',
              ),
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                (!form_data.enable_icon_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
              default: '',
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'icon_size',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Icon size'),
              description: t('The size of the point icons'),
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                (!form_data.enable_icon_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
              validators: [legacyValidateInteger],
              choices: formatSelectOptions([16, 24, 32, 64, 128]),
              default: 32,
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'icon_size_unit',
            config: {
              type: 'SelectControl',
              label: t('Icon size unit'),
              description: t('The unit for icon size'),
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                (!form_data.enable_icon_javascript_mode ||
                  !isFeatureEnabled(FeatureFlag.EnableJavascriptControls)),
              choices: [
                ['meters', t('Meters')],
                ['pixels', t('Pixels')],
              ],
              default: 'pixels',
              renderTrigger: true,
              resetOnHide: false,
            },
          },
        ],
        [
          {
            name: 'icon_javascript_config_generator',
            config: {
              ...jsFunctionControl(
                t('Icon JavaScript config generator'),
                t(
                  'A JavaScript function that generates an icon configuration object',
                ),
                undefined,
                undefined,
                defaultIconConfigGenerator,
              ),
              visibility: ({ form_data }) =>
                !!form_data.enable_icons &&
                !!form_data.enable_icon_javascript_mode &&
                isFeatureEnabled(FeatureFlag.EnableJavascriptControls),
              resetOnHide: false,
            },
          },
        ],
        [lineWidth],
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
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'point_radius_scale',
            config: {
              type: 'SelectControl',
              freeForm: true,
              label: t('Point Radius Scale'),
              validators: [legacyValidateInteger],
              default: null,
              choices: formatSelectOptions([0, 100, 200, 300, 500]),
            },
          },
        ],
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
  buildQuery: (formData: any) => buildQuery(formData as DeckGeoJsonFormData),
  transform: chartProps => transformProps(chartProps),
  render: props => (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <GeojsonComponent {...(props as any)} />
  ),
});
