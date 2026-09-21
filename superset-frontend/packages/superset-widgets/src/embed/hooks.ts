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
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { dashboard as dashboardApi } from '@apache-superset/core';
import { HOST_SOURCE_PREFIX } from '@apache-superset/core/widgets';
import { useWidgetBus } from '../bus';
import type { FilterValueChangedPayload } from '../filterVocabulary';
import type { HostFilter, WidgetEvent } from '../types';

const CLEARED: FilterValueChangedPayload = { selection: null, resolved: null };

/** The bus payload for a host-owned filter; `null` clears it. */
export function hostFilterPayload(
  filter: HostFilter | null,
): FilterValueChangedPayload {
  return filter
    ? {
        selection: filter.value,
        resolved: {
          column: filter.column,
          operator: filter.operator,
          value: filter.value,
          datasource: filter.datasetId,
        },
        targets: filter.targets,
      }
    : CLEARED;
}

/**
 * A stable setter for a host-owned filter under `key`. Widgets on
 * `filter.datasetId` (or only `filter.targets`) AND it onto their queries.
 * The filter is cleared when the calling component unmounts.
 */
export function useSupersetFilter(
  key: string,
): (filter: HostFilter | null) => void {
  const bus = useWidgetBus();
  const sourceId = `${HOST_SOURCE_PREFIX}${key}`;
  const active = useRef(false);

  useEffect(
    () => () => {
      if (active.current) {
        bus.emit(sourceId, dashboardApi.VALUE_CHANGED_EVENT, CLEARED);
        active.current = false;
      }
    },
    [bus, sourceId],
  );

  return useCallback(
    (filter: HostFilter | null) => {
      active.current = filter !== null;
      bus.emit(
        sourceId,
        dashboardApi.VALUE_CHANGED_EVENT,
        hostFilterPayload(filter),
      );
    },
    [bus, sourceId],
  );
}

/** Subscribes to every `eventType` emitted by widgets (or the host) under the provider. */
export function useWidgetEvent(
  eventType: string,
  listener: (event: WidgetEvent) => void,
): void {
  const bus = useWidgetBus();
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const subscription = bus.on(eventType, event => listenerRef.current(event));
    return () => subscription.dispose();
  }, [bus, eventType]);
}

/** The last payload `instanceId` emitted for `eventType` (the current selection, by default). */
export function useWidgetValue(
  instanceId: string,
  eventType: string = dashboardApi.VALUE_CHANGED_EVENT,
): unknown {
  const bus = useWidgetBus();
  return useSyncExternalStore(bus.subscribe, () =>
    bus.getValue(instanceId, eventType),
  );
}
