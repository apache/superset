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
import rison from 'rison';
import {
  AdhocFilter,
  BinaryQueryObjectFilterClause,
  ContextMenuFilters,
  JsonObject,
  NO_TIME_RANGE,
  QueryFormData,
  SupersetClient,
  buildQueryObject,
  ensureIsArray,
  getColumnLabel,
  isSimpleAdhocFilter,
} from '@superset-ui/core';

type DrillByConfig = ContextMenuFilters['drillBy'];

const TIME_RANGE_SEPARATOR = ' : ';

/**
 * Return the innermost temporal bucket filter a Drill by was started from,
 * i.e. the last TEMPORAL_RANGE drill filter. Each further drill narrows the
 * previous one, so the last bucket is the one to query.
 */
export const getDrillByTimeFilter = (
  configs: DrillByConfig[],
): BinaryQueryObjectFilterClause | undefined => {
  let timeFilter: BinaryQueryObjectFilterClause | undefined;
  configs.forEach(config => {
    ensureIsArray(config?.filters).forEach(filter => {
      if (
        filter.op === 'TEMPORAL_RANGE' &&
        typeof filter.val === 'string' &&
        filter.val
      ) {
        timeFilter = filter;
      }
    });
  });
  return timeFilter;
};

/**
 * Return the time range of the innermost temporal bucket a Drill by was
 * started from.
 */
export const getDrillByTimeRange = (
  configs: DrillByConfig[],
): string | undefined =>
  getDrillByTimeFilter(configs)?.val as string | undefined;

/**
 * Return the time range the chart displayed before the drill, using the same
 * precedence as the chart's own query: a dashboard override, a legacy
 * dashboard time filter or the chart's time_range, and otherwise the chart's
 * TEMPORAL_RANGE filter on the drilled column. Returns undefined when the
 * chart is not limited in time.
 */
export const getDrillByOuterTimeRange = (
  formData: QueryFormData,
  column?: BinaryQueryObjectFilterClause['col'],
): string | undefined => {
  let timeRange: unknown;
  try {
    const queryObject = buildQueryObject(formData);
    const columnLabel =
      column === undefined ? undefined : getColumnLabel(column);
    timeRange =
      queryObject.time_range ??
      ensureIsArray(queryObject.filters).find(
        (filter): filter is BinaryQueryObjectFilterClause =>
          filter.op === 'TEMPORAL_RANGE' &&
          (columnLabel === undefined ||
            getColumnLabel(filter.col) === columnLabel),
      )?.val;
  } catch {
    return undefined;
  }
  return typeof timeRange === 'string' &&
    timeRange.trim() &&
    timeRange !== NO_TIME_RANGE
    ? timeRange
    : undefined;
};

const TIMEZONE_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/;

interface TimeBound {
  value: string;
  time: number;
}

const toBound = (value: string | undefined): TimeBound | undefined => {
  if (!value) {
    return undefined;
  }
  const time = new Date(
    TIMEZONE_SUFFIX_RE.test(value) ? value : `${value}Z`,
  ).getTime();
  return Number.isNaN(time) ? undefined : { value, time };
};

/**
 * Intersect a bucket time range ("since : until", naive ISO datetimes) with
 * resolved outer bounds. An empty outer bound is unbounded on that side. A
 * bucket that does not overlap the outer range yields an empty range.
 */
export const intersectTimeRanges = (
  bucket: string,
  outerSince: string | undefined,
  outerUntil: string | undefined,
): string => {
  const [bucketSince, bucketUntil] = bucket.split(TIME_RANGE_SEPARATOR);
  let since = toBound(bucketSince);
  let until = toBound(bucketUntil);
  if (!since || !until) {
    return bucket;
  }
  const outerStart = toBound(outerSince);
  const outerEnd = toBound(outerUntil);
  if (outerStart && outerStart.time > since.time) {
    since = outerStart;
  }
  if (outerEnd && outerEnd.time < until.time) {
    until = outerEnd;
  }
  return since.time < until.time
    ? `${since.value}${TIME_RANGE_SEPARATOR}${until.value}`
    : `${since.value}${TIME_RANGE_SEPARATOR}${since.value}`;
};

