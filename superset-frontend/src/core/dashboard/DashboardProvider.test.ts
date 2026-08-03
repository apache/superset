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
import DashboardProvider from './DashboardProvider';

beforeEach(() => {
  DashboardProvider.getInstance().reset();
});

test('returns the singleton instance', () => {
  expect(DashboardProvider.getInstance()).toBe(DashboardProvider.getInstance());
});

test('starts with a blank root canvas', () => {
  const provider = DashboardProvider.getInstance();

  expect(provider.getRoot()).toEqual({
    id: 'root',
    type: 'canvas',
    layout: { columns: 24, gap: 16 },
    children: [],
  });
});

test('getNode returns undefined for an unknown id', () => {
  expect(DashboardProvider.getInstance().getNode('missing')).toBeUndefined();
});

test('addBuildingBlock inserts a node into the parent at the given index', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;

  const firstId = provider.addBuildingBlock(rootId, 0, { type: 'text' });
  const secondId = provider.addBuildingBlock(rootId, 0, { type: 'text' });

  expect(provider.getRoot().children).toEqual([secondId, firstId]);
});

test('addBuildingBlock clamps an out-of-range index', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;

  const id = provider.addBuildingBlock(rootId, 99, { type: 'text' });

  expect(provider.getRoot().children).toEqual([id]);
});

test('addBuildingBlock gives canvas nodes an empty children array', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;

  const id = provider.addBuildingBlock(rootId, 0, { type: 'canvas' });

  expect(provider.getNode(id)?.children).toEqual([]);
});

test('addBuildingBlock throws for an unknown parent', () => {
  const provider = DashboardProvider.getInstance();

  expect(() =>
    provider.addBuildingBlock('missing', 0, { type: 'text' }),
  ).toThrow(/Unknown parent node/);
});

test('addBuildingBlock throws when the parent cannot hold children', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const leafId = provider.addBuildingBlock(rootId, 0, { type: 'text' });

  expect(() => provider.addBuildingBlock(leafId, 0, { type: 'text' })).toThrow(
    /not a canvas/,
  );
});

test('removeBuildingBlock detaches the node from its parent', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const id = provider.addBuildingBlock(rootId, 0, { type: 'text' });

  provider.removeBuildingBlock(id);

  expect(provider.getNode(id)).toBeUndefined();
  expect(provider.getRoot().children).toEqual([]);
});

test('removeBuildingBlock removes an entire canvas subtree', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const canvasId = provider.addBuildingBlock(rootId, 0, { type: 'canvas' });
  const childId = provider.addBuildingBlock(canvasId, 0, { type: 'text' });

  provider.removeBuildingBlock(canvasId);

  expect(provider.getNode(canvasId)).toBeUndefined();
  expect(provider.getNode(childId)).toBeUndefined();
});

test('removeBuildingBlock throws for the root node', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;

  expect(() => provider.removeBuildingBlock(rootId)).toThrow(
    /Cannot remove the root node/,
  );
});

test('removeBuildingBlock is a no-op for an unknown id', () => {
  const provider = DashboardProvider.getInstance();
  const revisionBefore = provider.getRevision();

  provider.removeBuildingBlock('missing');

  expect(provider.getRevision()).toBe(revisionBefore);
});

test('moveBuildingBlock relocates a node to a new parent at the given index', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const canvasId = provider.addBuildingBlock(rootId, 0, { type: 'canvas' });
  const id = provider.addBuildingBlock(rootId, 1, { type: 'text' });

  provider.moveBuildingBlock(id, canvasId, 0);

  expect(provider.getRoot().children).toEqual([canvasId]);
  expect(provider.getNode(canvasId)?.children).toEqual([id]);
});

test('moveBuildingBlock throws when moving the root node', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const canvasId = provider.addBuildingBlock(rootId, 0, { type: 'canvas' });

  expect(() => provider.moveBuildingBlock(rootId, canvasId, 0)).toThrow(
    /Cannot move the root node/,
  );
});

test('moveBuildingBlock throws when the target cannot hold children', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const leafId = provider.addBuildingBlock(rootId, 0, { type: 'text' });
  const otherId = provider.addBuildingBlock(rootId, 1, { type: 'text' });

  expect(() => provider.moveBuildingBlock(otherId, leafId, 0)).toThrow(
    /not a canvas/,
  );
});

test('moveBuildingBlock throws when moving a node into its own subtree', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const canvasId = provider.addBuildingBlock(rootId, 0, { type: 'canvas' });
  const childCanvasId = provider.addBuildingBlock(canvasId, 0, {
    type: 'canvas',
  });

  expect(() => provider.moveBuildingBlock(canvasId, childCanvasId, 0)).toThrow(
    /into itself or one of its own descendants/,
  );
});

