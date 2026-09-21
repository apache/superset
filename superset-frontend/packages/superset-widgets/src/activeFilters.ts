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
import { dashboard as dashboardApi } from '@apache-superset/core';
import type {
  FilterValueChangedPayload,
  ResolvedFilter,
} from './filterVocabulary';
import type { WidgetBus } from './types';

/** One resolved filter as the `{expressionType, subject, operator, comparator, clause}` adhoc filters a query takes. */
export function toAdhocFilters(
  resolved: ResolvedFilter | null | undefined,
): Record<string, unknown>[] {
  if (!resolved) return [];
  const base = {
    expressionType: 'SIMPLE',
    subject: resolved.column,
    clause: 'WHERE',
  };
  switch (resolved.operator) {
    case 'EQUALS':
      return [{ ...base, operator: '==', comparator: resolved.value }];
    case 'NOT_EQUALS':
      return [{ ...base, operator: '!=', comparator: resolved.value }];
    case 'IN':
      return [{ ...base, operator: 'IN', comparator: resolved.value }];
    case 'NOT_IN':
      return [{ ...base, operator: 'NOT IN', comparator: resolved.value }];
    case 'RANGE': {
      const { min, max } = (resolved.value ?? {}) as {
        min?: unknown;
        max?: unknown;
      };
      const out: Record<string, unknown>[] = [];
      if (min != null) out.push({ ...base, operator: '>=', comparator: min });
      if (max != null) out.push({ ...base, operator: '<=', comparator: max });
      return out;
    }
    case 'TIME_RANGE': {
      const { start, end } = (resolved.value ?? {}) as {
        start?: unknown;
        end?: unknown;
      };
      const out: Record<string, unknown>[] = [];
      if (start != null)
        out.push({ ...base, operator: '>=', comparator: start });
      if (end != null) out.push({ ...base, operator: '<', comparator: end });
      return out;
    }
    default:
      return [];
  }
}

/**
 * The resolved filters every other source on `bus` currently applies to
 * `consumerId`. A source is anything that published a resolved
 * `valueChanged` — a filter, a cross-filtering chart, or the host. It
 * applies by dataset match unless it names explicit `targets`.
 */
export function getActiveResolvedFilters(
  bus: WidgetBus,
  datasetId: number,
  consumerId: string,
): ResolvedFilter[] {
  return bus
    .getSourceIds(dashboardApi.VALUE_CHANGED_EVENT)
    .filter(sourceId => sourceId !== consumerId)
    .flatMap(sourceId => {
      const value = bus.getValue(sourceId, dashboardApi.VALUE_CHANGED_EVENT) as
        FilterValueChangedPayload | undefined;
      if (!value?.resolved) return [];
      // Schema-driven forms seed `[""]` for an untouched targets list; blank
      // entries must read the same as no targets at all.
      const targets = (bus.getScopeTargets(sourceId) ?? value.targets)?.filter(
        target => target !== '',
      );
      const applies =
        targets && targets.length > 0
          ? targets.includes(consumerId)
          : value.resolved.datasource === datasetId;
      return applies ? [value.resolved] : [];
    });
}

export function getActiveAdhocFilters(
  bus: WidgetBus,
  datasetId: number,
  consumerId: string,
): Record<string, unknown>[] {
  return getActiveResolvedFilters(bus, datasetId, consumerId).flatMap(
    resolved => toAdhocFilters(resolved),
  );
}
