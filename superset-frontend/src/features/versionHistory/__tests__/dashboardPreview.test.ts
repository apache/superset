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
import {
  ENTER_VERSION_PREVIEW,
  EXIT_VERSION_PREVIEW,
  enterVersionPreview,
  exitVersionPreview,
} from 'src/dashboard/actions/dashboardState';
import dashboardStateReducer from 'src/dashboard/reducers/dashboardState';
import sliceEntitiesReducer from 'src/dashboard/reducers/sliceEntities';
import dashboardLayoutReducer from 'src/dashboard/reducers/dashboardLayout';

test('dashboardState reducer stores captured originals on ENTER_VERSION_PREVIEW and clears on EXIT', () => {
  const initial = { editMode: false } as Parameters<
    typeof dashboardStateReducer
  >[0];
  const captured = { slices: { 1: { slice_id: 1 } } };
  const after = dashboardStateReducer(initial, {
    type: ENTER_VERSION_PREVIEW,
    versionUuid: 'v-1',
    capturedSliceEntities: captured,
    capturedLayout: { DASHBOARD_ROOT_ID: { id: 'root' } },
    newSliceEntities: { slices: {} },
    newLayout: {},
  });
  expect(after.versionPreview).toEqual({
    versionUuid: 'v-1',
    capturedSliceEntities: captured,
    capturedLayout: { DASHBOARD_ROOT_ID: { id: 'root' } },
  });
  // Unrelated state survives the swap.
  expect(after.editMode).toBe(false);

  const cleared = dashboardStateReducer(after, { type: EXIT_VERSION_PREVIEW });
  expect(cleared.versionPreview).toBeNull();
});

test('sliceEntities reducer swaps in newSliceEntities on ENTER and restores on EXIT', () => {
  const original = {
    slices: { 1: { slice_id: 1, slice_name: 'Live' } },
    isLoading: false,
    errorMessage: null,
    lastUpdated: 100,
  } as unknown as Parameters<typeof sliceEntitiesReducer>[0];
  const snapshot = {
    slices: { 2: { slice_id: 2, slice_name: 'Snapshot' } },
    isLoading: false,
    errorMessage: null,
    lastUpdated: 200,
  } as unknown as typeof original;

  const previewing = sliceEntitiesReducer(original, {
    type: ENTER_VERSION_PREVIEW,
    newSliceEntities: snapshot,
  } as unknown as Parameters<typeof sliceEntitiesReducer>[1]);
  expect(previewing).toBe(snapshot);

  const restored = sliceEntitiesReducer(previewing, {
    type: EXIT_VERSION_PREVIEW,
    restoreSliceEntities: original,
  } as unknown as Parameters<typeof sliceEntitiesReducer>[1]);
  expect(restored).toBe(original);
});

test('dashboardLayout reducer swaps in newLayout on ENTER and restores on EXIT', () => {
  const original = { ROOT_ID: { id: 'live' } } as unknown as Parameters<
    typeof dashboardLayoutReducer
  >[0];
  const snapshot = {
    ROOT_ID: { id: 'snapshot' },
  } as unknown as typeof original;

  const previewing = dashboardLayoutReducer(original, {
    type: ENTER_VERSION_PREVIEW,
    newLayout: snapshot,
  } as unknown as unknown as Parameters<typeof dashboardLayoutReducer>[1]);
  expect(previewing).toBe(snapshot);

  const restored = dashboardLayoutReducer(previewing, {
    type: EXIT_VERSION_PREVIEW,
    restoreLayout: original,
  } as unknown as unknown as Parameters<typeof dashboardLayoutReducer>[1]);
  expect(restored).toBe(original);
});