/**
 * Resolve the outer time range (which may be relative, e.g. "Last year") and
 * return the part of the bucket that lies inside it, so a bucket that is
 * only partly inside the chart's or dashboard's range does not return rows
 * the chart never displayed. Falls back to the bucket if the range cannot be
 * resolved.
 */
export const fetchDrillByTimeRange = async (
  bucket: string,
  outerTimeRange: string,
): Promise<string> => {
  try {
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/time_range/?q=${rison.encode_uri(outerTimeRange)}`,
    });
    const result = ensureIsArray(json?.result)[0];
    if (!result) {
      return bucket;
    }
    return intersectTimeRanges(bucket, result.since, result.until);
  } catch {
    return bucket;
  }
};

/**
 * Make a drilled query keep the clicked temporal bucket.
 *
 * The backend replaces the value of every TEMPORAL_RANGE filter with the
 * query's time_range, so a bucket sent only as a TEMPORAL_RANGE filter is
 * widened to the chart's (or dashboard's) whole time range. Carrying the
 * bucket as the query's time_range keeps it. A dashboard time range arrives
 * through extra_form_data, which overrides time_range, so it is replaced
 * there as well. If another temporal column is filtered, omit these global
 * overrides instead and retain the resolved range on the clicked filter, so
 * the backend cannot overwrite the independent column or an outer drill.
 *
 * TEMPORAL_RANGE is kept, rather than a >= / < pair, because only the
 * TEMPORAL_RANGE path applies the dataset's timezone or Hours offset to the
 * bounds.
 */
export const applyDrillByTimeRange = <T extends JsonObject>(
  formData: T,
  timeRange: string | undefined,
  timeFilter?: BinaryQueryObjectFilterClause,
): T => {
  if (!timeRange) {
    return formData;
  }
  const extraFormData = formData.extra_form_data as JsonObject | undefined;
  const extraFilters = formData.extra_filters as QueryFormData['extra_filters'];
  const hasQueryTimeRange =
    formData.time_range ||
    extraFormData?.time_range !== undefined ||
    extraFilters?.some(filter => filter.col === '__time_range');
  if (!hasQueryTimeRange && !timeFilter) {
    return formData;
  }
  const adhocFilterFields = Object.keys(formData).filter(key =>
    key.startsWith('adhoc_filters'),
  );
  const hasIndependentTimeFilter =
    timeFilter &&
    [undefined, ...adhocFilterFields].some(field =>
      ensureIsArray(
        buildQueryObject({
          ...formData,
          ...(field && { adhoc_filters: formData[field] }),
        } as unknown as QueryFormData).filters,
      ).some(
        filter =>
          filter.op === 'TEMPORAL_RANGE' &&
          getColumnLabel(filter.col) !== getColumnLabel(timeFilter.col),
      ),
    );
  if (!hasQueryTimeRange || hasIndependentTimeFilter) {
    // A query-wide range would overwrite independent temporal filters on the
    // backend. Keep their values and put the resolved overlap on the bucket
    // itself, including on mixed charts' second query.
    const updatedFormData: JsonObject = { ...formData };
    delete updatedFormData.time_range;
    if (extraFormData) {
      const { time_range: _, ...remainingExtras } = extraFormData;
      updatedFormData.extra_form_data = remainingExtras;
    }
    if (extraFilters) {
      updatedFormData.extra_filters = extraFilters.filter(
        filter => filter.col !== '__time_range',
      );
    }
    if (timeFilter) {
      adhocFilterFields.forEach(key => {
        updatedFormData[key] = ensureIsArray(
          formData[key] as AdhocFilter[],
        ).map(filter =>
          isSimpleAdhocFilter(filter) &&
          filter.operator === 'TEMPORAL_RANGE' &&
          getColumnLabel(filter.subject) === getColumnLabel(timeFilter.col) &&
          filter.comparator === timeFilter.val
            ? { ...filter, comparator: timeRange }
            : filter,
        );
      });
    }
    return updatedFormData as T;
  }

  return {
    ...formData,
    time_range: timeRange,
    ...(extraFilters && {
      extra_filters: extraFilters.map(filter =>
        filter.col === '__time_range' ? { ...filter, val: timeRange } : filter,
      ),
    }),
    ...(extraFormData?.time_range !== undefined && {
      extra_form_data: { ...extraFormData, time_range: timeRange },
    }),
  };
};
