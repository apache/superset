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

import type { dashboard as dashboardApi } from '@apache-superset/core';
import { createEventEmitter } from '../utils';
import { DEFAULT_COLUMNS } from './layoutStyle';
import { resolveExplicitCollisions } from './gridPacking';

type DashboardNode = dashboardApi.DashboardNode;
type BuildingBlockSpec = dashboardApi.BuildingBlockSpec;
type LayoutProps = dashboardApi.LayoutProps;

/** Node data as stored internally — same as the public `DashboardNode`, minus `id` (the map key already is the id). */
type StoredNode = Omit<DashboardNode, 'id'>;

const ROOT_ID = 'root';

/**
 * The one node type that holds other nodes.
 *
 * Named here because two things need to agree on it and neither should learn
 * it by string comparison of its own: this provider, deciding whether a new
 * node gets a `children` array at all, and the palette, deciding whether a
 * block an author places is a container or something to put in one.
 */
export const CONTAINER_TYPE = 'canvas';

/** Whether placing this type produces something other nodes can go inside. */
export const isContainerType = (type: string): boolean =>
  type === CONTAINER_TYPE;

function createBlankNodes(): Record<string, StoredNode> {
  return {
    [ROOT_ID]: {
      type: 'canvas',
      // No total height is set here, and none is needed — the root grid's
      // rows are created on demand (see resolveContainerGridStyle), so the
      // canvas is always exactly as tall as its content.
      layout: { columns: DEFAULT_COLUMNS, gap: 16 },
      children: [],
    },
  };
}

let nextNodeId = 0;
function generateNodeId(): string {
  nextNodeId += 1;
  return `node_${nextNodeId}`;
}

/**
 * Singleton in-memory store for the active Dashboard v2 prototype's node
 * tree. No persistence — deliberately granular (mirroring `sqlLab`'s own
 * accessor style) rather than exposing a single "get everything" snapshot:
 * callers walk the tree from {@link getRoot} via {@link getNode}.
 *
 * `getRevision()` is host-internal only (not part of the public API) — a
 * cheap invalidation counter the prototype's own canvas renderer subscribes
 * to via `useSyncExternalStore`, re-reading whatever nodes it needs through
 * the same granular accessors extensions use.
 */
class DashboardProvider {
  private static instance: DashboardProvider;

  private nodes: Record<string, StoredNode> = createBlankNodes();

  private revision = 0;

  /**
   * Which node the author is working on.
   *
   * Host-internal, exactly like {@link getRevision} and for the same reason:
   * it is a property of one person looking at one screen, not of the
   * dashboard. Two people opening the same tree select different things, and
   * nothing about a selection belongs in a document or in the public API an
   * extension calls.
   *
   * It lives here rather than in page state because the canvas draws it and
   * the editor panel reads it, and those sit in different layers — putting it
   * in the one place both already subscribe to beats threading it through the
   * render tree that `BuildingBlockView` deliberately keeps ignorant.
   */
  private selection: string | undefined;

  private layoutChangeEmitter = createEventEmitter<void>();

  private stateSubscribers = new Set<() => void>();

  public static getInstance(): DashboardProvider {
    if (!DashboardProvider.instance) {
      DashboardProvider.instance = new DashboardProvider();
    }
    return DashboardProvider.instance;
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.stateSubscribers.add(listener);
    return () => this.stateSubscribers.delete(listener);
  };

  public getRevision = (): number => this.revision;

  public getSelection = (): string | undefined => this.selection;

  /**
   * Selects a node, or clears the selection with `undefined`.
   *
   * Ticks the same revision every mutation does, so everything already
   * subscribed re-reads without needing a second subscription of its own.
   */
  public setSelection = (id: string | undefined): void => {
    if (this.selection === id) {
      return;
    }
    this.selection = id;
    this.revision += 1;
    this.stateSubscribers.forEach(fn => fn());
  };

  private commit(nodes: Record<string, StoredNode>): void {
    // A selection is a reference to a node, and a node that is gone cannot be
    // the thing being edited. Clearing it here — rather than at each removal
    // site — covers a subtree deletion too, where the node that vanished was
    // a descendant of the one actually removed.
    if (this.selection !== undefined && !nodes[this.selection]) {
      this.selection = undefined;
    }
    this.nodes = nodes;
    this.revision += 1;
    this.layoutChangeEmitter.fire();
    this.stateSubscribers.forEach(fn => fn());
  }

  private toNode(id: string): DashboardNode | undefined {
    const data = this.nodes[id];
    return data ? { id, ...data } : undefined;
  }

