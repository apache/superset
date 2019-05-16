import { createSelector } from 'reselect';
import { convertKeysToCamelCase } from '@superset-ui/core';

interface PlainObject {
  [key: string]: any;
}

// TODO: more specific typing for these fields of ChartProps
type AnnotationData = PlainObject;
type CamelCaseDatasource = PlainObject;
type SnakeCaseDatasource = PlainObject;
type CamelCaseFormData = PlainObject;
type SnakeCaseFormData = PlainObject;
export type QueryData = PlainObject;
type Filters = any[];
type HandlerFunction = (...args: any[]) => void;
type ChartPropsSelector = (c: ChartPropsConfig) => ChartProps;

interface ChartPropsConfig {
  annotationData?: AnnotationData;
  datasource?: SnakeCaseDatasource;
  filters?: Filters;
  formData?: SnakeCaseFormData;
  height?: number;
  hooks?: PlainObject;
  onAddFilter?: HandlerFunction;
  onError?: HandlerFunction;
  payload?: QueryData;
  setControlValue?: HandlerFunction;
  setTooltip?: HandlerFunction;
  width?: number;
}

function NOOP() {}

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

export default class ChartProps {
  static createSelector: () => ChartPropsSelector;

  annotationData: AnnotationData;
  datasource: CamelCaseDatasource;
  rawDatasource: SnakeCaseDatasource;
  filters: Filters;
  formData: CamelCaseFormData;
  rawFormData: SnakeCaseFormData;
  height: number;
  hooks: PlainObject;
  onAddFilter: HandlerFunction;
  onError: HandlerFunction;
  payload: QueryData;
  setControlValue: HandlerFunction;
  setTooltip: HandlerFunction;
  width: number;

  constructor(config: ChartPropsConfig = {}) {
    const {
      annotationData = {},
      datasource = {},
      filters = [],
      formData = {},
      hooks = {},
      onAddFilter = NOOP,
      onError = NOOP,
      payload = {},
      setControlValue = NOOP,
      setTooltip = NOOP,
      width = DEFAULT_WIDTH,
      height = DEFAULT_HEIGHT,
    } = config;
    this.width = width;
    this.height = height;
    this.annotationData = annotationData;
    this.datasource = convertKeysToCamelCase(datasource);
    this.rawDatasource = datasource;
    this.filters = filters;
    this.formData = convertKeysToCamelCase(formData);
    this.hooks = hooks;
    this.rawFormData = formData;
    this.onAddFilter = onAddFilter;
    this.onError = onError;
    this.payload = payload;
    this.setControlValue = setControlValue;
    this.setTooltip = setTooltip;
  }
}

ChartProps.createSelector = function create(): ChartPropsSelector {
  return createSelector(
    (input: ChartPropsConfig) => input.annotationData,
    input => input.datasource,
    input => input.filters,
    input => input.formData,
    input => input.height,
    input => input.hooks,
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
      hooks,
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
        hooks,
        onAddFilter,
        onError,
        payload,
        setControlValue,
        setTooltip,
        width,
      }),
  );
};
