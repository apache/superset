/* eslint-disable camelcase */
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
import {
  GenericDataType,
  QueryColumn,
  t,
  validateNonEmpty,
} from '@superset-ui/core';
import {
  ExtraControlProps,
  SharedControlConfig,
  Dataset,
  Metric,
  isDataset,
} from '../types';
import { DATASET_TIME_COLUMN_OPTION, TIME_FILTER_LABELS } from '../constants';
import {
  QUERY_TIME_COLUMN_OPTION,
  defineSavedMetrics,
  ColumnOption,
  ColumnMeta,
  FilterOption,
  temporalColumnMixin,
  datePickerInAdhocFilterMixin,
  xAxisMixin,
} from '..';

type Control = {
  savedMetrics?: Metric[] | null;
  default?: unknown;
};

// Semantic layer verification functions - will be set from main app
let withAsyncVerification: any = null;
let createMetricsVerification: any = null;
let createColumnsVerification: any = null;
let createSemanticLayerOnChange: any = null;
let SEMANTIC_LAYER_CONTROL_FIELDS: any = null;

// Notification system for when utilities are set
const enhancedControls: Array<{
  controlName: string;
  invalidateCache: () => void;
}> = [];

// Export function to set semantic layer utilities from main app
export function setSemanticLayerUtilities(utilities: {
  withAsyncVerification: any;
  createMetricsVerification: any;
  createColumnsVerification: any;
  createSemanticLayerOnChange: any;
  SEMANTIC_LAYER_CONTROL_FIELDS: any;
}) {
  ({
    withAsyncVerification,
    createMetricsVerification,
    createColumnsVerification,
    createSemanticLayerOnChange,
    SEMANTIC_LAYER_CONTROL_FIELDS,
  } = utilities);

  // Notify all enhanced controls that utilities are now available
  enhancedControls.forEach(control => {
    control.invalidateCache();
  });
}

/**
 * Check if a datasource supports semantic layer verification
 */
function needsSemanticLayerVerification(datasource: Dataset): boolean {
  if (!datasource || !('database' in datasource) || !datasource.database) {
    return false;
  }

  const database = datasource.database as any;
  return Boolean(database.engine_information?.supports_dynamic_columns);
}

/**
 * Enhance a control with semantic layer verification if available
 * This creates a lazy-enhanced control that checks for utilities at runtime
 */
function enhanceControlWithSemanticLayer(
  baseControl: any,
  controlName: string,
  verificationType: 'metrics' | 'columns',
) {
  // Cache for the enhanced control type
  let cachedEnhancedType: any = null;
  let utilitiesWereAvailable = false;

  // Register with notification system
  enhancedControls.push({
    controlName,
    invalidateCache: () => {
      cachedEnhancedType = null;
      utilitiesWereAvailable = false;
    },
  });

  // Return a control that will be enhanced at runtime if utilities are available
  return {
    ...baseControl,
    // Override the type to use a function that checks for enhancement at runtime
    get type() {
      // Check if utilities became available since last call
      const utilitiesAvailableNow = !!withAsyncVerification;

      if (utilitiesAvailableNow) {
        // If utilities just became available or we haven't cached yet, create enhanced control
        if (!utilitiesWereAvailable || !cachedEnhancedType) {
          const verificationFn =
            verificationType === 'metrics'
              ? createMetricsVerification(controlName)
              : createColumnsVerification(controlName);

          cachedEnhancedType = withAsyncVerification({
            baseControl: baseControl.type,
            verify: verificationFn,
            onChange: createSemanticLayerOnChange(
              controlName,
              SEMANTIC_LAYER_CONTROL_FIELDS,
            ),
            showLoadingState: true,
          });

          utilitiesWereAvailable = true;
        }

        return cachedEnhancedType;
      }

      utilitiesWereAvailable = false;
      return baseControl.type;
    },
    mapStateToProps: (state: any, controlState: any) => {
      // Call the original mapStateToProps if it exists
      const originalProps = baseControl.mapStateToProps
        ? baseControl.mapStateToProps(state, controlState)
        : {};

      // Only add semantic layer props if utilities are available
      if (withAsyncVerification) {
        const needsVerification = needsSemanticLayerVerification(
          state.datasource,
        );

        // Check if there's existing data that needs verification
        const hasExistingData =
          controlState?.value &&
          ((Array.isArray(controlState.value) &&
            controlState.value.length > 0) ||
            (!Array.isArray(controlState.value) &&
              controlState.value !== null &&
              controlState.value !== undefined));

        return {
          ...originalProps,
          needAsyncVerification: needsVerification,
          // Only skip effect verification if there's no existing data
          skipEffectVerification: !hasExistingData,
          form_data: state.form_data,
          datasource: state.datasource, // Pass datasource to verification function
        };
      }

      return originalProps;
    },
  };
}