test("updateLayout merges into the node's existing layout", () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const id = provider.addBuildingBlock(rootId, 0, {
    type: 'text',
    layout: { colSpan: 12 },
  });

  provider.updateLayout(id, { rowSpan: 2 });

  expect(provider.getNode(id)?.layout).toEqual({
    colSpan: 12,
    rowSpan: 2,
  });
});

test('updateLayout throws for an unknown node', () => {
  const provider = DashboardProvider.getInstance();

  expect(() => provider.updateLayout('missing', { colSpan: 12 })).toThrow(
    /Unknown node/,
  );
});

test('updateLayout displaces an explicitly placed sibling it now collides with', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const firstId = provider.addBuildingBlock(rootId, 0, {
    type: 'text',
    layout: { col: 1, row: 1, colSpan: 24 },
  });
  const secondId = provider.addBuildingBlock(rootId, 1, {
    type: 'text',
    layout: { col: 1, row: 2, colSpan: 24 },
  });

  // Growing `first` down into row 2 now overlaps `second`, which is also
  // explicitly placed — this mirrors what an AI tool call (not a mouse
  // drag) can do, since it goes through this method directly rather than
  // through CanvasBlock/react-grid-layout's own collision handling.
  provider.updateLayout(firstId, { rowSpan: 2 });

  expect(provider.getNode(firstId)?.layout).toEqual({
    col: 1,
    row: 1,
    colSpan: 24,
    rowSpan: 2,
  });
  expect(provider.getNode(secondId)?.layout).toEqual({
    col: 1,
    row: 3,
    colSpan: 24,
  });
});

test('addBuildingBlock displaces the new node when it collides with an earlier explicit sibling', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const existingId = provider.addBuildingBlock(rootId, 0, {
    type: 'text',
    layout: { col: 1, row: 1, colSpan: 24 },
  });

  // Inserted after `existingId` in children order, so — same rule
  // `resolveExplicitCollisions` uses (earlier in `children` order keeps its
  // declared position) — it's the new node that gets pushed down, not the
  // one already there.
  const newId = provider.addBuildingBlock(rootId, 1, {
    type: 'text',
    layout: { col: 1, row: 1, colSpan: 24 },
  });

  expect(provider.getNode(existingId)?.layout).toEqual({
    col: 1,
    row: 1,
    colSpan: 24,
  });
  expect(provider.getNode(newId)?.layout).toEqual({
    col: 1,
    row: 2,
    colSpan: 24,
  });
});

test('updateLayout does not resolve collisions for a node with no parent (the root)', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;

  expect(() => provider.updateLayout(rootId, { gap: 24 })).not.toThrow();
  expect(provider.getRoot().layout).toEqual({ columns: 24, gap: 24 });
});

test('updateLayouts merges a layout update into each node in a single commit', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const firstId = provider.addBuildingBlock(rootId, 0, {
    type: 'text',
    layout: { colSpan: 6 },
  });
  const secondId = provider.addBuildingBlock(rootId, 1, {
    type: 'text',
    layout: { colSpan: 6 },
  });
  const revisionBefore = provider.getRevision();

  provider.updateLayouts({
    [firstId]: { col: 1, row: 1 },
    [secondId]: { col: 7, row: 1 },
  });

  expect(provider.getNode(firstId)?.layout).toEqual({
    colSpan: 6,
    col: 1,
    row: 1,
  });
  expect(provider.getNode(secondId)?.layout).toEqual({
    colSpan: 6,
    col: 7,
    row: 1,
  });
  expect(provider.getRevision()).toBe(revisionBefore + 1);
});

test('updateLayouts silently skips an unknown node id', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const id = provider.addBuildingBlock(rootId, 0, { type: 'text' });

  expect(() =>
    provider.updateLayouts({ missing: { col: 1 }, [id]: { col: 2 } }),
  ).not.toThrow();
  expect(provider.getNode(id)?.layout).toEqual({ col: 2 });
});

test('onDidLayoutChange fires on every mutation', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const listener = jest.fn();
  const disposable = provider.onDidLayoutChange(listener);

  provider.addBuildingBlock(rootId, 0, { type: 'text' });

  expect(listener).toHaveBeenCalledTimes(1);
  disposable.dispose();
});

test('getRevision increments on every mutation and is stable otherwise', () => {
  const provider = DashboardProvider.getInstance();
  const rootId = provider.getRoot().id;
  const before = provider.getRevision();

  expect(provider.getRevision()).toBe(before);

  provider.addBuildingBlock(rootId, 0, { type: 'text' });

  expect(provider.getRevision()).toBe(before + 1);
});
