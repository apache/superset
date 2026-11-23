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

/*
 * The charts a dashboard report renders, by the rule the server checks a
 * report save with: `report_state_charts`, `report_dashboard_charts`,
 * `_layout_walk` and `_shown` in superset/time_range_limits/enforcement.py and
 * `_first_container_path` in superset/dashboards/layout.py. Both sides run the
 * cases in spec/fixtures/reportRenderedCharts.json.
 */

type Position = Record<string, unknown>;
type LayoutItem = Record<string, unknown>;

const ROOT_ID = 'ROOT_ID';
const JSON_INTEGER = /^-?(0|[1-9]\d*)$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const layoutItem = (position: Position, id: unknown) => {
  if (typeof id !== 'string' || !Object.hasOwn(position, id)) {
    return undefined;
  }
  const item = position[id];
  return isObject(item) ? (item as LayoutItem) : undefined;
};

// enforcement.py `_children`: every entry, whatever its type.
const rawChildren = (position: Position, id: string): unknown[] => {
  const children = layoutItem(position, id)?.children;
  return Array.isArray(children) ? children : [];
};

// layout.py `_children`: the string entries only.
const stringChildren = (item: unknown): string[] => {
  const children = isObject(item) ? item.children : undefined;
  return Array.isArray(children)
    ? children.filter((child): child is string => typeof child === 'string')
    : [];
};

/**
 * `position_json` parsed as Python's `json.loads` reads chart ids: a
 * `chartId` written as a fraction or exponent is a float there, never a chart.
 * Browsers without JSON.parse source access take it as the number it is.
 */
function parsePosition(text: string): unknown {
  const reviver = (
    key: string,
    value: unknown,
    context?: { source?: string },
  ) =>
    key === 'chartId' &&
    typeof value === 'number' &&
    context?.source !== undefined &&
    !JSON_INTEGER.test(context.source)
      ? null
      : value;
  return JSON.parse(text, reviver as (key: string, value: unknown) => unknown);
}

/** Python's `isinstance(value, int)`: a bool counts as 0 or 1. */
const pythonInt = (value: unknown) => {
  const number = typeof value === 'boolean' ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number)
    ? number
    : undefined;
};

function layoutWalk(position: Position) {
  const parents = new Map<string, string[]>([[ROOT_ID, []]]);
  const charts = new Map<number, string[]>();
  const stack = layoutItem(position, ROOT_ID) ? [ROOT_ID] : [];
  while (stack.length) {
    const id = stack.pop() as string;
    const item = layoutItem(position, id) as LayoutItem;
    if (item.type === 'CHART' && isObject(item.meta)) {
      const chartId = pythonInt(item.meta.chartId);
      if (chartId !== undefined && !charts.has(chartId)) {
        charts.set(chartId, parents.get(id) as string[]);
      }
    }
    for (const child of rawChildren(position, id)) {
      if (typeof child !== 'string' || !layoutItem(position, child)) {
        continue;
      }
      if (parents.has(child)) {
        return null;
      }
      parents.set(child, [...(parents.get(id) as string[]), id]);
      stack.push(child);
    }
  }
  return { parents, charts };
}

function firstContainerPath(position: Position) {
  const root = Object.hasOwn(position, ROOT_ID) ? position[ROOT_ID] : undefined;
  const [top] = stringChildren(root);
  const topItem = layoutItem(position, top);
  if (!topItem) {
    return null;
  }
  if (topItem.type === 'TABS') {
    const [tab] = stringChildren(topItem);
    return layoutItem(position, tab) ? [ROOT_ID, top, tab] : null;
  }
  return [ROOT_ID, top];
}

function shown(
  position: Position,
  parents: string[],
  anchorPath: string[],
  activeTabs: string[] | null,
) {
  // A report page doesn't mount the root-level Tabs: its tab comes from the anchor.
  const rootTabs = layoutItem(position, ROOT_ID)
    ? rawChildren(position, ROOT_ID).slice(0, 1)
    : [];
  return parents.every((id, index) => {
    if (layoutItem(position, id)?.type !== 'TABS') {
      return true;
    }
    const tabs = rawChildren(position, id);
    let active: unknown = tabs.length ? tabs[0] : null;
    const at = anchorPath.indexOf(id);
    if (
      at >= 0 &&
      at + 1 < anchorPath.length &&
      tabs.includes(anchorPath[at + 1])
    ) {
      active = anchorPath[at + 1];
    }
    if (
      activeTabs?.length &&
      tabs.length &&
      active === tabs[0] &&
      !rootTabs.includes(id)
    ) {
      active =
        tabs
          .slice(1)
          .find(tab => typeof tab === 'string' && activeTabs.includes(tab)) ??
        active;
    }
    return index + 1 >= parents.length || parents[index + 1] === active;
  });
}

function reportPages(dashboardState: unknown, tabsEnabled: boolean) {
  let anchors: string[] | null = null;
  let activeTabs: string[] | null = null;
  if (tabsEnabled && isObject(dashboardState)) {
    const tabs = dashboardState.activeTabs;
    if (Array.isArray(tabs) && tabs.every(tab => typeof tab === 'string')) {
      activeTabs = tabs;
    }
    const { anchor } = dashboardState;
    let anchorList: unknown = null;
    if (typeof anchor === 'string' && anchor) {
      try {
        anchorList = JSON.parse(anchor);
      } catch {
        anchorList = null;
      }
    }
    const tab = Object.hasOwn(dashboardState, 'anchor')
      ? anchor
      : dashboardState.hash;
    if (Array.isArray(anchorList)) {
      anchors = anchorList.map(item => (typeof item === 'string' ? item : ''));
      activeTabs = null;
    } else if (typeof tab === 'string' && tab) {
      anchors = [tab];
    }
  }
  return { anchors, activeTabs };
}

function readLayout(positionJson: string | null) {
  let position: unknown;
  try {
    position = parsePosition(positionJson || '{}');
  } catch {
    return null;
  }
  if (!isObject(position)) {
    return null;
  }
  const walk = layoutWalk(position);
  return walk ? { position, walk } : null;
}

/** The chart ids the layout places, `[]` when it can't be read. */
export function layoutChartIds(positionJson: string | null): number[] {
  return [...(readLayout(positionJson)?.walk.charts.keys() ?? [])];
}

/**
 * The ids among `chartIds` (the dashboard's charts) that a report with
 * `dashboardState` (its `extra.dashboard`) renders on a dashboard laid out by
 * `positionJson`: those on the active tab of each tab group, for each of its
 * anchors. Every chart when the layout can't be read.
 */
export default function reportRenderedChartIds(
  positionJson: string | null,
  chartIds: number[],
  dashboardState: unknown,
  tabsEnabled: boolean,
): number[] {
  const layout = readLayout(positionJson);
  if (!layout) {
    return [...chartIds];
  }
  const { position, walk } = layout;
  const { anchors, activeTabs } = reportPages(dashboardState, tabsEnabled);
  const missing = firstContainerPath(position) ?? [ROOT_ID, 'GRID_ID'];
  const anchorPaths = anchors?.length
    ? anchors.map(anchor =>
        walk.parents.has(anchor)
          ? [...(walk.parents.get(anchor) as string[]), anchor]
          : [],
      )
    : [[]];
  return chartIds.filter(chartId =>
    anchorPaths.some(path =>
      shown(position, walk.charts.get(chartId) ?? missing, path, activeTabs),
    ),
  );
}
