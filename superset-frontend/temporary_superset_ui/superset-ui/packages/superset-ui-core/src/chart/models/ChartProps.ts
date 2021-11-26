import { createSelector } from 'reselect';
import { Behavior, convertKeysToCamelCase, Datasource, JsonObject } from '../..';
import { HandlerFunction, PlainObject, SetDataMaskHook } from '../types/Base';
import { QueryData, DataRecordFilters } from '..';

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
  /** handle errors */
  onError?: HandlerFunction;
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
  /**
   * Formerly called "filters", which was misleading because it is actually
   * initial values of the filter_box and table vis
   */
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
  /** Own chart state of object that saved in dashboard */
  ownCurrentState?: JsonObject;
  /** Set of actual behaviors that this instance of chart should use */
  behaviors?: Behavior[];
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

  ownCurrentState: JsonObject;

  queriesData: QueryData[];

  width: number;

  behaviors: Behavior[];

  constructor(config: ChartPropsConfig & { formData?: FormData } = {}) {
    const {
      annotationData = {},
      datasource = {},
      formData = {} as FormData,
      hooks = {},
      ownCurrentState = {},
      initialValues = {},
      queriesData = [],
      behaviors = [],
      width = DEFAULT_WIDTH,
      height = DEFAULT_HEIGHT,
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
    this.ownCurrentState = ownCurrentState;
    this.behaviors = behaviors;
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
    input => input.ownCurrentState,
    input => input.behaviors,
    (
      annotationData,
      datasource,
      formData,
      height,
      hooks,
      initialValues,
      queriesData,
      width,
      ownCurrentState,
      behaviors,
    ) =>
      new ChartProps({
        annotationData,
        datasource,
        formData,
        height,
        hooks,
        initialValues,
        queriesData,
        ownCurrentState,
        width,
        behaviors,
      }),
  );
};
