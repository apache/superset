/*
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
  /** Own chart state that saved in dashboard */
  ownState?: JsonObject;
  /** Filter state that saved in dashboard */
  filterState?: FilterState;
  /** Set of actual behaviors that this instance of chart should use */
  behaviors?: Behavior[];
  /** Application section of the chart on the screen (in what components/screen it placed) */
  appSection?: AppSection;
  /** is the chart refreshing its contents */
  isRefreshing?: boolean;
  /** chart ref */
  inputRef?: RefObject<any>;
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

  queriesData: QueryData[];

  width: number;

  behaviors: Behavior[];

  appSection?: AppSection;

  isRefreshing?: boolean;

  inputRef?: RefObject<any>;

  constructor(config: ChartPropsConfig & { formData?: FormData } = {}) {
    const {
      annotationData = {},
      datasource = {},
      formData = {} as FormData,
      hooks = {},
      ownState = {},
      filterState = {},
      initialValues = {},
      queriesData = [],
      behaviors = [],
      width = DEFAULT_WIDTH,
      height = DEFAULT_HEIGHT,
      appSection,
      isRefreshing,
      inputRef,
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
    this.behaviors = behaviors;
    this.appSection = appSection;
    this.isRefreshing = isRefreshing;
    this.inputRef = inputRef;
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
    input => input.behaviors,
    input => input.appSection,
    input => input.isRefreshing,
    input => input.inputRef,
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
      behaviors,
      appSection,
      isRefreshing,
      inputRef,
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
        width,
        behaviors,
        appSection,
        isRefreshing,
        inputRef,
      }),
  );
};
