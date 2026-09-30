/**
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
import { explore as exploreApi } from '@apache-superset/core';
import type {
  ChartDataResponseResult,
  JsonObject,
  QueryFormData,
} from '@superset-ui/core';
import type {
  ControlState,
  ControlStateMapping,
  ControlValueValidator,
} from '@superset-ui/chart-controls';
import { setControlValue } from 'src/explore/actions/exploreActions';
import { getVisibleFormDataFromControls } from 'src/explore/controlUtils';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import { store, RootState } from 'src/views/store';
import { navigation } from '../navigation';

const getExploreState = () => (store.getState() as RootState).explore;

// The Redux slice below is retained across an in-SPA navigation, so
// checking it alone can't tell a still-active chart from a stale one left
// over from before the user navigated to another page.
const isExploreActive = (): boolean => navigation.getPage() === 'explore';

const getChartId: typeof exploreApi.getChartId = () =>
  isExploreActive()
    ? (getExploreState().slice?.slice_id ?? undefined)
    : undefined;

const getControlValues: typeof exploreApi.getControlValues = () =>
  isExploreActive()
    ? { ...(getExploreState().form_data as Record<string, unknown>) }
    : {};

const getControlValue: typeof exploreApi.getControlValue = (name: string) =>
  isExploreActive()
    ? (getExploreState().form_data as Record<string, unknown>)[name]
    : undefined;

// Explore queries with the form data derived from the current `controls`
// state (see ExploreViewContainer's mapStateToProps), not the pre-normalization
// `form_data` slice, which can lag behind controls filled in by defaults or by
// mapStateToProps. Sharing getVisibleFormDataFromControls with
// mapStateToProps keeps getQuery()/getChartData() describing the same data
// as the chart on screen.
const getCurrentFormData = (): QueryFormData => {
  const { controls, hiddenFormData } = getExploreState();
  return getVisibleFormDataFromControls(controls ?? {}, hiddenFormData);
};

// Mirrors the currently-applied server-side state (e.g. a Table chart's
// current page) that Explore keeps in `dataMask` rather than `form_data`, so
// a paginated chart's exported query/data matches what's on screen.
const getOwnState = (chartId: number | undefined): JsonObject | undefined =>
  chartId != null
    ? (store.getState() as RootState).dataMask[chartId]?.ownState
    : undefined;

const requireFormData = (): QueryFormData => {
  const formData = getCurrentFormData();
  if (!isExploreActive() || !formData?.datasource) {
    throw new Error('No chart is currently loaded in Explore');
  }
  return formData;
};

// Top-level ECharts option keys Superset never exposes as a discrete
// control (see sharedControls.tsx's `echart_options`). A caller trying to
// set one of these by name isn't naming a typo — they're reaching for a
// setting that only exists through that JS-override control, so the error
// should point there instead of just saying "unknown control".
const ECHART_OPTIONS_HINT_KEYS = new Set([
  'title',
  'legend',
  'grid',
  'tooltip',
  'toolbox',
  'datazoom',
  'visualmap',
  'animation',
  'backgroundcolor',
  'textstyle',
  'graphic',
  'polar',
  'radiusaxis',
  'angleaxis',
  'radar',
  'geo',
  'parallel',
  'parallelaxis',
  'singleaxis',
  'timeline',
  'calendar',
  'dataset',
  'aria',
  'brush',
]);

const matchesEchartOptionsKey = (controlName: string): boolean => {
  const [firstSegment] = controlName.split(/[._]/);
  return (
    ECHART_OPTIONS_HINT_KEYS.has(controlName.toLowerCase()) ||
    ECHART_OPTIONS_HINT_KEYS.has(firstSegment.toLowerCase())
  );
};

const buildUnknownControlMessage = (
  controlName: string,
  controls: ControlStateMapping,
): string => {
  if (controls.echart_options && matchesEchartOptionsKey(controlName)) {
    return (
      `"${controlName}" is not a control on this chart, but it looks like an ECharts ` +
      `option. Try setting it through the "echart_options" control instead, e.g. ` +
      `setControlValues({ echart_options: '{ "${controlName.split(/[._]/)[0]}": { ... } }' }).`
    );
  }
  // getControlValues() only reflects form_data — the currently-applied
  // values, missing controls that are hidden or untouched — so it can't
  // stand in for the full set of controls this viz type supports. `controls`
  // (unlike form_data) has one entry per control the control panel defines,
  // so list those names directly instead of pointing at the wrong API.
  const validNames = Object.keys(controls).sort().join(', ');
  return (
    `"${controlName}" is not a valid control for the chart currently loaded in ` +
    `Explore. Valid controls for this chart type are: ${validNames}.`
  );
};

const validateControlValue = (
  controlName: string,
  value: unknown,
  control: ControlState,
): void => {
  const validators = (control.validators ?? []) as ControlValueValidator[];
  const processedState = { ...control, value } as ControlState;
  const errors = validators
    .map(validator => validator.call(control, value, processedState))
    .filter((error): error is string => typeof error === 'string' && !!error);
  if (errors.length > 0) {
    throw new Error(
      `Invalid value for control "${controlName}": ${errors.join('; ')}`,
    );
  }
};

const setControlValues: typeof exploreApi.setControlValues = async (
  values: Record<string, unknown>,
) => {
  requireFormData();
  const controls = getExploreState().controls ?? ({} as ControlStateMapping);
  // Validate every entry before dispatching any of them, so a bad entry
  // later in the object can't leave earlier ones applied.
  Object.entries(values).forEach(([controlName, value]) => {
    const control = controls[controlName];
    if (!control) {
      throw new Error(buildUnknownControlMessage(controlName, controls));
    }
    validateControlValue(controlName, value, control);
  });
  Object.entries(values).forEach(([controlName, value]) => {
    store.dispatch(
      setControlValue(controlName, value, undefined, { programmatic: true }),
    );
  });
};

// A chart type like Mixed Timeseries can issue more than one query — one
// entry below per query, in the same order Explore itself runs them.
const getQueryResults = (
  results: ChartDataResponseResult[] | undefined,
): ChartDataResponseResult[] => {
  if (!results || results.length === 0) {
    throw new Error('No query result was returned');
  }
  // This API has no way to represent a partial failure (some queries
  // succeeding, others not) in its all-strings/all-rows return shape, so
  // any one query erroring fails the whole call.
  const erroredResult = results.find(result => result.error);
  if (erroredResult) {
    throw new Error(erroredResult.error ?? 'Failed to run the query');
  }
  return results;
};

const getQuery: typeof exploreApi.getQuery = async () => {
  const formData = requireFormData();
  // With GLOBAL_ASYNC_QUERIES enabled, an uncached request comes back as a
  // 202 job envelope rather than the result array, so this must go through
  // the same async-response handling as a normal chart query.
  const results = await requestChartDataResolved({
    formData,
    resultFormat: 'json',
    resultType: 'query',
    ownState: getOwnState(getChartId()),
  });
  return getQueryResults(results as ChartDataResponseResult[] | undefined).map(
    result => result.query,
  );
};

const getChartData: typeof exploreApi.getChartData = async () => {
  const formData = requireFormData();
  // With GLOBAL_ASYNC_QUERIES enabled, an uncached request comes back as a
  // 202 job envelope rather than the result array, so this must go through
  // the same async-response handling as a normal chart query.
  const results = await requestChartDataResolved({
    formData,
    resultFormat: 'json',
    resultType: 'full',
    ownState: getOwnState(getChartId()),
  });
  return getQueryResults(results as ChartDataResponseResult[] | undefined).map(
    result => ({
      columns: result.colnames ?? [],
      rows: (result.data ?? []) as Record<string, unknown>[],
    }),
  );
};

export const explore: typeof exploreApi = {
  getChartId,
  getControlValues,
  getControlValue,
  setControlValues,
  getQuery,
  getChartData,
};
