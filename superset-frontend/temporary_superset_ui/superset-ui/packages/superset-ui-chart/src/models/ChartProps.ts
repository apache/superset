import { createSelector } from 'reselect';
import { convertKeysToCamelCase } from '@superset-ui/core';
import { Datasource } from '@superset-ui/query';
import { HandlerFunction, PlainObject } from '../types/Base';
import { QueryData, DataRecordFilters } from '../types/QueryResponse';

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
  /** Formerly called "payload" */
  queryData?: QueryData;
  /** Chart width */
  width?: number;
}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

export default class ChartProps {
  static createSelector: () => ChartPropsSelector;

  annotationData: AnnotationData;

  datasource: Datasource;

  rawDatasource: SnakeCaseDatasource;

  initialValues: DataRecordFilters;

  formData: CamelCaseFormData;

  rawFormData: RawFormData;

  height: number;

  hooks: Hooks;

  queryData: QueryData;

  width: number;

  constructor(config: ChartPropsConfig = {}) {
    const {
      annotationData = {},
      datasource = {},
      formData = {},
      hooks = {},
      initialValues = {},
      queryData = {},
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
