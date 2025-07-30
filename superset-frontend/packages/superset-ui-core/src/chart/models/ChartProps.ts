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

import { RefObject } from 'react';
import { createSelector, lruMemoize } from 'reselect';
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
import { supersetTheme, SupersetTheme } from '../../theme';

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
  /* handle legend scroll changes */
  onLegendScroll?: HandlerFunction;
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
  /* legend index */
  legendIndex?: number;
  inContextMenu?: boolean;
  emitCrossFilters?: boolean;
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

  legendIndex?: number;

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

  constructor(
    config: ChartPropsConfig & { formData?: FormData } = {
      theme: supersetTheme,
    },
  ) {
    const {
      annotationData = {},
      datasource = {},
      formData = {} as FormData,
      hooks = {},
      ownState = {},
      filterState = {},
      legendState,
      legendIndex,
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
    this.legendIndex = legendIndex;
    this.behaviors = behaviors;
    this.displaySettings = displaySettings;
    this.appSection = appSection;
    this.isRefreshing = isRefreshing;
    this.inputRef = inputRef;
    this.inContextMenu = inContextMenu;
    this.emitCrossFilters = emitCrossFilters;
    this.theme = theme;
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
    input => input.legendIndex,
    input => input.behaviors,
    input => input.displaySettings,
    input => input.appSection,
    input => input.isRefreshing,
    input => input.inputRef,
    input => input.inContextMenu,
    input => input.emitCrossFilters,
    input => input.theme,
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
      legendIndex,
      behaviors,
      displaySettings,
      appSection,
      isRefreshing,
      inputRef,
      inContextMenu,
      emitCrossFilters,
      theme,
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
        legendIndex,
        width,
        behaviors,
        displaySettings,
        appSection,
        isRefreshing,
        inputRef,
        inContextMenu,
        emitCrossFilters,
        theme,
      }),
    // Below config is to retain usage of 1-sized `lruMemoize` object in Reselect v4
    // Reselect v5 introduces `weakMapMemoize` which is more performant but potentially memory-leaky
    // due to infinite cache size.
    // Source: https://github.com/reduxjs/reselect/releases/tag/v5.0.1
    {
      memoize: lruMemoize,
      argsMemoize: lruMemoize,
      memoizeOptions: {
        maxSize: 10,
      },
    },
  );
};