/*
 * Note: Previous to the commit that introduced this comment, the shared controls module
 * would check feature flags at module execution time and expose a different control
 * configuration (component + props) depending on the status of drag-and-drop feature
 * flags.  This commit combines those configs, merging the required props for both the
 * drag-and-drop and non-drag-and-drop components, and renders a wrapper component that
 * checks feature flags at component render time to avoid race conditions between when
 * feature flags are set and when they're checked.
 */

function filterOptions(
  options: (ColumnMeta | QueryColumn)[],
  allowedDataTypes?: GenericDataType[],
) {
  if (!allowedDataTypes) {
    return options;
  }
  return options.filter(
    o =>
      o.type_generic !== undefined && allowedDataTypes.includes(o.type_generic),
  );
}

const baseDndGroupByControl: SharedControlConfig<
  'DndColumnSelect' | 'SelectControl',
  ColumnMeta
> = {
  type: 'DndColumnSelect',
  label: t('Dimensions'),
  multi: true,
  freeForm: true,
  clearable: true,
  default: [],
  includeTime: false,
  description: t(
    'Dimensions contain qualitative values such as names, dates, or geographical data. ' +
      'Use dimensions to categorize, segment, and reveal the details in your data. ' +
      'Dimensions affect the level of detail in the view.',
  ),
  optionRenderer: (c: ColumnMeta) => <ColumnOption showType column={c} />,
  valueRenderer: (c: ColumnMeta) => <ColumnOption column={c} />,
  valueKey: 'column_name',
  allowAll: true,
  filterOption: ({ data: opt }: FilterOption<ColumnMeta>, text: string) =>
    opt.column_name?.toLowerCase().includes(text.toLowerCase()) ||
    opt.verbose_name?.toLowerCase().includes(text.toLowerCase()) ||
    false,
  promptTextCreator: (label: unknown) => label,
  mapStateToProps(state, controlState) {
    const newState: ExtraControlProps = {};
    const { datasource } = state;
    if (datasource?.columns[0]?.hasOwnProperty('groupby')) {
      const options = filterOptions(
        (datasource as Dataset).columns.filter(c => c.groupby),
        controlState?.allowedDataTypes,
      );
      if (controlState?.includeTime) {
        options.unshift(DATASET_TIME_COLUMN_OPTION);
      }
      newState.options = options;
      newState.savedMetrics = (datasource as Dataset).metrics || [];
    } else {
      const options = filterOptions(
        (datasource?.columns as QueryColumn[]) || [],
        controlState?.allowedDataTypes,
      );
      if (controlState?.includeTime) {
        options.unshift(QUERY_TIME_COLUMN_OPTION);
      }
      newState.options = options;
    }
    return newState;
  },
  commaChoosesOption: false,
};

export const dndGroupByControl = enhanceControlWithSemanticLayer(
  baseDndGroupByControl,
  'groupby',
  'columns',
);

const baseDndColumnsControl: typeof baseDndGroupByControl = {
  ...baseDndGroupByControl,
  label: t('Columns'),
  description: t('Add dataset columns here to group the pivot table columns.'),
};

export const dndColumnsControl = enhanceControlWithSemanticLayer(
  baseDndColumnsControl,
  'columns',
  'columns',
);

const baseDndSeriesControl: typeof baseDndGroupByControl = {
  ...baseDndGroupByControl,
  label: t('Dimension'),
  multi: false,
  default: null,
  description: t(
    'Defines the grouping of entities. ' +
      'Each series is represented by a specific color in the chart.',
  ),
};

export const dndSeriesControl = enhanceControlWithSemanticLayer(
  baseDndSeriesControl,
  'series',
  'columns',
);

const baseDndEntityControl: typeof baseDndGroupByControl = {
  ...baseDndGroupByControl,
  label: t('Entity'),
  default: null,
  multi: false,
  validators: [validateNonEmpty],
  description: t('This defines the element to be plotted on the chart'),
};

export const dndEntityControl = enhanceControlWithSemanticLayer(
  baseDndEntityControl,
  'entity',
  'columns',
);

export const dndAdhocFilterControl: SharedControlConfig<
  'DndFilterSelect' | 'AdhocFilterControl'
> = {
  type: 'DndFilterSelect',
  label: t('Filters'),
  default: [],
  description: '',
  mapStateToProps: ({ datasource, form_data }) => ({
    columns: isDataset(datasource)
      ? datasource.columns.filter(c => c.filterable)
      : datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    // current active adhoc metrics
    selectedMetrics:
      form_data.metrics || (form_data.metric ? [form_data.metric] : []),
    datasource,
  }),
  provideFormDataToProps: true,
  ...datePickerInAdhocFilterMixin,
};

const baseDndAdhocMetricsControl: SharedControlConfig<
  'DndMetricSelect' | 'MetricsControl'
> = {
  type: 'DndMetricSelect',
  multi: true,
  label: t('Metrics'),
  validators: [validateNonEmpty],
  mapStateToProps: ({ datasource }) => ({
    columns: datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    datasource,
    datasourceType: datasource?.type,
  }),
  description: t(
    'Select one or many metrics to display. ' +
      'You can use an aggregation function on a column ' +
      'or write custom SQL to create a metric.',
  ),
};

