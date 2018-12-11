import { createSelector } from 'reselect';
import { convertKeysToCamelCase } from '@superset-ui/core';

interface PlainObject {
  [key: string]: any;
}

type AnnotationData = PlainObject;
type CamelCaseDatasource = PlainObject;
type SnakeCaseDatasource = PlainObject;
type CamelCaseFormData = PlainObject;
type SnakeCaseFormData = PlainObject;
type QueryData = PlainObject;
type Filters = Array<any>;
type HandlerFunction = (...args: any[]) => void;
type ChartPropsSelector = (c: ChartPropsConfig) => ChartProps;

export interface ChartPropsConfig {
  annotationData?: AnnotationData;
  datasource?: SnakeCaseDatasource;
  filters?: Filters;
  formData: SnakeCaseFormData;
  height: number;
  onAddFilter?: HandlerFunction;
  onError?: HandlerFunction;
  payload: QueryData;
  setControlValue?: HandlerFunction;
  setTooltip?: HandlerFunction;
  width: number;
}

function NOOP() {}

export class ChartProps {
  static createSelector: () => ChartPropsSelector;

  annotationData: AnnotationData;
  datasource: CamelCaseDatasource;
  rawDatasource: SnakeCaseDatasource;
  filters: Filters;
  formData: CamelCaseFormData;
  rawFormData: SnakeCaseFormData;
  height: number;
  onAddFilter: HandlerFunction;
  onError: HandlerFunction;
  payload: QueryData;
  setControlValue: HandlerFunction;
  setTooltip: HandlerFunction;
  width: number;

  constructor(config: ChartPropsConfig) {
    this.width = config.width;
    this.height = config.height;
    this.annotationData = config.annotationData || {};
    this.datasource = convertKeysToCamelCase(config.datasource);
    this.rawDatasource = config.datasource || {};
    this.filters = config.filters || [];
    this.formData = convertKeysToCamelCase(config.formData);
    this.rawFormData = config.formData;
    this.onAddFilter = config.onAddFilter || NOOP;
    this.onError = config.onError || NOOP;
    this.payload = config.payload;
    this.setControlValue = config.setControlValue || NOOP;
    this.setTooltip = config.setTooltip || NOOP;
  }
}

ChartProps.createSelector = function create(): ChartPropsSelector {
  return createSelector(
    (input: ChartPropsConfig) => input.annotationData,
    input => input.datasource,
    input => input.filters,
    input => input.formData,
    input => input.height,
    input => input.onAddFilter,
    input => input.onError,
    input => input.payload,
    input => input.setControlValue,
    input => input.setTooltip,
    input => input.width,
    (
      annotationData,
      datasource,
      filters,
      formData,
      height,
      onAddFilter,
      onError,
      payload,
      setControlValue,
      setTooltip,
      width,
    ) =>
      new ChartProps({
        annotationData,
        datasource,
        filters,
        formData,
        height,
        onAddFilter,
        onError,
        payload,
        setControlValue,
        setTooltip,
        width,
      }),
  );
};