test('captured-original roundtrip leaves all three reducers byte-identical to their starting state', () => {
  const dashState = { editMode: true } as Parameters<
    typeof dashboardStateReducer
  >[0];
  const slices = {
    slices: { 1: { slice_id: 1, slice_name: 'Live' } },
    isLoading: false,
    errorMessage: null,
    lastUpdated: 1,
  } as unknown as Parameters<typeof sliceEntitiesReducer>[0];
  const layout = { ROOT_ID: { id: 'live' } } as unknown as Parameters<
    typeof dashboardLayoutReducer
  >[0];

  // Enter
  const dashEntered = dashboardStateReducer(dashState, {
    type: ENTER_VERSION_PREVIEW,
    versionUuid: 'v-1',
    capturedSliceEntities: slices,
    capturedLayout: layout,
    newSliceEntities: {},
    newLayout: {},
  });
  const slicesEntered = sliceEntitiesReducer(slices, {
    type: ENTER_VERSION_PREVIEW,
    newSliceEntities: {} as typeof slices,
  } as unknown as Parameters<typeof sliceEntitiesReducer>[1]);
  const layoutEntered = dashboardLayoutReducer(layout, {
    type: ENTER_VERSION_PREVIEW,
    newLayout: {} as typeof layout,
  } as unknown as unknown as Parameters<typeof dashboardLayoutReducer>[1]);

  // Exit using captured originals from dashState
  const dashRestored = dashboardStateReducer(dashEntered, {
    type: EXIT_VERSION_PREVIEW,
  });
  const slicesRestored = sliceEntitiesReducer(slicesEntered, {
    type: EXIT_VERSION_PREVIEW,
    restoreSliceEntities: dashEntered.versionPreview!.capturedSliceEntities,
  } as unknown as Parameters<typeof sliceEntitiesReducer>[1]);
  const layoutRestored = dashboardLayoutReducer(layoutEntered, {
    type: EXIT_VERSION_PREVIEW,
    restoreLayout: dashEntered.versionPreview!.capturedLayout,
  } as unknown as unknown as Parameters<typeof dashboardLayoutReducer>[1]);

  expect(dashRestored.editMode).toBe(true);
  expect(dashRestored.versionPreview).toBeNull();
  expect(slicesRestored).toBe(slices);
  expect(layoutRestored).toBe(layout);
});

test('enterVersionPreview thunk preserves the original capture when switching A → B', () => {
  // A→B switch must not capture the already-swapped A state as the
  // "original", or exit would restore to A instead of the user's live
  // pre-preview state.
  const liveSlices = {
    slices: { 1: { slice_id: 1, slice_name: 'Live' } },
    isLoading: false,
    errorMessage: null,
    lastUpdated: 0,
  };
  const liveLayout = { ROOT_ID: { id: 'live' } };

  const stateA = {
    dashboardState: { versionPreview: null },
    sliceEntities: liveSlices,
    dashboardLayout: { present: liveLayout },
  };
  const dispatched: Array<{ type: string; [k: string]: unknown }> = [];
  const dispatch = (action: unknown) => {
    if (
      action &&
      typeof action === 'object' &&
      'type' in (action as Record<string, unknown>)
    ) {
      dispatched.push(action as { type: string });
    }
  };

  // Enter A.
  enterVersionPreview(
    'a-1111aaaa-2222-3333-4444-aaaaaaaaaaaa' as string,
    {
      slices: [{ slice_id: 9, slice_name: 'A' }],
      position_json: '{"ROOT_ID":{"id":"a"},"GRID_ID":{"id":"g"}}',
    } as unknown as Parameters<typeof enterVersionPreview>[1],
  )(dispatch as never, () => stateA as never);
  const firstEnter = dispatched.find(a => a.type === ENTER_VERSION_PREVIEW)!;
  expect(firstEnter.capturedSliceEntities).toBe(liveSlices);
  expect(firstEnter.capturedLayout).toBe(liveLayout);

  // Now we're "in preview A". Simulate dashboardState.versionPreview being
  // set and the live state having been replaced with A's data.
  const stateAfterA = {
    dashboardState: {
      versionPreview: {
        versionUuid: 'a-1111aaaa-2222-3333-4444-aaaaaaaaaaaa',
        capturedSliceEntities: liveSlices,
        capturedLayout: liveLayout,
      },
    },
    sliceEntities: { slices: { 9: { slice_id: 9 } } },
    dashboardLayout: { present: { ROOT_ID: { id: 'a' } } },
  };

  dispatched.length = 0;
  enterVersionPreview(
    'b-2222bbbb-3333-4444-5555-bbbbbbbbbbbb' as string,
    {
      slices: [{ slice_id: 11, slice_name: 'B' }],
      position_json: '{"ROOT_ID":{"id":"b"},"GRID_ID":{"id":"g"}}',
    } as unknown as Parameters<typeof enterVersionPreview>[1],
  )(dispatch as never, () => stateAfterA as never);
  const secondEnter = dispatched.find(a => a.type === ENTER_VERSION_PREVIEW)!;
  // Critical: the captured originals are still the LIVE values, not A.
  expect(secondEnter.capturedSliceEntities).toBe(liveSlices);
  expect(secondEnter.capturedLayout).toBe(liveLayout);
});

