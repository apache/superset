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
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LegendState } from '@superset-ui/core';
import { EventHandlers } from '../types';

/**
 * Maximum delay in milliseconds between two clicks on the same legend item for
 * them to count as a double click.
 */
export const LEGEND_DOUBLE_CLICK_INTERVAL = 300;

interface LegendSelectChangedPayload {
  name: string;
  selected: LegendState;
}

interface LegendSelectPayload {
  selected: LegendState;
}

interface LegendScrollPayload {
  scrollDataIndex: number;
}

interface PendingClick {
  name: string;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Builds the legend state that leaves `name` as the only visible series. When
 * `name` is already the only visible series every series is restored instead,
 * so double clicking an isolated series undoes the isolation.
 */
export function isolateLegendSeries(
  selected: LegendState,
  name: string,
): LegendState {
  const names = Object.keys(selected);
  const isIsolated = names.every(key => selected[key] === (key === name));
  return Object.fromEntries(
    names.map((key): [string, boolean] => [key, isIsolated || key === name]),
  );
}

/**
 * ECharts legend handlers that keep the chart legend state in sync and add
 * double click support: double clicking a legend item hides every other
 * series, double clicking it again brings them all back.
 *
 * ECharts has no legend double click event, so a single click is held for
 * `LEGEND_DOUBLE_CLICK_INTERVAL` before it is reported. Holding it matters for
 * more than telling the two gestures apart. Reporting the first click straight
 * away re-renders the chart in the middle of a double click, and a re-render
 * rebuilds the legend from scratch, which knocks a paginated legend off the
 * page the user is on and moves the item out from under the pointer before the
 * second click can land. Deferring means either gesture costs exactly one
 * re-render, and it happens once the gesture is over.
 *
 * Nothing feels slower for it: ECharts applies its own selection change as
 * soon as the item is clicked, so series hide instantly. The deferred callback
 * only syncs that selection back into React.
 */
export function useLegendEventHandlers(
  onLegendStateChanged?: (state: LegendState) => void,
  onLegendScroll?: (scrollDataIndex: number) => void,
): EventHandlers {
  const pending = useRef<PendingClick | null>(null);

  const clearPending = useCallback(() => {
    if (pending.current) {
      clearTimeout(pending.current.timer);
      pending.current = null;
    }
  }, []);

  useEffect(() => clearPending, [clearPending]);

  return useMemo(() => {
    const report = ({ selected }: LegendSelectPayload) => {
      clearPending();
      onLegendStateChanged?.(selected);
    };

    return {
      legendselectchanged: ({ name, selected }: LegendSelectChangedPayload) => {
        if (pending.current?.name === name) {
          // Second click on the same item. The two clicks cancel each other
          // out in ECharts' own legend state, so `selected` still describes
          // the selection as it was before the double click started.
          clearPending();
          onLegendStateChanged?.(isolateLegendSeries(selected, name));
          return;
        }
        // A click on a different item supersedes the one still waiting.
        // ECharts reports the whole selection every time, so the newer payload
        // already accounts for the click being dropped.
        clearPending();
        pending.current = {
          name,
          timer: setTimeout(() => {
            pending.current = null;
            onLegendStateChanged?.(selected);
          }, LEGEND_DOUBLE_CLICK_INTERVAL),
        };
      },
      legendselectall: report,
      legendinverseselect: report,
      legendscroll: ({ scrollDataIndex }: LegendScrollPayload) => {
        onLegendScroll?.(scrollDataIndex);
      },
    };
  }, [clearPending, onLegendScroll, onLegendStateChanged]);
}
