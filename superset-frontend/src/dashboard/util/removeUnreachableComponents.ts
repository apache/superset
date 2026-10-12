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
import { DashboardComponent } from '../types';
import {
  CHART_TYPE,
  DASHBOARD_GRID_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,
} from './componentTypes';
import {
  DASHBOARD_GRID_ID,
  DASHBOARD_HEADER_ID,
  DASHBOARD_ROOT_ID,
  DASHBOARD_VERSION_KEY,
  GRID_COLUMN_COUNT,
  GRID_DEFAULT_CHART_WIDTH,
} from './constants';
import newComponentFactory, { DashboardEntity } from './newComponentFactory';

// HEADER_ID is dashboard metadata rather than a rendered child, GRID_ID is
// retained (emptied) and detached when a dashboard uses top-level tabs, and
// DASHBOARD_VERSION_KEY is a version string rather than a component.
const RESERVED_IDS = new Set<string>([
  DASHBOARD_GRID_ID,
  DASHBOARD_HEADER_ID,
  DASHBOARD_ROOT_ID,
  DASHBOARD_VERSION_KEY,
]);

// containers that accept both new rows and headers
const REATTACH_CONTAINER_TYPES = new Set<string>([
  DASHBOARD_GRID_TYPE,
  TAB_TYPE,
]);

const childrenOf = (component: unknown): string[] => {
  const children = (component as DashboardComponent | undefined)?.children;
  return Array.isArray(children)
    ? children.filter((id): id is string => typeof id === 'string')
    : [];
};

const isComponent = (value: unknown): value is DashboardComponent =>
  typeof value === 'object' && value !== null;

/**
 * Drop components that cannot be reached from ROOT_ID, reattaching detached
 * charts, markdown and headers instead of dropping them.
 *
 * Detached components never render, but they survive in position_json and stay
 * visible to code that walks every layout entry or trusts the stale `parents`
 * of a node. A detached subtree containing a cycle is what crashes the filter
 * scope modal with "Maximum call stack size exceeded".
 *
 * A detached chart keeps its layout id and is moved into new rows in the deepest
 * container of its stored `parents` that is still reachable, falling back to
 * the first top-level container. Only the tail of a stale chain is gone, so its
 * reachable prefix still says e.g. which tab the chart came from. Dropping it would lose the chart's cross-filter
 * configuration, and a chart missing from the charts payload (e.g. archived
 * with SOFT_DELETE) could not be re-added, so the next save would drop its
 * dashboard membership. A chart that is also placed reachably is not duplicated.
 *
 * Detached markdown and headers are reattached the same way, since their text
 * lives nowhere but position_json. Markdown goes into the new rows; a header,
 * which cannot be a row child, goes directly into the container.
 * Mirrors `superset/dashboards/layout.py`.
 */
export default function removeUnreachableComponents<
  T extends DashboardComponent,
>(layout: Record<string, T>): Record<string, T | DashboardEntity> {
  const root = layout[DASHBOARD_ROOT_ID];
  if (!isComponent(root) || !Array.isArray(root.children)) {
    return layout;
  }

  // path from ROOT_ID to each reachable id
  const paths = new Map<string, string[]>();
  const stack: [string, string[]][] = [[DASHBOARD_ROOT_ID, []]];

  while (stack.length) {
    const [id, parentPath] = stack.pop() as [string, string[]];
    // doubles as the cycle guard: an id already seen is never expanded twice
    if (!paths.has(id)) {
      const path = [...parentPath, id];
      paths.set(id, path);
      childrenOf(layout[id]).forEach(childId => {
        if (isComponent(layout[childId])) {
          stack.push([childId, path]);
        }
      });
    }
  }
  const reachable = new Set(paths.keys());

  const unreachable = Object.keys(layout).filter(
    id =>
      isComponent(layout[id]) && !reachable.has(id) && !RESERVED_IDS.has(id),
  );

  if (!unreachable.length) {
    return layout;
  }

  const placedChartIds = new Set<number | undefined>(
    [...reachable]
      .filter(id => layout[id].type === CHART_TYPE)
      .map(id => layout[id].meta?.chartId),
  );
  const rescued: [string, T][] = [];
  unreachable.forEach(id => {
    const component = layout[id];
    if (component.type === MARKDOWN_TYPE || component.type === HEADER_TYPE) {
      rescued.push([id, component]);
      return;
    }
    const chartId = component.meta?.chartId;
    if (
      component.type === CHART_TYPE &&
      chartId !== undefined &&
      !placedChartIds.has(chartId)
    ) {
      placedChartIds.add(chartId);
      rescued.push([id, component]);
    }
  });

  const next: Record<string, T | DashboardEntity> = { ...layout };
  unreachable.forEach(id => {
    delete next[id];
  });
  // a detached reserved id is kept, but must not reference the dropped nodes
  RESERVED_IDS.forEach(id => {
    const component = next[id];
    if (
      !reachable.has(id) &&
      isComponent(component) &&
      component.children?.length
    ) {
      next[id] = { ...component, children: [] };
    }
  });

  // mirrors findFirstParentContainerId; the path is built here rather than
  // read from `parents`, which may be stale or missing
  const [firstId] = childrenOf(layout[DASHBOARD_ROOT_ID]);
  const fallbackPath =
    layout[firstId]?.type === TABS_TYPE
      ? [DASHBOARD_ROOT_ID, firstId, childrenOf(layout[firstId])[0]]
      : [DASHBOARD_ROOT_ID, firstId];

  const homePath = (component: T): string[] => {
    const parents = Array.isArray(component.parents) ? component.parents : [];
    for (let i = parents.length - 1; i >= 0; i -= 1) {
      const path = paths.get(parents[i]);
      if (path && REATTACH_CONTAINER_TYPES.has(layout[parents[i]].type)) {
        return path;
      }
    }
    return fallbackPath;
  };

  const groups = new Map<string, [string[], [string, T][]]>();
  rescued.forEach(([componentKey, component]) => {
    const path = homePath(component);
    const key = path.join('/');
    const group = groups.get(key) ?? [path, []];
    group[1].push([componentKey, component]);
    groups.set(key, group);
  });

  groups.forEach(([rowParents, components]) => {
    const containerId = rowParents[rowParents.length - 1];
    const container = containerId ? next[containerId] : undefined;
    if (!isComponent(container)) {
      return;
    }
    const containerChildren = childrenOf(container);
    let row: DashboardEntity | undefined;
    let rowWidth = 0;
    components.forEach(([componentKey, component]) => {
      if (component.type === HEADER_TYPE) {
        containerChildren.push(componentKey);
        next[componentKey] = { ...component, parents: rowParents.slice() };
        row = undefined;
        return;
      }
      const { width: rawWidth } = component.meta ?? {};
      const width =
        typeof rawWidth === 'number' && rawWidth > 0
          ? rawWidth
          : GRID_DEFAULT_CHART_WIDTH;
      if (!row || rowWidth + width > GRID_COLUMN_COUNT) {
        row = newComponentFactory(ROW_TYPE, undefined, rowParents.slice());
        next[row.id] = row;
        containerChildren.push(row.id);
        rowWidth = 0;
      }
      row.children.push(componentKey);
      next[componentKey] = { ...component, parents: [...rowParents, row.id] };
      rowWidth += width;
    });
    next[containerId] = { ...container, children: containerChildren };
  });

  return next;
}
