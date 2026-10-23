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
  BinaryAdhocFilter,
  BinaryQueryObjectFilterClause,
  ContextMenuFilters,
  JsonObject,
  NO_TIME_RANGE,
  QueryFormColumn,
  QueryFormData,
  QueryObject,
  QueryObjectFilterClause,
  SupersetClient,
  buildQueryObject,
  ensureIsArray,
  getColumnLabel,
  isBinaryAdhocFilter,
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

const isStringTemporalFilter = (
  filter: QueryObjectFilterClause,
): filter is BinaryQueryObjectFilterClause =>
  filter.op === 'TEMPORAL_RANGE' && typeof filter.val === 'string';

interface TimeColumnScope {
  /** The column the time column filter limits: the x-axis, or itself. */
  column: string;
  /** The column whose TEMPORAL_RANGE filters the backend drops. */
  removedColumn?: string;
  /** The range the time column is filtered by. */
  timeRange?: string;
}

/**
 * Mirror `_apply_granularity` in `query_context_factory.py` for a query with
 * a time column (granularity). The backend drops every filter on the temporal
 * x-axis (without an x-axis: on the time column, or else on the first
 * temporal filter) and filters the time column by the query's time range,
 * or else by its first x-axis TEMPORAL_RANGE filter, or else by its first
 * TEMPORAL_RANGE filter. The time column replaces the x-axis column.
 */
const getTimeColumnScope = (
  formData: JsonObject,
  queryObject: QueryObject,
): TimeColumnScope | undefined => {
  const { granularity } = queryObject;
  if (!granularity) {
    return undefined;
  }
  const temporalFilters = ensureIsArray(queryObject.filters).filter(
    isStringTemporalFilter,
  );
  const xAxis =
    formData.x_axis === undefined || formData.x_axis === null
      ? undefined
      : getColumnLabel(formData.x_axis as QueryFormColumn);
  const firstLabel =
    temporalFilters[0] && getColumnLabel(temporalFilters[0].col);
  return {
    column: xAxis ?? granularity,
    removedColumn:
      xAxis ??
      (temporalFilters.some(
        filter => getColumnLabel(filter.col) === granularity,
      )
        ? granularity
        : firstLabel),
    timeRange:
      queryObject.time_range ??
      ((
        (xAxis !== undefined &&
          temporalFilters.find(
            filter => getColumnLabel(filter.col) === xAxis,
          )) ||
        temporalFilters[0]
      )?.val as string | undefined),
  };
};

/**
 * Return the time range the chart applies to a temporal column, following the
 * backend's rules for the chart's own query:
 * - with a time column, see `getTimeColumnScope`;
 * - otherwise a column is limited only by its TEMPORAL_RANGE filter, whose
 *   value the query-wide time range (saved, dashboard or legacy) replaces.
 *   A query-wide range does not limit a column without such a filter.
 * Returns undefined when the chart does not limit the column in time.
 */
