import {
  ControlPanelState,
  ControlSetItem,
  ControlState,
  sharedControls,
} from '@superset-ui/chart-controls';
import { FeatureFlag, isFeatureEnabled, t } from '@superset-ui/core';
import { getQueryMode, isAggMode, validateAggControlValues } from './shared';

const percentMetrics: typeof sharedControls.metrics = {
  type: 'MetricsControl',
  label: t('Percentage metrics'),
  description: t(
    'Metrics for which percentage of total are to be displayed. Calculated from only data within the row limit.',
  ),
  multi: true,
  visibility: isAggMode,
  mapStateToProps: ({ datasource, controls }, controlState) => ({
    columns: datasource?.columns || [],
    savedMetrics: datasource?.metrics || [],
    datasource,
    datasourceType: datasource?.type,
    queryMode: getQueryMode(controls),
    externalValidationErrors: validateAggControlValues(controls, [
      controls.groupby?.value,
      controls.metrics?.value,
      controlState.value,
    ]),
  }),
  rerender: ['groupby', 'metrics'],
  default: [],
  validators: [],
};

const dndPercentMetrics = {
  ...percentMetrics,
  type: 'DndMetricSelect',
};

export const percentMetricsControlSetItem: ControlSetItem = {
  name: 'percent_metrics',
  config: {
    ...(isFeatureEnabled(FeatureFlag.ENABLE_EXPLORE_DRAG_AND_DROP)
      ? dndPercentMetrics
      : percentMetrics),
  },
};

export const metricsControlSetItem: ControlSetItem = {
  name: 'metrics',
  override: {
    validators: [],
    visibility: isAggMode,
    mapStateToProps: (
      { controls, datasource, form_data }: ControlPanelState,
      controlState: ControlState,
    ) => ({
      columns: datasource?.columns.filter(c => c.filterable) || [],
      savedMetrics: datasource?.metrics || [],
      // current active adhoc metrics
      selectedMetrics:
        form_data.metrics || (form_data.metric ? [form_data.metric] : []),
      datasource,
      externalValidationErrors: validateAggControlValues(controls, [
        controls.groupby?.value,
        controls.percent_metrics?.value,
        controlState.value,
      ]),
    }),
    rerender: ['groupby', 'percent_metrics'],
  },
};

export const showTotalsControlSetItem: ControlSetItem = {
  name: 'show_totals',
  config: {
    type: 'CheckboxControl',
    label: t('Show totals'),
    default: false,
    description: t(
      'Show total aggregations of selected metrics. Note that row limit does not apply to the result.',
    ),
    visibility: isAggMode,
  },
};
