// DODO was here
import {
  CustomControlItem, // DODO added 44211769
  DEFAULT_SORT_SERIES_DATA,
  sections,
} from '@superset-ui/chart-controls';
import { ChartDataResponseResult, isSavedMetric, t } from '@superset-ui/core';
import { LegendOrientation, LegendType } from '../types';
import {
  OrientationType,
  EchartsTimeseriesSeriesType,
  EchartsTimeseriesFormData,
} from './types';
// import {
//   DEFAULT_LEGEND_FORM_DATA,
//   DEFAULT_TITLE_FORM_DATA,
// } from '../constants';
import { defaultXAxis } from '../defaults';

// @ts-ignore
export const DEFAULT_FORM_DATA: EchartsTimeseriesFormData = {
  // ...DEFAULT_LEGEND_FORM_DATA, // TODO: figure out why these break things for stories (e.g. Bubble Chart)
  // Here are the contents of DEFAULT_LEGEND_FORM_DATA:
  legendMargin: null,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
  showLegend: true,
  // ...DEFAULT_TITLE_FORM_DATA, // TODO: figure out why these break things for stories (e.g. Bubble Chart)
  // here are the contents of DEFAULT_TITLE_FORM_DATA:
  xAxisTitle: '',
  xAxisTitleMargin: 0,
  yAxisTitle: '',
  yAxisTitleMargin: 0,
  yAxisTitlePosition: 'Top',
  // Now that the weird bug workaround is over, here's the rest...
  ...DEFAULT_SORT_SERIES_DATA,
  annotationLayers: sections.annotationLayers,
  area: false,
  forecastEnabled: sections.FORECAST_DEFAULT_DATA.forecastEnabled,
  forecastInterval: sections.FORECAST_DEFAULT_DATA.forecastInterval,
  forecastPeriods: sections.FORECAST_DEFAULT_DATA.forecastPeriods,
  forecastSeasonalityDaily:
    sections.FORECAST_DEFAULT_DATA.forecastSeasonalityDaily,
  forecastSeasonalityWeekly:
    sections.FORECAST_DEFAULT_DATA.forecastSeasonalityWeekly,
  forecastSeasonalityYearly:
    sections.FORECAST_DEFAULT_DATA.forecastSeasonalityYearly,
  logAxis: false,
  markerEnabled: false,
  markerSize: 6,
  minorSplitLine: false,
  opacity: 0.2,
  orderDesc: true,
  rowLimit: 10000,
  seriesType: EchartsTimeseriesSeriesType.Line,
  stack: false,
  tooltipTimeFormat: 'smart_date',
  truncateXAxis: true,
  truncateYAxis: false,
  yAxisBounds: [null, null],
  zoomable: false,
  richTooltip: true,
  xAxisForceCategorical: false,
  xAxisLabelRotation: defaultXAxis.xAxisLabelRotation,
  groupby: [],
  showValue: false,
  onlyTotal: false,
  percentageThreshold: 0,
  orientation: OrientationType.Vertical,
  sort_series_type: 'sum',
  sort_series_ascending: false,
};

export const TIME_SERIES_DESCRIPTION_TEXT: string = t(
  'When using other than adaptive formatting, labels may overlap',
);

// DODO added 44211769
export const CONTROL_PANEL_COLUMN_CONFIG: CustomControlItem = {
  name: 'column_config',
  config: {
    type: 'ColumnConfigControl',
    label: t('Customize Metrics'),
    width: 400,
    height: 175,
    renderTrigger: true,
    configFormLayout: {
      '0': [['d3NumberFormat']],
      '1': [],
      '2': [],
      '3': [],
    },
    shouldMapStateToProps() {
      return true;
    },
    mapStateToProps(explore, _, chart) {
      // Showing metrics instead of columns
      const colnames = [...(chart?.latestQueryFormData?.metrics ?? [])].map(
        metric => (isSavedMetric(metric) ? metric : metric?.label),
      );
      const coltypes = Array.from({ length: colnames.length }, () => 0);
      const newQueriesResponse = {
        ...(chart?.queriesResponse?.[0] ?? {}),
        colnames,
        coltypes,
      };
      return {
        queryResponse: newQueriesResponse as
          | ChartDataResponseResult
          | undefined,
      };
    },
  },
};