export const getDrillByOuterTimeRange = (
  formData: QueryFormData,
  column?: BinaryQueryObjectFilterClause['col'],
  adhocFilterFieldName = 'adhoc_filters',
): string | undefined => {
  let timeRange: unknown;
  try {
    const queryObject = buildQueryObject({
      ...formData,
      adhoc_filters: formData[adhocFilterFieldName],
    });
    const columnLabel =
      column === undefined ? undefined : getColumnLabel(column);
    const scope = getTimeColumnScope(formData, queryObject);
    if (scope && columnLabel === scope.column) {
      timeRange = scope.timeRange;
    } else if (!scope || columnLabel !== scope.removedColumn) {
      const columnFilter = ensureIsArray(queryObject.filters)
        .filter(isStringTemporalFilter)
        .find(
          filter =>
            columnLabel === undefined ||
            getColumnLabel(filter.col) === columnLabel,
        );
      timeRange = columnFilter && (queryObject.time_range ?? columnFilter.val);
    }
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
 * overrides instead. Materialize the chart's effective query-wide range on
 * its saved temporal filters before removing it; otherwise their saved
 * comparators would silently become active again. Drill bucket filters keep
 * their separately resolved overlaps, including those of outer drills. With
 * a time column, the backend replaces the x-axis filters by a time column
 * filter built from the first of them, so each one carries the bucket.
 *
 * TEMPORAL_RANGE is kept, rather than a >= / < pair, because only the
 * TEMPORAL_RANGE path applies the dataset's timezone or Hours offset to the
 * bounds.
 */
export const applyDrillByTimeRange = <T extends JsonObject>(
  formData: T,
  timeRange: string | undefined,
  timeFilter?: BinaryQueryObjectFilterClause,
  sourceFormData: JsonObject = formData,
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
    // Match _apply_filters for the original chart only. Appended drill
    // filters are additional constraints, not targets of its global override.
    const sourceQuery = buildQueryObject(sourceFormData as QueryFormData);
    const effectiveTimeRange = sourceQuery.time_range;
    const materializeSimpleFilter = <F extends { op: string }>(filter: F): F =>
      effectiveTimeRange && filter.op === 'TEMPORAL_RANGE'
        ? { ...filter, val: effectiveTimeRange }
        : filter;
    const materializeAdhocFilter = (filter: AdhocFilter): AdhocFilter =>
      effectiveTimeRange &&
      isSimpleAdhocFilter(filter) &&
      filter.operator === 'TEMPORAL_RANGE'
        ? { ...filter, comparator: effectiveTimeRange }
        : filter;
    const updatedFormData: JsonObject = { ...formData };
    delete updatedFormData.time_range;
    if (extraFormData) {
      const { time_range: _, ...remainingExtras } = extraFormData;
      updatedFormData.extra_form_data = {
        ...remainingExtras,
        ...(extraFormData.filters && {
          filters: extraFormData.filters.map(materializeSimpleFilter),
        }),
        ...(extraFormData.adhoc_filters && {
          adhoc_filters: extraFormData.adhoc_filters.map(
            materializeAdhocFilter,
          ),
        }),
      };
    }
    if (extraFilters) {
      updatedFormData.extra_filters = extraFilters
        .filter(filter => filter.col !== '__time_range')
        .map(materializeSimpleFilter);
    }
    adhocFilterFields.forEach(key => {
      const savedCount = ensureIsArray(
        sourceFormData[key] as AdhocFilter[],
      ).length;
      const filters = ensureIsArray(formData[key] as AdhocFilter[]);
      // With a time column, the backend drops the x-axis filters, outer
      // buckets included, and filters the time column by the first x-axis
      // filter (without an x-axis: the first temporal filter). Each of them
      // therefore carries every bucket on that column, and filters the
      // chart dropped stay dropped.
      const scope = getTimeColumnScope(
        sourceFormData,
        buildQueryObject({
          ...sourceFormData,
          adhoc_filters: sourceFormData[key],
        } as unknown as QueryFormData),
      );
      const isScopeFilter = (
        filter: AdhocFilter,
        column?: string,
      ): filter is BinaryAdhocFilter =>
        column !== undefined &&
        isSimpleAdhocFilter(filter) &&
        filter.operator === 'TEMPORAL_RANGE' &&
        isBinaryAdhocFilter(filter) &&
        getColumnLabel(filter.subject) === column;
      const axisRange = filters
        .slice(savedCount)
        .filter(filter => isScopeFilter(filter, scope?.column))
        .map(filter => (filter as BinaryAdhocFilter).comparator)
        .reduce<string | undefined>((range, bucket) => {
          const [since, until] = bucket.split(TIME_RANGE_SEPARATOR);
          return range === undefined
            ? bucket
            : intersectTimeRanges(range, since, until);
        }, undefined);
      const updatedFilters = filters.map((filter, index): AdhocFilter => {
        if (axisRange !== undefined && isScopeFilter(filter, scope?.column)) {
          return { ...filter, comparator: axisRange };
        }
        if (index < savedCount) {
          return axisRange !== undefined &&
            scope?.removedColumn !== scope?.column &&
            isScopeFilter(filter, scope?.removedColumn)
            ? { ...filter, comparator: NO_TIME_RANGE }
            : materializeAdhocFilter(filter);
        }
        return timeFilter &&
          isSimpleAdhocFilter(filter) &&
          filter.operator === 'TEMPORAL_RANGE' &&
          getColumnLabel(filter.subject) === getColumnLabel(timeFilter.col) &&
          filter.comparator === timeFilter.val
          ? { ...filter, comparator: timeRange }
          : filter;
      });
      updatedFormData[key] =
        axisRange !== undefined && sourceFormData.x_axis == null
          ? [
              ...updatedFilters.filter(filter =>
                isScopeFilter(filter, scope?.column),
              ),
              ...updatedFilters.filter(
                filter => !isScopeFilter(filter, scope?.column),
              ),
            ]
          : updatedFilters;
    });
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
