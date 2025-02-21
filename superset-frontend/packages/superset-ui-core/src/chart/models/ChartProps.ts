// DODO was here

/** Type checking is disabled for this file due to reselect only supporting
 * TS declarations for selectors with up to 12 arguments. */
// @ts-nocheck
import { RefObject } from 'react';
import { createSelector } from 'reselect';
import {
  AppSection,
  Behavior,
  convertKeysToCamelCase,
  Datasource,
  FilterState,
  JsonObject,
} from '../..';
import {
  HandlerFunction,
  LegendState,
  PlainObject,
  SetDataMaskHook,
} from '../types/Base';
import { QueryData, DataRecordFilters } from '..';
import { SupersetTheme } from '../../style';

// TODO: more specific typing for these fields of ChartProps
type AnnotationData = PlainObject;
type SnakeCaseDatasource = PlainObject;
type CamelCaseFormData = PlainObject;
type SnakeCaseFormData = PlainObject;
type RawFormData = CamelCaseFormData | SnakeCaseFormData;

type ChartPropsSelector = (c: ChartPropsConfig) => ChartProps;

/** Optional field for event handlers, renderers */
type Hooks = {
  /**
   * sync active filters between chart and dashboard, "add" actually
   * also handles "change" and "remove".
   */
  onAddFilter?: (newFilters: DataRecordFilters, merge?: boolean) => void;
  /** handle right click */
  onContextMenu?: HandlerFunction;
  /** handle errors */
  onError?: HandlerFunction;
  /** handle legend state changes */
  onLegendStateChanged?: HandlerFunction;
  /** use the vis as control to update state */
  setControlValue?: HandlerFunction;
  /** handle external filters */
  setDataMask?: SetDataMaskHook;
  /** handle tooltip */
  setTooltip?: HandlerFunction;
} & PlainObject;

/**
 * Preferred format for ChartProps config
 */
export interface ChartPropsConfig {
  annotationData?: AnnotationData;
  /** Datasource metadata */
  datasource?: SnakeCaseDatasource;
  initialValues?: DataRecordFilters;
  /** Main configuration of the chart */
  formData?: RawFormData;
  /** Chart height */
  height?: number;
  /** Programmatic overrides such as event handlers, renderers */
  hooks?: Hooks;
  /** The data returned for all queries objects in the request */
  queriesData?: QueryData[];
  /** Chart width */
  width?: number;
  /** Own chart state that saved in dashboard */
  ownState?: JsonObject;
  /** Filter state that saved in dashboard */
  filterState?: FilterState;
  /** Legend state */
  legendState?: LegendState;
  /** Set of actual behaviors that this instance of chart should use */
  behaviors?: Behavior[];
  /** Chart display settings related to current view context */
  displaySettings?: JsonObject;
  /** Application section of the chart on the screen (in what components/screen it placed) */
  appSection?: AppSection;
  /** is the chart refreshing its contents */
  isRefreshing?: boolean;
  /** chart ref */
  inputRef?: RefObject<any>;
  /** Theme object */
  theme: SupersetTheme;
  /** User's language */
  locale?: string; // DODO added 44728892
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

export default class ChartProps<FormData extends RawFormData = RawFormData> {
  static createSelector: () => ChartPropsSelector;

  annotationData: AnnotationData;

  datasource: Datasource;

  rawDatasource: SnakeCaseDatasource;

  initialValues: DataRecordFilters;

  formData: CamelCaseFormData;

  rawFormData: FormData;

  height: number;

  hooks: Hooks;

  ownState: JsonObject;

  filterState: FilterState;

  legendState?: LegendState;

  queriesData: QueryData[];

  width: number;

  behaviors: Behavior[];

  displaySettings?: JsonObject;

  appSection?: AppSection;

  isRefreshing?: boolean;

  inputRef?: RefObject<any>;

  inContextMenu?: boolean;

  emitCrossFilters?: boolean;

  theme: SupersetTheme;

  locale: string; // DODO added 44728892

  constructor(config: ChartPropsConfig & { formData?: FormData } = {}) {
    const {
      annotationData = {},
      datasource = {},
      formData = {} as FormData,
      hooks = {},
      ownState = {},
      filterState = {},
      legendState,
      initialValues = {},
      queriesData = [],
      behaviors = [],
      displaySettings = {},
      width = DEFAULT_WIDTH,
      height = DEFAULT_HEIGHT,
      appSection,
      isRefreshing,
      inputRef,
      inContextMenu = false,
      emitCrossFilters = false,
      theme,
      locale, // DODO added 44728892
    } = config;
    this.width = width;
    this.height = height;
    this.annotationData = annotationData;
    this.datasource = convertKeysToCamelCase(datasource) as Datasource;
    this.rawDatasource = datasource;
    this.formData = convertKeysToCamelCase(formData);
    this.rawFormData = formData;
    this.hooks = hooks;
    this.initialValues = initialValues;
    this.queriesData = queriesData;
    this.ownState = ownState;
    this.filterState = filterState;
    this.legendState = legendState;
    this.behaviors = behaviors;
    this.displaySettings = displaySettings;
    this.appSection = appSection;
    this.isRefreshing = isRefreshing;
    this.inputRef = inputRef;
    this.inContextMenu = inContextMenu;
    this.emitCrossFilters = emitCrossFilters;
    this.theme = theme;
    this.locale = locale; // DODO added 44728892
  }
}

// eslint-disable-next-line func-name-matching
ChartProps.createSelector = function create(): ChartPropsSelector {
  return createSelector(
    (input: ChartPropsConfig) => input.annotationData,
    input => input.datasource,
    input => input.formData,
    input => input.height,
    input => input.hooks,
    input => input.initialValues,
    input => input.queriesData,
    input => input.width,
    input => input.ownState,
    input => input.filterState,
    input => input.legendState,
    input => input.behaviors,
    input => input.displaySettings,
    input => input.appSection,
    input => input.isRefreshing,
    input => input.inputRef,
    input => input.inContextMenu,
    input => input.emitCrossFilters,
    input => input.theme,
    input => input.locale, // DODO added 44728892
    (
      annotationData,
      datasource,
      formData,
      height,
      hooks,
      initialValues,
      queriesData,
      width,
      ownState,
      filterState,
      legendState,
      behaviors,
      displaySettings,
      appSection,
      isRefreshing,
      inputRef,
      inContextMenu,
      emitCrossFilters,
      theme,
      locale, // DODO added 44728892
    ) =>
      new ChartProps({
        annotationData,
        datasource,
        formData,
        height,
        hooks,
        initialValues,
        queriesData,
        ownState,
        filterState,
        legendState,
        width,
        behaviors,
        displaySettings,
        appSection,
        isRefreshing,
        inputRef,
        inContextMenu,
        emitCrossFilters,
        theme,
        locale, // DODO added 44728892
      }),
  );
};