  public getRoot = (): DashboardNode => this.toNode(ROOT_ID)!;

  public getNode = (id: string): DashboardNode | undefined => this.toNode(id);

  /**
   * The canvas a node sits in, or `undefined` for the root and for a node
   * that is not in the tree.
   *
   * {@link moveBuildingBlock} takes the destination parent as an argument, so
   * every caller that moves a node already has to know which parent it is in
   * — a caller reordering a node within its own container most of all. The
   * walk itself is one line, and leaving it out meant each caller wrote that
   * line again over a `nodes` map only this class is supposed to hold.
   */
  public getParentId = (id: string): string | undefined =>
    this.findParentId(id, this.nodes);

  /** True if `targetId` is `nodeId` itself or nested somewhere in its subtree. */
  private isNodeOrDescendant(nodeId: string, targetId: string): boolean {
    if (nodeId === targetId) return true;
    return (
      this.nodes[nodeId]?.children?.some(childId =>
        this.isNodeOrDescendant(childId, targetId),
      ) ?? false
    );
  }

  private findParentId(
    id: string,
    nodes: Record<string, StoredNode>,
  ): string | undefined {
    return Object.entries(nodes).find(([, node]) =>
      node.children?.includes(id),
    )?.[0];
  }

  /**
   * Displaces any of `parentId`'s explicitly placed children that now
   * collide with one another (see {@link resolveExplicitCollisions}) and
   * folds the result into `nodes`. `addBuildingBlock`/`updateLayout` are the
   * two ways an extension's AI tools place a node without going through
   * `CanvasBlock`'s interactive drag/resize at all — this gives that
   * programmatic path the same "nothing ends up stuck overlapping"
   * guarantee a mouse-driven resize gets for free from `react-grid-layout`,
   * rather than leaving it to whatever the renderer happens to paper over
   * on screen without ever writing the correction back to the store.
   */
  private resolveParentCollisions(
    parentId: string,
    nodes: Record<string, StoredNode>,
  ): Record<string, StoredNode> {
    const parent = nodes[parentId];
    if (!parent?.children) return nodes;

    const columns = parent.layout?.columns ?? DEFAULT_COLUMNS;
    const getNode = (nodeId: string): DashboardNode | undefined => {
      const data = nodes[nodeId];
      return data ? { id: nodeId, ...data } : undefined;
    };
    const adjustments = resolveExplicitCollisions(
      parent.children,
      columns,
      getNode,
    );
    if (Object.keys(adjustments).length === 0) return nodes;

    const result = { ...nodes };
    Object.entries(adjustments).forEach(([id, layout]) => {
      const node = result[id];
      if (node) result[id] = { ...node, layout: { ...node.layout, ...layout } };
    });
    return result;
  }

  public addBuildingBlock(
    parentId: string,
    index: number,
    spec: BuildingBlockSpec,
  ): string {
    const parent = this.nodes[parentId];
    if (!parent) {
      throw new Error(`[dashboard] Unknown parent node "${parentId}"`);
    }
    if (!parent.children) {
      throw new Error(
        `[dashboard] Node "${parentId}" cannot hold children (not a canvas)`,
      );
    }

    const id = generateNodeId();
    const node: StoredNode = {
      type: spec.type,
      layout: spec.layout,
      props: spec.props,
      style: spec.style,
      ...(isContainerType(spec.type) ? { children: [] } : {}),
    };

    const children = [...parent.children];
    const clampedIndex = Math.max(0, Math.min(index, children.length));
    children.splice(clampedIndex, 0, id);

    const nodes = {
      ...this.nodes,
      [parentId]: { ...parent, children },
      [id]: node,
    };

    this.commit(this.resolveParentCollisions(parentId, nodes));

    return id;
  }

  public removeBuildingBlock(id: string): void {
    if (id === ROOT_ID) {
      throw new Error('[dashboard] Cannot remove the root node');
    }
    if (!this.nodes[id]) return;

    const nodes = { ...this.nodes };
    const removeSubtree = (nodeId: string) => {
      nodes[nodeId]?.children?.forEach(removeSubtree);
      delete nodes[nodeId];
    };
    removeSubtree(id);

    Object.entries(nodes).forEach(([parentId, parent]) => {
      if (parent.children?.includes(id)) {
        nodes[parentId] = {
          ...parent,
          children: parent.children.filter(childId => childId !== id),
        };
      }
    });

    this.commit(nodes);
  }