test('exitVersionPreview thunk is a no-op when no preview is active', () => {
  const state = { dashboardState: { versionPreview: null } };
  const dispatched: unknown[] = [];
  exitVersionPreview()(
    ((a: unknown) => {
      dispatched.push(a);
    }) as never,
    () => state as never,
  );
  // No EXIT action dispatched.
  expect(
    dispatched.find(
      a =>
        a &&
        typeof a === 'object' &&
        (a as { type?: string }).type === EXIT_VERSION_PREVIEW,
    ),
  ).toBeUndefined();
});

test('enterVersionPreview merges live slices when the snapshot omits them', () => {
  // The dashboard snapshot endpoint does not currently emit a ``slices``
  // array. If we replaced sliceEntities.slices with {} on enter, every
  // CHART- component in the layout would resolve to undefined and crash
  // the renderer.
  const liveSlices = {
    7: { slice_id: 7, slice_name: 'Live A' },
    9: { slice_id: 9, slice_name: 'Live B' },
  };
  const stateNoCapture = {
    dashboardState: { versionPreview: null },
    sliceEntities: { slices: liveSlices, isLoading: false },
    dashboardLayout: { present: { ROOT_ID: {}, GRID_ID: {} } },
  };
  const dispatched: Array<{ type: string; [k: string]: unknown }> = [];
  const dispatch = (a: unknown) => {
    if (a && typeof a === 'object' && 'type' in (a as Record<string, unknown>)) {
      dispatched.push(a as { type: string });
    }
  };
  const result = enterVersionPreview(
    '11111111-2222-3333-4444-555555555555',
    {
      // No ``slices`` field — matches Mike's current backend payload.
      position_json: '{"ROOT_ID":{"id":"root"},"GRID_ID":{"id":"grid"}}',
    } as unknown as Parameters<typeof enterVersionPreview>[1],
  )(dispatch as never, () => stateNoCapture as never);
  expect(result).toBe(true);
  const enter = dispatched.find(a => a.type === ENTER_VERSION_PREVIEW)!;
  // Live slices must survive the swap.
  expect(
    (enter.newSliceEntities as { slices: Record<string, unknown> }).slices,
  ).toMatchObject(liveSlices);
});

test('enterVersionPreview lets snapshot slices override live entries on id collision', () => {
  // Direction matters: when both the live state and the snapshot have an
  // entry for the same slice_id, the snapshot value must win (otherwise
  // we silently render live data while the banner claims preview mode).
  const liveSlices = {
    7: { slice_id: 7, slice_name: 'Live A' },
    9: { slice_id: 9, slice_name: 'Live B' },
  };
  const state = {
    dashboardState: { versionPreview: null },
    sliceEntities: { slices: liveSlices, isLoading: false },
    dashboardLayout: { present: { ROOT_ID: {}, GRID_ID: {} } },
    dashboardInfo: {},
  };
  const dispatched: Array<{ type: string; [k: string]: unknown }> = [];
  const dispatch = (a: unknown) => {
    if (
      a &&
      typeof a === 'object' &&
      'type' in (a as Record<string, unknown>)
    ) {
      dispatched.push(a as { type: string });
    }
  };
  enterVersionPreview(
    '33333333-4444-5555-6666-777777777777',
    {
      slices: [
        { slice_id: 7, slice_name: 'Snapshot A' },
        { slice_id: 42, slice_name: 'Snapshot only' },
      ],
      position_json: '{"ROOT_ID":{"id":"root"},"GRID_ID":{"id":"grid"}}',
    } as unknown as Parameters<typeof enterVersionPreview>[1],
  )(dispatch as never, () => state as never);
  const enter = dispatched.find(a => a.type === ENTER_VERSION_PREVIEW)!;
  const merged = (
    enter.newSliceEntities as { slices: Record<number, { slice_name: string }> }
  ).slices;
  // Snapshot wins for the colliding id.
  expect(merged[7].slice_name).toBe('Snapshot A');
  // Snapshot-only id is included.
  expect(merged[42].slice_name).toBe('Snapshot only');
  // Live-only id survives.
  expect(merged[9].slice_name).toBe('Live B');
});

