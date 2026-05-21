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
      position_json: '{"ROOT_ID":{"id":"a"}}',
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
      position_json: '{"ROOT_ID":{"id":"b"}}',
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