  public moveBuildingBlock(
    id: string,
    newParentId: string,
    newIndex: number,
  ): void {
    if (id === ROOT_ID) {
      throw new Error('[dashboard] Cannot move the root node');
    }
    if (!this.nodes[id]) {
      throw new Error(`[dashboard] Unknown node "${id}"`);
    }
    if (!this.nodes[newParentId]?.children) {
      throw new Error(
        `[dashboard] Node "${newParentId}" cannot hold children (not a canvas)`,
      );
    }
    if (this.isNodeOrDescendant(id, newParentId)) {
      throw new Error(
        `[dashboard] Cannot move node "${id}" into itself or one of its own descendants`,
      );
    }

    const oldParentId = this.findParentId(id, this.nodes);

    const nodes = { ...this.nodes };
    Object.entries(nodes).forEach(([parentId, parent]) => {
      if (parent.children?.includes(id)) {
        nodes[parentId] = {
          ...parent,
          children: parent.children.filter(childId => childId !== id),
        };
      }
    });

    const targetParent = nodes[newParentId];
    const children = [...(targetParent.children ?? [])];
    const clampedIndex = Math.max(0, Math.min(newIndex, children.length));
    children.splice(clampedIndex, 0, id);
    nodes[newParentId] = { ...targetParent, children };

    // An explicit col/row (or a colSpan wider than the new parent's own
    // column count) was only ever meaningful in the *old* parent's grid —
    // carrying it over verbatim into the new one is how a moved node ends
    // up silently overlapping or overflowing its new siblings. Interactive
    // drag-based reparenting (see `CanvasBlock`'s `handleDragStop`) already
    // resets exactly these two things on drop; this is that same reset,
    // applied here so the programmatic path gives the same guarantee.
    //
    // None of which is true when the parent has not changed. A move within
    // one container is a reorder of reading/DOM/tab order alone, and the
    // position it keeps is the one the author placed it at. Resetting it
    // would teleport the block to auto-placement as the price of a reorder.
    if (oldParentId !== newParentId) {
      const node = nodes[id];
      const destColumns = targetParent.layout?.columns ?? DEFAULT_COLUMNS;
      nodes[id] = {
        ...node,
        layout: {
          ...node.layout,
          col: undefined,
          row: undefined,
          colSpan:
            node.layout?.colSpan != null
              ? Math.min(node.layout.colSpan, destColumns)
              : undefined,
        },
      };
    }

    this.commit(nodes);
  }

  public updateLayout(id: string, layout: Partial<LayoutProps>): void {
    const node = this.nodes[id];
    if (!node) {
      throw new Error(`[dashboard] Unknown node "${id}"`);
    }

    const nodes = {
      ...this.nodes,
      [id]: { ...node, layout: { ...node.layout, ...layout } },
    };

    const parentId = this.findParentId(id, nodes);
    this.commit(
      parentId ? this.resolveParentCollisions(parentId, nodes) : nodes,
    );
  }

  /**
   * Merges a `layout` update into each of several nodes at once, in a single
   * commit. A drag or resize that displaces siblings (see `CanvasBlock`)
   * resolves *all* of their new positions together — committing them one
   * {@link updateLayout} call at a time would tick the revision counter, and
   * so re-render every subscriber, once per displaced sibling instead of
   * once for the whole gesture.
   */
  public updateLayouts(updates: Record<string, Partial<LayoutProps>>): void {
    const nodes = { ...this.nodes };
    Object.entries(updates).forEach(([id, layout]) => {
      const node = nodes[id];
      if (!node) return;
      nodes[id] = { ...node, layout: { ...node.layout, ...layout } };
    });

    this.commit(nodes);
  }

  /**
   * Shallow-merges `props` into a node's existing props — the content-side
   * counterpart to {@link updateLayout}. Lets a chart's `echartsOptions`
   * (or a markdown block's `content`) be edited in place, instead of the
   * only alternative being remove + re-add, which loses the node's
   * position, layout, and identity just to change what it renders.
   */
  public updateProps(id: string, props: Record<string, unknown>): void {
    const node = this.nodes[id];
    if (!node) {
      throw new Error(`[dashboard] Unknown node "${id}"`);
    }

    this.commit({
      ...this.nodes,
      [id]: { ...node, props: { ...node.props, ...props } },
    });
  }

  public get onDidLayoutChange() {
    return this.layoutChangeEmitter.subscribe;
  }

  /** Test/demo helper — discards all nodes back to a blank canvas. */
  public reset(): void {
    this.nodes = createBlankNodes();
    this.selection = undefined;
    this.revision = 0;
    this.layoutChangeEmitter = createEventEmitter<void>();
    this.stateSubscribers.clear();
  }
}

export default DashboardProvider;