test('enterVersionPreview captures dashboardInfo scalars and emits a swap payload', () => {
  // The user-reported bug: editing the dashboard title and previewing an
  // older version left the live title visible. The thunk must capture the
  // live scalar fields and dispatch the snapshot's scalars as the swap.
  const state = {
    dashboardState: { versionPreview: null },
    sliceEntities: { slices: {}, isLoading: false },
    dashboardLayout: { present: { ROOT_ID: {}, GRID_ID: {} } },
    dashboardInfo: {
      dashboard_title: 'Live title',
      description: 'Live description',
      slug: 'live-slug',
      css: '/* live */',
      json_metadata: '{"live":true}',
      published: true,
    },
  };
  const dispatched: Array<{ type: string; [k: string]: unknown }> = [];
  const dispatch = (a: unknown) => {
    if (
      a &&
      typeof a === 'object' &&
      'type' in (a as Record<string, unknown>)
    ) {
      dispatched.push(a as { type: string });
    }
  };
  enterVersionPreview(
    '44444444-5555-6666-7777-888888888888',
    {
      dashboard_title: 'Snapshot title',
      description: 'Snapshot description',
      css: '/* snapshot */',
      published: false,
      position_json: '{"ROOT_ID":{"id":"root"},"GRID_ID":{"id":"grid"}}',
    } as unknown as Parameters<typeof enterVersionPreview>[1],
  )(dispatch as never, () => state as never);
  const enter = dispatched.find(a => a.type === ENTER_VERSION_PREVIEW)!;
  expect(enter.capturedDashboardInfo).toEqual({
    dashboard_title: 'Live title',
    description: 'Live description',
    slug: 'live-slug',
    css: '/* live */',
    json_metadata: '{"live":true}',
    published: true,
  });
  expect(enter.newDashboardInfo).toEqual({
    dashboard_title: 'Snapshot title',
    description: 'Snapshot description',
    css: '/* snapshot */',
    published: false,
  });
  // The injected DASHBOARD_HEADER_ID block carries the snapshot title so
  // the visible H1 (which reads from layout, not from dashboardInfo)
  // reflects the preview.
  const layout = enter.newLayout as Record<
    string,
    { meta?: { text?: string } }
  >;
  expect(layout.HEADER_ID?.meta?.text).toBe('Snapshot title');
});

test('exitVersionPreview emits the captured dashboardInfo as restoreDashboardInfo', () => {
  const captured = {
    dashboard_title: 'Live title',
    description: 'Live description',
    slug: 'live-slug',
    css: '/* live */',
    json_metadata: '{"live":true}',
    published: true,
  };
  const state = {
    dashboardState: {
      versionPreview: {
        versionUuid: '44444444-5555-6666-7777-888888888888',
        capturedSliceEntities: { slices: {}, isLoading: false },
        capturedLayout: { ROOT_ID: {}, GRID_ID: {} },
        capturedDashboardInfo: captured,
      },
    },
  };
  const dispatched: Array<{ type: string; [k: string]: unknown }> = [];
  const dispatch = (a: unknown) => {
    if (
      a &&
      typeof a === 'object' &&
      'type' in (a as Record<string, unknown>)
    ) {
      dispatched.push(a as { type: string });
    }
  };
  exitVersionPreview()(dispatch as never, () => state as never);
  const exit = dispatched.find(a => a.type === EXIT_VERSION_PREVIEW)!;
  expect(exit.restoreDashboardInfo).toBe(captured);
});

test('enterVersionPreview bails when position_json lacks ROOT_ID/GRID_ID', () => {
  // Malformed layout should not be dispatched — the dashboard renderer
  // would otherwise crash trying to walk an empty structure.
  const state = {
    dashboardState: { versionPreview: null },
    sliceEntities: { slices: {}, isLoading: false },
    dashboardLayout: { present: { ROOT_ID: {}, GRID_ID: {} } },
  };
  const dispatched: Array<{ type: string }> = [];
  const dispatch = (a: unknown) => {
    if (a && typeof a === 'object' && 'type' in (a as Record<string, unknown>)) {
      dispatched.push(a as { type: string });
    }
  };
  // Missing position_json entirely.
  const result = enterVersionPreview(
    '11111111-2222-3333-4444-555555555555',
    {} as unknown as Parameters<typeof enterVersionPreview>[1],
  )(dispatch as never, () => state as never);
  expect(result).toBe(false);
  expect(
    dispatched.find(a => a.type === ENTER_VERSION_PREVIEW),
  ).toBeUndefined();

  // Empty layout object also bails.
  const result2 = enterVersionPreview('22222222-2222-3333-4444-555555555555', {
    position_json: '{}',
  } as unknown as Parameters<typeof enterVersionPreview>[1])(
    dispatch as never,
    () => state as never,
  );
  expect(result2).toBe(false);
});
