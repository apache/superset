import { createSelector } from 'reselect';
import { convertKeysToCamelCase } from '@superset-ui/core';
import { HandlerFunction, PlainObject } from '../types/Base';

// TODO: more specific typing for these fields of ChartProps
type AnnotationData = PlainObject;
type CamelCaseDatasource = PlainObject;
type SnakeCaseDatasource = PlainObject;
type CamelCaseFormData = PlainObject;
type SnakeCaseFormData = PlainObject;
export type QueryData = PlainObject;
/** Initial values for the visualizations, currently used by only filter_box and table */
type InitialValues = PlainObject;
type ChartPropsSelector = (c: ChartPropsConfig) => ChartProps;

/** Optional field for event handlers, renderers */
type Hooks = {
  /** handle adding filters  */
  onAddFilter?: HandlerFunction;
  /** handle errors  */
  onError?: HandlerFunction;
  /** use the vis as control to update state */
  setControlValue?: HandlerFunction;
  /** handle tooltip */
  setTooltip?: HandlerFunction;
  [key: string]: any;
};

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
  initialValues?: InitialValues;
  /** Main configuration of the chart */
  formData?: SnakeCaseFormData;
  /** Chart height */
  height?: number;
  /** Programmatic overrides such as event handlers, renderers */
  hooks?: Hooks;
  /** Formerly called "payload" */
  queryData?: QueryData;
  /** Chart width */
  width?: number;
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

export default class ChartProps<
  FormDataType extends CamelCaseFormData | SnakeCaseFormData = CamelCaseFormData
> {
  static createSelector: () => ChartPropsSelector;

  annotationData: AnnotationData;

  datasource: CamelCaseDatasource;

  rawDatasource: SnakeCaseDatasource;

  initialValues: InitialValues;

  formData: CamelCaseFormData;

  rawFormData: SnakeCaseFormData | CamelCaseFormData;

  height: number;

  hooks: Hooks;

  queryData: QueryData;

  width: number;

  constructor(config: ChartPropsConfig = {}) {
    const {
      annotationData = {},
      datasource = {},
      formData = {} as FormDataType,
      hooks = {},
      initialValues = {},
      queryData = {},
      width = DEFAULT_WIDTH,
      height = DEFAULT_HEIGHT,
    } = config;
    this.width = width;
    this.height = height;
    this.annotationData = annotationData;
    this.datasource = convertKeysToCamelCase(datasource);
    this.rawDatasource = datasource;
    this.formData = convertKeysToCamelCase(formData);
    this.rawFormData = formData;
    this.hooks = hooks;
    this.initialValues = initialValues;
    this.queryData = queryData;
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
    input => input.queryData,
    input => input.width,
    (annotationData, datasource, formData, height, hooks, initialValues, queryData, width) =>
      new ChartProps({
        annotationData,
        datasource,
        formData,
        height,
        hooks,
        initialValues,
        queryData,
        width,
      }),
  );
};
