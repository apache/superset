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
import { ReactNode, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { ensureIsArray, SupersetClient } from '@superset-ui/core';
import { AsyncSelect, Loading } from '@superset-ui/core/components';
import { cloneDeep } from 'lodash-es';
import {
  BaseControlConfig,
  ColumnMeta,
  ControlHeader,
  ControlPanelsContainerProps,
  ControlPanelConfig,
  ControlPanelSectionConfig,
  ControlPanelState,
  ControlSetRow,
  ControlSubSectionHeader,
  CustomControlItem,
  Dataset,
  getStandardizedControls,
  sections,
  sharedControls,
  DEFAULT_SORT_SERIES_DATA,
  SORT_SERIES_CHOICES,
} from '@superset-ui/chart-controls';

import { DEFAULT_FORM_DATA } from './types';
import { EchartsTimeseriesSeriesType } from '../Timeseries/types';
import {
  legendSection,
  minorTicks,
  axisTicks,
  gridlines,
  valueAxisLabels,
  richTooltipSection,
  truncateXAxis,
  xAxisBounds,
  xAxisLabelRotation,
  xAxisLabelInterval,
  forceMaxInterval,
} from '../controls';

const {
  area,
  logAxis,
  markerEnabled,
  markerSize,
  minorSplitLine,
  opacity,
  orderDesc,
  rowLimit,
  seriesType,
  showValues,
  stack,
  truncateYAxis,
  yAxisBounds,
  yAxisIndex,
} = DEFAULT_FORM_DATA;

/* ----------------------------------------------------------------------------
 * Optional secondary dataset for Query B
 *
 * Form data fields (all optional, absent on existing charts => switch off):
 *  - use_secondary_dataset: boolean
 *  - datasource_b: datasource uid, e.g. "12__table"
 *  - x_axis_b: column of Dataset B mapped to the shared X-axis
 * ------------------------------------------------------------------------- */

const USE_SECONDARY_DATASET = 'use_secondary_dataset';
const DATASOURCE_B = 'datasource_b';
const X_AXIS_B = 'x_axis_b';
const SECONDARY_DATASET_LOADING = 'secondary_dataset_loading';

/** Dataset B metadata, keyed by datasource uid ("<id>__<type>"). */
const secondaryDatasetCache = new Map<string, Dataset>();
const secondaryDatasetRequests = new Map<string, Promise<Dataset>>();

function fetchSecondaryDataset(uid: string): Promise<Dataset> {
  const cached = secondaryDatasetCache.get(uid);
  if (cached) return Promise.resolve(cached);
  const pending = secondaryDatasetRequests.get(uid);
  if (pending) return pending;

  const [id, type = 'table'] = uid.split('__');
  const request = SupersetClient.get({
    endpoint: `/api/v1/explore/?datasource_id=${encodeURIComponent(
      id,
    )}&datasource_type=${encodeURIComponent(type)}`,
  })
    .then(({ json }) => {
      const dataset = json?.result?.dataset as Dataset;
      secondaryDatasetCache.set(uid, dataset);
      return dataset;
    })
    .finally(() => {
      secondaryDatasetRequests.delete(uid);
    });
  secondaryDatasetRequests.set(uid, request);
  return request;
}

/** Minimal rison string encoding (always quoted) for the dataset search. */
const risonString = (value: string) =>
  `'${value.replace(/!/g, '!!').replace(/'/g, "!'")}'`;

const loadSecondaryDatasetOptions = (
  search: string,
  page: number,
  pageSize: number,
) => {
  const q =
    '(columns:!(id,table_name,schema,datasource_type),' +
    `filters:!((col:table_name,opr:ct,value:${risonString(search)})),` +
    'order_column:table_name,order_direction:asc,' +
    `page:${page},page_size:${pageSize})`;
  return SupersetClient.get({
    endpoint: `/api/v1/dataset/?q=${encodeURIComponent(q)}`,
  }).then(({ json }) => ({
    data: ensureIsArray(json?.result).map(
      (item: {
        id: number;
        table_name: string;
        schema?: string;
        datasource_type?: string;
      }) => ({
        value: `${item.id}__${item.datasource_type || 'table'}`,
        label: item.schema
          ? `${item.table_name} (${item.schema})`
          : item.table_name,
        table_name: item.table_name,
      }),
    ),
    totalCount: json?.count ?? 0,
  }));
};

function readControlValue(
  state: Pick<ControlPanelState, 'controls' | 'form_data'> | undefined,
  name: string,
) {
  const controlValue = state?.controls?.[name]?.value;
  return controlValue !== undefined
    ? controlValue
    : (state?.form_data as Record<string, unknown> | undefined)?.[name];
}

function isSecondaryDatasetEnabled(
  state: Pick<ControlPanelState, 'controls' | 'form_data'> | undefined,
) {
  return Boolean(readControlValue(state, USE_SECONDARY_DATASET));
}

function getSecondaryDatasourceUid(
  state: Pick<ControlPanelState, 'controls' | 'form_data'> | undefined,
): string | undefined {
  const value = readControlValue(state, DATASOURCE_B);
  return typeof value === 'string' && value ? value : undefined;
}

/** Returns whether the selected Dataset B metadata is available for controls. */
function isSecondaryDatasetReady(
  state: Pick<ControlPanelState, 'controls' | 'form_data'> | undefined,
): boolean {
  const uid = getSecondaryDatasourceUid(state);
  return Boolean(uid && secondaryDatasetCache.get(uid));
}

/** Keeps the existing Query B controls visible unless Dataset B is loading. */
function shouldShowQueryBDataControls(
  state: Pick<ControlPanelState, 'controls' | 'form_data'> | undefined,
): boolean {
  return (
    !isSecondaryDatasetEnabled(state) || isSecondaryDatasetReady(state)
  );
}

/** Returns the physical Dataset A column selected for the shared X-axis. */
function getSharedXAxisName(
  state: Pick<ControlPanelState, 'controls' | 'form_data'> | undefined,
): string | undefined {
  const value = readControlValue(state, 'x_axis');
  return typeof value === 'string' && value ? value : undefined;
}

/** Checks whether Dataset A's selected shared X-axis is temporal. */
function isSharedXAxisTemporal(state: ControlPanelState): boolean {
  const xAxis = getSharedXAxisName(state);
  return Boolean(
    xAxis &&
      state.datasource?.columns?.some(
        column => column.column_name === xAxis && column.is_dttm,
      ),
  );
}

/**
 * Mirrors the existing shared X-axis behavior for Dataset B. Non-temporal
 * axes accept every groupable column; temporal axes only accept groupable
 * temporal columns.
 */
function getSecondaryXAxisColumns(
  dataset: Dataset,
  sharedXAxisIsTemporal: boolean,
): ColumnMeta[] {
  const columns = ensureIsArray(dataset.columns);
  const groupableColumns = Object.prototype.hasOwnProperty.call(
    columns[0] ?? {},
    'groupby',
  )
    ? columns.filter(column => column.groupby)
    : columns;

  return sharedXAxisIsTemporal
    ? groupableColumns.filter(column => column.is_dttm)
    : groupableColumns;
}

/**
 * Returns the control panel state Query B controls should see: unchanged when
 * the switch is off or Dataset B is not ready, otherwise the same state with
 * `datasource` swapped for Dataset B's complete metadata. Query A controls
 * never go through this, so they keep using Dataset A.
 */
function resolveQueryBState(state: ControlPanelState): ControlPanelState {
  if (!isSecondaryDatasetEnabled(state)) return state;
  const uid = getSecondaryDatasourceUid(state);
  const dataset = uid ? secondaryDatasetCache.get(uid) : undefined;
  if (!dataset) return state;
  return {
    ...state,
    datasource: dataset,
  };
}

/**
 * Wraps a shared control config so its datasource-derived props (columns,
 * saved metrics, datasource used for filter values, ...) come from Dataset B
 * when the secondary dataset is enabled.
 */
function withQueryBDatasource<
  T extends Pick<
    BaseControlConfig,
    'disableStash' | 'mapStateToProps' | 'visibility'
  >,
>(controlConfig: T): T {
  const { mapStateToProps, visibility } = controlConfig;
  if (!mapStateToProps) return controlConfig;
  return {
    ...controlConfig,
    // Recompute on every render so Dataset B metadata that loads
    // asynchronously (or a toggle of the switch) is picked up.
    shouldMapStateToProps: () => true,
    mapStateToProps: (state, controlState, chartState) =>
      mapStateToProps(resolveQueryBState(state), controlState, chartState),
    visibility: (props, controlData) =>
      shouldShowQueryBDataControls(props) &&
      (visibility?.(props, controlData) ?? true),
    // Loading should only hide controls, not stash or clear their values.
    disableStash: true,
  };
}

/** Displays progress while Dataset B metadata is being fetched. */
function SecondaryDatasetLoadingControl() {
  return <Loading position="inline-centered" />;
}

type SecondaryDatasourceControlProps = {
  name: string;
  value?: string | null;
  label?: ReactNode;
  description?: ReactNode;
  hovered?: boolean;
  validationErrors?: string[];
  currentXAxisB?: string | null;
  sharedXAxisName?: string;
  sharedXAxisIsTemporal?: boolean;
  onChange: (value: string | null) => void;
  actions?: {
    setControlValue?: (
      name: string,
      value: unknown,
      validationErrors?: unknown[],
      options?: { programmatic?: boolean },
    ) => void;
  };
};

type SecondaryDatasetOption = {
  label: ReactNode;
  value: string;
};

/**
 * Dataset picker for Query B. It only writes `datasource_b`; the primary
 * `datasource` (Dataset A) is never touched. Once Dataset B metadata is
 * loaded it nudges the explore state so Query B controls re-render with the
 * new columns/metrics, and keeps `x_axis_b` valid for the shared X-axis.
 */
function SecondaryDatasourceControl({
  name,
  value,
  label,
  description,
  hovered,
  validationErrors,
  currentXAxisB,
  sharedXAxisName,
  sharedXAxisIsTemporal = false,
  onChange,
  actions,
}: SecondaryDatasourceControlProps) {
  const [loadedUid, setLoadedUid] = useState<string | undefined>(() =>
    value && secondaryDatasetCache.get(value) ? value : undefined,
  );
  const [selectedOption, setSelectedOption] =
    useState<SecondaryDatasetOption>();

  useEffect(() => {
    if (!value) return undefined;
    let cancelled = false;
    fetchSecondaryDataset(value)
      .then(dataset => {
        if (cancelled) return;
        setLoadedUid(value);
        const setControlValue = actions?.setControlValue;
        if (!setControlValue) return;
        // Re-dispatch the same value so dependent Query B controls re-map
        // their props against the freshly cached Dataset B metadata.
        setControlValue(name, value, undefined, { programmatic: true });
        const xAxisColumns = getSecondaryXAxisColumns(
          dataset,
          sharedXAxisIsTemporal,
        );
        const isValidXAxisB = xAxisColumns.some(
          column => column.column_name === currentXAxisB,
        );
        if (!isValidXAxisB) {
          const matchingColumn = xAxisColumns.find(
            column => column.column_name === sharedXAxisName,
          );
          setControlValue(
            X_AXIS_B,
            matchingColumn?.column_name ?? null,
            undefined,
            { programmatic: true },
          );
        }
      })
      .catch(() => {
        if (!cancelled) setLoadedUid(undefined);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedXAxisIsTemporal, sharedXAxisName, value]);

  const dataset =
    value && loadedUid === value ? secondaryDatasetCache.get(value) : undefined;
  const selectedLabel =
    dataset?.table_name || dataset?.datasource_name || dataset?.name || value;
  const selectedValue = value
    ? selectedOption?.value === value
      ? selectedOption
      : { value, label: selectedLabel }
    : undefined;

  return (
    <AsyncSelect
      ariaLabel={t('Dataset for Query B')}
      header={
        <ControlHeader
          name={name}
          label={label}
          description={description}
          hovered={hovered}
          validationErrors={validationErrors}
        />
      }
      value={selectedValue}
      options={loadSecondaryDatasetOptions}
      optionFilterProps={['table_name']}
      placeholder={t('Select a dataset')}
      allowClear
      onChange={(selected: unknown) => {
        const option =
          selected && typeof selected === 'object' && 'value' in selected
            ? (selected as { label?: ReactNode; value: unknown })
            : undefined;
        const next = option ? String(option.value) : null;
        setSelectedOption(
          option && next
            ? { value: next, label: option.label ?? next }
            : undefined,
        );
        onChange(next);
      }}
    />
  );
}

function createSecondaryDatasetRows(): ControlSetRow[] {
  return [
    [
      {
        name: USE_SECONDARY_DATASET,
        config: {
          type: 'SwitchControl',
          label: t('Use a different dataset'),
          default: false,
          description: t(
            'Run Query B against a different dataset. When off, Query B uses the chart dataset.',
          ),
        },
      },
    ],
    [
      {
        name: DATASOURCE_B,
        config: {
          type: SecondaryDatasourceControl,
          label: t('Dataset for Query B'),
          description: t(
            'Dataset that Query B metrics, dimensions and filters are based on. The chart dataset is used for Query A.',
          ),
          default: null,
          shouldMapStateToProps: () => true,
          mapStateToProps: (state: ControlPanelState) => ({
            currentXAxisB: readControlValue(state, X_AXIS_B),
            sharedXAxisName: getSharedXAxisName(state),
            sharedXAxisIsTemporal: isSharedXAxisTemporal(state),
          }),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            Boolean(controls?.[USE_SECONDARY_DATASET]?.value),
        },
      },
    ],
    [
      {
        name: SECONDARY_DATASET_LOADING,
        config: {
          type: SecondaryDatasetLoadingControl,
          visibility: (props: ControlPanelsContainerProps) =>
            isSecondaryDatasetEnabled(props) &&
            Boolean(getSecondaryDatasourceUid(props)) &&
            !isSecondaryDatasetReady(props),
          disableStash: true,
        },
      },
    ],
    [
      {
        name: X_AXIS_B,
        config: {
          type: 'SelectControl',
          label: t('Map shared X-axis to'),
          description: t(
            'Column of the Query B dataset aligned with the shared X-axis.',
          ),
          clearable: false,
          default: null,
          shouldMapStateToProps: () => true,
          mapStateToProps: (
            state: ControlPanelState,
            controlState?: { value?: unknown },
          ) => {
            const uid = getSecondaryDatasourceUid(state);
            const dataset = uid ? secondaryDatasetCache.get(uid) : undefined;
            const current = controlState?.value;
            if (!dataset) {
              // Metadata not loaded yet: keep the saved value selectable so
              // it isn't dropped as a missing choice.
              return {
                choices:
                  typeof current === 'string' && current
                    ? [[current, current]]
                    : [],
              };
            }
            const xAxisColumns = getSecondaryXAxisColumns(
              dataset,
              isSharedXAxisTemporal(state),
            );
            return {
              choices: xAxisColumns.map(column => [
                column.column_name,
                column.verbose_name || column.column_name,
              ]),
            };
          },
          visibility: (props: ControlPanelsContainerProps) =>
            isSecondaryDatasetEnabled(props) &&
            isSecondaryDatasetReady(props),
          disableStash: true,
        },
      },
    ],
  ];
}

function createQuerySection(
  label: string,
  controlSuffix: string,
): ControlPanelSectionConfig {
  const isQueryB = controlSuffix === '_b';
  const withDatasource = <
    T extends Pick<
      BaseControlConfig,
      'disableStash' | 'mapStateToProps' | 'visibility'
    >,
  >(
    controlConfig: T,
  ): T => (isQueryB ? withQueryBDatasource(controlConfig) : controlConfig);

  return {
    label,
    expanded: true,
    controlSetRows: [
      ...(isQueryB ? createSecondaryDatasetRows() : []),
      [
        {
          name: `metrics${controlSuffix}`,
          config: withDatasource(sharedControls.metrics),
        },
      ],
      [
        {
          name: `groupby${controlSuffix}`,
          config: withDatasource(sharedControls.groupby),
        },
      ],
      [
        {
          name: `adhoc_filters${controlSuffix}`,
          config: withDatasource(sharedControls.adhoc_filters),
        },
      ],
      [
        {
          name: `limit${controlSuffix}`,
          config: sharedControls.limit,
        },
      ],
      [
        {
          name: `timeseries_limit_metric${controlSuffix}`,
          config: withDatasource(sharedControls.timeseries_limit_metric),
        },
      ],
      [
        {
          name: `order_desc${controlSuffix}`,
          config: {
            type: 'CheckboxControl',
            label: t('Sort Descending'),
            default: orderDesc,
            description: t('Whether to sort descending or ascending'),
          },
        },
      ],
      [
        {
          name: `row_limit${controlSuffix}`,
          config: {
            ...sharedControls.row_limit,
            default: rowLimit,
          },
        },
      ],
      [
        {
          name: `truncate_metric${controlSuffix}`,
          config: {
            ...sharedControls.truncate_metric,
            default: sharedControls.truncate_metric.default,
          },
        },
      ],
    ],
  };
}

function createCustomizeSection(
  label: string,
  controlSuffix: string,
): ControlSetRow[] {
  return [
    [<ControlSubSectionHeader>{label}</ControlSubSectionHeader>],
    [
      {
        name: `seriesType${controlSuffix}`,
        config: {
          type: 'SelectControl',
          label: t('Series type'),
          renderTrigger: true,
          default: seriesType,
          choices: [
            [EchartsTimeseriesSeriesType.Line, t('Line')],
            [EchartsTimeseriesSeriesType.Scatter, t('Scatter')],
            [EchartsTimeseriesSeriesType.Smooth, t('Smooth Line')],
            [EchartsTimeseriesSeriesType.Bar, t('Bar')],
            [EchartsTimeseriesSeriesType.Start, t('Step - start')],
            [EchartsTimeseriesSeriesType.Middle, t('Step - middle')],
            [EchartsTimeseriesSeriesType.End, t('Step - end')],
          ],
          description: t('Series chart type (line, bar etc)'),
        },
      },
    ],
    [
      {
        name: `stack${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Stack series'),
          renderTrigger: true,
          default: stack,
          description: t('Stack series on top of each other'),
        },
      },
    ],
    [
      {
        name: `area${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Area chart'),
          renderTrigger: true,
          default: area,
          description: t(
            'Draw area under curves. Only applicable for line types.',
          ),
        },
      },
    ],
    [
      {
        name: `show_value${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Show Values'),
          renderTrigger: true,
          default: showValues,
          description: t(
            'Whether to display the numerical values within the cells',
          ),
        },
      },
    ],
    [
      {
        name: `label_position${controlSuffix}`,
        config: {
          type: 'SelectControl',
          freeForm: false,
          label: t('Label Position'),
          choices: [
            ['auto', t('Auto')],
            ['top', t('Top')],
            ['inside', t('Inside')],
            ['bottom', t('Bottom')],
            ['left', t('Left')],
            ['right', t('Right')],
          ],
          default: 'auto',
          renderTrigger: true,
          description: t(
            'Position of the data label relative to the data point',
          ),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            Boolean(controls?.[`show_value${controlSuffix}`]?.value),
        },
      },
    ],
    [
      {
        name: `only_total${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Only Total'),
          default: true,
          renderTrigger: true,
          description: t(
            'Only show the total value on the stacked chart, and not show on the selected category',
          ),
          visibility: ({ controls }: ControlPanelsContainerProps) =>
            Boolean(controls?.show_value?.value) &&
            Boolean(controls?.stack?.value),
        },
      },
    ],
    [
      {
        name: `opacity${controlSuffix}`,
        config: {
          type: 'SliderControl',
          label: t('Opacity'),
          renderTrigger: true,
          min: 0,
          max: 1,
          step: 0.1,
          default: opacity,
          description: t('Opacity of area chart.'),
        },
      },
    ],
    [
      {
        name: `markerEnabled${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Marker'),
          renderTrigger: true,
          default: markerEnabled,
          description: t(
            'Draw a marker on data points. Only applicable for line types.',
          ),
        },
      },
    ],
    [
      {
        name: `markerSize${controlSuffix}`,
        config: {
          type: 'SliderControl',
          label: t('Marker size'),
          renderTrigger: true,
          min: 0,
          max: 100,
          default: markerSize,
          description: t(
            'Size of marker. Also applies to forecast observations.',
          ),
        },
      },
    ],
    [
      {
        name: `yAxisIndex${controlSuffix}`,
        config: {
          type: 'SelectControl',
          label: t('Y Axis'),
          choices: [
            [0, t('Primary')],
            [1, t('Secondary')],
          ],
          default: yAxisIndex,
          clearable: false,
          renderTrigger: true,
          description: t('Primary or secondary y-axis'),
        },
      },
    ],
    [<ControlSubSectionHeader>{t('Series Order')}</ControlSubSectionHeader>],
    [
      {
        name: `sort_series_type${controlSuffix}`,
        config: {
          type: 'SelectControl',
          freeForm: false,
          label: t('Sort Series By'),
          choices: SORT_SERIES_CHOICES,
          default: DEFAULT_SORT_SERIES_DATA.sort_series_type,
          renderTrigger: true,
          description: t(
            'Based on what should series be ordered on the chart and legend',
          ),
        },
      },
    ],
    [
      {
        name: `sort_series_ascending${controlSuffix}`,
        config: {
          type: 'CheckboxControl',
          label: t('Sort Series Ascending'),
          default: DEFAULT_SORT_SERIES_DATA.sort_series_ascending,
          renderTrigger: true,
          description: t('Sort series in ascending order'),
        },
      },
    ],
  ];
}

function createAdvancedAnalyticsSection(
  label: string,
  controlSuffix: string,
): ControlPanelSectionConfig {
  const aaWithSuffix = cloneDeep(sections.advancedAnalyticsControls);
  aaWithSuffix.label = label;
  // `time_compare_full_range` is only wired into the regular timeseries query
  // builder, not the mixed-timeseries one, so drop it here to avoid showing a
  // control that has no effect.
  aaWithSuffix.controlSetRows = aaWithSuffix.controlSetRows
    .map(row =>
      row.filter(
        control =>
          (control as CustomControlItem)?.name !== 'time_compare_full_range',
      ),
    )
    .filter(row => row.length > 0);
  if (!controlSuffix) {
    return aaWithSuffix;
  }
  aaWithSuffix.controlSetRows.forEach(row =>
    row.forEach(control => {
      const item = control as CustomControlItem;
      if (item?.name) {
        item.name = `${item.name}${controlSuffix}`;
      }
    }),
  );
  return aaWithSuffix;
}

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Shared query fields'),
      expanded: true,
      controlSetRows: [['x_axis'], ['time_grain_sqla']],
    },
    createQuerySection(t('Query A'), ''),
    createAdvancedAnalyticsSection(t('Advanced analytics Query A'), ''),
    createQuerySection(t('Query B'), '_b'),
    createAdvancedAnalyticsSection(t('Advanced analytics Query B'), '_b'),
    sections.annotationsAndLayersControls,
    sections.titleControls,
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        ['color_scheme'],
        ['time_shift_color'],
        ...createCustomizeSection(t('Query A'), ''),
        ...createCustomizeSection(t('Query B'), 'B'),
        ['zoomable'],
        [minorTicks],
        [axisTicks],
        [gridlines],
        [valueAxisLabels],
        ...legendSection,
        [<ControlSubSectionHeader>{t('X Axis')}</ControlSubSectionHeader>],
        ['x_axis_time_format'],
        [xAxisLabelRotation],
        [xAxisLabelInterval],
        [forceMaxInterval],
        [<ControlSubSectionHeader>{t('Tooltip')}</ControlSubSectionHeader>],
        [
          {
            name: 'show_query_identifiers',
            config: {
              type: 'CheckboxControl',
              label: t('Show query identifiers'),
              description: t(
                'Add Query A and Query B identifiers to tooltips to help differentiate series',
              ),
              default: false,
              renderTrigger: true,
            },
          },
        ],
        ...richTooltipSection.slice(1), // Skip the tooltip header since we added our own
        // eslint-disable-next-line react/jsx-key
        [<ControlSubSectionHeader>{t('Y Axis')}</ControlSubSectionHeader>],
        [
          {
            name: 'minorSplitLine',
            config: {
              type: 'CheckboxControl',
              label: t('Minor Split Line'),
              renderTrigger: true,
              default: minorSplitLine,
              description: t('Draw split lines for minor y-axis ticks'),
            },
          },
        ],
        [truncateXAxis],
        [xAxisBounds],
        [
          {
            name: 'truncateYAxis',
            config: {
              type: 'CheckboxControl',
              label: t('Truncate Y Axis'),
              default: truncateYAxis,
              renderTrigger: true,
              description: t(
                'Truncate Y Axis. Can be overridden by specifying a min or max bound.',
              ),
            },
          },
        ],
        [
          {
            name: 'y_axis_bounds',
            config: {
              type: 'BoundsControl',
              label: t('Primary y-axis Bounds'),
              renderTrigger: true,
              default: yAxisBounds,
              description: t(
                'Bounds for the primary Y-axis. When left empty, the bounds are ' +
                  'dynamically defined based on the min/max of the data. Note that ' +
                  "this feature will only expand the axis range. It won't " +
                  "narrow the data's extent.",
              ),
            },
          },
        ],
        [
          {
            name: `y_axis_format`,
            config: {
              ...sharedControls.y_axis_format,
              label: t('Primary y-axis format'),
            },
          },
        ],
        ['currency_format'],
        [
          {
            name: 'logAxis',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic y-axis'),
              renderTrigger: true,
              default: logAxis,
              description: t('Logarithmic scale on primary y-axis'),
            },
          },
        ],
        [
          {
            name: 'y_axis_bounds_secondary',
            config: {
              type: 'BoundsControl',
              label: t('Secondary y-axis Bounds'),
              renderTrigger: true,
              default: yAxisBounds,
              description: t(
                `Bounds for the secondary Y-axis. Only works when Independent Y-axis
                bounds are enabled. When left empty, the bounds are dynamically defined
                based on the min/max of the data. Note that this feature will only expand
                the axis range. It won't narrow the data's extent.`,
              ),
            },
          },
        ],
        [
          {
            name: `y_axis_format_secondary`,
            config: {
              ...sharedControls.y_axis_format,
              label: t('Secondary y-axis format'),
            },
          },
        ],
        [
          {
            name: 'currency_format_secondary',
            config: {
              ...sharedControls.currency_format,
              label: t('Secondary currency format'),
            },
          },
        ],
        [
          {
            name: 'yAxisTitleSecondary',
            config: {
              type: 'TextControl',
              label: t('Secondary y-axis title'),
              renderTrigger: true,
              default: '',
              description: t('Logarithmic y-axis'),
            },
          },
        ],
        [
          {
            name: 'logAxisSecondary',
            config: {
              type: 'CheckboxControl',
              label: t('Logarithmic y-axis'),
              renderTrigger: true,
              default: logAxis,
              description: t('Logarithmic scale on secondary y-axis'),
            },
          },
        ],
        ['echart_options'],
      ],
    },
  ],
  formDataOverrides: formData => {
    const groupby = getStandardizedControls().controls.columns.filter(
      col => !ensureIsArray(formData.groupby_b).includes(col),
    );
    getStandardizedControls().controls.columns =
      getStandardizedControls().controls.columns.filter(
        col => !groupby.includes(col),
      );

    const metrics = getStandardizedControls().controls.metrics.filter(
      metric => !ensureIsArray(formData.metrics_b).includes(metric),
    );
    getStandardizedControls().controls.metrics =
      getStandardizedControls().controls.metrics.filter(
        col => !metrics.includes(col),
      );

    return {
      ...formData,
      metrics,
      groupby,
    };
  },
};

export default config;