export const dndAdhocMetricsControl = enhanceControlWithSemanticLayer(
  baseDndAdhocMetricsControl,
  'metrics',
  'metrics',
);

const baseDndAdhocMetricControl: typeof baseDndAdhocMetricsControl = {
  ...baseDndAdhocMetricsControl,
  multi: false,
  label: t('Metric'),
  description: t(
    'Select a metric to display. ' +
      'You can use an aggregation function on a column ' +
      'or write custom SQL to create a metric.',
  ),
};

export const dndAdhocMetricControl = enhanceControlWithSemanticLayer(
  baseDndAdhocMetricControl,
  'metric',
  'metrics',
);

export const dndTooltipColumnsControl: typeof dndColumnsControl = {
  ...dndColumnsControl,
  label: t('Tooltip (columns)'),
  description: t('Columns to show in the tooltip.'),
};

export const dndTooltipMetricsControl: typeof dndAdhocMetricsControl = {
  ...dndAdhocMetricsControl,
  label: t('Tooltip (metrics)'),
  description: t('Metrics to show in the tooltip.'),
  validators: [],
};

const baseDndAdhocMetricControl2: typeof baseDndAdhocMetricControl = {
  ...baseDndAdhocMetricControl,
  label: t('Right Axis Metric'),
  clearable: true,
  description: t('Select a metric to display on the right axis'),
};

export const dndAdhocMetricControl2 = enhanceControlWithSemanticLayer(
  baseDndAdhocMetricControl2,
  'metric_2',
  'metrics',
);

export const dndSortByControl: SharedControlConfig<
  'DndMetricSelect' | 'MetricsControl'
> = {
  type: 'DndMetricSelect',
  label: t('Sort query by'),
  default: null,
  description: t(
    'Orders the query result that generates the source data for this chart. ' +
      'If a series or row limit is reached, this determines what data are truncated. ' +
      'If undefined, defaults to the first metric (where appropriate).',
  ),
  mapStateToProps: ({ datasource }) => ({
    columns: datasource?.columns || [],
    savedMetrics: defineSavedMetrics(datasource),
    datasource,
    datasourceType: datasource?.type,
  }),
};

const baseDndSizeControl: typeof baseDndAdhocMetricControl = {
  ...baseDndAdhocMetricControl,
  label: t('Bubble Size'),
  description: t('Metric used to calculate bubble size'),
  default: null,
};

export const dndSizeControl = enhanceControlWithSemanticLayer(
  baseDndSizeControl,
  'size',
  'metrics',
);

const baseDndXControl: typeof baseDndAdhocMetricControl = {
  ...baseDndAdhocMetricControl,
  label: t('X Axis'),
  description: t(
    "The dataset column/metric that returns the values on your chart's x-axis.",
  ),
  default: null,
};

export const dndXControl = enhanceControlWithSemanticLayer(
  baseDndXControl,
  'x',
  'metrics',
);

const baseDndYControl: typeof baseDndAdhocMetricControl = {
  ...baseDndAdhocMetricControl,
  label: t('Y Axis'),
  description: t(
    "The dataset column/metric that returns the values on your chart's y-axis.",
  ),
  default: null,
};

export const dndYControl = enhanceControlWithSemanticLayer(
  baseDndYControl,
  'y',
  'metrics',
);

const baseDndSecondaryMetricControl: typeof baseDndAdhocMetricControl = {
  ...baseDndAdhocMetricControl,
  label: t('Color Metric'),
  default: null,
  validators: [],
  description: t('A metric to use for color'),
};

export const dndSecondaryMetricControl = enhanceControlWithSemanticLayer(
  baseDndSecondaryMetricControl,
  'secondary_metric',
  'metrics',
);

export const dndGranularitySqlaControl: typeof dndSeriesControl = {
  ...dndSeriesControl,
  ...temporalColumnMixin,
  label: TIME_FILTER_LABELS.granularity_sqla,
  description: t(
    'The time column for the visualization. Note that you ' +
      'can define arbitrary expression that return a DATETIME ' +
      'column in the table. Also note that the ' +
      'filter below is applied against this column or ' +
      'expression',
  ),
  default: (c: Control) => c.default,
  clearable: false,
  canDelete: false,
  ghostButtonText: t('Drop a temporal column here or click'),
  optionRenderer: (c: ColumnMeta) => <ColumnOption showType column={c} />,
  valueRenderer: (c: ColumnMeta) => <ColumnOption column={c} />,
  valueKey: 'column_name',
};

const baseDndXAxisControl: typeof baseDndGroupByControl = {
  ...baseDndGroupByControl,
  ...xAxisMixin,
};

export const dndXAxisControl = enhanceControlWithSemanticLayer(
  baseDndXAxisControl,
  'x_axis',
  'columns',
);
